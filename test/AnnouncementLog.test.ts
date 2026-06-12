import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { keccak256, toHex } from "viem";

describe("AnnouncementLog", () => {
  async function deployFixture() {
    const [admin, professor, student] = await hre.viem.getWalletClients();
    const roleManager = await hre.viem.deployContract("RoleManager", [
      admin.account.address,
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

    return { roleManager, announcementLog, admin, professor, student, PROFESSOR_ROLE };
  }

  it("professor can publish an announcement", async () => {
    const { announcementLog, professor } = await loadFixture(deployFixture);
    const content = "Exam on 2025-03-15 at 10:00";
    const hash = keccak256(toHex(content));
    await expect(
      announcementLog.write.publish([hash, "exam", "MF1", content], {
        account: professor.account,
      })
    ).to.be.fulfilled;
  });

  it("student cannot publish an announcement", async () => {
    const { announcementLog, student } = await loadFixture(deployFixture);
    const hash = keccak256(toHex("content"));
    await expect(
      announcementLog.write.publish([hash, "exam", "MF1", "content"], {
        account: student.account,
      })
    ).to.be.rejectedWith("Not a professor");
  });

  it("verify returns true for correct hash", async () => {
    const { announcementLog, professor } = await loadFixture(deployFixture);
    const content = "Exam on 2025-03-15";
    const hash = keccak256(toHex(content));
    await announcementLog.write.publish([hash, "exam", "MF1", content], {
      account: professor.account,
    });
    const ok = await announcementLog.read.verify([1n, hash]);
    expect(ok).to.be.true;
  });

  it("verify returns false for tampered hash", async () => {
    const { announcementLog, professor } = await loadFixture(deployFixture);
    const content = "Exam on 2025-03-15";
    const hash = keccak256(toHex(content));
    await announcementLog.write.publish([hash, "exam", "MF1", content], {
      account: professor.account,
    });
    const tamperedHash = keccak256(toHex("Exam on 2025-04-01 (tampered)"));
    const ok = await announcementLog.read.verify([1n, tamperedHash]);
    expect(ok).to.be.false;
  });

  it("getAnnouncements filters by group — same group", async () => {
    const { announcementLog, professor } = await loadFixture(deployFixture);
    const hash = keccak256(toHex("content"));
    await announcementLog.write.publish([hash, "exam", "MF1", "content"], {
      account: professor.account,
    });
    await announcementLog.write.publish([hash, "hw", "MF2", "content2"], {
      account: professor.account,
    });
    const results = await announcementLog.read.getAnnouncements(["MF1"]);
    expect(results.length).to.equal(1);
    expect(results[0].targetGroup).to.equal("MF1");
  });

  it("getAnnouncements includes 'all' group announcements", async () => {
    const { announcementLog, professor } = await loadFixture(deployFixture);
    const hash = keccak256(toHex("content"));
    await announcementLog.write.publish([hash, "info", "all", "global"], {
      account: professor.account,
    });
    await announcementLog.write.publish([hash, "exam", "MF1", "mf1 only"], {
      account: professor.account,
    });
    const results = await announcementLog.read.getAnnouncements(["MF1"]);
    expect(results.length).to.equal(2);
  });

  it("announcement ID increments correctly", async () => {
    const { announcementLog, professor } = await loadFixture(deployFixture);
    const hash = keccak256(toHex("content"));
    await announcementLog.write.publish([hash, "exam", "MF1", "c1"], {
      account: professor.account,
    });
    await announcementLog.write.publish([hash, "hw", "MF1", "c2"], {
      account: professor.account,
    });
    const total = await announcementLog.read.totalAnnouncements();
    expect(total).to.equal(2n);
  });
});
