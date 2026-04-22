import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Scale, Loader2, RefreshCw, CheckCircle2, AlertTriangle, XCircle,
  Pencil, Lock, Shield, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/auth';
import { useSubscription } from '@/lib/subscription';
import { getPlanLimits } from '@/lib/plan-limits';
import UpgradeModal from '@/components/UpgradeModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Case } from '@/lib/store';

interface ExemptionAnalysis {
  id: string;
  case_id: string;
  client_state: string;
  recommended_system: string;
  federal_total_protected: number;
  state_total_protected: number;
  total_assets: number;
  total_exposed: number;
  analysis_notes: string | null;
  attorney_approved: boolean;
  attorney_approved_by: string | null;
  attorney_approved_at: string | null;
  selected_system: string | null;
  created_at: string;
  updated_at: string;
}

interface ExemptionLineItem {
  id: string;
  analysis_id: string;
  asset_type: string;
  asset_description: string;
  asset_value: number;
  exemption_system: string;
  exemption_name: string;
  exemption_statute: string | null;
  exemption_amount: number;
  protected_amount: number;
  exposed_amount: number;
  status: string;
  attorney_notes: string | null;
  attorney_override_amount: number | null;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

interface ExemptionsTabProps {
  caseData: Case;
  onRefresh: () => void;
}

const ExemptionsTab = ({ caseData, onRefresh }: ExemptionsTabProps) => {
  const { user } = useAuth();
  const { plan } = useSubscription();
  const planLimits = getPlanLimits(plan);
  const isAttorney = user?.role === 'attorney';

  const [analysis, setAnalysis] = useState<ExemptionAnalysis | null>(null);
  const [lineItems, setLineItems] = useState<ExemptionLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [editingAsset, setEditingAsset] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const isGated = plan === 'starter';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: analysisData } = await supabase
        .from('exemption_analyses')
        .select('*')
        .eq('case_id', caseData.id)
        .maybeSingle();

      setAnalysis(analysisData as ExemptionAnalysis | null);

      if (analysisData) {
        const { data: items } = await supabase
          .from('exemption_line_items')
          .select('*')
          .eq('analysis_id', analysisData.id)
          .order('asset_type');

        setLineItems((items || []) as ExemptionLineItem[]);
      }
    } catch (err) {
      console.error('Error fetching exemption data:', err);
    } finally {
      setLoading(false);
    }
  }, [caseData.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-exemptions', {
        body: { case_id: caseData.id }
      });
      if (error) throw error;
      toast.success('Exemption analysis complete');
      await fetchData();
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApprove = async (system: string) => {
    if (!analysis) return;
    try {
      await supabase
        .from('exemption_analyses')
        .update({
          selected_system: system,
          attorney_approved: true,
          attorney_approved_by: user?.id || null,
          attorney_approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', analysis.id);

      // Update Schedule C in case_extracted_data
      const recommendedItems = lineItems.filter(i => i.exemption_system === system);
      for (let n = 0; n < recommendedItems.length; n++) {
        const item = recommendedItems[n];
        const fields = [
          { field_key: `schedule_c_asset_${n + 1}_description`, field_value: item.asset_description, field_label: `Schedule C Asset ${n + 1} Description` },
          { field_key: `schedule_c_asset_${n + 1}_value`, field_value: String(item.asset_value), field_label: `Schedule C Asset ${n + 1} Value` },
          { field_key: `schedule_c_asset_${n + 1}_exemption_statute`, field_value: item.exemption_statute || '', field_label: `Schedule C Asset ${n + 1} Exemption Statute` },
          { field_key: `schedule_c_asset_${n + 1}_exemption_amount`, field_value: String(item.protected_amount), field_label: `Schedule C Asset ${n + 1} Exemption Amount` },
        ];
        for (const f of fields) {
          await supabase.from('case_extracted_data').upsert({
            case_id: caseData.id,
            ...f,
            form_reference: 'B106C',
            section_label: 'Exemptions',
            manually_overridden: true,
            override_by: user?.id || null,
            override_at: new Date().toISOString(),
          }, { onConflict: 'case_id,field_key' });
        }
      }

      // Log activity
      await supabase.from('activity_log').insert({
        case_id: caseData.id,
        event_type: system === analysis.recommended_system ? 'exemption_approved' : 'exemption_overridden',
        description: system === analysis.recommended_system
          ? `Attorney ${user?.fullName} approved ${system} exemptions for filing. Schedule C updated.`
          : `Attorney ${user?.fullName} overrode recommendation — selected ${system} instead of ${analysis.recommended_system}.`,
        actor_name: user?.fullName,
        actor_role: 'attorney',
      });

      toast.success('Exemptions approved — Schedule C updated');
      await fetchData();
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve');
    }
  };

  const handleAssetValueUpdate = async (itemId: string, newValue: number) => {
    setEditingAsset(null);
    try {
      await supabase.from('exemption_line_items')
        .update({ asset_value: newValue })
        .eq('id', itemId);

      await supabase.from('activity_log').insert({
        case_id: caseData.id,
        event_type: 'exemption_asset_updated',
        description: `Asset value updated by ${user?.fullName}.`,
        actor_name: user?.fullName,
        actor_role: user?.role || 'paralegal',
      });

      toast.success('Asset value updated — re-run analysis for updated results');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    }
  };

  // ─── Gated State ───────────────────────────────────────────
  if (isGated) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold font-heading text-foreground">Exemption Optimizer</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Exemption Optimizer is available on Professional and Firm plans. Automatically analyze assets against state and federal exemptions.
        </p>
        <Button onClick={() => setShowUpgrade(true)} className="bg-primary text-primary-foreground">
          Upgrade to Unlock
        </Button>
        <UpgradeModal
          open={showUpgrade}
          onOpenChange={setShowUpgrade}
          featureName="Exemption Optimizer"
          description="Automatically analyze assets against state and federal exemptions. Available on Professional and Firm plans."
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

  // ─── Empty State ───────────────────────────────────────────
  if (!analysis) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto py-16 text-center space-y-6"
      >
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Scale className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold font-heading text-foreground">Exemption Analysis Not Yet Run</h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Run exemption analysis to see which exemption system protects the most assets for this client.
        </p>
        <Button
          onClick={runAnalysis}
          disabled={analyzing}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          size="lg"
        >
          {analyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Scale className="w-4 h-4 mr-2" />}
          Analyze Exemptions
        </Button>
        <p className="text-xs text-muted-foreground">Requires document extraction to be complete first</p>
      </motion.div>
    );
  }

  // ─── Results ───────────────────────────────────────────────
  const recommendedItems = lineItems.filter(i => i.exemption_system === (analysis.selected_system || analysis.recommended_system));
  const alternateSystem = analysis.recommended_system === 'federal' ? 'state' :
    analysis.recommended_system === 'state_system1' ? 'state_system2' :
    analysis.recommended_system === 'state_system2' ? 'state_system1' : 'federal';
  const alternateItems = lineItems.filter(i => i.exemption_system === alternateSystem);

  const getSystemLabel = (sys: string) => {
    if (sys === 'federal') return 'Federal Exemptions';
    if (sys === 'state_system1') return `${analysis.client_state} System 1 (CCP § 704)`;
    if (sys === 'state_system2') return `${analysis.client_state} System 2 (CCP § 703)`;
    return `${analysis.client_state} State Exemptions`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'fully_protected':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Fully Protected</Badge>;
      case 'partially_protected':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">Partially Protected</Badge>;
      case 'unprotected':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Unprotected</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-xs">Unknown — Verify</Badge>;
    }
  };

  const stateAllowsFederal = alternateItems.length > 0 && !analysis.recommended_system.startsWith('state_system');
  const hasTwoSystems = analysis.recommended_system.startsWith('state_system');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto space-y-6 pb-8">
      {/* Re-run button */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={runAnalysis}
          disabled={analyzing}
          className="text-muted-foreground hover:text-foreground"
        >
          {analyzing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
          Re-run Analysis
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Total Assets" value={fmt(analysis.total_assets)} color="text-foreground" />
        <SummaryCard
          label="Total Protected"
          value={fmt(analysis.total_assets - analysis.total_exposed)}
          color="text-emerald-400"
        />
        <SummaryCard
          label="Total Exposed"
          value={analysis.total_exposed > 0 ? fmt(analysis.total_exposed) : 'Fully Protected'}
          color={analysis.total_exposed > 0 ? 'text-red-400' : 'text-emerald-400'}
        />
        <SummaryCard
          label="Recommended System"
          value={
            analysis.recommended_system === 'federal' ? 'Federal' :
            analysis.recommended_system === 'state_system1' ? 'State System 1' :
            analysis.recommended_system === 'state_system2' ? 'State System 2' : 'State'
          }
          color="text-primary"
          badge
        />
      </div>

      {/* Opt-out state banner */}
      {!stateAllowsFederal && !hasTwoSystems && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-300">
              {analysis.client_state} does not allow federal exemption election. State exemptions apply.
            </p>
          </div>
        </div>
      )}

      {/* California dual system banner */}
      {hasTwoSystems && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-300">
              California does not allow federal exemption election. Choose between System 1 and System 2.
            </p>
          </div>
        </div>
      )}

      {/* System comparison (when applicable) */}
      {(stateAllowsFederal || hasTwoSystems) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SystemCard
            label={getSystemLabel(analysis.recommended_system)}
            amount={analysis.recommended_system === 'federal' ? analysis.federal_total_protected : analysis.state_total_protected}
            isRecommended
          />
          <SystemCard
            label={getSystemLabel(alternateSystem)}
            amount={alternateSystem === 'federal' ? analysis.federal_total_protected :
              hasTwoSystems ? (alternateSystem === 'state_system1' ? analysis.state_total_protected : analysis.federal_total_protected) :
              analysis.state_total_protected}
            isRecommended={false}
          />
        </div>
      )}

      {/* Asset analysis table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/30">
          <h3 className="text-lg font-bold font-heading text-foreground">Asset Analysis — {getSystemLabel(analysis.selected_system || analysis.recommended_system)}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Exemption amounts reflect April 2025 figures. Verify current amounts at IRS.gov before filing.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Asset</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Value</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Exemption Applied</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Protected</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Exposed</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {recommendedItems.map((item) => (
                <tr key={item.id} className={`border-b border-border/50 ${item.asset_value === 0 ? 'bg-muted/10' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">{item.asset_description}</span>
                    {item.asset_value === 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">Value unknown — verify with client</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingAsset === item.id ? (
                      <div className="flex items-center gap-1 justify-end">
                        <Input
                          type="number"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="w-24 h-7 text-xs"
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleAssetValueUpdate(item.id, parseFloat(editValue) || 0);
                            if (e.key === 'Escape') setEditingAsset(null);
                          }}
                          autoFocus
                        />
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleAssetValueUpdate(item.id, parseFloat(editValue) || 0)}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 justify-end">
                        <span className="text-foreground">{fmt(item.asset_value)}</span>
                        <button
                          onClick={() => { setEditingAsset(item.id); setEditValue(String(item.asset_value)); }}
                          className="text-muted-foreground hover:text-foreground p-0.5"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <span className="text-foreground text-xs">{item.exemption_name}</span>
                      {item.exemption_statute && (
                        <p className="text-[10px] text-muted-foreground">{item.exemption_statute}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-400 font-medium">{fmt(item.protected_amount)}</td>
                  <td className="px-4 py-3 text-right">
                    {item.exposed_amount > 0 ? (
                      <span className="text-red-400 font-medium">{fmt(item.exposed_amount)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">{getStatusBadge(item.status)}</td>
                </tr>
              ))}

              {/* Totals row */}
              <tr className="bg-muted/30 font-bold">
                <td className="px-4 py-3 text-foreground">Total</td>
                <td className="px-4 py-3 text-right text-foreground">{fmt(analysis.total_assets)}</td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-right text-emerald-400">{fmt(analysis.total_assets - analysis.total_exposed)}</td>
                <td className="px-4 py-3 text-right text-red-400">
                  {analysis.total_exposed > 0 ? fmt(analysis.total_exposed) : '—'}
                </td>
                <td className="px-4 py-3"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Attorney approval section */}
      {!analysis.attorney_approved ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 space-y-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-amber-300 font-heading">Attorney Review Required</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Review the recommended exemption elections. Select which system to use and approve before including in the court packet.
              </p>
              <p className="text-xs text-muted-foreground mt-2 italic">
                Suggested — Attorney Review Required. This is a research tool, not legal advice.
              </p>
            </div>
          </div>

          {isAttorney && (
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                onClick={() => handleApprove(analysis.recommended_system)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Use {getSystemLabel(analysis.recommended_system)}
              </Button>
              {(stateAllowsFederal || hasTwoSystems) && (
                <Button
                  variant="outline"
                  onClick={() => handleApprove(alternateSystem)}
                >
                  Override — Use {getSystemLabel(alternateSystem)}
                </Button>
              )}
            </div>
          )}

          {!isAttorney && (
            <p className="text-xs text-muted-foreground italic">Only attorneys can approve exemption elections.</p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-300">
              Approved — {getSystemLabel(analysis.selected_system || analysis.recommended_system)} selected
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {analysis.attorney_approved_at && `Confirmed on ${new Date(analysis.attorney_approved_at).toLocaleDateString()}`}. Schedule C has been updated.
            </p>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-2 px-1">
        <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Exemption amounts reflect April 2025 figures. Amounts are periodically adjusted by federal and state courts.
          Verify current amounts at IRS.gov and applicable state resources before filing.
          This tool provides research assistance only — not legal advice.
        </p>
      </div>
    </motion.div>
  );
};

// ─── Sub-components ──────────────────────────────────────────

const SummaryCard = ({ label, value, color, badge }: { label: string; value: string; color: string; badge?: boolean }) => (
  <div className="rounded-xl border border-border p-4 bg-card">
    <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
    {badge ? (
      <Badge className="bg-primary/20 text-primary border-primary/30 text-sm font-bold">{value}</Badge>
    ) : (
      <p className={`text-xl font-bold font-heading ${color}`}>{value}</p>
    )}
  </div>
);

const SystemCard = ({ label, amount, isRecommended }: { label: string; amount: number; isRecommended: boolean }) => (
  <div className={`rounded-xl border p-5 ${isRecommended ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'}`}>
    <div className="flex items-center justify-between mb-2">
      <h4 className="text-sm font-bold text-foreground font-heading">{label}</h4>
      {isRecommended && (
        <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] font-bold">RECOMMENDED</Badge>
      )}
    </div>
    <p className={`text-2xl font-bold font-heading ${isRecommended ? 'text-primary' : 'text-muted-foreground'}`}>
      {fmt(amount)}
    </p>
    <p className="text-xs text-muted-foreground mt-1">Total protected</p>
  </div>
);

export default ExemptionsTab;
