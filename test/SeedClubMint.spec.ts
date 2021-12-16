import chai, { expect } from "chai";
import { solidity, MockProvider, deployContract } from "ethereum-waffle";
import { Contract, ethers } from "ethers";

import SeedClubMint from "../build/contracts/SeedClubMint.json";
import ERC20MintableAccessControlled from "../build/contracts/ERC20MintableAccessControlled.json";
import ERC20MintableOwned from "../build/contracts/ERC20MintableOwned.json";
import ERC20InitialSupply from "../build/contracts/ERC20InitialSupply.json";

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
  const initialSupply = ethers.utils.parseEther("10");

  before("deploy contract", async () => {
    seedClubMint = await deployContract(wallet0, SeedClubMint, []);
  });

  describe("creates tokens", () => {
    let tokenAddress: string;

    describe("mintable tokens", () => {
      beforeEach("create a token", async () => {
        const tx = await seedClubMint.createToken(
          tokenName,
          tokenSymbol,
          tokenDecimals,
          initialSupply,
          wallet0.address,
          true,
          true
        );
        // get deployed token from events
        const receipt = await tx.wait();
        tokenAddress = ethers.utils.defaultAbiCoder.decode(["address"], receipt.logs[3].data)[0];
      });

      it("should really be mintable", async () => {
        const tokenContract = new ethers.Contract(tokenAddress, ERC20MintableAccessControlled.abi, wallet0);
        const oldBalance = await tokenContract.balanceOf(wallet1.address);
        const amountToMint = ethers.utils.parseEther("1");
        await tokenContract.mint(wallet1.address, amountToMint);
        const newBalance = await tokenContract.balanceOf(wallet1.address);
        expect(newBalance).to.eq(oldBalance.add(amountToMint));
      });

      it("should have correct metadata", async () => {
        const tokenContract = new ethers.Contract(tokenAddress, ERC20MintableAccessControlled.abi, wallet0);
        const name = await tokenContract.name();
        const symbol = await tokenContract.symbol();
        const decimals = await tokenContract.decimals();
        expect(name).to.eq(tokenName);
        expect(symbol).to.eq(tokenSymbol);
        expect(decimals).to.eq(tokenDecimals);
      });

      it("should be set if it's owned by one or multiple addresses", async () => {
        // by default we test with an accesscontrolled setup - let's verify this
        const acContractAsAC = new ethers.Contract(tokenAddress, ERC20MintableAccessControlled.abi, wallet0);
        const acContractAsOwn = new ethers.Contract(tokenAddress, ERC20MintableOwned.abi, wallet0);
        expect(await acContractAsAC.DEFAULT_ADMIN_ROLE()).to.eq(ethers.constants.HashZero);
        expect(await acContractAsAC.MINTER_ROLE()).to.eq(ethers.utils.solidityKeccak256(["string"], ["MINTER_ROLE"]));
        await expect(acContractAsOwn.owner()).to.be.reverted;

        // create an ownable one and let's check it
        const tx = await seedClubMint.createToken(
          tokenName,
          tokenSymbol,
          tokenDecimals,
          initialSupply,
          wallet0.address,
          true,
          false
        );
        // get deployed token from events
        const receipt = await tx.wait();
        const tokenAddress1 = ethers.utils.defaultAbiCoder.decode(["address"], receipt.logs[3].data)[0];
        // create token instance
        const ownContractAsAc = new ethers.Contract(tokenAddress1, ERC20MintableAccessControlled.abi, wallet0);
        const ownContractAsOwn = new ethers.Contract(tokenAddress1, ERC20MintableOwned.abi, wallet0);
        await expect(ownContractAsAc.DEFAULT_ADMIN_ROLE()).to.be.reverted;
        expect(await ownContractAsOwn.owner()).to.eq(wallet0.address);
      });
    });

    describe("fixed supply tokens", () => {
      beforeEach("create token", async () => {
        const tx = await seedClubMint.createToken(
          tokenName,
          tokenSymbol,
          tokenDecimals,
          initialSupply,
          wallet0.address,
          false,
          true
        );
        // get deployed token from events
        const receipt = await tx.wait();
        tokenAddress = ethers.utils.defaultAbiCoder.decode(["address"], receipt.logs[1].data)[0];
      });

      it("should fail to be minted", async () => {
        const tokenContract = new ethers.Contract(tokenAddress, ERC20MintableAccessControlled.abi, wallet0);
        await expect(tokenContract.mint(wallet1.address, "1")).to.be.reverted;
      });

      it("should have correct metadata", async () => {
        const tokenContract = new ethers.Contract(tokenAddress, ERC20MintableAccessControlled.abi, wallet0);
        const name = await tokenContract.name();
        const symbol = await tokenContract.symbol();
        const decimals = await tokenContract.decimals();
        expect(name).to.eq(tokenName);
        expect(symbol).to.eq(tokenSymbol);
        expect(decimals).to.eq(tokenDecimals);
      });

      it("should have a total supply equal to the initial supply", async () => {
        const tokenContract = new ethers.Contract(tokenAddress, ERC20MintableAccessControlled.abi, wallet0);
        const totalSupply = await tokenContract.totalSupply();
        expect(totalSupply).to.eq(initialSupply);
      });
    });
  });
});
