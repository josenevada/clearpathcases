import { supabase } from '@/integrations/supabase/client';
import type { Case, ChecklistItem, FirmSettings, UploadedFile } from '@/lib/store';

export interface DashboardOnboardingState {
  firmProfileComplete: boolean;
  brandingComplete: boolean;
  counselingComplete: boolean;
  hasSentLink: boolean;
}

interface DashboardDataResult {
  cases: Case[];
  onboarding: DashboardOnboardingState;
}

interface BrandingSettings {
  attorneyName: string;
  barNumber: string;
}

interface CounselingSettings {
  providerName: string;
  providerLink: string;
  attorneyCode: string;
}

const emptyOnboardingState: DashboardOnboardingState = {
  firmProfileComplete: false,
  brandingComplete: false,
  counselingComplete: false,
  hasSentLink: false,
};

const mapChecklist = async (rows: any[], fileRows: any[]): Promise<ChecklistItem[]> =>
  Promise.all(rows.map(async (row) => {
    const files: UploadedFile[] = await Promise.all(
      fileRows
        .filter((file: any) => file.checklist_item_id === row.id)
        .map(async (file: any) => {
          let displayUrl = file.data_url || '';
          if (file.storage_path && !displayUrl) {
            const { data } = await supabase.storage
              .from('case-documents')
              .createSignedUrl(file.storage_path, 3600);
            displayUrl = data?.signedUrl || '';
          }
          return {
            id: file.id,
            name: file.file_name,
            dataUrl: displayUrl,
            storagePath: file.storage_path || undefined,
            uploadedAt: file.uploaded_at || new Date().toISOString(),
            reviewStatus: file.review_status || 'pending',
            reviewNote: file.review_note || undefined,
            uploadedBy: file.uploaded_by || 'client',
          };
        })
    );

    return {
      id: row.id,
      category: row.category,
      label: row.label,
      description: row.description || '',
      whyWeNeedThis: row.why_we_need_this || '',
      required: row.required ?? true,
      files,
      flaggedForAttorney: row.flagged_for_attorney ?? false,
      attorneyNote: row.attorney_note || undefined,
      correctionRequest: row.correction_status
        ? {
            reason: row.correction_reason || '',
            details: row.correction_details || undefined,
            requestedBy: row.correction_requested_by || '',
            requestedAt: row.correction_requested_at || '',
            targetFileId: row.correction_target_file_id || undefined,
            status: row.correction_status,
          }
        : undefined,
      resubmittedAt: row.resubmitted_at || undefined,
      completed: row.completed ?? false,
      notApplicable: row.not_applicable ?? false,
      notApplicableReason: row.not_applicable_reason || undefined,
      notApplicableMarkedBy: row.not_applicable_marked_by || undefined,
      notApplicableAt: row.not_applicable_at || undefined,
    };
  }));

const mapCase = (caseRow: any, checklistRows: any[], fileRows: any[]): Case => ({
  id: caseRow.id,
  clientName: caseRow.client_name,
  clientEmail: caseRow.client_email,
  clientPhone: caseRow.client_phone || undefined,
  clientDob: caseRow.client_dob || undefined,
  caseCode: caseRow.case_code || undefined,
  courtCaseNumber: caseRow.court_case_number || undefined,
  chapterType: caseRow.chapter_type,
  assignedParalegal: caseRow.assigned_paralegal || '',
  assignedAttorney: caseRow.assigned_attorney || '',
  filingDeadline: caseRow.filing_deadline,
  createdAt: caseRow.created_at || new Date().toISOString(),
  lastClientActivity: caseRow.last_client_activity || undefined,
  checklist: mapChecklist(checklistRows, fileRows),
  activityLog: [],
  notes: [],
  checkpointsCompleted: [],
  urgency: caseRow.urgency || 'normal',
  status: caseRow.status || 'active',
  readyToFile: caseRow.ready_to_file ?? false,
  wizardStep: caseRow.wizard_step ?? 0,
  closedAt: caseRow.closed_at || undefined,
  retentionNotifiedAt: caseRow.retention_notified_at || undefined,
  retentionDeleteScheduledAt: caseRow.retention_delete_scheduled_at || undefined,
  district: caseRow.district || undefined,
  meetingDate: caseRow.meeting_date || undefined,
});

export const fetchDashboardData = async (firmId: string): Promise<DashboardDataResult> => {
  const { data: caseRows, error: casesError } = await supabase
    .from('cases')
    .select('*')
    .eq('firm_id', firmId)
    .order('created_at', { ascending: false });

  if (casesError) throw casesError;

  const caseIds = (caseRows || []).map((row) => row.id);

  const [checklistResult, filesResult, activityResult, firmResult] = await Promise.all([
    caseIds.length
      ? supabase.from('checklist_items').select('*').in('case_id', caseIds).order('sort_order', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    caseIds.length
      ? supabase.from('files').select('*').in('case_id', caseIds)
      : Promise.resolve({ data: [], error: null }),
    caseIds.length
      ? supabase
          .from('activity_log')
          .select('case_id, event_type')
          .in('case_id', caseIds)
          .in('event_type', ['notification_sent', 'share_link_created', 'reminder_sent'])
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('firms')
      .select('name, primary_contact_name, primary_contact_email, phone, default_paralegal, default_attorney, branding_attorney_name, branding_bar_number, counseling_provider_link')
      .eq('id', firmId)
      .maybeSingle(),
  ]);

  if (checklistResult.error) throw checklistResult.error;
  if (filesResult.error) throw filesResult.error;
  if (activityResult.error) throw activityResult.error;
  if (firmResult.error) throw firmResult.error;

  const checklistRows = checklistResult.data || [];
  const fileRows = filesResult.data || [];

  return {
    cases: (caseRows || []).map((caseRow) =>
      mapCase(
        caseRow,
        checklistRows.filter((row) => row.case_id === caseRow.id),
        fileRows.filter((row) => row.case_id === caseRow.id),
      ),
    ),
    onboarding: firmResult.data
      ? {
          firmProfileComplete: Boolean(firmResult.data.name && firmResult.data.primary_contact_email),
          brandingComplete: Boolean(firmResult.data.branding_attorney_name && firmResult.data.branding_bar_number),
          counselingComplete: Boolean(firmResult.data.counseling_provider_link),
          hasSentLink: (activityResult.data || []).length > 0,
        }
      : emptyOnboardingState,
  };
};

export const fetchFirmProfileSettings = async (firmId: string): Promise<FirmSettings> => {
  const { data, error } = await supabase
    .from('firms')
    .select('name, primary_contact_name, primary_contact_email, phone, default_paralegal, default_attorney')
    .eq('id', firmId)
    .maybeSingle();

  if (error) throw error;

  return {
    firmName: data?.name || '',
    primaryContactName: data?.primary_contact_name || '',
    primaryContactEmail: data?.primary_contact_email || '',
    phone: data?.phone || '',
    defaultParalegal: data?.default_paralegal || '',
    defaultAttorney: data?.default_attorney || '',
  };
};

export const saveFirmProfileSettings = async (firmId: string, settings: FirmSettings) => {
  const { error } = await supabase
    .from('firms')
    .update({
      name: settings.firmName,
      primary_contact_name: settings.primaryContactName,
      primary_contact_email: settings.primaryContactEmail,
      phone: settings.phone,
      default_paralegal: settings.defaultParalegal,
      default_attorney: settings.defaultAttorney,
    })
    .eq('id', firmId);

  if (error) throw error;
};

export const fetchBrandingSettings = async (firmId: string): Promise<BrandingSettings> => {
  const { data, error } = await supabase
    .from('firms')
    .select('branding_attorney_name, branding_bar_number')
    .eq('id', firmId)
    .maybeSingle();

  if (error) throw error;

  return {
    attorneyName: data?.branding_attorney_name || '',
    barNumber: data?.branding_bar_number || '',
  };
};

export const saveBrandingSettings = async (firmId: string, settings: BrandingSettings) => {
  const { error } = await supabase
    .from('firms')
    .update({
      branding_attorney_name: settings.attorneyName,
      branding_bar_number: settings.barNumber,
    })
    .eq('id', firmId);

  if (error) throw error;
};

export const fetchCounselingSettings = async (firmId: string): Promise<CounselingSettings> => {
  const { data, error } = await supabase
    .from('firms')
    .select('counseling_provider_name, counseling_provider_link, counseling_attorney_code')
    .eq('id', firmId)
    .maybeSingle();

  if (error) throw error;

  return {
    providerName: data?.counseling_provider_name || '',
    providerLink: data?.counseling_provider_link || '',
    attorneyCode: data?.counseling_attorney_code || '',
  };
};

export const saveCounselingSettings = async (firmId: string, settings: CounselingSettings) => {
  const { error } = await supabase
    .from('firms')
    .update({
      counseling_provider_name: settings.providerName,
      counseling_provider_link: settings.providerLink,
      counseling_attorney_code: settings.attorneyCode,
    })
    .eq('id', firmId);

  if (error) throw error;
};