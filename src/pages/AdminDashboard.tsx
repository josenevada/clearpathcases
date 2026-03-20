import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Building2, LogOut, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import Logo from '@/components/Logo';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FirmRow {
  id: string;
  name: string;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  created_at: string | null;
  caseCount: number;
}

const AdminDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [firms, setFirms] = useState<FirmRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newFirm, setNewFirm] = useState({ name: '', contactName: '', contactEmail: '' });
  const [creating, setCreating] = useState(false);

  const loadFirms = async () => {
    const { data: firmsData } = await supabase.from('firms').select('*');
    if (!firmsData) return;

    // Get case counts per firm
    const firmRows: FirmRow[] = await Promise.all(
      firmsData.map(async (firm) => {
        const { count } = await supabase
          .from('cases')
          .select('*', { count: 'exact', head: true })
          .eq('firm_id', firm.id);
        return {
          id: firm.id,
          name: firm.name,
          primary_contact_name: firm.primary_contact_name,
          primary_contact_email: firm.primary_contact_email,
          created_at: firm.created_at,
          caseCount: count ?? 0,
        };
      })
    );

    setFirms(firmRows);
  };

  useEffect(() => {
    loadFirms();
  }, []);

  const handleCreateFirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    const slug = newFirm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const { error } = await supabase.from('firms').insert({
      name: newFirm.name,
      primary_contact_name: newFirm.contactName,
      primary_contact_email: newFirm.contactEmail,
      slug,
    });

    setCreating(false);

    if (error) {
      toast.error('Failed to create firm: ' + error.message);
      return;
    }

    toast.success(`${newFirm.name} created! A welcome email would be sent to ${newFirm.contactEmail}.`);
    setShowCreate(false);
    setNewFirm({ name: '', contactName: '', contactEmail: '' });
    loadFirms();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-6">
          <Logo size="sm" />
          <span className="text-sm text-muted-foreground font-body">Super Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-muted-foreground md:block">{user?.fullName}</span>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1" /> New Firm
          </Button>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h2 className="font-display text-2xl font-bold text-foreground mb-6">All Firms</h2>

        {firms.length === 0 ? (
          <div className="py-20 text-center">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground mb-4">No firms registered yet.</p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-1" /> Create First Firm
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {firms.map((firm, index) => (
              <motion.div
                key={firm.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.2 }}
                className="surface-card p-5 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold text-lg text-foreground">{firm.name}</h3>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-1">
                    {firm.primary_contact_name && <span>{firm.primary_contact_name}</span>}
                    <span>{firm.caseCount} active case{firm.caseCount !== 1 ? 's' : ''}</span>
                    {firm.created_at && (
                      <span>Joined {format(new Date(firm.created_at), 'MMM d, yyyy')}</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Store viewed firm in session for read-only browsing
                    sessionStorage.setItem('admin_viewing_firm', firm.id);
                    navigate('/paralegal');
                  }}
                >
                  <Eye className="w-3 h-3 mr-1" /> View Firm
                </Button>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md border-border bg-background">
          <DialogHeader>
            <DialogTitle className="font-display font-bold">Create New Firm</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add a new firm to the ClearPath platform.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateFirm} className="space-y-4 mt-4">
            <div>
              <Label className="text-muted-foreground text-sm">Firm Name *</Label>
              <Input
                value={newFirm.name}
                onChange={e => setNewFirm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Johnson & Associates"
                className="mt-1 bg-input border-border rounded-[10px]"
                required
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">Primary Contact Name *</Label>
              <Input
                value={newFirm.contactName}
                onChange={e => setNewFirm(p => ({ ...p, contactName: e.target.value }))}
                placeholder="e.g. Sarah Johnson"
                className="mt-1 bg-input border-border rounded-[10px]"
                required
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">Primary Contact Email *</Label>
              <Input
                type="email"
                value={newFirm.contactEmail}
                onChange={e => setNewFirm(p => ({ ...p, contactEmail: e.target.value }))}
                placeholder="contact@firm.com"
                className="mt-1 bg-input border-border rounded-[10px]"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating…' : 'Create Firm'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
