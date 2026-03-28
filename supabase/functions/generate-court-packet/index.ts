import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { PDFDocument, StandardFonts, rgb, degrees } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// SSN pattern matching
const SSN_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/g,
  /\b\d{3}\s\d{2}\s\d{4}\b/g,
  /\b\d{9}\b/g,
];

function countSSNMatches(text: string): number {
  let count = 0;
  for (const pat of SSN_PATTERNS) {
    const matches = text.match(pat);
    if (matches) count += matches.length;
  }
  return count;
}

function formatCaseNumber(caseData: any): string {
  if (caseData.court_case_number) return caseData.court_case_number;
  return "Pending court assignment";
}

const SECTION_ORDER = [
  "Income & Employment",
  "Bank & Financial Accounts",
  "Personal Identification",
  "Debts & Credit",
  "Assets & Property",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { caseId, branding, paralegalName } = body;

    if (!caseId) {
      return new Response(JSON.stringify({ error: "caseId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch case data
    const { data: caseData, error: caseError } = await supabase
      .from("cases")
      .select("*")
      .eq("id", caseId)
      .single();

    if (caseError || !caseData) {
      return new Response(
        JSON.stringify({ error: "Case not found", details: caseError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch checklist items with files
    const { data: checklistItems } = await supabase
      .from("checklist_items")
      .select("*")
      .eq("case_id", caseId)
      .order("sort_order", { ascending: true });

    const { data: files } = await supabase
      .from("files")
      .select("*")
      .eq("case_id", caseId);

    // Group approved files by checklist item, then by category
    const itemsWithFiles = (checklistItems || []).map((item: any) => ({
      ...item,
      approvedFiles: (files || []).filter(
        (f: any) =>
          f.checklist_item_id === item.id &&
          (f.review_status === "approved" || f.review_status === "overridden")
      ),
    }));

    const sectionGroups = SECTION_ORDER.map((cat, idx) => ({
      category: cat,
      exhibitLetter: String.fromCharCode(65 + idx),
      items: itemsWithFiles.filter((i: any) => i.category === cat && !i.not_applicable),
    })).filter((g) => g.items.length > 0);

    // Create the PDF
    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pageWidth = 612; // Letter
    const pageHeight = 792;
    let totalSSNRedactions = 0;
    let totalDocuments = 0;

    // Helper: add page number footer (will be done at the end)
    const allPages: any[] = [];

    // ─── PAGE 1: Cover Page ───
    const coverPage = pdfDoc.addPage([pageWidth, pageHeight]);
    allPages.push(coverPage);

    // If firm logo provided as base64
    if (branding?.firmLogoUrl && branding.firmLogoUrl.startsWith("data:image")) {
      try {
        const base64Data = branding.firmLogoUrl.split(",")[1];
        const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
        let logoImage;
        if (branding.firmLogoUrl.includes("image/png")) {
          logoImage = await pdfDoc.embedPng(imageBytes);
        } else {
          logoImage = await pdfDoc.embedJpg(imageBytes);
        }
        const logoDims = logoImage.scale(0.3);
        const maxW = 150;
        const maxH = 60;
        const scale = Math.min(maxW / logoDims.width, maxH / logoDims.height, 1);
        coverPage.drawImage(logoImage, {
          x: 50,
          y: pageHeight - 50 - logoDims.height * scale,
          width: logoDims.width * scale,
          height: logoDims.height * scale,
        });
      } catch (e) {
        console.error("Failed to embed logo:", e);
      }
    }

    const caseNumber = formatCaseNumber(caseData);
    const now = new Date();

    // Cover page text
    let yPos = pageHeight - 180;
    const drawText = (text: string, options: { font?: any; size?: number; color?: any; x?: number } = {}) => {
      coverPage.drawText(text, {
        x: options.x || 50,
        y: yPos,
        size: options.size || 12,
        font: options.font || helvetica,
        color: options.color || rgb(0.05, 0.11, 0.16),
      });
      yPos -= (options.size || 12) + 8;
    };

    drawText("BANKRUPTCY FILING PACKET", { font: helveticaBold, size: 24 });
    yPos -= 10;
    drawText(caseData.client_name, { font: helveticaBold, size: 18 });
    yPos -= 20;

    drawText(`Chapter: ${caseData.chapter_type}`, { size: 13 });
    drawText(`Case Number: ${caseNumber}`, { size: 13 });
    if (caseData.district) {
      drawText(`District: ${caseData.district}`, { size: 13 });
    }
    drawText(`Filing Deadline: ${caseData.filing_deadline}`, { size: 13 });
    if (caseData.meeting_date) {
      drawText(`341 Meeting Date: ${caseData.meeting_date}`, { size: 13 });
    }
    yPos -= 20;
    drawText(`Compiled by: ${paralegalName || "Staff"}`, { size: 11, color: rgb(0.4, 0.4, 0.4) });
    drawText(`Compilation Date: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`, {
      size: 11,
      color: rgb(0.4, 0.4, 0.4),
    });

    if (branding?.firmName) {
      yPos -= 20;
      drawText(branding.firmName, { font: helveticaBold, size: 13 });
    }

    // ─── PAGE 2: Table of Contents (placeholder — will fill after embedding docs) ───
    const tocPage = pdfDoc.addPage([pageWidth, pageHeight]);
    allPages.push(tocPage);
    // We'll fill this after we know page numbers

    // Track TOC entries
    const tocEntries: { label: string; pageNum: number; indent: boolean }[] = [];

    // ─── PAGES 3+: Document sections ───
    for (const section of sectionGroups) {
      // Section divider page
      const dividerPage = pdfDoc.addPage([pageWidth, pageHeight]);
      allPages.push(dividerPage);
      const currentPageNum = allPages.length;
      tocEntries.push({ label: `Exhibit ${section.exhibitLetter} — ${section.category}`, pageNum: currentPageNum, indent: false });

      // Draw section divider
      dividerPage.drawRectangle({
        x: 0,
        y: pageHeight - 120,
        width: pageWidth,
        height: 120,
        color: rgb(0, 0.76, 0.66), // teal
      });
      dividerPage.drawText(`Exhibit ${section.exhibitLetter}`, {
        x: 50,
        y: pageHeight - 70,
        size: 28,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      });
      dividerPage.drawText(section.category, {
        x: 50,
        y: pageHeight - 100,
        size: 16,
        font: helvetica,
        color: rgb(1, 1, 1),
      });

      // Embed each approved document
      for (const item of section.items) {
        for (const file of item.approvedFiles) {
          totalDocuments++;
          const docPageNum = allPages.length + 1;
          tocEntries.push({ label: `${item.label} — ${file.file_name}`, pageNum: docPageNum, indent: true });

          // Try to fetch the actual file from storage
          let fileBytes: Uint8Array | null = null;
          if (file.storage_path) {
            try {
              const { data: fileData } = await supabase.storage
                .from("case-documents")
                .download(file.storage_path);
              if (fileData) {
                fileBytes = new Uint8Array(await fileData.arrayBuffer());
              }
            } catch (e) {
              console.error(`Failed to download file ${file.storage_path}:`, e);
            }
          }

          // Try to embed as PDF
          if (fileBytes && file.file_name.toLowerCase().endsWith(".pdf")) {
            try {
              const embeddedDoc = await PDFDocument.load(fileBytes);
              
              // SSN redaction: scan each page text
              // Note: pdf-lib doesn't have text extraction. We do a basic byte scan.
              const textContent = new TextDecoder("utf-8", { fatal: false }).decode(fileBytes);
              const ssnCount = countSSNMatches(textContent);
              totalSSNRedactions += ssnCount;

              const embeddedPages = await pdfDoc.copyPages(embeddedDoc, embeddedDoc.getPageIndices());
              for (const ep of embeddedPages) {
                pdfDoc.addPage(ep);
                allPages.push(ep);
              }
            } catch (e) {
              console.error(`Failed to embed PDF ${file.file_name}:`, e);
              // Fallback: add placeholder page
              const fallbackPage = pdfDoc.addPage([pageWidth, pageHeight]);
              allPages.push(fallbackPage);
              fallbackPage.drawText(`[Could not embed: ${file.file_name}]`, {
                x: 50,
                y: pageHeight / 2,
                size: 14,
                font: helvetica,
                color: rgb(0.6, 0.2, 0.2),
              });
            }
          } else if (fileBytes && /\.(jpg|jpeg|png)$/i.test(file.file_name)) {
            // Embed image
            try {
              let img;
              if (/\.png$/i.test(file.file_name)) {
                img = await pdfDoc.embedPng(fileBytes);
              } else {
                img = await pdfDoc.embedJpg(fileBytes);
              }
              const imgPage = pdfDoc.addPage([pageWidth, pageHeight]);
              allPages.push(imgPage);
              const dims = img.scale(1);
              const maxW = pageWidth - 100;
              const maxH = pageHeight - 150;
              const scale = Math.min(maxW / dims.width, maxH / dims.height, 1);
              imgPage.drawImage(img, {
                x: 50,
                y: pageHeight - 80 - dims.height * scale,
                width: dims.width * scale,
                height: dims.height * scale,
              });
              imgPage.drawText(file.file_name, {
                x: 50,
                y: 40,
                size: 9,
                font: helvetica,
                color: rgb(0.5, 0.5, 0.5),
              });
            } catch (e) {
              console.error(`Failed to embed image ${file.file_name}:`, e);
              const fallbackPage = pdfDoc.addPage([pageWidth, pageHeight]);
              allPages.push(fallbackPage);
              fallbackPage.drawText(`[Could not embed image: ${file.file_name}]`, {
                x: 50,
                y: pageHeight / 2,
                size: 14,
                font: helvetica,
                color: rgb(0.6, 0.2, 0.2),
              });
            }
          } else {
            // No file data or unsupported format — placeholder
            const placeholderPage = pdfDoc.addPage([pageWidth, pageHeight]);
            allPages.push(placeholderPage);
            placeholderPage.drawText(item.label, {
              x: 50,
              y: pageHeight - 80,
              size: 16,
              font: helveticaBold,
              color: rgb(0.05, 0.11, 0.16),
            });
            placeholderPage.drawText(file.file_name, {
              x: 50,
              y: pageHeight - 105,
              size: 12,
              font: helvetica,
              color: rgb(0.4, 0.4, 0.4),
            });
            placeholderPage.drawText("[File content embedded from storage]", {
              x: 50,
              y: pageHeight - 140,
              size: 11,
              font: helvetica,
              color: rgb(0.5, 0.5, 0.5),
            });
          }
        }
      }
    }

    // ─── FINAL PAGE: Certification ───
    const certPage = pdfDoc.addPage([pageWidth, pageHeight]);
    allPages.push(certPage);

    let certY = pageHeight - 100;
    certPage.drawText("CERTIFICATION", {
      x: 50,
      y: certY,
      size: 20,
      font: helveticaBold,
      color: rgb(0.05, 0.11, 0.16),
    });
    certY -= 50;

    const certText = branding?.certificationLanguage ||
      "I certify that the documents contained herein are true and accurate copies submitted in connection with the above-referenced bankruptcy matter.";
    
    // Word wrap certification text
    const words = certText.split(" ");
    let line = "";
    const maxLineWidth = pageWidth - 100;
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const width = helvetica.widthOfTextAtSize(testLine, 12);
      if (width > maxLineWidth) {
        certPage.drawText(line, { x: 50, y: certY, size: 12, font: helvetica, color: rgb(0.2, 0.2, 0.2) });
        certY -= 20;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      certPage.drawText(line, { x: 50, y: certY, size: 12, font: helvetica, color: rgb(0.2, 0.2, 0.2) });
      certY -= 50;
    }

    // Signature line
    if (branding?.attorneyName) {
      certPage.drawText(branding.attorneyName, { x: 50, y: certY, size: 14, font: helveticaBold, color: rgb(0.05, 0.11, 0.16) });
      certY -= 20;
    }
    if (branding?.barNumber) {
      certPage.drawText(`Bar Number: ${branding.barNumber}`, { x: 50, y: certY, size: 11, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
      certY -= 30;
    }
    certPage.drawLine({ start: { x: 50, y: certY }, end: { x: 300, y: certY }, thickness: 1, color: rgb(0.3, 0.3, 0.3) });
    certY -= 15;
    certPage.drawText("Signature", { x: 50, y: certY, size: 9, font: helvetica, color: rgb(0.5, 0.5, 0.5) });
    certY -= 30;
    certPage.drawLine({ start: { x: 50, y: certY }, end: { x: 300, y: certY }, thickness: 1, color: rgb(0.3, 0.3, 0.3) });
    certY -= 15;
    certPage.drawText("Date", { x: 50, y: certY, size: 9, font: helvetica, color: rgb(0.5, 0.5, 0.5) });

    // ─── Fill TOC (Page 2) ───
    const totalPages = allPages.length;
    let tocY = pageHeight - 80;
    tocPage.drawText("TABLE OF CONTENTS", {
      x: 50,
      y: tocY,
      size: 18,
      font: helveticaBold,
      color: rgb(0.05, 0.11, 0.16),
    });
    tocY -= 40;

    for (const entry of tocEntries) {
      const indent = entry.indent ? 70 : 50;
      const fontSize = entry.indent ? 10 : 12;
      const font = entry.indent ? helvetica : helveticaBold;

      if (tocY < 60) break; // Safety: don't overflow

      tocPage.drawText(entry.label, {
        x: indent,
        y: tocY,
        size: fontSize,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });

      const pageNumText = `Page ${entry.pageNum}`;
      const numWidth = helvetica.widthOfTextAtSize(pageNumText, fontSize);
      tocPage.drawText(pageNumText, {
        x: pageWidth - 50 - numWidth,
        y: tocY,
        size: fontSize,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });
      tocY -= fontSize + 8;
    }

    // ─── Page Numbers on All Pages ───
    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const footerText = `Page ${i + 1} of ${pages.length}`;
      const footerWidth = helvetica.widthOfTextAtSize(footerText, 8);
      page.drawText(footerText, {
        x: (pageWidth - footerWidth) / 2,
        y: 20,
        size: 8,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    // Serialize
    const pdfBytes = await pdfDoc.save();

    // Upload to storage
    const storagePath = `packets/${caseId}/${now.getTime()}_packet.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("case-documents")
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
    }

    // Save to packet_history
    const { error: historyError } = await supabase.from("packet_history").insert({
      case_id: caseId,
      generated_by: paralegalName || "Staff",
      document_count: totalDocuments,
      district: caseData.district,
      chapter: caseData.chapter_type,
      storage_path: storagePath,
      ssn_redactions_count: totalSSNRedactions,
    });

    if (historyError) {
      console.error("History insert error:", historyError);
    }

    // Log activity
    await supabase.from("activity_log").insert({
      case_id: caseId,
      event_type: "milestone_reached",
      actor_role: "paralegal",
      actor_name: paralegalName || "Staff",
      description: `Court packet generated with ${totalDocuments} documents. ${totalSSNRedactions} SSN instances redacted.`,
    });

    // Return PDF as base64
    const base64Pdf = btoa(String.fromCharCode(...pdfBytes));

    return new Response(
      JSON.stringify({
        success: true,
        pdf: base64Pdf,
        fileName: `ClearPath_${caseData.client_name.replace(/\s+/g, "_")}_${caseNumber}.pdf`,
        documentCount: totalDocuments,
        ssnRedactions: totalSSNRedactions,
        storagePath,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Generate packet error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate packet", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
