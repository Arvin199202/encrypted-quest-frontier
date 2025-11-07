import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log(`Deploying CommunityVoting contract from: ${deployer}`);
  console.log(`Network: ${hre.network.name}`);

  const communityVoting = await deploy("CommunityVoting", {
    from: deployer,
    log: true,
  });

  console.log(`✅ CommunityVoting contract deployed successfully!`);
  console.log(`📍 Contract address: ${communityVoting.address}`);
  console.log(`🔗 Transaction hash: ${communityVoting.transactionHash}`);
};
export default func;
func.id = "deploy_community_voting"; // id required to prevent reexecution
func.tags = ["CommunityVoting"];

