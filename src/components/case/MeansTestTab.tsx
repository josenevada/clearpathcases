import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Calculator, Loader2, RefreshCw, CheckCircle2, AlertTriangle, XCircle,
  Pencil, Lock, Shield, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/auth';
import { useSubscription } from '@/lib/subscription';
import { getPlanLimits } from '@/lib/plan-limits';
import UpgradeModal from '@/components/UpgradeModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Case } from '@/lib/store';
import {
  PRESUMPTION_THRESHOLD,
  STATE_MEDIAN_INCOME,
} from '@/data/irs-standards';

interface MeansTestCalculation {
  id: string;
  case_id: string;
  filing_date: string;
  calculation_window_start: string;
  calculation_window_end: string;
  household_size: number;
  client_state: string;
  monthly_gross_wages: number;
  monthly_net_business: number;
  monthly_rental_income: number;
  monthly_interest_dividends: number;
  monthly_pension_retirement: number;
  monthly_social_security: number;
  monthly_unemployment: number;
  monthly_other_income: number;
  total_current_monthly_income: number;
  annualized_income: number;
  state_median_income: number;
  below_median: boolean;
  national_standard_food_clothing: number;
  national_standard_healthcare: number;
  local_standard_housing: number;
  local_standard_utilities: number;
  local_standard_vehicle_operation: number;
  local_standard_vehicle_ownership: number;
  secured_debt_payments: number;
  priority_debt_payments: number;
  other_necessary_expenses: number;
  total_allowed_deductions: number;
  monthly_disposable_income: number;
  presumption_arises: boolean;
  eligibility_result: string;
  eligibility_notes: string;
  ch13_recommended: boolean;
  attorney_reviewed: boolean;
  attorney_reviewed_by: string | null;
  attorney_reviewed_at: string | null;
  attorney_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface IncomeMonth {
  id: string;
  calculation_id: string;
  month_year: string;
  month_label: string;
  wages: number;
  business_income: number;
  other_income: number;
  total_month: number;
  source_documents: string[];
  has_coverage: boolean;
  flagged_missing: boolean;
}

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

interface MeansTestTabProps {
  caseData: Case;
  onRefresh: () => void;
}

const MeansTestTab = ({ caseData, onRefresh }: MeansTestTabProps) => {
  const { user } = useAuth();
  const { plan } = useSubscription();
  const planLimits = getPlanLimits(plan);
  const isAttorney = user?.role === 'attorney';

  const [calc, setCalc] = useState<MeansTestCalculation | null>(null);
  const [months, setMonths] = useState<IncomeMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [editingDeduction, setEditingDeduction] = useState<string | null>(null);
  const [deductionValue, setDeductionValue] = useState('');
  const [specialCircumstances, setSpecialCircumstances] = useState('');
  const [showSpecialCircumstances, setShowSpecialCircumstances] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Gate: Professional and Firm tiers only
  const isGated = plan === 'starter';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: calcData } = await supabase
        .from('means_test_calculations')
        .select('*')
        .eq('case_id', caseData.id)
        .maybeSingle();

      setCalc(calcData as MeansTestCalculation | null);

      if (calcData) {
        const { data: monthData } = await supabase
          .from('means_test_income_months')
          .select('*')
          .eq('calculation_id', calcData.id)
          .order('month_year', { ascending: true });

        setMonths((monthData as IncomeMonth[]) || []);
      }
    } catch (err) {
      console.error('Failed to fetch means test data:', err);
    } finally {
      setLoading(false);
    }
  }, [caseData.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-means-test', {
        body: { case_id: caseData.id },
      });
      if (error) throw error;
      toast.success('Means test calculation complete');
      await fetchData();
    } catch (err: any) {
      toast.error('Calculation failed', { description: err.message });
    } finally {
      setCalculating(false);
    }
  };

  const handleMonthEdit = async (month: IncomeMonth) => {
    const newWages = parseFloat(editValues[`${month.id}_wages`] || String(month.wages)) || 0;
    const newBusiness = parseFloat(editValues[`${month.id}_business`] || String(month.business_income)) || 0;
    const newOther = parseFloat(editValues[`${month.id}_other`] || String(month.other_income)) || 0;
    const newTotal = newWages + newBusiness + newOther;

    try {
      await supabase
        .from('means_test_income_months')
        .update({
          wages: newWages,
          business_income: newBusiness,
          other_income: newOther,
          total_month: newTotal,
          has_coverage: true,
          flagged_missing: false,
        })
        .eq('id', month.id);

      // Log activity
      await supabase.from('activity_log').insert({
        case_id: caseData.id,
        event_type: 'means_test_income_updated',
        actor_role: user?.role === 'attorney' ? 'attorney' : 'paralegal',
        actor_name: user?.fullName || 'Staff',
        description: `Updated income for ${month.month_label}`,
      });

      setEditingMonth(null);
      setEditValues({});
      toast.success(`Income updated for ${month.month_label}`);

      // Recalculate
      await handleCalculate();
    } catch (err: any) {
      toast.error('Failed to update income', { description: err.message });
    }
  };

  const handleDeductionEdit = async (field: string, value: number) => {
    if (!calc) return;
    try {
      await supabase
        .from('means_test_calculations')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', calc.id);

      await supabase.from('activity_log').insert({
        case_id: caseData.id,
        event_type: 'means_test_deduction_overridden',
        actor_role: 'attorney',
        actor_name: user?.fullName || 'Attorney',
        description: `Attorney overrode deduction: ${field} to ${fmt(value)}`,
      });

      setEditingDeduction(null);
      setDeductionValue('');
      toast.success('Deduction updated');
      await fetchData();
    } catch (err: any) {
      toast.error('Failed to update deduction', { description: err.message });
    }
  };

  const handleConfirmEligibility = async () => {
    if (!calc) return;
    try {
      await supabase
        .from('means_test_calculations')
        .update({
          attorney_reviewed: true,
          attorney_reviewed_by: user?.id,
          attorney_reviewed_at: new Date().toISOString(),
          attorney_notes: 'Eligibility confirmed',
        })
        .eq('id', calc.id);

      // Sync to case_extracted_data
      await syncToFormData();

      await supabase.from('activity_log').insert({
        case_id: caseData.id,
        event_type: 'means_test_confirmed',
        actor_role: 'attorney',
        actor_name: user?.fullName || 'Attorney',
        description: `Attorney confirmed means test eligibility: ${calc.eligibility_result}`,
      });

      toast.success('Eligibility confirmed');
      await fetchData();
    } catch (err: any) {
      toast.error('Failed to confirm', { description: err.message });
    }
  };

  const handleRecommendCh13 = async () => {
    if (!calc) return;
    try {
      await supabase
        .from('means_test_calculations')
        .update({
          attorney_reviewed: true,
          attorney_reviewed_by: user?.id,
          attorney_reviewed_at: new Date().toISOString(),
          ch13_recommended: true,
          attorney_notes: 'Chapter 13 recommended due to presumption of abuse',
        })
        .eq('id', calc.id);

      await supabase.from('activity_log').insert({
        case_id: caseData.id,
        event_type: 'means_test_ch13_recommended',
        actor_role: 'attorney',
        actor_name: user?.fullName || 'Attorney',
        description: `Attorney recommended Chapter 13 conversion`,
      });

      toast.success('Chapter 13 recommendation recorded');
      await fetchData();
    } catch (err: any) {
      toast.error('Failed', { description: err.message });
    }
  };

  const handleDocumentSpecialCircumstances = async () => {
    if (!calc || !specialCircumstances.trim()) return;
    try {
      await supabase
        .from('means_test_calculations')
        .update({
          attorney_reviewed: true,
          attorney_reviewed_by: user?.id,
          attorney_reviewed_at: new Date().toISOString(),
          attorney_notes: `Special circumstances: ${specialCircumstances}`,
          eligibility_result: 'eligible_above_median_passes',
          eligibility_notes: `Presumption rebutted — special circumstances documented by attorney.`,
        })
        .eq('id', calc.id);

      await syncToFormData();

      await supabase.from('activity_log').insert({
        case_id: caseData.id,
        event_type: 'means_test_confirmed',
        actor_role: 'attorney',
        actor_name: user?.fullName || 'Attorney',
        description: `Attorney documented special circumstances to rebut presumption of abuse`,
      });

      setShowSpecialCircumstances(false);
      setSpecialCircumstances('');
      toast.success('Special circumstances documented');
      await fetchData();
    } catch (err: any) {
      toast.error('Failed', { description: err.message });
    }
  };

  const syncToFormData = async () => {
    if (!calc) return;
    const fields = [
      { key: 'cmi_total', label: 'Current Monthly Income', value: calc.total_current_monthly_income, form: 'B122A1', section: 'Income' },
      { key: 'annualized_income', label: 'Annualized Income', value: calc.annualized_income, form: 'B122A1', section: 'Income' },
      { key: 'state_median_comparison', label: 'State Median Comparison', value: calc.below_median ? 'Below' : 'Above', form: 'B122A1', section: 'Comparison' },
      { key: 'presumption_result', label: 'Presumption Result', value: calc.eligibility_result, form: 'B122A1', section: 'Determination' },
    ];

    if (!calc.below_median) {
      fields.push(
        { key: 'food_clothing_deduction', label: 'Food/Clothing Deduction', value: calc.national_standard_food_clothing, form: 'B122A2', section: 'Deductions' },
        { key: 'healthcare_deduction', label: 'Healthcare Deduction', value: calc.national_standard_healthcare, form: 'B122A2', section: 'Deductions' },
        { key: 'housing_deduction', label: 'Housing Deduction', value: calc.local_standard_housing, form: 'B122A2', section: 'Deductions' },
        { key: 'vehicle_operation_deduction', label: 'Vehicle Operation', value: calc.local_standard_vehicle_operation, form: 'B122A2', section: 'Deductions' },
        { key: 'vehicle_ownership_deduction', label: 'Vehicle Ownership', value: calc.local_standard_vehicle_ownership, form: 'B122A2', section: 'Deductions' },
        { key: 'secured_debt_deduction', label: 'Secured Debt', value: calc.secured_debt_payments, form: 'B122A2', section: 'Deductions' },
        { key: 'monthly_disposable_income', label: 'Monthly Disposable Income', value: calc.monthly_disposable_income, form: 'B122A2', section: 'Determination' },
      );
    }

    for (const f of fields) {
      await supabase
        .from('case_extracted_data')
        .upsert({
          case_id: caseData.id,
          field_key: f.key,
          field_label: f.label,
          field_value: String(f.value),
          form_reference: f.form,
          section_label: f.section,
          manually_overridden: true,
          override_value: String(f.value),
          override_by: user?.id || null,
          override_at: new Date().toISOString(),
          confidence: 'high',
        }, { onConflict: 'case_id,field_key' })
        .select();
    }
  };

  // ─── Gated state ──────────────────────────────────────────────────
  if (isGated) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="font-display text-xl font-bold text-foreground">Means Test Engine</h2>
        <p className="text-muted-foreground font-body max-w-md mx-auto">
          Automatic Chapter 7 means test calculations are available on Professional and Firm plans.
        </p>
        <Button onClick={() => setShowUpgrade(true)}>Upgrade to Unlock</Button>
        <UpgradeModal
          open={showUpgrade}
          onOpenChange={setShowUpgrade}
          featureName="Means Test Engine"
          description="Upgrade to Professional or Firm plan to access automatic means test calculations with IRS standard deductions."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // ─── State 1: Not calculated ──────────────────────────────────────
  if (!calc) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface-card p-8 text-center space-y-5"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Calculator className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-display text-xl font-bold text-foreground">Means Test Not Calculated</h2>
          <p className="text-muted-foreground font-body max-w-md mx-auto">
            Calculate the Chapter 7 means test to determine eligibility. The engine will analyze income data, apply IRS standard deductions, and compare against state median income.
          </p>
          <Button onClick={handleCalculate} disabled={calculating} className="gap-2">
            {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
            Calculate Means Test
          </Button>
        </motion.div>
      </div>
    );
  }

  // ─── State 2: Results ─────────────────────────────────────────────
  const eligBannerConfig = {
    eligible_below_median: {
      icon: CheckCircle2,
      bg: 'bg-success/10 border-success/30',
      text: 'text-success',
      title: 'CHAPTER 7 ELIGIBLE — BELOW MEDIAN',
      desc: `Annualized income ${fmt(calc.annualized_income)} is below ${calc.client_state} median of ${fmt(calc.state_median_income)} for a ${calc.household_size}-person household. Form 122A-2 not required.`,
    },
    eligible_above_median_passes: {
      icon: CheckCircle2,
      bg: 'bg-success/10 border-success/30',
      text: 'text-success',
      title: 'CHAPTER 7 ELIGIBLE — PASSES MEANS TEST',
      desc: `Above median income but allowed deductions reduce disposable income to ${fmt(calc.monthly_disposable_income)}/month — below $${PRESUMPTION_THRESHOLD} threshold.`,
    },
    borderline: {
      icon: AlertTriangle,
      bg: 'bg-warning/10 border-warning/30',
      text: 'text-warning',
      title: 'BORDERLINE — ATTORNEY REVIEW REQUIRED',
      desc: `Disposable income of ${fmt(calc.monthly_disposable_income)}/month is near the $${PRESUMPTION_THRESHOLD} threshold. Attorney must verify all deduction amounts before filing.`,
    },
    presumption_of_abuse: {
      icon: XCircle,
      bg: 'bg-destructive/10 border-destructive/30',
      text: 'text-destructive',
      title: `PRESUMPTION OF ABUSE — ${fmt(calc.monthly_disposable_income)}/MONTH DISPOSABLE INCOME`,
      desc: `Disposable income exceeds $${PRESUMPTION_THRESHOLD}/month. US Trustee may move to dismiss. Attorney must review special circumstances or consider Chapter 13.`,
    },
    incomplete: {
      icon: AlertTriangle,
      bg: 'bg-muted border-border',
      text: 'text-muted-foreground',
      title: 'CALCULATION INCOMPLETE',
      desc: 'Missing data prevented a complete means test calculation.',
    },
  };

  const banner = eligBannerConfig[calc.eligibility_result as keyof typeof eligBannerConfig] || eligBannerConfig.incomplete;
  const BannerIcon = banner.icon;

  const totalSixMonths = months.reduce((s, m) => s + m.total_month, 0);

  // Disposable income meter position
  const meterMax = 250;
  const meterPosition = Math.min(Math.max(calc.monthly_disposable_income, 0), meterMax);
  const meterPercent = (meterPosition / meterMax) * 100;

  const deductionRows = [
    { label: 'Food, Clothing & Housekeeping', field: 'national_standard_food_clothing', value: calc.national_standard_food_clothing, basis: 'IRS National Standard', badge: 'IRS Standard', badgeColor: 'bg-warning/10 text-warning border-warning/20' },
    { label: 'Healthcare', field: 'national_standard_healthcare', value: calc.national_standard_healthcare, basis: 'IRS National Standard', badge: 'IRS Standard', badgeColor: 'bg-warning/10 text-warning border-warning/20' },
    { label: `Housing & Utilities (${calc.client_state})`, field: 'local_standard_housing', value: calc.local_standard_housing, basis: 'IRS Local Standard', badge: 'IRS Standard', badgeColor: 'bg-warning/10 text-warning border-warning/20' },
    { label: 'Vehicle Operation', field: 'local_standard_vehicle_operation', value: calc.local_standard_vehicle_operation, basis: 'IRS Local Standard', badge: 'IRS Standard', badgeColor: 'bg-warning/10 text-warning border-warning/20' },
    { label: 'Vehicle Ownership/Lease', field: 'local_standard_vehicle_ownership', value: calc.local_standard_vehicle_ownership, basis: 'Actual from documents', badge: 'From Documents', badgeColor: 'bg-success/10 text-success border-success/20' },
    { label: 'Mortgage Payment', field: 'secured_debt_payments', value: calc.secured_debt_payments, basis: 'Actual from documents', badge: 'From Documents', badgeColor: 'bg-success/10 text-success border-success/20' },
    { label: 'Other Necessary Expenses', field: 'other_necessary_expenses', value: calc.other_necessary_expenses, basis: 'Actual', badge: 'Manual', badgeColor: 'bg-muted text-muted-foreground border-border' },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Re-run button */}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={handleCalculate} disabled={calculating} className="gap-1.5">
          {calculating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Re-run Calculation
        </Button>
      </div>

      {/* Eligibility Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-xl border p-5 ${banner.bg}`}
      >
        <div className="flex items-start gap-3">
          <BannerIcon className={`w-6 h-6 flex-shrink-0 mt-0.5 ${banner.text}`} />
          <div>
            <h3 className={`font-display font-bold text-sm tracking-wider uppercase ${banner.text}`}>
              {banner.title}
            </h3>
            <p className={`text-sm mt-1 ${banner.text} opacity-80`}>{banner.desc}</p>
          </div>
        </div>
      </motion.div>

      {/* Attorney confirmation */}
      {calc.attorney_reviewed && (
        <div className="flex items-center gap-2 rounded-lg bg-success/10 border border-success/20 px-4 py-3">
          <Shield className="w-4 h-4 text-success" />
          <span className="text-sm text-success font-medium">
            Confirmed by {calc.attorney_notes?.includes('Chapter 13') ? 'attorney — Ch.13 recommended' : 'attorney'} on {calc.attorney_reviewed_at ? new Date(calc.attorney_reviewed_at).toLocaleDateString() : 'N/A'}
          </span>
        </div>
      )}

      {/* IRS Verification Note */}
      <div className="flex items-center gap-2 rounded-lg bg-warning/5 border border-warning/15 px-4 py-2.5">
        <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0" />
        <span className="text-xs text-warning">
          IRS standard amounts shown are for 2025. Verify current amounts at IRS.gov before filing.
        </span>
      </div>

      {/* ── B122A-1: Income Section ─────────────────────────────────── */}
      <div className="surface-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-display font-bold text-foreground">Current Monthly Income — Form B122A-1</h3>
          <p className="text-xs text-muted-foreground mt-1">
            6-month lookback: {calc.calculation_window_start} through {calc.calculation_window_end}
          </p>
        </div>

        {/* Monthly income table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Month</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Wages</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Business</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Other</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Total</th>
                <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Coverage</th>
                <th className="w-10 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {months.map(month => (
                <tr
                  key={month.id}
                  className={`border-b border-border ${month.flagged_missing ? 'bg-warning/5' : ''}`}
                >
                  {editingMonth === month.id ? (
                    <>
                      <td className="px-4 py-2 font-medium text-foreground">{month.month_label}</td>
                      <td className="px-4 py-1">
                        <Input
                          type="number"
                          defaultValue={month.wages}
                          onChange={e => setEditValues(v => ({ ...v, [`${month.id}_wages`]: e.target.value }))}
                          className="h-8 text-right w-24 ml-auto"
                        />
                      </td>
                      <td className="px-4 py-1">
                        <Input
                          type="number"
                          defaultValue={month.business_income}
                          onChange={e => setEditValues(v => ({ ...v, [`${month.id}_business`]: e.target.value }))}
                          className="h-8 text-right w-24 ml-auto"
                        />
                      </td>
                      <td className="px-4 py-1">
                        <Input
                          type="number"
                          defaultValue={month.other_income}
                          onChange={e => setEditValues(v => ({ ...v, [`${month.id}_other`]: e.target.value }))}
                          className="h-8 text-right w-24 ml-auto"
                        />
                      </td>
                      <td className="px-4 py-2 text-right text-muted-foreground">—</td>
                      <td className="px-4 py-2 text-center">—</td>
                      <td className="px-2 py-2">
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleMonthEdit(month)}>Save</Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setEditingMonth(null); setEditValues({}); }}>✕</Button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2 font-medium text-foreground">{month.month_label}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmt(month.wages)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmt(month.business_income)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmt(month.other_income)}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">{fmt(month.total_month)}</td>
                      <td className="px-4 py-2 text-center">
                        {month.flagged_missing ? (
                          <Badge className="bg-warning/10 text-warning border-warning/20 text-[10px]">⚠ Missing</Badge>
                        ) : (
                          <span className="text-success text-xs">✓</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <button onClick={() => setEditingMonth(month.id)} className="text-muted-foreground hover:text-foreground">
                          <Pencil className="w-3 h-3" />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* CMI Summary */}
        <div className="p-4 border-t border-border bg-muted/20 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total 6-month income:</span>
            <span className="font-medium tabular-nums">{fmt(totalSixMonths)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current Monthly Income:</span>
            <span className="font-medium tabular-nums">{fmt(totalSixMonths)} ÷ 6 = {fmt(calc.total_current_monthly_income)}/month</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Annualized:</span>
            <span className="font-bold tabular-nums">{fmt(calc.annualized_income)}/year</span>
          </div>
          {calc.monthly_social_security > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
              <Shield className="w-3 h-3" />
              Social Security income of {fmt(calc.monthly_social_security)}/mo excluded per 11 U.S.C. § 101(10A)
            </div>
          )}
        </div>
      </div>

      {/* ── State Median Comparison ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={`surface-card p-5 text-center ${calc.below_median ? 'border-success/30' : 'border-destructive/30'}`}>
          <p className="text-xs text-muted-foreground mb-1">Your Client</p>
          <p className={`font-display text-2xl font-bold ${calc.below_median ? 'text-success' : 'text-destructive'}`}>
            {fmt(calc.annualized_income)}/year
          </p>
        </div>
        <div className="surface-card p-5 text-center">
          <p className="text-xs text-muted-foreground mb-1">{calc.client_state} Median ({calc.household_size}-person)</p>
          <p className="font-display text-2xl font-bold text-foreground">{fmt(calc.state_median_income)}/year</p>
        </div>
      </div>

      {/* Percentage difference */}
      {(() => {
        const diff = ((calc.annualized_income - calc.state_median_income) / calc.state_median_income) * 100;
        return (
          <div className="text-center text-sm">
            <span className={calc.below_median ? 'text-success' : 'text-destructive'}>
              {diff > 0 ? '+' : ''}{diff.toFixed(1)}% {calc.below_median ? 'below' : 'above'} median
            </span>
          </div>
        );
      })()}

      {/* ── B122A-2: Deductions (above median only) ──────────────── */}
      {!calc.below_median && (
        <>
          <div className="surface-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-display font-bold text-foreground">Allowed Deductions — Form B122A-2</h3>
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-warning">
                <AlertTriangle className="w-3 h-3" />
                IRS standard amounts pre-populated. Attorney must verify and confirm before filing.
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Deduction</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Basis</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Amount</th>
                    <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Source</th>
                    <th className="w-10 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {deductionRows.map(row => (
                    <tr key={row.field} className="border-b border-border">
                      {editingDeduction === row.field ? (
                        <>
                          <td className="px-4 py-2 font-medium text-foreground">{row.label}</td>
                          <td className="px-4 py-2 text-muted-foreground text-xs">{row.basis}</td>
                          <td className="px-4 py-1">
                            <Input
                              type="number"
                              defaultValue={row.value}
                              onChange={e => setDeductionValue(e.target.value)}
                              className="h-8 text-right w-28 ml-auto"
                            />
                          </td>
                          <td className="px-4 py-2 text-center">—</td>
                          <td className="px-2 py-2">
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleDeductionEdit(row.field, parseFloat(deductionValue) || 0)}>Save</Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setEditingDeduction(null); setDeductionValue(''); }}>✕</Button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2 font-medium text-foreground">{row.label}</td>
                          <td className="px-4 py-2 text-muted-foreground text-xs">{row.basis}</td>
                          <td className="px-4 py-2 text-right tabular-nums font-medium">{fmt(row.value)}</td>
                          <td className="px-4 py-2 text-center">
                            <Badge className={`${row.badgeColor} text-[10px]`}>{row.badge}</Badge>
                          </td>
                          <td className="px-2 py-2">
                            {isAttorney && (
                              <button onClick={() => { setEditingDeduction(row.field); setDeductionValue(String(row.value)); }} className="text-muted-foreground hover:text-foreground">
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="surface-card p-5 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current Monthly Income:</span>
              <span className="font-medium tabular-nums">{fmt(calc.total_current_monthly_income)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Allowed Deductions:</span>
              <span className="font-medium tabular-nums">− {fmt(calc.total_allowed_deductions)}</span>
            </div>
            <div className="border-t border-border pt-3 flex justify-between text-base">
              <span className="font-bold">Monthly Disposable Income:</span>
              <span className={`font-bold tabular-nums ${calc.monthly_disposable_income >= PRESUMPTION_THRESHOLD ? 'text-destructive' : 'text-success'}`}>
                {fmt(calc.monthly_disposable_income)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Presumption threshold:</span>
              <span>${PRESUMPTION_THRESHOLD}</span>
            </div>
          </div>

          {/* Visual Meter */}
          <div className="surface-card p-5">
            <p className="text-xs text-muted-foreground mb-3">Disposable Income Position</p>
            <div className="relative h-6 rounded-full overflow-hidden">
              {/* Green zone: 0-100 */}
              <div className="absolute inset-y-0 left-0 bg-success/20" style={{ width: `${(100 / meterMax) * 100}%` }} />
              {/* Amber zone: 100-167 */}
              <div className="absolute inset-y-0 bg-warning/20" style={{ left: `${(100 / meterMax) * 100}%`, width: `${((PRESUMPTION_THRESHOLD - 100) / meterMax) * 100}%` }} />
              {/* Red zone: 167+ */}
              <div className="absolute inset-y-0 right-0 bg-destructive/20" style={{ left: `${(PRESUMPTION_THRESHOLD / meterMax) * 100}%` }} />
              {/* Client position dot */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary border-2 border-background shadow-lg"
                style={{ left: `calc(${meterPercent}% - 8px)` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>$0</span>
              <span>$100</span>
              <span>${PRESUMPTION_THRESHOLD}</span>
              <span>${meterMax}+</span>
            </div>
          </div>
        </>
      )}

      {/* ── Final Determination Card ─────────────────────────────── */}
      {!calc.attorney_reviewed && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`surface-card p-6 text-center space-y-4 ${
            calc.eligibility_result === 'presumption_of_abuse'
              ? 'border-destructive/30'
              : calc.eligibility_result === 'borderline'
              ? 'border-warning/30'
              : 'border-success/30'
          }`}
        >
          {calc.eligibility_result === 'presumption_of_abuse' ? (
            <>
              <XCircle className="w-12 h-12 text-destructive mx-auto" />
              <h3 className="font-display text-xl font-bold text-foreground">Presumption of Abuse</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">{calc.eligibility_notes}</p>
              {isAttorney && !showSpecialCircumstances && (
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button variant="outline" onClick={() => setShowSpecialCircumstances(true)} className="gap-1.5">
                    Document Special Circumstances
                  </Button>
                  <Button variant="destructive" onClick={handleRecommendCh13} className="gap-1.5">
                    <ArrowRight className="w-4 h-4" /> Recommend Chapter 13
                  </Button>
                </div>
              )}
              {isAttorney && showSpecialCircumstances && (
                <div className="space-y-3 max-w-lg mx-auto text-left">
                  <label className="text-sm font-medium text-foreground">Special Circumstances</label>
                  <Textarea
                    value={specialCircumstances}
                    onChange={e => setSpecialCircumstances(e.target.value)}
                    placeholder="Describe special circumstances that rebut the presumption of abuse..."
                    className="min-h-[100px]"
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleDocumentSpecialCircumstances} disabled={!specialCircumstances.trim()}>
                      Save & Confirm Eligibility
                    </Button>
                    <Button variant="ghost" onClick={() => setShowSpecialCircumstances(false)}>Cancel</Button>
                  </div>
                </div>
              )}
              {!isAttorney && (
                <p className="text-xs text-muted-foreground">Attorney review required before proceeding.</p>
              )}
            </>
          ) : calc.eligibility_result === 'borderline' ? (
            <>
              <AlertTriangle className="w-12 h-12 text-warning mx-auto" />
              <h3 className="font-display text-xl font-bold text-foreground">Borderline — Attorney Review Required</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">{calc.eligibility_notes}</p>
              {isAttorney && (
                <Button onClick={handleConfirmEligibility} className="gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Confirm Eligibility
                </Button>
              )}
              {!isAttorney && (
                <p className="text-xs text-muted-foreground">Attorney review required before proceeding.</p>
              )}
            </>
          ) : (
            <>
              <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
              <h3 className="font-display text-xl font-bold text-foreground">Chapter 7 Eligible</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">{calc.eligibility_notes}</p>
              {isAttorney && (
                <Button onClick={handleConfirmEligibility} className="gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Confirm Eligibility
                </Button>
              )}
            </>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default MeansTestTab;
