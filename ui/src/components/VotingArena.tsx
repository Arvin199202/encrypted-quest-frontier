import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFHEVM } from '@/hooks/useFHEVM';
import { getContractAddress } from '@/abi/CommunityVotingAddresses';
import { useChainId } from 'wagmi';
import { toast } from 'sonner';
import { Lock, Vote, CheckCircle2, Loader2 } from 'lucide-react';

// ABI for CommunityVoting contract
const COMMUNITY_VOTING_ABI = [
  {
    inputs: [
      { internalType: 'externalEuint32', name: 'encryptedCandidate', type: 'bytes32' },
      { internalType: 'bytes', name: 'inputProof', type: 'bytes' }
    ],
    name: 'vote',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'address', name: 'voter', type: 'address' }],
    name: 'checkHasVoted',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'address', name: 'voter', type: 'address' }],
    name: 'getUserVote',
    outputs: [{ internalType: 'euint32', name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'getVoteCounts',
    outputs: [
      { internalType: 'euint32', name: 'candidate1Votes', type: 'bytes32' },
      { internalType: 'euint32', name: 'candidate2Votes', type: 'bytes32' },
      { internalType: 'euint32', name: 'candidate3Votes', type: 'bytes32' },
      { internalType: 'euint32', name: 'candidate4Votes', type: 'bytes32' },
      { internalType: 'euint32', name: 'totalVotes', type: 'bytes32' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'authorizeUserForDecryption',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;

const candidates = [
  { id: 0, name: 'Community Development Lead', color: 'primary' },
  { id: 1, name: 'Treasury Manager', color: 'secondary' },
  { id: 2, name: 'Events Coordinator', color: 'accent' },
  { id: 3, name: 'Technical Advisor', color: 'success' },
];

const VotingArena = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { instance, isInitialized, isLoading: fhevmLoading, error: fhevmError, initializeInstance } = useFHEVM();
  const [selectedCandidate, setSelectedCandidate] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  const contractAddress = getContractAddress(chainId);

  const { data: hasVotedData, refetch: refetchHasVoted } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: COMMUNITY_VOTING_ABI,
    functionName: 'checkHasVoted',
    args: address ? [address] : undefined,
    enabled: !!address && !!contractAddress,
  });

  const { writeContract, data: hash, isPending: isPendingWrite } = useWriteContract();
  const { isLoading: isPendingTx } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (hasVotedData !== undefined) {
      setHasVoted(hasVotedData);
    }
  }, [hasVotedData]);

  // Reset hasVoted state when address changes
  useEffect(() => {
    setHasVoted(false);
    if (address && contractAddress) {
      refetchHasVoted();
    }
  }, [address, contractAddress, refetchHasVoted]);

  useEffect(() => {
    if (!isInitialized && isConnected && !fhevmLoading && !fhevmError) {
      initializeInstance();
    }
  }, [isConnected, isInitialized, fhevmLoading, fhevmError, initializeInstance]);

  const handleVote = async () => {
    // Check if candidate is selected (0 is valid for candidate 1)
    if (!instance || !address || selectedCandidate === null || selectedCandidate === undefined) {
      if (!instance || !address) {
        toast.error('Please connect your wallet first');
      } else {
        toast.error('Please select a candidate');
      }
      return;
    }

    if (!contractAddress) {
      toast.error('Contract address not configured');
      return;
    }

    if (hasVoted) {
      toast.error('You have already voted');
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('Creating encrypted input for candidate:', selectedCandidate);
      console.log('Contract address:', contractAddress);
      console.log('User address:', address);
      
      // Create encrypted input - chain the methods correctly
      const encrypted = await instance
        .createEncryptedInput(contractAddress as `0x${string}`, address as `0x${string}`)
        .add32(selectedCandidate)
        .encrypt();

      console.log('Encrypted input created:', encrypted);
      console.log('Handle:', encrypted.handles[0]);
      console.log('Input proof length:', encrypted.inputProof?.length);

      if (!encrypted.handles || encrypted.handles.length === 0) {
        throw new Error('Failed to generate encrypted handle');
      }

      if (!encrypted.inputProof) {
        throw new Error('Failed to generate input proof');
      }

      // Convert handle from Uint8Array to hex string if needed
      let handle = encrypted.handles[0];
      if (handle instanceof Uint8Array) {
        // Convert Uint8Array to hex string (bytes32 format)
        handle = '0x' + Array.from(handle)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        console.log('Converted handle to hex:', handle);
      } else if (typeof handle === 'string' && !handle.startsWith('0x')) {
        handle = '0x' + handle;
      }

      // Convert inputProof from Uint8Array to hex string if needed
      let inputProof = encrypted.inputProof;
      if (inputProof instanceof Uint8Array) {
        // Convert Uint8Array to hex string
        inputProof = '0x' + Array.from(inputProof)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        console.log('Converted inputProof to hex, length:', inputProof.length);
      } else if (typeof inputProof === 'string' && !inputProof.startsWith('0x')) {
        inputProof = '0x' + inputProof;
      }

      // Submit vote
      console.log('Submitting vote transaction...');
      console.log('Final handle:', handle);
      console.log('Final inputProof:', inputProof.substring(0, 20) + '...');
      
      writeContract({
        address: contractAddress as `0x${string}`,
        abi: COMMUNITY_VOTING_ABI,
        functionName: 'vote',
        args: [handle, inputProof],
      });
    } catch (err: any) {
      console.error('Vote error:', err);
      toast.error(err?.message || 'Failed to submit vote');
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (hash) {
      console.log('Transaction hash:', hash);
      if (isPendingTx) {
        console.log('Waiting for transaction confirmation...');
        toast.info('Transaction submitted, waiting for confirmation...');
      }
    }
  }, [hash, isPendingTx]);

  useEffect(() => {
    if (hash && !isPendingTx && !isPendingWrite) {
      console.log('Transaction confirmed!');
      toast.success('Vote submitted successfully!');
      setIsSubmitting(false);
      refetchHasVoted();
      setSelectedCandidate(null);
    }
  }, [hash, isPendingTx, isPendingWrite, refetchHasVoted]);

  if (!isConnected) {
    return (
      <div className="text-center py-24">
        <Lock className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-2xl font-bold mb-2">Connect Your Wallet</h3>
        <p className="text-muted-foreground">Please connect your wallet to vote</p>
      </div>
    );
  }

  if (fhevmLoading || !isInitialized) {
    return (
      <div className="text-center py-24">
        <Loader2 className="w-16 h-16 mx-auto mb-4 text-primary animate-spin" />
        <h3 className="text-2xl font-bold mb-2">Initializing Encryption</h3>
        <p className="text-muted-foreground">Please wait...</p>
      </div>
    );
  }

  if (fhevmError) {
    return (
      <div className="text-center py-24">
        <p className="text-destructive mb-4">{fhevmError}</p>
        <Button onClick={initializeInstance}>Retry</Button>
      </div>
    );
  }

  if (hasVoted) {
    return (
      <div className="text-center py-24 max-w-2xl mx-auto">
        <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-success" />
        <h3 className="text-2xl font-bold mb-2">You Have Already Voted</h3>
        <p className="text-muted-foreground mb-6">
          Your encrypted vote has been recorded on the blockchain.
        </p>
        <Button onClick={() => window.location.href = '/results'}>
          View Results
        </Button>
      </div>
    );
  }

  return (
    <section className="py-24 px-6">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h3 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">Cast Your Vote</h3>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Your vote is encrypted and remains private until decryption
          </p>
        </div>

        <Card className="p-8 max-w-4xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="w-6 h-6 text-primary" />
              <h4 className="text-2xl font-semibold">Select a Candidate</h4>
            </div>
            <p className="text-muted-foreground mb-6">
              Choose one of the four community committee candidates. Your vote will be encrypted on-chain.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {candidates.map((candidate) => {
              const isSelected = selectedCandidate === candidate.id;
              return (
                <button
                  key={candidate.id}
                  onClick={() => setSelectedCandidate(candidate.id)}
                  className={`p-6 rounded-xl border-2 transition-all duration-300 ${
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-lg scale-105'
                      : 'border-border hover:border-muted-foreground/50 hover:bg-muted/30'
                  }`}
                >
                  <Vote className={`w-12 h-12 mx-auto mb-3 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  <p className={`font-semibold text-lg ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {candidate.name}
                  </p>
                </button>
              );
            })}
          </div>

          <Button
            onClick={handleVote}
            disabled={selectedCandidate === null || selectedCandidate === undefined || isSubmitting || isPendingWrite || isPendingTx}
            size="lg"
            className="w-full text-lg py-6 h-auto"
          >
            {isSubmitting || isPendingWrite || isPendingTx ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Submitting Vote...
              </>
            ) : (
              <>
                <Lock className="w-5 h-5 mr-2" />
                Submit Encrypted Vote
              </>
            )}
          </Button>
        </Card>
      </div>
    </section>
  );
};

export default VotingArena;

