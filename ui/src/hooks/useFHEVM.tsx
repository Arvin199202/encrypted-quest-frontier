import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { useAccount, useChainId, useConfig, useWalletClient } from 'wagmi';
import { JsonRpcProvider } from 'ethers';

// SDK CDN URL
const SDK_CDN_URL = 'https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.umd.cjs';

// Type definitions
interface FhevmRelayerSDKType {
  initSDK: (options?: any) => Promise<boolean>;
  createInstance: (config: any) => Promise<any>;
  SepoliaConfig: any;
  __initialized__?: boolean;
}

interface FhevmWindowType extends Window {
  relayerSDK?: FhevmRelayerSDKType;
}

interface FHEVMContextType {
  instance: any | null;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
  initializeInstance: () => Promise<void>;
}

const FHEVMContext = createContext<FHEVMContextType | undefined>(undefined);

// Helper function to get chain ID from provider
async function getChainId(providerOrUrl: string | any): Promise<number> {
  if (typeof providerOrUrl === 'string') {
    const provider = new JsonRpcProvider(providerOrUrl);
    return Number((await provider.getNetwork()).chainId);
  }
  const chainId = await providerOrUrl.request({ method: 'eth_chainId' });
  return Number.parseInt(chainId as string, 16);
}

// Get FHEVM relayer metadata from Hardhat node
async function getFHEVMRelayerMetadata(rpcUrl: string) {
  const rpc = new JsonRpcProvider(rpcUrl);
  try {
    const metadata = await rpc.send('fhevm_relayer_metadata', []);
    return metadata;
  } catch (e) {
    console.warn('Failed to get FHEVM relayer metadata:', e);
    return null;
  } finally {
    rpc.destroy();
  }
}

// Check if Hardhat node has FHEVM support
async function tryFetchFHEVMHardhatNodeRelayerMetadata(rpcUrl: string): Promise<{
  ACLAddress: `0x${string}`;
  InputVerifierAddress: `0x${string}`;
  KMSVerifierAddress: `0x${string}`;
} | undefined> {
  try {
    const provider = new JsonRpcProvider(rpcUrl);
    const version = await provider.send('web3_clientVersion', []);
    
    if (typeof version !== 'string' || !version.toLowerCase().includes('hardhat')) {
      return undefined;
    }

    const metadata = await getFHEVMRelayerMetadata(rpcUrl);
    if (!metadata || typeof metadata !== 'object') {
      return undefined;
    }

    if (
      !('ACLAddress' in metadata && typeof metadata.ACLAddress === 'string' && metadata.ACLAddress.startsWith('0x')) ||
      !('InputVerifierAddress' in metadata && typeof metadata.InputVerifierAddress === 'string' && metadata.InputVerifierAddress.startsWith('0x')) ||
      !('KMSVerifierAddress' in metadata && typeof metadata.KMSVerifierAddress === 'string' && metadata.KMSVerifierAddress.startsWith('0x'))
    ) {
      return undefined;
    }

    return {
      ACLAddress: metadata.ACLAddress as `0x${string}`,
      InputVerifierAddress: metadata.InputVerifierAddress as `0x${string}`,
      KMSVerifierAddress: metadata.KMSVerifierAddress as `0x${string}`,
    };
  } catch {
    return undefined;
  }
}

// Load SDK from CDN
async function loadSDK(): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('SDK can only be loaded in browser environment');
  }

  const win = window as FhevmWindowType;
  
  // Check if SDK is already loaded
  if (win.relayerSDK && win.relayerSDK.initSDK && win.relayerSDK.createInstance) {
    return;
  }

  // Check if script is already in DOM
  const existingScript = document.querySelector(`script[src="${SDK_CDN_URL}"]`);
  if (existingScript) {
    // Wait a bit for script to load
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!win.relayerSDK) {
      throw new Error('SDK script loaded but relayerSDK not available');
    }
    return;
  }

  // Load SDK script
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SDK_CDN_URL;
    script.type = 'text/javascript';
    script.async = true;

    script.onload = () => {
      if (!win.relayerSDK) {
        reject(new Error('SDK script loaded but relayerSDK not available on window object'));
        return;
      }
      resolve();
    };

    script.onerror = () => {
      reject(new Error(`Failed to load SDK from ${SDK_CDN_URL}`));
    };

    document.head.appendChild(script);
  });
}

export function FHEVMProvider({ children }: { children: ReactNode }) {
  const [instance, setInstance] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const wagmiConfig = useConfig();
  const { data: walletClient } = useWalletClient();

  const initializeInstance = useCallback(async () => {
    if (instance || isLoading) return;
    
    if (!isConnected || !address) {
      setError('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Check if this is a local/mock network (chainId 31337)
      const isLocalNetwork = chainId === 31337;
      const rpcUrl = isLocalNetwork ? 'http://127.0.0.1:8545' : undefined;

      if (isLocalNetwork && rpcUrl) {
        console.log('Detected local network, trying to use FHEVM mock mode...');
        
        // Try to get FHEVM metadata from Hardhat node
        const metadata = await tryFetchFHEVMHardhatNodeRelayerMetadata(rpcUrl);
        
        if (metadata) {
          console.log('FHEVM Hardhat node detected, using mock mode...');
          
          // Dynamically import mock utils to avoid including in production bundle
          const { MockFhevmInstance } = await import('@fhevm/mock-utils');
          
          const provider = new JsonRpcProvider(rpcUrl);
          const mockInstance = await MockFhevmInstance.create(provider, provider, {
            aclContractAddress: metadata.ACLAddress,
            chainId: chainId,
            gatewayChainId: 55815,
            inputVerifierContractAddress: metadata.InputVerifierAddress,
            kmsContractAddress: metadata.KMSVerifierAddress,
            verifyingContractAddressDecryption: '0x5ffdaAB0373E62E2ea2944776209aEf29E631A64',
            verifyingContractAddressInputVerification: '0x812b06e1CDCE800494b79fFE4f925A504a9A9810',
          });

          setInstance(mockInstance);
          setIsInitialized(true);
          console.log('FHEVM mock instance created successfully');
          return;
        } else {
          console.warn('Local network detected but FHEVM metadata not available. Falling back to relayer SDK...');
        }
      }

      // For Sepolia or if mock mode failed, use real relayer SDK
      console.log('Loading FHEVM SDK...');
      await loadSDK();

      const win = window as FhevmWindowType;
      if (!win.relayerSDK) {
        throw new Error('relayerSDK is not available on window object');
      }

      console.log('Initializing FHEVM SDK...');
      // Initialize SDK if not already initialized
      if (!win.relayerSDK.__initialized__) {
        const initResult = await win.relayerSDK.initSDK();
        if (!initResult) {
          throw new Error('Failed to initialize FHEVM SDK');
        }
        win.relayerSDK.__initialized__ = initResult;
      }

      console.log('Creating FHEVM instance...');
      // Use SepoliaConfig for Sepolia
      const config = chainId === 11155111
        ? {
            ...win.relayerSDK.SepoliaConfig,
            network: walletClient, // Use walletClient for Sepolia network
          }
        : {
            ...win.relayerSDK.SepoliaConfig,
            network: rpcUrl || 'http://127.0.0.1:8545',
          };

      const fhevmInstance = await win.relayerSDK.createInstance(config);
      setInstance(fhevmInstance);
      setIsInitialized(true);
      console.log('FHEVM instance initialized successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize FHEVM';
      setError(errorMessage);
      console.error('Failed to initialize FHEVM:', err);
    } finally {
      setIsLoading(false);
    }
  }, [instance, isLoading, isConnected, address, chainId, wagmiConfig, walletClient]);

  useEffect(() => {
    if (isConnected && !instance && !isLoading) {
      initializeInstance();
    }
    if (!isConnected && instance) {
      setInstance(null);
      setIsInitialized(false);
      setError(null);
    }
  }, [isConnected, address, chainId, instance, isLoading, initializeInstance]);

  const value: FHEVMContextType = {
    instance,
    isLoading,
    error,
    isInitialized,
    initializeInstance,
  };

  return <FHEVMContext.Provider value={value}>{children}</FHEVMContext.Provider>;
}

export function useFHEVM() {
  const context = useContext(FHEVMContext);
  if (context === undefined) {
    throw new Error('useFHEVM must be used within FHEVMProvider');
  }
  return context;
}

