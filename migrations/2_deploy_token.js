const SeedClubToken = artifacts.require("SeedClubToken");

module.exports = async (deployer) => {
  await deployer.deploy(SeedClubToken);
};
