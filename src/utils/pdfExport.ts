import jsPDF from "jspdf";

interface ContentBlock {
  id: string;
  block_type: string;
  title?: string | null;
  content?: string | null;
  image_url?: string | null;
  code_language?: string | null;
  block_order: number;
}

interface PdfExportOptions {
  sessionTitle: string;
  programTitle: string;
  sessionOrder: number;
  contentBlocks: ContentBlock[];
  userName?: string;
  userId?: string;
}

const BRAND = {
  name: "Mamuza Engineering",
  tagline: "Inspire. Solve. Lead.",
  website: "www.mamuzaengineering.com",
  email: "info@mamuzaengineering.com",
  phone: "+254 700 000 000",
  primaryColor: [255, 87, 34] as [number, number, number],    // #ff5722
  accentColor: [213, 174, 228] as [number, number, number],   // #D5AEE4
  darkColor: [30, 30, 30] as [number, number, number],
  lightGrey: [245, 245, 245] as [number, number, number],
  mutedColor: [120, 120, 120] as [number, number, number],
};

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function addWatermark(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.saveGraphicsState();
    // @ts-ignore - jsPDF GState
    const gState = new (doc as any).GState({ opacity: 0.06 });
    doc.setGState(gState);
    doc.setFontSize(54);
    doc.setTextColor(...BRAND.mutedColor);
    
    // Diagonal watermark text
    const centerX = PAGE_WIDTH / 2;
    const centerY = PAGE_HEIGHT / 2;
    doc.text("MAMUZA ENGINEERING", centerX, centerY - 20, {
      align: "center",
      angle: 35,
    });
    doc.setFontSize(24);
    doc.text(BRAND.tagline, centerX, centerY + 20, {
      align: "center",
      angle: 35,
    });
    
    doc.restoreGraphicsState();
  }
}

function addHeader(doc: jsPDF, pageNum: number) {
  // Orange top bar
  doc.setFillColor(...BRAND.primaryColor);
  doc.rect(0, 0, PAGE_WIDTH, 4, "F");

  // Brand name on the left
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.primaryColor);
  doc.setFont("helvetica", "bold");
  doc.text(BRAND.name.toUpperCase(), MARGIN, 12);

  // Website on the right
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND.mutedColor);
  doc.text(BRAND.website, PAGE_WIDTH - MARGIN, 12, { align: "right" });
}

function addFooter(doc: jsPDF, pageNum: number, totalPages: number, userId?: string) {
  const y = PAGE_HEIGHT - 10;
  
  // Footer line
  doc.setDrawColor(...BRAND.primaryColor);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y - 6, PAGE_WIDTH - MARGIN, y - 6);

  doc.setFontSize(7);
  doc.setTextColor(...BRAND.mutedColor);
  doc.setFont("helvetica", "normal");

  // Left: contact info
  doc.text(`${BRAND.email}  |  ${BRAND.phone}  |  ${BRAND.website}`, MARGIN, y);

  // Center: confidential notice
  const notice = "CONFIDENTIAL - Do not reproduce or distribute";
  doc.text(notice, PAGE_WIDTH / 2, y, { align: "center" });

  // Right: page number
  doc.text(`Page ${pageNum} of ${totalPages}`, PAGE_WIDTH - MARGIN, y, { align: "right" });

  // User trace (tiny, for tracking)
  if (userId) {
    doc.setFontSize(5);
    doc.setTextColor(220, 220, 220);
    doc.text(`UID:${userId.substring(0, 8)}`, PAGE_WIDTH - MARGIN, y + 3, { align: "right" });
  }
}

function checkPageBreak(doc: jsPDF, y: number, neededHeight: number): number {
  if (y + neededHeight > PAGE_HEIGHT - 20) {
    doc.addPage();
    addHeader(doc, doc.getNumberOfPages());
    return 22;
  }
  return y;
}

function renderTextBlock(doc: jsPDF, block: ContentBlock, y: number): number {
  if (block.title) {
    y = checkPageBreak(doc, y, 12);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND.darkColor);
    doc.text(block.title, MARGIN, y);
    y += 7;
  }

  if (block.content) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);

    const paragraphs = block.content.split("\n\n");
    for (const para of paragraphs) {
      const lines = doc.splitTextToSize(para.trim(), CONTENT_WIDTH);
      for (const line of lines) {
        y = checkPageBreak(doc, y, 6);
        doc.text(line, MARGIN, y);
        y += 5;
      }
      y += 3;
    }
  }
  return y;
}

function renderCodeBlock(doc: jsPDF, block: ContentBlock, y: number): number {
  if (block.title) {
    y = checkPageBreak(doc, y, 12);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND.primaryColor);
    doc.text(`CODE: ${block.title}`, MARGIN, y);
    y += 6;
  }

  if (block.content) {
    const codeLines = block.content.split("\n");
    const lang = (block.code_language || "cpp").toUpperCase();

    // Language badge
    y = checkPageBreak(doc, y, 10);
    doc.setFillColor(40, 40, 40);
    doc.roundedRect(MARGIN, y - 4, CONTENT_WIDTH, 8, 2, 2, "F");
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.text(lang, MARGIN + 4, y + 1);
    doc.setFontSize(7);
    doc.text("(Copyable)", PAGE_WIDTH - MARGIN - 4, y + 1, { align: "right" });
    y += 8;

    // Code background
    const lineHeight = 4.2;
    const codeHeight = codeLines.length * lineHeight + 6;

    // Render in chunks if very long
    const maxLinesPerPage = Math.floor((PAGE_HEIGHT - 30 - y) / lineHeight);
    let lineIndex = 0;

    while (lineIndex < codeLines.length) {
      const remainingLines = codeLines.length - lineIndex;
      const linesThisPage = Math.min(remainingLines, Math.max(5, Math.floor((PAGE_HEIGHT - 30 - y) / lineHeight)));
      
      const blockHeight = linesThisPage * lineHeight + 6;
      y = checkPageBreak(doc, y, blockHeight);

      doc.setFillColor(30, 30, 30);
      doc.roundedRect(MARGIN, y - 3, CONTENT_WIDTH, blockHeight, 1, 1, "F");

      doc.setFont("courier", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(212, 212, 212);

      let codeY = y + 2;
      for (let i = 0; i < linesThisPage && lineIndex < codeLines.length; i++, lineIndex++) {
        // Line number
        doc.setTextColor(100, 100, 100);
        doc.text(String(lineIndex + 1).padStart(3, " "), MARGIN + 2, codeY);
        // Code text
        doc.setTextColor(212, 212, 212);
        const codeLine = codeLines[lineIndex].substring(0, 90); // Truncate long lines
        doc.text(codeLine, MARGIN + 14, codeY);
        codeY += lineHeight;
      }

      y += blockHeight + 4;
      
      if (lineIndex < codeLines.length) {
        doc.addPage();
        addHeader(doc, doc.getNumberOfPages());
        y = 22;
      }
    }
  }
  return y;
}

function renderStyledBlock(
  doc: jsPDF,
  block: ContentBlock,
  y: number,
  label: string,
  color: [number, number, number]
): number {
  y = checkPageBreak(doc, y, 20);

  // Colored left border
  doc.setFillColor(...color);
  doc.rect(MARGIN, y - 3, 3, 0, "F"); // Will be extended

  const title = block.title || label;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...color);
  doc.text(title.toUpperCase(), MARGIN + 6, y);
  y += 7;

  if (block.content) {
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    
    const lines = block.content.split("\n");
    for (const line of lines) {
      if (!line.trim()) { y += 3; continue; }
      const wrapped = doc.splitTextToSize(line.trim(), CONTENT_WIDTH - 8);
      for (const wl of wrapped) {
        y = checkPageBreak(doc, y, 5);
        doc.text(wl, MARGIN + 6, y);
        y += 4.5;
      }
    }
  }
  y += 4;
  return y;
}

export async function exportSessionToPdf(options: PdfExportOptions) {
  const { sessionTitle, programTitle, sessionOrder, contentBlocks, userName, userId } = options;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // === COVER PAGE ===
  // Orange top bar
  doc.setFillColor(...BRAND.primaryColor);
  doc.rect(0, 0, PAGE_WIDTH, 8, "F");

  // Purple accent bar
  doc.setFillColor(...BRAND.accentColor);
  doc.rect(0, 8, PAGE_WIDTH, 2, "F");

  // Brand name
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND.primaryColor);
  doc.text(BRAND.name.toUpperCase(), PAGE_WIDTH / 2, 50, { align: "center" });

  // Tagline
  doc.setFontSize(12);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...BRAND.mutedColor);
  doc.text(BRAND.tagline, PAGE_WIDTH / 2, 60, { align: "center" });

  // Divider
  doc.setDrawColor(...BRAND.primaryColor);
  doc.setLineWidth(1);
  doc.line(60, 70, 150, 70);

  // Program title
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND.darkColor);
  doc.text(programTitle, PAGE_WIDTH / 2, 90, { align: "center" });

  // Session title
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND.darkColor);
  const sessionLines = doc.splitTextToSize(`Session ${sessionOrder}: ${sessionTitle}`, CONTENT_WIDTH - 20);
  doc.text(sessionLines, PAGE_WIDTH / 2, 110, { align: "center" });

  // Student info box
  const boxY = 150;
  doc.setFillColor(...BRAND.lightGrey);
  doc.roundedRect(50, boxY, 110, 30, 3, 3, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND.mutedColor);
  if (userName) {
    doc.text(`Student: ${userName}`, PAGE_WIDTH / 2, boxY + 10, { align: "center" });
  }
  doc.text(`Generated: ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`, PAGE_WIDTH / 2, boxY + 18, { align: "center" });
  doc.text("FOR PERSONAL USE ONLY", PAGE_WIDTH / 2, boxY + 26, { align: "center" });

  // Contact info at bottom of cover
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.mutedColor);
  doc.text(BRAND.website, PAGE_WIDTH / 2, 250, { align: "center" });
  doc.text(`${BRAND.email}  |  ${BRAND.phone}`, PAGE_WIDTH / 2, 256, { align: "center" });

  // Bottom bar
  doc.setFillColor(...BRAND.primaryColor);
  doc.rect(0, PAGE_HEIGHT - 6, PAGE_WIDTH, 6, "F");

  // === CONTENT PAGES ===
  doc.addPage();
  addHeader(doc, 2);
  let y = 22;

  for (const block of contentBlocks) {
    switch (block.block_type) {
      case "code":
        y = renderCodeBlock(doc, block, y);
        break;
      case "safety_note":
        y = renderStyledBlock(doc, block, y, "SAFETY NOTE", [230, 150, 0]);
        break;
      case "tip":
        y = renderStyledBlock(doc, block, y, "TIP", BRAND.accentColor);
        break;
      case "problem":
        y = renderStyledBlock(doc, block, y, "PROBLEM STATEMENT", [220, 50, 50]);
        break;
      case "solution":
        y = renderStyledBlock(doc, block, y, "PROPOSED SOLUTION", [34, 139, 34]);
        break;
      case "components":
        y = renderStyledBlock(doc, block, y, "COMPONENTS REQUIRED", BRAND.primaryColor);
        break;
      case "questions":
        y = renderStyledBlock(doc, block, y, "REVIEW QUESTIONS", BRAND.accentColor);
        break;
      case "feedback":
        y = renderStyledBlock(doc, block, y, "SESSION FEEDBACK", BRAND.mutedColor);
        break;
      case "introduction":
        y = renderStyledBlock(doc, block, y, "INTRODUCTION", BRAND.primaryColor);
        break;
      default:
        y = renderTextBlock(doc, block, y);
        break;
    }
    y += 4;
  }

  // === POST-PROCESSING ===
  // Add watermark to all pages
  addWatermark(doc);

  // Add footers to all pages (skip cover)
  const totalPages = doc.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i - 1, totalPages - 1, userId);
  }

  // Set PDF metadata & protection
  doc.setProperties({
    title: `${programTitle} - Session ${sessionOrder}: ${sessionTitle}`,
    subject: `Mamuza Engineering LMS - ${programTitle}`,
    author: BRAND.name,
    creator: BRAND.name,
  });

  // Save
  const filename = `Mamuza_${programTitle.replace(/\s+/g, "_")}_Session${sessionOrder}.pdf`;
  doc.save(filename);
}
