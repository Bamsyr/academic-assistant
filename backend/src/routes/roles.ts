import { Router, Request, Response } from "express";
import { keccak256, toHex } from "viem";
import { assignRole, assignGroup, getRoleOf, getGroup } from "../services/blockchain";

const router = Router();

const ROLES: Record<string, `0x${string}`> = {
  PROFESSOR_ROLE: keccak256(toHex("PROFESSOR_ROLE")),
  STUDENT_ROLE:   keccak256(toHex("STUDENT_ROLE")),
};

// GET /api/roles/:address — get role + group for a wallet
router.get("/:address", async (req: Request, res: Response) => {
  try {
    const address = req.params.address as `0x${string}`;
    const [role, group] = await Promise.all([getRoleOf(address), getGroup(address)]);
    res.json({ address, role, group });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/roles/assign — admin assigns role + group to a wallet
// Body: { address, role: "PROFESSOR_ROLE" | "STUDENT_ROLE", group?: string }
router.post("/assign", async (req: Request, res: Response) => {
  try {
    const { address, role, group } = req.body as {
      address: `0x${string}`;
      role: string;
      group?: string;
    };

    if (!address || !role) {
      res.status(400).json({ error: "address and role are required" });
      return;
    }

    const roleHex = ROLES[role];
    if (!roleHex) {
      res.status(400).json({ error: `Unknown role: ${role}. Use PROFESSOR_ROLE or STUDENT_ROLE` });
      return;
    }

    await assignRole(address, roleHex);
    if (group) await assignGroup(address, group);

    res.json({ success: true, address, role, group: group ?? "" });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
