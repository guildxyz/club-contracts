// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

// Allows anyone to claim a token if they exist in a merkle root.
interface IMerkleDistributor {
    // Returns the address of the token distributed by this contract.
    function token() external view returns (address);

    // Returns the merkle root of the merkle tree containing account balances available to claim.
    function merkleRoot() external view returns (bytes32);

    // Returns the unix timestamp that marks the end of the token distribution.
    function distributionEnd() external view returns (uint256);

    // Returns true if the index has been marked claimed.
    function isClaimed(uint256 index) external view returns (bool);

    // Claim the given amount of the token to the given address. Reverts if the inputs are invalid.
    function claim(
        uint256 index,
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external;

    // Allows the owner to reclaim the tokens after the distribution has ended.
    function withdraw(address recipient) external;

    // This event is triggered whenever a call to #claim succeeds.
    event Claimed(uint256 index, address account, uint256 amount);

    // This event is triggered whenever a call to #withdraw succeeds.
    event Withdrawn(address account, uint256 amount);
}
