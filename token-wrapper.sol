// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title TokenWrapper
 * @notice Wrapped token implementation for cross-chain bridged assets
 * @dev Mintable/burnable by bridge contract only
 */
contract TokenWrapper is ERC20, ERC20Permit, AccessControl, Pausable {
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    uint8 private immutable _decimals;
    string public nativeChain;
    address public nativeToken;
    
    event BridgeMint(address indexed to, uint256 amount, bytes32 txHash);
    event BridgeBurn(address indexed from, uint256 amount, bytes32 txHash);
    
    /**
     * @notice Constructor for wrapped token
     * @param name_ Token name (e.g., "Wrapped YHGS")
     * @param symbol_ Token symbol (e.g., "wYHGS")
     * @param decimals_ Token decimals (must match native)
     * @param nativeChain_ Name of native chain
     * @param nativeToken_ Address on native chain
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        string memory nativeChain_,
        address nativeToken_
    ) ERC20(name_, symbol_) ERC20Permit(name_) {
        _decimals = decimals_;
        nativeChain = nativeChain_;
        nativeToken = nativeToken_;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }
    
    /**
     * @notice Mint wrapped tokens (bridge only)
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) 
        external 
        onlyRole(BRIDGE_ROLE) 
        whenNotPaused 
    {
        _mint(to, amount);
        emit BridgeMint(to, amount, bytes32(0));
    }
    
    /**
     * @notice Mint with transaction hash for tracking
     * @param to Recipient address
     * @param amount Amount to mint
     * @param txHash Bridge transaction hash
     */
    function mintWithTxHash(
        address to, 
        uint256 amount, 
        bytes32 txHash
    ) external onlyRole(BRIDGE_ROLE) whenNotPaused {
        _mint(to, amount);
        emit BridgeMint(to, amount, txHash);
    }
    
    /**
     * @notice Burn wrapped tokens (bridge only)
     * @param from Token holder
     * @param amount Amount to burn
     */
    function burn(address from, uint256 amount) 
        external 
        onlyRole(BRIDGE_ROLE) 
        whenNotPaused 
    {
        _burn(from, amount);
        emit BridgeBurn(from, amount, bytes32(0));
    }
    
    /**
     * @notice Burn with transaction hash for tracking
     * @param from Token holder
     * @param amount Amount to burn
     * @param txHash Bridge transaction hash
     */
    function burnWithTxHash(
        address from, 
        uint256 amount, 
        bytes32 txHash
    ) external onlyRole(BRIDGE_ROLE) whenNotPaused {
        _burn(from, amount);
        emit BridgeBurn(from, amount, txHash);
    }
    
    /**
     * @notice Pause token transfers
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause token transfers
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Get token decimals
     * @return Token decimals
     */
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @notice Hook to prevent transfers when paused
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }
}

/**
 * @title TokenWrapperFactory
 * @notice Factory for deploying wrapped tokens consistently
 */
contract TokenWrapperFactory {
    event TokenWrapperDeployed(
        address indexed wrapper,
        string name,
        string symbol,
        address indexed deployer
    );
    
    /**
     * @notice Deploy a new wrapped token
     * @param name Token name
     * @param symbol Token symbol
     * @param decimals Token decimals
     * @param nativeChain Native chain name
     * @param nativeToken Native token address
     * @return wrapper Deployed wrapper address
     */
    function deployWrapper(
        string memory name,
        string memory symbol,
        uint8 decimals,
        string memory nativeChain,
        address nativeToken
    ) external returns (address wrapper) {
        wrapper = address(
            new TokenWrapper(
                name,
                symbol,
                decimals,
                nativeChain,
                nativeToken
            )
        );
        
        // Transfer admin role to deployer
        TokenWrapper(wrapper).grantRole(
            TokenWrapper(wrapper).DEFAULT_ADMIN_ROLE(),
            msg.sender
        );
        TokenWrapper(wrapper).renounceRole(
            TokenWrapper(wrapper).DEFAULT_ADMIN_ROLE(),
            address(this)
        );
        
        emit TokenWrapperDeployed(wrapper, name, symbol, msg.sender);
    }
}