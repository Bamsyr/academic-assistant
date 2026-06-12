import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { keccak256, toHex } from "viem";

describe("RoleManager", () => {
  async function deployFixture() {
    const [admin, professor, student, other] = await hre.viem.getWalletClients();
    const roleManager = await hre.viem.deployContract("RoleManager", [
      admin.account.address,
    ]);
    const PROFESSOR_ROLE = keccak256(toHex("PROFESSOR_ROLE"));
    const STUDENT_ROLE   = keccak256(toHex("STUDENT_ROLE"));
    return { roleManager, admin, professor, student, other, PROFESSOR_ROLE, STUDENT_ROLE };
  }

  it("deployer gets DEFAULT_ADMIN_ROLE", async () => {
    const { roleManager, admin } = await loadFixture(deployFixture);
    const DEFAULT_ADMIN_ROLE = await roleManager.read.DEFAULT_ADMIN_ROLE();
    expect(await roleManager.read.hasRole([DEFAULT_ADMIN_ROLE, admin.account.address])).to.be.true;
  });

  it("admin can assign PROFESSOR_ROLE", async () => {
    const { roleManager, admin, professor, PROFESSOR_ROLE } = await loadFixture(deployFixture);
    await roleManager.write.assignRole([professor.account.address, PROFESSOR_ROLE], {
      account: admin.account,
    });
    expect(await roleManager.read.hasRole([PROFESSOR_ROLE, professor.account.address])).to.be.true;
  });

  it("admin can assign STUDENT_ROLE and group", async () => {
    const { roleManager, admin, student, STUDENT_ROLE } = await loadFixture(deployFixture);
    await roleManager.write.assignRole([student.account.address, STUDENT_ROLE], {
      account: admin.account,
    });
    await roleManager.write.assignGroup([student.account.address, "MF1"], {
      account: admin.account,
    });
    expect(await roleManager.read.getGroup([student.account.address])).to.equal("MF1");
  });

  it("non-admin cannot assign roles", async () => {
    const { roleManager, other, professor, PROFESSOR_ROLE } = await loadFixture(deployFixture);
    await expect(
      roleManager.write.assignRole([professor.account.address, PROFESSOR_ROLE], {
        account: other.account,
      })
    ).to.be.rejected;
  });

  it("getRoleOf returns correct role labels", async () => {
    const { roleManager, admin, professor, student, PROFESSOR_ROLE, STUDENT_ROLE } =
      await loadFixture(deployFixture);
    await roleManager.write.assignRole([professor.account.address, PROFESSOR_ROLE], {
      account: admin.account,
    });
    await roleManager.write.assignRole([student.account.address, STUDENT_ROLE], {
      account: admin.account,
    });
    expect(await roleManager.read.getRoleOf([admin.account.address])).to.equal("ADMIN");
    expect(await roleManager.read.getRoleOf([professor.account.address])).to.equal("PROFESSOR");
    expect(await roleManager.read.getRoleOf([student.account.address])).to.equal("STUDENT");
  });

  it("getRoleOf returns NONE for unknown address", async () => {
    const { roleManager, other } = await loadFixture(deployFixture);
    expect(await roleManager.read.getRoleOf([other.account.address])).to.equal("NONE");
  });
});
