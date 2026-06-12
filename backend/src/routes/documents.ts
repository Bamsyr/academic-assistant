import { Router, Request, Response } from "express";
import { createHash } from "crypto";
import multer from "multer";
import { getRoleOf, getGroup, waitForDocumentId, verifyDocumentOnChain, getDocuments } from "../services/blockchain";
import { indexDocument } from "../services/rag";
import { extractPdfText, isPdf } from "../services/pdf";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// POST /api/document
// Multipart: file + fields: txHash, targetGroup, callerAddress
router.post("/", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const { txHash, targetGroup, callerAddress } = req.body as {
      txHash: `0x${string}`;
      targetGroup: string;
      callerAddress: `0x${string}`;
    };

    if (!txHash || !targetGroup || !callerAddress) {
      res.status(400).json({ error: "txHash, targetGroup and callerAddress are required" });
      return;
    }

    const role = await getRoleOf(callerAddress);
    if (role !== "PROFESSOR" && role !== "ADMIN") {
      res.status(403).json({ error: "Only professors can register documents" });
      return;
    }

    const docId = await waitForDocumentId(txHash);

    const fileName = req.file?.originalname ?? "document";

    // Automatic PDF Analysis: if the upload is a PDF, extract its full text so
    // students can ask questions about the document's contents — not just its name.
    let indexedText = `Document: ${fileName} (id: ${docId}) — group: ${targetGroup}`;
    let pages = 0;
    let contentIndexed = false;
    if (req.file && isPdf(req.file.buffer, req.file.mimetype)) {
      try {
        const parsed = await extractPdfText(req.file.buffer);
        if (parsed.text.length > 0) {
          pages = parsed.pages;
          indexedText = `Document "${fileName}" (id: ${docId}, ${pages} pages, group: ${targetGroup}):\n\n${parsed.text}`;
          contentIndexed = true;
        }
      } catch (e) {
        // Non-fatal: fall back to indexing just the filename descriptor.
        console.warn(`PDF text extraction failed for ${fileName}:`, (e as Error).message);
      }
    }

    await indexDocument({
      sourceId: Number(docId),
      text: indexedText,
      group: targetGroup,
      type: "document",
      metadata: { fileName, targetGroup, pages: String(pages) },
    });

    res.json({ success: true, id: docId.toString(), fileName, pages, contentIndexed });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/documents?callerAddress=0x...
router.get("/", async (req: Request, res: Response) => {
  try {
    const callerAddress = req.query.callerAddress as `0x${string}` | undefined;
    let group = "all";
    if (callerAddress) {
      const role = await getRoleOf(callerAddress);
      if (role === "STUDENT") group = await getGroup(callerAddress);
    }
    const items = await getDocuments(group !== "all" ? group : "all");
    res.json({ documents: items });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/documents/verify-hash
// Body: { docId, fileHash } OR upload file to compute hash on the fly
router.post(
  "/verify-hash",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const docId = BigInt(req.body.docId as string);
      let fileHash: `0x${string}`;

      if (req.file) {
        const hex = createHash("sha256").update(req.file.buffer).digest("hex");
        fileHash = `0x${hex}`;
      } else if (req.body.fileHash) {
        fileHash = req.body.fileHash as `0x${string}`;
      } else {
        res.status(400).json({ error: "Provide file or fileHash" });
        return;
      }

      const valid = await verifyDocumentOnChain(docId, fileHash);
      res.json({ docId: docId.toString(), valid, fileHash });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

export default router;
