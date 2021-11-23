const token = "0x..."; // the address of the token to be distributed

const MerkleVesting = artifacts.require("MerkleVesting");

module.exports = (deployer) => {
  deployer.deploy(MerkleVesting, token);
};
