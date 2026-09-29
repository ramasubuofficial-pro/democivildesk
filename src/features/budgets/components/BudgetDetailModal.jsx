import { useState, useEffect } from 'react';
import {
  X,
  Wallet,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  IndianRupee,
  Layers,
  History,
  FileSpreadsheet,
  Sparkles,
  Sliders,
} from 'lucide-react';
import {
  budgetsApi,
  workCategoriesApi,
  unitsApi,
  mastersApi,
  boqApi,
} from '../../../api/apiservice';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { FormField } from '../../../components/composite/FormField';
import { ConfirmDialog } from '../../../components/composite/ConfirmDialog';
import { toast } from '../../../components/composite/Toast';
import { useAuth } from '../../auth/context/AuthContext';

function TabButton({ active, onClick, label, icon: Icon, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
        active
          ? 'border-primary text-primary font-semibold'
          : 'border-transparent text-text-secondary hover:text-text-primary'
      }`}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      <span>{label}</span>
      {typeof count === 'number' && (
        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
          active ? 'bg-primary/15 text-primary' : 'bg-surface-muted text-text-muted'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

const DEFAULT_COST_TYPES = [
  { id: 1, code: 'MATERIAL', name: 'Material' },
  { id: 2, code: 'LABOUR', name: 'Labour' },
  { id: 3, code: 'EQUIPMENT', name: 'Equipment' },
  { id: 4, code: 'SUBCONTRACT', name: 'Subcontract' },
  { id: 5, code: 'OVERHEAD', name: 'Overhead' },
  { id: 6, code: 'CONTINGENCY', name: 'Contingency' },
  { id: 7, code: 'OTHER', name: 'Other' },
];

export function BudgetDetailModal({ isOpen, budget, onClose, onRefresh }) {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('lines');
  const [detail, setDetail] = useState(null);
  const [lines, setLines] = useState([]);
  const [summary, setSummary] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [history, setHistory] = useState([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [loadingRevisions, setLoadingRevisions] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Masters
  const [costTypes, setCostTypes] = useState(DEFAULT_COST_TYPES);
  const [categories, setCategories] = useState([]);
  const [uoms, setUoms] = useState([]);

  // Add line modal / form
  const [isAddLineOpen, setIsAddLineOpen] = useState(false);
  const [importingBoq, setImportingBoq] = useState(false);
  const [isQuickAllocOpen, setIsQuickAllocOpen] = useState(false);
  const [quickAllocForm, setQuickAllocForm] = useState({
    direct_cost: '',
    overhead_cost: '',
    contingency_amount: '',
  });
  const [allocating, setAllocating] = useState(false);
  const [lineForm, setLineForm] = useState({
    line_code: '',
    line_description: '',
    cost_type_id: '1',
    work_category_id: '',
    uom_id: '',
    planned_quantity: '1',
    planned_rate: '',
    notes: '',
  });
  const [lineErrors, setLineErrors] = useState({});
  const [addingLine, setAddingLine] = useState(false);

  // Delete line state
  const [deletingLineId, setDeletingLineId] = useState(null);

  // Workflow confirmation modals
  const [actionType, setActionType] = useState(null); // 'submit' | 'approve' | 'reject'
  const [actionComments, setActionComments] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const budgetId = budget?.id;

  // Load Budget Details
  const fetchBudgetDetail = () => {
    if (!budgetId) return;
    budgetsApi.get(budgetId)
      .then((res) => {
        const b = res?.data?.project_budget ?? res?.project_budget ?? res?.data ?? res;
        setDetail(b);
        if (res?.data?.summary) setSummary(res.data.summary);
      })
      .catch(() => setDetail(budget));
  };

  // Load Budget Lines
  const fetchLines = () => {
    if (!budgetId) return;
    setLoadingLines(true);
    budgetsApi.lines.list(budgetId)
      .then((res) => {
        const list = res?.data?.budget_lines ?? res?.budget_lines ?? res?.data?.lines ?? res?.lines ?? [];
        setLines(Array.isArray(list) ? list : []);
        if (res?.data?.summary) setSummary(res.data.summary);
      })
      .catch(() => setLines([]))
      .finally(() => setLoadingLines(false));
  };

  // Load Revisions
  const fetchRevisions = () => {
    if (!budgetId) return;
    setLoadingRevisions(true);
    budgetsApi.revisions.list(budgetId)
      .then((res) => {
        const list = res?.data?.budget_revisions ?? res?.budget_revisions ?? res?.data?.revisions ?? res?.revisions ?? (Array.isArray(res?.data) ? res.data : []);
        setRevisions(Array.isArray(list) ? list : []);
      })
      .catch(() => setRevisions([]))
      .finally(() => setLoadingRevisions(false));
  };

  // Load History
  const fetchHistory = () => {
    if (!budgetId) return;
    setLoadingHistory(true);
    budgetsApi.approvalHistory(budgetId)
      .then((res) => {
        const list = res?.data?.approvals ?? res?.approvals ?? res?.data?.history ?? res?.history ?? [];
        setHistory(Array.isArray(list) ? list : []);
      })
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  };

  useEffect(() => {
    if (!isOpen || !budgetId) return;
    fetchBudgetDetail();
    fetchLines();
    fetchRevisions();
    fetchHistory();

    // Load master reference lists
    mastersApi.all()
      .then((res) => {
        const types = res?.data?.project_budget_cost_types ?? res?.project_budget_cost_types;
        if (Array.isArray(types) && types.length > 0) setCostTypes(types);
      })
      .catch(() => {});

    workCategoriesApi.list()
      .then((res) => {
        const cats = res?.data?.work_categories ?? res?.work_categories ?? (Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
        setCategories(Array.isArray(cats) ? cats : []);
      })
      .catch(() => {});

    unitsApi.list()
      .then((res) => {
        const uomList = res?.data?.units ?? res?.units ?? res?.data?.data ?? (Array.isArray(res) ? res : []);
        setUoms(Array.isArray(uomList) ? uomList : []);
      })
      .catch(() => {});
  }, [isOpen, budgetId]);

  if (!isOpen || !budget) return null;

  const current = detail || budget;
  const status = String(current.status_code || current.status_name || current.status || 'DRAFT').toUpperCase();
  const isDraft = status === 'DRAFT';
  const isSubmitted = status === 'SUBMITTED' || status === 'PENDING' || status === 'REVIEW';
  const isApproved = status === 'APPROVED';

  const getVariant = (s) => {
    const v = String(s || '').toUpperCase();
    if (v.includes('APPROVED')) return 'success';
    if (v.includes('SUBMITTED') || v.includes('PENDING') || v.includes('REVIEW')) return 'warning';
    if (v.includes('REJECTED')) return 'error';
    return 'neutral';
  };

  // Handle line creation
  const handleCreateLine = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!lineForm.line_description.trim()) errors.line_description = 'Description is required.';
    if (!lineForm.cost_type_id) errors.cost_type_id = 'Cost type is required.';
    if (!lineForm.work_category_id) errors.work_category_id = 'Work category is required.';
    if (!lineForm.planned_rate || Number(lineForm.planned_rate) <= 0) errors.planned_rate = 'Valid rate is required.';
    if (!lineForm.planned_quantity || Number(lineForm.planned_quantity) <= 0) errors.planned_quantity = 'Valid quantity is required.';

    if (Object.keys(errors).length > 0) {
      setLineErrors(errors);
      return;
    }

    setAddingLine(true);
    try {
      const autoLineCode = (lineForm.line_code.trim() || `BL-${String(lines.length + 1).padStart(3, '0')}`).toUpperCase();
      const payload = {
        line_code: autoLineCode,
        line_description: lineForm.line_description.trim(),
        cost_type_id: Number(lineForm.cost_type_id),
        work_category_id: Number(lineForm.work_category_id),
        uom_id: lineForm.uom_id ? Number(lineForm.uom_id) : undefined,
        planned_quantity: Number(lineForm.planned_quantity),
        planned_rate: Number(lineForm.planned_rate),
        notes: lineForm.notes.trim() || undefined,
      };

      await budgetsApi.lines.create(budgetId, payload);
      toast.success('Budget line added successfully.');
      setIsAddLineOpen(false);
      setLineForm({
        line_code: '',
        line_description: '',
        cost_type_id: '1',
        work_category_id: '',
        uom_id: '',
        planned_quantity: '1',
        planned_rate: '',
        notes: '',
      });
      fetchLines();
      fetchBudgetDetail();
      onRefresh?.();
    } catch (err) {
      console.error('Line add error:', err);
      toast.error(err?.message || 'Failed to add budget line.');
    } finally {
      setAddingLine(false);
    }
  };

  // Handle line deletion
  const handleDeleteLine = async (lineId) => {
    try {
      await budgetsApi.lines.remove(budgetId, lineId);
      toast.success('Budget line deleted.');
      setDeletingLineId(null);
      fetchLines();
      fetchBudgetDetail();
      onRefresh?.();
    } catch (err) {
      toast.error(err?.message || 'Failed to delete budget line.');
    }
  };

  // Handle importing line items directly from source BOQ
  const handleImportFromBoq = async () => {
    if (!current?.source_boq_id || !budgetId) return;
    setImportingBoq(true);
    try {
      const res = await boqApi.items.list(current.source_boq_id);
      const boqItems = Array.isArray(res?.data?.boq_items)
        ? res.data.boq_items
        : (Array.isArray(res?.boq_items) ? res.boq_items : (Array.isArray(res?.data) ? res.data : []));

      if (boqItems.length === 0) {
        toast.error('No items found in the linked source BOQ.');
        return;
      }

      const directTypeId = costTypes.find((ct) => {
        const code = String(ct.cost_type_code || ct.code || '').toUpperCase();
        return code !== 'OVERHEAD' && code !== 'CONTINGENCY';
      })?.id || 1;

      const defaultCatId = categories[0]?.id || 1;

      let count = 0;
      for (let i = 0; i < boqItems.length; i++) {
        const itm = boqItems[i];
        const lineCode = String(itm.item_code || `${current.budget_code}-ITM-${i + 1}`).toUpperCase().slice(0, 48);
        const payload = {
          line_code: lineCode,
          line_description: String(itm.item_name || itm.specification || 'BOQ Item').slice(0, 240),
          cost_type_id: Number(directTypeId),
          work_category_id: Number(itm.work_category_id || defaultCatId),
          uom_id: itm.uom_id ? Number(itm.uom_id) : undefined,
          planned_quantity: Number(itm.quantity || 1),
          planned_rate: Number(itm.rate ?? itm.unit_rate ?? itm.estimated_rate ?? 0),
          boq_item_id: Number(itm.id),
        };
        await budgetsApi.lines.create(budgetId, payload);
        count++;
      }

      toast.success(`Successfully imported ${count} item(s) from source BOQ.`);
      fetchLines();
      fetchBudgetDetail();
      onRefresh?.();
    } catch (err) {
      console.error('BOQ import error:', err);
      toast.error(err?.message || 'Failed to import items from BOQ.');
    } finally {
      setImportingBoq(false);
    }
  };

  // Handle quick baseline allocation
  const handleQuickAllocate = async (e) => {
    e.preventDefault();
    const d = parseFloat(quickAllocForm.direct_cost) || 0;
    const o = parseFloat(quickAllocForm.overhead_cost) || 0;
    const c = parseFloat(quickAllocForm.contingency_amount) || 0;
    if (d <= 0 && o <= 0 && c <= 0) {
      toast.error('Please enter at least one budget amount (Direct, Overhead, or Contingency).');
      return;
    }

    setAllocating(true);
    try {
      const directTypeId = costTypes.find((ct) => {
        const code = String(ct.cost_type_code || ct.code || '').toUpperCase();
        return code !== 'OVERHEAD' && code !== 'CONTINGENCY';
      })?.id || 1;

      const overheadTypeId = costTypes.find((ct) => {
        const code = String(ct.cost_type_code || ct.code || '').toUpperCase();
        return code === 'OVERHEAD';
      })?.id || 5;

      const contingencyTypeId = costTypes.find((ct) => {
        const code = String(ct.cost_type_code || ct.code || '').toUpperCase();
        return code === 'CONTINGENCY';
      })?.id || 6;

      const defaultCatId = categories[0]?.id || 1;

      if (d > 0) {
        await budgetsApi.lines.create(budgetId, {
          line_code: `${current.budget_code}-DIR`.toUpperCase().slice(0, 48),
          line_description: 'Direct Cost Baseline Allocation',
          cost_type_id: Number(directTypeId),
          work_category_id: Number(defaultCatId),
          planned_quantity: 1,
          planned_rate: d,
        });
      }

      if (o > 0) {
        await budgetsApi.lines.create(budgetId, {
          line_code: `${current.budget_code}-OVH`.toUpperCase().slice(0, 48),
          line_description: 'Project Overhead Cost Allocation',
          cost_type_id: Number(overheadTypeId),
          work_category_id: Number(defaultCatId),
          planned_quantity: 1,
          planned_rate: o,
        });
      }

      if (c > 0) {
        await budgetsApi.lines.create(budgetId, {
          line_code: `${current.budget_code}-CTG`.toUpperCase().slice(0, 48),
          line_description: 'Project Contingency Baseline Allocation',
          cost_type_id: Number(contingencyTypeId),
          work_category_id: Number(defaultCatId),
          planned_quantity: 1,
          planned_rate: c,
        });
      }

      toast.success('Baseline budget allocated successfully.');
      setIsQuickAllocOpen(false);
      fetchLines();
      fetchBudgetDetail();
      onRefresh?.();
    } catch (err) {
      console.error('Quick allocation error:', err);
      toast.error(err?.message || 'Failed to allocate baseline budget.');
    } finally {
      setAllocating(false);
    }
  };

  // Handle workflow submit / approve / reject
  const handleWorkflowAction = async () => {
    if (!actionType) return;
    setActionSubmitting(true);
    try {
      if (actionType === 'submit') {
        await budgetsApi.submit(budgetId, { comments: actionComments || undefined });
        toast.success('Project budget submitted for approval.');
      } else if (actionType === 'approve') {
        await budgetsApi.approve(budgetId, { comments: actionComments || undefined });
        toast.success('Project budget approved successfully.');
      } else if (actionType === 'reject') {
        if (!actionComments.trim()) {
          toast.error('Rejection reason is required.');
          setActionSubmitting(false);
          return;
        }
        await budgetsApi.reject(budgetId, { comments: actionComments });
        toast.success('Project budget rejected.');
      }
      setActionType(null);
      setActionComments('');
      fetchBudgetDetail();
      fetchHistory();
      onRefresh?.();
    } catch (err) {
      toast.error(err?.message || `Failed to ${actionType} budget.`);
    } finally {
      setActionSubmitting(false);
    }
  };

  const calculatedPlannedAmount = (Number(lineForm.planned_quantity || 0) * Number(lineForm.planned_rate || 0)).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border bg-surface-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-text-primary">
                  {current.budget_name || 'Project Budget'}
                </h2>
                <Badge
                  variant={getVariant(status)}
                  className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 inline-flex items-center"
                >
                  {current.status_name || status}
                </Badge>
              </div>
              <p className="text-xs text-text-secondary mt-0.5 font-mono">
                {current.budget_code} · <span className="font-sans text-text-primary">{current.project_name || 'Project'}</span>
                {current.version_no ? ` · Version ${current.version_no}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isDraft && hasPermission('budget.submit') && (
              <Button
                variant="primary"
                size="sm"
                className="h-8 text-xs font-medium"
                onClick={() => { setActionType('submit'); setActionComments(''); }}
              >
                Submit for Approval
              </Button>
            )}
            {isSubmitted && hasPermission('budget.approve') && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  className="h-8 text-xs font-medium bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => { setActionType('approve'); setActionComments(''); }}
                >
                  Approve Budget
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-medium text-rose-600 border-rose-200 hover:bg-rose-50"
                  onClick={() => { setActionType('reject'); setActionComments(''); }}
                >
                  Reject
                </Button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-muted rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cost Summary Breakdown Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 px-6 py-3 border-b border-border bg-surface-subtle/50 text-xs shrink-0">
          <div>
            <div className="text-[10px] text-text-muted uppercase font-semibold">Total Budget</div>
            <div className="text-base font-bold font-mono text-primary">
              ₹{Number(current.total_budget || current.total_amount || 0).toLocaleString('en-IN')}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-text-muted uppercase font-semibold">Direct Cost</div>
            <div className="text-sm font-semibold font-mono text-text-primary">
              ₹{Number(current.direct_cost || 0).toLocaleString('en-IN')}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-text-muted uppercase font-semibold">Overhead Cost</div>
            <div className="text-sm font-semibold font-mono text-text-primary">
              ₹{Number(current.overhead_cost || 0).toLocaleString('en-IN')}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-text-muted uppercase font-semibold">Contingency</div>
            <div className="text-sm font-semibold font-mono text-text-primary">
              ₹{Number(current.contingency_amount || 0).toLocaleString('en-IN')}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-text-muted uppercase font-semibold">Budget Date</div>
            <div className="text-sm font-semibold text-text-primary">
              {current.budget_date ? current.budget_date.split('T')[0] : '—'}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-border px-6 overflow-x-auto bg-surface shrink-0">
          <TabButton
            active={activeTab === 'lines'}
            onClick={() => setActiveTab('lines')}
            label="Budget Lines"
            icon={FileSpreadsheet}
            count={lines.length}
          />
          <TabButton
            active={activeTab === 'revisions'}
            onClick={() => setActiveTab('revisions')}
            label="Revisions"
            icon={Layers}
            count={revisions.length}
          />
          <TabButton
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            label="Approval History"
            icon={History}
            count={history.length}
          />
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: BUDGET LINES */}
          {activeTab === 'lines' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Project Budget Line Items</h3>
                  <p className="text-xs text-text-muted">Itemized cost classification and planned amounts</p>
                </div>
                <div className="flex items-center gap-2">
                  {isDraft && current?.source_boq_id && hasPermission('budget.update') && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 text-primary border-primary/30 hover:bg-primary/5"
                      leftIcon={<Sparkles className="w-3.5 h-3.5 text-primary" />}
                      onClick={handleImportFromBoq}
                      disabled={importingBoq}
                      title="Import all items from the linked approved BOQ"
                    >
                      {importingBoq ? 'Importing...' : 'Import from BOQ'}
                    </Button>
                  )}
                  {isDraft && hasPermission('budget.update') && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8"
                      leftIcon={<Sliders className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setQuickAllocForm({
                          direct_cost: current.direct_cost ? String(current.direct_cost) : '',
                          overhead_cost: current.overhead_cost ? String(current.overhead_cost) : '',
                          contingency_amount: current.contingency_amount ? String(current.contingency_amount) : '',
                        });
                        setIsQuickAllocOpen((v) => !v);
                      }}
                      title="Quickly allocate baseline amounts for Direct, Overhead, and Contingency"
                    >
                      Baseline Allocations
                    </Button>
                  )}
                  {isDraft && hasPermission('budget.update') && (
                    <Button
                      variant="primary"
                      size="sm"
                      className="text-xs h-8 shadow-xs"
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => setIsAddLineOpen(true)}
                    >
                      Add Budget Line
                    </Button>
                  )}
                </div>
              </div>

              {/* Add Line Form Card */}
              {isAddLineOpen && (
                <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-primary/10 pb-2">
                    <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">New Budget Line Item</h4>
                    <button
                      type="button"
                      onClick={() => setIsAddLineOpen(false)}
                      className="text-text-muted hover:text-text-primary"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleCreateLine} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <FormField label="Cost Type" required error={lineErrors.cost_type_id}>
                        <Select
                          value={lineForm.cost_type_id}
                          onChange={(v) => setLineForm((c) => ({ ...c, cost_type_id: v }))}
                          options={costTypes.map((ct) => ({
                            value: String(ct.id),
                            label: ct.cost_type_name || ct.name || ct.cost_type_code || ct.code,
                          }))}
                        />
                      </FormField>

                      <FormField label="Work Category" required error={lineErrors.work_category_id}>
                        <Select
                          value={lineForm.work_category_id}
                          onChange={(v) => setLineForm((c) => ({ ...c, work_category_id: v }))}
                          options={[
                            { value: '', label: 'Select Category' },
                            ...categories.map((c) => ({
                              value: String(c.id),
                              label: `${c.category_code || 'CAT'} - ${c.category_name || c.name}`,
                            })),
                          ]}
                        />
                      </FormField>

                      <FormField label="Unit of Measurement" error={lineErrors.uom_id}>
                        <Select
                          value={lineForm.uom_id}
                          onChange={(v) => setLineForm((c) => ({ ...c, uom_id: v }))}
                          options={[
                            { value: '', label: 'Select UOM' },
                            ...uoms.map((u) => ({
                              value: String(u.id),
                              label: `${u.uom_code || u.code || 'UOM'} (${u.uom_name || u.name || ''})`,
                            })),
                          ]}
                        />
                      </FormField>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-2">
                        <FormField label="Line Description" required error={lineErrors.line_description}>
                          <Input
                            value={lineForm.line_description}
                            onChange={(e) => setLineForm((c) => ({ ...c, line_description: e.target.value }))}
                            placeholder="e.g. Foundation excavation and PCC work"
                          />
                        </FormField>
                      </div>

                      <FormField label="Planned Quantity" required error={lineErrors.planned_quantity}>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={lineForm.planned_quantity}
                          onChange={(e) => setLineForm((c) => ({ ...c, planned_quantity: e.target.value }))}
                        />
                      </FormField>

                      <FormField label="Planned Unit Rate (₹)" required error={lineErrors.planned_rate}>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={lineForm.planned_rate}
                          onChange={(e) => setLineForm((c) => ({ ...c, planned_rate: e.target.value }))}
                          placeholder="0.00"
                        />
                      </FormField>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-primary/10">
                      <div className="text-xs text-text-secondary">
                        Calculated Amount: <span className="font-mono font-bold text-primary">₹{Number(calculatedPlannedAmount).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setIsAddLineOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          variant="primary"
                          size="sm"
                          className="h-8 text-xs shadow-xs"
                          disabled={addingLine}
                        >
                          {addingLine ? 'Adding...' : 'Save Line Item'}
                        </Button>
                      </div>
                    </div>
                  </form>
                </div>
              )}

              {/* Quick Baseline Allocation Card */}
              {isQuickAllocOpen && (
                <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-primary/10 pb-2">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-primary" />
                      <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Quick Baseline Cost Allocation</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsQuickAllocOpen(false)}
                      className="text-text-muted hover:text-text-primary"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-text-muted">
                    Quickly allocate baseline amounts for Direct Cost, Overhead, and Contingency. Lines will be generated and budget totals recalculated automatically.
                  </p>
                  <form onSubmit={handleQuickAllocate} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <FormField label="Direct Cost (₹)">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={quickAllocForm.direct_cost}
                          onChange={(e) => setQuickAllocForm((c) => ({ ...c, direct_cost: e.target.value }))}
                          placeholder="0.00"
                          leftIcon={<IndianRupee className="w-3.5 h-3.5 text-text-muted" />}
                          className="font-mono text-xs"
                        />
                      </FormField>

                      <FormField label="Overhead Cost (₹)">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={quickAllocForm.overhead_cost}
                          onChange={(e) => setQuickAllocForm((c) => ({ ...c, overhead_cost: e.target.value }))}
                          placeholder="0.00"
                          leftIcon={<IndianRupee className="w-3.5 h-3.5 text-text-muted" />}
                          className="font-mono text-xs"
                        />
                      </FormField>

                      <FormField label="Contingency (₹)">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={quickAllocForm.contingency_amount}
                          onChange={(e) => setQuickAllocForm((c) => ({ ...c, contingency_amount: e.target.value }))}
                          placeholder="0.00"
                          leftIcon={<IndianRupee className="w-3.5 h-3.5 text-text-muted" />}
                          className="font-mono text-xs"
                        />
                      </FormField>

                      <FormField label="Calculated Total">
                        <div className="h-9 px-3 py-2 rounded-md bg-surface border border-border flex items-center font-mono font-bold text-primary text-xs">
                          ₹{((parseFloat(quickAllocForm.direct_cost) || 0) + (parseFloat(quickAllocForm.overhead_cost) || 0) + (parseFloat(quickAllocForm.contingency_amount) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </FormField>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-primary/10">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setIsQuickAllocOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        className="h-8 text-xs shadow-xs"
                        disabled={allocating}
                      >
                        {allocating ? 'Allocating...' : 'Save Baseline Allocation'}
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              {/* Table */}
              <div className="border border-border rounded-lg overflow-hidden bg-surface shadow-xs">
                {loadingLines ? (
                  <div className="py-12 text-center text-text-muted text-xs">Loading budget lines...</div>
                ) : lines.length === 0 ? (
                  <div className="py-10 px-6 text-center text-xs flex flex-col items-center justify-center gap-3 bg-surface-muted/15 rounded-lg border border-dashed border-border m-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-text-primary">No budget lines defined yet</h4>
                      <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">
                        This budget currently has ₹0 allocated. Establish the cost baseline by importing items from the linked BOQ, using quick baseline allocations, or adding custom line items.
                      </p>
                    </div>
                    {isDraft && hasPermission('budget.update') && (
                      <div className="flex flex-wrap items-center justify-center gap-2.5 mt-2">
                        {current?.source_boq_id && (
                          <Button
                            variant="primary"
                            size="sm"
                            className="text-xs h-8 shadow-xs"
                            leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                            onClick={handleImportFromBoq}
                            disabled={importingBoq}
                          >
                            {importingBoq ? 'Importing from BOQ...' : `Import Items from Linked BOQ (${current.source_boq_code || 'BOQ'})`}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-8 border-primary/40 text-primary hover:bg-primary/5"
                          leftIcon={<Sliders className="w-3.5 h-3.5" />}
                          onClick={() => {
                            setQuickAllocForm({
                              direct_cost: current.direct_cost ? String(current.direct_cost) : '',
                              overhead_cost: current.overhead_cost ? String(current.overhead_cost) : '',
                              contingency_amount: current.contingency_amount ? String(current.contingency_amount) : '',
                            });
                            setIsQuickAllocOpen(true);
                          }}
                        >
                          Quick Baseline Allocations
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-8 text-text-secondary hover:text-text-primary"
                          leftIcon={<Plus className="w-3.5 h-3.5" />}
                          onClick={() => setIsAddLineOpen(true)}
                        >
                          Add Custom Line
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-muted text-text-secondary text-[11px] uppercase font-semibold border-b border-border tracking-wider">
                      <tr>
                        <th className="px-3 py-2 w-10 text-center">#</th>
                        <th className="px-3 py-2">Line Code</th>
                        <th className="px-3 py-2">Cost Type</th>
                        <th className="px-3 py-2">Work Category</th>
                        <th className="px-3 py-2">Description</th>
                        <th className="px-3 py-2 text-right">Quantity</th>
                        <th className="px-3 py-2 text-right">Unit Rate</th>
                        <th className="px-3 py-2 text-right">Planned Amt</th>
                        <th className="px-3 py-2 text-right">Committed</th>
                        <th className="px-3 py-2 text-right">Actual</th>
                        {isDraft && <th className="px-3 py-2 w-12 text-center">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {lines.map((line, idx) => (
                        <tr key={line.id || idx} className="hover:bg-surface-muted/30 transition-colors">
                          <td className="px-3 py-2 text-center text-text-muted text-[11px]">{idx + 1}</td>
                          <td className="px-3 py-2 font-mono font-medium text-text-primary text-[11px]">{line.line_code || '—'}</td>
                          <td className="px-3 py-2">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-surface-muted border border-border text-text-secondary">
                              {line.cost_type_name || line.cost_type_code || line.cost_type || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-text-secondary">{line.category_name || line.category_code || '—'}</td>
                          <td className="px-3 py-2 text-text-primary font-medium max-w-xs truncate" title={line.line_description}>
                            {line.line_description || '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-text-secondary">
                            {line.planned_quantity} {line.uom_code || line.uom_name || ''}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-text-secondary">
                            ₹{Number(line.planned_rate || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-text-primary">
                            ₹{Number(line.planned_amount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-text-muted">
                            ₹{Number(line.committed_amount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-text-muted">
                            ₹{Number(line.actual_amount || 0).toLocaleString('en-IN')}
                          </td>
                          {isDraft && (
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => setDeletingLineId(line.id)}
                                className="p-1 text-text-muted hover:text-rose-600 rounded transition-colors"
                                title="Delete line item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-border bg-surface-muted/50 font-semibold text-xs">
                      <tr>
                        <td colSpan={isDraft ? 7 : 7} className="px-3 py-2.5 text-right font-bold text-text-primary">
                          Total Budget:
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-primary text-sm">
                          ₹{lines.reduce((acc, l) => acc + Number(l.planned_amount || 0), 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-text-muted">
                          ₹{lines.reduce((acc, l) => acc + Number(l.committed_amount || 0), 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-text-muted">
                          ₹{lines.reduce((acc, l) => acc + Number(l.actual_amount || 0), 0).toLocaleString('en-IN')}
                        </td>
                        {isDraft && <td />}
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: REVISIONS */}
          {activeTab === 'revisions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Budget Revision History</h3>
                  <p className="text-xs text-text-muted">Tracks approved and pending baseline adjustments</p>
                </div>
              </div>

              <div className="border border-border rounded-lg overflow-hidden bg-surface shadow-xs">
                {loadingRevisions ? (
                  <div className="py-12 text-center text-text-muted text-xs">Loading revisions...</div>
                ) : revisions.length === 0 ? (
                  <div className="py-12 text-center text-text-muted text-xs">
                    No revisions recorded for this budget yet.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-muted text-text-secondary text-[11px] uppercase font-semibold border-b border-border tracking-wider">
                      <tr>
                        <th className="px-3 py-2 w-10 text-center">#</th>
                        <th className="px-3 py-2">Rev No</th>
                        <th className="px-3 py-2">Revision Date</th>
                        <th className="px-3 py-2">Reason</th>
                        <th className="px-3 py-2 text-right">Previous Total</th>
                        <th className="px-3 py-2 text-right">Variance</th>
                        <th className="px-3 py-2 text-right">Revised Total</th>
                        <th className="px-3 py-2 text-center w-24">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {revisions.map((rev, idx) => {
                        const variance = Number(rev.variance_amount || 0);
                        return (
                          <tr key={rev.id || idx} className="hover:bg-surface-muted/30">
                            <td className="px-3 py-2 text-center text-text-muted">{idx + 1}</td>
                            <td className="px-3 py-2 font-mono font-bold text-text-primary">
                              REV-{String(rev.revision_no || idx + 1).padStart(2, '0')}
                            </td>
                            <td className="px-3 py-2 text-text-secondary">{rev.revision_date || '—'}</td>
                            <td className="px-3 py-2 text-text-primary max-w-xs truncate" title={rev.reason}>
                              {rev.reason || '—'}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-text-secondary">
                              ₹{Number(rev.previous_total || 0).toLocaleString('en-IN')}
                            </td>
                            <td className={`px-3 py-2 text-right font-mono font-medium ${variance > 0 ? 'text-emerald-600' : variance < 0 ? 'text-rose-600' : 'text-text-muted'}`}>
                              {variance > 0 ? '+' : ''}₹{variance.toLocaleString('en-IN')}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-semibold text-text-primary">
                              ₹{Number(rev.revised_total || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Badge
                                variant={getVariant(rev.status_code || rev.status_name || rev.status)}
                                className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 inline-flex items-center"
                              >
                                {rev.status_name || rev.status_code || 'Draft'}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: APPROVAL HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-text-primary">Workflow & Approval Trail</h3>
              {loadingHistory ? (
                <div className="py-12 text-center text-text-muted text-xs">Loading approval trail...</div>
              ) : history.length === 0 ? (
                <div className="py-12 text-center text-text-muted text-xs">No workflow actions logged yet.</div>
              ) : (
                <div className="space-y-3">
                  {history.map((h, i) => {
                    const action = String(h.action_code || h.action_name || h.action || '').toUpperCase();
                    const isApprove = action.includes('APPROV');
                    const isReject = action.includes('REJECT');
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3.5 rounded-lg bg-surface border border-border/80 shadow-xs"
                      >
                        <div
                          className={`w-3 h-3 rounded-full mt-1 shrink-0 ${
                            isApprove ? 'bg-emerald-500' : isReject ? 'bg-rose-500' : 'bg-primary'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-text-primary uppercase tracking-wide">
                              {h.action_name || h.action_code || 'Action'}
                            </span>
                            <span className="text-[11px] text-text-muted font-mono">
                              {h.action_at || h.created_at || '—'}
                            </span>
                          </div>
                          <div className="text-xs text-text-secondary mt-0.5">
                            By: <span className="font-medium text-text-primary">{h.first_name ? `${h.first_name} ${h.last_name || ''} (${h.employee_code || ''})` : (h.user_name || 'System')}</span>
                          </div>
                          {h.comments && (
                            <div className="mt-1.5 p-2 rounded bg-surface-muted text-xs text-text-secondary italic">
                              &ldquo;{h.comments}&rdquo;
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Line Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deletingLineId)}
        title="Delete Budget Line Item"
        message="Are you sure you want to delete this line item from the project budget? This action will adjust the total budget."
        confirmLabel="Delete Line"
        variant="danger"
        onConfirm={() => handleDeleteLine(deletingLineId)}
        onCancel={() => setDeletingLineId(null)}
      />

      {/* Workflow Action (Submit / Approve / Reject) Modal */}
      {actionType && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-lg shadow-2xl w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-text-primary capitalize">
              {actionType === 'submit' && 'Submit Project Budget for Approval'}
              {actionType === 'approve' && 'Approve Project Budget'}
              {actionType === 'reject' && 'Reject Project Budget'}
            </h3>
            <p className="text-xs text-text-secondary">
              {actionType === 'submit' && 'This budget will be locked and sent to designated managers for approval.'}
              {actionType === 'approve' && 'This budget will become the active baseline for project procurement, cost tracking, and revisions.'}
              {actionType === 'reject' && 'Please state the reason for rejecting this project budget.'}
            </p>

            <FormField label={actionType === 'reject' ? 'Rejection Reason (Required)' : 'Comments / Remarks (Optional)'}>
              <textarea
                value={actionComments}
                onChange={(e) => setActionComments(e.target.value)}
                placeholder="Enter remarks or justification..."
                rows={3}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </FormField>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => { setActionType(null); setActionComments(''); }}
              >
                Cancel
              </Button>
              <Button
                variant={actionType === 'reject' ? 'danger' : 'primary'}
                size="sm"
                className="h-8 text-xs"
                disabled={actionSubmitting || (actionType === 'reject' && !actionComments.trim())}
                onClick={handleWorkflowAction}
              >
                {actionSubmitting ? 'Processing...' : (
                  actionType === 'submit' ? 'Confirm Submit' : (actionType === 'approve' ? 'Confirm Approval' : 'Confirm Reject')
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BudgetDetailModal;
