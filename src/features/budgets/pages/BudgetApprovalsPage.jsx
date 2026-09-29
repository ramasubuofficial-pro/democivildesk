import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldCheck, CheckCircle2, Clock, XCircle, Send,
  Eye, RefreshCw, Filter, Search, IndianRupee,
  Layers, AlertTriangle, FileText, Check, ArrowRight,
  TrendingUp, TrendingDown, Calendar, Building,
  History, AlertCircle, X, ChevronRight, Hash, UserCheck, RotateCcw
} from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageContainer } from '../../../components/layout/PageContainer';
import { DataTableContainer } from '../../../components/composite/DataTableContainer';
import { Pagination } from '../../../components/composite/Pagination';
import { SearchField } from '../../../components/composite/SearchField';
import { KpiCard } from '../../../components/composite/KpiCard';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { toast } from '../../../components/composite/Toast';
import { budgetsApi, projectsApi } from '../../../api/apiservice';
import { useAuth } from '../../auth/context/AuthContext';

const formatINR = (val) => {
  const num = Number(val || 0);
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

const formatLakhs = (val) => {
  const num = Number(val || 0);
  return `₹${(num / 100000).toFixed(2)}L`;
};

const getStatusBadgeVariant = (status) => {
  const s = String(status || '').toLowerCase();
  if (s.includes('approved')) return 'success';
  if (s.includes('review') || s.includes('submitted') || s.includes('pending')) return 'warning';
  if (s.includes('rejected')) return 'error';
  return 'neutral';
};

export function BudgetApprovalsPage() {
  const { user, hasPermission } = useAuth();
  const isAdmin = Boolean(user?.is_super_admin) || String(user?.role_name || user?.role || '').toLowerCase().includes('admin');
  const canApprove = isAdmin || hasPermission('budget.approve');
  const canSubmit = isAdmin || hasPermission('budget.submit');

  // Loading and refreshing states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Core Data
  const [projects, setProjects] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [revisions, setRevisions] = useState([]);

  // Active Tab: 'initial' (Project Budgets) | 'revisions' (Budget Revisions & Variations) | 'history' (Audit Log)
  const [activeTab, setActiveTab] = useState('initial');

  // Filter States
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Review & Dossier Modal State
  const [viewingBudget, setViewingBudget] = useState(null);
  const [budgetLines, setBudgetLines] = useState([]);
  const [budgetHistory, setBudgetHistory] = useState({ approvals: [], status_logs: [] });
  const [loadingModalData, setLoadingModalData] = useState(false);

  // Revision Review Modal State
  const [viewingRevision, setViewingRevision] = useState(null);
  const [revisionLines, setRevisionLines] = useState([]);
  const [revisionHistory, setRevisionHistory] = useState({ approvals: [], status_logs: [] });
  const [loadingRevisionModal, setLoadingRevisionModal] = useState(false);

  // Workflow Confirmation Modal (Submit / Approve / Reject)
  const [actionDialog, setActionDialog] = useState(null); // { target: item, targetType: 'budget'|'revision', action: 'submit'|'approve'|'reject' }
  const [actionComments, setActionComments] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Load all live budgets, projects, and revisions from backend
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [projRes, budgetsRes] = await Promise.allSettled([
        projectsApi.list(),
        budgetsApi.list()
      ]);

      // 1. Projects
      let pData = [];
      if (projRes.status === 'fulfilled') {
        pData = projRes.value?.data?.projects ?? projRes.value?.projects ?? (Array.isArray(projRes.value?.data) ? projRes.value.data : []);
        setProjects(Array.isArray(pData) ? pData : []);
      }

      // 2. Project Budgets
      let bData = [];
      if (budgetsRes.status === 'fulfilled') {
        bData = budgetsRes.value?.data?.project_budgets ?? (Array.isArray(budgetsRes.value?.data) ? budgetsRes.value.data : []);
        setBudgets(Array.isArray(bData) ? bData : []);

        // 3. Fetch Revisions for all budgets that exist
        if (bData.length > 0) {
          try {
            const revPromises = bData.map((b) =>
              budgetsApi.revisions.list(b.id).catch(() => ({ data: { budget_revisions: [] } }))
            );
            const revResults = await Promise.all(revPromises);
            const allRevs = [];
            revResults.forEach((res, idx) => {
              const rList = res?.data?.budget_revisions ?? res?.budget_revisions ?? [];
              if (Array.isArray(rList)) {
                rList.forEach((r) => {
                  allRevs.push({
                    ...r,
                    parent_budget_code: bData[idx].budget_code,
                    parent_budget_name: bData[idx].budget_name,
                    project_name: bData[idx].project_name || r.project_name
                  });
                });
              }
            });
            setRevisions(allRevs);
          } catch {
            setRevisions([]);
          }
        } else {
          setRevisions([]);
        }
      }

      if (isRefresh) {
        toast.success('Budget approval queue refreshed.');
      }
    } catch (err) {
      console.error('Failed to load budget approvals', err);
      toast.error('Unable to fetch budget approvals data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset pagination on filter or tab change
  useEffect(() => {
    setPage(1);
  }, [selectedProjectId, statusFilter, search, activeTab]);

  // KPI Calculations
  const kpis = useMemo(() => {
    const pendingBudgets = budgets.filter((b) => (b.status_code || '').toUpperCase() === 'SUBMITTED');
    const approvedBudgets = budgets.filter((b) => (b.status_code || '').toUpperCase() === 'APPROVED');
    const draftBudgets = budgets.filter((b) => (b.status_code || '').toUpperCase() === 'DRAFT');
    const rejectedBudgets = budgets.filter((b) => (b.status_code || '').toUpperCase() === 'REJECTED');

    const pendingRevs = revisions.filter((r) => (r.status_code || '').toUpperCase() === 'SUBMITTED');
    const totalPendingCount = pendingBudgets.length + pendingRevs.length;

    const underReviewAmount = pendingBudgets.reduce((acc, b) => acc + Number(b.total_budget || 0), 0) +
      pendingRevs.reduce((acc, r) => acc + Number(r.revised_total || 0), 0);

    const approvedAmount = approvedBudgets.reduce((acc, b) => acc + Number(b.total_budget || 0), 0);

    return {
      pendingCount: totalPendingCount,
      pendingBudgetsCount: pendingBudgets.length,
      pendingRevsCount: pendingRevs.length,
      approvedCount: approvedBudgets.length,
      approvedAmount,
      underReviewAmount,
      rejectedCount: rejectedBudgets.length,
      draftCount: draftBudgets.length
    };
  }, [budgets, revisions]);

  // Open 360 Review Dossier for a Budget
  const handleOpenReview = async (item) => {
    setViewingBudget(item);
    setLoadingModalData(true);
    try {
      const [linesRes, historyRes] = await Promise.allSettled([
        budgetsApi.lines.list(item.id),
        budgetsApi.approvalHistory(item.id)
      ]);

      if (linesRes.status === 'fulfilled') {
        const lData = linesRes.value?.data?.budget_lines ?? [];
        setBudgetLines(Array.isArray(lData) ? lData : []);
      } else {
        setBudgetLines([]);
      }

      if (historyRes.status === 'fulfilled') {
        const hData = historyRes.value?.data ?? {};
        setBudgetHistory({
          approvals: Array.isArray(hData.approvals) ? hData.approvals : [],
          status_logs: Array.isArray(hData.status_logs) ? hData.status_logs : []
        });
      } else {
        setBudgetHistory({ approvals: [], status_logs: [] });
      }
    } catch (err) {
      console.error('Failed to load budget review details', err);
      toast.error('Unable to fetch budget line items.');
    } finally {
      setLoadingModalData(false);
    }
  };

  // Open Review for a Revision
  const handleOpenRevisionReview = async (rev) => {
    setViewingRevision(rev);
    setLoadingRevisionModal(true);
    try {
      const [revDetailRes, revHistRes] = await Promise.allSettled([
        budgetsApi.revisions.get(rev.budget_id, rev.id),
        budgetsApi.revisions.history(rev.budget_id, rev.id)
      ]);

      if (revDetailRes.status === 'fulfilled') {
        const lines = revDetailRes.value?.data?.revision_lines ?? [];
        setRevisionLines(Array.isArray(lines) ? lines : []);
      } else {
        setRevisionLines([]);
      }

      if (revHistRes.status === 'fulfilled') {
        const hData = revHistRes.value?.data ?? {};
        setRevisionHistory({
          approvals: Array.isArray(hData.approvals) ? hData.approvals : [],
          status_logs: Array.isArray(hData.status_logs) ? hData.status_logs : []
        });
      } else {
        setRevisionHistory({ approvals: [], status_logs: [] });
      }
    } catch (err) {
      console.error('Failed to load revision details', err);
      toast.error('Unable to fetch revision details.');
    } finally {
      setLoadingRevisionModal(false);
    }
  };

  // Open confirmation action dialog
  const handleInitiateAction = (item, targetType, action) => {
    setActionDialog({
      target: item,
      targetType,
      action
    });
    setActionComments('');
  };

  // Execute workflow action (submit, approve, reject)
  const handleExecuteAction = async (e) => {
    e.preventDefault();
    if (!actionDialog) return;

    const { target, targetType, action } = actionDialog;

    // Reject requires a comment/reason
    if (action === 'reject' && !actionComments.trim()) {
      toast.error('Please provide a reason or remarks for rejection.');
      return;
    }

    setActionSubmitting(true);
    try {
      const payload = { comments: actionComments.trim() };

      if (targetType === 'budget') {
        if (action === 'submit') {
          await budgetsApi.submit(target.id, payload);
          toast.success(`Budget ${target.budget_code} submitted for approval.`);
        } else if (action === 'approve') {
          await budgetsApi.approve(target.id, payload);
          toast.success(`Budget ${target.budget_code} has been approved.`);
        } else if (action === 'reject') {
          await budgetsApi.reject(target.id, payload);
          toast.warning(`Budget ${target.budget_code} has been rejected.`);
        }
      } else if (targetType === 'revision') {
        if (action === 'submit') {
          await budgetsApi.revisions.submit(target.budget_id, target.id, payload);
          toast.success(`Budget revision v${target.revision_no} submitted for approval.`);
        } else if (action === 'approve') {
          await budgetsApi.revisions.approve(target.budget_id, target.id, payload);
          toast.success(`Budget revision v${target.revision_no} has been approved.`);
        } else if (action === 'reject') {
          await budgetsApi.revisions.reject(target.budget_id, target.id, payload);
          toast.warning(`Budget revision v${target.revision_no} has been rejected.`);
        }
      }

      setActionDialog(null);
      setViewingBudget(null);
      setViewingRevision(null);
      loadData(true);
    } catch (err) {
      console.error(`Failed to ${action} budget`, err);
      toast.error(err?.message || `Failed to ${action} budget.`);
    } finally {
      setActionSubmitting(false);
    }
  };

  // Filtered Budgets List
  const filteredBudgets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return budgets.filter((b) => {
      if (selectedProjectId !== 'all' && String(b.project_id) !== String(selectedProjectId)) return false;

      const statusCode = (b.status_code || '').toUpperCase();
      const sf = (statusFilter || '').toUpperCase();
      if (sf !== 'ALL' && sf !== '') {
        if (sf === 'SUBMITTED' && statusCode !== 'SUBMITTED' && !statusCode.includes('PENDING') && !statusCode.includes('REVIEW')) return false;
        else if (sf !== 'SUBMITTED' && statusCode !== sf) return false;
      }

      if (q) {
        const matchCode = (b.budget_code || '').toLowerCase().includes(q);
        const matchName = (b.budget_name || '').toLowerCase().includes(q);
        const matchProj = (b.project_name || '').toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchProj) return false;
      }
      return true;
    });
  }, [budgets, selectedProjectId, statusFilter, search]);

  // Filtered Revisions List
  const filteredRevisions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return revisions.filter((r) => {
      if (selectedProjectId !== 'all' && String(r.project_id) !== String(selectedProjectId)) return false;

      const statusCode = (r.status_code || '').toUpperCase();
      const sf = (statusFilter || '').toUpperCase();
      if (sf !== 'ALL' && sf !== '') {
        if (sf === 'SUBMITTED' && statusCode !== 'SUBMITTED' && !statusCode.includes('PENDING') && !statusCode.includes('REVIEW')) return false;
        else if (sf !== 'SUBMITTED' && statusCode !== sf) return false;
      }

      if (q) {
        const matchReason = (r.reason || '').toLowerCase().includes(q);
        const matchParent = (r.parent_budget_code || '').toLowerCase().includes(q);
        const matchProj = (r.project_name || '').toLowerCase().includes(q);
        if (!matchReason && !matchParent && !matchProj) return false;
      }
      return true;
    });
  }, [revisions, selectedProjectId, statusFilter, search]);

  // Combined Audit Log List
  const combinedAuditLogs = useMemo(() => {
    const list = [];
    budgets.forEach((b) => {
      if (b.status_code === 'APPROVED' || b.status_code === 'SUBMITTED' || b.status_code === 'REJECTED') {
        list.push({
          id: `b-${b.id}`,
          document_type: 'Project Budget',
          code: b.budget_code,
          title: b.budget_name,
          project_name: b.project_name,
          amount: b.total_budget,
          status: b.status_code,
          status_name: b.status_name,
          date: b.updated_at || b.budget_date,
          user: b.updated_by_name || 'System User',
          raw: b
        });
      }
    });

    revisions.forEach((r) => {
      list.push({
        id: `r-${r.id}`,
        document_type: 'Budget Revision',
        code: `Rev #${r.revision_no} (${r.parent_budget_code || 'BDG'})`,
        title: r.reason,
        project_name: r.project_name,
        amount: r.revised_total,
        status: r.status_code,
        status_name: r.status_name,
        date: r.revision_date || r.updated_at,
        user: r.requested_by_name || 'Project Lead',
        raw: r
      });
    });

    return list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [budgets, revisions]);

  // Pagination Slice
  const currentDataset = activeTab === 'initial' ? filteredBudgets : activeTab === 'revisions' ? filteredRevisions : combinedAuditLogs;
  const totalPages = Math.max(1, Math.ceil(currentDataset.length / perPage));
  const pagedItems = currentDataset.slice((page - 1) * perPage, page * perPage);

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'BOQ & Project Budget', href: '/budgets' },
    { label: 'Budget Approval & Governance' }
  ];

  const hasActiveFilters = Boolean(
    (selectedProjectId && selectedProjectId !== 'all') ||
    (statusFilter && statusFilter !== 'all') ||
    search
  );

  const resetFilters = () => {
    setSelectedProjectId('all');
    setStatusFilter('all');
    setSearch('');
    setPage(1);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Budget Approval & Governance"
        breadcrumbs={breadcrumbs}
      />

      <div className="flex flex-col gap-3 sm:gap-4 w-full">
        {/* KPI Summary Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <KpiCard
            label="Pending Clearance"
            value={loading ? '...' : kpis.pendingCount}
            status={kpis.pendingCount > 0 ? 'warning' : 'success'}
            icon={<Clock className="w-4 h-4 text-amber-500" />}
          />
          <KpiCard
            label="Total Approved Baselines"
            value={loading ? '...' : kpis.approvedCount}
            status="success"
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          />
          <KpiCard
            label="Budget Value Under Review"
            value={loading ? '...' : formatLakhs(kpis.underReviewAmount)}
            status="neutral"
            icon={<IndianRupee className="w-4 h-4 text-sky-500" />}
          />
          <KpiCard
            label="Approved Baseline Total"
            value={loading ? '...' : formatLakhs(kpis.approvedAmount)}
            status="primary"
            icon={<ShieldCheck className="w-4 h-4 text-primary" />}
          />
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border pb-1">
          <button
            onClick={() => setActiveTab('initial')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'initial'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Project Budgets ({budgets.length})
            {kpis.pendingBudgetsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-amber-400 text-slate-900 rounded-full text-[10px] font-bold">
                {kpis.pendingBudgetsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('revisions')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'revisions'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Revisions & Variations ({revisions.length})
            {kpis.pendingRevsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-amber-400 text-slate-900 rounded-full text-[10px] font-bold">
                {kpis.pendingRevsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Governance Audit Log ({combinedAuditLogs.length})
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Project Filter */}
            <div className="w-full sm:w-56">
              <Select
                options={[
                  { value: 'all', label: 'All Projects' },
                  ...projects.map((p) => ({
                    value: String(p.id),
                    label: p.project_name || p.name,
                  }))
                ]}
                value={selectedProjectId}
                onChange={(val) => {
                  setSelectedProjectId(val);
                  setPage(1);
                }}
                className="text-xs h-8"
              />
            </div>

            {/* Status Dropdown Filter */}
            {activeTab !== 'history' && (
              <div className="w-full sm:w-44">
                <Select
                  className="text-xs h-8"
                  options={[
                    { value: 'all', label: 'All Statuses' },
                    { value: 'SUBMITTED', label: 'Pending Review' },
                    { value: 'APPROVED', label: 'Approved' },
                    { value: 'DRAFT', label: 'Draft' },
                    { value: 'REJECTED', label: 'Rejected' },
                  ]}
                  value={statusFilter}
                  onChange={(val) => {
                    setStatusFilter(val);
                    setPage(1);
                  }}
                />
              </div>
            )}

            {/* Search Box */}
            <div className="w-full sm:w-60">
              <SearchField
                placeholder="Search budget, code, project..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
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
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />}
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="text-xs h-8 shadow-xs"
            >
              Sync
            </Button>
          </div>
        </div>

        {/* TAB 1: Initial Project Budgets Table */}
        {activeTab === 'initial' && (
          <div className="w-full">
            <DataTableContainer
              pagination={
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={filteredBudgets.length}
                  itemsPerPage={perPage}
                  onPageChange={setPage}
                  onItemsPerPageChange={() => {}}
                />
              }
            >
              <table className="w-full text-left text-[12px] table-auto">
                <thead className="bg-surface-muted text-text-secondary text-[11px] uppercase font-semibold border-b border-border tracking-wider">
                  <tr>
                    <th className="px-3 py-2 w-10 text-center">#</th>
                    <th className="px-3 py-2">Budget Code & Version</th>
                    <th className="px-3 py-2">Budget Name</th>
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2 text-center w-24">Date</th>
                    <th className="px-3 py-2 text-right w-28">Direct Cost</th>
                    <th className="px-3 py-2 text-right w-28 font-bold text-emerald-600">Total Budget</th>
                    <th className="px-3 py-2 text-center w-28">Status</th>
                    <th className="px-3 py-2 text-center w-40">Workflow Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan="9" className="text-center py-8 text-text-muted text-[12px]">
                        Loading budget approval queue from database...
                      </td>
                    </tr>
                  ) : pagedItems.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="text-center py-8 text-text-muted text-[12px]">
                        No budget approval records found matching current criteria.
                      </td>
                    </tr>
                  ) : (
                    pagedItems.map((b, idx) => {
                      const isSubmitted = (b.status_code || '').toUpperCase() === 'SUBMITTED';
                      const isDraft = (b.status_code || '').toUpperCase() === 'DRAFT';
                      const isApproved = (b.status_code || '').toUpperCase() === 'APPROVED';

                      return (
                        <tr key={b.id} className="hover:bg-surface-muted/30 transition-colors group">
                          <td className="px-3 py-2 text-center font-medium text-text-primary text-[11px]">
                            {(page - 1) * perPage + idx + 1}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col">
                              <span className="font-semibold text-text-primary font-mono text-[12px]">
                                {b.budget_code}
                              </span>
                              <span className="text-[10px] text-text-muted">
                                Version {b.version_no || 1}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className="font-medium text-text-primary text-[12px] block truncate max-w-[200px]" title={b.budget_name}>
                              {b.budget_name}
                            </span>
                            {b.source_boq_code && (
                              <span className="text-[10px] text-text-muted block">
                                Ref: {b.source_boq_code}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-[11px] text-text-primary truncate max-w-[150px]" title={b.project_name}>
                            {b.project_name || 'Civil Project'}
                          </td>
                          <td className="px-3 py-2 text-center font-mono text-[11px] text-text-muted">
                            {b.budget_date || 'N/A'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[11px] text-text-secondary">
                            {formatINR(b.direct_cost)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 text-[11px]">
                            {formatINR(b.total_budget)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Badge
                              variant={getStatusBadgeVariant(b.status_name || b.status_code)}
                              className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 inline-flex items-center"
                            >
                              {b.status_name || b.status_code}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* 360 Review Button */}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[11px] text-text-secondary hover:text-primary"
                                title="View Budget 360 Breakdown"
                                onClick={() => handleOpenReview(b)}
                              >
                                <Eye className="w-3.5 h-3.5 mr-1" /> Review
                              </Button>

                              {/* Quick Approve / Reject for Approver */}
                              {isSubmitted && canApprove && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-[11px] text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                                    title="Approve Budget"
                                    onClick={() => handleInitiateAction(b, 'budget', 'approve')}
                                  >
                                    <Check className="w-3.5 h-3.5 mr-0.5" /> Approve
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-[11px] text-red-600 border-red-500/30 hover:bg-red-50 dark:hover:bg-red-950/20"
                                    title="Reject Budget"
                                    onClick={() => handleInitiateAction(b, 'budget', 'reject')}
                                  >
                                    <X className="w-3.5 h-3.5 mr-0.5" /> Reject
                                  </Button>
                                </>
                              )}

                              {/* Quick Submit for Draft */}
                              {isDraft && canSubmit && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-[11px] text-sky-600 border-sky-500/30 hover:bg-sky-50"
                                  title="Submit for Approval"
                                  onClick={() => handleInitiateAction(b, 'budget', 'submit')}
                                >
                                  <Send className="w-3.5 h-3.5 mr-0.5" /> Submit
                                </Button>
                              )}

                              {isApproved && (
                                <span className="text-[10px] text-emerald-600 font-semibold flex items-center">
                                  <CheckCircle2 className="w-3 h-3 mr-0.5" /> Active
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </DataTableContainer>
          </div>
        )}

        {/* TAB 2: Budget Revisions & Variations Table */}
        {activeTab === 'revisions' && (
          <div className="w-full">
            <DataTableContainer
              pagination={
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={filteredRevisions.length}
                  itemsPerPage={perPage}
                  onPageChange={setPage}
                  onItemsPerPageChange={() => {}}
                />
              }
            >
              <table className="w-full text-left text-[12px] table-auto">
                <thead className="bg-surface-muted text-text-secondary text-[11px] uppercase font-semibold border-b border-border tracking-wider">
                  <tr>
                    <th className="px-3 py-2 w-10 text-center">#</th>
                    <th className="px-3 py-2">Revision & Parent</th>
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2">Reason / Scope Change</th>
                    <th className="px-3 py-2 text-center w-24">Date</th>
                    <th className="px-3 py-2 text-right w-28">Prev. Baseline</th>
                    <th className="px-3 py-2 text-right w-28 font-bold text-primary">Revised Total</th>
                    <th className="px-3 py-2 text-right w-24">Variance</th>
                    <th className="px-3 py-2 text-center w-28">Status</th>
                    <th className="px-3 py-2 text-center w-36">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan="10" className="text-center py-8 text-text-muted text-[12px]">
                        Loading budget revisions...
                      </td>
                    </tr>
                  ) : pagedItems.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="text-center py-8 text-text-muted text-[12px]">
                        No budget revision requests recorded.
                      </td>
                    </tr>
                  ) : (
                    pagedItems.map((r, idx) => {
                      const isSubmitted = (r.status_code || '').toUpperCase() === 'SUBMITTED';
                      const isDraft = (r.status_code || '').toUpperCase() === 'DRAFT';
                      const varAmt = Number(r.variance_amount || 0);

                      return (
                        <tr key={r.id} className="hover:bg-surface-muted/30 transition-colors group">
                          <td className="px-3 py-2 text-center font-medium text-text-primary text-[11px]">
                            {(page - 1) * perPage + idx + 1}
                          </td>
                          <td className="px-3 py-2">
                            <span className="font-semibold text-text-primary font-mono text-[12px] block">
                              Revision v{r.revision_no}
                            </span>
                            <span className="text-[10px] text-text-muted font-mono">
                              Budget: {r.parent_budget_code || 'BDG'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-[11px] text-text-primary truncate max-w-[140px]">
                            {r.project_name || 'Civil Project'}
                          </td>
                          <td className="px-3 py-2 text-[11px] text-text-primary max-w-[200px] truncate" title={r.reason}>
                            {r.reason || 'General variation update'}
                          </td>
                          <td className="px-3 py-2 text-center font-mono text-[11px] text-text-muted">
                            {r.revision_date || 'N/A'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[11px] text-text-secondary">
                            {formatINR(r.previous_total)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-primary text-[11px]">
                            {formatINR(r.revised_total)}
                          </td>
                          <td className={`px-3 py-2 text-right font-mono font-bold text-[11px] ${varAmt > 0 ? 'text-red-500' : varAmt < 0 ? 'text-emerald-500' : 'text-text-muted'}`}>
                            {varAmt > 0 ? `+${formatINR(varAmt)}` : formatINR(varAmt)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Badge
                              variant={getStatusBadgeVariant(r.status_name || r.status_code)}
                              className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 inline-flex items-center"
                            >
                              {r.status_name || r.status_code}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => handleOpenRevisionReview(r)}
                              >
                                <Eye className="w-3.5 h-3.5 mr-1" /> Review
                              </Button>

                              {isSubmitted && canApprove && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-[11px] text-emerald-600 border-emerald-500/30"
                                    onClick={() => handleInitiateAction(r, 'revision', 'approve')}
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-[11px] text-red-600 border-red-500/30"
                                    onClick={() => handleInitiateAction(r, 'revision', 'reject')}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </Button>
                                </>
                              )}

                              {isDraft && canSubmit && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-[11px] text-sky-600 border-sky-500/30"
                                  onClick={() => handleInitiateAction(r, 'revision', 'submit')}
                                >
                                  <Send className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </DataTableContainer>
          </div>
        )}

        {/* TAB 3: Governance Audit Log */}
        {activeTab === 'history' && (
          <div className="w-full">
            <DataTableContainer
              pagination={
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={combinedAuditLogs.length}
                  itemsPerPage={perPage}
                  onPageChange={setPage}
                  onItemsPerPageChange={() => {}}
                />
              }
            >
              <table className="w-full text-left text-[12px] table-auto">
                <thead className="bg-surface-muted text-text-secondary text-[11px] uppercase font-semibold border-b border-border tracking-wider">
                  <tr>
                    <th className="px-3 py-2 w-10 text-center">#</th>
                    <th className="px-3 py-2">Document Type</th>
                    <th className="px-3 py-2">Identifier & Name</th>
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2 text-right w-28">Amount</th>
                    <th className="px-3 py-2 text-center w-28">Status</th>
                    <th className="px-3 py-2 text-center w-32">Action Date</th>
                    <th className="px-3 py-2">Operated By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pagedItems.map((log, idx) => (
                    <tr key={log.id} className="hover:bg-surface-muted/30 transition-colors">
                      <td className="px-3 py-2 text-center font-medium text-text-primary text-[11px]">
                        {(page - 1) * perPage + idx + 1}
                      </td>
                      <td className="px-3 py-2 font-semibold text-text-primary text-[11px]">
                        <span className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-text-muted" />
                          {log.document_type}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-semibold text-text-primary font-mono text-[12px] block">
                          {log.code}
                        </span>
                        <span className="text-[10px] text-text-muted block truncate max-w-[200px]">
                          {log.title}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[11px] text-text-primary">
                        {log.project_name || 'Civil Project'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 text-[11px]">
                        {formatINR(log.amount)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge
                          variant={getStatusBadgeVariant(log.status)}
                          className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 inline-flex items-center"
                        >
                          {log.status_name || log.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-[11px] text-text-muted">
                        {log.date ? String(log.date).split(' ')[0] : 'N/A'}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-text-secondary">
                        <div className="flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-text-muted" />
                          {log.user}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableContainer>
          </div>
        )}
      </div>

      {/* ─── MODAL 1: BUDGET 360 REVIEW DOSSIER ─────────────────── */}
      {viewingBudget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface border border-border rounded-xl shadow-level-4 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-muted/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-text-primary">{viewingBudget.budget_name}</h3>
                    <Badge
                      variant={getStatusBadgeVariant(viewingBudget.status_code || viewingBudget.status_name)}
                      className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 inline-flex items-center"
                    >
                      {viewingBudget.status_name || viewingBudget.status_code}
                    </Badge>
                  </div>
                  <p className="text-xs text-text-muted font-mono">
                    Code: {viewingBudget.budget_code} • Version {viewingBudget.version_no || 1} • Project: {viewingBudget.project_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingBudget(null)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
              {/* Cost Summary Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-surface-muted/40 p-3 rounded-lg border border-border">
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Direct Cost</span>
                  <span className="font-bold text-text-primary font-mono text-sm">
                    {formatINR(viewingBudget.direct_cost)}
                  </span>
                </div>
                <div className="bg-surface-muted/40 p-3 rounded-lg border border-border">
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Site Overheads</span>
                  <span className="font-bold text-text-primary font-mono text-sm">
                    {formatINR(viewingBudget.overhead_cost)}
                  </span>
                </div>
                <div className="bg-surface-muted/40 p-3 rounded-lg border border-border">
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Contingency</span>
                  <span className="font-bold text-text-primary font-mono text-sm">
                    {formatINR(viewingBudget.contingency_amount)}
                  </span>
                </div>
                <div className="bg-primary/10 p-3 rounded-lg border border-primary/20">
                  <span className="text-primary block text-[10px] uppercase font-bold">Grand Total Budget</span>
                  <span className="font-bold text-primary font-mono text-base">
                    {formatINR(viewingBudget.total_budget)}
                  </span>
                </div>
              </div>

              {/* Budget Lines Breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-primary" />
                    Operational Budget Line Items ({budgetLines.length})
                  </h4>
                  <span className="text-[11px] text-text-muted">
                    {viewingBudget.source_boq_code ? `Mapped to BOQ: ${viewingBudget.source_boq_code}` : 'Custom Head Allocation'}
                  </span>
                </div>

                <div className="border border-border rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-surface-muted text-text-secondary uppercase font-semibold border-b border-border sticky top-0">
                      <tr>
                        <th className="px-2.5 py-1.5 w-8">#</th>
                        <th className="px-2.5 py-1.5">Line Code & Head</th>
                        <th className="px-2.5 py-1.5">Cost Type</th>
                        <th className="px-2.5 py-1.5">Work Category</th>
                        <th className="px-2.5 py-1.5 text-right">Planned Qty</th>
                        <th className="px-2.5 py-1.5 text-right">Rate</th>
                        <th className="px-2.5 py-1.5 text-right font-bold">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {loadingModalData ? (
                        <tr>
                          <td colSpan="7" className="text-center py-6 text-text-muted">Loading line items...</td>
                        </tr>
                      ) : budgetLines.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="text-center py-6 text-text-muted">No budget line items configured.</td>
                        </tr>
                      ) : (
                        budgetLines.map((line, idx) => (
                          <tr key={line.id || idx} className="hover:bg-surface-muted/20">
                            <td className="px-2.5 py-1.5 text-text-muted">{idx + 1}</td>
                            <td className="px-2.5 py-1.5">
                              <span className="font-semibold text-text-primary block font-mono">{line.line_code}</span>
                              <span className="text-[10px] text-text-muted block truncate max-w-[180px]">{line.line_description}</span>
                            </td>
                            <td className="px-2.5 py-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-surface-muted text-text-primary font-mono text-[9px] font-semibold">
                                {line.cost_type_name || line.cost_type_code || 'DIRECT'}
                              </span>
                            </td>
                            <td className="px-2.5 py-1.5 text-text-secondary truncate max-w-[120px]">
                              {line.category_name || 'General'}
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-mono">
                              {Number(line.planned_quantity || 0).toLocaleString('en-IN')} {line.unit_code || ''}
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-mono">
                              {formatINR(line.planned_rate)}
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-mono font-bold text-text-primary">
                              {formatINR(line.planned_amount)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Approval History & Status Logs */}
              <div className="space-y-2 pt-2 border-t border-border">
                <h4 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                  <History className="w-4 h-4 text-text-muted" />
                  Workflow Approval Timeline & Remarks
                </h4>

                <div className="bg-surface-muted/30 border border-border rounded-lg p-3 space-y-2.5 max-h-40 overflow-y-auto">
                  {budgetHistory.approvals.length === 0 && budgetHistory.status_logs.length === 0 ? (
                    <p className="text-text-muted text-[11px] text-center py-2">No approval events recorded yet.</p>
                  ) : (
                    budgetHistory.approvals.map((appr, idx) => (
                      <div key={appr.id || idx} className="flex items-start justify-between gap-3 text-[11px] border-b border-border/40 pb-2 last:border-b-0 last:pb-0">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5">
                            {appr.action_code === 'APPROVED' ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            ) : appr.action_code === 'REJECTED' ? (
                              <XCircle className="w-3.5 h-3.5 text-red-500" />
                            ) : (
                              <Send className="w-3.5 h-3.5 text-sky-500" />
                            )}
                          </div>
                          <div>
                            <span className="font-semibold text-text-primary block">
                              {appr.action_name || appr.action_code}
                            </span>
                            <span className="text-text-muted text-[10px]">
                              Operated by: {appr.first_name ? `${appr.first_name} ${appr.last_name || ''} (${appr.employee_code || 'EMP'})` : 'Admin Approver'}
                            </span>
                            {appr.comments && (
                              <p className="text-text-secondary italic text-[10px] mt-0.5 bg-surface p-1.5 rounded border border-border/60">
                                "{appr.comments}"
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-text-muted whitespace-nowrap">
                          {appr.action_at || 'Just now'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer with Actions */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-surface-muted/30">
              <span className="text-text-muted text-[11px]">
                CivilDesk Enterprise Budget Control Framework
              </span>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setViewingBudget(null)}>
                  Close
                </Button>

                {viewingBudget.status_code === 'SUBMITTED' && canApprove && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-500/40 hover:bg-red-50"
                      onClick={() => handleInitiateAction(viewingBudget, 'budget', 'reject')}
                    >
                      <X className="w-3.5 h-3.5 mr-1" /> Reject Budget
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleInitiateAction(viewingBudget, 'budget', 'approve')}
                    >
                      <Check className="w-3.5 h-3.5 mr-1" /> Approve & Activate
                    </Button>
                  </>
                )}

                {viewingBudget.status_code === 'DRAFT' && canSubmit && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleInitiateAction(viewingBudget, 'budget', 'submit')}
                  >
                    <Send className="w-3.5 h-3.5 mr-1" /> Submit for Approval
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: REVISION REVIEW DOSSIER ─────────────────── */}
      {viewingRevision && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface border border-border rounded-xl shadow-level-4 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-muted/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-text-primary">Budget Revision v{viewingRevision.revision_no}</h3>
                    <Badge
                      variant={getStatusBadgeVariant(viewingRevision.status_code || viewingRevision.status_name)}
                      className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 inline-flex items-center"
                    >
                      {viewingRevision.status_name || viewingRevision.status_code}
                    </Badge>
                  </div>
                  <p className="text-xs text-text-muted font-mono">
                    Parent Budget: {viewingRevision.parent_budget_code || 'BDG'} • Project: {viewingRevision.project_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingRevision(null)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface-muted/40 p-3 rounded-lg border border-border">
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Previous Baseline</span>
                  <span className="font-bold text-text-primary font-mono text-sm">
                    {formatINR(viewingRevision.previous_total)}
                  </span>
                </div>
                <div className="bg-surface-muted/40 p-3 rounded-lg border border-border">
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Revised Total</span>
                  <span className="font-bold text-primary font-mono text-sm">
                    {formatINR(viewingRevision.revised_total)}
                  </span>
                </div>
                <div className="bg-surface-muted/40 p-3 rounded-lg border border-border">
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Variance Amount</span>
                  <span className={`font-bold font-mono text-sm ${Number(viewingRevision.variance_amount || 0) > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                    {formatINR(viewingRevision.variance_amount)}
                  </span>
                </div>
              </div>

              <div className="bg-surface-muted/30 p-3.5 rounded-lg border border-border">
                <span className="text-[10px] font-bold uppercase text-text-muted block">Revision Justification / Scope Reason</span>
                <p className="text-xs text-text-primary mt-1 font-medium">
                  {viewingRevision.reason || 'No justification remarks specified.'}
                </p>
              </div>

              {/* Revision Lines */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-text-primary">Modified Line Items ({revisionLines.length})</h4>
                <div className="border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-surface-muted text-text-secondary uppercase font-semibold border-b border-border">
                      <tr>
                        <th className="px-2.5 py-1.5 w-8">#</th>
                        <th className="px-2.5 py-1.5">Change Type</th>
                        <th className="px-2.5 py-1.5">Line Description</th>
                        <th className="px-2.5 py-1.5 text-right">Revised Qty</th>
                        <th className="px-2.5 py-1.5 text-right">Revised Rate</th>
                        <th className="px-2.5 py-1.5">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {loadingRevisionModal ? (
                        <tr><td colSpan="6" className="text-center py-4 text-text-muted">Loading revision lines...</td></tr>
                      ) : revisionLines.length === 0 ? (
                        <tr><td colSpan="6" className="text-center py-4 text-text-muted">No specific line adjustments recorded.</td></tr>
                      ) : (
                        revisionLines.map((rl, idx) => (
                          <tr key={rl.id || idx}>
                            <td className="px-2.5 py-1.5 text-text-muted">{idx + 1}</td>
                            <td className="px-2.5 py-1.5">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-600">
                                {rl.change_type_name || 'MODIFY'}
                              </span>
                            </td>
                            <td className="px-2.5 py-1.5 font-medium text-text-primary">{rl.line_description || rl.line_code || 'Line item'}</td>
                            <td className="px-2.5 py-1.5 text-right font-mono">{Number(rl.revised_quantity || 0).toLocaleString('en-IN')}</td>
                            <td className="px-2.5 py-1.5 text-right font-mono">{formatINR(rl.revised_rate)}</td>
                            <td className="px-2.5 py-1.5 text-text-muted truncate max-w-[150px]">{rl.reason || '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-surface-muted/30">
              <Button variant="outline" size="sm" onClick={() => setViewingRevision(null)}>
                Close
              </Button>
              {viewingRevision.status_code === 'SUBMITTED' && canApprove && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-500/40"
                    onClick={() => handleInitiateAction(viewingRevision, 'revision', 'reject')}
                  >
                    Reject Revision
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleInitiateAction(viewingRevision, 'revision', 'approve')}
                  >
                    Approve Revision
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: WORKFLOW ACTION CONFIRMATION ──────────────── */}
      {actionDialog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleExecuteAction}
            className="bg-surface border border-border rounded-xl shadow-level-4 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  actionDialog.action === 'approve'
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : actionDialog.action === 'reject'
                      ? 'bg-red-500/10 text-red-600'
                      : 'bg-sky-500/10 text-sky-600'
                }`}>
                  {actionDialog.action === 'approve' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : actionDialog.action === 'reject' ? (
                    <XCircle className="w-5 h-5" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </div>

                <div className="flex-1">
                  <h3 className="text-sm font-bold text-text-primary capitalize">
                    {actionDialog.action === 'approve' ? 'Approve & Baseline Budget' : actionDialog.action === 'reject' ? 'Reject Budget Submission' : 'Submit Budget for Approval'}
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    {actionDialog.targetType === 'budget' ? actionDialog.target.budget_code : `Revision v${actionDialog.target.revision_no}`} • {formatINR(actionDialog.target.total_budget || actionDialog.target.revised_total)}
                  </p>
                </div>
              </div>

              <div className={`p-3 rounded-lg text-xs ${
                actionDialog.action === 'approve'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                  : actionDialog.action === 'reject'
                    ? 'bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20'
                    : 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20'
              }`}>
                {actionDialog.action === 'approve' && (
                  <p>Approving this project budget will formalize it as the active baseline for project costing and budget-vs-actual variance tracking.</p>
                )}
                {actionDialog.action === 'reject' && (
                  <p>Rejecting will send this budget back with notes. Please state the reason for rejection below.</p>
                )}
                {actionDialog.action === 'submit' && (
                  <p>Submitting locks direct line modifications and places this budget into the executive approval queue.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary block">
                  {actionDialog.action === 'reject' ? 'Reason for Rejection *' : 'Approval Remarks / Governance Notes'}
                </label>
                <textarea
                  value={actionComments}
                  onChange={(e) => setActionComments(e.target.value)}
                  placeholder={
                    actionDialog.action === 'reject'
                      ? 'State the technical or financial discrepancy requiring revision...'
                      : 'Add any operational remarks or approval references (optional)...'
                  }
                  required={actionDialog.action === 'reject'}
                  maxLength={1000}
                  rows={3}
                  className="w-full text-xs p-2.5 rounded-lg border border-border bg-surface text-text-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
                <span className="text-[10px] text-text-muted block text-right font-mono">
                  {actionComments.length}/1000
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-surface-muted/30">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActionDialog(null)}
                disabled={actionSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={actionSubmitting}
                className={
                  actionDialog.action === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : actionDialog.action === 'reject'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : ''
                }
              >
                {actionSubmitting ? 'Processing...' : `Confirm ${actionDialog.action}`}
              </Button>
            </div>
          </form>
        </div>
      )}
    </PageContainer>
  );
}

export default BudgetApprovalsPage;
