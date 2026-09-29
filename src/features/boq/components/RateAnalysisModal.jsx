import { useState, useEffect } from 'react';
import { Calculator, Plus, Trash2 } from 'lucide-react';
import { boqApi } from '../../../api/apiservice';
import { EntityEditModal } from '../../../components/composite/EntityEditModal';
import { FormField } from '../../../components/composite/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { toast } from '../../../components/composite/Toast';

const COMPONENT_TYPES = [
  { value: '1', label: 'Material' },
  { value: '2', label: 'Labour' },
  { value: '3', label: 'Machinery / Equipment' },
  { value: '4', label: 'Subcontract' },
  { value: '5', label: 'Overheads & Profit' },
];

const COMPONENT_VARIANTS = {
  '1': 'primary',
  '2': 'warning',
  '3': 'neutral',
  '4': 'secondary',
  '5': 'neutral',
};

export function RateAnalysisModal({ isOpen, item, onClose }) {
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // New component form state
  const [form, setForm] = useState({
    component_type_id: '1',
    component_name: '',
    quantity_factor: '1',
    component_rate: '0',
    remarks: '',
  });

  const fetchComponents = () => {
    if (!item?.boq_id || !item?.id) return;
    setLoading(true);
    boqApi.rateComponents.list(item.boq_id, item.id)
      .then((res) => {
        const list = res?.data?.rate_components ?? res?.rate_components ?? (Array.isArray(res?.data) ? res.data : []);
        setComponents(Array.isArray(list) ? list : []);
      })
      .catch(() => toast.error('Failed to load rate components.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen && item) {
      fetchComponents();
      setForm({ component_type_id: '1', component_name: '', quantity_factor: '1', component_rate: '0', remarks: '' });
    }
  }, [isOpen, item]);

  const handleAdd = async (e) => {
    e?.preventDefault();
    if (!form.component_name.trim()) {
      toast.error('Component description/name is required.');
      return;
    }

    setSaving(true);
    try {
      await boqApi.rateComponents.create(item.boq_id, item.id, {
        component_type_id: Number(form.component_type_id),
        component_name: form.component_name.trim(),
        quantity_factor: Number(form.quantity_factor || 1),
        component_rate: Number(form.component_rate || 0),
        remarks: form.remarks?.trim() || null,
      });
      toast.success('Rate component added successfully.');
      setForm({ component_type_id: '1', component_name: '', quantity_factor: '1', component_rate: '0', remarks: '' });
      fetchComponents();
    } catch (err) {
      toast.error(err?.message || 'Failed to add component. Ensure BOQ is in Draft.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (comp) => {
    try {
      await boqApi.rateComponents.remove(item.boq_id, item.id, comp.id);
      toast.success('Component removed.');
      fetchComponents();
    } catch (err) {
      toast.error(err?.message || 'Failed to remove component.');
    }
  };

  const totalRate = components.reduce(
    (acc, c) => acc + Number(c.quantity_factor || 1) * Number(c.component_rate || 0),
    0
  );

  if (!isOpen || !item) return null;

  return (
    <EntityEditModal isOpen={isOpen} onClose={onClose} size="lg">
      <EntityEditModal.Header
        icon={Calculator}
        title="Rate Analysis Breakdown"
        subtitle={`Item: ${item.item_code || ''} — ${item.item_name || item.description || ''}`}
        onClose={onClose}
      />

      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
        <EntityEditModal.Body>
          <EntityEditModal.Section title="Configured Rate Components">
            {loading ? (
              <div className="text-xs text-text-muted py-4 text-center">Loading components...</div>
            ) : components.length === 0 ? (
              <div className="text-xs text-text-muted italic py-4 text-center bg-surface-muted/30 rounded-md">
                No rate components found. Define Material, Labour, and Equipment components below.
              </div>
            ) : (
              <div className="overflow-x-auto border border-border rounded-lg bg-surface">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-muted text-text-secondary uppercase font-semibold border-b border-border text-[10px]">
                    <tr>
                      <th className="px-3 py-2 w-28">Type</th>
                      <th className="px-3 py-2">Component</th>
                      <th className="px-3 py-2 text-right w-24">Qty Factor</th>
                      <th className="px-3 py-2 text-right w-28">Rate (₹)</th>
                      <th className="px-3 py-2 text-right w-32">Contribution (₹)</th>
                      <th className="px-3 py-2 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-[11px]">
                    {components.map((c) => {
                      const amount = Number(c.quantity_factor || 1) * Number(c.component_rate || 0);
                      const typeLabel =
                        COMPONENT_TYPES.find((t) => String(t.value) === String(c.component_type_id))?.label ||
                        c.component_type_name ||
                        'Other';
                      const badgeVariant = COMPONENT_VARIANTS[String(c.component_type_id)] || 'neutral';

                      return (
                        <tr key={c.id} className="hover:bg-surface-muted/30 transition-colors">
                          <td className="px-3 py-2 whitespace-nowrap">
                            <Badge variant={badgeVariant} className="text-[8px] font-semibold uppercase px-1.5 py-0.2">
                              {typeLabel}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 font-medium text-text-primary">{c.component_name}</td>
                          <td className="px-3 py-2 text-right font-mono text-text-secondary">{c.quantity_factor}</td>
                          <td className="px-3 py-2 text-right font-mono text-text-secondary">
                            ₹{Number(c.component_rate || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-text-primary">
                            ₹{amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleDelete(c)}
                              title="Delete component"
                              className="text-error hover:opacity-80 p-1 rounded transition-opacity"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-surface-muted/50 font-bold border-t-2 border-border text-xs">
                      <td colSpan={4} className="px-3 py-2 text-right text-text-primary">
                        Total Derived Rate:
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-text-primary text-sm font-bold">
                        ₹{totalRate.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </EntityEditModal.Section>

          <EntityEditModal.Section title="Add Rate Component">
            <EntityEditModal.Grid>
              <FormField label="Component Type" required>
                <Select
                  options={COMPONENT_TYPES}
                  value={form.component_type_id}
                  onChange={(v) => setForm((p) => ({ ...p, component_type_id: v }))}
                />
              </FormField>

              <FormField label="Description / Resource Name" required className="sm:col-span-2">
                <Input
                  value={form.component_name}
                  onChange={(e) => setForm((p) => ({ ...p, component_name: e.target.value }))}
                  placeholder="e.g. Mason (Grade 1), Cement OPC 43, Concrete Mixer"
                />
              </FormField>

              <FormField label="Quantity Factor / Usage" required>
                <Input
                  type="number"
                  step="0.001"
                  value={form.quantity_factor}
                  onChange={(e) => setForm((p) => ({ ...p, quantity_factor: e.target.value }))}
                  placeholder="1"
                />
              </FormField>

              <FormField label="Unit Rate (₹)" required>
                <Input
                  type="number"
                  step="0.01"
                  value={form.component_rate}
                  onChange={(e) => setForm((p) => ({ ...p, component_rate: e.target.value }))}
                  placeholder="0.00"
                />
              </FormField>

              <FormField label="Remarks / Specifications" className="sm:col-span-2">
                <Input
                  value={form.remarks}
                  onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                  placeholder="Optional remarks or specification notes"
                />
              </FormField>
            </EntityEditModal.Grid>

            <div className="mt-3 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={handleAdd}
                disabled={saving}
              >
                {saving ? 'Adding...' : 'Add Component'}
              </Button>
            </div>
          </EntityEditModal.Section>
        </EntityEditModal.Body>
      </div>

      <div className="p-4 border-t border-border bg-surface flex justify-end">
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </EntityEditModal>
  );
}

export default RateAnalysisModal;
