import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, GripVertical, Plus, Trash2, RotateCcw, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  getDocTemplates, saveDocTemplates, resetDocTemplates, buildDefaultTemplates,
  CATEGORIES, type TemplateItem,
} from '@/lib/store';
import { toast } from 'sonner';

const uid = () => Math.random().toString(36).substr(2, 9);

const DocumentTemplatesTab = () => {
  const [templates, setTemplates] = useState<TemplateItem[]>(getDocTemplates());
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragItem, setDragItem] = useState<string | null>(null);

  const persist = useCallback((items: TemplateItem[]) => {
    setTemplates(items);
    saveDocTemplates(items);
  }, []);

  const toggleCategory = (cat: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const toggleField = (id: string, field: 'required' | 'active') => {
    persist(templates.map(t => t.id === id ? { ...t, [field]: !t[field] } : t));
  };

  const deleteItem = (id: string) => {
    persist(templates.filter(t => t.id !== id));
    toast.success('Item removed.');
  };

  const handleRestore = () => {
    resetDocTemplates();
    setTemplates(buildDefaultTemplates());
    toast.success('Templates restored to defaults.');
  };

  const handleDragStart = (id: string) => setDragItem(id);

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragItem || dragItem === targetId) return;
    const items = [...templates];
    const fromIdx = items.findIndex(t => t.id === dragItem);
    const toIdx = items.findIndex(t => t.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    if (items[fromIdx].category !== items[toIdx].category) return;
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    items.forEach((item, i) => item.order = i);
    persist(items);
  };

  const handleDragEnd = () => setDragItem(null);

  const getCategoryItems = (cat: string) =>
    templates.filter(t => t.category === cat).sort((a, b) => a.order - b.order);

  return (
    <div>
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

      <div className="space-y-3">
        {(CATEGORIES as readonly string[]).map(cat => {
          const items = getCategoryItems(cat);
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
                  <span className="text-xs text-muted-foreground font-body">{items.filter(i => i.active).length} active items</span>
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
                      {items.map(item => (
                        editingId === item.id ? (
                          <EditItemForm
                            key={item.id}
                            item={item}
                            onSave={(updated) => {
                              persist(templates.map(t => t.id === updated.id ? updated : t));
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
                          order={items.length > 0 ? Math.max(...items.map(i => i.order)) + 1 : 0}
                          onSave={(newItem) => {
                            persist([...templates, newItem]);
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
