// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./token/ERC20MintableAccessControlled.sol";
import "./token/ERC20MintableOwned.sol";

/// @title A contract that deploys ERC20 token contracts for anyone
contract SeedClubMint {
    event TokenDeployed(address token);

    /// @notice Deploys a new ERC20 token contract
    // prettier-ignore
    function createToken(
        string calldata tokenName,
        string calldata tokenSymbol,
        uint8 tokenDecimals,
        uint256 initialSupply,
        address firstOwner,
        bool mintable,
        bool multiOwner
    ) external {
        address token;
        if (mintable)
            if (multiOwner)
                token = address(
                    new ERC20MintableAccessControlled(
                        tokenName,
                        tokenSymbol,
                        tokenDecimals,
                        firstOwner,
                        initialSupply
                    )
                );
            else
                token = address(
                    new ERC20MintableOwned(
                        tokenName,
                        tokenSymbol,
                        tokenDecimals,
                        firstOwner,
                        initialSupply
                    )
                );
        else
            token = address(
                new ERC20InitialSupply(
                    tokenName,
                    tokenSymbol,
                    tokenDecimals,
                    firstOwner,
                    initialSupply
                )
            );
        emit TokenDeployed(token);
    }
}
