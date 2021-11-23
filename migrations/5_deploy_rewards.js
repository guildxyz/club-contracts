const uniPositionManager = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"; // Uniswap's contract, same address on all chains
const rewardsDistributionAddress = "0x..."; // the address that will have access to the unclaimed rewards of the contract
const rewardsToken = "0x..."; // the address of the token to be given as a reward
const liquidityToken0 = "0x..."; // the address of one of the tokens from the Uniswap pool
const liquidityToken1 = "0x..."; // the address of the other token from the Uniswap pool
const rewardsDurationSecs = 0; // the duration of the liquidity farming in seconds

const StakingRewards = artifacts.require("StakingRewards");

module.exports = (deployer) => {
  deployer.deploy(
    StakingRewards,
    uniPositionManager,
    rewardsDistributionAddress,
    rewardsToken,
    liquidityToken0,
    liquidityToken1,
    rewardsDurationSecs
  );
};
