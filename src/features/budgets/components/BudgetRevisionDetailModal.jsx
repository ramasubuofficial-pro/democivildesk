import { useState, useEffect } from 'react';
import {
  X,
  Layers,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  History,
  FileSpreadsheet,
} from 'lucide-react';
import { budgetsApi } from '../../../api/apiservice';
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

const CHANGE_TYPES = [
  { id: 2, code: 'MODIFY', name: 'Modify (Rate/Qty Change)' },
  { id: 3, code: 'REMOVE', name: 'Remove (De-scope Line)' },
  { id: 1, code: 'ADD', name: 'Add (Scope Addition)' },
];

export function BudgetRevisionDetailModal({
  isOpen,
  budgetId,
  revisionId,
  onClose,
  onRefresh,
  mode = 'revision', // 'revision' | 'variation'
}) {
  const isVariation = mode === 'variation';
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('lines');
  const [revision, setRevision] = useState(null);
  const [revisionLines, setRevisionLines] = useState([]);
  const [parentBudgetLines, setParentBudgetLines] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingLines, setLoadingLines] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Add revision line form state
  const [isAddLineOpen, setIsAddLineOpen] = useState(false);
  const [lineForm, setLineForm] = useState({
    budget_line_id: '',
    change_type_id: '2',
    revised_quantity: '',
    revised_rate: '',
    reason: '',
  });
  const [lineErrors, setLineErrors] = useState({});
  const [addingLine, setAddingLine] = useState(false);

  // Delete line state
  const [deletingLineId, setDeletingLineId] = useState(null);

  // Workflow action modals (submit / approve / reject)
  const [actionType, setActionType] = useState(null);
  const [actionComments, setActionComments] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const fetchRevision = () => {
    if (!budgetId || !revisionId) return;
    setLoading(true);
    budgetsApi.revisions.get(budgetId, revisionId)
      .then((res) => {
        const rev = res?.data?.budget_revision ?? res?.budget_revision ?? res?.data ?? res;
        setRevision(rev);
        if (res?.data?.revision_lines) {
          setRevisionLines(res.data.revision_lines);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch revision:', err);
      })
      .finally(() => setLoading(false));
  };

  const fetchParentLines = () => {
    if (!budgetId) return;
    budgetsApi.lines.list(budgetId)
      .then((res) => {
        const list = res?.data?.budget_lines ?? res?.budget_lines ?? res?.lines ?? [];
        setParentBudgetLines(Array.isArray(list) ? list : []);
      })
      .catch(() => setParentBudgetLines([]));
  };

  const fetchHistory = () => {
    if (!budgetId || !revisionId) return;
    setLoadingHistory(true);
    budgetsApi.revisions.history(budgetId, revisionId)
      .then((res) => {
        const list = res?.data?.approvals ?? res?.approvals ?? [];
        setHistory(Array.isArray(list) ? list : []);
      })
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  };

  useEffect(() => {
    if (!isOpen || !budgetId || !revisionId) return;
    fetchRevision();
    fetchParentLines();
    fetchHistory();
  }, [isOpen, budgetId, revisionId]);

  if (!isOpen || !revisionId) return null;

  const current = revision || {};
  const status = String(current.status_code || current.status_name || current.status || 'DRAFT').toUpperCase();
  const isDraft = status === 'DRAFT';
  const isSubmitted = status === 'SUBMITTED' || status === 'PENDING';
  const isApproved = status === 'APPROVED';

  const getVariant = (s) => {
    const v = String(s || '').toUpperCase();
    if (v.includes('APPROVED')) return 'success';
    if (v.includes('SUBMITTED') || v.includes('PENDING') || v.includes('REVIEW')) return 'warning';
    if (v.includes('REJECTED')) return 'error';
    return 'neutral';
  };

  // Pre-fill default qty and rate when a budget line is selected
  const handleSelectBudgetLine = (lineId) => {
    const found = parentBudgetLines.find((l) => String(l.id) === String(lineId));
    setLineForm((c) => ({
      ...c,
      budget_line_id: lineId,
      revised_quantity: found ? String(found.planned_quantity || '') : '',
      revised_rate: found ? String(found.planned_rate || '') : '',
    }));
    setLineErrors((c) => ({ ...c, budget_line_id: null }));
  };

  const handleCreateRevisionLine = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!lineForm.budget_line_id) errors.budget_line_id = 'Select a budget line to revise.';
    if (!lineForm.change_type_id) errors.change_type_id = 'Select change type.';

    const changeCode = CHANGE_TYPES.find((ct) => String(ct.id) === String(lineForm.change_type_id))?.code;
    if (changeCode !== 'REMOVE') {
      if (!lineForm.revised_quantity || Number(lineForm.revised_quantity) < 0) {
        errors.revised_quantity = 'Valid non-negative quantity is required.';
      }
      if (!lineForm.revised_rate || Number(lineForm.revised_rate) < 0) {
        errors.revised_rate = 'Valid non-negative rate is required.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setLineErrors(errors);
      return;
    }

    setAddingLine(true);
    try {
      const payload = {
        budget_line_id: Number(lineForm.budget_line_id),
        change_type_id: Number(lineForm.change_type_id),
        revised_quantity: changeCode === 'REMOVE' ? 0 : Number(lineForm.revised_quantity),
        revised_rate: changeCode === 'REMOVE' ? 0 : Number(lineForm.revised_rate),
        reason: lineForm.reason.trim() || undefined,
      };

      await budgetsApi.revisions.createLine(budgetId, revisionId, payload);
      toast.success('Revision line item added.');
      setIsAddLineOpen(false);
      setLineForm({
        budget_line_id: '',
        change_type_id: '2',
        revised_quantity: '',
        revised_rate: '',
        reason: '',
      });
      fetchRevision();
      onRefresh?.();
    } catch (err) {
      console.error('Revision line error:', err);
      toast.error(err?.message || 'Failed to add revision line item.');
    } finally {
      setAddingLine(false);
    }
  };

  const handleDeleteLine = async (lineId) => {
    try {
      await budgetsApi.revisions.removeLine(budgetId, revisionId, lineId);
      toast.success('Revision line removed.');
      setDeletingLineId(null);
      fetchRevision();
      onRefresh?.();
    } catch (err) {
      toast.error(err?.message || 'Failed to remove revision line.');
    }
  };

  const handleWorkflowAction = async () => {
    if (!actionType) return;
    setActionSubmitting(true);
    try {
      if (actionType === 'submit') {
        await budgetsApi.revisions.submit(budgetId, revisionId, { comments: actionComments || undefined });
        toast.success(isVariation ? 'Variation order submitted for commercial approval.' : 'Budget revision submitted for approval.');
      } else if (actionType === 'approve') {
        await budgetsApi.revisions.approve(budgetId, revisionId, { comments: actionComments || undefined });
        toast.success(isVariation ? 'Variation order approved. Baseline updated.' : 'Budget revision approved. Budget baseline has been updated.');
      } else if (actionType === 'reject') {
        if (!actionComments.trim()) {
          toast.error('Rejection reason is required.');
          setActionSubmitting(false);
          return;
        }
        await budgetsApi.revisions.reject(budgetId, revisionId, { comments: actionComments });
        toast.success(isVariation ? 'Variation order rejected.' : 'Budget revision rejected.');
      }
      setActionType(null);
      setActionComments('');
      fetchRevision();
      fetchHistory();
      onRefresh?.();
    } catch (err) {
      toast.error(err?.message || `Failed to ${actionType} ${isVariation ? 'variation order' : 'revision'}.`);
    } finally {
      setActionSubmitting(false);
    }
  };

  // Selected line reference in form
  const selectedParentLine = parentBudgetLines.find((l) => String(l.id) === String(lineForm.budget_line_id));
  const changeCode = CHANGE_TYPES.find((ct) => String(ct.id) === String(lineForm.change_type_id))?.code;
  const currentPrevAmount = selectedParentLine ? Number(selectedParentLine.planned_amount || 0) : 0;
  const currentRevisedAmount = changeCode === 'REMOVE' ? 0 : (Number(lineForm.revised_quantity || 0) * Number(lineForm.revised_rate || 0));
  const liveVariance = currentRevisedAmount - currentPrevAmount;

  const totalVariance = Number(current.variance_amount || 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border bg-surface-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${isVariation ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-600'}`}>
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-text-primary">
                  {isVariation
                    ? `Variation Order VO-${String(current.revision_no || '').padStart(3, '0')}`
                    : `Budget Revision REV-${String(current.revision_no || '').padStart(2, '0')}`}
                </h2>
                <Badge
                  variant={getVariant(status)}
                  className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 inline-flex items-center"
                >
                  {current.status_name || status}
                </Badge>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                {isVariation ? 'Order Date: ' : 'Effective Date: '}
                <span className="font-medium text-text-primary">{current.revision_date || '—'}</span>
                {current.requested_by_first_name ? ` · Requested by ${current.requested_by_first_name} ${current.requested_by_last_name || ''}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isDraft && hasPermission('budget.revise') && (
              <Button
                variant="primary"
                size="sm"
                className="h-8 text-xs font-medium"
                onClick={() => { setActionType('submit'); setActionComments(''); }}
                disabled={revisionLines.length === 0}
                title={revisionLines.length === 0 ? 'Add at least one line item before submitting' : 'Submit for approval'}
              >
                {isVariation ? 'Submit Variation Order' : 'Submit Revision'}
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
                  {isVariation ? 'Approve Variation' : 'Approve Revision'}
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

        {/* Revision / Variation Impact Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3 border-b border-border bg-surface-subtle/50 text-xs shrink-0">
          <div>
            <div className="text-[10px] text-text-muted uppercase font-semibold">
              {isVariation ? 'Pre-Order Value' : 'Previous Baseline'}
            </div>
            <div className="text-sm font-semibold font-mono text-text-secondary">
              ₹{Number(current.previous_total || 0).toLocaleString('en-IN')}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-text-muted uppercase font-semibold">
              {isVariation ? 'Variation Quantum (+/-)' : 'Baseline Shift'}
            </div>
            <div className={`text-base font-bold font-mono ${totalVariance > 0 ? 'text-emerald-600' : totalVariance < 0 ? 'text-rose-600' : 'text-text-primary'}`}>
              {totalVariance > 0 ? '+' : ''}₹{totalVariance.toLocaleString('en-IN')}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-text-muted uppercase font-semibold">
              {isVariation ? 'Revised Commitment' : 'New Revised Baseline'}
            </div>
            <div className="text-base font-bold font-mono text-primary">
              ₹{Number(current.revised_total || 0).toLocaleString('en-IN')}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-text-muted uppercase font-semibold">
              {isVariation ? 'Scope & Justification' : 'Revision Rationale'}
            </div>
            <div className="text-xs text-text-primary truncate" title={current.reason}>
              {current.reason || '—'}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-border px-6 overflow-x-auto bg-surface shrink-0">
          <TabButton
            active={activeTab === 'lines'}
            onClick={() => setActiveTab('lines')}
            label={isVariation ? 'Scope Change Lines' : 'Baseline Line Items'}
            icon={FileSpreadsheet}
            count={revisionLines.length}
          />
          <TabButton
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            label="Approval Trail"
            icon={History}
            count={history.length}
          />
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'lines' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {isVariation ? 'Scope Change Lines' : 'Revised Scope & Rate Adjustments'}
                  </h3>
                  <p className="text-xs text-text-muted">
                    {isVariation ? 'Lines modified, added, or de-scoped in this variation order' : 'Lines modified, added, or de-scoped in this baseline revision'}
                  </p>
                </div>
                {isDraft && hasPermission('budget.revise') && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="text-xs h-8 shadow-xs"
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                    onClick={() => setIsAddLineOpen(true)}
                  >
                    {isVariation ? 'Add Scope Line' : 'Add Revision Line'}
                  </Button>
                )}
              </div>

              {/* Add Revision Line Card */}
              {isAddLineOpen && (
                <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-primary/10 pb-2">
                    <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Add Line to Revision</h4>
                    <button
                      type="button"
                      onClick={() => setIsAddLineOpen(false)}
                      className="text-text-muted hover:text-text-primary"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleCreateRevisionLine} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField label="Target Budget Line" required error={lineErrors.budget_line_id}>
                        <Select
                          value={lineForm.budget_line_id}
                          onChange={handleSelectBudgetLine}
                          options={[
                            { value: '', label: 'Select Budget Line' },
                            ...parentBudgetLines.map((l) => ({
                              value: String(l.id),
                              label: `${l.line_code || 'BL'} - ${l.line_description} (Qty: ${l.planned_quantity}, Rate: ₹${l.planned_rate})`,
                            })),
                          ]}
                        />
                      </FormField>

                      <FormField label="Change Action" required error={lineErrors.change_type_id}>
                        <Select
                          value={lineForm.change_type_id}
                          onChange={(v) => setLineForm((c) => ({ ...c, change_type_id: v }))}
                          options={CHANGE_TYPES.map((ct) => ({
                            value: String(ct.id),
                            label: ct.name,
                          }))}
                        />
                      </FormField>
                    </div>

                    {changeCode !== 'REMOVE' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField label="Revised Quantity" required error={lineErrors.revised_quantity} hint={selectedParentLine ? `Previous: ${selectedParentLine.planned_quantity}` : ''}>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={lineForm.revised_quantity}
                            onChange={(e) => setLineForm((c) => ({ ...c, revised_quantity: e.target.value }))}
                          />
                        </FormField>

                        <FormField label="Revised Rate (₹)" required error={lineErrors.revised_rate} hint={selectedParentLine ? `Previous: ₹${selectedParentLine.planned_rate}` : ''}>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={lineForm.revised_rate}
                            onChange={(e) => setLineForm((c) => ({ ...c, revised_rate: e.target.value }))}
                          />
                        </FormField>
                      </div>
                    )}

                    <FormField label="Line Revision Reason" hint="Optional explanation for this specific line adjustment">
                      <Input
                        value={lineForm.reason}
                        onChange={(e) => setLineForm((c) => ({ ...c, reason: e.target.value }))}
                        placeholder="e.g. Vendor price renegotiation, scope reduction..."
                      />
                    </FormField>

                    {/* Impact preview */}
                    {selectedParentLine && (
                      <div className="p-2.5 rounded bg-surface border border-border flex flex-wrap items-center justify-between text-xs gap-2">
                        <div>Previous Amount: <span className="font-mono font-medium">₹{currentPrevAmount.toLocaleString('en-IN')}</span></div>
                        <div>Revised Amount: <span className="font-mono font-medium">₹{currentRevisedAmount.toLocaleString('en-IN')}</span></div>
                        <div>Variance: <span className={`font-mono font-bold ${liveVariance > 0 ? 'text-emerald-600' : liveVariance < 0 ? 'text-rose-600' : 'text-text-muted'}`}>{liveVariance > 0 ? '+' : ''}₹{liveVariance.toLocaleString('en-IN')}</span></div>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-primary/10">
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
                        {addingLine ? 'Adding...' : 'Add to Revision'}
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              {/* Table */}
              <div className="border border-border rounded-lg overflow-hidden bg-surface shadow-xs">
                {revisionLines.length === 0 ? (
                  <div className="py-12 text-center text-text-muted text-xs">
                    No lines added to this revision yet. Click &quot;Add Revision Line&quot; to adjust budget baseline items.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-muted text-text-secondary text-[11px] uppercase font-semibold border-b border-border tracking-wider">
                      <tr>
                        <th className="px-3 py-2 w-10 text-center">#</th>
                        <th className="px-3 py-2">Line Code</th>
                        <th className="px-3 py-2">Description</th>
                        <th className="px-3 py-2">Change</th>
                        <th className="px-3 py-2 text-right">Prev Amount</th>
                        <th className="px-3 py-2 text-right">Revised Qty x Rate</th>
                        <th className="px-3 py-2 text-right">Revised Amount</th>
                        <th className="px-3 py-2 text-right">Variance</th>
                        <th className="px-3 py-2">Reason</th>
                        {isDraft && <th className="px-3 py-2 w-10 text-center">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {revisionLines.map((line, idx) => {
                        const variance = Number(line.variance_amount || 0);
                        const changeCode = line.change_type_code || 'MODIFY';
                        return (
                          <tr key={line.id || idx} className="hover:bg-surface-muted/30 transition-colors">
                            <td className="px-3 py-2 text-center text-text-muted text-[11px]">{idx + 1}</td>
                            <td className="px-3 py-2 font-mono font-medium text-text-primary text-[11px]">{line.line_code || '—'}</td>
                            <td className="px-3 py-2 text-text-primary font-medium max-w-xs truncate" title={line.line_description}>
                              {line.line_description || '—'}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                changeCode === 'REMOVE' ? 'bg-rose-50 text-rose-700 border border-rose-200' : (changeCode === 'ADD' ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-amber-50 text-amber-700 border border-amber-200')
                              }`}>
                                {changeCode}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-text-secondary">
                              ₹{Number(line.previous_amount || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-text-secondary text-[11px]">
                              {line.revised_quantity} @ ₹{line.revised_rate}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-semibold text-text-primary">
                              ₹{Number(line.revised_amount || 0).toLocaleString('en-IN')}
                            </td>
                            <td className={`px-3 py-2 text-right font-mono font-bold ${variance > 0 ? 'text-emerald-600' : variance < 0 ? 'text-rose-600' : 'text-text-muted'}`}>
                              {variance > 0 ? '+' : ''}₹{variance.toLocaleString('en-IN')}
                            </td>
                            <td className="px-3 py-2 text-text-secondary text-[11px] max-w-xs truncate" title={line.reason}>
                              {line.reason || '—'}
                            </td>
                            {isDraft && (
                              <td className="px-3 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => setDeletingLineId(line.id)}
                                  className="p-1 text-text-muted hover:text-rose-600 rounded transition-colors"
                                  title="Remove from revision"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t-2 border-border bg-surface-muted/50 font-semibold text-xs">
                      <tr>
                        <td colSpan={7} className="px-3 py-2.5 text-right font-bold text-text-primary">
                          Total Net Variance:
                        </td>
                        <td className={`px-3 py-2.5 text-right font-mono font-bold text-sm ${totalVariance > 0 ? 'text-emerald-600' : totalVariance < 0 ? 'text-rose-600' : 'text-text-primary'}`}>
                          {totalVariance > 0 ? '+' : ''}₹{totalVariance.toLocaleString('en-IN')}
                        </td>
                        <td colSpan={isDraft ? 2 : 1} />
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-text-primary">Revision Approval Trail</h3>
              {loadingHistory ? (
                <div className="py-12 text-center text-text-muted text-xs">Loading approval trail...</div>
              ) : history.length === 0 ? (
                <div className="py-12 text-center text-text-muted text-xs">No workflow actions recorded yet.</div>
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
                              {h.action_at || '—'}
                            </span>
                          </div>
                          <div className="text-xs text-text-secondary mt-0.5">
                            By: <span className="font-medium text-text-primary">{h.first_name ? `${h.first_name} ${h.last_name || ''} (${h.employee_code || ''})` : 'System'}</span>
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

      {/* Delete Revision Line Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deletingLineId)}
        title="Remove Line from Revision"
        message="Are you sure you want to remove this line adjustment from the revision? The parent budget item will remain unchanged."
        confirmLabel="Remove Line"
        variant="danger"
        onConfirm={() => handleDeleteLine(deletingLineId)}
        onCancel={() => setDeletingLineId(null)}
      />

      {/* Workflow Action Modal */}
      {actionType && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-lg shadow-2xl w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-text-primary capitalize">
              {actionType === 'submit' && 'Submit Revision for Approval'}
              {actionType === 'approve' && 'Approve Budget Revision'}
              {actionType === 'reject' && 'Reject Budget Revision'}
            </h3>
            <p className="text-xs text-text-secondary">
              {actionType === 'submit' && 'This revision will be submitted to the approver. No further line edits can be made while under review.'}
              {actionType === 'approve' && 'Approving this revision will immediately update the master budget lines and baseline totals.'}
              {actionType === 'reject' && 'Please state the reason for rejecting this budget revision.'}
            </p>

            <FormField label={actionType === 'reject' ? 'Rejection Reason (Required)' : 'Comments / Remarks (Optional)'}>
              <textarea
                value={actionComments}
                onChange={(e) => setActionComments(e.target.value)}
                placeholder="Enter remarks or notes..."
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

export default BudgetRevisionDetailModal;
