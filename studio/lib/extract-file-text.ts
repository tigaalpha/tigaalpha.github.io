import { BASE_PATH } from "@/lib/constants";

/** Extracts plain text from a .txt, .pdf, or .docx File entirely client-side — no server upload needed. */
export async function extractFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt") || file.type === "text/plain") {
    return file.text();
  }

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return extractPdfText(file);
  }

  if (name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return extractDocxText(file);
  }

  throw new Error("Unsupported file type — please upload a .txt, .pdf, or .docx file.");
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `${BASE_PATH}/vendor/pdf.worker.min.mjs`;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const pageTexts: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }

  return pageTexts.join("\n\n");
}

async function extractDocxText(file: File): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}
