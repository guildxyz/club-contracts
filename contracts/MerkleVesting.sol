// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "./interfaces/IMerkleVesting.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/Multicall.sol";

contract MerkleVesting is IMerkleVesting, Multicall, Ownable {
    address public immutable token;
    bytes32 internal lastCohort; // the one which ends last, not added last

    mapping(bytes32 => Cohort) internal cohorts;

    constructor(address token_) {
        token = token_;
    }

    function getCohort(bytes32 cohortId) external view returns (CohortData memory) {
        return cohorts[cohortId].data;
    }

    function getClaimed(bytes32 cohortId, address account) public view returns (uint256) {
        return cohorts[cohortId].claims[account];
    }

    function addCohort(
        bytes32 merkleRoot,
        uint256 distributionDuration,
        uint64 vestingPeriod,
        uint64 cliffPeriod
    ) external onlyOwner {
        if (merkleRoot == bytes32(0) || distributionDuration == 0 || vestingPeriod == 0) revert InvalidParameters();
        uint256 distributionEnd = block.timestamp + distributionDuration;
        if (distributionEnd > cohorts[lastCohort].data.distributionEnd) lastCohort = merkleRoot;
        cohorts[merkleRoot].data.merkleRoot = merkleRoot;
        cohorts[merkleRoot].data.distributionEnd = uint64(distributionEnd);
        cohorts[merkleRoot].data.vestingEnd = uint64(block.timestamp + vestingPeriod);
        cohorts[merkleRoot].data.vestingPeriod = vestingPeriod;
        cohorts[merkleRoot].data.cliffPeriod = cliffPeriod;
        emit CohortAdded(merkleRoot);
    }

    function claim(
        bytes32 cohortId,
        uint256 index,
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external {
        if (cohorts[cohortId].data.merkleRoot == bytes32(0)) revert CohortDoesNotExist();
        Cohort storage cohort = cohorts[cohortId];
        uint256 distributionEndLocal = cohort.data.distributionEnd;
        if (block.timestamp > distributionEndLocal) revert DistributionEnded(block.timestamp, distributionEndLocal);

        // Verify the merkle proof.
        bytes32 node = keccak256(abi.encodePacked(index, account, amount));
        if (!MerkleProof.verify(merkleProof, cohort.data.merkleRoot, node)) revert InvalidProof();

        // Calculate the claimable amount.
        uint256 claimableAmount;
        uint256 claimedSoFar = cohort.claims[account];
        uint256 vestingEnd = cohort.data.vestingEnd;
        uint256 vestingStart = vestingEnd - cohort.data.vestingPeriod;
        uint256 cliff = vestingStart + cohort.data.cliffPeriod;
        if (block.timestamp < cliff) revert CliffNotReached(cliff, block.timestamp);
        else if (block.timestamp < vestingEnd)
            claimableAmount = (amount * (block.timestamp - vestingStart)) / cohort.data.vestingPeriod - claimedSoFar;
        else claimableAmount = amount - claimedSoFar;

        cohort.claims[account] = claimedSoFar + claimableAmount;

        // Send the token.
        if (!IERC20(token).transfer(account, claimableAmount)) revert TransferFailed(token, address(this), account);

        emit Claimed(cohortId, account, claimableAmount);
    }

    // Allows the owner to reclaim the tokens deposited in this contract.
    function withdraw(address recipient) external onlyOwner {
        uint256 distributionEndLocal = cohorts[lastCohort].data.distributionEnd;
        if (block.timestamp <= distributionEndLocal) revert DistributionOngoing(block.timestamp, distributionEndLocal);
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance == 0) revert AlreadyWithdrawn();
        if (!IERC20(token).transfer(recipient, balance)) revert TransferFailed(token, address(this), recipient);
        emit Withdrawn(recipient, balance);
    }
}
