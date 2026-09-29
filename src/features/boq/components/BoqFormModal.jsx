import { useEffect, useState } from 'react';
import { FileSpreadsheet, Sparkles } from 'lucide-react';
import { boqApi, projectsApi } from '../../../api/apiservice';
import { EntityEditModal } from '../../../components/composite/EntityEditModal';
import { FormField } from '../../../components/composite/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { toast } from '../../../components/composite/Toast';

const EMPTY_FORM = {
  boq_code: '',
  boq_name: '',
  project_id: '',
  boq_date: new Date().toISOString().substring(0, 10),
  valid_from: '',
  currency_code: 'INR',
  notes: '',
};

export function BoqFormModal({ isOpen, boq = null, onClose, onSaveSuccess }) {
  const isEditing = Boolean(boq?.id);
  const [form, setForm] = useState(EMPTY_FORM);
  const [projects, setProjects] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingMasters, setLoadingMasters] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (boq) {
      setForm({
        ...EMPTY_FORM,
        ...boq,
        project_id: String(boq.project_id ?? ''),
        boq_date: boq.boq_date ? boq.boq_date.substring(0, 10) : '',
        valid_from: boq.valid_from ? boq.valid_from.substring(0, 10) : '',
        currency_code: boq.currency_code || 'INR',
        notes: boq.notes || '',
      });
    } else {
      setForm({
        ...EMPTY_FORM,
        boq_date: new Date().toISOString().substring(0, 10),
      });
    }
    setErrors({});
    setLoadingMasters(true);
    projectsApi.list()
      .then((res) => {
        const list = res?.data?.projects ?? res?.projects ?? (Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
        setProjects(Array.isArray(list) ? list : []);
      })
      .catch((err) => toast.error(err?.message || 'Unable to load projects.'))
      .finally(() => setLoadingMasters(false));
  }, [isOpen, boq]);

  const change = (name, value) => {
    setForm((c) => {
      const next = { ...c, [name]: value };
      // Auto-generate BOQ code when project selected
      if (name === 'project_id' && !isEditing) {
        const proj = projects.find((p) => String(p.id) === String(value));
        const pCode = proj?.project_code || 'PRJ';
        const rand = Math.floor(1000 + Math.random() * 9000);
        next.boq_code = `BOQ-${pCode}-${rand}`;
      }
      return next;
    });
    setErrors((c) => ({ ...c, [name]: null }));
  };

  const validate = () => {
    const next = {};
    if (!form.boq_code.trim()) {
      const proj = projects.find((p) => String(p.id) === String(form.project_id));
      const pCode = proj?.project_code || 'PRJ';
      form.boq_code = `BOQ-${pCode}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    if (!form.boq_name.trim()) next.boq_name = 'BOQ name is required.';
    if (!form.project_id) next.project_id = 'Project selection is required.';
    if (!form.boq_date) next.boq_date = 'BOQ date is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        boq_code: form.boq_code.trim().toUpperCase(),
        boq_name: form.boq_name.trim(),
        boq_date: form.boq_date,
        valid_from: form.valid_from || null,
        currency_code: form.currency_code || 'INR',
        notes: form.notes?.trim() || null,
      };

      if (isEditing) {
        await boqApi.update(boq.id, payload);
        toast.success(`BOQ ${payload.boq_code} updated successfully.`);
      } else {
        payload.project_id = Number(form.project_id);
        await boqApi.create(payload);
        toast.success(`BOQ ${payload.boq_code} created successfully.`);
      }

      onSaveSuccess?.();
      onClose?.();
    } catch (error) {
      if (error?.errors) {
        setErrors(error.errors);
      }
      toast.error(error?.message || 'Failed to save BOQ.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <EntityEditModal isOpen={isOpen} onClose={onClose} size="lg">
      <EntityEditModal.Header
        icon={FileSpreadsheet}
        title={isEditing ? `Edit BOQ — ${boq.boq_code || ''}` : 'Create New BOQ'}
        subtitle="Define project Bill of Quantities master details."
        onClose={onClose}
      />
      <form id="boq-form" onSubmit={submit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <EntityEditModal.Body>
          <EntityEditModal.Section title="Project & Identification">
            <EntityEditModal.Grid>
              <FormField label="Parent Project" required error={errors.project_id} className="sm:col-span-2">
                <Select
                  value={form.project_id}
                  onChange={(v) => change('project_id', v)}
                  disabled={isEditing}
                  options={[
                    { value: '', label: 'Select project...' },
                    ...projects.map((p) => ({
                      value: String(p.id),
                      label: p.project_name || p.name,
                    })),
                  ]}
                  placeholder="Select project"
                />
              </FormField>

              <FormField label="BOQ Title / Name" required error={errors.boq_name} className="sm:col-span-2">
                <Input
                  value={form.boq_name}
                  onChange={(e) => change('boq_name', e.target.value)}
                  placeholder="e.g. Civil & Structural Works Phase 1"
                />
              </FormField>

              <FormField label="BOQ Baseline Date" required error={errors.boq_date}>
                <Input
                  type="date"
                  value={form.boq_date}
                  onChange={(e) => change('boq_date', e.target.value)}
                />
              </FormField>

              <FormField label="Valid From Date" error={errors.valid_from}>
                <Input
                  type="date"
                  value={form.valid_from}
                  onChange={(e) => change('valid_from', e.target.value)}
                />
              </FormField>
            </EntityEditModal.Grid>
          </EntityEditModal.Section>

          <EntityEditModal.Section title="Scope of Work & Notes" noBorder>
            <FormField label="Work Scope Description / Remarks" error={errors.notes}>
              <Textarea
                value={form.notes}
                onChange={(e) => change('notes', e.target.value)}
                placeholder="Enter scope of work, technical specifications references, or special conditions..."
                rows={3}
              />
            </FormField>
          </EntityEditModal.Section>
        </EntityEditModal.Body>

        <EntityEditModal.Footer
          formId="boq-form"
          submitLabel={isEditing ? 'Update BOQ' : 'Create BOQ'}
          onCancel={onClose}
          isSubmitting={saving || loadingMasters}
        />
      </form>
    </EntityEditModal>
  );
}

export default BoqFormModal;
