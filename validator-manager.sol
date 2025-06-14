// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./libs/Constants.sol";

/**
 * @title ValidatorManager
 * @notice Manages validator registration, staking, slashing, and heartbeat monitoring
 * @dev Implements economic security through staking with USD-denominated minimums via Chainlink
 */
contract ValidatorManager is 
    ReentrancyGuardUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable 
{
    // Constants
    uint256 public constant MIN_STAKE_USD = 1_000_000 * 1e8; // $1M in Chainlink decimals
    uint256 public constant UNBONDING_PERIOD = 21 days;
    uint256 public constant HEARTBEAT_INTERVAL = 4 hours;
    uint256 public constant JAIL_DURATION = 72 hours;
    uint256 public constant SLASH_DOUBLE_SIGN_BPS = 500; // 5%
    uint256 public constant SLASH_OFFLINE_BPS = 100; // 1%
    
    // Validator info
    struct Validator {
        bytes blsPubKey;
        uint256 stake;
        uint256 lastHeartbeat;
        uint256 jailedUntil;
        uint256 unbondingTime;
        uint256 totalSlashed;
        bool active;
        uint256 missedHeartbeats;
        uint256 performanceScore; // 0-10000 basis points
    }
    
    // Slashing events
    struct SlashEvent {
        address validator;
        uint256 amount;
        uint8 reason; // 1: double sign, 2: offline
        uint256 timestamp;
    }
    
    // Storage
    mapping(address => Validator) public validators;
    mapping(bytes => address) public pubKeyToValidator;
    address[] public validatorSet;
    
    mapping(uint256 => SlashEvent) public slashEvents;
    uint256 public slashEventCount;
    
    uint256 public requiredValidators;
    address public bridgeContract;
    AggregatorV3Interface public ethUsdPriceFeed;
    
    // Epoch tracking for heartbeats
    uint256 public currentEpoch;
    mapping(uint256 => mapping(address => bool)) public epochHeartbeats;
    
    // Events
    event ValidatorRegistered(
        address indexed validator,
        bytes blsPubKey,
        uint256 stake
    );
    event ValidatorUnbonding(address indexed validator, uint256 unbondingTime);
    event ValidatorWithdrawn(address indexed validator, uint256 amount);
    event ValidatorSlashed(
        address indexed validator,
        uint256 amount,
        uint8 reason
    );
    event ValidatorJailed(address indexed validator, uint256 until);
    event HeartbeatReceived(address indexed validator, uint256 epoch);
    event PerformanceUpdated(address indexed validator, uint256 score);
    
    // Modifiers
    modifier onlyBridge() {
        require(msg.sender == bridgeContract, "Only bridge");
        _;
    }
    
    modifier onlyActiveValidator() {
        require(validators[msg.sender].active, "Not active validator");
        require(!isJailed(msg.sender), "Validator jailed");
        _;
    }
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @notice Initialize the validator manager
     * @param priceFeed_ Chainlink ETH/USD price feed address
     * @param requiredValidators_ Initial required validator count
     */
    function initialize(
        address priceFeed_,
        uint256 requiredValidators_
    ) public initializer {
        __ReentrancyGuard_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();
        
        ethUsdPriceFeed = AggregatorV3Interface(priceFeed_);
        requiredValidators = requiredValidators_;
        currentEpoch = 1;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(Constants.GOVERNOR_ROLE, msg.sender);
    }
    
    /**
     * @notice Register as a validator with BLS public key
     * @param blsPubKey BLS public key for signature aggregation
     */
    function registerValidator(bytes calldata blsPubKey) 
        external 
        payable 
        nonReentrant 
    {
        require(blsPubKey.length == 128, "Invalid BLS pubkey length");
        require(validators[msg.sender].stake == 0, "Already registered");
        require(pubKeyToValidator[blsPubKey] == address(0), "PubKey already used");
        
        // Check minimum stake in USD
        uint256 stakeValueUSD = getStakeValueUSD(msg.value);
        require(stakeValueUSD >= MIN_STAKE_USD, "Insufficient stake");
        
        // Register validator
        validators[msg.sender] = Validator({
            blsPubKey: blsPubKey,
            stake: msg.value,
            lastHeartbeat: block.timestamp,
            jailedUntil: 0,
            unbondingTime: 0,
            totalSlashed: 0,
            active: true,
            missedHeartbeats: 0,
            performanceScore: 10000 // Start at 100%
        });
        
        pubKeyToValidator[blsPubKey] = msg.sender;
        validatorSet.push(msg.sender);
        
        emit ValidatorRegistered(msg.sender, blsPubKey, msg.value);
    }
    
    /**
     * @notice Submit heartbeat to prove liveness
     * @param epoch Current epoch number
     */
    function heartbeat(uint256 epoch) external onlyActiveValidator {
        require(epoch == currentEpoch, "Invalid epoch");
        require(!epochHeartbeats[epoch][msg.sender], "Already submitted");
        
        Validator storage validator = validators[msg.sender];
        validator.lastHeartbeat = block.timestamp;
        validator.missedHeartbeats = 0; // Reset counter
        epochHeartbeats[epoch][msg.sender] = true;
        
        // Update performance score
        _updatePerformanceScore(msg.sender);
        
        emit HeartbeatReceived(msg.sender, epoch);
    }
    
    /**
     * @notice Slash validator for misbehavior
     * @param validator Address to slash
     * @param reason Slash reason (1: double sign, 2: offline)
     */
    function slash(address validator, uint8 reason) 
        external 
        onlyBridge 
        nonReentrant 
    {
        require(validators[validator].active, "Not active validator");
        require(reason == 1 || reason == 2, "Invalid reason");
        
        Validator storage val = validators[validator];
        uint256 slashAmount;
        
        if (reason == 1) {
            // Double signing - 5% slash
            slashAmount = (val.stake * SLASH_DOUBLE_SIGN_BPS) / 10000;
            // Also jail for 72 hours
            val.jailedUntil = block.timestamp + JAIL_DURATION;
            emit ValidatorJailed(validator, val.jailedUntil);
        } else {
            // Offline - 1% slash
            slashAmount = (val.stake * SLASH_OFFLINE_BPS) / 10000;
        }
        
        // Apply slash
        val.stake -= slashAmount;
        val.totalSlashed += slashAmount;
        
        // Record slash event
        slashEvents[slashEventCount++] = SlashEvent({
            validator: validator,
            amount: slashAmount,
            reason: reason,
            timestamp: block.timestamp
        });
        
        // Check if still meets minimum stake
        if (getStakeValueUSD(val.stake) < MIN_STAKE_USD) {
            val.active = false;
            _removeFromValidatorSet(validator);
        }
        
        emit ValidatorSlashed(validator, slashAmount, reason);
    }
    
    /**
     * @notice Start unbonding process
     */
    function startUnbonding() external onlyActiveValidator {
        Validator storage validator = validators[msg.sender];
        validator.active = false;
        validator.unbondingTime = block.timestamp + UNBONDING_PERIOD;
        
        _removeFromValidatorSet(msg.sender);
        
        emit ValidatorUnbonding(msg.sender, validator.unbondingTime);
    }
    
    /**
     * @notice Withdraw stake after unbonding period
     */
    function withdrawStake() external nonReentrant {
        Validator storage validator = validators[msg.sender];
        require(!validator.active, "Still active");
        require(validator.unbondingTime > 0, "Not unbonding");
        require(block.timestamp >= validator.unbondingTime, "Still unbonding");
        require(validator.stake > 0, "No stake");
        
        uint256 amount = validator.stake;
        validator.stake = 0;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit ValidatorWithdrawn(msg.sender, amount);
    }
    
    /**
     * @notice Update validator quorum requirement
     * @param newRequired New required validator count
     */
    function updateQuorum(uint256 newRequired) 
        external 
        onlyRole(Constants.GOVERNOR_ROLE) 
    {
        require(newRequired > 0 && newRequired <= validatorSet.length, "Invalid quorum");
        requiredValidators = newRequired;
    }
    
    /**
     * @notice Set bridge contract address
     * @param bridge_ Bridge contract address
     */
    function setBridgeContract(address bridge_) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        bridgeContract = bridge_;
    }
    
    /**
     * @notice Progress to next epoch
     */
    function progressEpoch() external onlyRole(Constants.GOVERNOR_ROLE) {
        // Check for missed heartbeats in previous epoch
        for (uint256 i = 0; i < validatorSet.length; i++) {
            address validator = validatorSet[i];
            if (!epochHeartbeats[currentEpoch][validator]) {
                validators[validator].missedHeartbeats++;
                
                // Auto-slash after missing too many heartbeats
                if (validators[validator].missedHeartbeats >= 2) {
                    // Slash 1% for being offline
                    if (validators[validator].active) {
                        this.slash(validator, 2);
                    }
                }
            }
        }
        
        currentEpoch++;
    }
    
    /**
     * @notice Check if validator is currently jailed
     * @param validator Validator address
     * @return isJailed True if jailed
     */
    function isJailed(address validator) public view returns (bool) {
        return validators[validator].jailedUntil > block.timestamp;
    }
    
    /**
     * @notice Check if address is an active validator
     * @param validator Address to check
     * @return isActive True if active and not jailed
     */
    function isActiveValidator(address validator) external view returns (bool) {
        return validators[validator].active && !isJailed(validator);
    }
    
    /**
     * @notice Get validator BLS public key
     * @param validator Validator address
     * @return blsPubKey BLS public key
     */
    function getValidatorPubKey(address validator) 
        external 
        view 
        returns (bytes memory) 
    {
        return validators[validator].blsPubKey;
    }
    
    /**
     * @notice Get all active validators
     * @return activeValidators Array of active validator addresses
     */
    function getActiveValidators() 
        external 
        view 
        returns (address[] memory) 
    {
        uint256 count = 0;
        for (uint256 i = 0; i < validatorSet.length; i++) {
            if (validators[validatorSet[i]].active && !isJailed(validatorSet[i])) {
                count++;
            }
        }
        
        address[] memory active = new address[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < validatorSet.length; i++) {
            if (validators[validatorSet[i]].active && !isJailed(validatorSet[i])) {
                active[index++] = validatorSet[i];
            }
        }
        
        return active;
    }
    
    /**
     * @notice Get validator performance metrics
     * @param validator Validator address
     * @return score Performance score (0-10000)
     * @return totalSlashed Total amount slashed
     * @return missedHeartbeats Number of missed heartbeats
     */
    function getValidatorPerformance(address validator) 
        external 
        view 
        returns (
            uint256 score,
            uint256 totalSlashed,
            uint256 missedHeartbeats
        ) 
    {
        Validator storage val = validators[validator];
        return (val.performanceScore, val.totalSlashed, val.missedHeartbeats);
    }
    
    /**
     * @notice Calculate stake value in USD
     * @param ethAmount Amount in ETH
     * @return valueUSD Value in USD (8 decimals)
     */
    function getStakeValueUSD(uint256 ethAmount) public view returns (uint256) {
        (, int256 price, , , ) = ethUsdPriceFeed.latestRoundData();
        require(price > 0, "Invalid price");
        
        // ETH has 18 decimals, price has 8 decimals
        // Result should have 8 decimals for USD
        return (ethAmount * uint256(price)) / 1e18;
    }
    
    /**
     * @notice Update validator performance score
     * @param validator Validator address
     */
    function _updatePerformanceScore(address validator) private {
        Validator storage val = validators[validator];
        
        // Base score starts at 10000 (100%)
        uint256 score = 10000;
        
        // Deduct for missed heartbeats (1000 points per miss)
        score -= val.missedHeartbeats * 1000;
        
        // Deduct for slashing history (100 points per 0.1 ETH slashed)
        uint256 slashDeduction = (val.totalSlashed * 100) / 0.1 ether;
        score = score > slashDeduction ? score - slashDeduction : 0;
        
        val.performanceScore = score;
        emit PerformanceUpdated(validator, score);
    }
    
    /**
     * @notice Remove validator from active set
     * @param validator Validator to remove
     */
    function _removeFromValidatorSet(address validator) private {
        for (uint256 i = 0; i < validatorSet.length; i++) {
            if (validatorSet[i] == validator) {
                validatorSet[i] = validatorSet[validatorSet.length - 1];
                validatorSet.pop();
                break;
            }
        }
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
     * @notice Emergency withdrawal of slashed funds
     * @param to Recipient address
     */
    function withdrawSlashedFunds(address to) 
        external 
        onlyRole(Constants.GOVERNOR_ROLE) 
    {
        uint256 totalSlashed = address(this).balance;
        
        // Calculate total active stakes
        uint256 totalActiveStakes = 0;
        for (uint256 i = 0; i < validatorSet.length; i++) {
            totalActiveStakes += validators[validatorSet[i]].stake;
        }
        
        // Only withdraw excess (slashed funds)
        if (totalSlashed > totalActiveStakes) {
            uint256 withdrawAmount = totalSlashed - totalActiveStakes;
            (bool success, ) = to.call{value: withdrawAmount}("");
            require(success, "Transfer failed");
        }
    }
}