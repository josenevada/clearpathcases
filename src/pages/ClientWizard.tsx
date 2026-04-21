import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, CheckCircle2, ChevronDown, AlertTriangle, ArrowLeft, Trash2, Briefcase, Loader2, Eye, EyeOff, Lock, X, Camera, Menu, Flame, Star, Zap, FileText, CreditCard, Building2, Car, Home, IdCard, ShieldCheck, Award, ClipboardCheck, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Logo from '@/components/Logo';
import ProgressPill from '@/components/wizard/ProgressPill';
import StepTransition from '@/components/wizard/StepTransition';
import MultiUploadZone, { LowCountConfirmation, MULTI_UPLOAD_CONFIGS, isMultiUploadItem } from '@/components/wizard/MultiUploadZone';
import CorrectionBanner from '@/components/wizard/CorrectionBanner';
import CorrectionNoteCard from '@/components/wizard/CorrectionNoteCard';
import DocumentHelpChat from '@/components/wizard/DocumentHelpChat';
import PlaidBankConnect, { type PlaidResult } from '@/components/wizard/PlaidBankConnect';
import DigitalWalletStep from '@/components/wizard/DigitalWalletStep';
import WizardSidebar from '@/components/wizard/WizardSidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { getChecklistItemPosition, getOpenCorrectionItem } from '@/lib/corrections';
import { CATEGORIES, STEP_MOTIVATIONS, calculateProgress, isItemEffectivelyComplete, type Case, type ChecklistItem, type TextEntry, type FileValidationResult } from '@/lib/store';
import { validateDocument, getExpectedDocType } from '@/lib/document-validation';
import { sendMomentumSms } from '@/lib/sms';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const EMPLOYER_LABEL = 'Employer Name';
const SSN_LABEL = 'Social Security Card';
const SSN_LABEL_LEGACY = 'Social Security Number';
const isTextEntryItem = (label: string) => label === EMPLOYER_LABEL || label === 'Employer Name & Address';

// ─── i18n helpers ────────────────────────────────────────────────────
const t = (en: string, es: string, lang: string) => lang === 'es' ? es : en;

const DOCUMENT_TRANSLATIONS: Record<string, { label: string; description: string }> = {
  'Pay Stubs': { label: 'Talones de Pago', description: 'Muestra tus ingresos actuales al tribunal.' },
  'W-2s': { label: 'Formularios W-2', description: 'Declaraciones de salario de los últimos 2 años.' },
  'Tax Returns': { label: 'Declaraciones de Impuestos', description: 'Declaraciones federales de los últimos 2 años.' },
  'Bank Statements': { label: 'Estados de Cuenta Bancarios', description: 'Últimos 6 meses de todas tus cuentas.' },
  'Photo ID': { label: 'Identificación con Foto', description: 'Licencia de conducir o pasaporte vigente.' },
  'Social Security Card': { label: 'Tarjeta de Seguro Social', description: 'Original o copia certificada.' },
  'Proof of Income': { label: 'Comprobante de Ingresos', description: 'Cualquier documento que muestre tus ingresos.' },
  'Lease Agreement': { label: 'Contrato de Arrendamiento', description: 'Tu contrato de renta actual.' },
};

const translateDoc = (label: string, lang: string): { label: string; description?: string } => {
  if (lang !== 'es') return { label };
  // Try exact match, then prefix match (handles "Pay Stubs (Last 2 Months)" → "Pay Stubs")
  if (DOCUMENT_TRANSLATIONS[label]) return DOCUMENT_TRANSLATIONS[label];
  for (const key of Object.keys(DOCUMENT_TRANSLATIONS)) {
    if (label.startsWith(key)) return DOCUMENT_TRANSLATIONS[key];
  }
  return { label };
};

const pageTransition = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.2, ease: [0.2, 0, 0, 1] as [number, number, number, number] },
};

const MILESTONE_THRESHOLDS = [25, 50, 75, 100];

// ─── Per-item success messages ────────────────────────────────────────
const SUCCESS_MESSAGES: Record<string, string> = {
  'Pay Stubs (Last 2 Months)': "Got your pay stubs — that's one of the most important ones.",
  'W-2s (Last 2 Years)': "W-2s uploaded — your work history is documented.",
  'Tax Returns (Last 2 Years)': "Tax returns received — that's a big one off the list.",
  'Employer Name': "Employer info saved — nice and easy.",
  'Employer Name & Address': "Employer info saved — nice and easy.",
  'Checking/Savings Statements (Last 6 Months)': "Bank statements uploaded — your finances are documented.",
  'Digital Wallet Statements': "Digital wallet info captured — good thinking.",
  'Investment/Retirement Statements': "Retirement accounts documented — don't worry, they're usually protected.",
  'Credit Card Statements (Last 3 Months)': "Credit card statements received — helps us list your debts accurately.",
  'Loan Statements': "Loan statements uploaded — every debt documented is one less surprise.",
  'Collection Notices': "Collection notices uploaded — we'll make sure those debts are included.",
  'Mortgage Statement or Lease': "Housing info documented — an important piece of the picture.",
  'Vehicle Title or Registration': "Vehicle documentation received — ownership confirmed.",
  'Property Deed': "Property deed uploaded — we'll make sure the right protections apply.",
  'Government-Issued Photo ID': "Identity confirmed — you're almost there.",
  'Social Security Card': "Got it — your SSN is secured and encrypted.",
  'Social Security Number': "Got it — your SSN is secured and encrypted.",
  'Credit Counseling Certificate': "Counseling certificate uploaded — that requirement is handled.",
  'Financial Disclosure Confirmation': "Financial disclosure confirmed — almost done.",
  'Assets Disclosure Confirmation': "Assets disclosure confirmed — just a bit more.",
  'Final Confirmation': "Final confirmation received — you're all set.",
};

// ─── Document icon mapping ────────────────────────────────────────
const DOCUMENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Pay Stubs (Last 2 Months)': FileText,
  'W-2s (Last 2 Years)': FileText,
  'Tax Returns (Last 2 Years)': FileText,
  'Employer Name': Briefcase,
  'Employer Name & Address': Briefcase,
  'Checking/Savings Statements (Last 6 Months)': Building2,
  'Digital Wallet Statements': CreditCard,
  'Investment/Retirement Statements': Building2,
  'Credit Card Statements (Last 3 Months)': CreditCard,
  'Loan Statements': FileText,
  'Collection Notices': FileText,
  'Mortgage Statement or Lease': Home,
  'Vehicle Title or Registration': Car,
  'Property Deed': Home,
  'Government-Issued Photo ID': IdCard,
  'Social Security Card': ShieldCheck,
  'Social Security Number': ShieldCheck,
  'Credit Counseling Certificate': Award,
  'Financial Disclosure Confirmation': ClipboardCheck,
  'Assets Disclosure Confirmation': ClipboardCheck,
  'Final Confirmation': ClipboardCheck,
};

// Human subtitles for each document step
const WARM_SUBTITLES: Record<string, string> = {
  'Pay Stubs (Last 2 Months)': 'This shows the court what you currently earn — it\'s one of the most important documents in your filing.',
  'W-2s (Last 2 Years)': 'These help paint a picture of your work history over the past couple of years.',
  'Tax Returns (Last 2 Years)': 'Your tax returns give the court a full view of your financial year — we need the last two.',
  'Employer Name': 'Just your current employer\'s name — this goes on the official paperwork.',
  'Employer Name & Address': 'Just your current employer\'s name — this goes on the official paperwork.',
  'Checking/Savings Statements (Last 6 Months)': 'The trustee reviews these to understand your recent finances — 6 months is the standard requirement.',
  'Digital Wallet Statements': 'If you\'ve used Venmo, PayPal, or Cash App, the court needs to see that activity too.',
  'Investment/Retirement Statements': 'Don\'t worry — retirement accounts are usually protected. We just need to document them.',
  'Credit Card Statements (Last 3 Months)': 'This helps us list out your debts accurately so nothing gets missed in your filing.',
  'Loan Statements': 'Car loans, personal loans, student loans — anything you owe on, we need a recent statement.',
  'Collection Notices': 'If you\'ve gotten letters from collectors, upload them here so we can include those debts.',
  'Mortgage Statement or Lease': 'Whether you rent or own, this helps your attorney understand your housing situation.',
  'Vehicle Title or Registration': 'If you own a car, we just need proof of ownership — title or registration works.',
  'Property Deed': 'If you own any property, upload the deed so we can make sure the right protections apply.',
  'Government-Issued Photo ID': 'We just need to confirm who you are — a driver\'s license or passport works perfectly.',
  'Social Security Card': 'Upload a photo or scan of your Social Security card. A clear photo taken with your phone works perfectly.',
  'Social Security Number': 'Upload a photo or scan of your Social Security card. A clear photo taken with your phone works perfectly.',
  'Credit Counseling Certificate': 'This is a quick online course the court requires before filing — most people finish in under an hour.',
  'Financial Disclosure Confirmation': 'Just confirming that everything you\'ve shared so far is accurate to the best of your knowledge.',
  'Assets Disclosure Confirmation': 'One more confirmation — that you\'ve told us about everything you own.',
  'Final Confirmation': 'Last step — just a final check that everything looks good before your attorney takes over.',
};

const getProgressLabel = (progress: number): string => {
  if (progress >= 100) return 'You did it — your documents are ready for review.';
  if (progress >= 76) return 'Almost done — just a few more steps.';
  if (progress >= 51) return 'More than halfway there!';
  if (progress >= 26) return 'Good progress — keep going.';
  return 'Let\'s get started — you\'ve got this.';
};

// ─── Image compression utility ────────────────────────────────────────
const compressImage = (file: File, maxSizeMB: number = 1): Promise<File> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/') || file.size < maxSizeMB * 1024 * 1024) {
      resolve(file);
      return;
    }

    // Check for HEIC/HEIF
    const isHeic = file.type === 'image/heic' || file.type === 'image/heif' ||
      file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();

    img.onload = () => {
      const maxDim = 1500;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
        else { width = Math.round(width * maxDim / height); height = maxDim; }
      }
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
        else resolve(file);
      }, 'image/jpeg', 0.82);
    };

    img.onerror = () => {
      if (isHeic) {
        toast.error("This photo format isn't supported. Please take a screenshot of it or save it as a JPEG first.");
      }
      resolve(file);
    };

    img.src = URL.createObjectURL(file);
  });
};

const ClientWizard = () => {
  const { caseId, caseCode } = useParams<{ caseId?: string; caseCode?: string }>();
  const resolvedCaseId = caseId || '';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentCategoryIdx, setCurrentCategoryIdx] = useState(0);
  const [currentItemIdx, setCurrentItemIdx] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showMilestone, setShowMilestone] = useState<number | null>(null);
  const [checkpointConfirmed, setCheckpointConfirmed] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [showStepTransition, setShowStepTransition] = useState<number | null>(null);
  const [showLowCountConfirm, setShowLowCountConfirm] = useState(false);
  const [employerName, setEmployerName] = useState('');
  const [employerAddress, setEmployerAddress] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState<'employed' | 'self-employed' | 'not-employed' | null>(null);
  const [ssnValue, setSsnValue] = useState('');
  const [ssnVisible, setSsnVisible] = useState(false);
  const [ssnError, setSsnError] = useState('');
  const [validatingFiles, setValidatingFiles] = useState<Set<string>>(new Set());
  
  const [pendingDuplicate, setPendingDuplicate] = useState<{ file: File; existingFileId: string } | null>(null);
  const [previewFile, setPreviewFile] = useState<{ name: string; dataUrl: string } | null>(null);
  const [showNaFlow, setShowNaFlow] = useState(false);
  const [naClientReason, setNaClientReason] = useState<string | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMilestoneRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  const [showMobileUploadOptions, setShowMobileUploadOptions] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alexChatOpen, setAlexChatOpen] = useState(false);
  const [counselingProviderLink, setCounselingProviderLink] = useState<string | null>(null);
  const [counselingProviderName, setCounselingProviderName] = useState<string | null>(null);
  const [counselingAttorneyCode, setCounselingAttorneyCode] = useState<string | null>(null);
  const [firmDisplayName, setFirmDisplayName] = useState<string | null>(null);
  const targetFixItemId = searchParams.get('fix');

  // Helper: update caseData in React state only (no localStorage)
  const updateCaseLocal = useCallback((updater: (c: Case) => Case): Case | null => {
    let result: Case | null = null;
    setCaseData(prev => {
      if (!prev) return prev;
      const updated = updater({ ...prev, checklist: prev.checklist.map(ci => ({ ...ci, files: [...ci.files] })) });
      result = updated;
      return updated;
    });
    return result;
  }, []);

  // Helper: log activity to Supabase only
  const logActivity = useCallback(async (caseIdVal: string, entry: { eventType: string; actorRole: string; actorName: string; description: string; itemId?: string }) => {
    try {
      await supabase.from('activity_log').insert({
        case_id: caseIdVal,
        event_type: entry.eventType,
        actor_role: entry.actorRole,
        actor_name: entry.actorName,
        description: entry.description,
        item_id: entry.itemId || null,
      });
    } catch (err) {
      console.error('Failed to log activity:', err);
    }
  }, []);

  useEffect(() => {
    if (!resolvedCaseId) return;

    const loadCase = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const { data: caseRow } = await supabase
          .from('cases')
          .select('*')
          .eq('id', resolvedCaseId)
          .maybeSingle();

        if (!caseRow) {
          setLoadError('Case not found. The link may be incorrect or expired.');
          setIsLoading(false);
          return;
        }

        // Load firm's credit counseling settings
        if (caseRow.firm_id) {
          const { data: firmData } = await supabase
            .from('firms')
            .select('name, counseling_provider_name, counseling_provider_link, counseling_attorney_code')
            .eq('id', caseRow.firm_id)
            .maybeSingle();

          if (firmData) {
            setCounselingProviderLink(firmData.counseling_provider_link || null);
            setCounselingProviderName(firmData.counseling_provider_name || null);
            setCounselingAttorneyCode(firmData.counseling_attorney_code || null);
          }
          setFirmDisplayName(firmData?.name || null);
        }

        const { data: checklistRows } = await supabase
          .from('checklist_items')
          .select('*')
          .eq('case_id', resolvedCaseId)
          .order('sort_order', { ascending: true });

        const { data: fileRows } = await supabase
          .from('files')
          .select('*')
          .eq('case_id', resolvedCaseId);

        const { data: activityRows } = await supabase
          .from('activity_log')
          .select('*')
          .eq('case_id', resolvedCaseId)
          .order('created_at', { ascending: true });

        // Generate public URLs for files that have storage_path
        const filesWithUrls = (fileRows || []).map((f) => {
          let displayUrl = f.data_url || '';
          if (f.storage_path && (!f.data_url || f.data_url === '')) {
            const { data: publicUrlData } = supabase.storage
              .from('case-documents')
              .getPublicUrl(f.storage_path);
            displayUrl = publicUrlData.publicUrl || '';
          }
          return { ...f, displayUrl };
        });

        // Build checklist items from Supabase data
        const checklist: ChecklistItem[] = (checklistRows || []).map(row => {
          const itemFiles = filesWithUrls
            .filter(f => f.checklist_item_id === row.id)
            .map(f => ({
              id: f.id,
              name: f.file_name,
              dataUrl: f.displayUrl,
              uploadedAt: f.uploaded_at || new Date().toISOString(),
              reviewStatus: (f.review_status || 'pending') as any,
              reviewNote: f.review_note || undefined,
              uploadedBy: (f.uploaded_by || 'client') as any,
            }));

          return {
            id: row.id,
            category: row.category,
            label: row.label,
            description: row.description || '',
            whyWeNeedThis: row.why_we_need_this || '',
            required: row.required ?? true,
            files: itemFiles,
            textEntry: row.text_value ? (row.text_value as any) : undefined,
            flaggedForAttorney: row.flagged_for_attorney ?? false,
            attorneyNote: row.attorney_note || undefined,
            correctionRequest: row.correction_status ? {
              reason: row.correction_reason || '',
              details: row.correction_details || undefined,
              requestedBy: row.correction_requested_by || '',
              requestedAt: row.correction_requested_at || '',
              targetFileId: row.correction_target_file_id || undefined,
              status: row.correction_status as 'open' | 'resolved',
            } : undefined,
            resubmittedAt: row.resubmitted_at || undefined,
            completed: row.completed ?? false,
            notApplicable: (row as any).not_applicable ?? false,
            notApplicableReason: (row as any).not_applicable_reason || undefined,
            notApplicableMarkedBy: (row as any).not_applicable_marked_by || undefined,
            notApplicableAt: (row as any).not_applicable_at || undefined,
          };
        });

        const activityLog = (activityRows || []).map(row => ({
          id: row.id,
          eventType: row.event_type as any,
          actorRole: (row.actor_role || 'system') as any,
          actorName: row.actor_name || 'System',
          description: row.description || '',
          timestamp: row.created_at || new Date().toISOString(),
          itemId: row.item_id || undefined,
        }));

        const c: Case = {
          id: caseRow.id,
          clientName: caseRow.client_name,
          clientEmail: caseRow.client_email,
          clientPhone: caseRow.client_phone || undefined,
          clientDob: caseRow.client_dob || undefined,
          caseCode: caseRow.case_code || undefined,
          isJointFiling: (caseRow as any).is_joint_filing ?? false,
          spouseName: (caseRow as any).spouse_name || undefined,
          spouseEmail: (caseRow as any).spouse_email || undefined,
          spousePhone: (caseRow as any).spouse_phone || undefined,
          spouseDob: (caseRow as any).spouse_dob || undefined,
          spouseCaseCode: (caseRow as any).spouse_case_code || undefined,
          chapterType: caseRow.chapter_type as any,
          assignedParalegal: caseRow.assigned_paralegal || '',
          assignedAttorney: caseRow.assigned_attorney || '',
          filingDeadline: caseRow.filing_deadline,
          createdAt: caseRow.created_at || new Date().toISOString(),
          lastClientActivity: caseRow.last_client_activity || undefined,
          checklist,
          activityLog,
          notes: [],
          checkpointsCompleted: [],
          urgency: (caseRow.urgency || 'normal') as any,
          status: (caseRow.status || 'active') as any,
          readyToFile: caseRow.ready_to_file ?? false,
          wizardStep: caseRow.wizard_step ?? 0,
        };

        setCaseData(c);
        setLanguage(((caseRow as any).client_language === 'es' ? 'es' : 'en'));
        setIsLoading(false);
        lastMilestoneRef.current = Math.floor(calculateProgress(c) / 25) * 25;

        if (targetFixItemId) {
          const targetPosition = getChecklistItemPosition(c, targetFixItemId);
          if (targetPosition) {
            setCurrentCategoryIdx(targetPosition.categoryIdx);
            setCurrentItemIdx(targetPosition.itemIdx);
            return;
          }
        }

        // Find the first category with incomplete items
        let resumeCatIdx = 0;
        let resumeItemIdx = 0;
        let found = false;
        for (let ci = 0; ci < CATEGORIES.length; ci++) {
          const catItems = c.checklist.filter(item => item.category === CATEGORIES[ci]);
          // Skip categories with no items entirely
          if (catItems.length === 0) continue;
          const firstIncomplete = catItems.findIndex(item => !isItemEffectivelyComplete(item));
          if (firstIncomplete >= 0) {
            resumeCatIdx = ci;
            resumeItemIdx = firstIncomplete;
            found = true;
            break;
          }
        }
        if (!found) {
          resumeCatIdx = CATEGORIES.length - 1;
          const lastCatItems = c.checklist.filter(item => item.category === CATEGORIES[resumeCatIdx]);
          resumeItemIdx = Math.max(0, lastCatItems.length - 1);
        }
        setCurrentCategoryIdx(resumeCatIdx);
        setCurrentItemIdx(resumeItemIdx);

        // Sync wizard_step to Supabase if it drifted
        if (c.wizardStep !== resumeCatIdx) {
          c.wizardStep = resumeCatIdx;
          supabase.from('cases').update({ wizard_step: resumeCatIdx }).eq('id', c.id).then(() => {});
        }
      } catch (err) {
        console.error('Failed to load case from database:', err);
        setLoadError('Could not load case data. Please refresh the page or contact your attorney\'s office.');
        setIsLoading(false);
      }
    };

    loadCase();
  }, [resolvedCaseId, navigate, targetFixItemId]);

  const triggerValidation = useCallback(async (fileId: string, dataUrl: string, itemLabel: string, caseIdForValidation: string) => {
    const expectedDocType = getExpectedDocType(itemLabel);
    setValidatingFiles(prev => new Set(prev).add(fileId));
    try {
      const result = await validateDocument(dataUrl, expectedDocType, caseIdForValidation);
      if (result) {
        const vr: FileValidationResult = {
          isCorrectDocumentType: result.is_correct_document_type, confidenceScore: result.confidence_score,
          extractedYear: result.extracted_year, extractedName: result.extracted_name,
          extractedInstitution: result.extracted_institution, issues: result.issues,
          suggestion: result.suggestion, validatorNotes: result.validator_notes,
          validationStatus: result.validation_status, validatedAt: result.validated_at,
        };
        // Auto-approve if validation passed cleanly (no warnings, no failures, no issues)
        const passedCleanly =
          result.validation_status === 'passed' &&
          (!result.issues || result.issues.length === 0);

        setCaseData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            checklist: prev.checklist.map(ci => ({
              ...ci,
              files: ci.files.map(fl => fl.id === fileId ? {
                ...fl,
                validationStatus: result.validation_status,
                validationResult: vr,
                ...(passedCleanly ? { reviewStatus: 'approved' as const, reviewNote: 'Auto-approved — passed AI validation' } : {}),
              } : fl),
            })),
          };
        });

        if (passedCleanly) {
          await supabase.from('files').update({
            review_status: 'approved',
            review_note: 'Auto-approved — passed AI validation',
          }).eq('id', fileId);
          logActivity(caseIdForValidation, { eventType: 'file_approved', actorRole: 'system', actorName: 'ClearPath AI', description: `Auto-approved ${itemLabel} — passed AI validation`, itemId: fileId });
        }

        logActivity(caseIdForValidation, { eventType: 'document_validated', actorRole: 'system', actorName: 'ClearPath AI', description: `Document validation ${result.validation_status} for ${itemLabel} (${Math.round(result.confidence_score * 100)}% confidence)`, itemId: fileId });
      } else {
        logActivity(caseIdForValidation, { eventType: 'document_validated', actorRole: 'system', actorName: 'ClearPath AI', description: `Validation service unavailable for ${itemLabel}`, itemId: fileId });
      }
    } catch { console.warn('Document validation failed silently'); }
    finally { setValidatingFiles(prev => { const next = new Set(prev); next.delete(fileId); return next; }); }
  }, [logActivity]);

  const handleValidationAction = useCallback((fileId: string, action: 'client-confirmed' | 'client-override', cRef: Case | null) => {
    if (!cRef) return;
    setCaseData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        checklist: prev.checklist.map(ci => ({
          ...ci,
          files: ci.files.map(fl => fl.id === fileId ? { ...fl, validationStatus: action } : fl),
        })),
      };
    });
    if (action === 'client-override') {
      logActivity(cRef.id, { eventType: 'document_validated', actorRole: 'client', actorName: cRef.clientName, description: `${cRef.clientName.split(' ')[0]} uploaded despite validation warning`, itemId: fileId });
    }
  }, [logActivity]);

  const jumpToItem = useCallback((itemId: string, cRef: Case | null) => {
    if (!cRef) return;
    const position = getChecklistItemPosition(cRef, itemId);
    if (!position) return;
    setWhyOpen(false); setShowSuccess(false); setShowMilestone(null); setShowStepTransition(null);
    setCurrentCategoryIdx(position.categoryIdx); setCurrentItemIdx(position.itemIdx);
    setSearchParams({ fix: itemId }, { replace: true });
  }, [setSearchParams]);

  const handleSidebarNavigate = useCallback((catIdx: number, itemIdx: number) => {
    setWhyOpen(false); setShowSuccess(false); setShowMilestone(null); setShowStepTransition(null);
    setCurrentCategoryIdx(catIdx);
    setCurrentItemIdx(itemIdx);
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  // Reset fields when item changes
  useEffect(() => {
    if (!caseData) return;
    const catItems = caseData.checklist.filter(item => item.category === CATEGORIES[currentCategoryIdx]);
    const item = catItems[currentItemIdx];
    if (item && item.label === EMPLOYER_LABEL) {
      setEmployerName(item.textEntry?.employerName || '');
      setEmployerAddress(item.textEntry?.employerAddress || '');
      setEmploymentStatus(
        item.textEntry?.selfEmployed ? 'self-employed'
          : item.textEntry?.notEmployed ? 'not-employed'
          : item.textEntry?.employerName ? 'employed'
          : null
      );
    } else {
      setEmployerName('');
      setEmployerAddress('');
      setEmploymentStatus(null);
    }
    setSsnValue('');
    setSsnVisible(false);
    setSsnError('');
    setPendingDuplicate(null);
    setShowNaFlow(false);
    setNaClientReason(null);
  }, [currentCategoryIdx, currentItemIdx, caseData]);


  if (isLoading || !caseData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
        <Logo size="md" clickable={false} />
        {loadError ? (
          <div className="mt-8 text-center max-w-md">
            <AlertTriangle className="w-10 h-10 text-warning mx-auto mb-4" />
            <p className="text-foreground font-medium mb-2">Having trouble loading your documents.</p>
            <p className="text-muted-foreground text-sm mb-6">{loadError}</p>
            <Button onClick={() => window.location.reload()} size="lg">Refresh Page</Button>
          </div>
        ) : (
          <div className="mt-8 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <span className="text-muted-foreground">Loading your documents…</span>
          </div>
        )}
      </div>
    );
  }

  if (caseData.checklist.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
        <Logo size="md" clickable={false} />
        <div className="mt-8 text-center max-w-md">
          <AlertTriangle className="w-10 h-10 text-warning mx-auto mb-4" />
          <p className="text-foreground font-medium mb-2">Having trouble loading your documents.</p>
          <p className="text-muted-foreground text-sm mb-6">Please refresh the page or contact your attorney's office.</p>
          <Button onClick={() => window.location.reload()} size="lg">Refresh Page</Button>
        </div>
      </div>
    );
  }

  // ─── Joint filing: which debtor is using this link? ───────────────
  const debtorMode = (searchParams.get('debtor') === 'spouse') ? 'spouse' : 'primary';
  const isSpouseMode = debtorMode === 'spouse';
  const displayName = isSpouseMode && caseData.spouseName ? caseData.spouseName : caseData.clientName;
  const displayFirstName = displayName.split(' ')[0];

  // Filter the checklist by debtor mode. Items intended for the spouse are tagged
  // with "(Spouse)" in their label. Strip that suffix when shown to the spouse.
  const visibleChecklist = caseData.checklist
    .filter(item => isSpouseMode ? item.label.includes('(Spouse)') : !item.label.includes('(Spouse)'))
    .map(item => isSpouseMode
      ? { ...item, label: item.label.replace(/\s*\(Spouse\)\s*$/i, '').trim() }
      : item);

  const categoryItems = visibleChecklist.filter(item => item.category === CATEGORIES[currentCategoryIdx]);

  // If current category is empty, advance to next non-empty one
  if (categoryItems.length === 0) {
    const nextNonEmpty = CATEGORIES.findIndex(
      (cat, idx) => idx > currentCategoryIdx && 
      visibleChecklist.filter(i => i.category === cat).length > 0
    );
    if (nextNonEmpty !== -1) {
      setTimeout(() => {
        setCurrentCategoryIdx(nextNonEmpty);
        setCurrentItemIdx(0);
      }, 0);
    }
    return null; // render nothing while transitioning
  }

  const currentItem = categoryItems[currentItemIdx];
  const progress = calculateProgress(caseData);
  const openCorrectionItem = getOpenCorrectionItem(caseData);
  const hasPortalCorrection = Boolean(openCorrectionItem);

  const isCheckpointItem = currentItem && currentItem.category === 'Agreements & Confirmation' && currentItem.label.includes('Confirmation');
  const isMultiUpload = currentItem && isMultiUploadItem(currentItem.label);
  const multiConfig = currentItem ? MULTI_UPLOAD_CONFIGS[currentItem.label] : undefined;
  const isTextEntry = currentItem && isTextEntryItem(currentItem.label);
  const isSSNEntry = false;
  const isSSNUpload = currentItem && (currentItem.label === SSN_LABEL || currentItem.label === SSN_LABEL_LEGACY);
  const isEmployerEntry = currentItem && currentItem.label === EMPLOYER_LABEL;
  const isBankStatements = currentItem && currentItem.label === 'Checking/Savings Statements (Last 6 Months)';
  const isDigitalWallet = currentItem && currentItem.label === 'Digital Wallet Statements';
  const isPlaidConnected = currentItem?.files.some(f => f.uploadedBy === 'plaid') ?? false;
  const currentItemHasOpenCorrection = currentItem?.correctionRequest?.status === 'open';
  const hasPendingReplacement = currentItem?.files.some(file => file.reviewStatus === 'pending') ?? false;
  const hasValidationIssue = currentItem?.files.some(f => f.validationStatus === 'warning' || f.validationStatus === 'failed') ?? false;

  const renderDuplicateWarning = () => {
    if (!pendingDuplicate) return null;
    return (
      <div className="surface-card border-warning/30 bg-warning/5 p-4 rounded-xl flex flex-col gap-2 mb-3">
        <p className="text-sm text-foreground">
          You already uploaded a file with this name. Do you want to replace it or keep both?
        </p>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => { handleFileAdd(pendingDuplicate.file, pendingDuplicate.existingFileId); }}>
            Replace existing
          </Button>
          <button className="text-sm text-muted-foreground hover:text-foreground transition-colors" onClick={() => { handleFileAdd(pendingDuplicate.file); }}>
            Keep both
          </button>
        </div>
      </div>
    );
  };

  const handleFileAdd = async (file: File, replaceFileId?: string) => {
    if (!currentItem) return;
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    setPendingDuplicate(null);

    // Show compression message for large files
    if (file.size > 4 * 1024 * 1024 && file.type.startsWith('image/')) {
      toast('This file is a bit large. We\'re compressing it for you...', { duration: 3000 });
    }

    // Check for HEIC/HEIF
    const isHeic = file.type === 'image/heic' || file.type === 'image/heif' ||
      file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
    if (isHeic) {
      toast('Converting your photo...', { duration: 3000 });
    }

    // Compress image if needed
    const processedFile = await compressImage(file);

    const newFileId = crypto.randomUUID();
    const uploadedAt = new Date().toISOString();

    // Upload to Supabase Storage
    const storagePath = `${caseData.id}/${currentItem.id}/${Date.now()}-${processedFile.name}`;
    const { error: storageError } = await supabase.storage
      .from('case-documents')
      .upload(storagePath, processedFile, { upsert: false });

    if (storageError) {
      console.error('Storage upload failed:', storageError);
      toast.error('Upload failed. Please try again.');
      return;
    }

    // Get a public URL for immediate display
    let displayUrl = '';
    const { data: publicUrlData } = supabase.storage
      .from('case-documents')
      .getPublicUrl(storagePath);
    displayUrl = publicUrlData.publicUrl || '';

    const newFile = {
      id: newFileId,
      name: processedFile.name,
      dataUrl: displayUrl,
      uploadedAt,
      reviewStatus: 'pending' as const,
      uploadedBy: 'client' as const,
      validationStatus: 'validating' as const,
    };

    // Update local React state
    setCaseData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        lastClientActivity: uploadedAt,
        checklist: prev.checklist.map(ci => {
          if (ci.id !== currentItem.id) return ci;
          let updatedFiles = [...ci.files];
          if (replaceFileId) {
            updatedFiles = updatedFiles.filter(f => f.id !== replaceFileId);
          }
          if (isMultiUpload || currentItemHasOpenCorrection) {
            updatedFiles = [...updatedFiles, newFile];
          } else {
            updatedFiles = [newFile];
          }
          return {
            ...ci,
            files: updatedFiles,
            completed: currentItemHasOpenCorrection ? ci.completed : true,
          };
        }),
      };
    });

    // Sync to Supabase
    (async () => {
      try {
        if (replaceFileId) {
          // Delete old file from storage and DB
          const { data: oldFile } = await supabase.from('files').select('storage_path').eq('id', replaceFileId).maybeSingle();
          if (oldFile?.storage_path) {
            await supabase.storage.from('case-documents').remove([oldFile.storage_path]);
          }
          await supabase.from('files').delete().eq('id', replaceFileId);
        }
        await supabase.from('files').insert({
          id: newFileId,
          case_id: caseData.id,
          checklist_item_id: currentItem.id,
          file_name: processedFile.name,
          storage_path: storagePath,
          data_url: '',
          uploaded_at: uploadedAt,
          review_status: 'pending',
          uploaded_by: 'client',
        });
        await supabase.from('checklist_items').update({ completed: true }).eq('id', currentItem.id);
        await supabase.from('cases').update({ last_client_activity: uploadedAt }).eq('id', caseData.id);
        await logActivity(caseData.id, {
          eventType: 'file_upload',
          actorRole: 'client',
          actorName: caseData.clientName,
          description: `${caseData.clientName.split(' ')[0]} uploaded ${processedFile.name} for ${currentItem.label}`,
          itemId: currentItem.id,
        });
      } catch (err) {
        console.error('Failed to sync file upload:', err);
      }
    })();

    // Trigger AI validation in the background (use signed URL for validation)
    if (displayUrl) {
      triggerValidation(newFileId, displayUrl, currentItem.label, caseData.id);
    }

    if (!currentItemHasOpenCorrection) {
      if (!isMultiUpload) {
        setShowSuccess(true);
        // Need to get updated caseData for milestone check
        setCaseData(prev => {
          if (!prev) return prev;
          setTimeout(() => {
            setShowSuccess(false);
            checkMilestoneAndAdvance(prev);
          }, 1500);
          return prev;
        });
      } else {
        toast.success(`${processedFile.name} added`, { duration: 1500 });
      }
    } else {
      toast.success(`${processedFile.name} added`, { duration: 1500 });
    }
  };

  const handleFileDelete = (fileId: string) => {
    if (!currentItem) return;
    setCaseData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        checklist: prev.checklist.map(ci => {
          if (ci.id !== currentItem.id) return ci;
          const updatedFiles = ci.files.filter(f => f.id !== fileId);
          return { ...ci, files: updatedFiles, completed: updatedFiles.length > 0 ? ci.completed : false };
        }),
      };
    });

    // Sync deletion to Supabase
    (async () => {
      try {
        const { data: fileRecord } = await supabase.from('files').select('storage_path').eq('id', fileId).maybeSingle();
        if (fileRecord?.storage_path) {
          await supabase.storage.from('case-documents').remove([fileRecord.storage_path]);
        }
        await supabase.from('files').delete().eq('id', fileId);
        // Check if any files remain
        const { data: remaining } = await supabase.from('files').select('id').eq('checklist_item_id', currentItem.id);
        if (!remaining || remaining.length === 0) {
          await supabase.from('checklist_items').update({ completed: false }).eq('id', currentItem.id);
        }
      } catch (err) {
        console.error('Failed to sync file deletion:', err);
      }
    })();
  };

  const handleSingleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentItem) {
      if (event.target) event.target.value = '';
      return;
    }

    const existingFile = currentItem.files.find(f => f.name === file.name);
    if (existingFile) {
      setPendingDuplicate({ file, existingFileId: existingFile.id });
      event.target.value = '';
      return;
    }

    handleFileAdd(file);
    event.target.value = '';
  };

  const completeCorrectionResubmission = () => {
    if (!currentItem || !hasPendingReplacement) return;

    const timestamp = new Date().toISOString();
    setCaseData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        lastClientActivity: timestamp,
        checklist: prev.checklist.map(ci => {
          if (ci.id !== currentItem.id) return ci;
          return {
            ...ci,
            completed: true,
            resubmittedAt: timestamp,
            correctionRequest: ci.correctionRequest ? { ...ci.correctionRequest, status: 'resolved' as const } : undefined,
          };
        }),
      };
    });

    logActivity(caseData.id, {
      eventType: 'file_reupload',
      actorRole: 'client',
      actorName: caseData.clientName,
      description: `${caseData.clientName.split(' ')[0]} resubmitted ${currentItem.label}`,
      itemId: currentItem.id,
    });

    // Sync to Supabase
    (async () => {
      try {
        await supabase.from('checklist_items').update({
          completed: true,
          resubmitted_at: timestamp,
          correction_status: 'resolved',
        }).eq('id', currentItem.id);
        await supabase.from('cases').update({ last_client_activity: timestamp }).eq('id', caseData.id);
      } catch (err) { console.error('Failed to sync resubmission:', err); }
    })();

    setSearchParams({}, { replace: true });
    toast.success('Replacement submitted for review.');
    advanceToNext();
  };

  const handleContinueMultiUpload = () => {
    if (!currentItem || !multiConfig) return;

    if (currentItemHasOpenCorrection) {
      completeCorrectionResubmission();
      return;
    }

    const fileCount = currentItem.files.length;
    if (fileCount === 0) return;
    if (fileCount < multiConfig.minRecommended && !showLowCountConfirm) {
      setShowLowCountConfirm(true);
      return;
    }
    setShowLowCountConfirm(false);
    checkMilestoneAndAdvance(caseData);
  };

  const handleLowCountConfirm = () => {
    setShowLowCountConfirm(false);
    logActivity(caseData.id, {
      eventType: 'checkpoint_completed',
      actorRole: 'client',
      actorName: caseData.clientName,
      description: `${caseData.clientName.split(' ')[0]} confirmed single ${multiConfig?.singularLabel} upload`,
      itemId: currentItem?.id,
    });
    checkMilestoneAndAdvance(caseData);
  };

  const handleCheckpointConfirm = () => {
    if (!currentItem) return;

    const timestamp = new Date().toISOString();
    setCaseData(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        lastClientActivity: timestamp,
        checkpointsCompleted: [...prev.checkpointsCompleted, currentItem.id],
        checklist: prev.checklist.map(ci => {
          if (ci.id !== currentItem.id) return ci;
          return { ...ci, completed: true };
        }),
      };
      // Schedule milestone check
      setTimeout(() => {
        setCheckpointConfirmed(false);
        checkMilestoneAndAdvance(updated);
      }, 0);
      return updated;
    });

    logActivity(caseData.id, {
      eventType: 'checkpoint_completed',
      actorRole: 'client',
      actorName: caseData.clientName,
      description: `${caseData.clientName.split(' ')[0]} completed the ${currentItem.label}`,
      itemId: currentItem.id,
    });

    // Sync to Supabase
    (async () => {
      try {
        await supabase.from('checklist_items').update({ completed: true }).eq('id', currentItem.id);
        await supabase.from('checkpoints').insert({
          case_id: caseData.id,
          checkpoint_type: currentItem.label,
          confirmed_by: caseData.clientName,
        });
        await supabase.from('cases').update({ last_client_activity: timestamp }).eq('id', caseData.id);
      } catch (err) { console.error('Failed to sync checkpoint:', err); }
    })();
  };

  const checkMilestoneAndAdvance = (updated: Case) => {
    const newProgress = calculateProgress(updated);
    const milestoneHit = MILESTONE_THRESHOLDS.find(threshold => newProgress >= threshold && lastMilestoneRef.current < threshold);
    if (milestoneHit) {
      lastMilestoneRef.current = milestoneHit;
      setShowMilestone(milestoneHit);
    } else {
      advanceToNext();
    }
  };

  const advanceToNext = () => {
    setWhyOpen(false);
    if (currentItemIdx < categoryItems.length - 1) {
      setCurrentItemIdx(currentItemIdx + 1);
    } else if (currentCategoryIdx < CATEGORIES.length - 1) {
      const requiredIncomplete = categoryItems.filter(item => item.required && !isItemEffectivelyComplete(item));
      if (requiredIncomplete.length > 0) {
        toast('Hang on — there are still a few things we need in this section before you can move on.', { duration: 4000 });
        const firstIdx = categoryItems.findIndex(item => item.required && !isItemEffectivelyComplete(item));
        if (firstIdx >= 0) setCurrentItemIdx(firstIdx);
        return;
      }
      setShowStepTransition(currentCategoryIdx);
    }
  };

  const handleStepTransitionContinue = () => {
    if (showStepTransition === null || !caseData) return;
    const completedStep = showStepTransition + 1;
    // Find next non-empty category
    let nextCategory = showStepTransition + 1;
    while (nextCategory < CATEGORIES.length) {
      const nextCatItems = caseData.checklist.filter(
        item => item.category === CATEGORIES[nextCategory]
      );
      if (nextCatItems.length > 0) break;
      nextCategory++;
    }
    if (nextCategory >= CATEGORIES.length) {
      nextCategory = CATEGORIES.length - 1;
    }
    setShowStepTransition(null);
    setCurrentCategoryIdx(nextCategory);
    setCurrentItemIdx(0);

    // Update local state
    setCaseData(prev => prev ? { ...prev, wizardStep: nextCategory } : prev);

    // Persist wizard step to Supabase
    supabase.from('cases').update({ wizard_step: nextCategory }).eq('id', caseData.id).then(() => {});

    // Trigger momentum SMS
    const updatedProgress = calculateProgress(caseData);
    if (updatedProgress < 100) {
      const nextStepName = CATEGORIES[nextCategory] || 'the next step';
      sendMomentumSms(
        caseData.clientPhone,
        caseData.clientName,
        caseData.caseCode || caseData.id,
        caseData.id,
        completedStep,
        updatedProgress,
        nextStepName,
      ).catch((err) => console.error('Momentum SMS error:', err));
    }
  };

  const goBack = () => {
    setWhyOpen(false);
    if (currentItemIdx > 0) {
      setCurrentItemIdx(currentItemIdx - 1);
    } else if (currentCategoryIdx > 0) {
      const previousCategory = currentCategoryIdx - 1;
      setCurrentCategoryIdx(previousCategory);
      const previousItems = caseData.checklist.filter(item => item.category === CATEGORIES[previousCategory]);
      setCurrentItemIdx(previousItems.length - 1);
    }
  };

  const handleSkip = () => {
    if (!currentItem) return;
    logActivity(caseData.id, {
      eventType: 'checkpoint_completed',
      actorRole: 'client',
      actorName: caseData.clientName,
      description: `${caseData.clientName.split(' ')[0]} skipped ${currentItem.label}`,
      itemId: currentItem.id,
    });
    toast('No worries — you can always come back to this one later.', { duration: 2000 });
    advanceToNext();
  };

  const CLIENT_NA_OPTIONS = [
    { label: 'I am not currently employed', reason: 'Client indicated not employed' },
    { label: 'I do not own this asset', reason: 'Client indicated does not own this asset' },
    { label: 'I am not sure — my attorney can help', reason: 'Client unsure — needs attorney follow-up' },
  ];

  const handleClientNA = (reason: string) => {
    if (!currentItem) return;
    const timestamp = new Date().toISOString();
    const actorName = caseData.clientName;

    setCaseData(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        lastClientActivity: timestamp,
        checklist: prev.checklist.map(ci => {
          if (ci.id !== currentItem.id) return ci;
          return {
            ...ci,
            notApplicable: true,
            notApplicableReason: reason,
            notApplicableMarkedBy: 'client',
            notApplicableAt: timestamp,
          };
        }),
      };
      setShowNaFlow(false);
      setNaClientReason(null);
      toast.success('Got it — your attorney will be notified.', { duration: 2000 });
      setTimeout(() => { checkMilestoneAndAdvance(updated); }, 800);
      return updated;
    });

    logActivity(caseData.id, {
      eventType: 'item_not_applicable',
      actorRole: 'client',
      actorName,
      description: `${actorName.split(' ')[0]} indicated ${currentItem.label} is not applicable — ${reason}`,
      itemId: currentItem.id,
    });

    // Sync to Supabase
    (async () => {
      try {
        await supabase.from('checklist_items').update({
          not_applicable: true,
          not_applicable_reason: reason,
          not_applicable_marked_by: 'client',
          not_applicable_at: timestamp,
        }).eq('id', currentItem.id);
        await supabase.from('cases').update({ last_client_activity: timestamp }).eq('id', caseData.id);
      } catch (err) { console.error('Failed to sync N/A:', err); }
    })();
  };

  const handleDismissMilestone = () => {
    setShowMilestone(null);
    if (lastMilestoneRef.current === 100) return;
    advanceToNext();
  };

  const handleContinueSingle = () => {
    if (!currentItem) return;
    if (currentItemHasOpenCorrection) {
      completeCorrectionResubmission();
      return;
    }
    if (!currentItem.completed && currentItem.required) {
      toast('Take your time — when you\'ve found it, just tap the upload area above.', { duration: 4000 });
      return;
    }
    advanceToNext();
  };

  const handleEmployerContinue = () => {
    if (!currentItem) return;

    if (employmentStatus === 'self-employed' || employmentStatus === 'not-employed') {
      const statusLabel = employmentStatus === 'self-employed' ? 'is self-employed' : 'is not currently employed';
      const textEntry = {
        employerName: '',
        selfEmployed: employmentStatus === 'self-employed',
        notEmployed: employmentStatus === 'not-employed',
        savedAt: new Date().toISOString(),
      };

      setCaseData(prev => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          lastClientActivity: new Date().toISOString(),
          checklist: prev.checklist.map(ci => {
            if (ci.id !== currentItem.id) return ci;
            return { ...ci, textEntry, completed: true };
          }),
        };
        setShowSuccess(true);
        setTimeout(() => { setShowSuccess(false); checkMilestoneAndAdvance(updated); }, 1500);
        return updated;
      });

      logActivity(caseData.id, {
        eventType: 'checkpoint_completed',
        actorRole: 'client',
        actorName: caseData.clientName,
        description: `${caseData.clientName.split(' ')[0]} indicated ${caseData.clientName.split(' ')[0]} ${statusLabel}`,
        itemId: currentItem.id,
      });

      // Sync to Supabase
      (async () => {
        try {
          await supabase.from('checklist_items').update({
            completed: true,
            text_value: textEntry,
          }).eq('id', currentItem.id);
          await supabase.from('cases').update({ last_client_activity: new Date().toISOString() }).eq('id', caseData.id);
        } catch (err) { console.error('Failed to sync employer:', err); }
      })();
      return;
    }

    const textEntry = {
      employerName: employerName.trim(),
      savedAt: new Date().toISOString(),
    };

    setCaseData(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        lastClientActivity: new Date().toISOString(),
        checklist: prev.checklist.map(ci => {
          if (ci.id !== currentItem.id) return ci;
          return { ...ci, textEntry, completed: true };
        }),
      };
      setShowSuccess(true);
      setTimeout(() => { setShowSuccess(false); checkMilestoneAndAdvance(updated); }, 1500);
      return updated;
    });

    logActivity(caseData.id, {
      eventType: 'checkpoint_completed',
      actorRole: 'client',
      actorName: caseData.clientName,
      description: `${caseData.clientName.split(' ')[0]} provided employer information: ${employerName.trim()}`,
      itemId: currentItem.id,
    });

    // Sync to Supabase
    (async () => {
      try {
        await supabase.from('checklist_items').update({
          completed: true,
          text_value: textEntry,
        }).eq('id', currentItem.id);
        await supabase.from('cases').update({ last_client_activity: new Date().toISOString() }).eq('id', caseData.id);
      } catch (err) { console.error('Failed to sync employer:', err); }
    })();
  };

  // ─── SSN helpers
  const formatSSN = (raw: string): string => {
    const digits = raw.replace(/\D/g, '').slice(0, 9);
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  };

  const ssnDigits = ssnValue.replace(/\D/g, '');
  const ssnFormatted = formatSSN(ssnValue);
  const ssnIsValid = ssnDigits.length === 9;

  const handleSSNChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const cleaned = input.replace(/[^\d-]/g, '');
    const digits = cleaned.replace(/\D/g, '').slice(0, 9);
    setSsnValue(digits);
    setSsnError('');
  };

  const handleSSNContinue = () => {
    if (!currentItem) return;
    if (!ssnIsValid) {
      setSsnError('Please enter all 9 digits of your Social Security number.');
      return;
    }

    const formatted = formatSSN(ssnValue);
    const textEntry = {
      employerName: ssnDigits,
      savedAt: new Date().toISOString(),
    };

    setCaseData(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        lastClientActivity: new Date().toISOString(),
        checklist: prev.checklist.map(ci => {
          if (ci.id !== currentItem.id) return ci;
          return { ...ci, textEntry, completed: true };
        }),
      };
      setShowSuccess(true);
      setTimeout(() => { setShowSuccess(false); checkMilestoneAndAdvance(updated); }, 1500);
      return updated;
    });

    logActivity(caseData.id, {
      eventType: 'checkpoint_completed',
      actorRole: 'client',
      actorName: caseData.clientName,
      description: `${caseData.clientName.split(' ')[0]} provided Social Security Number`,
      itemId: currentItem.id,
    });

    // Store encrypted SSN in Supabase client_info
    (async () => {
      try {
        const { data: existing } = await supabase
          .from('client_info')
          .select('id')
          .eq('case_id', caseData.id)
          .maybeSingle();

        if (existing) {
          await supabase.from('client_info').update({ ssn_encrypted: formatted }).eq('case_id', caseData.id);
        } else {
          await supabase.from('client_info').insert({
            case_id: caseData.id,
            ssn_encrypted: formatted,
            full_legal_name: caseData.clientName,
            email: caseData.clientEmail,
            phone: caseData.clientPhone || '',
          });
        }
        await supabase.from('checklist_items').update({
          completed: true,
          text_value: textEntry,
        }).eq('id', currentItem.id);
      } catch (err) {
        console.error('Failed to sync SSN:', err);
      }
    })();
  };

  const showUrgencyBanner = caseData.urgency !== 'normal' && !showMilestone;
  const daysLeft = Math.max(0, Math.ceil((new Date(caseData.filingDeadline).getTime() - Date.now()) / 86400000));

  const pendingCount = caseData.checklist.filter(i => !i.notApplicable && !isItemEffectivelyComplete(i)).length;

  // Collect all open corrections
  const openCorrections = caseData.checklist.filter(i => i.correctionRequest?.status === 'open');
  const showMultiCorrectionScreen = openCorrections.length >= 2;

  // Sidebar component for reuse
  const sidebarContent = (
    <WizardSidebar
      checklist={caseData.checklist}
      currentCategoryIdx={currentCategoryIdx}
      currentItemIdx={currentItemIdx}
      onNavigate={handleSidebarNavigate}
      onClose={() => setSidebarOpen(false)}
    />
  );

  // Desktop sidebar (always visible on lg+)
  const desktopSidebar = (
    <div className="hidden lg:block w-[220px] flex-shrink-0 border-r border-border h-screen sticky top-0 overflow-y-auto">
      <WizardSidebar
        checklist={caseData.checklist}
        currentCategoryIdx={currentCategoryIdx}
        currentItemIdx={currentItemIdx}
        onNavigate={handleSidebarNavigate}
      />
    </div>
  );

  // Mobile sidebar overlay
  const mobileSidebar = (
    <AnimatePresence>
      {sidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute left-0 top-0 bottom-0 w-[280px] shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            {sidebarContent}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (progress === 100 && !showMilestone && !showSuccess) {
    const attorneyName = caseData.assignedAttorney || 'your attorney';
    return (
      <div className="min-h-screen flex flex-row">
        {desktopSidebar}
        {mobileSidebar}
        <div className="flex-1 flex flex-col min-h-screen">
          {hasPortalCorrection && openCorrectionItem && (
            <CorrectionBanner onFixNow={() => jumpToItem(openCorrectionItem.id, caseData)} isOnCorrectionItem={false} />
          )}
          <div className="flex-1 flex items-center justify-center px-6 py-16">
            <motion.div {...pageTransition} className="max-w-md mx-auto text-center">
              {/* Animated SVG checkmark */}
              <div className="relative w-28 h-28 mx-auto mb-8">
                {/* Radial glow */}
                <div className="absolute inset-0 rounded-full" style={{
                  background: 'radial-gradient(circle, hsl(var(--primary) / 0.08) 0%, transparent 70%)',
                  transform: 'scale(2.5)',
                }} />
                <svg viewBox="0 0 100 100" className="w-28 h-28 relative z-10">
                  <motion.circle
                    cx="50" cy="50" r="45"
                    fill="none"
                    stroke="hsl(var(--success))"
                    strokeWidth="3"
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    style={{ filter: 'drop-shadow(0 0 8px hsl(var(--success) / 0.3))' }}
                  />
                  <motion.path
                    d="M30 52 L44 66 L70 38"
                    fill="none"
                    stroke="hsl(var(--success))"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.5, ease: 'easeOut' }}
                  />
                </svg>
              </div>

              <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
                You did it.
              </h2>
              <p className="text-muted-foreground text-lg mb-10 leading-relaxed">
                {displayFirstName ? `${displayFirstName}, every` : 'Every'} document has been sent to {attorneyName}. You've done your part — they'll take it from here.
              </p>

              {/* Reassurance card */}
              <div className="surface-card p-6 text-left rounded-xl space-y-3 mb-8">
                {caseData.assignedAttorney && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold text-sm">{caseData.assignedAttorney.charAt(0)}</span>
                    </div>
                    <p className="text-foreground font-medium text-sm">{caseData.assignedAttorney}</p>
                  </div>
                )}
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your attorney will review everything and be in touch within 1–2 business days.
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Questions? Reply to the text we sent you.
                </p>
              </div>

              <Button variant="ghost" onClick={() => setSidebarOpen(true)} size="lg" className="w-full max-w-xs mb-2 lg:hidden">
                Review my documents
              </Button>
              <button
                onClick={() => handleSidebarNavigate(0, 0)}
                className="text-sm text-muted-foreground hover:text-primary transition-colors block mx-auto lg:hidden"
              >
                ← Go back to review
              </button>
              {/* Desktop: just a text link since sidebar is always visible */}
              <button
                onClick={() => handleSidebarNavigate(0, 0)}
                className="text-sm text-muted-foreground hover:text-primary transition-colors hidden lg:block mx-auto mt-2"
              >
                ← Go back to review
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  // Multi-correction action screen
  if (showMultiCorrectionScreen) {
    return (
      <div className="min-h-screen flex flex-row">
        {desktopSidebar}
        {mobileSidebar}
        <div className="flex-1 flex flex-col min-h-screen">
          <WizardHeader progress={progress} step={currentCategoryIdx + 1} totalSteps={CATEGORIES.length} stepName={CATEGORIES[currentCategoryIdx]} onMenuClick={() => setSidebarOpen(true)} firmDisplayName={firmDisplayName} />
          <div className="flex-1 flex items-center justify-center px-6 pb-24">
            <motion.div {...pageTransition} className="max-w-md mx-auto w-full">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-warning" />
                </div>
                <h2 className="font-display text-2xl font-bold text-foreground mb-2">Your attorney needs a few things</h2>
                <p className="text-muted-foreground text-sm">Tap any item below to fix it — your attorney is waiting on these before they can move forward.</p>
              </div>
              <div className="space-y-2 mb-6">
                {openCorrections.map(item => {
                  const position = getChecklistItemPosition(caseData, item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (position) handleSidebarNavigate(position.categoryIdx, position.itemIdx);
                      }}
                      className="w-full text-left surface-card p-4 rounded-xl border border-destructive/20 hover:border-destructive/40 transition-colors"
                    >
                      <p className="text-foreground font-medium text-sm">{item.label}</p>
                      {item.correctionRequest?.reason && (
                        <p className="text-muted-foreground text-xs mt-1">{item.correctionRequest.reason}</p>
                      )}
                    </button>
                  );
                })}
              </div>
              <Button
                onClick={() => {
                  const first = openCorrections[0];
                  const pos = getChecklistItemPosition(caseData, first.id);
                  if (pos) handleSidebarNavigate(pos.categoryIdx, pos.itemIdx);
                }}
                size="lg"
                className="w-full"
              >
                Start fixing these →
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  const getClientFileBadgeClass = (status: 'pending' | 'approved' | 'correction-requested' | 'overridden') => {
    if (status === 'correction-requested') return 'bg-warning/10 text-warning border-warning/20';
    if (status === 'approved' || status === 'overridden') return 'bg-success/10 text-success border-success/20';
    return 'bg-warning/10 text-warning border-warning/20';
  };

  const renderCorrectionFileList = () => (
    <div className="space-y-2">
      {currentItem?.files.map(file => (
        <div key={file.id} className="surface-card p-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-foreground font-medium truncate">{file.name}</p>
            <p className="text-sm text-muted-foreground">Uploaded</p>
          </div>
          <Badge className={`${getClientFileBadgeClass(file.reviewStatus)} text-xs`}>
            {file.reviewStatus === 'correction-requested'
              ? 'Correction Requested'
              : file.reviewStatus === 'overridden'
                ? 'Approved'
                : file.reviewStatus === 'approved'
                  ? 'Approved'
                  : 'Pending Review'}
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => handleFileDelete(file.id)}>
            <Trash2 className="w-4 h-4" /> Delete
          </Button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-row">
      {desktopSidebar}
      {mobileSidebar}
      <div className="flex-1 flex flex-col min-h-screen">
      <WizardHeader
        progress={progress}
        step={currentCategoryIdx + 1}
        totalSteps={CATEGORIES.length}
        stepName={CATEGORIES[currentCategoryIdx]}
        onMenuClick={() => setSidebarOpen(true)}
        firmDisplayName={firmDisplayName}
      />

      {hasPortalCorrection && openCorrectionItem && (
        <CorrectionBanner
          onFixNow={() => jumpToItem(openCorrectionItem.id, caseData)}
          isOnCorrectionItem={currentItem?.id === openCorrectionItem.id}
        />
      )}

      {showUrgencyBanner && (
        <div className={`px-4 py-3 text-center text-sm font-medium ${
          caseData.urgency === 'critical'
            ? 'bg-destructive/10 text-destructive'
            : 'bg-warning/10 text-warning'
        }`}>
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          {caseData.urgency === 'critical'
            ? `Your filing date is in ${daysLeft} days — let's try to wrap up today so nothing gets delayed.`
            : 'Your filing date is coming up soon. Finishing these last items keeps your case on track.'}
        </div>
      )}

      <div className="flex-1 flex items-center justify-center px-6 lg:px-12 pb-24">
        <AnimatePresence mode="wait">
          {showStepTransition !== null ? (
            <StepTransition
              key="step-transition"
              completedStepIdx={showStepTransition}
              caseData={caseData}
              onContinue={handleStepTransitionContinue}
            />
          ) : showMilestone !== null ? (
            <motion.div key="milestone" {...pageTransition} className="max-w-md mx-auto text-center">
              {showMilestone === 25 && (
                <>
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }} className="w-20 h-20 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-6">
                    <Flame className="w-10 h-10 text-warning" />
                  </motion.div>
                  <h2 className="font-display text-3xl font-bold text-foreground mb-4">You're off to a strong start.</h2>
                  <p className="text-muted-foreground text-lg mb-8 leading-relaxed">Quarter of the way there. Every document you've uploaded is one less thing standing between you and your fresh start.</p>
                  <Button onClick={handleDismissMilestone} size="lg" className="w-full max-w-xs">Keep the momentum →</Button>
                </>
              )}
              {showMilestone === 50 && (
                <>
                  <div className="relative w-20 h-20 mx-auto mb-6">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }} className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                      <Star className="w-16 h-16 text-primary" />
                    </motion.div>
                    {/* Confetti dots */}
                    {[...Array(8)].map((_, i) => {
                      const angle = (i / 8) * Math.PI * 2;
                      const colors = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(172 100% 38%)', 'hsl(45 93% 58%)', 'hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))'];
                      return (
                        <motion.div
                          key={i}
                          initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                          animate={{
                            x: Math.cos(angle) * 60,
                            y: Math.sin(angle) * 60,
                            scale: [0, 1.2, 0.8],
                            opacity: [0, 1, 0],
                          }}
                          transition={{ duration: 1.2, delay: 0.3 + i * 0.05, ease: 'easeOut' }}
                          className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full -translate-x-1/2 -translate-y-1/2"
                          style={{ backgroundColor: colors[i] }}
                        />
                      );
                    })}
                  </div>
                  <h2 className="font-display text-3xl font-bold text-foreground mb-4">Halfway there — seriously.</h2>
                  <p className="text-muted-foreground text-lg mb-8 leading-relaxed">This is the hardest part for most people and you pushed through it. Your attorney already has enough to start working on your case.</p>
                  <Button onClick={handleDismissMilestone} size="lg" className="w-full max-w-xs">Let's finish this →</Button>
                </>
              )}
              {showMilestone === 75 && (
                <>
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }} className="w-20 h-20 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-6">
                    <Zap className="w-10 h-10 text-warning" />
                  </motion.div>
                  <h2 className="font-display text-3xl font-bold text-foreground mb-4">Almost done — don't stop now.</h2>
                  <p className="text-muted-foreground text-lg mb-8 leading-relaxed">Three quarters of the way there. Your attorney is waiting on just a few more things before they can move forward.</p>
                  <Button onClick={handleDismissMilestone} size="lg" className="w-full max-w-xs">Finish strong →</Button>
                </>
              )}
              {showMilestone === 100 && (
                <>
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }} className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10 text-success" />
                  </motion.div>
                  <h2 className="font-display text-3xl font-bold text-foreground mb-4">Every document is in.</h2>
                  <p className="text-muted-foreground text-lg mb-8 leading-relaxed">You've done your part — your attorney will take it from here.</p>
                  <Button onClick={handleDismissMilestone} size="lg" className="w-full max-w-xs">See summary →</Button>
                </>
              )}
            </motion.div>
          ) : showSuccess ? (
            <motion.div key="success" {...pageTransition} className="max-w-md mx-auto text-center">
              {(() => {
                const IconComp = (currentItem && DOCUMENT_ICONS[currentItem.label]) || CheckCircle2;
                const message = (currentItem && SUCCESS_MESSAGES[currentItem.label]) || "Saved — one step closer.";
                const nextLabel = currentItemIdx < categoryItems.length - 1
                  ? categoryItems[currentItemIdx + 1]?.label
                  : currentCategoryIdx < CATEGORIES.length - 1
                    ? CATEGORIES[currentCategoryIdx + 1]
                    : null;
                return (
                  <>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                      className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-5"
                    >
                      <IconComp className="w-10 h-10 text-success" />
                    </motion.div>
                    <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-2 leading-snug">
                      {message}
                    </h2>
                    {nextLabel && (
                      <p className="text-muted-foreground text-sm mt-3">
                        Next: {nextLabel}
                      </p>
                    )}
                  </>
                );
              })()}
            </motion.div>
          ) : currentItem ? (
            <motion.div key={currentItem.id} {...pageTransition} className="max-w-md lg:max-w-xl mx-auto w-full">
              <header className="mb-6">
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2 leading-tight">
                  {currentItem.label}
                </h2>
                {WARM_SUBTITLES[currentItem.label] && (
                  <p className="text-primary/80 text-sm font-body leading-relaxed">
                    {WARM_SUBTITLES[currentItem.label]}
                  </p>
                )}
                {(() => {
                  const sectionItems = caseData.checklist.filter(i => i.category === currentItem.category);
                  const sectionDone = sectionItems.filter(isItemEffectivelyComplete).length;
                  return (
                    <p className="text-xs text-muted-foreground mt-1">
                      {sectionDone} of {sectionItems.length} done in {currentItem.category}
                    </p>
                  );
                })()}
              </header>



              {currentItem?.label === 'Credit Counseling Certificate' && (() => {
                const safeCounselingUrl = counselingProviderLink
                  ? counselingProviderLink.startsWith('http://') || counselingProviderLink.startsWith('https://')
                    ? counselingProviderLink
                    : `https://${counselingProviderLink}`
                  : null;
                return (
                <div className="mt-4 mb-6 rounded-xl p-4" style={{ background: 'rgba(0,194,168,0.05)', border: '1px solid rgba(0,194,168,0.2)' }}>
                  <p className="font-body font-semibold text-[13px] text-foreground mb-1">
                    Complete your credit counseling
                  </p>
                  <p className="text-[12px] text-muted-foreground mb-3" style={{ lineHeight: '1.6' }}>
                    The court requires this before filing. It takes about 60–90 minutes. After completing it, download your certificate and upload it here.
                  </p>
                  {safeCounselingUrl ? (
                    <div className="space-y-2">
                      <a
                        href={safeCounselingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-center font-body font-semibold text-[13px] text-primary-foreground bg-primary rounded-xl py-3 hover:opacity-90 transition-opacity"
                      >
                        {counselingProviderName ? `Start with ${counselingProviderName} →` : 'Complete Credit Counseling →'}
                      </a>
                      {counselingAttorneyCode && (
                        <p className="text-[11px] text-muted-foreground text-center">
                          Use attorney code <span className="font-semibold text-foreground">{counselingAttorneyCode}</span> for a discounted rate
                        </p>
                      )}
                    </div>
                  ) : (
                    <a
                      href="https://www.justice.gov/ust/credit-counseling-debtor-education-information"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center font-body font-semibold text-[13px] text-primary border border-primary/30 rounded-xl py-3 hover:bg-primary/5 transition-colors"
                    >
                      Find an approved provider →
                    </a>
                  )}
                </div>
                );
              })()}

              {isCheckpointItem ? (
                <div className="space-y-6">
                  <div className="surface-card p-6">
                    <p className="text-foreground leading-relaxed">
                      {currentItem.whyWeNeedThis}
                    </p>
                  </div>
                  <label className="flex items-start gap-3 cursor-pointer p-4 rounded-lg hover:bg-[hsl(var(--surface-hover))] transition-colors">
                    <input
                      type="checkbox"
                      checked={checkpointConfirmed}
                      onChange={event => setCheckpointConfirmed(event.target.checked)}
                      className="mt-1 w-5 h-5 rounded accent-primary"
                    />
                    <span className="text-foreground">
                      I confirm this is accurate to the best of my knowledge
                    </span>
                  </label>
                </div>
              ) : isSSNEntry ? (
                <div className="space-y-5">
                  <div className="surface-card p-4 flex items-start gap-3 border-primary/20">
                    <Lock className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Your SSN is encrypted before storage. Only your attorney's office can access it.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Social Security Number</label>
                    <div className="relative">
                      <Input
                        type={ssnVisible ? 'text' : 'password'}
                        value={formatSSN(ssnValue)}
                        onChange={handleSSNChange}
                        placeholder="XXX-XX-XXXX"
                        className="bg-input border-border rounded-[10px] pr-10 text-lg tracking-wider font-mono"
                        maxLength={11}
                        inputMode="numeric"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => setSsnVisible(!ssnVisible)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {ssnVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {ssnError && (
                      <p className="text-sm text-destructive">{ssnError}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {ssnDigits.length}/9 digits entered
                    </p>
                  </div>

                  {currentItem.completed && currentItem.textEntry && (
                    <div className="surface-card glow-success p-4 flex items-center gap-3">
                      <CheckCircle2 className="w-6 h-6 text-success flex-shrink-0" />
                      <div>
                        <p className="text-foreground font-medium text-sm">
                          SSN: •••-••-{currentItem.textEntry.employerName?.slice(-4) || '••••'}
                        </p>
                        <p className="text-muted-foreground text-xs">Previously saved</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : isEmployerEntry ? (
                <div className="space-y-5">
                  {employmentStatus === 'self-employed' || employmentStatus === 'not-employed' ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="surface-card p-6 text-center"
                    >
                      <Briefcase className="w-10 h-10 text-primary mx-auto mb-3" />
                      <p className="text-foreground font-medium">
                        {employmentStatus === 'self-employed'
                          ? "Got it — we'll note that you are self-employed on your case."
                          : "Got it — we'll note this on your case."}
                      </p>
                    </motion.div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Employer Name</label>
                        <Input
                          value={employerName}
                          onChange={e => setEmployerName(e.target.value)}
                          placeholder="Your employer's company name"
                          className="bg-input border-border rounded-[10px]"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Your employer's address will be pulled from your pay stubs automatically</p>
                    </>
                  )}

                  {employmentStatus !== 'self-employed' && employmentStatus !== 'not-employed' && (
                    <div className="pt-2 space-y-2">
                      <button
                        onClick={() => setEmploymentStatus('not-employed')}
                        className="text-sm text-muted-foreground hover:text-primary transition-colors"
                      >
                        I am not currently employed
                      </button>
                      <span className="text-muted-foreground text-sm mx-2">·</span>
                      <button
                        onClick={() => setEmploymentStatus('self-employed')}
                        className="text-sm text-muted-foreground hover:text-primary transition-colors"
                      >
                        I am self-employed
                      </button>
                    </div>
                  )}

                  {(employmentStatus === 'self-employed' || employmentStatus === 'not-employed') && (
                    <button
                      onClick={() => { setEmploymentStatus(null); setEmployerName(''); setEmployerAddress(''); }}
                      className="text-sm text-primary hover:underline"
                    >
                      ← Actually, I have an employer
                    </button>
                  )}

                  {currentItem.completed && currentItem.textEntry && (
                    <div className="surface-card glow-success p-4 flex items-center gap-3">
                      <CheckCircle2 className="w-6 h-6 text-success flex-shrink-0" />
                      <div>
                        <p className="text-foreground font-medium text-sm">
                          {currentItem.textEntry.selfEmployed
                            ? 'Self-employed'
                            : currentItem.textEntry.notEmployed
                              ? 'Not currently employed'
                              : currentItem.textEntry.employerName}
                        </p>
                        {currentItem.textEntry.employerAddress && (
                          <p className="text-muted-foreground text-xs">{currentItem.textEntry.employerAddress}</p>
                        )}
                        <p className="text-muted-foreground text-xs">Previously saved</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : isBankStatements && !currentItemHasOpenCorrection ? (
                <div className="space-y-4">
                  <PlaidBankConnect
                    caseId={caseData.id}
                    clientName={caseData.clientName}
                    checklistItemId={currentItem.id}
                    onSuccess={(plaidResult) => {
                      const plaidFiles: Array<{ id: string; name: string; uploadedAt: string }> = [];
                      for (const acct of plaidResult.accounts) {
                        for (let m = 0; m < 6; m++) {
                          const d = new Date();
                          d.setMonth(d.getMonth() - m);
                          const monthName = d.toLocaleString('default', { month: 'long' });
                          const year = d.getFullYear();
                          plaidFiles.push({
                            id: crypto.randomUUID(),
                            name: `${plaidResult.institutionName}-${acct.type}-${monthName}-${year}.pdf`,
                            uploadedAt: new Date().toISOString(),
                          });
                        }
                      }

                      setCaseData(prev => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          lastClientActivity: new Date().toISOString(),
                          checklist: prev.checklist.map(ci => {
                            if (ci.id !== currentItem.id) return ci;
                            const newFiles = [...ci.files];
                            for (const pf of plaidFiles) {
                              newFiles.push({
                                id: pf.id,
                                name: pf.name,
                                dataUrl: '',
                                uploadedAt: pf.uploadedAt,
                                reviewStatus: 'approved',
                                reviewNote: 'Auto-approved — sourced directly from financial institution via Plaid',
                                uploadedBy: 'plaid',
                              });
                            }
                            return { ...ci, files: newFiles, completed: true };
                          }),
                        };
                      });

                      // Persist Plaid files to DB as auto-approved
                      (async () => {
                        try {
                          await supabase.from('files').insert(
                            plaidFiles.map(pf => ({
                              id: pf.id,
                              case_id: caseData.id,
                              checklist_item_id: currentItem.id,
                              file_name: pf.name,
                              storage_path: null,
                              data_url: '',
                              uploaded_at: pf.uploadedAt,
                              review_status: 'approved',
                              review_note: 'Auto-approved — sourced directly from financial institution via Plaid',
                              uploaded_by: 'plaid',
                            }))
                          );
                          await supabase.from('checklist_items').update({ completed: true }).eq('id', currentItem.id);
                          await supabase.from('cases').update({ last_client_activity: new Date().toISOString() }).eq('id', caseData.id);
                          await logActivity(caseData.id, {
                            eventType: 'file_approved',
                            actorRole: 'system',
                            actorName: 'ClearPath',
                            description: `Auto-approved ${plaidFiles.length} bank statement${plaidFiles.length !== 1 ? 's' : ''} from ${plaidResult.institutionName} via Plaid`,
                            itemId: currentItem.id,
                          });
                        } catch (err) {
                          console.error('Failed to persist Plaid files:', err);
                        }
                      })();
                    }}
                    onManualUploadClick={() => {}}
                    manualUploadContent={
                      multiConfig ? (
                        <MultiUploadZone
                          files={currentItem.files.filter(f => f.uploadedBy !== 'plaid')}
                          config={multiConfig}
                          onFileAdd={(file: File) => {
                            const existing = currentItem.files.find(f => f.name === file.name);
                            if (existing) {
                              setPendingDuplicate({ file, existingFileId: existing.id });
                            } else {
                              handleFileAdd(file);
                            }
                          }}
                          onFileDelete={handleFileDelete}
                          onFilePreview={(f) => setPreviewFile({ name: f.name, dataUrl: f.dataUrl })}
                        />
                      ) : null
                    }
                  />
                  <div className="flex flex-col items-center gap-2 mt-2">
                    <button
                      onClick={() => setShowNaFlow(true)}
                      className="text-sm text-muted-foreground/70 hover:text-primary transition-colors"
                    >
                      I don't have this document
                    </button>
                  </div>
                </div>
              ) : isDigitalWallet && !currentItemHasOpenCorrection ? (
                <DigitalWalletStep
                  caseId={caseData.id}
                  clientName={caseData.clientName}
                  clientPhone={caseData.clientPhone}
                  checklistItemId={currentItem.id}
                  files={currentItem.files}
                  onFileAdd={(file: File) => {
                    const existing = currentItem.files.find(f => f.name === file.name);
                    if (existing) {
                      setPendingDuplicate({ file, existingFileId: existing.id });
                    } else {
                      handleFileAdd(file);
                    }
                  }}
                  onFileDelete={handleFileDelete}
                  onFilePreview={(f) => setPreviewFile({ name: f.name, dataUrl: f.dataUrl })}
                  onMarkNA={() => handleClientNA("Client indicated they don't use any digital wallet apps")}
                />
              ) : isMultiUpload && multiConfig ? (
                <div className="space-y-4">
                  {currentItemHasOpenCorrection && currentItem.correctionRequest && (
                    <CorrectionNoteCard
                      requestedBy={currentItem.correctionRequest.requestedBy}
                      reason={currentItem.correctionRequest.reason}
                      details={currentItem.correctionRequest.details}
                    />
                  )}
                  {renderDuplicateWarning()}
                  <MultiUploadZone
                    files={currentItem.files}
                    config={multiConfig}
                    onFileAdd={(file: File) => {
                      const existing = currentItem.files.find(f => f.name === file.name);
                      if (existing) {
                        setPendingDuplicate({ file, existingFileId: existing.id });
                      } else {
                        handleFileAdd(file);
                      }
                    }}
                    onFileDelete={handleFileDelete}
                    onFilePreview={(f) => setPreviewFile({ name: f.name, dataUrl: f.dataUrl })}
                  />
                  <AnimatePresence>
                    {showLowCountConfirm && (
                      <LowCountConfirmation
                        config={multiConfig}
                        fileCount={currentItem.files.length}
                        onConfirm={handleLowCountConfirm}
                        onAddMore={() => setShowLowCountConfirm(false)}
                      />
                    )}
                  </AnimatePresence>
                  <div className="flex flex-col items-center gap-2 mt-2">
                    {!currentItem.required && !currentItem.completed && !currentItemHasOpenCorrection && (
                      <button onClick={handleSkip} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                        Skip this item
                      </button>
                    )}
                    <button
                      onClick={() => setShowNaFlow(true)}
                      className="text-sm text-muted-foreground/70 hover:text-primary transition-colors"
                    >
                      I don't have this document
                    </button>
                  </div>
                </div>
              ) : currentItemHasOpenCorrection ? (
                <div className="space-y-4">
                  {currentItem.correctionRequest && (
                    <CorrectionNoteCard
                      requestedBy={currentItem.correctionRequest.requestedBy}
                      reason={currentItem.correctionRequest.reason}
                      details={currentItem.correctionRequest.details}
                    />
                  )}
                  {currentItem.files.length > 0 && renderCorrectionFileList()}
                  {renderDuplicateWarning()}
                  <div
                    className="upload-zone p-12 flex flex-col items-center justify-center cursor-pointer relative"
                    onClick={() => isMobile ? setShowMobileUploadOptions(true) : fileInputRef.current?.click()}
                  >
                    <UploadCloud className="w-12 h-12 text-primary mb-4" />
                    <span className="text-foreground font-medium">Tap to upload or drag file</span>
                    <span className="text-sm text-muted-foreground mt-1">PDF, JPG, or PNG · Max 25MB</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*,.heic,.heif,.pdf,.jpg,.jpeg,.png,application/pdf"
                      onChange={handleSingleFileUpload}
                    />
                    <input
                      ref={cameraInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*,.heic,.heif"
                      capture="environment"
                      onChange={handleSingleFileUpload}
                    />
                  </div>
                </div>
              ) : currentItem.files.length > 0 && currentItem.completed ? (
                <div className="space-y-2">
                  <div className="surface-card glow-success p-4 flex items-center gap-3">
                    {/* Thumbnail preview */}
                    {currentItem.files[0].dataUrl?.startsWith('data:image') || currentItem.files[0].dataUrl?.startsWith('http') ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); setPreviewFile({ name: currentItem.files[0].name, dataUrl: currentItem.files[0].dataUrl }); }}
                        className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-border hover:ring-2 hover:ring-primary/30 transition-all"
                      >
                        <img src={currentItem.files[0].dataUrl} alt={currentItem.files[0].name} className="w-full h-full object-cover" />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setPreviewFile({ name: currentItem.files[0].name, dataUrl: currentItem.files[0].dataUrl }); }}
                        className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 border border-border hover:ring-2 hover:ring-primary/30 transition-all"
                      >
                        <span className="text-[10px] font-bold text-muted-foreground">PDF</span>
                      </button>
                    )}
                    <CheckCircle2 className="w-6 h-6 text-success flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-medium truncate">{currentItem.files[0].name}</p>
                      <p className="text-sm text-muted-foreground">Uploaded</p>
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-sm text-primary hover:underline flex-shrink-0"
                    >
                      Replace
                    </button>
                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.heic,.heif,.pdf,.jpg,.jpeg,.png,application/pdf" onChange={handleSingleFileUpload} />
                  </div>
                  {/* Validation status indicator */}
                  {currentItem.files.map(file => (
                    <FileValidationIndicator
                      key={`val-${file.id}`}
                      file={file}
                      isValidating={validatingFiles.has(file.id)}
                      onAction={(action) => handleValidationAction(file.id, action, caseData)}
                      onReplace={() => fileInputRef.current?.click()}
                      onRemove={() => {
                        handleFileDelete(file.id);
                        setTimeout(() => fileInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <>
                {showNaFlow ? (
                  <div className="space-y-4">
                    <div className="surface-card p-5">
                      <p className="text-foreground font-medium mb-1">No problem</p>
                      <p className="text-muted-foreground text-sm mb-5">Let us know why and your attorney's office will be notified.</p>
                      <div className="space-y-2">
                        {CLIENT_NA_OPTIONS.map(opt => (
                          <button
                            key={opt.label}
                            onClick={() => handleClientNA(opt.reason)}
                            className="w-full text-left p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-foreground font-medium"
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowNaFlow(false)}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors mx-auto block"
                    >
                      ← I have this document
                    </button>
                  </div>
                ) : (
                  <>
                  {renderDuplicateWarning()}
                  <div
                    className="upload-zone p-12 flex flex-col items-center justify-center cursor-pointer relative"
                    onClick={() => isMobile ? setShowMobileUploadOptions(true) : fileInputRef.current?.click()}
                  >
                    <UploadCloud className="w-12 h-12 text-primary mb-4" />
                    <span className="text-foreground font-medium">Tap to upload your file</span>
                    <span className="text-sm text-muted-foreground mt-1">PDF, JPG, or PNG · Up to 25MB</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*,.heic,.heif,.pdf,.jpg,.jpeg,.png,application/pdf"
                      onChange={handleSingleFileUpload}
                    />
                    <input
                      ref={cameraInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*,.heic,.heif"
                      capture="environment"
                      onChange={handleSingleFileUpload}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-2 mt-2">
                    {!currentItem.required && !currentItem.completed && !currentItemHasOpenCorrection && (
                      <button onClick={handleSkip} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                        Skip for now
                      </button>
                    )}
                    {!isCheckpointItem && !isTextEntry && (
                      <button
                        onClick={() => setShowNaFlow(true)}
                        className="text-sm text-muted-foreground/70 hover:text-primary transition-colors"
                      >
                        I don't have this document
                      </button>
                    )}
                  </div>
                  </>
                )}
                </>
              )}
            </motion.div>
          ) : (
            <motion.div key="no-item" {...pageTransition} className="max-w-md mx-auto text-center">
              <AlertTriangle className="w-10 h-10 text-warning mx-auto mb-4" />
              <p className="text-foreground font-medium mb-2">Something went wrong loading this step.</p>
              <Button onClick={() => window.location.reload()} size="lg">Refresh Page</Button>
            </motion.div>
          )}
        </AnimatePresence>

      </div>


      {!showSuccess && !showMilestone && !showStepTransition && currentItem && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t border-border px-6 py-3">
          <div className="max-w-md mx-auto">
            {isCheckpointItem ? (
              <Button
                onClick={handleCheckpointConfirm}
                size="lg"
                className="w-full"
                disabled={!checkpointConfirmed}
              >
                Continue →
              </Button>
            ) : isSSNEntry ? (
              <Button
                onClick={handleSSNContinue}
                size="lg"
                className="w-full"
                disabled={!ssnIsValid}
              >
                Continue →
              </Button>
            ) : isEmployerEntry ? (
              <Button
                onClick={handleEmployerContinue}
                size="lg"
                className="w-full"
                disabled={employmentStatus !== 'self-employed' && employmentStatus !== 'not-employed' && !employerName.trim()}
              >
                Continue →
              </Button>
            ) : isBankStatements && !currentItemHasOpenCorrection ? (
              <Button
                onClick={() => {
                  if (currentItem.completed || isPlaidConnected) {
                    checkMilestoneAndAdvance(caseData);
                  } else {
                    handleContinueMultiUpload();
                  }
                }}
                size="lg"
                className="w-full"
                disabled={!currentItem.completed && currentItem.files.length === 0 && currentItem.required}
              >
                Continue →
              </Button>
            ) : isDigitalWallet && !currentItemHasOpenCorrection ? (
              <Button
                onClick={() => {
                  if (currentItem.completed || currentItem.notApplicable) {
                    checkMilestoneAndAdvance(caseData);
                  } else {
                    handleContinueMultiUpload();
                  }
                }}
                size="lg"
                className="w-full"
                disabled={!currentItem.completed && !currentItem.notApplicable && currentItem.files.length === 0 && currentItem.required}
              >
                Continue →
              </Button>
            ) : isMultiUpload ? (
              <Button
                onClick={handleContinueMultiUpload}
                size="lg"
                className="w-full"
                disabled={currentItemHasOpenCorrection ? !hasPendingReplacement : currentItem.files.length === 0 && currentItem.required}
              >
                {hasValidationIssue ? 'Continue anyway →' : 'Continue →'}
              </Button>
            ) : (
              <Button
                onClick={handleContinueSingle}
                size="lg"
                className="w-full"
                disabled={currentItemHasOpenCorrection ? !hasPendingReplacement : false}
              >
                {hasValidationIssue ? 'Continue anyway →' : 'Continue →'}
              </Button>
            )}
            {(currentItemIdx > 0 || currentCategoryIdx > 0) && (
              <button onClick={goBack} className="text-sm text-muted-foreground hover:text-primary transition-colors mt-1 block mx-auto text-center">
                ← Back
              </button>
            )}
          </div>
        </div>
      )}
      {/* Floating "Ask Alex" pill — visible on document steps only */}
      {!showSuccess && !showMilestone && showStepTransition === null && currentItem && (
        <button
          onClick={() => setAlexChatOpen(true)}
          className="fixed bottom-20 left-4 z-40 flex items-center gap-2 bg-secondary border border-border text-foreground text-sm px-4 py-2 rounded-full shadow-sm hover:border-primary/40 transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          Ask Alex
        </button>
      )}
      {/* Controlled Alex chat panel */}
      {currentItem && (
        <DocumentHelpChat
          documentLabel={currentItem.label}
          category={currentItem.category}
          chapterType={caseData.chapterType}
          isOpen={alexChatOpen}
          onOpenChange={setAlexChatOpen}
        />
      )}
      {/* Persistent hidden file inputs for mobile */}
      <input
        ref={(el) => { (window as any).__mobileCamera = el; }}
        type="file"
        className="hidden"
        accept="image/*,.heic,.heif"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          handleFileAdd(file);
          e.target.value = '';
          setShowMobileUploadOptions(false);
        }}
      />
      <input
        ref={(el) => { (window as any).__mobileLibrary = el; }}
        type="file"
        className="hidden"
        accept="image/*,.heic,.heif,.pdf,.jpg,.jpeg,.png,application/pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          handleFileAdd(file);
          e.target.value = '';
          setShowMobileUploadOptions(false);
        }}
      />

      {/* Mobile upload action sheet */}
      <AnimatePresence>
        {showMobileUploadOptions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/40 flex items-end justify-center"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowMobileUploadOptions(false);
            }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-background rounded-t-2xl p-4 pb-8 space-y-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-3" />
              <button
                type="button"
                className="w-full flex items-center gap-3 p-4 rounded-xl hover:bg-[hsl(var(--surface-hover))] transition-colors"
                onClick={() => {
                  (window as any).__mobileCamera?.click();
                }}
              >
                <Camera className="w-5 h-5 text-primary" />
                <span className="text-foreground font-medium">Take a Photo</span>
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-3 p-4 rounded-xl hover:bg-[hsl(var(--surface-hover))] transition-colors"
                onClick={() => {
                  (window as any).__mobileLibrary?.click();
                }}
              >
                <UploadCloud className="w-5 h-5 text-primary" />
                <span className="text-foreground font-medium">Choose from Library</span>
              </button>
              <button
                onClick={() => setShowMobileUploadOptions(false)}
                className="w-full p-3 text-center text-muted-foreground text-sm"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Fullscreen preview modal */}
      <AnimatePresence>
        {previewFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setPreviewFile(null)}
          >
            <button
              onClick={() => setPreviewFile(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-10"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            <p className="absolute top-5 left-4 text-white/70 text-sm truncate max-w-[60%]">{previewFile.name}</p>
            {previewFile.dataUrl?.startsWith('data:image') || previewFile.dataUrl?.startsWith('http') ? (
              <img src={previewFile.dataUrl} alt={previewFile.name} className="max-w-full max-h-[85vh] object-contain rounded-lg" onClick={e => e.stopPropagation()} />
            ) : previewFile.dataUrl?.startsWith('data:application/pdf') ? (
              <iframe src={previewFile.dataUrl} className="w-full max-w-3xl h-[85vh] rounded-lg bg-white" title={previewFile.name} onClick={e => e.stopPropagation()} />
            ) : (
              <div className="text-white text-center" onClick={e => e.stopPropagation()}>
                <p className="text-lg font-medium mb-2">{previewFile.name}</p>
                <p className="text-white/60">Preview not available for this file type</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
};

const WizardHeader = ({ progress, step, totalSteps, stepName, onMenuClick, firmDisplayName }: { progress: number; step: number; totalSteps: number; stepName: string; onMenuClick?: () => void; firmDisplayName?: string | null }) => (
  <div className="sticky top-0 z-50 bg-background/90 backdrop-blur-sm">
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2">
        {onMenuClick && (
          <button onClick={onMenuClick} className="lg:hidden p-1.5 rounded-md hover:bg-muted transition-colors -ml-1">
            <Menu className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
        {firmDisplayName ? <span className="font-display font-bold text-[15px] text-foreground">{firmDisplayName}</span> : <Logo size="sm" clickable={false} />}
      </div>
      <span className="text-sm text-muted-foreground font-body tabular-nums">
        Step {step} of {totalSteps}
      </span>
    </div>
    <div className="h-2 bg-secondary rounded-full mx-4">
      <motion.div
        className="h-full bg-primary rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
      />
    </div>
    <div className="text-center py-2.5 px-4">
      <p className="text-sm text-foreground font-medium font-body">
        {getProgressLabel(progress)}
      </p>
      <p className="text-xs text-muted-foreground font-body mt-0.5">
        {stepName}
      </p>
    </div>
  </div>
);

// ─── File Validation Indicator ────────────────────────────────────────
interface FileValidationIndicatorProps {
  file: { id: string; validationStatus?: string; validationResult?: FileValidationResult };
  isValidating: boolean;
  onAction: (action: 'client-confirmed' | 'client-override') => void;
  onReplace: () => void;
  onRemove?: () => void;
}

const FileValidationIndicator = ({ file, isValidating, onAction, onReplace, onRemove }: FileValidationIndicatorProps) => {
  const status = file.validationStatus;
  const result = file.validationResult;

  if (status === 'client-confirmed' || status === 'client-override' || status === 'pending' || !status) {
    if (isValidating) {
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 px-3 py-2">
          <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
          <span className="text-xs text-muted-foreground">Checking your document…</span>
        </motion.div>
      );
    }
    return null;
  }

  if (isValidating) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 px-3 py-2">
        <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
        <span className="text-xs text-muted-foreground">Checking your document…</span>
      </motion.div>
    );
  }

  if (status === 'passed') {
    return (
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 px-3 py-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-success" />
        <span className="text-xs text-success font-medium">Looks good</span>
      </motion.div>
    );
  }

  if (status === 'warning' && result) {
    return (
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="px-3 py-2 space-y-2">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-warning mt-0.5 flex-shrink-0" />
          <span className="text-xs text-warning leading-relaxed">This looks like it might not be quite right. {result.suggestion}</span>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { onRemove?.(); }} className="text-xs text-primary hover:underline font-medium">Remove and try again</button>
          <button onClick={() => onAction('client-confirmed')} className="text-xs text-muted-foreground hover:text-foreground">Keep it anyway</button>
        </div>
      </motion.div>
    );
  }

  if (status === 'failed' && result) {
    return (
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="px-3 py-2 space-y-2">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-warning mt-0.5 flex-shrink-0" />
          <span className="text-xs text-warning leading-relaxed">This looks like it might be the wrong file. {result.suggestion}</span>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { onRemove?.(); }} className="text-xs text-primary hover:underline font-medium">Remove and try again</button>
          <button onClick={() => onAction('client-override')} className="text-xs text-muted-foreground hover:text-foreground">Keep it anyway</button>
        </div>
      </motion.div>
    );
  }

  return null;
};



class WizardErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ClientWizard error boundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
          <Logo size="md" clickable={false} />
          <div className="mt-8 text-center max-w-md">
            <AlertTriangle className="w-10 h-10 text-warning mx-auto mb-4" />
            <p className="text-foreground font-medium mb-2">Something went wrong loading this step.</p>
            <p className="text-muted-foreground text-sm mb-6">Please refresh the page or contact your attorney's office.</p>
            <Button onClick={() => window.location.reload()} size="lg">Refresh Page</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const ClientWizardWithBoundary = () => (
  <WizardErrorBoundary>
    <ClientWizard />
  </WizardErrorBoundary>
);

export default ClientWizardWithBoundary;
