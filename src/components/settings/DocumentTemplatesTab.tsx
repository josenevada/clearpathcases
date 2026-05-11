import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, GripVertical, Plus, Trash2, RotateCcw, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  getDocTemplates, saveDocTemplates, resetDocTemplates, buildDefaultTemplates,
  getNamedTemplates, saveNamedTemplates,
  CATEGORIES, type TemplateItem, type NamedTemplate,
} from '@/lib/store';
import { toast } from 'sonner';

const uid = () => Math.random().toString(36).substr(2, 9);

type Section = 'default' | 'custom';

const TEMPLATES_CONFIGURED_KEY = 'clearpath_templates_configured';
const markTemplatesConfigured = () => {
  try { localStorage.setItem(TEMPLATES_CONFIGURED_KEY, '1'); } catch { /* ignore */ }
};

const DocumentTemplatesTab = () => {
  const [section, setSection] = useState<Section>('default');
  const [templates, setTemplates] = useState<TemplateItem[]>(getDocTemplates());
  const [namedTemplates, setNamedTemplates] = useState<NamedTemplate[]>(getNamedTemplates());

  const persistDefault = useCallback((items: TemplateItem[]) => {
    setTemplates(items);
    saveDocTemplates(items);
    markTemplatesConfigured();
  }, []);

  const handleRestore = () => {
    resetDocTemplates();
    setTemplates(buildDefaultTemplates());
    markTemplatesConfigured();
    toast.success('Templates restored to defaults.');
  };

  const persistNamed = (next: NamedTemplate[]) => {
    setNamedTemplates(next);
    saveNamedTemplates(next);
    markTemplatesConfigured();
  };

  return (
    <div>
      {/* Section switcher */}
      <div className="inline-flex p-1 rounded-xl bg-muted/40 border border-border mb-6">
        {([
          { id: 'default' as const, label: 'Default Template' },
          { id: 'custom' as const, label: 'Custom Templates' },
        ]).map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={cn(
              'px-4 py-1.5 text-sm font-body rounded-lg transition-all',
              section === s.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'default' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground font-body">
              Configure the master checklist for new cases. Changes apply to new cases only.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm"><RotateCcw className="w-4 h-4 mr-1" /> Restore Defaults</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Restore default templates?</AlertDialogTitle>
                  <AlertDialogDescription>This will reset all document templates to the ClearPath defaults. Custom items will be removed. Existing cases are not affected.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRestore}>Restore</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <ChecklistEditor items={templates} onChange={persistDefault} />
        </>
      )}

      {section === 'custom' && (
        <CustomTemplatesSection
          templates={namedTemplates}
          onChange={persistNamed}
          defaultTemplates={templates}
        />
      )}
    </div>
  );
};

// ── Custom Templates Section ─────────────────────────────────────────
const CustomTemplatesSection = ({ templates, onChange, defaultTemplates }: {
  templates: NamedTemplate[];
  onChange: (next: NamedTemplate[]) => void;
  defaultTemplates: TemplateItem[];
}) => {
  const [editing, setEditing] = useState<NamedTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  const startNew = () => {
    // Pre-populate with active items from current default template
    const seed: TemplateItem[] = defaultTemplates
      .filter(t => t.active)
      .map((t, i) => ({ ...t, id: uid(), order: i }));
    setEditing({
      id: uid(),
      name: '',
      chapterType: '7',
      items: seed,
      createdAt: new Date().toISOString(),
    });
    setCreating(true);
  };

  const startEdit = (t: NamedTemplate) => {
    setEditing(JSON.parse(JSON.stringify(t)));
    setCreating(false);
  };

  const handleSave = (t: NamedTemplate) => {
    if (!t.name.trim()) {
      toast.error('Template name is required.');
      return;
    }
    const exists = templates.some(x => x.id === t.id);
    const next = exists
      ? templates.map(x => (x.id === t.id ? t : x))
      : [...templates, t];
    onChange(next);
    setEditing(null);
    setCreating(false);
    toast.success(exists ? 'Template updated.' : 'Template created.');
  };

  const handleDelete = (id: string) => {
    onChange(templates.filter(t => t.id !== id));
    toast.success('Template deleted.');
  };

  if (editing) {
    return (
      <NamedTemplateForm
        template={editing}
        isNew={creating}
        onSave={handleSave}
        onCancel={() => { setEditing(null); setCreating(false); }}
      />
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground font-body">
          Create alternate document checklists for specific case types. Selectable when creating a new case.
        </p>
        <Button size="sm" onClick={startNew}>
          <Plus className="w-4 h-4 mr-1" /> New Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="surface-card rounded-xl p-8 text-center">
          <p className="text-sm text-muted-foreground font-body">
            No custom templates yet. Create one to offer alternate document sets for specific case types.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => {
            const activeCount = t.items.filter(i => i.active).length;
            const chapterLabel =
              t.chapterType === 'both' ? 'Both' : `Ch.${t.chapterType}`;
            return (
              <div
                key={t.id}
                className="surface-card rounded-xl p-4 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-bold text-foreground truncate">{t.name}</span>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                      {chapterLabel}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-body mt-0.5">
                    {activeCount} active item{activeCount === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(t)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete "{t.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This template won't be available for new cases. Existing cases are not affected.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(t.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

// ── Named Template Form ──────────────────────────────────────────────
const NamedTemplateForm = ({ template, isNew, onSave, onCancel }: {
  template: NamedTemplate;
  isNew: boolean;
  onSave: (t: NamedTemplate) => void;
  onCancel: () => void;
}) => {
  const [name, setName] = useState(template.name);
  const [chapterType, setChapterType] = useState<NamedTemplate['chapterType']>(template.chapterType);
  const [items, setItems] = useState<TemplateItem[]>(template.items);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-lg text-foreground">
          {isNew ? 'New Custom Template' : `Edit "${template.name}"`}
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground text-sm">Template Name *</Label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Self-Employed Ch.7"
            className="mt-1 bg-input border-border rounded-[10px]"
          />
        </div>
        <div>
          <Label className="text-muted-foreground text-sm">Chapter Type *</Label>
          <div className="flex gap-2 mt-1">
            {([
              { value: '7' as const, label: 'Ch.7' },
              { value: '13' as const, label: 'Ch.13' },
              { value: 'both' as const, label: 'Both' },
            ]).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setChapterType(opt.value)}
                className={cn(
                  'flex-1 h-10 rounded-lg text-sm font-bold font-display transition-all border',
                  chapterType === opt.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary text-muted-foreground border-border hover:border-primary/50',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <Label className="text-muted-foreground text-sm mb-2 block">Checklist Items</Label>
        <ChecklistEditor items={items} onChange={setItems} />
      </div>

      <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-background py-3 border-t border-border">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave({ ...template, name: name.trim(), chapterType, items })}>
          Save Template
        </Button>
      </div>
    </div>
  );
};

// ── Reusable Checklist Editor ────────────────────────────────────────
const ChecklistEditor = ({ items, onChange }: {
  items: TemplateItem[];
  onChange: (items: TemplateItem[]) => void;
}) => {
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragItem, setDragItem] = useState<string | null>(null);

  const toggleCategory = (cat: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const toggleField = (id: string, field: 'required' | 'active') => {
    onChange(items.map(t => t.id === id ? { ...t, [field]: !t[field] } : t));
  };

  const deleteItem = (id: string) => {
    onChange(items.filter(t => t.id !== id));
    toast.success('Item removed.');
  };

  const handleDragStart = (id: string) => setDragItem(id);

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragItem || dragItem === targetId) return;
    const next = [...items];
    const fromIdx = next.findIndex(t => t.id === dragItem);
    const toIdx = next.findIndex(t => t.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    if (next[fromIdx].category !== next[toIdx].category) return;
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    next.forEach((item, i) => item.order = i);
    onChange(next);
  };

  const handleDragEnd = () => setDragItem(null);

  const getCategoryItems = (cat: string) =>
    items.filter(t => t.category === cat).sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-3">
      {(CATEGORIES as readonly string[]).map(cat => {
        const catItems = getCategoryItems(cat);
        const isOpen = expandedCats.has(cat);

        return (
          <div key={cat} className="surface-card overflow-hidden">
            <button
              onClick={() => toggleCategory(cat)}
              className="w-full flex items-center justify-between p-4 hover:bg-[hsl(var(--surface-hover))] transition-colors"
            >
              <div className="flex items-center gap-3">
                {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                <span className="font-display font-bold text-foreground">{cat}</span>
                <span className="text-xs text-muted-foreground font-body">{catItems.filter(i => i.active).length} active items</span>
              </div>
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-2">
                    {catItems.map(item => (
                      editingId === item.id ? (
                        <EditItemForm
                          key={item.id}
                          item={item}
                          onSave={(updated) => {
                            onChange(items.map(t => t.id === updated.id ? updated : t));
                            setEditingId(null);
                            toast.success('Item updated.');
                          }}
                          onCancel={() => setEditingId(null)}
                        />
                      ) : (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={() => handleDragStart(item.id)}
                          onDragOver={(e) => handleDragOver(e, item.id)}
                          onDragEnd={handleDragEnd}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            dragItem === item.id ? 'border-primary/50 opacity-50' : 'border-border'
                          } ${!item.active ? 'opacity-50' : ''}`}
                        >
                          <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className={`font-body text-sm ${item.active ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                              {item.label}
                            </p>
                            {item.isCustom && (
                              <span className="text-[10px] uppercase tracking-wider text-primary font-bold">Custom</span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground">Req</span>
                              <Switch checked={item.required} onCheckedChange={() => toggleField(item.id, 'required')} />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground">Active</span>
                              <Switch checked={item.active} onCheckedChange={() => toggleField(item.id, 'active')} />
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingId(item.id)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            {item.isCustom && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete "{item.label}"?</AlertDialogTitle>
                                    <AlertDialogDescription>This removes it from the template. Existing cases are not affected.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteItem(item.id)}>Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </div>
                      )
                    ))}

                    {addingTo === cat ? (
                      <AddItemForm
                        category={cat}
                        order={catItems.length > 0 ? Math.max(...catItems.map(i => i.order)) + 1 : 0}
                        onSave={(newItem) => {
                          onChange([...items, newItem]);
                          setAddingTo(null);
                          toast.success('Custom item added.');
                        }}
                        onCancel={() => setAddingTo(null)}
                      />
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-1 border border-dashed border-border text-muted-foreground"
                        onClick={() => setAddingTo(cat)}
                      >
                        <Plus className="w-4 h-4 mr-1" /> Add Custom Item
                      </Button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};

const AddItemForm = ({ category, order, onSave, onCancel }: {
  category: string;
  order: number;
  onSave: (item: TemplateItem) => void;
  onCancel: () => void;
}) => {
  const [form, setForm] = useState({ label: '', description: '', whyWeNeedThis: '', required: false });

  return (
    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
      <div>
        <Label className="text-muted-foreground text-sm">Document Name *</Label>
        <Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} className="mt-1 bg-input border-border rounded-[10px]" />
      </div>
      <div>
        <Label className="text-muted-foreground text-sm">Plain English Description</Label>
        <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1 bg-input border-border rounded-[10px] min-h-[60px]" />
      </div>
      <div>
        <Label className="text-muted-foreground text-sm">Why We Need This</Label>
        <Textarea value={form.whyWeNeedThis} onChange={e => setForm({ ...form, whyWeNeedThis: e.target.value })} className="mt-1 bg-input border-border rounded-[10px] min-h-[60px]" />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={form.required} onCheckedChange={v => setForm({ ...form, required: v })} />
        <span className="text-sm text-muted-foreground">Required</span>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" disabled={!form.label.trim()} onClick={() => onSave({
          id: uid(),
          category,
          label: form.label.trim(),
          description: form.description.trim(),
          whyWeNeedThis: form.whyWeNeedThis.trim(),
          required: form.required,
          active: true,
          isCustom: true,
          order,
        })}>Save Item</Button>
      </div>
    </motion.div>
  );
};

const EditItemForm = ({ item, onSave, onCancel }: {
  item: TemplateItem;
  onSave: (item: TemplateItem) => void;
  onCancel: () => void;
}) => {
  const [form, setForm] = useState({
    label: item.label,
    description: item.description,
    whyWeNeedThis: item.whyWeNeedThis,
    required: item.required,
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
      <div>
        <Label className="text-muted-foreground text-sm">Document Name *</Label>
        <Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} className="mt-1 bg-input border-border rounded-[10px]" />
      </div>
      <div>
        <Label className="text-muted-foreground text-sm">Plain English Description</Label>
        <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1 bg-input border-border rounded-[10px] min-h-[60px]" />
      </div>
      <div>
        <Label className="text-muted-foreground text-sm">Why We Need This</Label>
        <Textarea value={form.whyWeNeedThis} onChange={e => setForm({ ...form, whyWeNeedThis: e.target.value })} className="mt-1 bg-input border-border rounded-[10px] min-h-[60px]" />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={form.required} onCheckedChange={v => setForm({ ...form, required: v })} />
        <span className="text-sm text-muted-foreground">Required</span>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" disabled={!form.label.trim()} onClick={() => onSave({
          ...item,
          label: form.label.trim(),
          description: form.description.trim(),
          whyWeNeedThis: form.whyWeNeedThis.trim(),
          required: form.required,
        })}>Save</Button>
      </div>
    </motion.div>
  );
};

export default DocumentTemplatesTab;
