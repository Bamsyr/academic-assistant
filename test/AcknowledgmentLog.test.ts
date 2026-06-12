import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { keccak256, toHex } from "viem";

describe("AcknowledgmentLog", () => {
  async function deployFixture() {
    const [admin, professor, student, student2] = await hre.viem.getWalletClients();
    const roleManager = await hre.viem.deployContract("RoleManager", [
      admin.account.address,
    ]);
    const acknowledgmentLog = await hre.viem.deployContract("AcknowledgmentLog", [
      roleManager.address,
    ]);
    const announcementLog = await hre.viem.deployContract("AnnouncementLog", [
      roleManager.address,
    ]);

    const PROFESSOR_ROLE = keccak256(toHex("PROFESSOR_ROLE"));
    const STUDENT_ROLE   = keccak256(toHex("STUDENT_ROLE"));
    await roleManager.write.assignRole([professor.account.address, PROFESSOR_ROLE], {
      account: admin.account,
    });
    await roleManager.write.assignRole([student.account.address, STUDENT_ROLE], {
      account: admin.account,
    });
    await roleManager.write.assignRole([student2.account.address, STUDENT_ROLE], {
      account: admin.account,
    });

    // Publish one announcement to have a valid ID
    const hash = keccak256(toHex("exam announcement"));
    await announcementLog.write.publish([hash, "exam", "MF1", "exam announcement"], {
      account: professor.account,
    });

    return { acknowledgmentLog, admin, professor, student, student2 };
  }

  it("student can acknowledge an announcement", async () => {
    const { acknowledgmentLog, student } = await loadFixture(deployFixture);
    await expect(
      acknowledgmentLog.write.acknowledge([1n], { account: student.account })
    ).to.be.fulfilled;
  });

  it("professor cannot acknowledge (not a student)", async () => {
    const { acknowledgmentLog, professor } = await loadFixture(deployFixture);
    await expect(
      acknowledgmentLog.write.acknowledge([1n], { account: professor.account })
    ).to.be.rejectedWith("Not a student");
  });

  it("student cannot acknowledge the same announcement twice", async () => {
    const { acknowledgmentLog, student } = await loadFixture(deployFixture);
    await acknowledgmentLog.write.acknowledge([1n], { account: student.account });
    await expect(
      acknowledgmentLog.write.acknowledge([1n], { account: student.account })
    ).to.be.rejectedWith("Already acknowledged");
  });

  it("hasAcknowledged returns true after acknowledgment", async () => {
    const { acknowledgmentLog, student } = await loadFixture(deployFixture);
    await acknowledgmentLog.write.acknowledge([1n], { account: student.account });
    const acked = await acknowledgmentLog.read.hasAcknowledged([1n, student.account.address]);
    expect(acked).to.be.true;
  });

  it("hasAcknowledged returns false before acknowledgment", async () => {
    const { acknowledgmentLog, student } = await loadFixture(deployFixture);
    const acked = await acknowledgmentLog.read.hasAcknowledged([1n, student.account.address]);
    expect(acked).to.be.false;
  });

  it("getAcknowledgments returns all acknowledgers", async () => {
    const { acknowledgmentLog, student, student2 } = await loadFixture(deployFixture);
    await acknowledgmentLog.write.acknowledge([1n], { account: student.account });
    await acknowledgmentLog.write.acknowledge([1n], { account: student2.account });
    const acks = await acknowledgmentLog.read.getAcknowledgments([1n]);
    expect(acks.length).to.equal(2);
    expect(acks.map((a) => a.toLowerCase())).to.include(student.account.address.toLowerCase());
    expect(acks.map((a) => a.toLowerCase())).to.include(student2.account.address.toLowerCase());
  });

  it("acknowledgment count is tracked correctly", async () => {
    const { acknowledgmentLog, student, student2 } = await loadFixture(deployFixture);
    expect(await acknowledgmentLog.read.getAcknowledgmentCount([1n])).to.equal(0n);
    await acknowledgmentLog.write.acknowledge([1n], { account: student.account });
    expect(await acknowledgmentLog.read.getAcknowledgmentCount([1n])).to.equal(1n);
    await acknowledgmentLog.write.acknowledge([1n], { account: student2.account });
    expect(await acknowledgmentLog.read.getAcknowledgmentCount([1n])).to.equal(2n);
  });
});
