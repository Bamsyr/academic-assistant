import { Router, Request, Response } from "express";
import { keccak256, toHex } from "viem";
import { getAnnouncements, verifyAnnouncement, waitForAnnouncementId } from "../services/blockchain";
import { getRoleOf, getGroup } from "../services/blockchain";
import { indexDocument } from "../services/rag";

const router = Router();

// POST /api/announcement
// Body: { txHash, content, category, targetGroup, callerAddress }
// Professor's MetaMask already sent the TX — backend just indexes into RAG
router.post("/", async (req: Request, res: Response) => {
  try {
    const { txHash, content, category, targetGroup, callerAddress } = req.body as {
      txHash: `0x${string}`;
      content: string;
      category: string;
      targetGroup: string;
      callerAddress: `0x${string}`;
    };

    if (!txHash || !content || !targetGroup || !callerAddress) {
      res.status(400).json({ error: "txHash, content, targetGroup and callerAddress are required" });
      return;
    }

    const role = await getRoleOf(callerAddress);
    if (role !== "PROFESSOR" && role !== "ADMIN") {
      res.status(403).json({ error: "Only professors can index announcements" });
      return;
    }

    const announcementId = await waitForAnnouncementId(txHash);

    await indexDocument({
      sourceId: Number(announcementId),
      text: `[${category ?? "announcement"}] ${content}`,
      group: targetGroup,
      type: "announcement",
      metadata: { category: category ?? "", targetGroup },
    });

    res.json({ success: true, id: announcementId.toString() });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/announcements?callerAddress=0x...
router.get("/", async (req: Request, res: Response) => {
  try {
    const callerAddress = req.query.callerAddress as `0x${string}` | undefined;

    let group = "all";
    if (callerAddress) {
      const role = await getRoleOf(callerAddress);
      if (role === "STUDENT") {
        group = await getGroup(callerAddress);
      }
      // professors and admins see all groups
    }

    // The contract already includes "all"-targeted announcements when a
    // specific group is requested, so a single call covers both.
    const items = await getAnnouncements(group);

    res.json({ announcements: items });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/verify/:id?contentHash=0x...
router.get("/verify/:id", async (req: Request, res: Response) => {
  try {
    const id = BigInt(req.params.id);
    const { content, contentHash } = req.query as { content?: string; contentHash?: string };

    let hashToVerify: `0x${string}`;
    if (contentHash) {
      hashToVerify = contentHash as `0x${string}`;
    } else if (content) {
      hashToVerify = keccak256(toHex(content));
    } else {
      res.status(400).json({ error: "Provide content or contentHash query param" });
      return;
    }

    const valid = await verifyAnnouncement(id, hashToVerify);
    res.json({ id: id.toString(), valid, hashChecked: hashToVerify });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
