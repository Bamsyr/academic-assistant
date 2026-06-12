// PDF text extraction for the "Automatic PDF Analysis" feature.
import pdfParse from "pdf-parse";

export interface PdfText {
  text: string;
  pages: number;
}

/** Returns true when the buffer looks like a PDF (magic bytes "%PDF-"). */
export function isPdf(buffer: Buffer, mimeType?: string): boolean {
  if (mimeType === "application/pdf") return true;
  return buffer.length > 4 && buffer.subarray(0, 5).toString("latin1") === "%PDF-";
}

/** Extracts plain text + page count from a PDF buffer. */
export async function extractPdfText(buffer: Buffer): Promise<PdfText> {
  const result = await pdfParse(buffer);
  // Collapse runs of whitespace so chunking/embedding isn't polluted by layout.
  const text = result.text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { text, pages: result.numpages };
}
