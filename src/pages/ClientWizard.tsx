import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, CheckCircle2, ChevronDown, AlertTriangle, ArrowLeft, Trash2, Briefcase, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Logo from '@/components/Logo';
import ProgressPill from '@/components/wizard/ProgressPill';
import StepTransition from '@/components/wizard/StepTransition';
import MultiUploadZone, { LowCountConfirmation, MULTI_UPLOAD_CONFIGS, isMultiUploadItem } from '@/components/wizard/MultiUploadZone';
import CorrectionBanner from '@/components/wizard/CorrectionBanner';
import CorrectionNoteCard from '@/components/wizard/CorrectionNoteCard';
import DocumentHelpPanel from '@/components/wizard/DocumentHelpPanel';
import { getChecklistItemPosition, getOpenCorrectionItem } from '@/lib/corrections';
import { getCase, updateCase, addActivityEntry, saveCases, getAllCases, CATEGORIES, STEP_MOTIVATIONS, calculateProgress, isItemEffectivelyComplete, type Case, type ChecklistItem, type TextEntry, type FileValidationResult } from '@/lib/store';
import { validateDocument, getExpectedDocType } from '@/lib/document-validation';
import { sendMomentumSms } from '@/lib/sms';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const EMPLOYER_LABEL = 'Employer Name & Address';
const isTextEntryItem = (label: string) => label === EMPLOYER_LABEL;

const pageTransition = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.2, ease: [0.2, 0, 0, 1] as [number, number, number, number] },
};

const MILESTONE_THRESHOLDS = [25, 50, 75, 100];
const MILESTONE_MESSAGES = [
  'Great start! Every document you upload brings you closer to a fresh start.',
  "You're halfway there. Every document you've added helps your attorney fight for you.",
  'Almost there! Your attorney will have nearly everything they need.',
  "You're done. Your attorney has everything they need. We'll be in touch soon.",
];

const ClientWizard = () => {
  const { caseId, caseCode } = useParams<{ caseId?: string; caseCode?: string }>();
  const resolvedCaseId = caseId || '';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [caseData, setCaseData] = useState<Case | null>(null);
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
  const [validatingFiles, setValidatingFiles] = useState<Set<string>>(new Set());
  const [helpForceOpen, setHelpForceOpen] = useState(false);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMilestoneRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetFixItemId = searchParams.get('fix');

  useEffect(() => {
    if (!resolvedCaseId) return;

    const loadCase = async () => {
      // Try localStorage first (paralegal's browser or returning client)
      let c = getCase(resolvedCaseId);

      // If not in localStorage, fetch from Supabase (client on different device)
      if (!c) {
        try {
          const { data: caseRow } = await supabase
            .from('cases')
            .select('*')
            .eq('id', resolvedCaseId)
            .maybeSingle();

          if (!caseRow) {
            toast.error('Case not found');
            navigate('/');
            return;
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

          // Build checklist items from Supabase data
          const checklist: ChecklistItem[] = (checklistRows || []).map(row => {
            const itemFiles = (fileRows || [])
              .filter(f => f.checklist_item_id === row.id)
              .map(f => ({
                id: f.id,
                name: f.file_name,
                dataUrl: f.data_url || '',
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

          // Build the Case object
          c = {
            id: caseRow.id,
            clientName: caseRow.client_name,
            clientEmail: caseRow.client_email,
            clientPhone: caseRow.client_phone || undefined,
            clientDob: caseRow.client_dob || undefined,
            caseCode: caseRow.case_code || undefined,
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

          // Save to localStorage for subsequent operations
          const cases = getAllCases();
          cases.push(c);
          saveCases(cases);
        } catch (err) {
          console.error('Failed to load case from database:', err);
          toast.error('Could not load case data');
          navigate('/');
          return;
        }
      }

      setCaseData(c);
      lastMilestoneRef.current = Math.floor(calculateProgress(c) / 25) * 25;

      if (targetFixItemId) {
        const targetPosition = getChecklistItemPosition(c, targetFixItemId);
        if (targetPosition) {
          setCurrentCategoryIdx(targetPosition.categoryIdx);
          setCurrentItemIdx(targetPosition.itemIdx);
          return;
        }
      }

      const catIdx = Math.min(c.wizardStep, CATEGORIES.length - 1);
      setCurrentCategoryIdx(catIdx);
      const items = c.checklist.filter(item => item.category === CATEGORIES[catIdx]);
      const firstIncomplete = items.findIndex(item => !isItemEffectivelyComplete(item));
      setCurrentItemIdx(firstIncomplete >= 0 ? firstIncomplete : 0);
    };

    loadCase();
  }, [resolvedCaseId, navigate, targetFixItemId]);

  // Move hook before the early return
  const refreshCase = useCallback(() => {
    if (!resolvedCaseId) return null;
    const c = getCase(resolvedCaseId);
    if (c) setCaseData(c);
    return c;
  }, [resolvedCaseId]);

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
        updateCase(caseIdForValidation, c => {
          for (const ci of c.checklist) { const f = ci.files.find(fl => fl.id === fileId); if (f) { f.validationStatus = result.validation_status; f.validationResult = vr; break; } }
          return c;
        });
        addActivityEntry(caseIdForValidation, { eventType: 'document_validated', actorRole: 'system', actorName: 'ClearPath AI', description: `Document validation ${result.validation_status} for ${itemLabel} (${Math.round(result.confidence_score * 100)}% confidence)`, itemId: fileId });
        // Auto-open help panel on validation warning/failure
        if (result.validation_status === 'warning' || result.validation_status === 'failed') {
          setHelpForceOpen(true);
        }
        refreshCase();
      } else {
        addActivityEntry(caseIdForValidation, { eventType: 'document_validated', actorRole: 'system', actorName: 'ClearPath AI', description: `Validation service unavailable for ${itemLabel}`, itemId: fileId });
      }
    } catch { console.warn('Document validation failed silently'); }
    finally { setValidatingFiles(prev => { const next = new Set(prev); next.delete(fileId); return next; }); }
  }, [refreshCase]);

  const handleValidationAction = useCallback((fileId: string, action: 'client-confirmed' | 'client-override', cRef: Case | null) => {
    if (!cRef) return;
    updateCase(cRef.id, c => {
      for (const ci of c.checklist) { const f = ci.files.find(fl => fl.id === fileId); if (f) { f.validationStatus = action; break; } }
      return c;
    });
    if (action === 'client-override') {
      addActivityEntry(cRef.id, { eventType: 'document_validated', actorRole: 'client', actorName: cRef.clientName, description: `${cRef.clientName.split(' ')[0]} uploaded despite validation warning`, itemId: fileId });
    }
    refreshCase();
  }, [refreshCase]);

  const jumpToItem = useCallback((itemId: string, cRef: Case | null) => {
    if (!cRef) return;
    const position = getChecklistItemPosition(cRef, itemId);
    if (!position) return;
    setWhyOpen(false); setShowSuccess(false); setShowMilestone(null); setShowStepTransition(null);
    setCurrentCategoryIdx(position.categoryIdx); setCurrentItemIdx(position.itemIdx);
    setSearchParams({ fix: itemId }, { replace: true });
  }, [setSearchParams]);

  // Reset employer fields when item changes
  useEffect(() => {
    if (!caseData) return;
    const catItems = caseData.checklist.filter(item => item.category === CATEGORIES[currentCategoryIdx]);
    const item = catItems[currentItemIdx];
    if (item && isTextEntryItem(item.label)) {
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
  }, [currentCategoryIdx, currentItemIdx, caseData]);

  // ─── 90-second inactivity auto-show help ─────────────────────────
  useEffect(() => {
    // Reset on item change
    setHelpForceOpen(false);
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);

    // Only set timer on upload screens (not text entry or checkpoint)
    if (!caseData) return;
    const catItems = caseData.checklist.filter(item => item.category === CATEGORIES[currentCategoryIdx]);
    const item = catItems[currentItemIdx];
    if (!item || isTextEntryItem(item.label) || (item.category === 'Agreements & Confirmation' && item.label.includes('Confirmation'))) return;
    if (item.completed) return;

    inactivityTimerRef.current = setTimeout(() => {
      setHelpForceOpen(true);
    }, 90_000);

    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [currentCategoryIdx, currentItemIdx, caseData]);

  if (!caseData) return null;

  const categoryItems = caseData.checklist.filter(item => item.category === CATEGORIES[currentCategoryIdx]);
  const currentItem = categoryItems[currentItemIdx];
  const progress = calculateProgress(caseData);
  const openCorrectionItem = getOpenCorrectionItem(caseData);
  const hasPortalCorrection = Boolean(openCorrectionItem);

  const isCheckpointItem = currentItem && currentItem.category === 'Agreements & Confirmation' && currentItem.label.includes('Confirmation');
  const isMultiUpload = currentItem && isMultiUploadItem(currentItem.label);
  const multiConfig = currentItem ? MULTI_UPLOAD_CONFIGS[currentItem.label] : undefined;
  const isTextEntry = currentItem && isTextEntryItem(currentItem.label);
  const currentItemHasOpenCorrection = currentItem?.correctionRequest?.status === 'open';
  const hasPendingReplacement = currentItem?.files.some(file => file.reviewStatus === 'pending') ?? false;

  const handleFileAdd = (file: File) => {
    if (!currentItem) return;
    // Reset inactivity timer on upload
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);

    const reader = new FileReader();
    reader.onload = () => {
      const newFile = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        dataUrl: reader.result as string,
        uploadedAt: new Date().toISOString(),
        reviewStatus: 'pending' as const,
        uploadedBy: 'client' as const,
        validationStatus: 'validating' as const,
      };

      const updated = updateCase(caseData.id, c => {
        const item = c.checklist.find(checklistItem => checklistItem.id === currentItem.id);
        if (item) {
          if (isMultiUpload || currentItemHasOpenCorrection) {
            item.files = [...item.files, newFile];
            item.completed = !currentItemHasOpenCorrection;
          } else {
            item.files = [newFile];
            item.completed = true;
          }
        }
        c.lastClientActivity = new Date().toISOString();
        return c;
      });

      addActivityEntry(caseData.id, {
        eventType: 'file_upload',
        actorRole: 'client',
        actorName: caseData.clientName,
        description: `${caseData.clientName.split(' ')[0]} uploaded ${file.name} for ${currentItem.label}`,
        itemId: currentItem.id,
      });

      // Sync file upload and checklist status to Supabase
      supabase.from('files').insert({
        id: newFile.id,
        case_id: caseData.id,
        checklist_item_id: currentItem.id,
        file_name: newFile.name,
        data_url: newFile.dataUrl,
        uploaded_at: newFile.uploadedAt,
        review_status: 'pending',
        uploaded_by: 'client',
      }).then(() => {
        supabase.from('checklist_items').update({ completed: true }).eq('id', currentItem.id);
        supabase.from('cases').update({ last_client_activity: new Date().toISOString() }).eq('id', caseData.id);
        supabase.from('activity_log').insert({
          case_id: caseData.id,
          event_type: 'file_upload',
          actor_role: 'client',
          actor_name: caseData.clientName,
          description: `${caseData.clientName.split(' ')[0]} uploaded ${file.name} for ${currentItem.label}`,
          item_id: currentItem.id,
        });
      }).catch(err => console.error('Failed to sync file upload:', err));

      // Trigger AI validation in the background
      triggerValidation(newFile.id, newFile.dataUrl, currentItem.label, caseData.id);

      if (updated) {
        setCaseData(updated);
        if (currentItemHasOpenCorrection) {
          toast.success(`${file.name} added`, { duration: 1500 });
          return;
        }

        if (!isMultiUpload) {
          setShowSuccess(true);
          setTimeout(() => {
            setShowSuccess(false);
            checkMilestoneAndAdvance(updated);
          }, 1500);
        } else {
          toast.success(`${file.name} added`, { duration: 1500 });
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileDelete = (fileId: string) => {
    if (!currentItem) return;
    const updated = updateCase(caseData.id, c => {
      const item = c.checklist.find(checklistItem => checklistItem.id === currentItem.id);
      if (item) {
        item.files = item.files.filter(file => file.id !== fileId);
        if (item.files.length === 0) item.completed = false;
      }
      return c;
    });
    if (updated) setCaseData(updated);
  };

  const handleSingleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFileAdd(file);
    event.target.value = '';
  };

  const completeCorrectionResubmission = () => {
    if (!currentItem || !hasPendingReplacement) return;

    const timestamp = new Date().toISOString();
    const updated = updateCase(caseData.id, c => {
      const item = c.checklist.find(checklistItem => checklistItem.id === currentItem.id);
      if (item) {
        item.completed = true;
        item.resubmittedAt = timestamp;
        if (item.correctionRequest) item.correctionRequest.status = 'resolved';
      }
      c.lastClientActivity = timestamp;
      return c;
    });

    addActivityEntry(caseData.id, {
      eventType: 'file_reupload',
      actorRole: 'client',
      actorName: caseData.clientName,
      description: `${caseData.clientName.split(' ')[0]} resubmitted ${currentItem.label}`,
      itemId: currentItem.id,
    });

    if (updated) {
      setCaseData(updated);
      setSearchParams({}, { replace: true });
      toast.success('Replacement submitted for review.');
      advanceToNext();
    }
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
    addActivityEntry(caseData.id, {
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

    const updated = updateCase(caseData.id, c => {
      const item = c.checklist.find(checklistItem => checklistItem.id === currentItem.id);
      if (item) item.completed = true;
      c.lastClientActivity = new Date().toISOString();
      c.checkpointsCompleted = [...c.checkpointsCompleted, currentItem.id];
      return c;
    });

    addActivityEntry(caseData.id, {
      eventType: 'checkpoint_completed',
      actorRole: 'client',
      actorName: caseData.clientName,
      description: `${caseData.clientName.split(' ')[0]} completed the ${currentItem.label}`,
      itemId: currentItem.id,
    });

    if (updated) {
      setCaseData(updated);
      setCheckpointConfirmed(false);
      checkMilestoneAndAdvance(updated);
    }
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
      setShowStepTransition(currentCategoryIdx);
    }
  };

  const handleStepTransitionContinue = () => {
    if (showStepTransition === null || !caseData) return;
    const completedStep = showStepTransition + 1; // 1-indexed
    const nextCategory = showStepTransition + 1;
    setShowStepTransition(null);
    setCurrentCategoryIdx(nextCategory);
    setCurrentItemIdx(0);
    updateCase(caseData.id, c => ({ ...c, wizardStep: nextCategory }));
    refreshCase();

    // Trigger 3: Momentum Builder SMS
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
    toast('No worries — you can come back to this later.', { duration: 2000 });
    advanceToNext();
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
    // Soft-block: no file on required item → show help first
    if (!currentItem.completed && currentItem.required) {
      setHelpForceOpen(true);
      toast('When you\'ve found the document, tap the upload zone above to add it.', { duration: 4000 });
      return;
    }
    advanceToNext();
  };

  const handleEmployerContinue = () => {
    if (!currentItem) return;

    if (employmentStatus === 'self-employed' || employmentStatus === 'not-employed') {
      const statusLabel = employmentStatus === 'self-employed' ? 'is self-employed' : 'is not currently employed';
      const updated = updateCase(caseData.id, c => {
        const item = c.checklist.find(ci => ci.id === currentItem.id);
        if (item) {
          item.textEntry = {
            employerName: '',
            selfEmployed: employmentStatus === 'self-employed',
            notEmployed: employmentStatus === 'not-employed',
            savedAt: new Date().toISOString(),
          };
          item.completed = true;
        }
        c.lastClientActivity = new Date().toISOString();
        return c;
      });
      addActivityEntry(caseData.id, {
        eventType: 'checkpoint_completed',
        actorRole: 'client',
        actorName: caseData.clientName,
        description: `${caseData.clientName.split(' ')[0]} indicated ${caseData.clientName.split(' ')[0]} ${statusLabel}`,
        itemId: currentItem.id,
      });
      if (updated) {
        setCaseData(updated);
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          checkMilestoneAndAdvance(updated);
        }, 1500);
      }
      return;
    }

    const updated = updateCase(caseData.id, c => {
      const item = c.checklist.find(ci => ci.id === currentItem.id);
      if (item) {
        item.textEntry = {
          employerName: employerName.trim(),
          employerAddress: employerAddress.trim() || undefined,
          savedAt: new Date().toISOString(),
        };
        item.completed = true;
      }
      c.lastClientActivity = new Date().toISOString();
      return c;
    });
    addActivityEntry(caseData.id, {
      eventType: 'checkpoint_completed',
      actorRole: 'client',
      actorName: caseData.clientName,
      description: `${caseData.clientName.split(' ')[0]} provided employer information: ${employerName.trim()}`,
      itemId: currentItem.id,
    });
    if (updated) {
      setCaseData(updated);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        checkMilestoneAndAdvance(updated);
      }, 1500);
    }
  };

  const showUrgencyBanner = caseData.urgency !== 'normal' && !showMilestone;
  const daysLeft = Math.max(0, Math.ceil((new Date(caseData.filingDeadline).getTime() - Date.now()) / 86400000));

  if (progress === 100 && !showMilestone && !showSuccess) {
    return (
      <div className="min-h-screen flex flex-col">
        <WizardHeader progress={100} step={6} totalSteps={6} stepName="Complete" />
        {hasPortalCorrection && openCorrectionItem && (
          <CorrectionBanner onFixNow={() => jumpToItem(openCorrectionItem.id, caseData)} isOnCorrectionItem={false} />
        )}
        <div className="flex-1 flex items-center justify-center px-6">
          <motion.div {...pageTransition} className="max-w-md mx-auto text-center">
            <div className="text-6xl mb-6">🎉</div>
            <h2 className="font-display text-3xl font-bold text-foreground mb-4">You're done!</h2>
            <p className="text-muted-foreground text-lg mb-8">
              Your attorney has everything they need. We'll be in touch soon.
            </p>
            <div className="surface-card p-6 text-left space-y-2">
              <p className="text-sm text-muted-foreground">Questions? Contact your legal team:</p>
              <p className="text-foreground font-medium">{caseData.assignedAttorney}</p>
              <p className="text-foreground font-medium">{caseData.assignedParalegal}</p>
            </div>
          </motion.div>
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
    <div className="min-h-screen flex flex-col">
      <WizardHeader
        progress={progress}
        step={currentCategoryIdx + 1}
        totalSteps={CATEGORIES.length}
        stepName={CATEGORIES[currentCategoryIdx]}
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
            ? `Your filing date is in ${daysLeft} days. Please complete your documents today.`
            : 'Your filing date is coming up. Finishing soon keeps everything on track.'}
        </div>
      )}

      <div className="flex-1 flex items-center justify-center px-6 pb-32">
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
              <div className="text-6xl mb-6">{showMilestone === 100 ? '🎉' : showMilestone >= 75 ? '🚀' : showMilestone >= 50 ? '💪' : '⭐'}</div>
              <h2 className="font-display text-3xl font-bold text-foreground mb-4">
                {showMilestone}% Complete
              </h2>
              <p className="text-muted-foreground text-lg mb-8">
                {MILESTONE_MESSAGES[MILESTONE_THRESHOLDS.indexOf(showMilestone)]}
              </p>
              {showMilestone < 100 && (
                <Button onClick={handleDismissMilestone} size="lg" className="w-full max-w-xs">
                  Keep going →
                </Button>
              )}
            </motion.div>
          ) : showSuccess ? (
            <motion.div key="success" {...pageTransition} className="max-w-md mx-auto text-center">
              <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-success animate-scale-check" />
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                {currentItem?.label} saved
              </h2>
              <p className="text-muted-foreground">
                {currentItemIdx < categoryItems.length - 1
                  ? `Next up: ${categoryItems[currentItemIdx + 1]?.label}`
                  : currentCategoryIdx < CATEGORIES.length - 1
                    ? `Next: ${CATEGORIES[currentCategoryIdx + 1]}`
                    : 'Almost done!'}
              </p>
            </motion.div>
          ) : currentItem ? (
            <motion.div key={currentItem.id} {...pageTransition} className="max-w-md mx-auto w-full">
              <header className="mb-8">
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2 leading-tight">
                  {currentItem.label}
                </h2>
                <p className="text-muted-foreground text-lg font-body leading-relaxed">
                  {currentItem.description}
                </p>
              </header>

              <button
                onClick={() => setWhyOpen(!whyOpen)}
                className="flex items-center gap-1 text-primary/80 text-sm mb-6 hover:text-primary transition-colors"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${whyOpen ? 'rotate-180' : ''}`} />
                Why do we need this?
              </button>
              <AnimatePresence>
                {whyOpen && (
                  <motion.p
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="text-muted-foreground text-sm leading-relaxed mb-6 overflow-hidden"
                  >
                    {currentItem.whyWeNeedThis}
                  </motion.p>
                )}
               </AnimatePresence>

              {/* Contextual document help panel */}
              {!isCheckpointItem && !isTextEntry && (
                <DocumentHelpPanel
                  itemLabel={currentItem.label}
                  caseId={caseData.id}
                  caseName={caseData.clientName}
                  validationStatus={currentItem.files.find(f => f.validationStatus === 'failed' || f.validationStatus === 'warning')?.validationStatus}
                  validationSuggestion={currentItem.files.find(f => f.validationStatus === 'failed' || f.validationStatus === 'warning')?.validationResult?.suggestion}
                  hasFiles={currentItem.files.length > 0}
                  forceOpen={helpForceOpen}
                  onForceOpenHandled={() => setHelpForceOpen(false)}
                />
              )}

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
              ) : isTextEntry ? (
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
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">
                          Employer Address <span className="text-muted-foreground font-normal">(optional)</span>
                        </label>
                        <Input
                          value={employerAddress}
                          onChange={e => setEmployerAddress(e.target.value)}
                          placeholder="Street address, city, state, zip"
                          className="bg-input border-border rounded-[10px]"
                        />
                      </div>
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
              ) : isMultiUpload && multiConfig ? (
                <div className="space-y-4">
                  {currentItemHasOpenCorrection && currentItem.correctionRequest && (
                    <CorrectionNoteCard
                      requestedBy={currentItem.correctionRequest.requestedBy}
                      reason={currentItem.correctionRequest.reason}
                      details={currentItem.correctionRequest.details}
                    />
                  )}
                  <MultiUploadZone
                    files={currentItem.files}
                    config={multiConfig}
                    onFileAdd={handleFileAdd}
                    onFileDelete={handleFileDelete}
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
                  <div
                    className="upload-zone p-12 flex flex-col items-center justify-center cursor-pointer relative"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadCloud className="w-12 h-12 text-primary mb-4" />
                    <span className="text-foreground font-medium">Tap to upload or drag file</span>
                    <span className="text-sm text-muted-foreground mt-1">PDF, JPG, or PNG · Max 25MB</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleSingleFileUpload}
                    />
                  </div>
                </div>
              ) : currentItem.files.length > 0 && currentItem.completed ? (
                <div className="space-y-2">
                  <div className="surface-card glow-success p-6 flex items-center gap-4">
                    <CheckCircle2 className="w-8 h-8 text-success flex-shrink-0" />
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
                    <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleSingleFileUpload} />
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
                <div
                  className="upload-zone p-12 flex flex-col items-center justify-center cursor-pointer relative"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud className="w-12 h-12 text-primary mb-4" />
                  <span className="text-foreground font-medium">Tap to upload or drag file</span>
                  <span className="text-sm text-muted-foreground mt-1">PDF, JPG, or PNG · Max 25MB</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleSingleFileUpload}
                  />
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {!showSuccess && !showMilestone && !showStepTransition && progress < 100 && (
        <ProgressPill caseData={caseData} />
      )}

      {!showSuccess && !showMilestone && !showStepTransition && currentItem && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t border-border px-6 py-4">
          <div className="max-w-md mx-auto flex flex-col gap-3">
            {isCheckpointItem ? (
              <Button
                onClick={handleCheckpointConfirm}
                size="lg"
                className="w-full"
                disabled={!checkpointConfirmed}
              >
                Continue →
              </Button>
            ) : isTextEntry ? (
              <Button
                onClick={handleEmployerContinue}
                size="lg"
                className="w-full"
                disabled={employmentStatus !== 'self-employed' && employmentStatus !== 'not-employed' && !employerName.trim()}
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
                Continue →
              </Button>
            ) : (
              <Button
                onClick={handleContinueSingle}
                size="lg"
                className="w-full"
                disabled={currentItemHasOpenCorrection ? !hasPendingReplacement : false}
              >
                Continue →
              </Button>
            )}
            {!currentItem.required && !currentItem.completed && !currentItemHasOpenCorrection && (
              <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">
                I don't have this yet
              </Button>
            )}
            {(currentItemIdx > 0 || currentCategoryIdx > 0) && (
              <Button variant="ghost" onClick={goBack} size="sm" className="text-muted-foreground">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const WizardHeader = ({ progress, step, totalSteps, stepName }: { progress: number; step: number; totalSteps: number; stepName: string }) => (
  <div className="sticky top-0 z-50 bg-background/90 backdrop-blur-sm">
    <div className="flex items-center justify-between px-4 py-3">
      <Logo size="sm" />
      <span className="text-sm text-muted-foreground font-body">
        Step {step} of {totalSteps} — {stepName}
      </span>
    </div>
    <div className="h-1 bg-secondary">
      <motion.div
        className="h-full bg-primary"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
      />
    </div>
    <p className="text-center text-xs text-muted-foreground py-2 font-body">
      {STEP_MOTIVATIONS[Math.min(step - 1, STEP_MOTIVATIONS.length - 1)]}
    </p>
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

  // Show nothing if already confirmed/overridden or just pending without result
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
          <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5 flex-shrink-0" />
          <span className="text-xs text-destructive leading-relaxed">This looks like it might be the wrong file. {result.suggestion}</span>
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

export default ClientWizard;
