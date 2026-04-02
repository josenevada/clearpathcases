// CLIENT FACING — no billing UI permitted
import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Loader2, RefreshCw, AlertTriangle, CheckCircle2, FileText,
  Pencil, X, Download, Eye, Lock, Share2, Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import type { Case } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────────
interface ExtractedField {
  id: string;
  field_key: string;
  field_label: string;
  field_value: string | null;
  form_reference: string;
  section_label: string;
  source_document_name: string | null;
  confidence: 'high' | 'medium' | 'low';
  manually_overridden: boolean;
  override_value: string | null;
  conflict_detected: boolean;
  conflict_sources: string[] | null;
}

interface ExtractionRun {
  id: string;
  status: string;
  trigger_type: string;
  fields_extracted: number;
  fields_high_confidence: number;
  fields_medium_confidence: number;
  fields_low_confidence: number;
  conflicts_detected: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

interface GeneratedForm {
  id: string;
  form_code: string;
  form_title: string;
  storage_path: string;
  version: number;
  watermark_status: string;
  approved_by: string | null;
  approved_at: string | null;
  generated_at: string;
}

// ─── CH.7 Form Definitions ─────────────────────────────────────────
const CH7_FORMS = [
  { code: 'B101', label: 'Voluntary Petition' },
  { code: 'B106AB', label: 'Property Schedule' },
  { code: 'B106C', label: 'Exemptions' },
  { code: 'B106D', label: 'Secured Creditors' },
  { code: 'B106EF', label: 'Unsecured Creditors' },
  { code: 'B106G', label: 'Executory Contracts' },
  { code: 'B106H', label: 'Codebtors' },
  { code: 'B106I', label: 'Income' },
  { code: 'B106J', label: 'Expenses' },
  { code: 'B106Sum', label: 'Summary' },
  { code: 'B106Dec', label: 'Declaration' },
  { code: 'B107', label: 'Statement of Financial Affairs' },
  { code: 'B108', label: 'Statement of Intention' },
  { code: 'B122A1', label: 'Means Test' },
  { code: 'B122A2', label: 'Means Test Calculation' },
];

// ─── Component ──────────────────────────────────────────────────────
interface FormDataTabProps {
  caseData: Case;
  onRefresh: () => void;
}

const FormDataTab = ({ caseData, onRefresh }: FormDataTabProps) => {
  const { user } = useAuth();
  const [latestRun, setLatestRun] = useState<ExtractionRun | null>(null);
  const [fields, setFields] = useState<ExtractedField[]>([]);
  const [generatedForms, setGeneratedForms] = useState<GeneratedForm[]>([]);
  const [selectedForm, setSelectedForm] = useState<string>('B101');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showRerunModal, setShowRerunModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // ─── Data fetching ────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch latest extraction run
      const { data: runs } = await supabase
        .from('form_extraction_runs')
        .select('*')
        .eq('case_id', caseData.id)
        .order('started_at', { ascending: false })
        .limit(1);

      setLatestRun(runs?.[0] || null);

      // Fetch extracted fields
      const { data: fieldData } = await supabase
        .from('case_extracted_data')
        .select('*')
        .eq('case_id', caseData.id)
        .order('form_reference', { ascending: true });

      setFields((fieldData as ExtractedField[]) || []);

      // Fetch generated forms
      const { data: formData } = await supabase
        .from('generated_federal_forms')
        .select('*')
        .eq('case_id', caseData.id)
        .order('generated_at', { ascending: false });

      setGeneratedForms((formData as GeneratedForm[]) || []);
    } catch (err) {
      console.error('Failed to fetch form data:', err);
    } finally {
      setLoading(false);
    }
  }, [caseData.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Poll while running
  useEffect(() => {
    if (latestRun?.status !== 'running') return;
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [latestRun?.status, fetchData]);

  // ─── Ch.13 gate ───────────────────────────────────────────────────
  if (caseData.chapterType === '13') {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center space-y-4">
        <FileText className="w-12 h-12 text-muted-foreground mx-auto" />
        <h2 className="font-display text-xl font-bold text-foreground">Coming Soon</h2>
        <p className="text-muted-foreground font-body">Form filling for Chapter 13 is coming soon.</p>
      </div>
    );
  }

  // ─── Readiness checks ────────────────────────────────────────────
  const requiredItems = caseData.checklist.filter(i => i.required && !i.notApplicable);
  const isItemReadyForExtraction = (item: Case['checklist'][number]) => {
    if (item.notApplicable) return true;
    if (item.textEntry?.savedAt) return item.attorneyNote?.startsWith('Approved by') ?? false;
    if (item.files.some(f => f.reviewStatus === 'approved' || f.reviewStatus === 'overridden')) return true;
    return item.completed && item.files.length === 0;
  };
  const approvedCount = requiredItems.filter(isItemReadyForExtraction).length;
  const allApproved = requiredItems.length > 0 && approvedCount === requiredItems.length;

  // ─── Handlers ─────────────────────────────────────────────────────
  const handleExtract = async () => {
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-form-data', {
        body: { case_id: caseData.id, trigger_type: 'manual', triggered_by: user?.id },
      });
      if (error) throw error;
      toast.success(`Extraction started — processing documents...`);
      await fetchData();
    } catch (err: any) {
      toast.error('Failed to start extraction', { description: err.message });
    } finally {
      setExtracting(false);
    }
  };

  const handleRerun = async () => {
    setShowRerunModal(false);
    await handleExtract();
  };

  const handleFieldEdit = async (field: ExtractedField) => {
    const newValue = editValue.trim();
    try {
      await supabase
        .from('case_extracted_data')
        .update({
          manually_overridden: true,
          override_value: newValue,
          override_by: user?.id || null,
          override_at: new Date().toISOString(),
        })
        .eq('id', field.id);

      await supabase.from('activity_log').insert({
        case_id: caseData.id,
        event_type: 'field_overridden',
        actor_role: user?.role === 'attorney' ? 'attorney' : 'paralegal',
        actor_name: user?.fullName || 'Staff',
        description: `Field "${field.field_label}" on ${field.form_reference} manually updated`,
        item_id: field.id,
      });

      setEditingField(null);
      setEditValue('');
      toast.success('Field updated');
      await fetchData();
    } catch (err: any) {
      toast.error('Failed to update field', { description: err.message });
    }
  };

  const handleGenerateForms = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-federal-forms', {
        body: { case_id: caseData.id, form_codes: 'all', triggered_by: user?.id },
      });
      if (error) throw error;
      const successCount = data?.results?.filter((r: any) => r.success).length ?? 0;
      toast.success(`${successCount} federal forms generated with DRAFT watermark`, {
        description: 'Attorney approval required before filing.',
      });
      await fetchData();
    } catch (err: any) {
      toast.error('Failed to generate forms', { description: err.message });
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveForFiling = async () => {
    setShowApproveModal(false);
    try {
      // Update all generated forms for this case to approved
      await supabase
        .from('generated_federal_forms')
        .update({
          watermark_status: 'approved',
          approved_by: user?.id || null,
          approved_at: new Date().toISOString(),
          included_in_packet: true,
        })
        .eq('case_id', caseData.id)
        .eq('watermark_status', 'draft');

      await supabase.from('activity_log').insert({
        case_id: caseData.id,
        event_type: 'forms_approved',
        actor_role: 'attorney',
        actor_name: user?.fullName || 'Attorney',
        description: `Pre-filled forms approved for filing by ${user?.fullName || 'Attorney'}`,
      });

      toast.success('Forms approved for filing');
      await fetchData();
    } catch (err: any) {
      toast.error('Failed to approve forms', { description: err.message });
    }
  };

  const handleDownloadForm = async (form: GeneratedForm) => {
    try {
      const { data, error } = await supabase.storage
        .from('federal-forms')
        .createSignedUrl(form.storage_path, 3600);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (err: any) {
      toast.error('Download failed', { description: err.message });
    }
  };

  // ─── Field grouping ──────────────────────────────────────────────
  const formFields = fields.filter(f => f.form_reference === selectedForm);
  const sectionGroups = formFields.reduce<Record<string, ExtractedField[]>>((acc, f) => {
    if (!acc[f.section_label]) acc[f.section_label] = [];
    acc[f.section_label].push(f);
    return acc;
  }, {});

  const nullFields = formFields.filter(f => !f.field_value && f.confidence === 'low');
  const hasConflicts = fields.some(f => f.conflict_detected);
  const allConflictsResolved = !hasConflicts;

  // Form status dots
  const getFormStatus = (code: string) => {
    const ff = fields.filter(f => f.form_reference === code);
    if (ff.length === 0) return 'gray';
    if (ff.some(f => f.conflict_detected)) return 'red';
    if (ff.some(f => f.confidence === 'medium' || f.confidence === 'low')) return 'amber';
    return 'green';
  };

  const statusDotColor: Record<string, string> = {
    green: 'bg-success',
    amber: 'bg-warning',
    red: 'bg-destructive',
    gray: 'bg-muted-foreground/30',
  };

  // Latest generated form per code
  const latestFormByCode: Record<string, GeneratedForm> = {};
  for (const gf of generatedForms) {
    if (!latestFormByCode[gf.form_code] || gf.version > latestFormByCode[gf.form_code].version) {
      latestFormByCode[gf.form_code] = gf;
    }
  }

  const allFormsApproved = generatedForms.length > 0 && generatedForms.every(f => f.watermark_status === 'approved');
  const approvedForm = generatedForms.find(f => f.watermark_status === 'approved');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // ─── State 1: Not yet extracted ───────────────────────────────────
  if (!latestRun) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface-card p-8 text-center space-y-5"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-display text-xl font-bold text-foreground">Form Data Not Yet Extracted</h2>
          <p className="text-muted-foreground font-body max-w-md mx-auto">
            All required documents must be approved before AI extraction can run. Once complete, ClearPath will automatically extract data for all 15 federal forms.
          </p>
          <div className="max-w-xs mx-auto space-y-2">
            <div className="flex items-center justify-between text-xs font-body text-muted-foreground">
              <span>Document readiness</span>
              <span>{approvedCount} of {requiredItems.length} approved</span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${requiredItems.length > 0 ? (approvedCount / requiredItems.length) * 100 : 0}%` }}
              />
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  onClick={handleExtract}
                  disabled={!allApproved || extracting}
                  className="gap-2"
                >
                  {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Extract Form Data
                </Button>
              </span>
            </TooltipTrigger>
            {!allApproved && (
              <TooltipContent>All required documents must be approved first</TooltipContent>
            )}
          </Tooltip>
        </motion.div>
      </div>
    );
  }

  // ─── State 2: Running ─────────────────────────────────────────────
  if (latestRun.status === 'running' || latestRun.status === 'pending') {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="surface-card p-8 text-center space-y-5"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-display text-xl font-bold text-foreground">Extracting Form Data…</h2>
          <p className="text-muted-foreground font-body">
            Analyzing documents and extracting data for federal forms. This may take a minute.
          </p>
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
        </motion.div>
      </div>
    );
  }

  // ─── State 4: Failed ──────────────────────────────────────────────
  if (latestRun.status === 'failed') {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface-card p-8 text-center space-y-5 border-destructive/30"
        >
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="font-display text-xl font-bold text-foreground">Extraction Failed</h2>
          <p className="text-muted-foreground font-body">{latestRun.error_message || 'An unknown error occurred.'}</p>
          <Button onClick={handleExtract} disabled={extracting} className="gap-2">
            {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Retry Extraction
          </Button>
        </motion.div>
      </div>
    );
  }

  // ─── State 3: Complete — Full Review UI ───────────────────────────
  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="surface-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
      >
        <div className="flex flex-wrap items-center gap-3 text-sm font-body">
          <span className="text-foreground font-bold">{latestRun.fields_extracted} fields extracted</span>
          <span className="text-success flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-success inline-block" />
            {latestRun.fields_high_confidence} high
          </span>
          <span className="text-warning flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-warning inline-block" />
            {latestRun.fields_medium_confidence + latestRun.fields_low_confidence} need review
          </span>
          {latestRun.conflicts_detected > 0 && (
            <span className="text-destructive flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-destructive inline-block" />
              {latestRun.conflicts_detected} conflicts
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Attorney Approve Button */}
          {user?.role === 'attorney' && generatedForms.length > 0 && !allFormsApproved && allConflictsResolved && (
            <Button
              onClick={() => setShowApproveModal(true)}
              className="gap-1.5 bg-[hsl(210,80%,15%)] text-[hsl(45,100%,70%)] border border-[hsl(45,100%,50%)]/30 hover:bg-[hsl(210,80%,20%)]"
              size="sm"
            >
              <Shield className="w-3.5 h-3.5" /> Approve for Filing
            </Button>
          )}
          {allFormsApproved && approvedForm && (
            <Badge className="bg-success/10 text-success border-success/20 gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Approved {approvedForm.approved_at ? format(new Date(approvedForm.approved_at), 'MMM d') : ''}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => setShowRerunModal(true)}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Re-run
          </Button>
        </div>
      </motion.div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left: Form sidebar */}
        <div className="lg:col-span-1 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold font-body mb-2">Federal Forms</p>
          {CH7_FORMS.map(form => {
            const status = getFormStatus(form.code);
            const count = fields.filter(f => f.form_reference === form.code).length;
            const isSelected = selectedForm === form.code;
            return (
              <button
                key={form.code}
                onClick={() => setSelectedForm(form.code)}
                className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 transition-colors text-sm font-body ${
                  isSelected
                    ? 'bg-primary/10 text-primary border-l-2 border-primary'
                    : 'hover:bg-[hsl(var(--surface-hover))] text-foreground'
                }`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDotColor[status]}`} />
                <span className="flex-1 truncate">
                  <span className="font-bold">{form.code}</span>
                  <span className="text-muted-foreground ml-1.5 text-xs">{form.label}</span>
                </span>
                {count > 0 && (
                  <span className="text-[10px] text-muted-foreground bg-secondary rounded-full px-1.5 py-0.5">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right: Fields panel */}
        <div className="lg:col-span-3 space-y-4">
          <div className="surface-card p-5">
            <h3 className="font-display text-lg font-bold text-foreground mb-1">
              {CH7_FORMS.find(f => f.code === selectedForm)?.code} — {CH7_FORMS.find(f => f.code === selectedForm)?.label}
            </h3>

            {/* Generated form download */}
            {latestFormByCode[selectedForm] && (
              <div className="flex items-center gap-3 mt-3 p-3 rounded-lg bg-secondary/50 border border-border">
                <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex-1 text-sm font-body">
                  <span className="text-foreground">v{latestFormByCode[selectedForm].version}</span>
                  <span className="text-muted-foreground ml-2">
                    {format(new Date(latestFormByCode[selectedForm].generated_at), 'MMM d, h:mm a')}
                  </span>
                  <Badge className={`ml-2 text-[10px] ${
                    latestFormByCode[selectedForm].watermark_status === 'approved'
                      ? 'bg-success/10 text-success border-success/20'
                      : 'bg-warning/10 text-warning border-warning/20'
                  }`}>
                    {latestFormByCode[selectedForm].watermark_status === 'approved' ? 'APPROVED' : 'DRAFT'}
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" className="gap-1" onClick={() => handleDownloadForm(latestFormByCode[selectedForm])}>
                  <Download className="w-3.5 h-3.5" /> Download
                </Button>
              </div>
            )}

            {/* Fields grouped by section */}
            {Object.keys(sectionGroups).length > 0 ? (
              <div className="mt-4 space-y-4">
                {Object.entries(sectionGroups).map(([section, sectionFields]) => (
                  <div key={section}>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold font-body mb-2">{section}</p>
                    <div className="space-y-1">
                      {sectionFields.filter(f => f.field_value || f.confidence !== 'low').map(field => {
                        const effectiveValue = field.manually_overridden ? field.override_value : field.field_value;
                        const isEditing = editingField === field.id;

                        return (
                          <div key={field.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-[hsl(var(--surface-hover))] transition-colors group">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-body text-foreground">{field.field_label}</span>
                                {field.manually_overridden && (
                                  <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20">Edited</Badge>
                                )}
                                {field.conflict_detected && (
                                  <Badge className="text-[9px] bg-[hsl(270,60%,60%)]/10 text-[hsl(270,60%,60%)] border-[hsl(270,60%,60%)]/20">Conflict</Badge>
                                )}
                              </div>
                              {field.source_document_name && (
                                <p className="text-[10px] text-muted-foreground truncate">{field.source_document_name}</p>
                              )}
                              {field.conflict_detected && field.conflict_sources && (
                                <div className="mt-1 text-[10px] text-muted-foreground space-y-0.5">
                                  {(typeof field.conflict_sources === 'string'
                                    ? (field.conflict_sources as string).split(' | ')
                                    : field.conflict_sources
                                  ).map((src, i) => (
                                    <p key={i} className="pl-2 border-l-2 border-[hsl(270,60%,60%)]/30">{src}</p>
                                  ))}
                                </div>
                              )}
                            </div>

                            {isEditing ? (
                              <div className="flex items-center gap-1.5">
                                <Input
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  className="h-7 text-xs w-40 bg-input"
                                  autoFocus
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleFieldEdit(field);
                                    if (e.key === 'Escape') setEditingField(null);
                                  }}
                                />
                                <Button size="sm" className="h-7 px-2" onClick={() => handleFieldEdit(field)}>
                                  <CheckCircle2 className="w-3 h-3" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditingField(null)}>
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-body text-foreground font-mono">
                                  {effectiveValue || '—'}
                                </span>
                                <Badge className={`text-[9px] ${
                                  field.confidence === 'high' ? 'bg-success/10 text-success border-success/20' :
                                  field.confidence === 'medium' ? 'bg-warning/10 text-warning border-warning/20' :
                                  'bg-destructive/10 text-destructive border-destructive/20'
                                }`}>
                                  {field.confidence}
                                </Badge>
                                <button
                                  onClick={() => {
                                    setEditingField(field.id);
                                    setEditValue(effectiveValue || '');
                                  }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Attorney Must Complete section */}
                {nullFields.length > 0 && (
                  <Accordion type="single" collapsible>
                    <AccordionItem value="attorney-fields" className="border-warning/20">
                      <AccordionTrigger className="text-sm text-warning font-body py-2 px-3">
                        <span className="flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Attorney Must Complete ({nullFields.length} fields)
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="px-3">
                        <p className="text-xs text-muted-foreground font-body mb-2">
                          These fields require attorney judgment and cannot be pre-filled by AI.
                        </p>
                        {nullFields.map(field => (
                          <div key={field.id} className="flex items-center gap-3 py-1.5 text-sm font-body text-muted-foreground">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 flex-shrink-0" />
                            {field.field_label}
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground font-body">No fields extracted for this form yet.</p>
                <p className="text-xs text-muted-foreground font-body mt-1">Attorney must complete this form manually.</p>
              </div>
            )}
          </div>

          {/* Generate forms button */}
          {latestRun.status === 'complete' && fields.length > 0 && (
            <div className="surface-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-foreground">Pre-filled Federal Forms</h3>
                <Button
                  onClick={handleGenerateForms}
                  disabled={generating}
                  className="gap-2"
                  size="sm"
                >
                  {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                  {generatedForms.length > 0 ? 'Regenerate Forms' : 'Generate Pre-filled Forms'}
                </Button>
              </div>

              {/* Generated forms list */}
              {generatedForms.length > 0 && (
                <div className="space-y-1.5">
                  {CH7_FORMS.map(form => {
                    const gf = latestFormByCode[form.code];
                    if (!gf) return null;
                    return (
                      <div key={form.code} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-secondary/30">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="flex-1 text-sm font-body">
                          <span className="font-bold text-foreground">{form.code}</span>
                          <span className="text-muted-foreground ml-1.5">{form.label}</span>
                        </span>
                        <Badge className={`text-[9px] ${
                          gf.watermark_status === 'approved'
                            ? 'bg-success/10 text-success border-success/20'
                            : 'bg-warning/10 text-warning border-warning/20'
                        }`}>
                          {gf.watermark_status === 'approved' ? 'APPROVED' : 'DRAFT'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">v{gf.version}</span>
                        <button onClick={() => handleDownloadForm(gf)} className="text-primary hover:underline text-xs">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Re-run confirmation modal */}
      <Dialog open={showRerunModal} onOpenChange={setShowRerunModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Re-run Extraction?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground font-body">
            Re-running will overwrite all fields that have not been manually edited. 
            {fields.filter(f => f.manually_overridden).length > 0 && (
              <span className="text-foreground font-bold">
                {' '}{fields.filter(f => f.manually_overridden).length} manually edited fields will be preserved.
              </span>
            )}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRerunModal(false)}>Cancel</Button>
            <Button onClick={handleRerun} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Re-run Extraction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attorney Approve modal */}
      <Dialog open={showApproveModal} onOpenChange={setShowApproveModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Approve for Filing</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground font-body">
            By approving, you certify that you have reviewed all extracted data and the pre-filled forms are accurate to the best of your knowledge. Forms will be marked <span className="font-bold text-foreground">APPROVED</span> and included in the court packet.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveModal(false)}>Cancel</Button>
            <Button onClick={handleApproveForFiling} className="gap-1.5 bg-[hsl(210,80%,15%)] text-[hsl(45,100%,70%)] hover:bg-[hsl(210,80%,20%)]">
              <Shield className="w-3.5 h-3.5" /> Approve for Filing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FormDataTab;
