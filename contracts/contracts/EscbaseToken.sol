// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EscbaseToken is ERC20, Ownable {
	// Swap rate: 0.0001 USDC = 10 ESC (1 USDC = 100,000 ESC)
	// This means: 1 USDC (1e18) = 100,000 ESC (1e5 * 1e18)
	uint256 public constant SWAP_RATE = 100000; // 100,000 ESC per 1 USDC

	constructor() ERC20("Escbase","ESC") Ownable(msg.sender) {}

	function mint(address to, uint256 amount) external onlyOwner {
		_mint(to, amount);
	}

	// Swap native USDC to ESC tokens
	// Rate: 0.0001 USDC = 10 ESC (1 USDC = 100,000 ESC)
	function swap() external payable {
		require(msg.value > 0, "Must send USDC");
		// Calculate ESC amount: msg.value * SWAP_RATE
		uint256 escAmount = msg.value * SWAP_RATE;
		_mint(msg.sender, escAmount);
	}
}


