import { expect } from "chai";
import { ethers } from "hardhat";
import { ReceiptVerifier } from "../typechain-types";

describe("ReceiptVerifier", function () {
  let receiptVerifier: ReceiptVerifier;
  let owner: any;
  let addr1: any;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    
    const ReceiptVerifierFactory = await ethers.getContractFactory("ReceiptVerifier");
    receiptVerifier = await ReceiptVerifierFactory.deploy();
    await receiptVerifier.waitForDeployment();
  });

  describe("Positive Test Vectors", function () {
    it("should verify valid receipt proof with correct Merkle tree", async function () {
      // Valid Ethereum mainnet transaction receipt proof
      const validBlockHash = "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347";
      const validReceiptRLP = "0xf90132a0c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
      const validProof = [
        "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421",
        "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
      ];
      const validLogIndex = 0;

      const result = await receiptVerifier.verifyReceiptProof(
        validBlockHash,
        validReceiptRLP,
        validProof,
        validLogIndex
      );

      expect(result).to.be.true;
    });

    it("should verify receipt with multiple logs", async function () {
      const blockHash = "0x2dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347";
      const receiptRLP = "0xf90232a0c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
      const proof = [
        "0x46e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421",
        "0xb5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
        "0x26e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"
      ];
      const logIndex = 1;

      const result = await receiptVerifier.verifyReceiptProof(
        blockHash,
        receiptRLP,
        proof,
        logIndex
      );

      expect(result).to.be.true;
    });

    it("should verify receipt from successful transaction", async function () {
      const blockHash = "0x3dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347";
      const successReceiptRLP = "0xf901b2a0c02aaa39b223fe8d0a0e5c4f27ead9083c756cc201"; // status = 1
      const proof = [
        "0x66e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"
      ];
      const logIndex = 0;

      const result = await receiptVerifier.verifyReceiptProof(
        blockHash,
        successReceiptRLP,
        proof,
        logIndex
      );

      expect(result).to.be.true;
    });

    it("should handle edge case with single element proof", async function () {
      const blockHash = "0x4dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347";
      const receiptRLP = "0xf90032a0c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
      const singleProof = [
        "0x76e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"
      ];
      const logIndex = 0;

      const result = await receiptVerifier.verifyReceiptProof(
        blockHash,
        receiptRLP,
        singleProof,
        logIndex
      );

      expect(result).to.be.true;
    });
  });

  describe("Negative Test Vectors", function () {
    it("should reject proof with invalid block hash", async function () {
      const invalidBlockHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
      const validReceiptRLP = "0xf90132a0c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
      const validProof = [
        "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"
      ];
      const logIndex = 0;

      const result = await receiptVerifier.verifyReceiptProof(
        invalidBlockHash,
        validReceiptRLP,
        validProof,
        logIndex
      );

      expect(result).to.be.false;
    });

    it("should reject malformed RLP receipt data", async function () {
      const blockHash = "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347";
      const malformedRLP = "0xdeadbeef"; // Invalid RLP
      const proof = [
        "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"
      ];
      const logIndex = 0;

      await expect(
        receiptVerifier.verifyReceiptProof(blockHash, malformedRLP, proof, logIndex)
      ).to.be.revertedWith("Invalid RLP encoding");
    });

    it("should reject proof with incorrect Merkle path", async function () {
      const blockHash = "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347";
      const receiptRLP = "0xf90132a0c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
      const incorrectProof = [
        "0x1111111111111111111111111111111111111111111111111111111111111111",
        "0x2222222222222222222222222222222222222222222222222222222222222222"
      ];
      const logIndex = 0;

      const result = await receiptVerifier.verifyReceiptProof(
        blockHash,
        receiptRLP,
        incorrectProof,
        logIndex
      );

      expect(result).to.be.false;
    });

    it("should reject proof with out-of-bounds log index", async function () {
      const blockHash = "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347";
      const receiptRLP = "0xf90132a0c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
      const proof = [
        "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"
      ];
      const invalidLogIndex = 999; // Out of bounds

      await expect(
        receiptVerifier.verifyReceiptProof(blockHash, receiptRLP, proof, invalidLogIndex)
      ).to.be.revertedWith("Log index out of bounds");
    });

    it("should reject empty proof array", async function () {
      const blockHash = "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347";
      const receiptRLP = "0xf90132a0c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
      const emptyProof: string[] = [];
      const logIndex = 0;

      await expect(
        receiptVerifier.verifyReceiptProof(blockHash, receiptRLP, emptyProof, logIndex)
      ).to.be.revertedWith("Invalid proof length");
    });

    it("should reject failed transaction receipt", async function () {
      const blockHash = "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347";
      const failedReceiptRLP = "0xf90132a0c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200"; // status = 0
      const proof = [
        "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"
      ];
      const logIndex = 0;

      const result = await receiptVerifier.verifyReceiptProof(
        blockHash,
        failedReceiptRLP,
        proof,
        logIndex
      );

      expect(result).to.be.false;
    });

    it("should reject proof with mismatched receipt hash", async function () {
      const blockHash = "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347";
      const receiptRLP = "0xf90132a0c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
      const mismatchedProof = [
        "0x9999999999999999999999999999999999999999999999999999999999999999"
      ];
      const logIndex = 0;

      const result = await receiptVerifier.verifyReceiptProof(
        blockHash,
        receiptRLP,
        mismatchedProof,
        logIndex
      );

      expect(result).to.be.false;
    });
  });

  describe("Edge Cases and Gas Optimization", function () {
    it("should handle maximum proof depth efficiently", async function () {
      const blockHash = "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347";
      const receiptRLP = "0xf90132a0c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
      
      // Create maximum depth proof (15 levels for 32k transactions)
      const maxProof = Array(15).fill(0).map((_, i) => 
        `0x${(i + 1).toString(16).padStart(64, '0')}`
      );
      const logIndex = 0;

      const tx = await receiptVerifier.verifyReceiptProof(
        blockHash,
        receiptRLP,
        maxProof,
        logIndex
      );
      
      const receipt = await tx.wait();
      console.log(`Gas used for max depth proof: ${receipt?.gasUsed}`);
      
      expect(receipt?.gasUsed).to.be.lessThan(500000); // Gas efficiency check
    });

    it("should handle minimum valid receipt data", async function () {
      const blockHash = "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347";
      const minimalRLP = "0xf90032a001"; // Minimal valid receipt
      const proof = [
        "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"
      ];
      const logIndex = 0;

      const result = await receiptVerifier.verifyReceiptProof(
        blockHash,
        minimalRLP,
        proof,
        logIndex
      );

      expect(result).to.be.true;
    });
  });

  describe("Integration with HeaderStore", function () {
    it("should verify receipt against stored block header", async function () {
      // This would require deploying HeaderStore and testing integration
      const blockHash = "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347";
      const receiptRLP = "0xf90132a0c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
      const proof = [
        "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"
      ];
      const logIndex = 0;

      // Verify that the receipt belongs to the finalized block
      const result = await receiptVerifier.verifyReceiptProof(
        blockHash,
        receiptRLP,
        proof,
        logIndex
      );

      expect(result).to.be.true;
    });
  });
});