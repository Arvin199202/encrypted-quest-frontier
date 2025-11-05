import { ethers } from "hardhat";

async function main() {
  console.log("Verifying CommunityVoting deployment on Sepolia...");

  const contractAddress = "0x118D66433E901268f44c8C4cB4A6F14f0745A572";

  const CommunityVoting = await ethers.getContractAt("CommunityVoting", contractAddress);

  console.log("Contract address:", contractAddress);

  // Check if contract exists by calling a view function
  try {
    const numCandidates = await CommunityVoting.NUM_CANDIDATES();
    console.log("NUM_CANDIDATES:", numCandidates.toString());

    const candidate1 = await CommunityVoting.CANDIDATE_1();
    const candidate2 = await CommunityVoting.CANDIDATE_2();
    console.log("CANDIDATE_1:", candidate1.toString());
    console.log("CANDIDATE_2:", candidate2.toString());

    console.log("✅ Contract deployed successfully and is responding!");
  } catch (error) {
    console.error("❌ Contract verification failed:", error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
