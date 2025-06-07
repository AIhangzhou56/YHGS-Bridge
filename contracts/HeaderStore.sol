// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title HeaderStore
 * @dev Stores Ethereum block headers with BLS signature verification placeholder
 * Implements light client functionality for cross-chain verification
 */
contract HeaderStore {
    struct BlockHeader {
        bytes32 parentHash;
        bytes32 receiptsRoot;
        bytes32 stateRoot;
        uint256 blockNumber;
        uint256 timestamp;
        bytes32 blockHash;
        bool verified;
    }

    struct BLSSignature {
        uint256[2] signature;
        uint256[4] pubkey;
        uint256[2] message;
    }

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
    
    // Events
    event HeaderSubmitted(bytes32 indexed blockHash, uint256 indexed blockNumber, address validator);
    event HeaderFinalized(bytes32 indexed blockHash, uint256 indexed blockNumber);
    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    
    modifier onlyValidator() {
        require(validators[msg.sender], "Only validators can submit headers");
        _;
    }
    
    constructor(address _blsVerifier, uint256 _requiredSignatures) {
        blsVerifier = _blsVerifier;
        requiredSignatures = _requiredSignatures;
    }
    
    /**
     * @dev Submit a block header with BLS signature
     * @param _blockHash The hash of the block
     * @param _parentHash The parent block hash
     * @param _receiptsRoot The receipts root
     * @param _stateRoot The state root
     * @param _blockNumber The block number
     * @param _timestamp The block timestamp
     * @param _signature BLS signature data
     */
    function submitHeader(
        bytes32 _blockHash,
        bytes32 _parentHash,
        bytes32 _receiptsRoot,
        bytes32 _stateRoot,
        uint256 _blockNumber,
        uint256 _timestamp,
        BLSSignature calldata _signature
    ) external onlyValidator {
        require(_blockHash != bytes32(0), "Invalid block hash");
        require(_blockNumber > latestFinalizedBlock, "Block too old");
        
        // Verify BLS signature (placeholder implementation)
        require(verifyBLSSignature(_blockHash, _signature), "Invalid BLS signature");
        
        // Store header
        headers[_blockHash] = BlockHeader({
            parentHash: _parentHash,
            receiptsRoot: _receiptsRoot,
            stateRoot: _stateRoot,
            blockNumber: _blockNumber,
            timestamp: _timestamp,
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
     * @dev Add a validator to the committee
     * @param _validator The validator address
     */
    function addValidator(address _validator) external {
        require(!validators[_validator], "Validator already exists");
        validators[_validator] = true;
        validatorCount++;
        emit ValidatorAdded(_validator);
    }
    
    /**
     * @dev Remove a validator from the committee
     * @param _validator The validator address
     */
    function removeValidator(address _validator) external {
        require(validators[_validator], "Validator does not exist");
        validators[_validator] = false;
        validatorCount--;
        emit ValidatorRemoved(_validator);
    }
    
    /**
     * @dev Update required signature threshold
     * @param _requiredSignatures New threshold
     */
    function updateRequiredSignatures(uint256 _requiredSignatures) external {
        require(_requiredSignatures <= validatorCount, "Threshold too high");
        requiredSignatures = _requiredSignatures;
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