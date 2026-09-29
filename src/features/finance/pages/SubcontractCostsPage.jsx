import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Briefcase, IndianRupee, CheckCircle2, Clock, ShieldCheck,
  Search, Filter, Eye, Printer, FileText, TrendingUp,
  TrendingDown, Layers, Calendar, RefreshCw, BarChart3,
  AlertTriangle, AlertCircle, Building, Check, ArrowRight,
  Receipt, Wallet, Lock
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
import {
  projectsApi,
  subcontractsApi,
  reportsApi,
  projectCostingApi
} from '../../../api/apiservice';
import { useAuth } from '../../auth/context/AuthContext';

export function SubcontractCostsPage() {
  const { hasPermission } = useAuth();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [projects, setProjects] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [raBills, setRaBills] = useState([]);
  const [payments, setPayments] = useState([]);
  const [subcontractReports, setSubcontractReports] = useState([]);
  const [costSnapshots, setCostSnapshots] = useState([]);

  // Active Tab
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'variance' | 'work-orders' | 'ra-bills' | 'payments'

  // Filters & Search
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Dossier Modal
  const [viewingItem, setViewingItem] = useState(null);

  // Fetch all live operational subcontract streams
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [
        projRes,
        woRes,
        raRes,
        payRes,
        repRes,
        snapsRes
      ] = await Promise.allSettled([
        projectsApi.list(),
        subcontractsApi.workOrders.list(),
        subcontractsApi.raBills.list(),
        subcontractsApi.payments.list(),
        reportsApi.subcontracts(),
        projectCostingApi.snapshots()
      ]);

      // Projects
      if (projRes.status === 'fulfilled') {
        const pData = projRes.value?.data?.projects ?? projRes.value?.projects ?? (Array.isArray(projRes.value?.data) ? projRes.value.data : []);
        setProjects(Array.isArray(pData) ? pData : []);
      }

      // Work Orders
      if (woRes.status === 'fulfilled') {
        const woData = woRes.value?.data?.work_orders ?? (Array.isArray(woRes.value?.data) ? woRes.value.data : []);
        setWorkOrders(Array.isArray(woData) ? woData : []);
      }

      // RA Bills
      if (raRes.status === 'fulfilled') {
        const raData = raRes.value?.data?.ra_bills ?? (Array.isArray(raRes.value?.data) ? raRes.value.data : []);
        setRaBills(Array.isArray(raData) ? raData : []);
      }

      // Payments
      if (payRes.status === 'fulfilled') {
        const payData = payRes.value?.data?.payments ?? (Array.isArray(payRes.value?.data) ? payRes.value.data : []);
        setPayments(Array.isArray(payData) ? payData : []);
      }

      // Subcontract Report
      if (repRes.status === 'fulfilled') {
        const rData = repRes.value?.data?.subcontract_report ?? (Array.isArray(repRes.value?.data) ? repRes.value.data : []);
        setSubcontractReports(Array.isArray(rData) ? rData : []);
      }

      // Cost Snapshots
      if (snapsRes.status === 'fulfilled') {
        const sData = snapsRes.value?.data?.project_cost_snapshots ?? (Array.isArray(snapsRes.value?.data) ? snapsRes.value.data : []);
        setCostSnapshots(Array.isArray(sData) ? sData : []);
      }

      if (isRefresh) {
        toast.success('Subcontract cost analytics synchronized with backend.');
      }
    } catch (err) {
      console.error('Failed to load subcontract cost analysis data', err);
      toast.error('Unable to fetch live subcontract cost data.');
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
  }, [selectedProjectId, search, activeTab]);

  // Normalized Consolidated Ledger Items
  const consolidatedLedger = useMemo(() => {
    const list = [];

    workOrders.forEach((wo) => {
      const proj = projects.find((p) => String(p.id) === String(wo.project_id));
      const orderVal = Number(wo.revised_order_value || wo.total_order_value || 0);
      const certified = Number(wo.certified_amount || 0);
      const paid = Number(wo.paid_amount || 0);
      const remainingCommitment = Math.max(0, orderVal - certified);

      // Find matching RA bills to compute retention
      const matchingBills = raBills.filter((b) => String(b.work_order_id) === String(wo.id) || b.work_order_no === wo.work_order_no);
      const retentionHeld = matchingBills.reduce((acc, b) => acc + Number(b.retention_amount || 0), 0);
      const outstanding = matchingBills.reduce((acc, b) => acc + Number(b.outstanding_amount || 0), 0);

      list.push({
        id: `wo-${wo.id}`,
        work_order_id: wo.id,
        work_order_no: wo.work_order_no || `WO-${wo.id}`,
        package_title: wo.scope_of_work || 'Subcontract Package',
        project_id: wo.project_id,
        project_code: wo.project_code || proj?.project_code || 'PRJ',
        project_name: wo.project_name || proj?.project_name || 'Civil Project',
        contractor_code: wo.contractor_code || 'SUB',
        contractor_name: wo.contractor_name || 'Subcontractor',
        order_value: orderVal,
        certified_value: certified,
        paid_value: paid,
        outstanding_value: outstanding,
        retention_held: retentionHeld,
        remaining_commitment: remainingCommitment,
        retention_percent: Number(wo.retention_percent || 5),
        advance_amount: Number(wo.advance_amount || 0),
        advance_recovered: Number(wo.advance_recovered || 0),
        date: wo.work_order_date || wo.created_at?.split(' ')[0] || 'N/A',
        status: wo.status_name || wo.status_code || 'ACTIVE',
        status_variant: wo.status_code === 'ACTIVE' ? 'success' : wo.status_code === 'COMPLETED' ? 'info' : 'neutral',
        notes: wo.terms_and_conditions || '',
        raw: wo
      });
    });

    return list;
  }, [workOrders, raBills, projects]);

  // Project-wise Aggregation & Variance Analysis
  const projectVarianceAnalysis = useMemo(() => {
    return projects.map((p) => {
      const projSnap = costSnapshots.find((s) => String(s.project_id) === String(p.id));
      const approvedBudget = Number(projSnap?.approved_budget || p.contract_value || 0);
      const subcontractBudget = Math.round(approvedBudget * 0.25); // 25% typical subcontract budget baseline

      // Filter work orders for this project
      const projWos = workOrders.filter((w) => String(w.project_id) === String(p.id));
      const committedValue = projWos.reduce((acc, w) => acc + Number(w.revised_order_value || w.total_order_value || 0), 0);
      const certifiedValue = projWos.reduce((acc, w) => acc + Number(w.certified_amount || 0), 0);
      const paidValue = projWos.reduce((acc, w) => acc + Number(w.paid_amount || 0), 0);

      // RA Bills for this project
      const projBills = raBills.filter((b) => String(b.project_id) === String(p.id));
      const raCertifiedValue = projBills.reduce((acc, b) => acc + Number(b.net_certified_amount || 0), 0);
      const retentionHeld = projBills.reduce((acc, b) => acc + Number(b.retention_amount || 0), 0);

      // Total actual subcontract cost incurred
      const totalIncurred = certifiedValue > 0 ? certifiedValue : raCertifiedValue;
      const variance = subcontractBudget - totalIncurred;
      const burnPct = subcontractBudget > 0 ? (totalIncurred / subcontractBudget) * 100 : 0;

      let status = 'Optimal Budget';
      let statusVariant = 'success';
      if (burnPct > 100) {
        status = 'Budget Overrun';
        statusVariant = 'danger';
      } else if (burnPct > 85) {
        status = 'Near Limit';
        statusVariant = 'warning';
      } else if (totalIncurred === 0) {
        status = 'Zero Incurred';
        statusVariant = 'neutral';
      }

      return {
        project_id: p.id,
        project_code: p.project_code || `PRJ-${p.id}`,
        project_name: p.project_name || 'Civil Project',
        subcontract_budget: subcontractBudget,
        committed_value: committedValue,
        certified_value: totalIncurred,
        paid_value: paidValue,
        retention_held: retentionHeld,
        variance: variance,
        burn_pct: burnPct,
        packages_count: projWos.length,
        status: status,
        status_variant: statusVariant
      };
    });
  }, [projects, costSnapshots, workOrders, raBills]);

  // Overall Global Metrics
  const globalMetrics = useMemo(() => {
    const totalCommitted = workOrders.reduce((acc, w) => acc + Number(w.revised_order_value || w.total_order_value || 0), 0);
    const totalCertified = workOrders.reduce((acc, w) => acc + Number(w.certified_amount || 0), 0);
    const raCertified = raBills.reduce((acc, b) => acc + Number(b.net_certified_amount || 0), 0);
    const totalIncurred = totalCertified > 0 ? totalCertified : raCertified;

    const totalBudget = projectVarianceAnalysis.reduce((acc, item) => acc + item.subcontract_budget, 0);
    const totalVariance = totalBudget - totalIncurred;
    const totalPaid = payments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const totalRetention = raBills.reduce((acc, b) => acc + Number(b.retention_amount || 0), 0);

    return {
      totalIncurred,
      totalBudget,
      totalVariance,
      totalCommitted,
      totalPaid,
      totalRetention,
      overallBurnPct: totalBudget > 0 ? ((totalIncurred / totalBudget) * 100).toFixed(1) : '0.0'
    };
  }, [workOrders, raBills, payments, projectVarianceAnalysis]);

  // Filter Active Tab Data
  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (activeTab === 'variance') {
      return projectVarianceAnalysis.filter((item) => {
        if (selectedProjectId !== 'all' && String(item.project_id) !== String(selectedProjectId)) return false;
        if (q) {
          const matchCode = item.project_code.toLowerCase().includes(q);
          const matchName = item.project_name.toLowerCase().includes(q);
          if (!matchCode && !matchName) return false;
        }
        return true;
      });
    }

    if (activeTab === 'work-orders') {
      return workOrders.filter((wo) => {
        if (selectedProjectId !== 'all' && String(wo.project_id) !== String(selectedProjectId)) return false;
        if (q) {
          const matchNo = (wo.work_order_no || '').toLowerCase().includes(q);
          const matchProj = (wo.project_name || '').toLowerCase().includes(q);
          const matchContractor = (wo.contractor_name || '').toLowerCase().includes(q);
          if (!matchNo && !matchProj && !matchContractor) return false;
        }
        return true;
      });
    }

    if (activeTab === 'ra-bills') {
      return raBills.filter((ra) => {
        if (selectedProjectId !== 'all' && String(ra.project_id) !== String(selectedProjectId)) return false;
        if (q) {
          const matchNo = (ra.ra_bill_no || '').toLowerCase().includes(q);
          const matchWo = (ra.work_order_no || '').toLowerCase().includes(q);
          const matchContractor = (ra.contractor_name || '').toLowerCase().includes(q);
          const matchProj = (ra.project_name || '').toLowerCase().includes(q);
          if (!matchNo && !matchWo && !matchContractor && !matchProj) return false;
        }
        return true;
      });
    }

    if (activeTab === 'payments') {
      return payments.filter((pay) => {
        if (selectedProjectId !== 'all' && String(pay.project_id) !== String(selectedProjectId)) return false;
        if (q) {
          const matchNo = (pay.payment_no || '').toLowerCase().includes(q);
          const matchRa = (pay.ra_bill_no || '').toLowerCase().includes(q);
          const matchContractor = (pay.contractor_name || '').toLowerCase().includes(q);
          if (!matchNo && !matchRa && !matchContractor) return false;
        }
        return true;
      });
    }

    // Default: 'all' consolidated ledger
    return consolidatedLedger.filter((item) => {
      if (selectedProjectId !== 'all' && String(item.project_id) !== String(selectedProjectId)) return false;
      if (q) {
        const matchNo = item.work_order_no.toLowerCase().includes(q);
        const matchTitle = item.package_title.toLowerCase().includes(q);
        const matchContractor = item.contractor_name.toLowerCase().includes(q);
        const matchProj = item.project_name.toLowerCase().includes(q);
        if (!matchNo && !matchTitle && !matchContractor && !matchProj) return false;
      }
      return true;
    });
  }, [activeTab, search, selectedProjectId, consolidatedLedger, projectVarianceAnalysis, workOrders, raBills, payments]);

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(filteredData.length / perPage));
  const pagedData = filteredData.slice((page - 1) * perPage, page * perPage);

  const handlePrint = () => {
    window.print();
  };

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Finance & Cost Control', href: '/finance/project-cost' },
    { label: 'Subcontract Cost Analysis' }
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Subcontract Cost Analysis & Commitment Ledger"
        breadcrumbs={breadcrumbs}
      />

      <div className="flex flex-col gap-3 sm:gap-4 w-full">
        {/* Executive KPI Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <KpiCard
            label="Certified Work Incurred"
            value={loading ? '...' : `₹${(globalMetrics.totalIncurred / 100000).toFixed(2)}L`}
            status="primary"
            icon={<IndianRupee className="w-4 h-4" />}
          />
          <KpiCard
            label="Subcontract Budget Baseline"
            value={loading ? '...' : `₹${(globalMetrics.totalBudget / 100000).toFixed(2)}L`}
            status="neutral"
            icon={<Briefcase className="w-4 h-4 text-sky-500" />}
          />
          <KpiCard
            label="Variance vs Budget"
            value={loading ? '...' : `₹${(globalMetrics.totalVariance / 100000).toFixed(2)}L`}
            status={globalMetrics.totalVariance >= 0 ? 'success' : 'danger'}
            icon={globalMetrics.totalVariance >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
          />
          <KpiCard
            label="Active Work Order Commitments"
            value={loading ? '...' : `₹${(globalMetrics.totalCommitted / 100000).toFixed(2)}L`}
            status="neutral"
            icon={<ShieldCheck className="w-4 h-4 text-amber-500" />}
          />
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border pb-1">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Consolidated Subcontract Ledger ({consolidatedLedger.length})
          </button>
          <button
            onClick={() => setActiveTab('variance')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'variance'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Project Variance Analysis ({projects.length})
          </button>
          <button
            onClick={() => setActiveTab('work-orders')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'work-orders'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            Work Orders & Commitments ({workOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('ra-bills')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'ra-bills'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            RA Bills & Certified Work ({raBills.length})
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'payments'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            Subcontract Payments ({payments.length})
          </button>
        </div>

        {/* Filter and Action Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-surface border border-border rounded-lg p-2.5 sm:p-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="w-full sm:w-56">
              <Select
                options={[
                  { value: 'all', label: 'All Projects' },
                  ...projects.map((p) => ({
                    value: String(p.id),
                    label: `${p.project_code || 'PRJ'} - ${p.project_name}`
                  }))
                ]}
                value={selectedProjectId}
                onChange={setSelectedProjectId}
                className="text-xs h-8"
              />
            </div>

            <div className="w-full sm:w-64">
              <SearchField
                placeholder="Search WO, RA bill, contractor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />}
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="text-xs h-8 shadow-xs"
              title="Refresh Live Data"
            >
              Sync
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Printer className="w-3.5 h-3.5" />}
              onClick={handlePrint}
              className="text-xs h-8 shadow-xs"
              title="Print Subcontract Cost Ledger"
            >
              Print Report
            </Button>
          </div>
        </div>

        {/* TAB 1: Consolidated Subcontract Ledger */}
        {activeTab === 'all' && (
          <div className="w-full">
            <div className="hidden sm:block">
              <DataTableContainer
                pagination={
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={filteredData.length}
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
                      <th className="px-3 py-2">Work Order & Package</th>
                      <th className="px-3 py-2">Subcontractor</th>
                      <th className="px-3 py-2">Project</th>
                      <th className="px-3 py-2 text-right w-28">Order Value</th>
                      <th className="px-3 py-2 text-right w-28 font-bold text-emerald-600">Certified Work</th>
                      <th className="px-3 py-2 text-right w-24">Paid Value</th>
                      <th className="px-3 py-2 text-right w-24 text-amber-600">Remaining Commit</th>
                      <th className="px-3 py-2 text-center w-24">Status</th>
                      <th className="px-3 py-2 text-center w-16">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading ? (
                      <tr>
                        <td colSpan="10" className="text-center py-8 text-text-muted text-[12px]">
                          Loading live subcontract data...
                        </td>
                      </tr>
                    ) : pagedData.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="text-center py-8 text-text-muted text-[12px]">
                          No subcontract cost records found.
                        </td>
                      </tr>
                    ) : (
                      pagedData.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-surface-muted/30 transition-colors group">
                          <td className="px-3 py-2 text-center font-medium text-text-primary text-[11px]">
                            {(page - 1) * perPage + idx + 1}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-text-primary text-[12px] truncate">
                                {item.work_order_no}
                              </span>
                              <span className="text-[10px] text-text-muted truncate">
                                {item.package_title}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-[11px] text-text-secondary truncate max-w-[140px]">
                            {item.contractor_name}
                          </td>
                          <td className="px-3 py-2 text-[11px] text-text-primary truncate max-w-[140px]">
                            {item.project_name}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[11px] text-text-primary">
                            ₹{item.order_value.toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 text-[11px]">
                            ₹{item.certified_value.toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[11px] text-text-secondary">
                            ₹{item.paid_value.toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[11px] text-amber-600">
                            ₹{item.remaining_commitment.toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Badge variant={item.status_variant} className="text-[9px] uppercase">
                              {item.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              title="View Subcontract 360 Dossier"
                              onClick={() => setViewingItem(item)}
                            >
                              <Eye className="w-3.5 h-3.5 text-text-secondary hover:text-primary" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </DataTableContainer>
            </div>

            {/* Mobile Cards */}
            <div className="block sm:hidden space-y-2.5">
              {pagedData.map((item) => (
                <div key={item.id} className="bg-surface border border-border rounded-lg p-3 shadow-xs space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-text-primary text-xs">{item.work_order_no}</span>
                      <p className="text-[10px] text-text-muted">{item.contractor_name} • {item.project_name}</p>
                    </div>
                    <span className="font-bold font-mono text-emerald-600 text-xs">
                      ₹{item.certified_value.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-border/60">
                    <div>
                      <span className="text-[10px] text-text-muted block">Order Commitment</span>
                      <span className="font-mono text-text-primary">₹{item.order_value.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-text-muted block">Paid Amount</span>
                      <span className="font-mono text-text-secondary">₹{item.paid_value.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => setViewingItem(item)}>
                      <Eye className="w-3 h-3 mr-1" /> Dossier 360
                    </Button>
                  </div>
                </div>
              ))}
              <div className="pt-2">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={filteredData.length}
                  itemsPerPage={perPage}
                  onPageChange={setPage}
                  onItemsPerPageChange={() => {}}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Project Variance Analysis */}
        {activeTab === 'variance' && (
          <div className="w-full">
            <DataTableContainer
              pagination={
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={filteredData.length}
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
                    <th className="px-3 py-2">Project Code & Name</th>
                    <th className="px-3 py-2 text-right w-28">Subcontract Budget</th>
                    <th className="px-3 py-2 text-right w-28">Order Committed</th>
                    <th className="px-3 py-2 text-right w-28 font-bold text-emerald-600">Certified Work</th>
                    <th className="px-3 py-2 text-right w-28">Paid Value</th>
                    <th className="px-3 py-2 text-right w-28">Variance</th>
                    <th className="px-3 py-2 text-center w-24">Burn %</th>
                    <th className="px-3 py-2 text-center w-28">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pagedData.map((item, idx) => (
                    <tr key={item.project_id} className="hover:bg-surface-muted/30 transition-colors">
                      <td className="px-3 py-2 text-center font-medium text-text-primary text-[11px]">
                        {(page - 1) * perPage + idx + 1}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-text-primary text-[12px] truncate">
                            {item.project_code}
                          </span>
                          <span className="text-[10px] text-text-muted truncate">
                            {item.project_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-text-primary font-medium">
                        ₹{(item.subcontract_budget / 100000).toFixed(2)}L
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-text-secondary">
                        ₹{(item.committed_value / 100000).toFixed(2)}L
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 text-[11px]">
                        ₹{(item.certified_value / 100000).toFixed(2)}L
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-text-secondary">
                        ₹{(item.paid_value / 100000).toFixed(2)}L
                      </td>
                      <td className={`px-3 py-2 text-right font-mono font-bold text-[11px] ${item.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        ₹{(item.variance / 100000).toFixed(2)}L
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-[11px]">
                        {item.burn_pct.toFixed(1)}%
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant={item.status_variant} className="text-[9px] uppercase">
                          {item.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableContainer>
          </div>
        )}

        {/* TAB 3: Work Orders & Commitments */}
        {activeTab === 'work-orders' && (
          <div className="w-full">
            <DataTableContainer
              pagination={
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={filteredData.length}
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
                    <th className="px-3 py-2">WO Number</th>
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2">Contractor</th>
                    <th className="px-3 py-2 text-center w-28">Start Date</th>
                    <th className="px-3 py-2 text-right w-28 font-bold text-primary">Order Value</th>
                    <th className="px-3 py-2 text-right w-28 font-bold text-emerald-600">Certified</th>
                    <th className="px-3 py-2 text-right w-24">Retention %</th>
                    <th className="px-3 py-2 text-center w-24">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pagedData.map((wo, idx) => (
                    <tr key={wo.id} className="hover:bg-surface-muted/30 transition-colors">
                      <td className="px-3 py-2 text-center font-medium text-text-primary text-[11px]">
                        {(page - 1) * perPage + idx + 1}
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold text-text-primary text-[12px]">
                        {wo.work_order_no}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-text-primary">
                        {wo.project_name}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-text-secondary font-medium">
                        {wo.contractor_name}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-[11px] text-text-muted">
                        {wo.start_date || 'N/A'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-text-primary font-medium">
                        ₹{Number(wo.revised_order_value || wo.total_order_value || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 text-[11px]">
                        ₹{Number(wo.certified_amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-text-secondary">
                        {Number(wo.retention_percent || 5)}%
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant={wo.status_code === 'ACTIVE' ? 'success' : 'neutral'} className="text-[9px]">
                          {wo.status_name || wo.status_code}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableContainer>
          </div>
        )}

        {/* TAB 4: RA Bills & Certified Work */}
        {activeTab === 'ra-bills' && (
          <div className="w-full">
            <DataTableContainer
              pagination={
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={filteredData.length}
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
                    <th className="px-3 py-2">RA Bill No</th>
                    <th className="px-3 py-2">Work Order No</th>
                    <th className="px-3 py-2">Contractor</th>
                    <th className="px-3 py-2 text-center w-28">Bill Date</th>
                    <th className="px-3 py-2 text-right w-28 font-bold text-emerald-600">Net Certified</th>
                    <th className="px-3 py-2 text-right w-24">Paid</th>
                    <th className="px-3 py-2 text-right w-24 text-amber-600">Outstanding</th>
                    <th className="px-3 py-2 text-center w-28">Payment Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pagedData.map((ra, idx) => (
                    <tr key={ra.id} className="hover:bg-surface-muted/30 transition-colors">
                      <td className="px-3 py-2 text-center font-medium text-text-primary text-[11px]">
                        {(page - 1) * perPage + idx + 1}
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold text-text-primary text-[12px]">
                        {ra.ra_bill_no}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-text-muted">
                        {ra.work_order_no}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-text-primary font-medium">
                        {ra.contractor_name}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-[11px] text-text-muted">
                        {ra.bill_date}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 text-[11px]">
                        ₹{Number(ra.net_certified_amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-text-secondary">
                        ₹{Number(ra.paid_amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-amber-600">
                        ₹{Number(ra.outstanding_amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant={ra.payment_status_code === 'PAID' ? 'success' : 'warning'} className="text-[9px]">
                          {ra.payment_status_name || ra.payment_status_code}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableContainer>
          </div>
        )}

        {/* TAB 5: Subcontract Payments */}
        {activeTab === 'payments' && (
          <div className="w-full">
            <DataTableContainer
              pagination={
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={filteredData.length}
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
                    <th className="px-3 py-2">Payment Voucher No</th>
                    <th className="px-3 py-2">RA Bill Ref</th>
                    <th className="px-3 py-2">Contractor</th>
                    <th className="px-3 py-2 text-center w-28">Payment Date</th>
                    <th className="px-3 py-2 text-center w-24">Mode</th>
                    <th className="px-3 py-2 text-right w-28 font-bold text-emerald-600">Amount Paid</th>
                    <th className="px-3 py-2 text-center w-24">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pagedData.map((pay, idx) => (
                    <tr key={pay.id} className="hover:bg-surface-muted/30 transition-colors">
                      <td className="px-3 py-2 text-center font-medium text-text-primary text-[11px]">
                        {(page - 1) * perPage + idx + 1}
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold text-text-primary text-[12px]">
                        {pay.payment_no}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-text-muted">
                        {pay.ra_bill_no}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-text-primary font-medium">
                        {pay.contractor_name}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-[11px] text-text-muted">
                        {pay.payment_date}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant="neutral" className="text-[9px]">
                          {pay.payment_mode_name || pay.payment_mode_code || 'Direct'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 text-[11px]">
                        ₹{Number(pay.amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant={pay.status_code === 'PAID' ? 'success' : 'neutral'} className="text-[9px]">
                          {pay.status_name || pay.status_code}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableContainer>
          </div>
        )}
      </div>

      {/* Subcontract 360 Dossier Modal */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface border border-border rounded-xl shadow-level-3 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-muted/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">{viewingItem.work_order_no}</h3>
                  <span className="text-[11px] font-mono text-text-muted">
                    {viewingItem.contractor_name} • {viewingItem.project_name}
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setViewingItem(null)}>✕</Button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3 bg-surface-muted/30 p-3.5 rounded-lg border border-border">
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Total Order Value</span>
                  <span className="font-bold text-text-primary font-mono text-base">
                    ₹{viewingItem.order_value.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Net Certified Incurred</span>
                  <span className="font-bold text-emerald-600 font-mono text-base">
                    ₹{viewingItem.certified_value.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Disbursed / Paid</span>
                  <span className="font-mono text-text-secondary text-sm font-semibold">
                    ₹{viewingItem.paid_value.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Remaining Commitment</span>
                  <span className="font-mono text-amber-600 text-sm font-medium">
                    ₹{viewingItem.remaining_commitment.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Retention Withheld ({viewingItem.retention_percent}%)</span>
                  <span className="font-mono text-primary font-semibold">
                    ₹{viewingItem.retention_held.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Outstanding Payable</span>
                  <span className="font-mono text-text-primary font-medium">
                    ₹{viewingItem.outstanding_value.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {viewingItem.package_title && (
                <div className="border border-border rounded-lg p-3 space-y-1 bg-surface">
                  <span className="font-bold text-text-primary block text-[11px]">Scope of Subcontract Work:</span>
                  <p className="text-text-secondary text-[11px] leading-relaxed">
                    {viewingItem.package_title}
                  </p>
                </div>
              )}

              {viewingItem.notes && (
                <div className="border border-border rounded-lg p-3 space-y-1 bg-surface">
                  <span className="font-bold text-text-primary block text-[11px]">Terms & Conditions / Remarks:</span>
                  <p className="text-text-secondary text-[11px] font-mono leading-relaxed">
                    {viewingItem.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-border bg-surface-muted/20 flex justify-between items-center">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-3.5 h-3.5 mr-1" /> Print Subcontract Docket
              </Button>
              <Button variant="outline" size="sm" onClick={() => setViewingItem(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

export default SubcontractCostsPage;
