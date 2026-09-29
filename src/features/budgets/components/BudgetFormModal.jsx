import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { budgetsApi, projectsApi, financialYearsApi, boqApi, mastersApi, workCategoriesApi } from '../../../api/apiservice';
import { EntityEditModal } from '../../../components/composite/EntityEditModal';
import { FormField } from '../../../components/composite/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { toast } from '../../../components/composite/Toast';

const DEFAULT_COST_TYPES = [
  { id: 1, code: 'MATERIAL', name: 'Material' },
  { id: 2, code: 'LABOUR', name: 'Labour' },
  { id: 3, code: 'EQUIPMENT', name: 'Equipment' },
  { id: 4, code: 'SUBCONTRACT', name: 'Subcontract' },
  { id: 5, code: 'OVERHEAD', name: 'Overhead' },
  { id: 6, code: 'CONTINGENCY', name: 'Contingency' },
  { id: 7, code: 'OTHER', name: 'Other' },
];

const EMPTY_FORM = {
  budget_code: '',
  budget_name: '',
  project_id: '',
  financial_year_id: '',
  source_boq_id: '',
  budget_date: new Date().toISOString().split('T')[0],
  currency_code: 'INR',
  notes: '',
};

export function BudgetFormModal({ isOpen, budget = null, onClose, onSaveSuccess }) {
  const isEditing = Boolean(budget?.id);
  const [form, setForm] = useState(EMPTY_FORM);
  const [projects, setProjects] = useState([]);
  const [financialYears, setFinancialYears] = useState([]);
  const [approvedBoqs, setApprovedBoqs] = useState([]);
  const [costTypes, setCostTypes] = useState(DEFAULT_COST_TYPES);
  const [workCategories, setWorkCategories] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingMasters, setLoadingMasters] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(budget ? {
      ...EMPTY_FORM,
      ...budget,
      project_id: String(budget.project_id ?? ''),
      financial_year_id: budget.financial_year_id ? String(budget.financial_year_id) : '',
      source_boq_id: budget.source_boq_id ? String(budget.source_boq_id) : '',
    } : EMPTY_FORM);
    setErrors({});
    setLoadingMasters(true);

    Promise.allSettled([
      projectsApi.list(),
      financialYearsApi.list(),
      mastersApi.all().catch(() => ({ data: {} })),
      workCategoriesApi.list().catch(() => ({ data: [] })),
    ]).then(([projRes, fyRes, mastersRes, wcRes]) => {
      if (projRes.status === 'fulfilled') {
        const raw = projRes.value;
        const list = Array.isArray(raw) ? raw : (raw?.data?.projects ?? raw?.projects ?? (Array.isArray(raw?.data) ? raw.data : []));
        setProjects(Array.isArray(list) ? list : []);
      }
      if (fyRes.status === 'fulfilled') {
        const raw = fyRes.value;
        const list = Array.isArray(raw) ? raw : (raw?.data?.financial_years ?? raw?.financial_years ?? (Array.isArray(raw?.data) ? raw.data : []));
        setFinancialYears(Array.isArray(list) ? list : []);
      }
      if (mastersRes.status === 'fulfilled') {
        const raw = mastersRes.value;
        const types = raw?.data?.project_budget_cost_types ?? raw?.project_budget_cost_types;
        if (Array.isArray(types) && types.length > 0) setCostTypes(types);
      }
      if (wcRes.status === 'fulfilled') {
        const raw = wcRes.value;
        const list = raw?.data?.work_categories ?? raw?.work_categories ?? (Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []));
        setWorkCategories(Array.isArray(list) ? list : []);
      }
    }).finally(() => setLoadingMasters(false));
  }, [isOpen, budget]);

  // When project changes, fetch approved BOQs for that project
  useEffect(() => {
    if (!form.project_id) {
      setApprovedBoqs([]);
      return;
    }
    boqApi.list({ project_id: form.project_id })
      .then((res) => {
        const list = res?.data?.project_boqs ?? res?.project_boqs ?? res?.data?.data ?? (Array.isArray(res) ? res : []);
        // Only keep approved BOQs as allowed by backend validateHeaderReferences
        const approved = (Array.isArray(list) ? list : []).filter(
          (b) => String(b.status_code || b.status_name || b.status || '').toUpperCase() === 'APPROVED'
        );
        setApprovedBoqs(approved);
      })
      .catch(() => setApprovedBoqs([]));
  }, [form.project_id]);

  const change = (name, value) => {
    setForm((c) => ({ ...c, [name]: value }));
    setErrors((c) => ({ ...c, [name]: null }));
  };

  const handleProjectChange = (projId) => {
    change('project_id', projId);
    if (!isEditing) {
      const selectedProject = projects.find((p) => String(p.id) === String(projId));
      const prjCode = selectedProject?.project_code || 'PRJ';
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      change('budget_code', `BDG-${prjCode}-${randomSuffix}`);
    }
  };

  const handleSourceBoqChange = (boqId) => {
    change('source_boq_id', boqId);
  };

  const validate = () => {
    const next = {};
    if (!form.budget_name.trim()) next.budget_name = 'Budget name is required.';
    if (!form.project_id) next.project_id = 'Project selection is required.';
    if (!form.budget_date) next.budget_date = 'Budget date is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      let budgetCode = (form.budget_code && form.budget_code.trim()) ? form.budget_code.trim().toUpperCase() : '';
      if (!budgetCode) {
        const selectedProject = projects.find((p) => String(p.id) === String(form.project_id));
        const prjCode = selectedProject?.project_code || 'PRJ';
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        budgetCode = `BDG-${prjCode}-${randomSuffix}`;
      }

      const payload = {
        budget_code: budgetCode,
        budget_name: form.budget_name.trim(),
        project_id: Number(form.project_id),
        budget_date: form.budget_date,
        currency_code: form.currency_code || 'INR',
        notes: form.notes?.trim() || null,
        financial_year_id: form.financial_year_id ? Number(form.financial_year_id) : null,
        source_boq_id: form.source_boq_id ? Number(form.source_boq_id) : null,
      };

      let targetBudgetId = budget?.id;
      if (isEditing) {
        await budgetsApi.update(budget.id, payload);
      } else {
        const createRes = await budgetsApi.create(payload);
        targetBudgetId = createRes?.data?.project_budget?.id ?? createRes?.project_budget?.id ?? createRes?.data?.id ?? createRes?.id;
      }

      // If a source BOQ was linked upon creation, import its items to establish initial budget lines
      if (!isEditing && targetBudgetId && form.source_boq_id) {
        try {
          const directTypeId = costTypes.find((ct) => {
            const code = String(ct.cost_type_code || ct.code || '').toUpperCase();
            return code !== 'OVERHEAD' && code !== 'CONTINGENCY';
          })?.id || 1;

          const defaultCategoryId = workCategories[0]?.id || 1;
          const boqItemsRes = await boqApi.items.list(form.source_boq_id);
          const boqItems = Array.isArray(boqItemsRes?.data?.boq_items)
            ? boqItemsRes.data.boq_items
            : (Array.isArray(boqItemsRes?.boq_items) ? boqItemsRes.boq_items : (Array.isArray(boqItemsRes?.data) ? boqItemsRes.data : []));

          for (let i = 0; i < boqItems.length; i++) {
            const item = boqItems[i];
            const qty = Number(item.quantity || 1);
            const rate = Number(item.rate ?? item.unit_rate ?? item.estimated_rate ?? 0);
            const lineCode = String(item.item_code || `${budgetCode}-ITM-${i + 1}`).toUpperCase().slice(0, 48);
            await budgetsApi.lines.create(targetBudgetId, {
              line_code: lineCode,
              line_description: String(item.item_name || item.specification || 'BOQ Line Item').slice(0, 240),
              cost_type_id: Number(directTypeId),
              work_category_id: Number(item.work_category_id || defaultCategoryId),
              uom_id: item.uom_id ? Number(item.uom_id) : undefined,
              planned_quantity: qty,
              planned_rate: rate,
              boq_item_id: Number(item.id),
            });
          }
        } catch (err) {
          console.warn('Could not auto-import BOQ items upon budget creation:', err);
        }
      }

      toast.success(isEditing ? 'Budget updated successfully.' : 'Budget created successfully.');
      onSaveSuccess?.();
      onClose?.();
    } catch (error) {
      console.error('Budget API Error:', error);
      setErrors(error?.errors ?? {});
      toast.error(error?.message || 'Failed to save budget.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <EntityEditModal isOpen={isOpen} onClose={onClose} size="lg">
      <EntityEditModal.Header
        icon={Wallet}
        title={isEditing ? 'Edit Project Budget' : 'Create Project Budget'}
        subtitle="Define project cost baseline, allocations, and source BOQ linkage."
        onClose={onClose}
      />
      <form id="budget-form" onSubmit={submit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <EntityEditModal.Body>
          <EntityEditModal.Section title="Basic Details">
            <EntityEditModal.Grid>
              <FormField label="Project" required error={errors.project_id}>
                <Select
                  value={form.project_id}
                  onChange={handleProjectChange}
                  options={projects.map((p) => ({
                    value: String(p.id),
                    label: p.project_name || p.name,
                  }))}
                  placeholder="Select project"
                  disabled={isEditing}
                />
              </FormField>

              <FormField label="Budget Date" required error={errors.budget_date}>
                <Input
                  type="date"
                  value={form.budget_date}
                  onChange={(e) => change('budget_date', e.target.value)}
                />
              </FormField>

              <FormField label="Budget Name" required error={errors.budget_name} className="sm:col-span-2">
                <Input
                  value={form.budget_name}
                  onChange={(e) => change('budget_name', e.target.value)}
                  placeholder="e.g. Phase 1 Execution Budget"
                />
              </FormField>
            </EntityEditModal.Grid>
          </EntityEditModal.Section>

          <EntityEditModal.Section title="Linkages & Governance">
            <EntityEditModal.Grid>
              <FormField
                label="Source Approved BOQ"
                error={errors.source_boq_id}
                hint={form.project_id ? (approvedBoqs.length > 0 ? 'Link to approved project BOQ' : 'No approved BOQ found for this project') : 'Select project first'}
              >
                <Select
                  value={form.source_boq_id}
                  onChange={handleSourceBoqChange}
                  options={[
                    { value: '', label: 'None (Standalone Budget)' },
                    ...approvedBoqs.map((b) => ({
                      value: String(b.id),
                      label: `${b.boq_code || 'BOQ'} - ${b.boq_name || b.title}`,
                    })),
                  ]}
                  placeholder="Select approved BOQ (optional)"
                  disabled={!form.project_id}
                />
              </FormField>

              <FormField
                label="Financial Year"
                error={errors.financial_year_id}
              >
                <Select
                  value={form.financial_year_id}
                  onChange={(v) => change('financial_year_id', v)}
                  options={[
                    { value: '', label: 'None / Default' },
                    ...financialYears.map((fy) => ({
                      value: String(fy.id),
                      label: fy.year_name || fy.name || `${fy.start_date} to ${fy.end_date}`,
                    })),
                  ]}
                  placeholder="Select financial year (optional)"
                />
              </FormField>
            </EntityEditModal.Grid>
          </EntityEditModal.Section>

          <EntityEditModal.Section title="Notes & Justification" noBorder>
            <FormField label="Notes" error={errors.notes}>
              <Textarea
                value={form.notes}
                onChange={(e) => change('notes', e.target.value)}
                placeholder="Add budget assumptions, contingency allowances, or project notes..."
                rows={3}
              />
            </FormField>
          </EntityEditModal.Section>
        </EntityEditModal.Body>

        <EntityEditModal.Footer
          formId="budget-form"
          submitLabel={isEditing ? 'Update Budget' : 'Create Budget'}
          onCancel={onClose}
          isSubmitting={saving || loadingMasters}
        />
      </form>
    </EntityEditModal>
  );
}

export default BudgetFormModal;
