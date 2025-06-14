// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./libs/BLSSignatureLib.sol";
import "./libs/Constants.sol";
import "./interfaces/IValidatorManager.sol";
import "./interfaces/ITokenWrapper.sol";

/**
 * @title YHGSBridge
 * @notice Core bridge contract for cross-chain token transfers with BLS aggregated signatures
 * @dev UUPS upgradeable pattern with circuit breakers and multi-signature validation
 */
contract YHGSBridge is 
    ReentrancyGuardUpgradeable, 
    PausableUpgradeable, 
    AccessControlUpgradeable,
    UUPSUpgradeable 
{
    using SafeERC20 for IERC20;
    
    // Storage layout (slots optimized)
    uint256 private _nonce;
    uint256 private _requiredSignatures;
    address private _validatorManager;
    
    // Transaction tracking
    mapping(bytes32 => BridgeTx) public transactions;
    mapping(address => bool) public isTokenSupported;
    mapping(address => TokenConfig) public tokenConfigs;
    
    // Chain-specific pause states
    mapping(uint256 => bool) public chainPaused;
    mapping(address => bool) public tokenPaused;
    
    // Structs
    struct BridgeTx {
        uint256 amount;
        uint256 srcChain;
        uint256 dstChain;
        address token;
        address sender;
        bytes recipient;
        TxStatus status;
        uint256 timestamp;
        uint256 signatures;
    }
    
    struct TokenConfig {
        uint256 minAmount;
        uint256 maxAmount;
        uint256 dailyLimit;
        uint256 dailyVolume;
        uint256 lastResetDay;
        uint16 feeBasisPoints; // 100 = 1%
    }
    
    struct WithdrawalProof {
        uint256 amount;
        address to;
        address token;
        uint256 srcChain;
        bytes32[] validatorSigs;
    }
    
    enum TxStatus {
        None,
        Deposited,
        Signed,
        Executed,
        Failed
    }
    
    // Events
    event DepositRequested(
        bytes32 indexed txHash,
        address indexed sender,
        address indexed token,
        uint256 amount,
        uint256 srcChain,
        uint256 dstChain,
        bytes recipient
    );
    
    event WithdrawalCompleted(
        bytes32 indexed txHash,
        address indexed recipient,
        address indexed token,
        uint256 amount
    );
    
    event ValidatorSetUpdated(uint256 newRequired);
    event TokenConfigUpdated(address indexed token, TokenConfig config);
    event ChainPauseToggled(uint256 chainId, bool paused);
    event TokenPauseToggled(address token, bool paused);
    
    // Modifiers
    modifier notChainPaused(uint256 chainId) {
        require(!chainPaused[chainId], "Chain paused");
        _;
    }
    
    modifier notTokenPaused(address token) {
        require(!tokenPaused[token], "Token paused");
        _;
    }
    
    modifier onlyValidator() {
        require(
            IValidatorManager(_validatorManager).isActiveValidator(msg.sender),
            "Not active validator"
        );
        _;
    }
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @notice Initialize the bridge contract
     * @param validatorManager_ Address of validator manager contract
     * @param requiredSigs_ Initial required signatures (5)
     */
    function initialize(
        address validatorManager_,
        uint256 requiredSigs_
    ) public initializer {
        __ReentrancyGuard_init();
        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();
        
        _validatorManager = validatorManager_;
        _requiredSignatures = requiredSigs_;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(Constants.GOVERNOR_ROLE, msg.sender);
        _grantRole(Constants.OPERATOR_ROLE, msg.sender);
    }
    
    /**
     * @notice Deposit tokens to bridge for cross-chain transfer
     * @param token Token address (address(0) for native)
     * @param amount Amount to bridge
     * @param dstChainId Destination chain ID
     * @param recipient Recipient address on destination chain
     * @return txHash Unique transaction hash
     */
    function deposit(
        address token,
        uint256 amount,
        uint256 dstChainId,
        bytes calldata recipient
    ) 
        external 
        payable
        nonReentrant 
        whenNotPaused
        notChainPaused(block.chainid)
        notChainPaused(dstChainId)
        notTokenPaused(token)
        returns (bytes32 txHash) 
    {
        require(isTokenSupported[token], "Token not supported");
        require(recipient.length > 0, "Invalid recipient");
        
        TokenConfig storage config = tokenConfigs[token];
        require(amount >= config.minAmount, "Below minimum");
        require(amount <= config.maxAmount, "Above maximum");
        
        // Check daily limit
        uint256 currentDay = block.timestamp / 1 days;
        if (currentDay > config.lastResetDay) {
            config.dailyVolume = 0;
            config.lastResetDay = currentDay;
        }
        require(
            config.dailyVolume + amount <= config.dailyLimit,
            "Daily limit exceeded"
        );
        config.dailyVolume += amount;
        
        // Handle token transfer
        uint256 feeAmount = (amount * config.feeBasisPoints) / 10000;
        uint256 netAmount = amount - feeAmount;
        
        if (token == address(0)) {
            // Native token
            require(msg.value == amount, "Incorrect ETH amount");
        } else {
            // ERC20 token
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }
        
        // Generate transaction hash
        txHash = keccak256(
            abi.encodePacked(
                _nonce++,
                msg.sender,
                token,
                netAmount,
                block.chainid,
                dstChainId,
                recipient,
                block.timestamp
            )
        );
        
        // Store transaction
        transactions[txHash] = BridgeTx({
            amount: netAmount,
            srcChain: block.chainid,
            dstChain: dstChainId,
            token: token,
            sender: msg.sender,
            recipient: recipient,
            status: TxStatus.Deposited,
            timestamp: block.timestamp,
            signatures: 0
        });
        
        emit DepositRequested(
            txHash,
            msg.sender,
            token,
            netAmount,
            block.chainid,
            dstChainId,
            recipient
        );
    }
    
    /**
     * @notice Execute withdrawal after validator consensus
     * @param txHash Transaction hash from source chain
     * @param proof Withdrawal proof with validator signatures
     * @param aggSignature Aggregated BLS signature
     */
    function executeWithdrawal(
        bytes32 txHash,
        WithdrawalProof calldata proof,
        bytes calldata aggSignature
    ) 
        external 
        whenNotPaused
        notChainPaused(block.chainid)
        notTokenPaused(proof.token)
    {
        BridgeTx storage tx = transactions[txHash];
        require(tx.status == TxStatus.None || tx.status == TxStatus.Signed, "Invalid status");
        
        // Verify BLS aggregated signature
        bytes32 message = keccak256(
            abi.encode(txHash, proof.amount, proof.to, proof.token, proof.srcChain, block.chainid)
        );
        
        require(
            BLSSignatureLib.verifyAggregated(
                message,
                aggSignature,
                proof.validatorSigs,
                _validatorManager
            ),
            "Invalid signature"
        );
        
        require(proof.validatorSigs.length >= _requiredSignatures, "Insufficient signatures");
        
        // High value transaction check (6/7 signatures for >$100k)
        if (_isHighValueTransaction(proof.token, proof.amount)) {
            require(
                proof.validatorSigs.length >= _requiredSignatures + 1,
                "High value: need extra sig"
            );
        }
        
        // Update transaction status
        if (tx.status == TxStatus.None) {
            // First time seeing this withdrawal
            tx.amount = proof.amount;
            tx.srcChain = proof.srcChain;
            tx.dstChain = block.chainid;
            tx.token = proof.token;
            tx.sender = address(0); // Unknown from source
            tx.recipient = abi.encodePacked(proof.to);
            tx.timestamp = block.timestamp;
        }
        
        tx.status = TxStatus.Executed;
        tx.signatures = proof.validatorSigs.length;
        
        // Execute token transfer
        if (proof.token == address(0)) {
            // Native token
            (bool success, ) = proof.to.call{value: proof.amount}("");
            require(success, "ETH transfer failed");
        } else {
            // Check if wrapped token
            try ITokenWrapper(proof.token).mint(proof.to, proof.amount) {
                // Minted wrapped token
            } catch {
                // Regular ERC20 transfer
                IERC20(proof.token).safeTransfer(proof.to, proof.amount);
            }
        }
        
        emit WithdrawalCompleted(txHash, proof.to, proof.token, proof.amount);
    }
    
    /**
     * @notice Update required signatures threshold
     * @param newRequired New signature requirement (max 7)
     */
    function updateRequiredSignatures(uint256 newRequired) 
        external 
        onlyRole(Constants.GOVERNOR_ROLE) 
    {
        require(newRequired > 0 && newRequired <= 7, "Invalid requirement");
        _requiredSignatures = newRequired;
        emit ValidatorSetUpdated(newRequired);
    }
    
    /**
     * @notice Configure token parameters
     * @param token Token address
     * @param config Token configuration
     */
    function setTokenConfig(
        address token,
        TokenConfig calldata config
    ) external onlyRole(Constants.OPERATOR_ROLE) {
        require(config.minAmount < config.maxAmount, "Invalid amounts");
        require(config.feeBasisPoints <= 1000, "Fee too high"); // Max 10%
        
        isTokenSupported[token] = true;
        tokenConfigs[token] = config;
        
        emit TokenConfigUpdated(token, config);
    }
    
    /**
     * @notice Toggle chain pause state
     * @param chainId Chain to pause/unpause
     * @param paused Pause state
     */
    function setChainPaused(uint256 chainId, bool paused) 
        external 
        onlyRole(Constants.OPERATOR_ROLE) 
    {
        chainPaused[chainId] = paused;
        emit ChainPauseToggled(chainId, paused);
    }
    
    /**
     * @notice Toggle token pause state
     * @param token Token to pause/unpause
     * @param paused Pause state
     */
    function setTokenPaused(address token, bool paused) 
        external 
        onlyRole(Constants.OPERATOR_ROLE) 
    {
        tokenPaused[token] = paused;
        emit TokenPauseToggled(token, paused);
    }
    
    /**
     * @notice Emergency pause all operations
     */
    function pause() external onlyRole(Constants.OPERATOR_ROLE) {
        _pause();
    }
    
    /**
     * @notice Resume operations
     */
    function unpause() external onlyRole(Constants.GOVERNOR_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Check if transaction amount qualifies as high value
     * @param token Token address
     * @param amount Token amount
     * @return isHighValue True if >$100k USD equivalent
     */
    function _isHighValueTransaction(
        address token,
        uint256 amount
    ) private view returns (bool) {
        // Simplified - in production, use Chainlink oracle
        // Assume 1 token = $1 for demo
        uint256 usdValue = amount / 1e18;
        return usdValue >= 100_000;
    }
    
    /**
     * @notice Authorize contract upgrade
     * @param newImplementation New implementation address
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        onlyRole(DEFAULT_ADMIN_ROLE)
        override
    {}
    
    /**
     * @notice Get transaction details
     * @param txHash Transaction hash
     * @return Transaction struct
     */
    function getTransaction(bytes32 txHash) 
        external 
        view 
        returns (BridgeTx memory) 
    {
        return transactions[txHash];
    }
    
    /**
     * @notice Get current nonce
     * @return Current nonce value
     */
    function getNonce() external view returns (uint256) {
        return _nonce;
    }
    
    /**
     * @notice Withdraw accumulated fees
     * @param token Token to withdraw fees for
     * @param to Recipient address
     */
    function withdrawFees(
        address token,
        address to
    ) external onlyRole(Constants.GOVERNOR_ROLE) {
        require(to != address(0), "Invalid recipient");
        
        if (token == address(0)) {
            uint256 balance = address(this).balance;
            (bool success, ) = to.call{value: balance}("");
            require(success, "ETH transfer failed");
        } else {
            uint256 balance = IERC20(token).balanceOf(address(this));
            IERC20(token).safeTransfer(to, balance);
        }
    }
    
    receive() external payable {}
}