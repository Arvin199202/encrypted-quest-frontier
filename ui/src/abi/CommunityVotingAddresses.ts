// Contract addresses - will be updated after deployment
export const COMMUNITY_VOTING_ADDRESSES = {
  localhost: '0x5FbDB2315678afecb367f032d93F642f64180aa3', // Placeholder
  sepolia: '0x118D66433E901268f44c8C4cB4A6F14f0745A572', // Deployed contract
} as const;

// Get contract address based on current chain
export function getContractAddress(chainId: number): string {
  if (chainId === 31337) {
    return COMMUNITY_VOTING_ADDRESSES.localhost;
  } else if (chainId === 11155111) {
    return COMMUNITY_VOTING_ADDRESSES.sepolia || '';
  }
  return COMMUNITY_VOTING_ADDRESSES.localhost;
}

