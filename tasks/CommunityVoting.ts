import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { FhevmType } from "@fhevm/hardhat-plugin";

task("voting:getCounts", "Get encrypted vote counts for all candidates")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { deployments, ethers, fhevm } = hre;
    const CommunityVotingDeployment = await deployments.get("CommunityVoting");
    const communityVotingContract = await ethers.getContractAt(
      "CommunityVoting",
      CommunityVotingDeployment.address
    );

    console.log("Getting vote counts...");
    const voteCounts = await communityVotingContract.getVoteCounts();

    if (fhevm.isMock) {
      const signers = await ethers.getSigners();
      const decrypted1 = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        voteCounts[0],
        CommunityVotingDeployment.address,
        signers[0],
      );
      const decrypted2 = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        voteCounts[1],
        CommunityVotingDeployment.address,
        signers[0],
      );
      const decrypted3 = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        voteCounts[2],
        CommunityVotingDeployment.address,
        signers[0],
      );
      const decrypted4 = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        voteCounts[3],
        CommunityVotingDeployment.address,
        signers[0],
      );
      const decryptedTotal = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        voteCounts[4],
        CommunityVotingDeployment.address,
        signers[0],
      );

      console.log("Decrypted Vote Counts:");
      console.log(`Candidate 1: ${decrypted1}`);
      console.log(`Candidate 2: ${decrypted2}`);
      console.log(`Candidate 3: ${decrypted3}`);
      console.log(`Candidate 4: ${decrypted4}`);
      console.log(`Total: ${decryptedTotal}`);
    } else {
      console.log("Vote counts (encrypted):");
      console.log(`Candidate 1: ${voteCounts[0]}`);
      console.log(`Candidate 2: ${voteCounts[1]}`);
      console.log(`Candidate 3: ${voteCounts[2]}`);
      console.log(`Candidate 4: ${voteCounts[3]}`);
      console.log(`Total: ${voteCounts[4]}`);
      console.log("Note: Decryption requires user authentication on testnet");
    }
  });

task("voting:checkHasVoted", "Check if an address has voted")
  .addParam("address", "The address to check")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { deployments, ethers } = hre;
    const CommunityVotingDeployment = await deployments.get("CommunityVoting");
    const communityVotingContract = await ethers.getContractAt(
      "CommunityVoting",
      CommunityVotingDeployment.address
    );

    const hasVoted = await communityVotingContract.checkHasVoted(taskArgs.address);
    console.log(`Address ${taskArgs.address} has ${hasVoted ? "" : "not "}voted`);
  });

