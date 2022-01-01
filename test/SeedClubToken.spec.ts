import chai, { expect } from "chai";
import { solidity, MockProvider, deployContract } from "ethereum-waffle";
import { BigNumber, Contract, ethers } from "ethers";

import SeedClubToken from "../build/contracts/SeedClubToken.json";

chai.use(solidity);

describe("Seed Club Token", () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: "istanbul",
      mnemonic: "horn horn horn horn horn horn horn horn horn horn horn horn",
      gasLimit: 9999999
    }
  });

  const wallets = provider.getWallets();
  const [wallet0, wallet1] = wallets;

  let token: Contract;

  const tokenName = "Seed Club";
  const tokenSymbol = "CLUB";
  const tokenDecimals = 18;
  const initialSupply = ethers.utils.parseEther("10000000");

  beforeEach("deploy contract", async () => {
    token = await deployContract(wallet0, SeedClubToken, []);
  });

  describe("initial values", () => {
    it("should have the correct metadata", async () => {
      expect(await token.name()).to.eq(tokenName);
      expect(await token.symbol()).to.eq(tokenSymbol);
      expect(await token.decimals()).to.eq(tokenDecimals);
    });

    it("should have 10M initial supply", async () => {
      expect(await token.balanceOf(wallet0.address)).to.eq(initialSupply);
    });
  });

  describe("special features", () => {
    it("should really be mintable", async () => {
      const oldBalance = await token.balanceOf(wallet1.address);
      const amountToMint = ethers.utils.parseEther("1");
      await token.mint(wallet1.address, amountToMint);
      const newBalance = await token.balanceOf(wallet1.address);
      expect(newBalance).to.eq(oldBalance.add(amountToMint));
    });

    it("should be possible to batch operations via multicall", async () => {
      const accounts = [
        "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        "0x80FD5876d1092D3795194BCcd589C331E43b10B7",
        "0xfF9bAaC24c68d810af1F98012d3D25B0Ea83902e",
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "0x5EEbfb0335170Cf956B2a1fa824D800c83bCe556",
        "0xE2Bb13b9E3727187E08791641d203ad8057150A0",
        "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6"
      ];
      for (let i = 0; i < accounts.length; i++) {
        expect(await token.balanceOf(accounts[i])).to.eq(BigNumber.from(0));
      }
      const transfers = [];
      for (let i = 0; i < accounts.length; i++) {
        transfers[i] = token.interface.encodeFunctionData("transfer", [accounts[i], i + 1]);
      }
      await token.multicall(transfers);
      for (let i = 0; i < accounts.length; i++) {
        expect(await token.balanceOf(accounts[i])).to.eq(BigNumber.from(i + 1));
      }
    });
  });
});
