import { useState, useEffect, useMemo } from 'react';
import { useAccount, useReadContract, useWalletClient, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFHEVM } from '@/hooks/useFHEVM';
import { getContractAddress } from '@/abi/CommunityVotingAddresses';
import { useChainId } from 'wagmi';
import { toast } from 'sonner';
import { Lock, Unlock, Vote, Loader2, RefreshCw } from 'lucide-react';
import { FhevmDecryptionSignature } from '@/fhevm/FhevmDecryptionSignature';
import { GenericStringInMemoryStorage } from '@/fhevm/GenericStringStorage';
import { ethers } from 'ethers';

// ABI for CommunityVoting contract
const COMMUNITY_VOTING_ABI = [
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

const ResultsDisplay = () => {
  const { address, isConnected, connector } = useAccount();
  const chainId = useChainId();
  const { instance, isInitialized } = useFHEVM();
  const { data: walletClient } = useWalletClient();
  const [voteCounts, setVoteCounts] = useState<(number | null)[]>([null, null, null, null, null]);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const contractAddress = getContractAddress(chainId);

  // Create storage instance for decryption signatures
  const storage = useMemo(() => new GenericStringInMemoryStorage(), []);

  // Get ethers signer from wallet client - use the currently connected wallet
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);

  useEffect(() => {
    if (!walletClient || !address) {
      setSigner(null);
      return;
    }

    const createSigner = async () => {
      try {
        // Get the EIP-1193 provider from the connector
        // This ensures we use the wallet that wagmi is actually connected to
        let eip1193Provider: ethers.Eip1193Provider | null = null;

        // Method 1: Get provider from connector (most reliable)
        if (connector) {
          try {
            // Try to get provider from connector
            const provider = await connector.getProvider();
            if (provider && 'request' in provider) {
              eip1193Provider = provider as ethers.Eip1193Provider;
              console.log('Got provider from connector:', connector.name);
            }
          } catch (err) {
            console.warn('Failed to get provider from connector:', err);
          }
        }

        // Method 2: Get provider from walletClient transport
        if (!eip1193Provider && walletClient?.transport) {
          try {
            // Some transports wrap the provider
            const transport = walletClient.transport as any;
            if (transport.value && 'request' in transport.value) {
              eip1193Provider = transport.value as ethers.Eip1193Provider;
              console.log('Got provider from walletClient transport');
            } else if ('request' in transport) {
              eip1193Provider = transport as ethers.Eip1193Provider;
              console.log('Got provider from walletClient transport (direct)');
            }
          } catch (err) {
            console.warn('Failed to get provider from walletClient transport:', err);
          }
        }

        // Method 3: Fallback to window.ethereum (should match the connected wallet)
        if (!eip1193Provider) {
          const ethereum = (window as any).ethereum;
          if (ethereum && 'request' in ethereum) {
            eip1193Provider = ethereum as ethers.Eip1193Provider;
            console.log('Using window.ethereum as fallback');
          }
        }

        if (!eip1193Provider) {
          console.warn('EIP-1193 provider not found');
          setSigner(null);
          return;
        }

        console.log('Creating signer from wallet provider for address:', address);
        console.log('Using connector:', connector?.name || 'unknown');
        
        // Create BrowserProvider from the wallet's EIP-1193 provider
        const provider = new ethers.BrowserProvider(eip1193Provider, chainId);
        const signerInstance = await provider.getSigner(address);
        setSigner(signerInstance);
        console.log('Signer created successfully from connected wallet');
      } catch (err) {
        console.error('Failed to create signer:', err);
        setSigner(null);
      }
    };

    createSigner();
  }, [walletClient, address, chainId, connector]);

  const { data: encryptedCounts, refetch: refetchCounts } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: COMMUNITY_VOTING_ABI,
    functionName: 'getVoteCounts',
    enabled: !!contractAddress,
  });

  const { writeContract: writeAuthorize, data: authHash, isPending: isPendingAuth } = useWriteContract();
  const { isLoading: isPendingAuthTx } = useWaitForTransactionReceipt({ hash: authHash });

  // Auto-authorize user for decryption when component mounts or address changes
  useEffect(() => {
    const authorizeUser = async () => {
      // Authorize on both local network and Sepolia testnet
      const isSupportedNetwork = chainId === 31337 || chainId === 11155111;
      if (!address || !contractAddress || !signer || !isSupportedNetwork) {
        return;
      }

      try {
        console.log('Auto-authorizing user for decryption...');
        const contract = new ethers.Contract(
          contractAddress,
          COMMUNITY_VOTING_ABI,
          signer
        );

        const tx = await contract.authorizeUserForDecryption(address);
        console.log('Authorization transaction sent...');
        await tx.wait();
        console.log('User auto-authorized successfully');
      } catch (authErr: any) {
        console.warn('Auto-authorization failed (may already be authorized):', authErr?.message || authErr);
      }
    };

    authorizeUser();
  }, [address, contractAddress, signer, chainId]);

  const decryptCounts = async () => {
    if (!instance || !address || !encryptedCounts || !contractAddress || !signer) {
      if (!signer) {
        toast.error('Wallet signer not available. Please ensure your wallet is connected.');
      } else {
        toast.error('Encryption instance or contract address not available');
      }
      return;
    }

    setIsDecrypting(true);

    try {
      console.log('Starting decryption process...');

      // For local/mock networks and Sepolia testnet, ensure user is authorized
      const isSupportedNetwork = chainId === 31337 || chainId === 11155111;
      if (isSupportedNetwork && contractAddress && address && signer) {
        try {
          console.log('Ensuring user authorization for decryption...');

          const contract = new ethers.Contract(
            contractAddress,
            COMMUNITY_VOTING_ABI,
            signer
          );

          try {
            const tx = await contract.authorizeUserForDecryption(address);
            console.log('Authorization transaction sent, waiting for confirmation...');
            await tx.wait();
            console.log('User authorized successfully');
          } catch (authErr: any) {
            // If authorization fails, it might be because:
            // 1. User is already authorized
            // 2. Transaction would revert
            console.warn('Authorization attempt failed (may already be authorized):', authErr?.message || authErr);
          }
        } catch (authErr) {
          console.warn('Authorization setup failed:', authErr);
        }
      }
      
      // Load or create decryption signature
      const signature = await FhevmDecryptionSignature.loadOrSign(
        instance,
        [contractAddress],
        signer,
        storage
      );

      if (!signature) {
        throw new Error('Failed to create or load decryption signature. Please sign the message in your wallet.');
      }

      console.log('Decryption signature loaded/created successfully');

      // Prepare all handles for batch decryption
      // Contract returns bytes32 as hex strings, ensure they're properly formatted
      const handles = [
        encryptedCounts[0], // candidate1Votes
        encryptedCounts[1], // candidate2Votes
        encryptedCounts[2], // candidate3Votes
        encryptedCounts[3], // candidate4Votes
        encryptedCounts[4], // totalVotes
      ]
        .map(handle => {
          // Ensure handle is a hex string
          if (!handle) return null;
          if (typeof handle === 'string') {
            return handle.startsWith('0x') ? handle : `0x${handle}`;
          }
          return null;
        })
        .filter((handle): handle is string => {
          return handle !== null && handle !== ethers.ZeroHash && handle !== '0x0000000000000000000000000000000000000000000000000000000000000000';
        });

      if (handles.length === 0) {
        toast.info('No encrypted data to decrypt yet. Vote counts are still zero.');
        setVoteCounts([0, 0, 0, 0, 0]);
        setLastUpdate(new Date());
        return;
      }

      console.log(`Decrypting ${handles.length} handles...`);
      console.log('Handles:', handles);

      // Decrypt all handles at once
      const decryptedResults = await instance.userDecrypt(
        handles.map(handle => ({ handle, contractAddress })),
        signature.privateKey,
        signature.publicKey,
        signature.signature,
        signature.contractAddresses,
        signature.userAddress,
        signature.startTimestamp.toString(),
        signature.durationDays.toString()
      );

      console.log('Decryption completed:', decryptedResults);

      // Extract values from decrypted results
      const counts: (number | null)[] = [];
      
      for (let i = 0; i < 4; i++) {
        const handle = encryptedCounts[i];
        // Normalize handle format for lookup
        const normalizedHandle = handle && typeof handle === 'string' 
          ? (handle.startsWith('0x') ? handle : `0x${handle}`)
          : null;
        
        if (normalizedHandle && normalizedHandle !== ethers.ZeroHash && decryptedResults[normalizedHandle] !== undefined) {
          const value = decryptedResults[normalizedHandle];
          const numValue = typeof value === 'bigint' ? Number(value) : typeof value === 'string' ? parseInt(value, 10) : Number(value) || 0;
          counts.push(numValue);
        } else {
          counts.push(0); // No votes yet
        }
      }

      // Decrypt total votes
      const totalHandle = encryptedCounts[4];
      const normalizedTotalHandle = totalHandle && typeof totalHandle === 'string'
        ? (totalHandle.startsWith('0x') ? totalHandle : `0x${totalHandle}`)
        : null;
      
      if (normalizedTotalHandle && normalizedTotalHandle !== ethers.ZeroHash && decryptedResults[normalizedTotalHandle] !== undefined) {
        const totalValue = decryptedResults[normalizedTotalHandle];
        const numTotalValue = typeof totalValue === 'bigint' ? Number(totalValue) : typeof totalValue === 'string' ? parseInt(totalValue, 10) : Number(totalValue) || 0;
        counts.push(numTotalValue);
      } else {
        counts.push(0); // No votes yet
      }

      setVoteCounts(counts);
      setLastUpdate(new Date());
      toast.success('Vote counts decrypted successfully!');
    } catch (err: any) {
      console.error('Decryption error:', err);
      const errorMessage = err?.message || 'Failed to decrypt vote counts';
      toast.error(errorMessage);
      
      // If it's a signature error, provide more helpful message
      if (errorMessage.includes('sign') || errorMessage.includes('user rejected')) {
        toast.info('Please sign the decryption request in your wallet to view results.');
      }
    } finally {
      setIsDecrypting(false);
    }
  };

  useEffect(() => {
    if (encryptedCounts && isInitialized && address) {
      // Auto-refresh every 10 seconds
      const interval = setInterval(() => {
        refetchCounts();
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [encryptedCounts, isInitialized, address, refetchCounts]);

  const totalVotes = voteCounts[4] ?? 0;

  return (
    <section className="py-24 px-6">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h3 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">Voting Results</h3>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Real-time encrypted vote counts
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchCounts();
                if (isInitialized && address) {
                  decryptCounts();
                }
              }}
              disabled={isDecrypting}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isDecrypting ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {lastUpdate && (
              <p className="text-sm text-muted-foreground">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        {!isConnected ? (
          <div className="text-center py-24">
            <Lock className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-2xl font-bold mb-2">Connect Your Wallet</h3>
            <p className="text-muted-foreground">Please connect your wallet to view results</p>
          </div>
        ) : !isInitialized ? (
          <div className="text-center py-24">
            <Loader2 className="w-16 h-16 mx-auto mb-4 text-primary animate-spin" />
            <h3 className="text-2xl font-bold mb-2">Initializing Encryption</h3>
            <p className="text-muted-foreground">Please wait...</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {candidates.map((candidate, index) => {
              const count = voteCounts[index];
              const percentage = totalVotes > 0 && count !== null ? ((count / totalVotes) * 100).toFixed(1) : '0.0';

              return (
                <Card key={candidate.id} className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Vote className="w-8 h-8 text-primary" />
                      <h4 className="text-xl font-semibold">{candidate.name}</h4>
                    </div>
                    {count !== null ? (
                      <Unlock className="w-5 h-5 text-success" />
                    ) : (
                      <Lock className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="mb-2">
                    {count !== null ? (
                      <>
                        <p className="text-3xl font-bold mb-1">{count}</p>
                        <p className="text-sm text-muted-foreground">{percentage}% of total</p>
                      </>
                    ) : (
                      <p className="text-2xl font-bold">[Encrypted]</p>
                    )}
                  </div>
                  {totalVotes > 0 && count !== null && (
                    <div className="mt-4 w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {isConnected && isInitialized && (
          <Card className="p-6 text-center">
            <h4 className="text-xl font-semibold mb-2">Total Votes</h4>
            {voteCounts[4] !== null ? (
              <p className="text-4xl font-bold">{voteCounts[4]}</p>
            ) : (
              <p className="text-2xl font-bold text-muted-foreground">[Encrypted]</p>
            )}
            <Button
              onClick={decryptCounts}
              disabled={isDecrypting}
              className="mt-4"
              variant="outline"
            >
              {isDecrypting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Decrypting...
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4 mr-2" />
                  Decrypt Vote Counts
                </>
              )}
            </Button>
          </Card>
        )}
      </div>
    </section>
  );
};

export default ResultsDisplay;

