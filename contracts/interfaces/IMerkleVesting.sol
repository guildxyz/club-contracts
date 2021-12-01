// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

// Allows anyone to claim a token if they exist in a merkle root.
interface IMerkleVesting {
    // The struct holding a specific cohort's data and the individual claim statuses
    struct Cohort {
        // The struct holding a specific cohort's data
        CohortData data;
        // Stores the amount of claimed funds per address.
        mapping(address => uint256) claims;
    }

    // The struct holding a specific cohort's data
    struct CohortData {
        // The merkle root of the merkle tree containing account balances available to claim.
        bytes32 merkleRoot;
        // The unix timestamp that marks the end of the token distribution.
        uint64 distributionEnd;
        // The unix timestamp that marks the end of the vesting period.
        uint64 vestingEnd;
        // The length of the vesting period in seconds.
        uint64 vestingPeriod;
        // The length of the cliff period in seconds.
        uint64 cliffPeriod;
    }

    // Returns the address of the token distributed by this contract.
    function token() external view returns (address);

    // Returns the parameters of a specific cohort.
    function getCohort(bytes32 cohortId) external view returns (CohortData memory);

    // Returns the amount of funds an account has claimed.
    function getClaimed(bytes32 cohortId, address account) external view returns (uint256);

    // Allows the owner to add a new cohort.
    function addCohort(
        bytes32 merkleRoot,
        uint256 distributionDuration,
        uint64 vestingPeriod,
        uint64 cliffPeriod
    ) external;

    // Claim the given amount of the token to the given address. Reverts if the inputs are invalid.
    function claim(
        bytes32 cohortId,
        uint256 index,
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external;

    // Allows the owner to reclaim the tokens after the distribution has ended.
    function withdraw(address recipient) external;

    // This event is triggered whenever a call to #addCohort succeeds.
    event CohortAdded(bytes32 cohortId);

    // This event is triggered whenever a call to #claim succeeds.
    event Claimed(bytes32 cohortId, address account, uint256 amount);

    // This event is triggered whenever a call to #withdraw succeeds.
    event Withdrawn(address account, uint256 amount);

    // Error thrown when there's nothing to withdraw.
    error AlreadyWithdrawn();

    // Error thrown when a cohort with the provided id does not exist.
    error CohortDoesNotExist();

    // Error thrown when the distribution period ended.
    error DistributionEnded(uint256 current, uint256 end);

    // Error thrown when the cliff period is not over yet.
    error CliffNotReached(uint256 cliff, uint256 timestamp);

    // Error thrown when the distribution period did not end yet.
    error DistributionOngoing(uint256 current, uint256 end);

    // Error thrown when the Merkle proof is invalid.
    error InvalidProof();

    // Error thrown when a transfer failed.
    error TransferFailed(address token, address from, address to);

    // Error thrown when a function receives invalid parameters.
    error InvalidParameters();

    // Error thrown when a cohort with an already existing merkle tree is attempted to be added.
    error MerkleRootCollision();
}
