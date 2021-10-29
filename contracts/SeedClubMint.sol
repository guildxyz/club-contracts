// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./token/ERC20Mintable.sol";

/// @title A contract that deploys ERC20 token contracts for anyone
contract SeedClubMint {
    event TokenDeployed(address token);

    /// @notice Deploys a new ERC20 token contract
    // prettier-ignore
    function createToken(
        string calldata tokenName,
        string calldata tokenSymbol,
        uint8 tokenDecimals,
        address tokenOwner,
        uint256 initialSupply,
        bool mintable
    ) external {
        address token;
        if (mintable)
            token = address(
                new ERC20Mintable(
                    tokenName,
                    tokenSymbol,
                    tokenDecimals,
                    tokenOwner,
                    initialSupply
                )
            );
        else
            token = address(
                new ERC20InitialSupply(
                    tokenName,
                    tokenSymbol,
                    tokenDecimals,
                    tokenOwner,
                    initialSupply
                )
            );
        emit TokenDeployed(token);
    }
}
