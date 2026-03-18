const CLOUD_FUNCTIONS_URL = 'https://gurufoykncixameklolt.supabase.co/functions/v1';
const CLOUD_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1cnVmb3lrbmNpeGFtZWtsb2x0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTI4ODUsImV4cCI6MjA4OTQyODg4NX0.WW_j8BD7X46CC-1B-Nyc8S54nIeanma4fSLzPg1fMXs';

export interface CorrectionNotificationPayload {
  clientEmail: string;
  clientName: string;
  clientPhone?: string;
  correctionLink: string;
}

export interface CorrectionNotificationResult {
  sms: { status: 'sent' | 'skipped' | 'failed'; detail?: string };
  email: { status: 'sent' | 'skipped' | 'failed'; detail?: string };
}

export const sendCorrectionNotifications = async (
  payload: CorrectionNotificationPayload,
): Promise<CorrectionNotificationResult> => {
  const response = await fetch(`${CLOUD_FUNCTIONS_URL}/case-correction-notify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: CLOUD_ANON_KEY,
      Authorization: `Bearer ${CLOUD_ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(result?.error || `Cloud notification call failed [${response.status}]`);
  }

  return result;
};
