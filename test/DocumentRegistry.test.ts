import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { keccak256, toHex } from "viem";

describe("DocumentRegistry", () => {
  async function deployFixture() {
    const [admin, professor, student] = await hre.viem.getWalletClients();
    const roleManager = await hre.viem.deployContract("RoleManager", [
      admin.account.address,
    ]);
    const documentRegistry = await hre.viem.deployContract("DocumentRegistry", [
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

    // A realistic SHA-256 file hash (32 bytes)
    const fileHash = keccak256(toHex("fake-pdf-content-bytes"));

    return { documentRegistry, admin, professor, student, fileHash };
  }

  it("professor can register a document", async () => {
    const { documentRegistry, professor, fileHash } = await loadFixture(deployFixture);
    await expect(
      documentRegistry.write.register([fileHash, "exercises_module3.pdf", "MF1"], {
        account: professor.account,
      })
    ).to.be.fulfilled;
  });

  it("student cannot register a document", async () => {
    const { documentRegistry, student, fileHash } = await loadFixture(deployFixture);
    await expect(
      documentRegistry.write.register([fileHash, "file.pdf", "MF1"], {
        account: student.account,
      })
    ).to.be.rejectedWith("Not a professor");
  });

  it("verifyDocument returns true for correct hash", async () => {
    const { documentRegistry, professor, fileHash } = await loadFixture(deployFixture);
    await documentRegistry.write.register([fileHash, "slides.pdf", "all"], {
      account: professor.account,
    });
    const ok = await documentRegistry.read.verifyDocument([1n, fileHash]);
    expect(ok).to.be.true;
  });

  it("verifyDocument returns false for tampered hash", async () => {
    const { documentRegistry, professor, fileHash } = await loadFixture(deployFixture);
    await documentRegistry.write.register([fileHash, "slides.pdf", "all"], {
      account: professor.account,
    });
    const tamperedHash = keccak256(toHex("tampered-pdf-content"));
    const ok = await documentRegistry.read.verifyDocument([1n, tamperedHash]);
    expect(ok).to.be.false;
  });

  it("getDocuments filters by group", async () => {
    const { documentRegistry, professor, fileHash } = await loadFixture(deployFixture);
    await documentRegistry.write.register([fileHash, "mf1.pdf", "MF1"], {
      account: professor.account,
    });
    await documentRegistry.write.register([fileHash, "mf2.pdf", "MF2"], {
      account: professor.account,
    });
    await documentRegistry.write.register([fileHash, "all.pdf", "all"], {
      account: professor.account,
    });
    const results = await documentRegistry.read.getDocuments(["MF1"]);
    expect(results.length).to.equal(2); // MF1 + all
    const names = results.map((d) => d.fileName);
    expect(names).to.include("mf1.pdf");
    expect(names).to.include("all.pdf");
    expect(names).to.not.include("mf2.pdf");
  });
});
