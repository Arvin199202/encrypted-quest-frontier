import { ethers } from "ethers";

// Test Sepolia deployment
async function main() {
  console.log("Testing Sepolia deployment...");

  // Use Infura provider
  const provider = new ethers.JsonRpcProvider(`https://sepolia.infura.io/v3/b18fb7e6ca7045ac83c41157ab93f990`);
  const contractAddress = "0x118D66433E901268f44c8C4cB4A6F14f0745A572";

  console.log("Contract address:", contractAddress);

  // Simple ABI for testing
  const abi = [
    "function NUM_CANDIDATES() view returns (uint256)",
    "function CANDIDATE_1() view returns (uint8)",
    "function checkHasVoted(address) view returns (bool)"
  ];

  const contract = new ethers.Contract(contractAddress, abi, provider);

  try {
    console.log("Testing contract functions...");
    const numCandidates = await contract.NUM_CANDIDATES();
    console.log("NUM_CANDIDATES:", numCandidates.toString());

    const candidate1 = await contract.CANDIDATE_1();
    console.log("CANDIDATE_1:", candidate1.toString());

    // Test with a random address
    const testAddress = "0x742d35Cc6E7b6F1C3c4f5D8b9a2A1E3F7D6C5B4A3F2E1D0C9B8A7";
    const hasVoted = await contract.checkHasVoted(testAddress);
    console.log("Test address has voted:", hasVoted);

    console.log("✅ Sepolia contract is working correctly!");
  } catch (error) {
    console.error("❌ Contract test failed:", error);
  }
}

main().catch(console.error);
