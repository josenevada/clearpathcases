const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export interface ValidationResult {
  is_correct_document_type: boolean;
  confidence_score: number;
  extracted_year: string | null;
  extracted_name: string | null;
  extracted_institution: string | null;
  issues: string[];
  suggestion: string;
  validator_notes: string;
  validation_status: 'passed' | 'warning' | 'failed';
  validated_at: string;
  expected_document_type: string;
}

// Map checklist labels → document type keys for validation prompts
const LABEL_TO_DOC_TYPE: Record<string, string> = {
  'Pay Stubs (Last 2 Months)': 'pay stub',
  'W-2s (Last 2 Years)': 'W-2',
  'Tax Returns (Last 2 Years)': 'tax return',
  'Checking/Savings Statements (Last 6 Months)': 'bank statement',
  'Credit Card Statements (Last 3 Months)': 'credit card statement',
  'Digital Wallet Statements': 'digital wallet statement',
  'Government-Issued Photo ID': 'government id',
  'Drivers License or State ID': 'government id',
  "Driver's License or State ID": 'government id',
};

export function getExpectedDocType(label: string): string {
  // Direct match
  if (LABEL_TO_DOC_TYPE[label]) return LABEL_TO_DOC_TYPE[label];
  // Fuzzy match
  const lower = label.toLowerCase();
  if (lower.includes('pay stub')) return 'pay stub';
  if (lower.includes('w-2') || lower.includes('w2')) return 'W-2';
  if (lower.includes('tax return')) return 'tax return';
  if (lower.includes('bank') || lower.includes('checking') || lower.includes('savings')) return 'bank statement';
  if (lower.includes('credit card')) return 'credit card statement';
  if (lower.includes('digital wallet') || lower.includes('venmo') || lower.includes('paypal') || lower.includes('cash app')) return 'digital wallet statement';
  if (lower.includes('id') || lower.includes('license') || lower.includes('passport')) return 'government id';
  // Fallback: use the label itself
  return label;
}

export async function validateDocument(
  fileDataUrlOrSignedUrl: string,
  expectedDocType: string,
  caseId: string,
): Promise<ValidationResult | null> {
  try {
    let fileBase64: string;
    let mimeType: string;

    if (fileDataUrlOrSignedUrl.startsWith('data:')) {
      const match = fileDataUrlOrSignedUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        console.warn('Invalid data URL for validation');
        return null;
      }
      mimeType = match[1];
      fileBase64 = match[2];
    } else if (fileDataUrlOrSignedUrl.startsWith('http')) {
      const response = await fetch(fileDataUrlOrSignedUrl);
      if (!response.ok) {
        console.warn('Failed to fetch file for validation:', response.status);
        return null;
      }
      const blob = await response.blob();
      mimeType = blob.type || 'image/jpeg';
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      uint8Array.forEach(byte => binary += String.fromCharCode(byte));
      fileBase64 = btoa(binary);
    } else {
      console.warn('Unknown file URL format for validation');
      return null;
    }

    const MAX_BASE64_LENGTH = 1_400_000;
    if (fileBase64.length > MAX_BASE64_LENGTH) {
      fileBase64 = fileBase64.substring(0, MAX_BASE64_LENGTH);
    }

    const response = await fetch(`${FUNCTIONS_URL}/validate-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        fileBase64,
        mimeType,
        expectedDocumentType: expectedDocType,
        caseId,
      }),
    });

    if (!response.ok) {
      console.warn('Document validation failed:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn('Document validation error:', error);
    return null;
  }
}
