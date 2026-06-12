import { Router, Request, Response } from "express";
import { getAcknowledgments, hasAcknowledged } from "../services/blockchain";
import { publicClient } from "../services/blockchain";

const router = Router();

// POST /api/acknowledge/:id
// Body: { txHash, callerAddress }
// Student already sent the TX via MetaMask — backend just confirms it landed
router.post("/:id", async (req: Request, res: Response) => {
  try {
    const announcementId = BigInt(req.params.id);
    const { txHash, callerAddress } = req.body as {
      txHash: `0x${string}`;
      callerAddress: `0x${string}`;
    };

    if (!txHash || !callerAddress) {
      res.status(400).json({ error: "txHash and callerAddress are required" });
      return;
    }

    await publicClient.waitForTransactionReceipt({ hash: txHash });
    const acked = await hasAcknowledged(announcementId, callerAddress);

    res.json({
      success: acked,
      announcementId: announcementId.toString(),
      student: callerAddress,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/acknowledge/:id — list all acknowledgers for an announcement
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const announcementId = BigInt(req.params.id);
    const acks = await getAcknowledgments(announcementId);
    res.json({ announcementId: announcementId.toString(), acknowledgers: acks });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
