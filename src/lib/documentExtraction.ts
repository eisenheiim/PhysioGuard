export interface ExtractedRehabDocument {
  fileName: string;
  fileType: string;
  text: string;
  extractedAt: string;
}

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export async function extractRehabDocument(file: File): Promise<ExtractedRehabDocument> {
  if (file.size > MAX_FILE_BYTES) throw new Error("Please upload a file smaller than 20 MB.");
  let text: string;
  if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
    text = await file.text();
  } else if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    text = await extractPdfText(file);
  } else if (file.type.startsWith("image/")) {
    text = await extractImageText(file);
  } else {
    throw new Error("Unsupported file type. Upload a PDF, image, or plain-text document.");
  }
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) throw new Error("No readable text was found. Please upload a clearer scan or photo.");
  return { fileName: file.name, fileType: file.type || "unknown", text: normalized, extractedAt: new Date().toISOString() };
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // PDF.js v4 requires an explicit worker URL in browser bundles. The worker
  // is served from /public so Webpack does not try to parse the .mjs asset.
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item: { str?: string }) => item.str ?? "").join(" "));
  }
  const text = pages.join(" ");
  // Scanned doctor handouts often contain no PDF text layer. Render those
  // pages and OCR them before reporting that no exercises were found.
  if (text.replace(/\s+/g, "").length >= 40) return text;
  const tesseract = await import("tesseract.js");
  const worker = await tesseract.createWorker("eng");
  try {
    const ocrPages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = window.document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) continue;
      await page.render({ canvasContext: context, viewport }).promise;
      const result = await worker.recognize(canvas);
      ocrPages.push(result.data.text);
    }
    return ocrPages.join(" ");
  } finally {
    await worker.terminate();
  }
}

async function extractImageText(file: File): Promise<string> {
  const tesseract = await import("tesseract.js");
  const worker = await tesseract.createWorker("eng");
  try {
    const result = await worker.recognize(file);
    return result.data.text;
  } finally {
    await worker.terminate();
  }
}
