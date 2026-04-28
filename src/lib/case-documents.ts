/**
 * Helpers for the private `case-documents` storage bucket.
 *
 * The bucket is NOT public, so we must generate short-lived signed URLs
 * for previews/downloads instead of using getPublicUrl().
 */
import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'case-documents';
// Signed URL lifetime: long enough for a single page session to render
// previews, short enough that leaked URLs expire quickly.
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

/**
 * Returns a short-lived signed URL for a file in the case-documents bucket,
 * or an empty string if the path is missing or signing fails.
 */
export async function getCaseDocumentSignedUrl(
  storagePath: string | null | undefined,
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  if (!storagePath) return '';
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, ttlSeconds);
  if (error || !data?.signedUrl) {
    console.warn('createSignedUrl failed for', storagePath, error);
    return '';
  }
  return data.signedUrl;
}
