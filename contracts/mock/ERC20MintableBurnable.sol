// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../token/ERC20MintableAccessControlled.sol";

/// @title A mintable and burnable ERC20 token
contract ERC20MintableBurnable is ERC20MintableAccessControlled {
    constructor(
        string memory name,
        string memory symbol,
        uint8 tokenDecimals,
        address minter,
        uint256 initialSupply
    ) ERC20MintableAccessControlled(name, symbol, tokenDecimals, minter, initialSupply) {}

    /// @notice Burn an amount of tokens from an account
    function burn(address account, uint256 amount) public {
        require(hasRole(MINTER_ROLE, _msgSender()));
        _burn(account, amount);
    }
}
