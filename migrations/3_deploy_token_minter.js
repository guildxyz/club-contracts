const SeedClubMint = artifacts.require("SeedClubMint");

module.exports = async (deployer) => {
  await deployer.deploy(SeedClubMint);
};
