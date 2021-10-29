import chai, { expect } from "chai";
import { solidity, MockProvider, deployContract } from "ethereum-waffle";
import { Contract, ethers } from "ethers";

import SeedClubMint from "../build/contracts/SeedClubMint.json";
import ERC20InitialSupply from "../build/contracts/ERC20InitialSupply.json";
import ERC20Mintable from "../build/contracts/ERC20Mintable.json";

chai.use(solidity);

describe("SeedClubMint", () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: "istanbul",
      mnemonic: "horn horn horn horn horn horn horn horn horn horn horn horn",
      gasLimit: 9999999
    }
  });

  const wallets = provider.getWallets();
  const [wallet0, wallet1] = wallets;

  let seedClubMint: Contract;

  const tokenName = "TestToken";
  const tokenSymbol = "TZT";
  const tokenDecimals = 18;

  before("deploy contract", async () => {
    seedClubMint = await deployContract(wallet0, SeedClubMint, []);
  });

  describe("creates tokens", () => {
    describe("mintable tokens", () => {
      it("creates one", async () => {
        const tx = await seedClubMint.createToken(
          tokenName,
          tokenSymbol,
          tokenDecimals,
          wallet0.address,
          ethers.utils.parseEther("10"),
          true
        );
        // get deployed token from events
        const receipt = await tx.wait();
        const tokenAddress = ethers.utils.defaultAbiCoder.decode(["address"], receipt.logs[3].data);
        // create token instance
        const tokenContract = new ethers.Contract(tokenAddress[0], ERC20Mintable.abi, wallet0);
        // mint and check balance change
        const oldBalance = await tokenContract.balanceOf(wallet1.address);
        const amountToMint = ethers.utils.parseEther("1");
        await tokenContract.mint(wallet1.address, amountToMint);
        const newBalance = await tokenContract.balanceOf(wallet1.address);
        expect(newBalance).to.eq(oldBalance.add(amountToMint));
      });

      it("it's metadata are correct", async () => {
        const tx = await seedClubMint.createToken(
          tokenName,
          tokenSymbol,
          tokenDecimals,
          wallet0.address,
          ethers.utils.parseEther("10"),
          true
        );
        // get deployed token from events
        const receipt = await tx.wait();
        const tokenAddress = ethers.utils.defaultAbiCoder.decode(["address"], receipt.logs[3].data);
        // create token instance
        const tokenContract = new ethers.Contract(tokenAddress[0], ERC20Mintable.abi, wallet0);
        // check it's name, symbol, decimals
        const name = await tokenContract.name();
        const symbol = await tokenContract.symbol();
        const decimals = await tokenContract.decimals();
        expect(name).to.eq(tokenName);
        expect(symbol).to.eq(tokenSymbol);
        expect(decimals).to.eq(tokenDecimals);
      });
    });

    describe("fixed supply tokens", () => {
      it("creates one", async () => {
        const tx = await seedClubMint.createToken(
          tokenName,
          tokenSymbol,
          tokenDecimals,
          wallet0.address,
          ethers.utils.parseEther("10"),
          false
        );
        // get deployed token from events
        const receipt = await tx.wait();
        const tokenAddress = ethers.utils.defaultAbiCoder.decode(["address"], receipt.logs[1].data);
        // create token instance
        const tokenContract = new ethers.Contract(tokenAddress[0], ERC20Mintable.abi, wallet0);
        // mint - expect to be reverted
        await expect(tokenContract.mint(wallet1.address, "1")).to.be.reverted;
      });

      it("it's metadata are correct", async () => {
        const tx = await seedClubMint.createToken(
          tokenName,
          tokenSymbol,
          tokenDecimals,
          wallet0.address,
          ethers.utils.parseEther("10"),
          false
        );
        // get deployed token from events
        const receipt = await tx.wait();
        const tokenAddress = ethers.utils.defaultAbiCoder.decode(["address"], receipt.logs[1].data);
        // create token instance
        const tokenContract = new ethers.Contract(tokenAddress[0], ERC20InitialSupply.abi, wallet0);
        // check it's name, symbol, decimals
        const name = await tokenContract.name();
        const symbol = await tokenContract.symbol();
        const decimals = await tokenContract.decimals();
        expect(name).to.eq(tokenName);
        expect(symbol).to.eq(tokenSymbol);
        expect(decimals).to.eq(tokenDecimals);
      });

      it("it's total supply equals the initial supply", async () => {
        const initialSupply = ethers.utils.parseEther("10");
        const tx = await seedClubMint.createToken(
          tokenName,
          tokenSymbol,
          tokenDecimals,
          wallet0.address,
          initialSupply,
          false
        );
        // get deployed token from events
        const receipt = await tx.wait();
        const tokenAddress = ethers.utils.defaultAbiCoder.decode(["address"], receipt.logs[1].data);
        // create token instance
        const tokenContract = new ethers.Contract(tokenAddress[0], ERC20InitialSupply.abi, wallet0);
        // check it's name, symbol, decimals
        // get it's totalSupply
        const totalSupply = await tokenContract.totalSupply();
        // expect it to equal initialSupply
        expect(totalSupply).to.eq(initialSupply);
      });
    });
  });
});
