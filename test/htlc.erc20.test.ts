import { ethers } from "hardhat";
import { htlcERC20ArrayToObj, newSecretHashPair, nowSeconds } from "./utils";
import { AliceERC20, BobERC20, HashedTimelockERC20 } from "../typechain-types";
import { BytesLike } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";

describe("HashedTimeLockERC20Contract", () => {
  let deployer: HardhatEthersSigner,
    Alice: HardhatEthersSigner,
    Bob: HardhatEthersSigner;

  const tokenSupply = 1000;
  const senderInitialBalance = 100;

  const tokenAmount = 5;

  let htlc: HashedTimelockERC20;
  let AliceERC20: AliceERC20;
  let BobERC20: BobERC20;
  let hashPair: { hash: string; secret: string };
  let a2bSwapId: BytesLike;
  let b2aSwapId: BytesLike;

  let learnedSecret: BytesLike;

  const iface = new ethers.Interface(
    require("../artifacts/contracts/HashedTimelockERC20.sol/HashedTimelockERC20.json").abi
  );

  before(async () => {
    [deployer, Alice, Bob] = await ethers.getSigners();
    htlc = await ethers.deployContract("HashedTimelockERC20", deployer);

    const AliceERC20Factory = await ethers.getContractFactory("AliceERC20");
    AliceERC20 = await AliceERC20Factory.deploy(tokenSupply);
    const BobERC20Factory = await ethers.getContractFactory("BobERC20");
    BobERC20 = await BobERC20Factory.deploy(tokenSupply);

    await AliceERC20.connect(deployer).transfer(Alice, senderInitialBalance);
    await BobERC20.connect(deployer).transfer(Bob, senderInitialBalance);

    hashPair = newSecretHashPair();
  });

  describe("Step 1. Alice sets up a swap with Bob in the AliceERC20 contract", () => {
    it("1-1 Alice approve her token to htlcERC20 contract", async () => {
      await AliceERC20.connect(Alice).approve(htlc.getAddress(), tokenAmount);
    });
    it("1-2 Alice make swap contract in htlcERC20 with secret", async () => {
      const timeLock20Seconds = nowSeconds() + 20;
      const tx = await htlc.connect(Alice).newContract(
        Bob, // counterparty (receiver)
        hashPair.hash, // hash lock
        timeLock20Seconds, // time lock
        AliceERC20.getAddress(), // Alice's token Contract
        tokenAmount // token amount to swap
      );
      const logArgs = await tx.wait().then(
        (recipet) =>
          iface.parseLog({
            topics: recipet?.logs[1].topics as string[],
            data: recipet?.logs[1].data!,
          })?.args
      );

      a2bSwapId = logArgs?.contractId;
    });
  });

  describe("Step 2: Bob sets up a swap with Alice in the BobERC20 contract", () => {
    it("2-1 Bot approve his token to htlcERC20 contract", async () => {
      await BobERC20.connect(Bob).approve(htlc.getAddress(), tokenAmount);
    });
    it("2-2 Bob make swap contract in htlcERC20 with hashloc", async () => {
      const timeLock10Seconds = nowSeconds() + 10; // make shorter than Alice's swap contract
      const tx = await htlc.connect(Bob).newContract(
        Alice, // counterparty (receiver)
        hashPair.hash, // hash lock
        timeLock10Seconds, // time lock
        BobERC20.getAddress(), // Alice's token Contract
        tokenAmount // token amount to swap
      );

      const logArgs = await tx.wait().then(
        (recipet) =>
          iface.parseLog({
            topics: recipet?.logs[1].topics as string[],
            data: recipet?.logs[1].data!,
          })?.args
      );
      b2aSwapId = logArgs?.contractId;
    });
  });

  describe("Step 3: Alice as the initiator withdraws from the BobERC20 with the secret", () => {
    it("3-1 Alice withdraw bob's token in 10 second", async () => {
      await htlc.connect(Alice).withdraw(b2aSwapId, hashPair.secret);

      const contractArr = await htlc.getContract(b2aSwapId);
      const contract = htlcERC20ArrayToObj(contractArr);

      expect(BigInt(tokenAmount)).equal(await BobERC20.balanceOf(Alice));
      expect(contract.withdrawn).to.be.true;
      expect(contract.refunded).to.be.false;
      expect(contract.preimage).equal(hashPair.secret);

      learnedSecret = contract.preimage;
    });
  });

  describe("Step 4: Bob as the counterparty withdraws from the AliceERC20 with the secret learned from Alice's withdrawal", () => {
    it("4-1 Bob withdraw alice's token in 20 second", async () => {
      await htlc.connect(Bob).withdraw(a2bSwapId, learnedSecret);

      const contractArr = await htlc.getContract(a2bSwapId);
      const contract = htlcERC20ArrayToObj(contractArr);

      expect(BigInt(tokenAmount)).equal(await AliceERC20.balanceOf(Bob));
      expect(contract.withdrawn).to.be.true;
      expect(contract.refunded).to.be.false;
      expect(contract.preimage).equal(learnedSecret);
    });
  });
});
