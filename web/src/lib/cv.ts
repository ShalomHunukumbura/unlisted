/**
 * Reading a CV, in the browser only: the file never leaves the device. What
 * comes out is text for findSkills/findRoles/findYears (catalog.ts) and an
 * embedding to rank jobs by. The libraries are loaded on first use, so the
 * page doesn't carry them.
 */

export const CV_TYPES = ".pdf,.docx,.txt,.md";
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PDF_PAGES = 12;

export async function readCv(file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error("That file is over 10 MB. A CV is usually well under 1 MB.");
  const name = file.name.toLowerCase();
  let text: string;
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    // The legacy build: the default one needs JavaScript newer than many phones have.
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= Math.min(pdf.numPages, MAX_PDF_PAGES); i++) {
      const content = await (await pdf.getPage(i)).getTextContent();
      // hasEOL marks the end of a line on the page; keep it, dates and titles sit on their own lines.
      pages.push(content.items.map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "")).join(""));
    }
    text = pages.join("\n");
  } else if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    text = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
  } else if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) {
    text = await file.text();
  } else {
    throw new Error("Use a PDF, a Word file (.docx) or plain text.");
  }
  text = text.replace(/[ \t]+/g, " ").trim();
  if (text.length < 100) {
    throw new Error("Couldn't find text in that file. If it's a scanned PDF, try a Word or text version.");
  }
  return text;
}

// The same model `jobsite embed` uses on job postings (8-bit, 23 MB, cached
// by the browser after the first download).
const MODEL = "Xenova/all-MiniLM-L6-v2";
const CHUNK_WORDS = 150;
const MAX_CHUNKS = 12;

type Extractor = (texts: string[], options: { pooling: "mean"; normalize: boolean }) => Promise<{ data: Float32Array; dims: number[] }>;
let extractor: Promise<Extractor> | null = null;

/**
 * One vector for the whole CV: the model reads about 200 words at a time, so
 * the CV is cut into chunks, each embedded, and the average taken.
 */
export async function embedCv(text: string): Promise<number[]> {
  extractor ??= import("@huggingface/transformers").then(
    ({ pipeline }) => pipeline("feature-extraction", MODEL, { dtype: "q8" }) as unknown as Promise<Extractor>,
  );
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length && chunks.length < MAX_CHUNKS; i += CHUNK_WORDS) {
    chunks.push(words.slice(i, i + CHUNK_WORDS).join(" "));
  }
  let out;
  try {
    out = await (await extractor)(chunks, { pooling: "mean", normalize: true });
  } catch (error) {
    extractor = null; // e.g. offline: try the download again next time
    throw error;
  }
  const size = out.dims[1];
  const mean = new Array<number>(size).fill(0);
  for (let c = 0; c < chunks.length; c++) {
    for (let d = 0; d < size; d++) mean[d] += out.data[c * size + d];
  }
  const norm = Math.hypot(...mean);
  return mean.map((v) => v / norm);
}
