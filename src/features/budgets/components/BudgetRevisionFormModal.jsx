import { useState, useEffect } from 'react';
import { Layers } from 'lucide-react';
import { budgetsApi, projectsApi } from '../../../api/apiservice';
import { EntityEditModal } from '../../../components/composite/EntityEditModal';
import { FormField } from '../../../components/composite/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { toast } from '../../../components/composite/Toast';

export function BudgetRevisionFormModal({
  isOpen,
  preselectedBudgetId = null,
  onClose,
  onSaveSuccess,
  mode = 'revision', // 'revision' | 'variation'
}) {
  const isVariation = mode === 'variation';
  const [budgets, setBudgets] = useState([]);
  const [form, setForm] = useState({
    budget_id: '',
    revision_date: new Date().toISOString().split('T')[0],
    reason: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    setLoading(true);

    budgetsApi.list()
      .then((res) => {
        const list = res?.data?.project_budgets ?? res?.project_budgets ?? res?.data?.data ?? (Array.isArray(res) ? res : []);
        // Only APPROVED budgets can be revised per backend business rules
        const approved = (Array.isArray(list) ? list : []).filter(
          (b) => String(b.status_code || b.status_name || b.status || '').toUpperCase() === 'APPROVED'
        );
        setBudgets(approved);

        if (preselectedBudgetId && approved.some((b) => String(b.id) === String(preselectedBudgetId))) {
          setForm((c) => ({ ...c, budget_id: String(preselectedBudgetId) }));
        } else if (approved.length > 0 && !form.budget_id) {
          setForm((c) => ({ ...c, budget_id: String(approved[0].id) }));
        }
      })
      .catch(() => setBudgets([]))
      .finally(() => setLoading(false));
  }, [isOpen, preselectedBudgetId]);

  const change = (field, value) => {
    setForm((c) => ({ ...c, [field]: value }));
    setErrors((c) => ({ ...c, [field]: null }));
  };

  const validate = () => {
    const errs = {};
    if (!form.budget_id) errs.budget_id = isVariation ? 'Target project budget selection is required.' : 'Approved budget selection is required.';
    if (!form.revision_date) errs.revision_date = isVariation ? 'Order issue date is required.' : 'Revision date is required.';
    if (!form.reason.trim()) errs.reason = isVariation ? 'Scope change reason or site condition is required.' : 'Scope or variance reason is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await budgetsApi.revisions.create(Number(form.budget_id), {
        revision_date: form.revision_date,
        reason: form.reason.trim(),
      });
      toast.success(
        isVariation
          ? 'Variation order created. You can now configure scope addition/reduction lines.'
          : 'Budget revision created. You can now configure revision line items.'
      );
      onSaveSuccess?.(Number(form.budget_id));
      onClose();
    } catch (err) {
      console.error('Revision create error:', err);
      toast.error(
        err?.message ||
          (isVariation
            ? 'Failed to create variation order. Ensure the budget does not have an open change order.'
            : 'Failed to create budget revision. Ensure the budget does not have an open revision.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <EntityEditModal isOpen={isOpen} onClose={onClose}>
      <EntityEditModal.Header
        icon={Layers}
        title={isVariation ? 'Create Variation Order' : 'Create Budget Baseline Revision'}
        subtitle={
          isVariation
            ? 'Issue a formal commercial change order / variation notice for project scope or site conditions.'
            : 'Initiate a formal baseline revision to recalibrate an approved project budget.'
        }
        onClose={onClose}
      />
      <form id="revision-form" onSubmit={submit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <EntityEditModal.Body>
          <EntityEditModal.Section title={isVariation ? 'Order Header' : 'Revision Header'}>
            <EntityEditModal.Grid>
              <FormField label={isVariation ? 'Target Project Budget' : 'Target Approved Budget'} required error={errors.budget_id}>
                <Select
                  value={form.budget_id}
                  onChange={(v) => change('budget_id', v)}
                  options={budgets.map((b) => ({
                    value: String(b.id),
                    label: `${b.budget_code} - ${b.budget_name || 'Budget'} (Baseline: ₹${Number(b.total_budget || 0).toLocaleString('en-IN')})`,
                  }))}
                  placeholder={loading ? 'Loading approved budgets...' : (budgets.length === 0 ? 'No approved budgets available' : 'Select budget')}
                />
              </FormField>

              <FormField label={isVariation ? 'Order Date' : 'Revision Date'} required error={errors.revision_date}>
                <Input
                  type="date"
                  value={form.revision_date}
                  onChange={(e) => change('revision_date', e.target.value)}
                />
              </FormField>
            </EntityEditModal.Grid>
          </EntityEditModal.Section>

          <EntityEditModal.Section title={isVariation ? 'Commercial Scope Change Justification' : 'Scope Change Justification'} noBorder>
            <FormField
              label={isVariation ? 'Change Order Scope & Justification' : 'Revision Reason'}
              required
              error={errors.reason}
              hint={
                isVariation
                  ? 'Detail the site encounter, client directive, or engineering revision requiring this change order'
                  : 'Detailed explanation of the variance, rate update, or baseline scope modification'
              }
            >
              <Textarea
                value={form.reason}
                onChange={(e) => change('reason', e.target.value)}
                placeholder={
                  isVariation
                    ? 'Enter change scope description (e.g., Client requested additional floor finishes, additional foundation depth due to rocky strata)...'
                    : 'Explain why this budget requires revision (e.g., steel rate escalation, added structural work, excavation depth increase)...'
                }
                rows={4}
              />
            </FormField>
          </EntityEditModal.Section>
        </EntityEditModal.Body>

        <EntityEditModal.Footer
          formId="revision-form"
          submitLabel={isVariation ? 'Create Variation Order' : 'Create Baseline Revision'}
          onCancel={onClose}
          isSubmitting={submitting || loading}
        />
      </form>
    </EntityEditModal>
  );
}

export default BudgetRevisionFormModal;
