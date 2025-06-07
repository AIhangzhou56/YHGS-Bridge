// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title HeaderStore
 * @dev Stores Ethereum block headers with Gnosis Safe governance and PoW/Clique difficulty validation
 * Implements light client functionality for cross-chain verification
 */
contract HeaderStore {
    struct BlockHeader {
        bytes32 parentHash;
        bytes32 receiptsRoot;
        bytes32 stateRoot;
        uint256 blockNumber;
        uint256 timestamp;
        uint256 difficulty;
        bytes32 blockHash;
        bool verified;
    }

    struct BLSSignature {
        uint256[2] signature;
        uint256[4] pubkey;
        uint256[2] message;
    }

    // Gnosis Safe governance
    address public gnosisSafe;
    uint256 public constant MIN_DIFFICULTY = 1;
    uint256 public constant MAX_DIFFICULTY_JUMP = 2048; // 2^11 for PoW difficulty adjustment
    
    // Mapping of block hash to header
    mapping(bytes32 => BlockHeader) public headers;
    
    // Mapping of block number to canonical hash
    mapping(uint256 => bytes32) public canonicalHeaders;
    
    // Latest finalized block number
    uint256 public latestFinalizedBlock;
    
    // BLS verification contract (placeholder)
    address public blsVerifier;
    
    // Light client committee
    mapping(address => bool) public validators;
    uint256 public validatorCount;
    uint256 public requiredSignatures;
    
    // Difficulty validation settings
    bool public strictDifficultyCheck = true;
    uint256 public maxBlockGap = 100; // Maximum gap between consecutive blocks
    
    // Events
    event HeaderSubmitted(bytes32 indexed blockHash, uint256 indexed blockNumber, address validator);
    event HeaderFinalized(bytes32 indexed blockHash, uint256 indexed blockNumber);
    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    
    modifier onlyGnosisSafe() {
        require(msg.sender == gnosisSafe, "Only Gnosis Safe can perform this action");
        _;
    }
    
    modifier onlyValidator() {
        require(validators[msg.sender], "Only validators can submit headers");
        _;
    }
    
    constructor(address _gnosisSafe, address _blsVerifier, uint256 _requiredSignatures) {
        require(_gnosisSafe != address(0), "Invalid Gnosis Safe address");
        gnosisSafe = _gnosisSafe;
        blsVerifier = _blsVerifier;
        requiredSignatures = _requiredSignatures;
    }
    
    /**
     * @dev Submit a block header with BLS signature and difficulty validation
     * @param _blockHash The hash of the block
     * @param _parentHash The parent block hash
     * @param _receiptsRoot The receipts root
     * @param _stateRoot The state root
     * @param _blockNumber The block number
     * @param _timestamp The block timestamp
     * @param _difficulty The block difficulty
     * @param _signature BLS signature data
     */
    function submitHeader(
        bytes32 _blockHash,
        bytes32 _parentHash,
        bytes32 _receiptsRoot,
        bytes32 _stateRoot,
        uint256 _blockNumber,
        uint256 _timestamp,
        uint256 _difficulty,
        BLSSignature calldata _signature
    ) external onlyValidator {
        require(_blockHash != bytes32(0), "Invalid block hash");
        require(_blockNumber > latestFinalizedBlock, "Block too old");
        require(_difficulty >= MIN_DIFFICULTY, "Difficulty too low");
        
        // Validate difficulty progression for PoW/Clique
        if (strictDifficultyCheck && _blockNumber > 0) {
            bytes32 parentCanonicalHash = canonicalHeaders[_blockNumber - 1];
            if (parentCanonicalHash != bytes32(0)) {
                BlockHeader storage parentHeader = headers[parentCanonicalHash];
                require(_validateDifficulty(parentHeader.difficulty, _difficulty, _blockNumber - parentHeader.blockNumber), 
                        "Invalid difficulty adjustment");
            }
        }
        
        // Verify parent hash consistency
        if (_blockNumber > 0) {
            bytes32 expectedParent = canonicalHeaders[_blockNumber - 1];
            if (expectedParent != bytes32(0)) {
                require(_parentHash == expectedParent, "Invalid parent hash");
            }
        }
        
        // Verify BLS signature (placeholder implementation)
        require(verifyBLSSignature(_blockHash, _signature), "Invalid BLS signature");
        
        // Store header
        headers[_blockHash] = BlockHeader({
            parentHash: _parentHash,
            receiptsRoot: _receiptsRoot,
            stateRoot: _stateRoot,
            blockNumber: _blockNumber,
            timestamp: _timestamp,
            difficulty: _difficulty,
            blockHash: _blockHash,
            verified: true
        });
        
        // Update canonical chain if this extends it
        if (_blockNumber == latestFinalizedBlock + 1) {
            canonicalHeaders[_blockNumber] = _blockHash;
            latestFinalizedBlock = _blockNumber;
            emit HeaderFinalized(_blockHash, _blockNumber);
        }
        
        emit HeaderSubmitted(_blockHash, _blockNumber, msg.sender);
    }
    
    /**
     * @dev Validate difficulty adjustment for PoW/Clique consensus
     * @param _parentDifficulty Previous block difficulty
     * @param _currentDifficulty Current block difficulty
     * @param _blockGap Number of blocks between parent and current
     * @return True if difficulty adjustment is valid
     */
    function _validateDifficulty(
        uint256 _parentDifficulty,
        uint256 _currentDifficulty,
        uint256 _blockGap
    ) internal view returns (bool) {
        // Skip validation for large block gaps
        if (_blockGap > maxBlockGap) {
            return true;
        }
        
        // For Clique (PoA), difficulty is constant or alternates between 1 and 2
        if (_parentDifficulty <= 2 && _currentDifficulty <= 2) {
            return true;
        }
        
        // For PoW, difficulty can increase/decrease within bounds
        uint256 maxIncrease = _parentDifficulty + (_parentDifficulty / MAX_DIFFICULTY_JUMP);
        uint256 maxDecrease = _parentDifficulty > (_parentDifficulty / MAX_DIFFICULTY_JUMP) ? 
                              _parentDifficulty - (_parentDifficulty / MAX_DIFFICULTY_JUMP) : 1;
        
        return _currentDifficulty >= maxDecrease && _currentDifficulty <= maxIncrease;
    }
    
    /**
     * @dev Verify BLS signature (placeholder implementation)
     * @param _blockHash The block hash being signed
     * @param _signature The BLS signature data
     * @return True if signature is valid
     */
    function verifyBLSSignature(
        bytes32 _blockHash,
        BLSSignature calldata _signature
    ) internal view returns (bool) {
        // Placeholder BLS verification
        // In production, this would call the BLS precompile or verification contract
        
        // Simple validation that signature components are non-zero
        if (_signature.signature[0] == 0 && _signature.signature[1] == 0) {
            return false;
        }
        
        if (_signature.pubkey[0] == 0 && _signature.pubkey[1] == 0 && 
            _signature.pubkey[2] == 0 && _signature.pubkey[3] == 0) {
            return false;
        }
        
        // TODO: Implement actual BLS verification using EIP-2537 precompiles
        // or external verification contract
        return true;
    }
    
    /**
     * @dev Get block header by hash
     * @param _blockHash The block hash
     * @return The block header
     */
    function getHeader(bytes32 _blockHash) external view returns (BlockHeader memory) {
        return headers[_blockHash];
    }
    
    /**
     * @dev Get canonical block hash by number
     * @param _blockNumber The block number
     * @return The canonical block hash
     */
    function getCanonicalHash(uint256 _blockNumber) external view returns (bytes32) {
        return canonicalHeaders[_blockNumber];
    }
    
    /**
     * @dev Check if a header is finalized
     * @param _blockHash The block hash
     * @return True if finalized
     */
    function isFinalized(bytes32 _blockHash) external view returns (bool) {
        BlockHeader memory header = headers[_blockHash];
        return header.verified && header.blockNumber <= latestFinalizedBlock;
    }
    
    /**
     * @dev Add a validator to the committee (Gnosis Safe only)
     * @param _validator The validator address
     */
    function addValidator(address _validator) external onlyGnosisSafe {
        require(_validator != address(0), "Invalid validator address");
        require(!validators[_validator], "Validator already exists");
        validators[_validator] = true;
        validatorCount++;
        emit ValidatorAdded(_validator);
    }
    
    /**
     * @dev Remove a validator from the committee (Gnosis Safe only)
     * @param _validator The validator address
     */
    function removeValidator(address _validator) external onlyGnosisSafe {
        require(validators[_validator], "Validator does not exist");
        validators[_validator] = false;
        validatorCount--;
        emit ValidatorRemoved(_validator);
    }
    
    /**
     * @dev Update required signature threshold (Gnosis Safe only)
     * @param _requiredSignatures New threshold
     */
    function updateRequiredSignatures(uint256 _requiredSignatures) external onlyGnosisSafe {
        require(_requiredSignatures <= validatorCount, "Threshold too high");
        require(_requiredSignatures > 0, "Threshold must be positive");
        requiredSignatures = _requiredSignatures;
    }
    
    /**
     * @dev Update Gnosis Safe address (current Safe only)
     * @param _newGnosisSafe New Gnosis Safe address
     */
    function updateGnosisSafe(address _newGnosisSafe) external onlyGnosisSafe {
        require(_newGnosisSafe != address(0), "Invalid Gnosis Safe address");
        gnosisSafe = _newGnosisSafe;
    }
    
    /**
     * @dev Update difficulty validation settings (Gnosis Safe only)
     * @param _strictDifficultyCheck Enable/disable strict difficulty validation
     * @param _maxBlockGap Maximum allowed block gap for validation
     */
    function updateDifficultySettings(bool _strictDifficultyCheck, uint256 _maxBlockGap) external onlyGnosisSafe {
        strictDifficultyCheck = _strictDifficultyCheck;
        maxBlockGap = _maxBlockGap;
    }
    
    /**
     * @dev Get header range for light client sync
     * @param _fromBlock Starting block number
     * @param _toBlock Ending block number
     * @return Array of block hashes
     */
    function getHeaderRange(uint256 _fromBlock, uint256 _toBlock) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        require(_fromBlock <= _toBlock, "Invalid range");
        require(_toBlock <= latestFinalizedBlock, "Block not finalized");
        
        uint256 length = _toBlock - _fromBlock + 1;
        bytes32[] memory hashes = new bytes32[](length);
        
        for (uint256 i = 0; i < length; i++) {
            hashes[i] = canonicalHeaders[_fromBlock + i];
        }
        
        return hashes;
    }
}