import chai, { expect } from "chai";
import { solidity, MockProvider, deployContract } from "ethereum-waffle";
import { Contract, BigNumber, constants } from "ethers";
import BalanceTree from "../scripts/lib/balance-tree";

import Vesting from "../build/contracts/MerkleVesting.json";
import ERC20MintableBurnable from "../build/contracts/ERC20MintableBurnable.json";

chai.use(solidity);

const randomVestingPeriod = 43200;
const randomCliff = 120;
const randomRoot0 = "0xf7f77ea15719ea30bd2a584962ab273b1116f0e70fe80bbb0b30557d0addb7f3";
const randomRoot1 = "0xcb676dae3fc411069ab10b651ba8fb3658ed4bd41d7dc5add6d7f120e51eb7f7";

async function blockTimestamp(provider: MockProvider): Promise<BigNumber> {
  const block = await provider.getBlock("latest");
  return BigNumber.from(block.timestamp);
}

async function increaseTime(provider: MockProvider, delta: number): Promise<void> {
  await provider.send("evm_increaseTime", [delta]);
  await provider.send("evm_mine", []);
}

async function setBalance(token: any, to: string, amount: BigNumber) {
  const old: BigNumber = await token.balanceOf(to);
  if (old.lt(amount)) await token.mint(to, amount.sub(old));
  else if (old.gt(amount)) await token.burn(to, old.sub(amount));
}

async function getClaimableAmount(
  provider: MockProvider,
  vesting: Contract,
  cohortId: string,
  account: string,
  fullAmount: BigNumber
) {
  const cohort = await vesting.getCohort(cohortId);
  const claimedSoFar = await vesting.getClaimed(cohortId, account);
  const vestingEnd = cohort.vestingEnd;
  const vestingStart = vestingEnd.sub(cohort.vestingPeriod);
  const cliff = vestingStart.add(cohort.cliffPeriod);
  const timestamp = await blockTimestamp(provider);
  if (timestamp.lt(cliff)) process.exit(1);
  else if (timestamp.lt(vestingEnd))
    return fullAmount.mul(timestamp.sub(vestingStart)).div(cohort.vestingPeriod).sub(claimedSoFar);
  else return fullAmount.sub(claimedSoFar);
}

describe("MerkleVesting", () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: "istanbul",
      mnemonic: "horn horn horn horn horn horn horn horn horn horn horn horn",
      gasLimit: 9999999
    }
  });

  const wallets = provider.getWallets();
  const [wallet0, wallet1] = wallets;

  const distributionDuration = 86400;

  let token: Contract;
  beforeEach("deploy token", async () => {
    token = await deployContract(wallet0, ERC20MintableBurnable, ["OwoToken", "OWO", 18, wallet0.address, 0]);
  });

  describe("#token", () => {
    it("returns the token address", async () => {
      const vesting = await deployContract(wallet0, Vesting, [token.address]);
      expect(await vesting.token()).to.eq(token.address);
    });
  });

  describe("#addCohort && #getCohort", () => {
    it("fails if not called by owner", async () => {
      const vesting = await deployContract(wallet0, Vesting, [token.address]);
      const vestingFromAnotherAccount = vesting.connect(wallet1);
      await expect(
        vestingFromAnotherAccount.addCohort(randomRoot0, distributionDuration, randomVestingPeriod, randomCliff)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("fails if called with invalid parameters", async () => {
      const vesting = await deployContract(wallet0, Vesting, [token.address]);
      await expect(vesting.addCohort(constants.HashZero, distributionDuration, randomVestingPeriod, randomCliff)).to.be
        .reverted;
      await expect(vesting.addCohort(randomRoot0, 0, randomVestingPeriod, randomCliff)).to.be.reverted;
      await expect(vesting.addCohort(randomRoot0, distributionDuration, 0, randomCliff)).to.be.reverted;
    });

    it("sets the cohort data correctly", async () => {
      const vesting = await deployContract(wallet0, Vesting, [token.address]);
      await vesting.addCohort(randomRoot0, distributionDuration, randomVestingPeriod, randomCliff);
      const cohort = await vesting.getCohort(randomRoot0);
      const timestamp = await blockTimestamp(provider);
      expect(await cohort.merkleRoot).to.eq(randomRoot0);
      expect(await cohort.distributionEnd).to.eq(timestamp.add(distributionDuration));
      expect(await cohort.vestingEnd).to.eq(timestamp.add(randomVestingPeriod));
      expect(await cohort.vestingPeriod).to.eq(randomVestingPeriod);
      expect(await cohort.cliffPeriod).to.eq(randomCliff);
    });

    it("emits CohortAdded event", async () => {
      const vesting = await deployContract(wallet0, Vesting, [token.address]);
      await expect(vesting.addCohort(randomRoot0, distributionDuration, randomVestingPeriod, randomCliff))
        .to.emit(vesting, "CohortAdded")
        .withArgs(randomRoot0);
      await expect(vesting.addCohort(randomRoot1, distributionDuration, randomVestingPeriod, randomCliff))
        .to.emit(vesting, "CohortAdded")
        .withArgs(randomRoot1);
    });
  });

  describe("#claim", () => {
    it("fails for invalid cohortId", async () => {
      const vesting = await deployContract(wallet0, Vesting, [token.address]);
      await vesting.addCohort(randomRoot0, distributionDuration, randomVestingPeriod, randomCliff);
      // error CohortDoesNotExist();
      await expect(vesting.claim(constants.HashZero, 0, wallet0.address, 10, [])).to.be.reverted;
      await expect(vesting.claim(randomRoot1, 0, wallet0.address, 10, [])).to.be.reverted;
    });

    it("fails if distribution ended", async () => {
      const vesting = await deployContract(wallet0, Vesting, [token.address]);
      await vesting.addCohort(randomRoot0, distributionDuration, randomVestingPeriod, randomCliff);
      await increaseTime(provider, distributionDuration + 1);
      // error DistributionEnded(uint256 current, uint256 end);
      await expect(vesting.claim(randomRoot0, 0, wallet0.address, 10, [])).to.be.reverted;
    });

    describe("two account tree", () => {
      let vesting: Contract;
      let tree: BalanceTree;
      let root: string;
      beforeEach("deploy", async () => {
        tree = new BalanceTree([
          { account: wallet0.address, amount: BigNumber.from(100) },
          { account: wallet1.address, amount: BigNumber.from(101) }
        ]);
        root = tree.getHexRoot();
        vesting = await deployContract(wallet0, Vesting, [token.address]);
        await vesting.addCohort(root, distributionDuration, randomVestingPeriod, randomCliff);
        await setBalance(token, vesting.address, BigNumber.from(201));
      });

      it("fails for empty proof", async () => {
        // error InvalidProof();
        await expect(vesting.claim(root, 0, wallet0.address, 10, [])).to.be.reverted;
      });

      it("fails for invalid index", async () => {
        // error InvalidProof();
        await expect(vesting.claim(root, 0, wallet0.address, 10, [])).to.be.reverted;
      });

      it("fails when trying to claim before the cliff", async () => {
        const proof0 = tree.getProof(0, wallet0.address, BigNumber.from(100));
        // error CliffNotReached(uint256 cliff, uint256 timestamp);
        await expect(vesting.claim(root, 0, wallet0.address, 100, proof0)).to.be.reverted;
      });

      it("successful claim", async () => {
        await increaseTime(provider, randomCliff + 1);
        const proof0 = tree.getProof(0, wallet0.address, BigNumber.from(100));
        const claimableAmount0 = await getClaimableAmount(
          provider,
          vesting,
          root,
          wallet0.address,
          BigNumber.from(100)
        );
        await expect(vesting.claim(root, 0, wallet0.address, 100, proof0))
          .to.emit(vesting, "Claimed")
          .withArgs(root, wallet0.address, claimableAmount0);
        const proof1 = tree.getProof(1, wallet1.address, BigNumber.from(101));
        const claimableAmount1 = await getClaimableAmount(
          provider,
          vesting,
          root,
          wallet1.address,
          BigNumber.from(101)
        );
        await expect(vesting.claim(root, 1, wallet1.address, 101, proof1))
          .to.emit(vesting, "Claimed")
          .withArgs(root, wallet1.address, claimableAmount1);
      });

      it("transfers the token", async () => {
        await increaseTime(provider, randomCliff + 1);
        const proof0 = tree.getProof(0, wallet0.address, BigNumber.from(100));
        expect(await token.balanceOf(wallet0.address)).to.eq(0);
        await increaseTime(provider, randomVestingPeriod + 1);
        await vesting.claim(root, 0, wallet0.address, 100, proof0);
        expect(await token.balanceOf(wallet0.address)).to.eq(100);
      });

      it("must have enough to transfer", async () => {
        await increaseTime(provider, randomCliff + 1);
        const proof0 = tree.getProof(0, wallet0.address, BigNumber.from(100));
        await setBalance(token, vesting.address, BigNumber.from(1));
        await increaseTime(provider, randomVestingPeriod);
        await expect(vesting.claim(root, 0, wallet0.address, 100, proof0)).to.be.revertedWith(
          "ERC20: transfer amount exceeds balance"
        );
      });

      it("sets #getClaimed", async () => {
        await increaseTime(provider, randomCliff + 1);
        await vesting.addCohort(randomRoot0, distributionDuration, randomVestingPeriod, randomCliff); // second cohort
        const proof0 = tree.getProof(0, wallet0.address, BigNumber.from(100));
        expect(await vesting.getClaimed(root, wallet0.address)).to.eq(0);
        expect(await vesting.getClaimed(randomRoot0, wallet0.address)).to.eq(0);
        await increaseTime(provider, randomVestingPeriod + 1);
        await vesting.claim(root, 0, wallet0.address, 100, proof0);
        expect(await vesting.getClaimed(root, wallet0.address)).to.eq(100);
        expect(await vesting.getClaimed(randomRoot0, wallet0.address)).to.eq(0);
      });

      it("does allow subsequent claims", async () => {
        await increaseTime(provider, randomCliff + 1);
        const proof0 = tree.getProof(0, wallet0.address, BigNumber.from(100));
        const res0 = await vesting.claim(root, 0, wallet0.address, 100, proof0);
        const res1 = await vesting.claim(root, 0, wallet0.address, 100, proof0);
        expect((await res0.wait()).status).to.eq(1);
        expect((await res1.wait()).status).to.eq(1);
      });

      it("cannot claim for address other than proof", async () => {
        await increaseTime(provider, randomCliff + 1);
        const proof0 = tree.getProof(0, wallet0.address, BigNumber.from(100));
        // error InvalidProof();
        await expect(vesting.claim(root, 1, wallet1.address, 101, proof0)).to.be.reverted;
      });

      it("cannot claim more with one proof", async () => {
        await increaseTime(provider, randomCliff + 1);
        const proof0 = tree.getProof(0, wallet0.address, BigNumber.from(100));
        // error InvalidProof();
        await expect(vesting.claim(root, 0, wallet0.address, 101, proof0)).to.be.reverted;
      });
    });

    describe("larger tree", () => {
      let vesting: Contract;
      let tree: BalanceTree;
      let root: string;

      beforeEach("deploy", async () => {
        tree = new BalanceTree(
          wallets.map((wallet, ix) => {
            return { account: wallet.address, amount: BigNumber.from(ix + 1) };
          })
        );
        root = tree.getHexRoot();
        vesting = await deployContract(wallet0, Vesting, [token.address]);
        await vesting.addCohort(root, distributionDuration, randomVestingPeriod, 0);
        await setBalance(token, vesting.address, BigNumber.from(201));
      });

      it("claim index 4", async () => {
        const proof = tree.getProof(4, wallets[4].address, BigNumber.from(5));
        const claimableAmount = await getClaimableAmount(
          provider,
          vesting,
          root,
          wallets[4].address,
          BigNumber.from(5)
        );
        await expect(vesting.claim(root, 4, wallets[4].address, 5, proof))
          .to.emit(vesting, "Claimed")
          .withArgs(root, wallets[4].address, claimableAmount);
      });

      it("claim index 9", async () => {
        const proof = tree.getProof(9, wallets[9].address, BigNumber.from(10));
        const claimableAmount = await getClaimableAmount(
          provider,
          vesting,
          root,
          wallets[9].address,
          BigNumber.from(10)
        );
        await expect(vesting.claim(root, 9, wallets[9].address, 10, proof))
          .to.emit(vesting, "Claimed")
          .withArgs(root, wallets[9].address, claimableAmount);
      });
    });

    describe("realistic size tree", () => {
      let tree: BalanceTree;
      let root: string;
      const NUM_LEAVES = 100_000;
      const NUM_SAMPLES = 25;
      const elements: { account: string; amount: BigNumber }[] = [];
      for (let i = 0; i < NUM_LEAVES; i++) {
        const node = { account: wallet0.address, amount: BigNumber.from(100) };
        elements.push(node);
      }
      tree = new BalanceTree(elements);
      root = tree.getHexRoot();

      it("proof verification works", () => {
        const convRoot = Buffer.from(root.slice(2), "hex");
        for (let i = 0; i < NUM_LEAVES; i += NUM_LEAVES / NUM_SAMPLES) {
          const proof = tree
            .getProof(i, wallet0.address, BigNumber.from(100))
            .map((el) => Buffer.from(el.slice(2), "hex"));
          const validProof = BalanceTree.verifyProof(i, wallet0.address, BigNumber.from(100), proof, convRoot);
          expect(validProof).to.be.true;
        }
      });

      it("subsequent claims in random distribution", async () => {
        const vesting = await deployContract(wallet0, Vesting, [token.address]);
        await vesting.addCohort(root, distributionDuration, randomVestingPeriod, 0);
        await setBalance(token, vesting.address, constants.MaxUint256);
        for (let i = 0; i < 25; i += Math.floor(Math.random() * (NUM_LEAVES / NUM_SAMPLES))) {
          const proof = tree.getProof(i, wallet0.address, BigNumber.from(100));
          const res0 = await vesting.claim(root, i, wallet0.address, 100, proof);
          const res1 = await vesting.claim(root, i, wallet0.address, 100, proof);
          expect((await res0.wait()).status).to.eq(1);
          expect((await res1.wait()).status).to.eq(1);
        }
      });
    });
  });

  describe("#withdraw", async () => {
    it("fails if not called by owner", async () => {
      const vesting = await deployContract(wallet0, Vesting, [token.address]);
      await vesting.addCohort(randomRoot0, distributionDuration, randomVestingPeriod, randomCliff);
      const vestingFromAnotherAccount = vesting.connect(wallet1);
      await expect(vestingFromAnotherAccount.withdraw(wallet0.address)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("fails if distribution period has not ended yet", async () => {
      const vesting = await deployContract(wallet0, Vesting, [token.address]);
      await vesting.addCohort(randomRoot0, distributionDuration, randomVestingPeriod, randomCliff);
      // error DistributionOngoing(uint256 current, uint256 end);
      await expect(vesting.withdraw(wallet0.address)).to.be.reverted;
    });

    it("fails if there's nothing to withdraw", async () => {
      const vesting = await deployContract(wallet0, Vesting, [token.address]);
      await vesting.addCohort(randomRoot0, distributionDuration, randomVestingPeriod, randomCliff);
      await increaseTime(provider, distributionDuration + 1);
      const balance = await token.balanceOf(vesting.address);
      expect(balance).to.eq(BigNumber.from("0"));
      // error AlreadyWithdrawn();
      await expect(vesting.withdraw(wallet0.address)).to.be.reverted;
    });

    it("transfers tokens to the recipient", async () => {
      const vesting = await deployContract(wallet0, Vesting, [token.address]);
      await vesting.addCohort(randomRoot0, distributionDuration, randomVestingPeriod, randomCliff);
      await setBalance(token, vesting.address, BigNumber.from("101"));
      await increaseTime(provider, distributionDuration + 1);
      const oldBalance = await token.balanceOf(vesting.address);
      await vesting.withdraw(wallet0.address);
      const newBalance = await token.balanceOf(vesting.address);
      expect(oldBalance).to.eq(BigNumber.from("101"));
      expect(newBalance).to.eq(BigNumber.from("0"));
    });

    it("emits Withdrawn event", async () => {
      const vesting = await deployContract(wallet0, Vesting, [token.address]);
      await vesting.addCohort(randomRoot0, distributionDuration, randomVestingPeriod, randomCliff);
      await setBalance(token, vesting.address, BigNumber.from("101"));
      await increaseTime(provider, distributionDuration + 1);
      await expect(vesting.withdraw(wallet0.address))
        .to.emit(vesting, "Withdrawn")
        .withArgs(wallet0.address, BigNumber.from("101"));
    });
  });
});
