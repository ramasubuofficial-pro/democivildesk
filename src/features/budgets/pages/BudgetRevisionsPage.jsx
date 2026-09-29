import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Layers,
  CheckCircle2,
  Clock,
  IndianRupee,
  Plus,
  RotateCcw,
  Eye,
  MoreVertical,
  Check,
  XCircle,
  Trash2,
  Send,
  TrendingUp,
  ShieldCheck,
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

export function BudgetRevisionsPage() {
  const { hasPermission } = useAuth();
  const [projects, setProjects] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [revisions, setRevisions] = useState([]);
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
  const [viewingRevision, setViewingRevision] = useState(null); // { budgetId, revisionId }
  const [activeMenuId, setActiveMenuId] = useState(null);
  const menuRef = useRef(null);

  // Workflow confirmation dialog
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'submit'|'approve'|'reject'|'delete', item: rev }
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

  // Unified, resilient data loader for Projects, Budgets, and Revisions
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

        // Filter budgets eligible for baseline revisions (APPROVED or have revisions)
        const eligibleBudgets = (Array.isArray(rawBudgets) ? rawBudgets : []).filter((b) => {
          const s = String(b.status_code || b.status_name || b.status || '').toUpperCase();
          return s === 'APPROVED' || (b.revision_count && Number(b.revision_count) > 0);
        });

        // Parallel fetch revisions for each eligible budget
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
              original_budget_amount: Number(b.total_budget || 0),
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

        setRevisions(flattened);
      } catch (err) {
        console.error('Error fetching baseline revisions:', err);
        if (isMounted) setRevisions([]);
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

  // Filter and search revisions
  const filteredRevisions = useMemo(() => {
    return revisions.filter((rev) => {
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
        const no = `rev-${String(rev.revision_no || '').padStart(2, '0')}`.toLowerCase();
        const code = String(rev.budget_code || '').toLowerCase();
        const name = String(rev.budget_name || '').toLowerCase();
        const reason = String(rev.reason || '').toLowerCase();
        const prj = String(rev.project_name || '').toLowerCase();
        if (!no.includes(q) && !code.includes(q) && !name.includes(q) && !reason.includes(q) && !prj.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [revisions, filters, searchQuery]);

  // Baseline KPIs
  const kpis = useMemo(() => {
    let draft = 0;
    let submitted = 0;
    let approved = 0;
    let totalVariance = 0;

    revisions.forEach((rev) => {
      const s = String(rev.status_code || rev.status_name || rev.status || '').toLowerCase();
      const variance = Number(rev.variance_amount || 0);
      if (s.includes('approv')) {
        approved++;
        totalVariance += variance;
      } else if (s.includes('submit') || s.includes('pending') || s.includes('review')) {
        submitted++;
      } else if (s.includes('draft')) {
        draft++;
      }
    });

    const activeBaselinesCount = budgets.filter((b) => {
      const s = String(b.status_code || b.status_name || b.status || '').toUpperCase();
      return s === 'APPROVED' || (b.revision_count && Number(b.revision_count) > 0);
    }).length;

    return {
      activeBaselinesCount,
      totalRevisions: revisions.length,
      approvedRevisions: approved,
      pendingApproval: submitted,
      draftCount: draft,
      totalVariance,
    };
  }, [revisions, budgets]);

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

  // Status badge variant
  const getVariant = (s) => {
    const v = String(s || '').toUpperCase();
    if (v.includes('APPROV')) return 'success';
    if (v.includes('SUBMIT') || v.includes('PENDING') || v.includes('REVIEW')) return 'warning';
    if (v.includes('REJECT')) return 'error';
    return 'neutral';
  };

  // Workflow confirmation execution
  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, item } = confirmAction;
    setActionSubmitting(true);
    try {
      if (type === 'submit') {
        await budgetsApi.revisions.submit(item.budget_id, item.id, { comments: actionComments || undefined });
        toast.success('Budget baseline revision submitted for approval.');
      } else if (type === 'approve') {
        await budgetsApi.revisions.approve(item.budget_id, item.id, { comments: actionComments || undefined });
        toast.success('Budget baseline revision approved. Active project cost baseline updated.');
      } else if (type === 'reject') {
        if (!actionComments.trim()) {
          toast.error('Rejection comments are required.');
          setActionSubmitting(false);
          return;
        }
        await budgetsApi.revisions.reject(item.budget_id, item.id, { comments: actionComments });
        toast.success('Budget baseline revision rejected.');
      } else if (type === 'delete') {
        await budgetsApi.revisions.remove(item.budget_id, item.id);
        toast.success('Draft baseline revision deleted.');
      }
      setConfirmAction(null);
      setActionComments('');
      refresh();
    } catch (err) {
      toast.error(err?.message || `Failed to ${type} budget revision.`);
    } finally {
      setActionSubmitting(false);
    }
  };

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'BOQ & Project Budget', href: '/budgets' },
    { label: 'Budget Revisions' },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Project Budget Revisions & Baseline Versions"
        breadcrumbs={breadcrumbs}
        description="Govern project cost baseline revisions, track version evolution (V0 -> Rev 1 -> Rev 2), and audit baseline adjustments across cost heads."
      />

      <div className="flex flex-col gap-3 sm:gap-4 w-full">
        {/* KPI Summary Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <KpiCard
            label="Active Project Baselines"
            value={kpis.activeBaselinesCount}
            status="primary"
            icon={<ShieldCheck className="w-4 h-4 text-primary" />}
          />
          <KpiCard
            label="Approved Baseline Versions"
            value={kpis.approvedRevisions}
            status="success"
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          />
          <KpiCard
            label="Pending Baseline Locks"
            value={kpis.pendingApproval}
            status="warning"
            icon={<Clock className="w-4 h-4 text-amber-500" />}
          />
          <KpiCard
            label="Cumulative Baseline Shift"
            value={`${kpis.totalVariance >= 0 ? '+' : ''}₹${(kpis.totalVariance / 100000).toFixed(1)} L`}
            status={kpis.totalVariance >= 0 ? 'success' : 'neutral'}
            icon={<TrendingUp className="w-4 h-4 text-sky-500" />}
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
                  { value: 'draft', label: 'Draft Versions' },
                  { value: 'submitted', label: 'Pending Baseline Lock' },
                  { value: 'approved', label: 'Approved Baselines' },
                  { value: 'rejected', label: 'Rejected Versions' },
                ]}
                value={filters.status}
                onChange={(value) => setFilters((c) => ({ ...c, status: value }))}
              />
            </div>

            <div className="w-full sm:w-56">
              <SearchField
                placeholder="Search rev no, budget, rationale..."
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
                Create Revision
              </Button>
            )}
          </div>
        </div>

        {/* Revisions Version Register - Desktop View */}
        <div className="hidden sm:block border border-border rounded-lg bg-surface shadow-xs">
          {loading ? (
            <div className="py-16 text-center text-text-muted text-xs">Loading project budget revisions...</div>
          ) : filteredRevisions.length === 0 ? (
            <div className="py-16 text-center text-text-muted text-xs">
              No budget baseline revisions found matching the selected criteria.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-muted text-text-secondary text-[11px] uppercase font-semibold border-b border-border tracking-wider">
                <tr>
                  <th className="px-3 py-2 w-10 text-center rounded-tl-lg">#</th>
                  <th className="px-3 py-2">Baseline Version</th>
                  <th className="px-3 py-2">Parent Budget & Project</th>
                  <th className="px-3 py-2">Effective Date</th>
                  <th className="px-3 py-2">Baseline Revision Rationale</th>
                  <th className="px-3 py-2 text-right">Previous Baseline</th>
                  <th className="px-3 py-2 text-right">Net Baseline Shift</th>
                  <th className="px-3 py-2 text-right">Revised Baseline</th>
                  <th className="px-3 py-2 text-center w-28">Baseline Status</th>
                  <th className="px-3 py-2 w-28 text-center rounded-tr-lg">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRevisions.map((rev, idx) => {
                  const variance = Number(rev.variance_amount || 0);
                  const statusStr = String(rev.status_code || rev.status_name || rev.status || 'DRAFT').toUpperCase();
                  const isDraft = statusStr.includes('DRAFT');
                  const isPending = statusStr.includes('SUBMIT') || statusStr.includes('PENDING') || statusStr.includes('REVIEW');
                  const isApproved = statusStr.includes('APPROV');

                  const prevTotal = Number(rev.previous_total || 0);
                  const pct = prevTotal > 0 ? (variance / prevTotal) * 100 : 0;
                  const isDropup = idx > 0 && idx >= filteredRevisions.length - 2;

                  return (
                    <tr key={rev.id || idx} className="hover:bg-surface-muted/30 transition-colors">
                      <td className="px-3 py-2 text-center text-text-muted text-[11px]">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-text-primary text-[12px]">
                            REV-{String(rev.revision_no || idx + 1).padStart(2, '0')}
                          </span>
                          {isApproved && (
                            <span className="bg-emerald-100 text-emerald-700 text-[9px] px-1.5 py-0.2 rounded font-semibold">
                              v{rev.revision_no}.0 Active
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-mono font-semibold text-text-primary text-[11px]">{rev.budget_code}</div>
                        <div className="text-[11px] text-text-secondary truncate max-w-[150px]" title={rev.project_name}>
                          {rev.project_name || '—'}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-text-secondary font-mono text-[11px]">
                        {rev.revision_date ? rev.revision_date.split('T')[0] : '—'}
                      </td>
                      <td className="px-3 py-2 text-text-primary max-w-xs">
                        <p className="truncate text-[11px]" title={rev.reason}>
                          {rev.reason || '—'}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-text-secondary">
                        ₹{prevTotal.toLocaleString('en-IN')}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono font-bold ${variance > 0 ? 'text-emerald-600' : variance < 0 ? 'text-rose-600' : 'text-text-muted'}`}>
                        <div>
                          {variance > 0 ? '+' : ''}₹{variance.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] font-normal text-text-muted">
                          {variance > 0 ? '+' : ''}{pct.toFixed(1)}%
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-text-primary">
                        ₹{Number(rev.revised_total || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge
                          variant={getVariant(statusStr)}
                          className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 inline-flex items-center"
                        >
                          {rev.status_name || statusStr}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[11px] text-primary hover:text-primary-dark font-medium"
                            leftIcon={<Eye className="w-3.5 h-3.5" />}
                            onClick={() => setViewingRevision({ budgetId: rev.budget_id, revisionId: rev.id })}
                            title="View baseline details"
                          >
                            View
                          </Button>

                          {/* Action context menu */}
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
                                    <span>Submit for Lock</span>
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
                                      <span>Approve Baseline</span>
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
                                      <span>Reject Revision</span>
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
              Loading budget revisions...
            </div>
          ) : filteredRevisions.length === 0 ? (
            <div className="py-12 text-center text-text-muted text-xs bg-surface border border-border rounded-lg">
              No budget baseline revisions found.
            </div>
          ) : (
            filteredRevisions.map((rev) => {
              const variance = Number(rev.variance_amount || 0);
              const statusStr = String(rev.status_code || rev.status_name || rev.status || 'DRAFT').toUpperCase();
              return (
                <div key={rev.id} className="border border-border rounded-lg bg-surface p-3 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-text-primary text-xs">
                      REV-{String(rev.revision_no || '').padStart(2, '0')}
                    </span>
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
                      <div className="text-text-muted">Prev Baseline</div>
                      <div className="font-mono font-semibold">₹{Number(rev.previous_total || 0).toLocaleString('en-IN')}</div>
                    </div>
                    <div>
                      <div className="text-text-muted">Net Shift</div>
                      <div className={`font-mono font-bold ${variance > 0 ? 'text-emerald-600' : variance < 0 ? 'text-rose-600' : 'text-text-muted'}`}>
                        {variance > 0 ? '+' : ''}₹{variance.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div>
                      <div className="text-text-muted">New Baseline</div>
                      <div className="font-mono font-bold text-primary">₹{Number(rev.revised_total || 0).toLocaleString('en-IN')}</div>
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

      {/* Create Revision Modal */}
      <BudgetRevisionFormModal
        isOpen={isCreateOpen}
        mode="revision"
        onClose={() => setIsCreateOpen(false)}
        onSaveSuccess={() => {
          setIsCreateOpen(false);
          refresh();
        }}
      />

      {/* Baseline Revision Comparison Modal */}
      {viewingRevision && (
        <BudgetRevisionDetailModal
          isOpen={Boolean(viewingRevision)}
          budgetId={viewingRevision.budgetId}
          revisionId={viewingRevision.revisionId}
          mode="revision"
          onClose={() => setViewingRevision(null)}
          onRefresh={refresh}
        />
      )}

      {/* Workflow Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-lg shadow-2xl w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-text-primary capitalize">
              {confirmAction.type === 'submit' && 'Submit Baseline Revision for Approval'}
              {confirmAction.type === 'approve' && 'Approve Baseline Revision'}
              {confirmAction.type === 'reject' && 'Reject Baseline Revision'}
              {confirmAction.type === 'delete' && 'Delete Draft Baseline Revision'}
            </h3>
            <p className="text-xs text-text-secondary">
              {confirmAction.type === 'submit' && 'Submit this baseline revision for management review. Previous baseline will remain active until approved.'}
              {confirmAction.type === 'approve' && 'Approving this revision will replace the project budget active cost baseline with this revised baseline.'}
              {confirmAction.type === 'reject' && 'Provide a reason for rejecting this proposed baseline revision.'}
              {confirmAction.type === 'delete' && 'Are you sure you want to delete this draft revision? This action cannot be undone.'}
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

export default BudgetRevisionsPage;
