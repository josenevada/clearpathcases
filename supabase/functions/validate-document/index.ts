import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DOC_TYPE_PROMPTS: Record<string, string> = {
  "pay stub": `Expected document: Pay Stub.
Expected fields: employer name, pay period dates, year.
Flag if: the document appears to be more than 90 days old based on extracted dates, if it is not clearly a pay stub, or if it appears to be from a different person.`,

  "w-2": `Expected document: W-2 (Wage and Tax Statement).
Expected field: tax year.
Flag if: the year is not one of the two most recent tax years (2025 or 2024), if the document is not clearly a W-2, or if it appears incomplete or cut off.`,

  "bank statement": `Expected document: Bank Statement (checking or savings).
Expected fields: institution name, statement period.
Flag if: the statement is more than 6 months old, if it does not appear to be an official bank statement, or if it appears to show only partial pages.`,

  "tax return": `Expected document: Tax Return (federal).
Expected field: tax year.
Flag if: the year is not one of the two most recent tax years (2025 or 2024), if it is not clearly a tax return, or if it appears to be missing pages such as schedules.`,

  "credit card statement": `Expected document: Credit Card Statement.
Expected fields: institution name, statement period.
Flag if: the statement is more than 3 months old, if it does not appear to be an official credit card statement, or if it appears incomplete.`,

  "government id": `Expected document: Government-Issued Photo ID (driver's license or passport).
Expected fields: document type (driver's license or passport), expiration date.
Flag if: the ID appears expired, if it is not clearly a government-issued photo ID, or if the image is too blurry to read.`,
};

function getDocTypeKey(expectedType: string): string {
  const lower = expectedType.toLowerCase();
  if (lower.includes("pay stub")) return "pay stub";
  if (lower.includes("w-2") || lower.includes("w2")) return "w-2";
  if (lower.includes("bank") || lower.includes("checking") || lower.includes("savings"))
    return "bank statement";
  if (lower.includes("tax return")) return "tax return";
  if (lower.includes("credit card")) return "credit card statement";
  if (
    lower.includes("government id") ||
    lower.includes("driver") ||
    lower.includes("passport") ||
    lower.includes("photo id") ||
    lower.includes("identification")
  )
    return "government id";
  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { fileBase64, mimeType, expectedDocumentType, caseId } = await req.json();

    if (!fileBase64 || !expectedDocumentType) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: fileBase64, expectedDocumentType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const docTypeKey = getDocTypeKey(expectedDocumentType);
    const specificPrompt = DOC_TYPE_PROMPTS[docTypeKey] || `Expected document: ${expectedDocumentType}. Analyze whether this matches.`;

    const systemPrompt = `You are a document validation assistant for a bankruptcy law firm intake system. You analyze uploaded documents to verify they match the expected document type and extract key information.

You must respond ONLY with valid JSON — no additional text, no markdown, no code fences. The JSON must contain exactly these fields:
{
  "is_correct_document_type": boolean,
  "confidence_score": number between 0 and 1,
  "extracted_year": string or null,
  "extracted_name": string or null,
  "extracted_institution": string or null,
  "issues": array of strings (empty if none),
  "suggestion": string (a single plain English sentence written directly to the client using gentle, non-judgmental language),
  "validator_notes": string (a single plain English sentence written for the paralegal summarizing findings)
}`;

    const userPrompt = `Analyze this uploaded document.

${specificPrompt}

Determine whether the document matches the expected type. Extract key information. Report any issues. If the image is very low resolution or heavily compressed, include "Low image quality" in the issues array and cap your confidence_score at 0.5.

Respond ONLY with the JSON object.`;

    // Build message content - use image for images, describe for PDFs
    const isImage = mimeType && (mimeType.startsWith("image/") || mimeType === "application/pdf");
    
    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    if (isImage && mimeType.startsWith("image/")) {
      messages.push({
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${fileBase64}` } },
          { type: "text", text: userPrompt },
        ],
      });
    } else if (mimeType === "application/pdf") {
      // For PDFs, send as image (first page will be rendered by the model)
      messages.push({
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:application/pdf;base64,${fileBase64}` } },
          { type: "text", text: userPrompt },
        ],
      });
    } else {
      messages.push({
        role: "user",
        content: userPrompt + "\n\n[Note: The uploaded file could not be rendered as an image. Analyze based on available information.]",
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited, please try again later", status: "pending" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted", status: "pending" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Validation service unavailable", status: "pending" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";

    // Parse JSON from response, handling potential markdown fences
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ error: "Could not parse validation response", status: "pending" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine validation status
    let validationStatus: "passed" | "warning" | "failed";
    const isCorrect = parsed.is_correct_document_type;
    const confidence = parsed.confidence_score;
    const issues = parsed.issues || [];

    if (!isCorrect || confidence < 0.6) {
      validationStatus = "failed";
    } else if (confidence < 0.85 || issues.length > 0) {
      validationStatus = "warning";
    } else {
      validationStatus = "passed";
    }

    const result = {
      is_correct_document_type: isCorrect,
      confidence_score: confidence,
      extracted_year: parsed.extracted_year || null,
      extracted_name: parsed.extracted_name || null,
      extracted_institution: parsed.extracted_institution || null,
      issues,
      suggestion: parsed.suggestion || "",
      validator_notes: parsed.validator_notes || "",
      validation_status: validationStatus,
      validated_at: new Date().toISOString(),
      expected_document_type: expectedDocumentType,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      console.error("Validation timed out");
      return new Response(
        JSON.stringify({ error: "Validation timed out", status: "pending" }),
        { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.error("validate-document error:", error);
    return new Response(
      JSON.stringify({ error: "Validation service unavailable", status: "pending" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
