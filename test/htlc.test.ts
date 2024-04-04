import { ethers } from "hardhat";
import {
  newSecretHashPair,
  nowSeconds,
  hourSeconds,
  isSha256Hash,
  htlcArrayToObj,
  sleep,
} from "./utils";
import { expect } from "chai";

describe("HashedTimeLock Contract", () => {
  const iface = new ethers.Interface(
    require("../artifacts/contracts/HashedTimelock.sol/HashedTimelock.json").abi
  );
  describe(".newContract", () => {
    it("should make contract", async () => {
      const [deployer, sender, receiver] = await ethers.getSigners();

      const hashPair = newSecretHashPair();
      const timeLock1Hour = nowSeconds() + hourSeconds;
      const value = ethers.parseEther("1");
      // deploy contract
      const htlc = await ethers.deployContract("HashedTimelock", deployer);

      // call newContract
      // sender lock his value of ether
      const tx = await htlc
        .connect(sender)
        .newContract(receiver, hashPair.hash, timeLock1Hour, {
          from: sender,
          value: value,
        });

      const logArgs = await tx.wait().then(
        (recipet) =>
          iface.parseLog({
            topics: recipet?.logs[0].topics as string[],
            data: recipet?.logs[0].data!,
          })?.args
      );

      const contractId = logArgs?.contractId;

      expect(isSha256Hash(contractId)).to.be.true;

      expect(logArgs?.sender).equal(sender);
      expect(logArgs?.receiver).equal(receiver);
      expect(logArgs?.amount).equal(value);
      expect(logArgs?.hashlock).equal(hashPair.hash);
      expect(logArgs?.timelock).equal(timeLock1Hour);

      const contractArr = await htlc.getContract(contractId);
      const contract = htlcArrayToObj(contractArr);

      expect(contract.sender).equal(sender);
      expect(contract.receiver).equal(receiver);
      expect(contract.amount).equal(value);
      expect(contract.hashlock).equal(hashPair.hash);
      expect(contract.timelock).equal(timeLock1Hour);
      expect(contract.withdrawn).to.be.false;
      expect(contract.refunded).to.be.false;
      expect(contract.preimage).equal(
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      );
    });
    it("newContract() should fail when no ETH sent");
    it("newContract() should fail with timelocks in the past");
    it("newContract() should reject a duplicate contract request");
  });
  describe(".withdraw", () => {
    it("should withdraw sender balance", async () => {
      const [deployer, sender, receiver] = await ethers.getSigners();

      const hashPair = newSecretHashPair();
      const timeLock1Hour = nowSeconds() + hourSeconds;
      const value = ethers.parseEther("1");
      // deploy contract
      const htlc = await ethers.deployContract("HashedTimelock", deployer);

      // sender lock his value of ether
      const tx_lock = await htlc
        .connect(sender)
        .newContract(receiver, hashPair.hash, timeLock1Hour, {
          from: sender,
          value: value,
        });

      const logArgs = await tx_lock.wait().then(
        (recipet) =>
          iface.parseLog({
            topics: recipet?.logs[0].topics as string[],
            data: recipet?.logs[0].data!,
          })?.args
      );

      const contractId = logArgs?.contractId;

      const receiverBalBefore = await ethers.provider.getBalance(receiver);

      // receiver calls withdraw with the secret to get the funds
      const withdrawTx = await htlc
        .connect(receiver)
        .withdraw(contractId, hashPair.secret, {
          from: receiver,
        });
      const tx_withdraw = await withdrawTx.wait();

      // Check contract funds are now at the receiver address
      const expectedBal =
        receiverBalBefore +
        value -
        tx_withdraw?.gasPrice! * tx_withdraw?.gasUsed!;

      expect(expectedBal).to.equal(await ethers.provider.getBalance(receiver));

      const contractArr = await htlc.getContract(contractId);
      const contract = htlcArrayToObj(contractArr);
      expect(contract.withdrawn).to.be.true; // withdrawn set
      expect(contract.refunded).to.be.false; // refunded still false
      expect(contract.preimage).equal(hashPair.secret);
    });
    it("withdraw() should fail if preimage does not hash to hashX");
    it("withdraw() should fail if caller is not the receiver");
    it("withdraw() should fail after timelock expiry");
  });
  describe(".refund", () => {
    // it("should refund after expiry", async () => {
    //   const [deployer, sender, receiver] = await ethers.getSigners();

    //   const hashPair = newSecretHashPair();
    //   const timeLock1Second = Math.floor(Date.now() / 1000) + 15;
    //   const value = ethers.parseEther("1");
    //   // deploy contract
    //   const htlc = await ethers.deployContract("HashedTimelock", deployer);

    //   // sender lock his value of ether
    //   const tx_lock = await htlc
    //     .connect(sender)
    //     .newContract(receiver, hashPair.hash, timeLock1Second, {
    //       from: sender,
    //       value: value,
    //     });

    //   const logArgs = await tx_lock.wait().then(
    //     (recipet) =>
    //       iface.parseLog({
    //         topics: recipet?.logs[0].topics as string[],
    //         data: recipet?.logs[0].data!,
    //       })?.args
    //   );

    //   const contractId = logArgs?.contractId;

    //   const balBefore = await ethers.provider.getBalance(sender);

    //   await sleep(3000);
    //   const refundTx = await htlc
    //     .connect(sender)
    //     .refund(contractId, { from: sender });
    //   const tx = await refundTx.wait();

    //   // Check contract funds are now at the senders address
    //   const expectedBal = balBefore + value - tx?.gasUsed! * tx?.gasPrice!;

    //   expect(expectedBal).equal(
    //     await ethers.provider.getBalance(sender),
    //     "sender balance doesn't match"
    //   );
    //   const contract = await htlc.getContract(contractId);
    //   expect(contract[6]).to.be.true; // refunded set
    //   expect(contract[5]).to.be.false; // withdrawn still false

    //   // wait one second so we move past the timelock time
    // });
    it("refund() should fail before the timelock expiry");
  });
});
