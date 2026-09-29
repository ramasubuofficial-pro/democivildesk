import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Layers,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Plus,
  RotateCcw,
  Eye,
  MoreVertical,
  Check,
  XCircle,
  Trash2,
  Send,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  BarChart3,
  FileText,
} from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageContainer } from '../../../components/layout/PageContainer';
import { KpiCard } from '../../../components/composite/KpiCard';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Select } from '../../../components/ui/Select';
import { SearchField } from '../../../components/composite/SearchField';
import { FormField } from '../../../components/composite/FormField';
import { toast } from '../../../components/composite/Toast';
import { budgetsApi, projectsApi } from '../../../api/apiservice';
import { useAuth } from '../../auth/context/AuthContext';
import { BudgetRevisionFormModal } from '../components/BudgetRevisionFormModal';
import { BudgetRevisionDetailModal } from '../components/BudgetRevisionDetailModal';

const INR = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
const INR_L = (v) => {
  const n = Number(v || 0);
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  return `₹${(n / 100000).toFixed(1)} L`;
};

export function BudgetVariationsPage() {
  const { hasPermission } = useAuth();
  const [projects, setProjects] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [variations, setVariations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filters
  const [filters, setFilters] = useState({
    project_id: 'all',
    budget_id: 'all',
    status: 'all',
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewingRevision, setViewingRevision] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const menuRef = useRef(null);

  // Workflow confirmation dialog
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionComments, setActionComments] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Resilient, synchronized fetch for Projects, Budgets, and Variations
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const loadData = async () => {
      try {
        const [projRes, budRes] = await Promise.allSettled([
          projectsApi.list(),
          budgetsApi.list(),
        ]);

        const projList = projRes.status === 'fulfilled'
          ? (Array.isArray(projRes.value) ? projRes.value : (projRes.value?.data?.projects ?? projRes.value?.projects ?? (Array.isArray(projRes.value?.data) ? projRes.value.data : [])))
          : [];

        const rawBudgets = budRes.status === 'fulfilled'
          ? (budRes.value?.data?.project_budgets ?? budRes.value?.project_budgets ?? budRes.value?.data?.data ?? (Array.isArray(budRes.value) ? budRes.value : []))
          : [];

        if (!isMounted) return;
        setProjects(Array.isArray(projList) ? projList : []);
        setBudgets(Array.isArray(rawBudgets) ? rawBudgets : []);

        const eligibleBudgets = (Array.isArray(rawBudgets) ? rawBudgets : []).filter((b) => {
          const s = String(b.status_code || b.status_name || b.status || '').toUpperCase();
          return s === 'APPROVED' || (b.revision_count && Number(b.revision_count) > 0);
        });

        const revPromises = eligibleBudgets.map(async (b) => {
          try {
            const r = await budgetsApi.revisions.list(b.id);
            const list = r?.data?.budget_revisions ?? r?.budget_revisions ?? r?.data?.revisions ?? r?.revisions ?? (Array.isArray(r?.data) ? r.data : []);
            return (Array.isArray(list) ? list : []).map((rev) => ({
              ...rev,
              budget_id: b.id,
              budget_code: b.budget_code,
              budget_name: b.budget_name,
              project_id: b.project_id,
              project_name: b.project_name || projList.find((p) => p.id === b.project_id)?.project_name || 'Project',
              project_code: b.project_code || projList.find((p) => p.id === b.project_id)?.project_code || '',
            }));
          } catch {
            return [];
          }
        });

        const revResults = await Promise.all(revPromises);
        if (!isMounted) return;

        const flattened = revResults
          .flat()
          .sort((a, b) => new Date(b.created_at || b.revision_date || 0) - new Date(a.created_at || a.revision_date || 0));

        setVariations(flattened);
      } catch (err) {
        console.error('Error fetching variation orders:', err);
        if (isMounted) setVariations([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  // Filter and search
  const filteredVariations = useMemo(() => {
    return variations.filter((rev) => {
      if (filters.project_id !== 'all' && String(rev.project_id) !== String(filters.project_id)) {
        return false;
      }
      if (filters.budget_id !== 'all' && String(rev.budget_id) !== String(filters.budget_id)) {
        return false;
      }
      if (filters.status !== 'all') {
        const s = String(rev.status_code || rev.status_name || rev.status || '').toLowerCase();
        if (filters.status === 'draft' && !s.includes('draft')) return false;
        if (filters.status === 'submitted' && !(s.includes('submit') || s.includes('review') || s.includes('pending'))) return false;
        if (filters.status === 'approved' && !s.includes('approv')) return false;
        if (filters.status === 'rejected' && !s.includes('reject')) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const vo = `vo-${String(rev.revision_no || '').padStart(3, '0')}`.toLowerCase();
        const code = String(rev.budget_code || '').toLowerCase();
        const name = String(rev.budget_name || '').toLowerCase();
        const reason = String(rev.reason || '').toLowerCase();
        const prj = String(rev.project_name || '').toLowerCase();
        if (!vo.includes(q) && !code.includes(q) && !name.includes(q) && !reason.includes(q) && !prj.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [variations, filters, searchQuery]);

  // KPIs
  const kpis = useMemo(() => {
    let draft = 0, submitted = 0, approved = 0, rejected = 0;
    let totalVariance = 0;
    let totalIncrease = 0, totalDecrease = 0;

    variations.forEach((rev) => {
      const s = String(rev.status_code || rev.status_name || rev.status || '').toLowerCase();
      const variance = Number(rev.variance_amount || 0);
      totalVariance += variance;
      if (variance > 0) totalIncrease += variance;
      if (variance < 0) totalDecrease += Math.abs(variance);
      if (s.includes('draft')) draft++;
      else if (s.includes('submit') || s.includes('pending') || s.includes('review')) submitted++;
      else if (s.includes('approv')) approved++;
      else if (s.includes('reject')) rejected++;
    });

    return { total: variations.length, draft, submitted, approved, rejected, totalVariance, totalIncrease, totalDecrease };
  }, [variations]);

  const hasActiveFilters = Boolean(
    (filters.project_id && filters.project_id !== 'all') ||
    (filters.budget_id && filters.budget_id !== 'all') ||
    (filters.status && filters.status !== 'all') ||
    searchQuery
  );

  const resetFilters = () => {
    setFilters({ project_id: 'all', budget_id: 'all', status: 'all' });
    setSearchQuery('');
  };

  const getVariant = (s) => {
    const v = String(s || '').toUpperCase();
    if (v.includes('APPROV')) return 'success';
    if (v.includes('SUBMIT') || v.includes('PENDING') || v.includes('REVIEW')) return 'warning';
    if (v.includes('REJECT')) return 'error';
    return 'neutral';
  };

  const variancePct = (rev) => {
    const prev = Number(rev.previous_total || 0);
    const variance = Number(rev.variance_amount || 0);
    if (!prev || prev === 0) return 0;
    return ((variance / prev) * 100).toFixed(1);
  };

  // Determine Change Nature badge
  const getChangeNature = (rev) => {
    const variance = Number(rev.variance_amount || 0);
    const reason = String(rev.reason || '').toLowerCase();
    if (reason.includes('rate') || reason.includes('escalat')) {
      return { label: 'Rate Escalation', color: 'bg-sky-50 text-sky-700 border-sky-200' };
    }
    if (variance > 0) {
      return { label: 'Scope Addition (+)', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
    if (variance < 0) {
      return { label: 'Deductive Scope (-)', color: 'bg-rose-50 text-rose-700 border-rose-200' };
    }
    return { label: 'Rate Neutral', color: 'bg-slate-50 text-slate-700 border-slate-200' };
  };

  // Workflow actions
  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, item } = confirmAction;
    setActionSubmitting(true);
    try {
      if (type === 'submit') {
        await budgetsApi.revisions.submit(item.budget_id, item.id, { comments: actionComments || undefined });
        toast.success('Variation order submitted for approval.');
      } else if (type === 'approve') {
        await budgetsApi.revisions.approve(item.budget_id, item.id, { comments: actionComments || undefined });
        toast.success('Variation order approved. Project baseline updated.');
      } else if (type === 'reject') {
        if (!actionComments.trim()) {
          toast.error('Rejection remarks are required.');
          setActionSubmitting(false);
          return;
        }
        await budgetsApi.revisions.reject(item.budget_id, item.id, { comments: actionComments });
        toast.success('Variation order rejected.');
      } else if (type === 'delete') {
        await budgetsApi.revisions.remove(item.budget_id, item.id);
        toast.success('Draft variation order deleted.');
      }
      setConfirmAction(null);
      setActionComments('');
      refresh();
    } catch (err) {
      toast.error(err?.message || `Failed to ${type} variation order.`);
    } finally {
      setActionSubmitting(false);
    }
  };

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'BOQ & Project Budget', href: '/budgets' },
    { label: 'Variation Orders' },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Budget Variation Orders (VO Register)"
        breadcrumbs={breadcrumbs}
        description="Register, assess, and authorise client-driven and site scope variations with commercial and margin impact."
      />

      <div className="flex flex-col gap-3 sm:gap-4 w-full">
        {/* KPI Summary Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <KpiCard
            label="Total Variation Orders"
            value={kpis.total}
            status="primary"
            icon={<FileText className="w-4 h-4 text-primary" />}
          />
          <KpiCard
            label="Pending Commercial Review"
            value={kpis.submitted}
            status="warning"
            icon={<Clock className="w-4 h-4 text-amber-500" />}
          />
          <KpiCard
            label="Approved Variations"
            value={kpis.approved}
            status="success"
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          />
          <KpiCard
            label="Net Variation Impact"
            value={`${kpis.totalVariance >= 0 ? '+' : ''}${INR_L(kpis.totalVariance)}`}
            status={kpis.totalVariance >= 0 ? 'success' : 'neutral'}
            icon={<BarChart3 className="w-4 h-4 text-emerald-600" />}
          />
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-surface border border-border rounded-lg p-2.5 sm:p-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="w-full sm:w-44">
              <Select
                className="text-xs h-8"
                options={[
                  { value: 'all', label: 'All Projects' },
                  ...projects.map((p) => ({
                    value: String(p.id),
                    label: p.project_name || p.name,
                  })),
                ]}
                value={filters.project_id}
                onChange={(value) => setFilters((c) => ({ ...c, project_id: value, budget_id: 'all' }))}
              />
            </div>

            <div className="w-full sm:w-48">
              <Select
                className="text-xs h-8"
                options={[
                  { value: 'all', label: 'All Budgets' },
                  ...budgets
                    .filter((b) => filters.project_id === 'all' || String(b.project_id) === String(filters.project_id))
                    .map((b) => ({
                      value: String(b.id),
                      label: `${b.budget_code} - ${b.budget_name || 'Budget'}`,
                    })),
                ]}
                value={filters.budget_id}
                onChange={(value) => setFilters((c) => ({ ...c, budget_id: value }))}
              />
            </div>

            <div className="w-full sm:w-36">
              <Select
                className="text-xs h-8"
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'draft', label: 'Draft Notices' },
                  { value: 'submitted', label: 'Under Review' },
                  { value: 'approved', label: 'Approved Orders' },
                  { value: 'rejected', label: 'Rejected' },
                ]}
                value={filters.status}
                onChange={(value) => setFilters((c) => ({ ...c, status: value }))}
              />
            </div>

            <div className="w-full sm:w-56">
              <SearchField
                placeholder="Search VO no, budget, reason..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8 px-2 text-text-muted hover:text-text-primary"
                onClick={resetFilters}
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Reset
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end">
            {hasPermission('budget.revise') && (
              <Button
                variant="primary"
                size="sm"
                className="text-xs h-8 shadow-xs"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setIsCreateOpen(true)}
              >
                Create Variation Order
              </Button>
            )}
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block border border-border rounded-lg bg-surface shadow-xs">
          {loading ? (
            <div className="py-16 text-center text-text-muted text-xs">Loading variation orders...</div>
          ) : filteredVariations.length === 0 ? (
            <div className="py-16 text-center text-text-muted text-xs">
              No variation orders found matching the selected criteria.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-muted text-text-secondary text-[11px] uppercase font-semibold border-b border-border tracking-wider">
                <tr>
                  <th className="px-3 py-2 w-10 text-center rounded-tl-lg">#</th>
                  <th className="px-3 py-2">VO Reference</th>
                  <th className="px-3 py-2">Budget & Project</th>
                  <th className="px-3 py-2">Change Classification</th>
                  <th className="px-3 py-2">Scope Justification</th>
                  <th className="px-3 py-2 text-right">Pre-Order Total</th>
                  <th className="px-3 py-2 text-right">Revised Total</th>
                  <th className="px-3 py-2 text-right">Variation Quantum</th>
                  <th className="px-3 py-2 text-center">% Impact</th>
                  <th className="px-3 py-2 text-center w-24">Status</th>
                  <th className="px-3 py-2 w-28 text-center rounded-tr-lg">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredVariations.map((rev, idx) => {
                  const variance = Number(rev.variance_amount || 0);
                  const statusStr = String(rev.status_code || rev.status_name || rev.status || 'DRAFT').toUpperCase();
                  const isDraft = statusStr.includes('DRAFT');
                  const isPending = statusStr.includes('SUBMIT') || statusStr.includes('PENDING') || statusStr.includes('REVIEW');
                  const pct = variancePct(rev);
                  const nature = getChangeNature(rev);
                  const isDropup = idx > 0 && idx >= filteredVariations.length - 2;

                  return (
                    <tr key={rev.id || idx} className="hover:bg-surface-muted/30 transition-colors">
                      <td className="px-3 py-2 text-center text-text-muted text-[11px]">{idx + 1}</td>

                      {/* VO Reference */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${variance > 0 ? 'bg-emerald-100 text-emerald-600' : variance < 0 ? 'bg-rose-100 text-rose-600' : 'bg-surface-muted text-text-muted'}`}>
                            {variance > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : variance < 0 ? <ArrowDownRight className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <div className="font-mono font-bold text-primary text-[12px]">
                              VO-{String(rev.revision_no || idx + 1).padStart(3, '0')}
                            </div>
                            <div className="text-[10px] text-text-muted font-mono">
                              {rev.revision_date ? rev.revision_date.split('T')[0] : '—'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Budget & Project */}
                      <td className="px-3 py-2">
                        <div className="font-mono font-semibold text-text-primary text-[11px]">{rev.budget_code}</div>
                        <div className="text-[10px] text-text-secondary truncate max-w-[140px]" title={rev.project_name}>
                          {rev.project_name || '—'}
                        </div>
                      </td>

                      {/* Change Classification */}
                      <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-semibold ${nature.color}`}>
                          {nature.label}
                        </span>
                      </td>

                      {/* Reason */}
                      <td className="px-3 py-2 text-text-primary max-w-xs">
                        <p className="truncate text-[11px]" title={rev.reason}>{rev.reason || '—'}</p>
                      </td>

                      {/* Previous Total */}
                      <td className="px-3 py-2 text-right font-mono text-text-secondary text-[11px]">
                        {INR(rev.previous_total)}
                      </td>

                      {/* Revised Total */}
                      <td className="px-3 py-2 text-right font-mono font-bold text-text-primary text-[11px]">
                        {INR(rev.revised_total)}
                      </td>

                      {/* Variance Quantum */}
                      <td className={`px-3 py-2 text-right font-mono font-bold text-[11px] ${variance > 0 ? 'text-emerald-600' : variance < 0 ? 'text-rose-600' : 'text-text-muted'}`}>
                        {variance > 0 ? '+' : ''}{INR(variance)}
                      </td>

                      {/* % Impact */}
                      <td className="px-3 py-2 text-center">
                        <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                          variance > 0 ? 'bg-emerald-50 text-emerald-700' : variance < 0 ? 'bg-rose-50 text-rose-700' : 'bg-surface-muted text-text-muted'
                        }`}>
                          {variance > 0 ? '+' : ''}{pct}%
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2 text-center">
                        <Badge
                          variant={getVariant(statusStr)}
                          className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 inline-flex items-center"
                        >
                          {rev.status_name || statusStr}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[11px] text-primary hover:text-primary-dark font-medium"
                            leftIcon={<Eye className="w-3.5 h-3.5" />}
                            onClick={() => setViewingRevision({ budgetId: rev.budget_id, revisionId: rev.id })}
                            title="View VO Details"
                          >
                            View
                          </Button>

                          {/* Context menu for submit/approve/reject/delete */}
                          <div className={`relative ${activeMenuId === rev.id ? 'z-40' : ''}`}>
                            <button
                              type="button"
                              className="p-1 rounded hover:bg-surface-muted text-text-muted hover:text-text-primary transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === rev.id ? null : rev.id);
                              }}
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {activeMenuId === rev.id && (
                              <div
                                ref={menuRef}
                                className={`absolute right-0 ${
                                  isDropup ? 'bottom-full mb-1' : 'top-full mt-1'
                                } w-44 bg-surface border border-border rounded-md shadow-lg z-50 py-1 text-left animate-in fade-in zoom-in-95 duration-100`}
                              >
                                <button
                                  type="button"
                                  className="w-full px-3 py-1.5 text-xs text-text-primary hover:bg-surface-muted flex items-center gap-2"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setViewingRevision({ budgetId: rev.budget_id, revisionId: rev.id });
                                  }}
                                >
                                  <Eye className="w-3.5 h-3.5 text-primary" />
                                  <span>View Details</span>
                                </button>

                                {isDraft && hasPermission('budget.revise') && (
                                  <button
                                    type="button"
                                    className="w-full px-3 py-1.5 text-xs text-primary hover:bg-primary/10 flex items-center gap-2 font-medium"
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      setConfirmAction({ type: 'submit', item: rev });
                                    }}
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>Submit for Review</span>
                                  </button>
                                )}

                                {isPending && hasPermission('budget.approve') && (
                                  <>
                                    <button
                                      type="button"
                                      className="w-full px-3 py-1.5 text-xs text-emerald-600 hover:bg-emerald-50 flex items-center gap-2 font-medium"
                                      onClick={() => {
                                        setActiveMenuId(null);
                                        setConfirmAction({ type: 'approve', item: rev });
                                      }}
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Approve Variation</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="w-full px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium"
                                      onClick={() => {
                                        setActiveMenuId(null);
                                        setConfirmAction({ type: 'reject', item: rev });
                                      }}
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                      <span>Reject Variation</span>
                                    </button>
                                  </>
                                )}

                                {isDraft && hasPermission('budget.revise') && (
                                  <button
                                    type="button"
                                    className="w-full px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 border-t border-border mt-1"
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      setConfirmAction({ type: 'delete', item: rev });
                                    }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete Draft</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Mobile View: Cards */}
        <div className="sm:hidden flex flex-col gap-2.5">
          {loading ? (
            <div className="py-12 text-center text-text-muted text-xs bg-surface border border-border rounded-lg">
              Loading variation orders...
            </div>
          ) : filteredVariations.length === 0 ? (
            <div className="py-12 text-center text-text-muted text-xs bg-surface border border-border rounded-lg">
              No variation orders found.
            </div>
          ) : (
            filteredVariations.map((rev) => {
              const variance = Number(rev.variance_amount || 0);
              const statusStr = String(rev.status_code || rev.status_name || rev.status || 'DRAFT').toUpperCase();
              const isDraft = statusStr.includes('DRAFT');
              const isPending = statusStr.includes('SUBMIT') || statusStr.includes('PENDING') || statusStr.includes('REVIEW');
              const pct = variancePct(rev);
              const nature = getChangeNature(rev);

              return (
                <div key={rev.id} className="border border-border rounded-lg bg-surface p-3 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-primary text-xs">
                        VO-{String(rev.revision_no || '').padStart(3, '0')}
                      </span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border ${nature.color}`}>
                        {nature.label}
                      </span>
                    </div>
                    <Badge
                      variant={getVariant(statusStr)}
                      className="text-[8px] font-bold uppercase tracking-wider h-4 px-1.5 inline-flex items-center leading-none shrink-0"
                    >
                      {rev.status_name || statusStr}
                    </Badge>
                  </div>
                  <div className="text-xs">
                    <div className="font-mono font-medium text-text-primary">{rev.budget_code}</div>
                    <div className="text-text-secondary text-[11px]">{rev.project_name}</div>
                  </div>
                  <div className="text-[11px] text-text-primary bg-surface-muted/50 p-2 rounded">
                    {rev.reason || 'No description provided'}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px] border-t border-border pt-2">
                    <div>
                      <div className="text-text-muted">Pre-Order</div>
                      <div className="font-mono font-semibold">{INR(rev.previous_total)}</div>
                    </div>
                    <div>
                      <div className="text-text-muted">Quantum</div>
                      <div className={`font-mono font-bold ${variance > 0 ? 'text-emerald-600' : variance < 0 ? 'text-rose-600' : 'text-text-muted'}`}>
                        {variance > 0 ? '+' : ''}{INR(variance)}
                      </div>
                    </div>
                    <div>
                      <div className="text-text-muted">Revised</div>
                      <div className="font-mono font-bold text-primary">{INR(rev.revised_total)}</div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border flex items-center justify-end">
                    <Button
                      variant="primary"
                      size="sm"
                      className="text-xs h-7 w-full"
                      onClick={() => setViewingRevision({ budgetId: rev.budget_id, revisionId: rev.id })}
                    >
                      View
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Create Variation Order Modal */}
      <BudgetRevisionFormModal
        isOpen={isCreateOpen}
        mode="variation"
        onClose={() => setIsCreateOpen(false)}
        onSaveSuccess={() => {
          setIsCreateOpen(false);
          refresh();
        }}
      />

      {/* Variation Detail Modal */}
      {viewingRevision && (
        <BudgetRevisionDetailModal
          isOpen={Boolean(viewingRevision)}
          budgetId={viewingRevision.budgetId}
          revisionId={viewingRevision.revisionId}
          mode="variation"
          onClose={() => setViewingRevision(null)}
          onRefresh={refresh}
        />
      )}

      {/* Workflow Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-lg shadow-2xl w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-text-primary capitalize">
              {confirmAction.type === 'submit' && 'Submit Variation Order for Approval'}
              {confirmAction.type === 'approve' && 'Approve Variation Order'}
              {confirmAction.type === 'reject' && 'Reject Variation Order'}
              {confirmAction.type === 'delete' && 'Delete Draft Variation Order'}
            </h3>
            <p className="text-xs text-text-secondary">
              {confirmAction.type === 'submit' && 'Submit this variation order for management review. Baseline changes will become locked until approved.'}
              {confirmAction.type === 'approve' && 'Approving this variation will immediately recalculate and replace the active project budget baseline.'}
              {confirmAction.type === 'reject' && 'Provide a reason for rejecting this proposed budget variation.'}
              {confirmAction.type === 'delete' && 'Are you sure you want to delete this draft variation order? This action cannot be undone.'}
            </p>

            {confirmAction.type !== 'delete' && (
              <FormField label={confirmAction.type === 'reject' ? 'Rejection Reason (Required)' : 'Remarks (Optional)'}>
                <textarea
                  value={actionComments}
                  onChange={(e) => setActionComments(e.target.value)}
                  placeholder="Enter remarks or justification..."
                  rows={3}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </FormField>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => { setConfirmAction(null); setActionComments(''); }}
              >
                Cancel
              </Button>
              <Button
                variant={confirmAction.type === 'delete' || confirmAction.type === 'reject' ? 'danger' : 'primary'}
                size="sm"
                className="h-8 text-xs"
                disabled={actionSubmitting || (confirmAction.type === 'reject' && !actionComments.trim())}
                onClick={handleConfirmAction}
              >
                {actionSubmitting ? 'Processing...' : (
                  confirmAction.type === 'submit' ? 'Confirm Submit' : (confirmAction.type === 'approve' ? 'Confirm Approval' : (confirmAction.type === 'reject' ? 'Confirm Reject' : 'Confirm Delete'))
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

export default BudgetVariationsPage;
