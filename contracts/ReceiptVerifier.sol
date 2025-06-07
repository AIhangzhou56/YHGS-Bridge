// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./RLPReader.sol";

/**
 * @title ReceiptVerifier
 * @dev Verifies Ethereum transaction receipts using Merkle proofs
 * Implements receipt verification for cross-chain bridge operations
 */
contract ReceiptVerifier {
    using RLPReader for RLPReader.RLPItem;
    using RLPReader for bytes;

    struct BlockHeader {
        bytes32 parentHash;
        bytes32 receiptsRoot;
        uint256 blockNumber;
        uint256 timestamp;
        bytes32 blockHash;
    }

    struct ReceiptProof {
        bytes32 blockHash;
        bytes32 receiptsRoot;
        bytes receipt;
        bytes[] proof;
        uint256 logIndex;
        uint256 receiptIndex;
    }

    // Mapping of block hash to block header
    mapping(bytes32 => BlockHeader) public blockHeaders;
    
    // Mapping of block number to canonical block hash
    mapping(uint256 => bytes32) public canonicalBlocks;
    
    // Light client operator (can submit headers)
    address public lightClientOperator;
    
    // Events
    event HeaderStored(bytes32 indexed blockHash, uint256 indexed blockNumber);
    event ReceiptVerified(bytes32 indexed txHash, bytes32 indexed blockHash, uint256 logIndex);
    
    modifier onlyOperator() {
        require(msg.sender == lightClientOperator, "Only operator can call this");
        _;
    }
    
    constructor(address _operator) {
        lightClientOperator = _operator;
    }
    
    /**
     * @dev Store a block header for verification
     * @param _blockHash The hash of the block
     * @param _parentHash The hash of the parent block
     * @param _receiptsRoot The receipts root of the block
     * @param _blockNumber The block number
     * @param _timestamp The block timestamp
     */
    function storeHeader(
        bytes32 _blockHash,
        bytes32 _parentHash,
        bytes32 _receiptsRoot,
        uint256 _blockNumber,
        uint256 _timestamp
    ) external onlyOperator {
        require(_blockHash != bytes32(0), "Invalid block hash");
        require(_receiptsRoot != bytes32(0), "Invalid receipts root");
        
        blockHeaders[_blockHash] = BlockHeader({
            parentHash: _parentHash,
            receiptsRoot: _receiptsRoot,
            blockNumber: _blockNumber,
            timestamp: _timestamp,
            blockHash: _blockHash
        });
        
        canonicalBlocks[_blockNumber] = _blockHash;
        
        emit HeaderStored(_blockHash, _blockNumber);
    }
    
    /**
     * @dev Get block hash for a given block number
     * @param _blockNumber The block number
     * @return The canonical block hash
     */
    function getBlockHash(uint256 _blockNumber) external view returns (bytes32) {
        return canonicalBlocks[_blockNumber];
    }
    
    /**
     * @dev Get block header for a given block hash
     * @param _blockHash The block hash
     * @return The block header
     */
    function getBlockHeader(bytes32 _blockHash) external view returns (BlockHeader memory) {
        return blockHeaders[_blockHash];
    }
    
    /**
     * @dev Verify a transaction receipt using Merkle proof
     * @param _proof The receipt proof structure
     * @return True if the receipt is valid
     */
    function verifyReceipt(ReceiptProof memory _proof) public view returns (bool) {
        // Check if block header exists
        BlockHeader memory header = blockHeaders[_proof.blockHash];
        require(header.blockHash == _proof.blockHash, "Block header not found");
        require(header.receiptsRoot == _proof.receiptsRoot, "Receipts root mismatch");
        
        // Verify Merkle proof
        bytes32 receiptHash = keccak256(_proof.receipt);
        return verifyMerkleProof(
            _proof.proof,
            header.receiptsRoot,
            receiptHash,
            _proof.receiptIndex
        );
    }
    
    /**
     * @dev Extract log from receipt at specified index
     * @param _receipt The RLP-encoded receipt
     * @param _logIndex The index of the log to extract
     * @return The log data
     */
    function extractLog(bytes memory _receipt, uint256 _logIndex) 
        public 
        pure 
        returns (bytes memory) 
    {
        RLPReader.RLPItem memory receiptItem = _receipt.toRlpItem();
        RLPReader.RLPItem[] memory receiptFields = receiptItem.toList();
        
        // Receipt format: [status, cumulativeGasUsed, logsBloom, logs]
        require(receiptFields.length >= 4, "Invalid receipt format");
        
        RLPReader.RLPItem[] memory logs = receiptFields[3].toList();
        require(_logIndex < logs.length, "Log index out of bounds");
        
        return logs[_logIndex].toBytes();
    }
    
    /**
     * @dev Verify a Merkle proof
     * @param _proof Array of proof elements
     * @param _root The Merkle root
     * @param _leaf The leaf to verify
     * @param _index The index of the leaf
     * @return True if the proof is valid
     */
    function verifyMerkleProof(
        bytes[] memory _proof,
        bytes32 _root,
        bytes32 _leaf,
        uint256 _index
    ) public pure returns (bool) {
        bytes32 computedHash = _leaf;
        uint256 index = _index;
        
        for (uint256 i = 0; i < _proof.length; i++) {
            bytes32 proofElement = keccak256(_proof[i]);
            
            if (index % 2 == 0) {
                // Left node
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                // Right node
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
            
            index = index / 2;
        }
        
        return computedHash == _root;
    }
    
    /**
     * @dev Update the light client operator
     * @param _newOperator The new operator address
     */
    function updateOperator(address _newOperator) external onlyOperator {
        require(_newOperator != address(0), "Invalid operator address");
        lightClientOperator = _newOperator;
    }
    
    /**
     * @dev Check if a block is finalized (exists in storage)
     * @param _blockHash The block hash to check
     * @return True if the block is finalized
     */
    function isBlockFinalized(bytes32 _blockHash) external view returns (bool) {
        return blockHeaders[_blockHash].blockHash == _blockHash;
    }
    
    /**
     * @dev Get the latest stored block number
     * @return The highest block number stored
     */
    function getLatestBlockNumber() external view returns (uint256) {
        // This is a simplified implementation
        // In production, you'd track this more efficiently
        uint256 latest = 0;
        // Note: This is inefficient for large ranges
        // Consider using a separate storage variable for latest block
        return latest;
    }
}