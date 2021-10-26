// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title A mock implementation of Uniswap V3's NonfungiblePositionManager
contract MockNonfungiblePositionManager is ERC721 {
    address public token0Stored;
    address public token1Stored;
    uint128 public liquidityStored;

    constructor(
        string memory name_,
        string memory symbol_,
        address token0_,
        address token1_,
        uint128 liquidity_
    ) ERC721(name_, symbol_) {
        token0Stored = token0_;
        token1Stored = token1_;
        liquidityStored = liquidity_;
    }

    function safeMint(address to, uint256 tokenId) external {
        _safeMint(to, tokenId);
    }

    function positions(uint256 tokenId)
        external
        view
        returns (
            uint96 nonce,
            address operator,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        )
    {
        tokenId;
        return (0, address(0), token0Stored, token1Stored, 0, 0, 0, liquidityStored, 0, 0, 0, 0);
    }
}
