import { Router, Request, Response } from "express";
import { answerQuestion, NotRegisteredError } from "../services/assistant";

const router = Router();

// POST /api/chat
// Body: { question, callerAddress }
router.post("/", async (req: Request, res: Response) => {
  try {
    const { question, callerAddress } = req.body as {
      question: string;
      callerAddress: `0x${string}`;
    };

    if (!question || !callerAddress) {
      res.status(400).json({ error: "question and callerAddress are required" });
      return;
    }

    const { answer, contextUsed } = await answerQuestion(question, callerAddress);
    res.json({ answer, contextUsed });
  } catch (err) {
    if (err instanceof NotRegisteredError) {
      res.status(403).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
