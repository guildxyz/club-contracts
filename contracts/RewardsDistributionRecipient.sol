// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract RewardsDistributionRecipient is Ownable {
    address internal rewardsDistributionAddress;

    function notifyRewardAmount(uint256 reward) external virtual;

    modifier onlyRewardsDistribution() {
        require(msg.sender == rewardsDistributionAddress, "Caller != RewardsDistribution");
        _;
    }

    function rewardsDistribution() external view returns (address) {
        return rewardsDistributionAddress;
    }

    function setRewardsDistribution(address rewardsDistribution_) external onlyOwner {
        rewardsDistributionAddress = rewardsDistribution_;
    }
}
