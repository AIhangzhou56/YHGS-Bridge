// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IValidatorManager.sol";

/**
 * @title BLSSignatureLib
 * @notice Library for BLS signature verification using bn256 precompiles
 * @dev Based on witnet/bls-solidity with optimizations for gas efficiency
 */
library BLSSignatureLib {
    // BN256 precompile addresses
    address constant BN256_ADD = address(0x06);
    address constant BN256_SCALAR_MUL = address(0x07);
    address constant BN256_PAIRING = address(0x08);
    
    // Generator points for BN256 G1 and G2
    uint256 constant G1_X = 1;
    uint256 constant G1_Y = 2;
    uint256 constant G2_XX = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant G2_XY = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant G2_YX = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant G2_YY = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    
    struct G1Point {
        uint256 x;
        uint256 y;
    }
    
    struct G2Point {
        uint256[2] x;
        uint256[2] y;
    }
    
    /**
     * @notice Verify aggregated BLS signature
     * @param message Message hash that was signed
     * @param aggSignature Aggregated BLS signature
     * @param signerPubKeys Public keys that participated
     * @param validatorManager Address of validator manager contract
     * @return valid True if signature is valid
     */
    function verifyAggregated(
        bytes32 message,
        bytes memory aggSignature,
        bytes32[] memory signerPubKeys,
        address validatorManager
    ) internal view returns (bool) {
        require(aggSignature.length == 64, "Invalid signature length");
        require(signerPubKeys.length > 0, "No signers");
        
        // Decode aggregated signature
        G1Point memory sig = G1Point({
            x: uint256(bytes32(aggSignature[:32])),
            y: uint256(bytes32(aggSignature[32:64]))
        });
        
        // Aggregate public keys
        G2Point memory aggregatedPubKey = _aggregatePubKeys(
            signerPubKeys,
            validatorManager
        );
        
        // Hash message to curve point
        G1Point memory messagePoint = _hashToG1(message);
        
        // Verify pairing
        return _verifyPairing(sig, aggregatedPubKey, messagePoint);
    }
    
    /**
     * @notice Aggregate validator public keys
     * @param signerPubKeys Public key identifiers
     * @param validatorManager Validator manager contract
     * @return aggregated Aggregated public key in G2
     */
    function _aggregatePubKeys(
        bytes32[] memory signerPubKeys,
        address validatorManager
    ) private view returns (G2Point memory) {
        IValidatorManager vm = IValidatorManager(validatorManager);
        
        // Initialize with first pubkey
        bytes memory firstPubKey = vm.getValidatorPubKey(
            address(uint160(uint256(signerPubKeys[0])))
        );
        G2Point memory aggregated = _decodeG2Point(firstPubKey);
        
        // Add remaining pubkeys
        for (uint256 i = 1; i < signerPubKeys.length; i++) {
            address validator = address(uint160(uint256(signerPubKeys[i])));
            require(vm.isActiveValidator(validator), "Inactive validator");
            
            bytes memory pubKey = vm.getValidatorPubKey(validator);
            G2Point memory point = _decodeG2Point(pubKey);
            aggregated = _addG2(aggregated, point);
        }
        
        return aggregated;
    }
    
    /**
     * @notice Hash message to G1 curve point
     * @param message Message to hash
     * @return point Point on G1 curve
     */
    function _hashToG1(bytes32 message) private pure returns (G1Point memory) {
        // Simplified hash-to-curve for demo
        // In production, use proper hash-to-curve algorithm
        uint256 x = uint256(keccak256(abi.encodePacked(message, uint256(0))));
        uint256 y = uint256(keccak256(abi.encodePacked(message, uint256(1))));
        
        // Ensure point is on curve (simplified)
        return G1Point(x % FIELD_MODULUS, y % FIELD_MODULUS);
    }
    
    /**
     * @notice Verify BLS signature using pairing check
     * @param signature Signature in G1
     * @param pubKey Public key in G2
     * @param message Message point in G1
     * @return valid True if pairing check passes
     */
    function _verifyPairing(
        G1Point memory signature,
        G2Point memory pubKey,
        G1Point memory message
    ) private view returns (bool) {
        // e(sig, G2) = e(H(m), pubKey)
        // Rearranged: e(sig, G2) * e(-H(m), pubKey) = 1
        
        G1Point memory negMessage = G1Point(message.x, FIELD_MODULUS - message.y);
        
        // Prepare pairing inputs
        uint256[12] memory input;
        
        // First pairing: e(sig, G2)
        input[0] = signature.x;
        input[1] = signature.y;
        input[2] = G2_XX;
        input[3] = G2_XY;
        input[4] = G2_YX;
        input[5] = G2_YY;
        
        // Second pairing: e(-H(m), pubKey)
        input[6] = negMessage.x;
        input[7] = negMessage.y;
        input[8] = pubKey.x[0];
        input[9] = pubKey.x[1];
        input[10] = pubKey.y[0];
        input[11] = pubKey.y[1];
        
        uint256[1] memory result;
        bool success;
        
        assembly {
            success := staticcall(gas(), BN256_PAIRING, input, 0x180, result, 0x20)
        }
        
        require(success, "Pairing check failed");
        return result[0] == 1;
    }
    
    /**
     * @notice Add two G2 points
     * @param p1 First point
     * @param p2 Second point
     * @return result Sum of points
     */
    function _addG2(
        G2Point memory p1,
        G2Point memory p2
    ) private pure returns (G2Point memory) {
        // G2 addition is done component-wise in the field
        // This is simplified - real implementation needs field arithmetic
        return G2Point({
            x: [
                addmod(p1.x[0], p2.x[0], FIELD_MODULUS),
                addmod(p1.x[1], p2.x[1], FIELD_MODULUS)
            ],
            y: [
                addmod(p1.y[0], p2.y[0], FIELD_MODULUS),
                addmod(p1.y[1], p2.y[1], FIELD_MODULUS)
            ]
        });
    }
    
    /**
     * @notice Decode G2 point from bytes
     * @param data Encoded point (128 bytes)
     * @return point Decoded G2 point
     */
    function _decodeG2Point(bytes memory data) 
        private 
        pure 
        returns (G2Point memory) 
    {
        require(data.length == 128, "Invalid G2 point length");
        
        G2Point memory point;
        
        assembly {
            mstore(point, mload(add(data, 0x20)))           // x[0]
            mstore(add(point, 0x20), mload(add(data, 0x40))) // x[1]
            mstore(add(point, 0x40), mload(add(data, 0x60))) // y[0]
            mstore(add(point, 0x60), mload(add(data, 0x80))) // y[1]
        }
        
        return point;
    }
    
    // Field modulus for BN256
    uint256 constant FIELD_MODULUS = 21888242871839275222246405745257275088696311157297823662689037894645226208583;
}

/**
 * @title Constants
 * @notice Shared constants for YHGS Bridge system
 */
library Constants {
    // Roles
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    
    // Chain IDs
    uint256 public constant ETHEREUM_CHAIN_ID = 1;
    uint256 public constant BSC_CHAIN_ID = 56;
    uint256 public constant POLYGON_CHAIN_ID = 137;
    uint256 public constant ARBITRUM_CHAIN_ID = 42161;
    uint256 public constant OPTIMISM_CHAIN_ID = 10;
    
    // Limits
    uint256 public constant MAX_BATCH_SIZE = 100;
    uint256 public constant MAX_FEE_BPS = 1000; // 10%
    uint256 public constant HIGH_VALUE_THRESHOLD = 100_000 * 1e18; // $100k
    
    // Timeouts
    uint256 public constant MESSAGE_EXPIRY = 24 hours;
    uint256 public constant RATE_LIMIT_WINDOW = 1 hours;
    uint256 public constant CIRCUIT_BREAKER_COOLDOWN = 1 hours;
}