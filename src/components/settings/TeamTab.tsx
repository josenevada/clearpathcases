import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/lib/subscription';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { UserPlus, Trash2, Send, RotateCw, XCircle } from 'lucide-react';
import UpgradeModal from '@/components/UpgradeModal';
import { getPlanLimits } from '@/lib/plan-limits';

const PLAN_USER_LIMITS: Record<string, number> = {
  solo: 1,
  starter: 2,
  professional: 10,
  firm: Infinity,
};

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  last_sign_in: string | null;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  invited_by: string | null;
  invited_at: string | null;
  status: string;
}

const TeamTab = () => {
  const { user } = useAuth();
  const { plan } = useSubscription();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('paralegal');
  const [inviteMessage, setInviteMessage] = useState('Welcome to our ClearPath workspace. Please create your account to get started.');
  const [sending, setSending] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [firmName, setFirmName] = useState('');
  const [loading, setLoading] = useState(true);

  const planLimits = getPlanLimits(plan);
  const userLimit = planLimits.staffUsers;
  const currentCount = members.length;
  const pendingCount = invitations.filter(i => i.status === 'pending').length;
  const atLimit = (currentCount + pendingCount) >= userLimit && userLimit !== Infinity;

  const fetchData = async () => {
    if (!user?.firmId) return;
    setLoading(true);

    const [membersRes, invitesRes, firmRes] = await Promise.all([
      supabase.from('users').select('id, full_name, email, role, last_sign_in').eq('firm_id', user.firmId),
      supabase.from('team_invitations').select('*').eq('firm_id', user.firmId).eq('status', 'pending'),
      supabase.from('firms').select('name').eq('id', user.firmId).single(),
    ]);

    if (membersRes.data) setMembers(membersRes.data);
    if (invitesRes.data) setInvitations(invitesRes.data as Invitation[]);
    if (firmRes.data) setFirmName(firmRes.data.name);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user?.firmId]);

  const handleInvite = async () => {
    if (!inviteEmail || !user?.firmId) return;
    setSending(true);
    try {
      // Check if already a member
      const existing = members.find(m => m.email.toLowerCase() === inviteEmail.toLowerCase());
      if (existing) {
        toast.error('This person is already a team member');
        setSending(false);
        return;
      }

      // Check pending
      const pendingExisting = invitations.find(i => i.email.toLowerCase() === inviteEmail.toLowerCase() && i.status === 'pending');
      if (pendingExisting) {
        toast.error('An invitation is already pending for this email');
        setSending(false);
        return;
      }

      // Create invitation record
      const { data: invite, error: insertError } = await supabase
        .from('team_invitations')
        .insert({
          firm_id: user.firmId,
          email: inviteEmail,
          role: inviteRole,
          invited_by: user.fullName,
          personal_message: inviteMessage,
        })
        .select()
        .single();
      if (insertError) throw insertError;

      // Send email
      const { error: emailError } = await supabase.functions.invoke('send-invitation', {
        body: {
          invitationId: invite.id,
          firmName,
          inviterName: user.fullName,
          recipientEmail: inviteEmail,
          role: inviteRole,
          personalMessage: inviteMessage,
        },
      });
      if (emailError) console.error('Email send error:', emailError);

      toast.success(`Invitation sent to ${inviteEmail}`);
      setShowInviteForm(false);
      setInviteEmail('');
      setInviteRole('paralegal');
      setInviteMessage('Welcome to our ClearPath workspace. Please create your account to get started.');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  const handleResend = async (inv: Invitation) => {
    try {
      const { error } = await supabase.functions.invoke('send-invitation', {
        body: {
          invitationId: inv.id,
          firmName,
          inviterName: inv.invited_by || user?.fullName,
          recipientEmail: inv.email,
          role: inv.role,
          personalMessage: '',
        },
      });
      if (error) throw error;
      toast.success(`Invitation resent to ${inv.email}`);
    } catch {
      toast.error('Failed to resend invitation');
    }
  };

  const handleRevoke = async (inv: Invitation) => {
    const { error } = await supabase.from('team_invitations').delete().eq('id', inv.id);
    if (error) {
      toast.error('Failed to revoke invitation');
    } else {
      toast.success('Invitation revoked');
      fetchData();
    }
  };

  const handleRemoveMember = async () => {
    if (!removeTarget) return;
    const { error } = await supabase.from('users').delete().eq('id', removeTarget.id);
    if (error) {
      toast.error('Failed to remove team member');
    } else {
      toast.success(`${removeTarget.full_name} has been removed`);
      fetchData();
    }
    setRemoveTarget(null);
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground font-body animate-pulse">Loading team…</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display font-bold text-lg text-foreground mb-1">Team Members</h2>
        <p className="text-sm text-muted-foreground font-body">Manage who has access to your firm's ClearPath workspace.</p>
      </div>

      {/* Invite button or limit message */}
      {atLimit ? (
        <div className="surface-card p-4 text-center">
          <p className="text-sm text-muted-foreground font-body mb-2">You have reached your plan's user limit ({userLimit === Infinity ? '∞' : userLimit} staff members).</p>
          <Button variant="outline" size="sm" onClick={() => setShowUpgrade(true)}>Upgrade Plan</Button>
        </div>
      ) : (
        !showInviteForm && (
          <Button onClick={() => setShowInviteForm(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Invite Team Member
          </Button>
        )
      )}

      {/* Invite form */}
      {showInviteForm && (
        <div className="surface-card p-5 space-y-4">
          <h3 className="font-display font-bold text-foreground">Invite Team Member</h3>
          <div>
            <Label className="font-body">Email Address</Label>
            <Input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="colleague@lawfirm.com"
              className="border border-foreground/[0.12] bg-background"
            />
          </div>
          <div>
            <Label className="font-body">Role</Label>
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger className="border border-foreground/[0.12] bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paralegal">Paralegal</SelectItem>
                <SelectItem value="attorney">Attorney</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="font-body">Personal Message (optional)</Label>
            <Textarea
              value={inviteMessage}
              onChange={e => setInviteMessage(e.target.value)}
              rows={3}
              className="border border-foreground/[0.12] bg-background font-body text-sm"
            />
          </div>
          <div className="flex gap-3">
            <Button onClick={handleInvite} disabled={sending || !inviteEmail}>
              <Send className="w-4 h-4 mr-2" />
              {sending ? 'Sending…' : 'Send Invitation'}
            </Button>
            <Button variant="ghost" onClick={() => setShowInviteForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Current members */}
      <div className="surface-card overflow-hidden">
        <div className="divide-y divide-border/40">
          {members.map(m => (
            <div key={m.id} className="flex items-center justify-between px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{m.full_name}</p>
                <p className="text-xs text-muted-foreground">{m.email}</p>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 py-0.5 rounded-full bg-secondary mr-4 capitalize">
                {m.role}
              </span>
              <span className="text-xs text-muted-foreground mr-4 hidden sm:block">
                {m.last_sign_in ? new Date(m.last_sign_in).toLocaleDateString() : 'Never'}
              </span>
              {m.id !== user?.id && (
                <Button variant="ghost" size="sm" onClick={() => setRemoveTarget(m)} className="text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div>
          <h3 className="font-display font-bold text-foreground mb-3">Pending Invitations</h3>
          <div className="surface-card overflow-hidden">
            <div className="divide-y divide-border/40">
              {invitations.map(inv => (
                <div key={inv.id} className="flex items-center justify-between px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Sent {inv.invited_at ? new Date(inv.invited_at).toLocaleDateString() : 'recently'}
                    </p>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 py-0.5 rounded-full bg-secondary mr-4 capitalize">
                    {inv.role}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleResend(inv)} title="Resend">
                      <RotateCw className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleRevoke(inv)} className="text-destructive hover:text-destructive" title="Revoke">
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Remove confirmation dialog */}
      <AlertDialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.full_name} will lose access to your firm's ClearPath workspace. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <UpgradeModal
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        featureName="Staff User Limit Reached"
        description={`Your current plan supports up to ${userLimit} staff member${userLimit !== 1 ? 's' : ''}. Upgrade to add more team members.`}
      />
    </div>
  );
};

export default TeamTab;
