// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "./interfaces/INonfungiblePositionManager.sol";
import "./interfaces/IStakingRewards.sol";
import "./RewardsDistributionRecipient.sol";

contract StakingRewards is IStakingRewards, RewardsDistributionRecipient, ERC721Holder, ReentrancyGuard, Pausable {
    /* ========== STATE VARIABLES ========== */

    address public immutable uniPositionManager; // 0xC36442b4a4522E871399CD717aBDD847Ab11FE88
    address public immutable rewardsToken;
    address public immutable liquidityToken0;
    address public immutable liquidityToken1;
    uint256 public periodFinish;
    uint256 public rewardRate;
    uint256 public rewardsDuration;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _uniPositionManager,
        address _rewardsDistribution,
        address _rewardsToken,
        address _liquidityToken0,
        address _liquidityToken1,
        uint256 _rewardsDuration
    ) {
        uniPositionManager = _uniPositionManager;
        rewardsToken = _rewardsToken;
        liquidityToken0 = _liquidityToken0;
        liquidityToken1 = _liquidityToken1;
        rewardsDistributionAddress = _rewardsDistribution;
        rewardsDuration = _rewardsDuration;
    }

    /* ========== VIEWS ========== */

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function rewardPerToken() public view returns (uint256) {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored + (((lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * 1e18) / _totalSupply);
    }

    function earned(address account) public view returns (uint256) {
        return (_balances[account] * (rewardPerToken() - userRewardPerTokenPaid[account])) / 1e18 + rewards[account];
    }

    function getRewardForDuration() external view returns (uint256) {
        return rewardRate * rewardsDuration;
    }

    function checkLiquidityTokens(address token0, address token1) internal view returns (bool) {
        return
            (token0 == liquidityToken0 || token0 == liquidityToken1) &&
            (token1 == liquidityToken0 || token1 == liquidityToken1);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function stake(uint256 tokenId) external nonReentrant whenNotPaused updateReward(msg.sender) {
        address uniPositionManager_ = uniPositionManager;
        (, , address token0, address token1, , , , uint128 liquidity, , , , ) = INonfungiblePositionManager(
            uniPositionManager_
        ).positions(tokenId);
        require(checkLiquidityTokens(token0, token1), "Incorrect LP token");
        _totalSupply += liquidity;
        _balances[msg.sender] += liquidity;
        IERC721(uniPositionManager_).safeTransferFrom(msg.sender, address(this), tokenId);
        emit Staked(msg.sender, tokenId);
    }

    function withdraw(uint256 tokenId) public nonReentrant updateReward(msg.sender) {
        address uniPositionManager_ = uniPositionManager;
        (, , address token0, address token1, , , , uint128 liquidity, , , , ) = INonfungiblePositionManager(
            uniPositionManager_
        ).positions(tokenId);
        require(checkLiquidityTokens(token0, token1), "Incorrect LP token");
        _totalSupply -= liquidity;
        _balances[msg.sender] -= liquidity;
        IERC721(uniPositionManager_).safeTransferFrom(address(this), msg.sender, tokenId);
        emit Withdrawn(msg.sender, tokenId);
    }

    function getReward() public nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            IERC20(rewardsToken).transfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function notifyRewardAmount(uint256 reward) external override onlyRewardsDistribution updateReward(address(0)) {
        if (block.timestamp >= periodFinish) {
            rewardRate = reward / rewardsDuration;
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover = remaining * rewardRate;
            rewardRate = (reward + leftover) / rewardsDuration;
        }

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint256 balance = IERC20(rewardsToken).balanceOf(address(this));
        require(rewardRate <= balance / rewardsDuration, "Provided reward too high");

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + rewardsDuration;
        emit RewardAdded(reward);
    }

    // Added to support recovering LP Rewards from other systems to be distributed to holders
    function recoverERC721(address tokenAddress, uint256 tokenId) external onlyOwner {
        (, , address token0, address token1, , , , , , , , ) = INonfungiblePositionManager(uniPositionManager)
            .positions(tokenId);
        require(!checkLiquidityTokens(token0, token1), "Incorrect LP token");
        IERC721(tokenAddress).safeTransferFrom(address(this), owner(), tokenId);
        emit Recovered(tokenAddress, tokenId);
    }

    function setRewardsDuration(uint256 _rewardsDuration) external onlyOwner {
        require(block.timestamp > periodFinish, "Prev. reward period unfinished");
        rewardsDuration = _rewardsDuration;
        emit RewardsDurationUpdated(rewardsDuration);
    }

    /* ========== MODIFIERS ========== */

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    /* ========== EVENTS ========== */

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 tokenId);
    event Withdrawn(address indexed user, uint256 tokenId);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardsDurationUpdated(uint256 newDuration);
    event Recovered(address token, uint256 tokenId);
}
