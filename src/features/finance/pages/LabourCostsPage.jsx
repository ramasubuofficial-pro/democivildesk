import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users, HardHat, IndianRupee, Clock, ShieldCheck,
  Search, Filter, Eye, Printer, FileText, TrendingUp,
  TrendingDown, Layers, Calendar, RefreshCw, BarChart3,
  CheckCircle2, AlertTriangle, AlertCircle, Building,
  Briefcase, Check, ArrowRight
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
  wagesApi,
  dailyWagesApi,
  labourContractorBillsApi,
  reportsApi,
  projectCostingApi
} from '../../../api/apiservice';
import { useAuth } from '../../auth/context/AuthContext';

export function LabourCostsPage() {
  const { hasPermission } = useAuth();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [projects, setProjects] = useState([]);
  const [wagePeriods, setWagePeriods] = useState([]);
  const [dailyWages, setDailyWages] = useState([]);
  const [contractorBills, setContractorBills] = useState([]);
  const [labourReports, setLabourReports] = useState([]);
  const [costSnapshots, setCostSnapshots] = useState([]);

  // Active Tab
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'variance' | 'payroll' | 'daily' | 'attendance'

  // Filters & Search
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Dossier Modal
  const [viewingItem, setViewingItem] = useState(null);

  // Fetch all live operational labour streams
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [
        projRes,
        wagesRes,
        dailyRes,
        billsRes,
        repRes,
        snapsRes
      ] = await Promise.allSettled([
        projectsApi.list(),
        wagesApi.list(),
        dailyWagesApi.list(),
        labourContractorBillsApi.list(),
        reportsApi.labour(),
        projectCostingApi.snapshots()
      ]);

      // Projects
      if (projRes.status === 'fulfilled') {
        const pData = projRes.value?.data?.projects ?? projRes.value?.projects ?? (Array.isArray(projRes.value?.data) ? projRes.value.data : []);
        setProjects(Array.isArray(pData) ? pData : []);
      }

      // Wage Payroll
      if (wagesRes.status === 'fulfilled') {
        const wData = wagesRes.value?.data?.wage_periods ?? (Array.isArray(wagesRes.value?.data) ? wagesRes.value.data : []);
        setWagePeriods(Array.isArray(wData) ? wData : []);
      }

      // Daily Resource Wages
      if (dailyRes.status === 'fulfilled') {
        const dData = dailyRes.value?.data?.daily_wages ?? (Array.isArray(dailyRes.value?.data) ? dailyRes.value.data : []);
        setDailyWages(Array.isArray(dData) ? dData : []);
      }

      // Contractor Bills
      if (billsRes.status === 'fulfilled') {
        const bData = billsRes.value?.data?.bills ?? (Array.isArray(billsRes.value?.data) ? billsRes.value.data : []);
        setContractorBills(Array.isArray(bData) ? bData : []);
      }

      // Labour Attendance Reports
      if (repRes.status === 'fulfilled') {
        const rData = repRes.value?.data?.labour_report ?? (Array.isArray(repRes.value?.data) ? repRes.value.data : []);
        setLabourReports(Array.isArray(rData) ? rData : []);
      }

      // Cost Snapshots
      if (snapsRes.status === 'fulfilled') {
        const sData = snapsRes.value?.data?.project_cost_snapshots ?? (Array.isArray(snapsRes.value?.data) ? snapsRes.value.data : []);
        setCostSnapshots(Array.isArray(sData) ? sData : []);
      }

      if (isRefresh) {
        toast.success('Labour cost analytics synchronized with backend.');
      }
    } catch (err) {
      console.error('Failed to load labour cost analysis data', err);
      toast.error('Unable to fetch live labour cost data.');
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

    // 1. Direct Wage Payroll
    wagePeriods.forEach((w) => {
      const net = Number(w.net_payable || 0);
      const gross = Number(w.gross_wages || 0);
      const deductions = Number(w.total_deductions || 0);
      list.push({
        id: `wage-${w.id}`,
        source_type: 'WAGE_PAYROLL',
        source_label: 'Direct Wage Payroll',
        source_color: 'primary',
        project_id: w.project_id,
        project_code: w.project_code || 'PRJ',
        project_name: w.project_name || 'Civil Project',
        site_name: w.site_name || 'Main Site',
        reference_no: w.period_code || `WP-${w.id}`,
        contractor_name: w.contractor_name || 'Direct Roll Muster',
        date: w.period_start || w.created_at?.split(' ')[0] || 'N/A',
        period_range: w.period_start && w.period_end ? `${w.period_start} to ${w.period_end}` : 'Weekly/Periodical',
        mandays: 0,
        gross_amount: gross,
        deductions: deductions,
        net_amount: net > 0 ? net : gross,
        status: w.status_name || w.status_code || 'DRAFT',
        status_variant: w.status_code === 'APPROVED' ? 'success' : w.status_code === 'SUBMITTED' ? 'info' : 'neutral',
        notes: w.remarks || '',
        raw: w
      });
    });

    // 2. Daily Resource Wages
    dailyWages.forEach((d) => {
      const amt = Number(d.total_amount || 0);
      list.push({
        id: `daily-${d.id}`,
        source_type: 'DAILY_WAGE',
        source_label: 'Daily Resource Wage',
        source_color: 'warning',
        project_id: d.project_id,
        project_code: d.project_code || 'PRJ',
        project_name: d.project_name || 'Civil Project',
        site_name: d.site_name || 'Site Work',
        reference_no: `DW-${d.id}`,
        contractor_name: d.contractor_name || 'Daily Gang Contractor',
        date: d.wage_date || d.created_at?.split(' ')[0] || 'N/A',
        period_range: d.wage_date || 'Daily Shift',
        mandays: 1,
        gross_amount: amt,
        deductions: 0,
        net_amount: amt,
        status: d.status || 'RECORDED',
        status_variant: d.status === 'APPROVED' ? 'success' : 'neutral',
        notes: d.global_remarks || '',
        raw: d
      });
    });

    // 3. Labour Contractor Bills
    contractorBills.forEach((b) => {
      const passed = Number(b.passed_amount || b.net_payable_amount || b.bill_amount || 0);
      const gross = Number(b.bill_amount || 0);
      list.push({
        id: `bill-${b.id}`,
        source_type: 'CONTRACTOR_BILL',
        source_label: 'Contractor Bill',
        source_color: 'success',
        project_id: b.project_id,
        project_code: b.project_code || 'PRJ',
        project_name: b.project_name || 'Civil Project',
        site_name: b.site_name || 'Site',
        reference_no: b.bill_no || `LCB-${b.id}`,
        contractor_name: b.contractor_name || 'Labour Contractor',
        date: b.bill_date || b.created_at?.split(' ')[0] || 'N/A',
        period_range: b.bill_date || 'Invoice Period',
        mandays: 0,
        gross_amount: gross,
        deductions: Math.max(0, gross - passed),
        net_amount: passed > 0 ? passed : gross,
        status: b.status || 'CERTIFIED',
        status_variant: b.status === 'APPROVED' || b.status === 'PAID' ? 'success' : 'info',
        notes: b.remarks || '',
        raw: b
      });
    });

    // Sort by date DESC
    return list.sort((a, b) => (b.date > a.date ? 1 : -1));
  }, [wagePeriods, dailyWages, contractorBills]);

  // Project-wise Aggregation & Variance Analysis
  const projectVarianceAnalysis = useMemo(() => {
    return projects.map((p) => {
      // Find snapshots or project costing
      const projSnap = costSnapshots.find((s) => String(s.project_id) === String(p.id));
      const approvedBudget = Number(projSnap?.approved_budget || p.contract_value || 0);
      const labourBudget = Math.round(approvedBudget * 0.35); // 35% typical labour budget baseline

      // Filter operational streams
      const projWages = wagePeriods.filter((w) => String(w.project_id) === String(p.id));
      const projDaily = dailyWages.filter((d) => String(d.project_id) === String(p.id));
      const projBills = contractorBills.filter((b) => String(b.project_id) === String(p.id));
      const projAttendance = labourReports.filter((r) => String(r.project_id) === String(p.id));

      const wagesCost = projWages.reduce((acc, w) => acc + Number(w.net_payable || w.gross_wages || 0), 0);
      const dailyCost = projDaily.reduce((acc, d) => acc + Number(d.total_amount || 0), 0);
      const billsCost = projBills.reduce((acc, b) => acc + Number(b.passed_amount || b.net_payable_amount || b.bill_amount || 0), 0);
      const totalIncurred = wagesCost + dailyCost + billsCost;

      const totalRegularHours = projAttendance.reduce((acc, r) => acc + Number(r.regular_hours || 0), 0);
      const totalOtHours = projAttendance.reduce((acc, r) => acc + Number(r.overtime_hours || 0), 0);
      const mandaysFromHours = Math.round(totalRegularHours / 8);
      const totalMandays = mandaysFromHours > 0 ? mandaysFromHours : projDaily.length;

      const variance = labourBudget - totalIncurred;
      const burnPct = labourBudget > 0 ? (totalIncurred / labourBudget) * 100 : 0;
      const avgDailyRate = totalMandays > 0 ? Math.round(totalIncurred / totalMandays) : 0;

      let status = 'Optimal';
      let statusVariant = 'success';
      if (burnPct > 100) {
        status = 'Budget Overrun';
        statusVariant = 'danger';
      } else if (burnPct > 85) {
        status = 'Near Limit';
        statusVariant = 'warning';
      } else if (totalIncurred === 0) {
        status = 'No Incurred Cost';
        statusVariant = 'neutral';
      }

      return {
        project_id: p.id,
        project_code: p.project_code || `PRJ-${p.id}`,
        project_name: p.project_name || 'Civil Project',
        labour_budget: labourBudget,
        wages_cost: wagesCost,
        daily_cost: dailyCost,
        bills_cost: billsCost,
        total_incurred: totalIncurred,
        variance: variance,
        burn_pct: burnPct,
        total_mandays: totalMandays,
        total_ot_hours: totalOtHours,
        avg_daily_rate: avgDailyRate,
        status: status,
        status_variant: statusVariant
      };
    });
  }, [projects, costSnapshots, wagePeriods, dailyWages, contractorBills, labourReports]);

  // Overall Global Metrics
  const globalMetrics = useMemo(() => {
    const totalIncurred = consolidatedLedger.reduce((acc, item) => acc + item.net_amount, 0);
    const totalBudget = projectVarianceAnalysis.reduce((acc, item) => acc + item.labour_budget, 0);
    const totalVariance = totalBudget - totalIncurred;
    const totalOtHours = labourReports.reduce((acc, r) => acc + Number(r.overtime_hours || 0), 0);
    const totalRegularHours = labourReports.reduce((acc, r) => acc + Number(r.regular_hours || 0), 0);
    const totalMandays = Math.round(totalRegularHours / 8) + dailyWages.length;
    const avgCostPerManday = totalMandays > 0 ? Math.round(totalIncurred / totalMandays) : 0;

    return {
      totalIncurred,
      totalBudget,
      totalVariance,
      totalMandays,
      totalOtHours,
      avgCostPerManday,
      overallBurnPct: totalBudget > 0 ? ((totalIncurred / totalBudget) * 100).toFixed(1) : '0.0'
    };
  }, [consolidatedLedger, projectVarianceAnalysis, labourReports, dailyWages]);

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

    if (activeTab === 'payroll') {
      return wagePeriods.filter((w) => {
        if (selectedProjectId !== 'all' && String(w.project_id) !== String(selectedProjectId)) return false;
        if (q) {
          const matchCode = (w.period_code || '').toLowerCase().includes(q);
          const matchProj = (w.project_name || '').toLowerCase().includes(q);
          const matchContractor = (w.contractor_name || '').toLowerCase().includes(q);
          if (!matchCode && !matchProj && !matchContractor) return false;
        }
        return true;
      });
    }

    if (activeTab === 'daily') {
      return dailyWages.filter((d) => {
        if (selectedProjectId !== 'all' && String(d.project_id) !== String(selectedProjectId)) return false;
        if (q) {
          const matchProj = (d.project_name || '').toLowerCase().includes(q);
          const matchContractor = (d.contractor_name || '').toLowerCase().includes(q);
          const matchSite = (d.site_name || '').toLowerCase().includes(q);
          if (!matchProj && !matchContractor && !matchSite) return false;
        }
        return true;
      });
    }

    if (activeTab === 'attendance') {
      return labourReports.filter((r) => {
        if (selectedProjectId !== 'all' && String(r.project_id) !== String(selectedProjectId)) return false;
        if (q) {
          const matchProj = (r.project_name || '').toLowerCase().includes(q);
          const matchDate = (r.attendance_date || '').toLowerCase().includes(q);
          if (!matchProj && !matchDate) return false;
        }
        return true;
      });
    }

    // Default: 'all' consolidated ledger
    return consolidatedLedger.filter((item) => {
      if (selectedProjectId !== 'all' && String(item.project_id) !== String(selectedProjectId)) return false;
      if (q) {
        const matchProj = item.project_name.toLowerCase().includes(q);
        const matchCode = item.project_code.toLowerCase().includes(q);
        const matchRef = item.reference_no.toLowerCase().includes(q);
        const matchContractor = item.contractor_name.toLowerCase().includes(q);
        if (!matchProj && !matchCode && !matchRef && !matchContractor) return false;
      }
      return true;
    });
  }, [activeTab, search, selectedProjectId, consolidatedLedger, projectVarianceAnalysis, wagePeriods, dailyWages, labourReports]);

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(filteredData.length / perPage));
  const pagedData = filteredData.slice((page - 1) * perPage, page * perPage);

  const handlePrint = () => {
    window.print();
  };

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Finance & Cost Control', href: '/finance/project-cost' },
    { label: 'Labour Cost Analysis' }
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Labour Cost Analysis & Variance Ledger"
        breadcrumbs={breadcrumbs}
      />

      <div className="flex flex-col gap-3 sm:gap-4 w-full">
        {/* KPI Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <KpiCard
            label="Total Labour Incurred"
            value={loading ? '...' : `₹${(globalMetrics.totalIncurred / 100000).toFixed(2)}L`}
            status="primary"
            icon={<IndianRupee className="w-4 h-4" />}
          />
          <KpiCard
            label="Labour Budget Baseline"
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
            label="Total Mandays Deployed"
            value={loading ? '...' : `${globalMetrics.totalMandays.toLocaleString('en-IN')} Mandays`}
            status="neutral"
            icon={<HardHat className="w-4 h-4 text-amber-500" />}
          />
        </div>

        {/* Tab Selection Navigation */}
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
            Consolidated Cost Ledger ({consolidatedLedger.length})
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
            onClick={() => setActiveTab('payroll')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'payroll'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Wage Payroll Periods ({wagePeriods.length})
          </button>
          <button
            onClick={() => setActiveTab('daily')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'daily'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Daily Resource Wages ({dailyWages.length})
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'attendance'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Utilisation & Hours ({labourReports.length})
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
                placeholder="Search project, contractor, ref..."
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
              title="Print Labour Cost Ledger"
            >
              Print Report
            </Button>
          </div>
        </div>

        {/* TAB 1: Consolidated Cost Ledger */}
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
                      <th className="px-3 py-2">Source & Reference</th>
                      <th className="px-3 py-2">Project & Site</th>
                      <th className="px-3 py-2">Contractor / Gang</th>
                      <th className="px-3 py-2 text-center w-28">Date / Period</th>
                      <th className="px-3 py-2 text-right w-24">Gross Amt</th>
                      <th className="px-3 py-2 text-right w-28 font-bold text-emerald-600">Net Cost</th>
                      <th className="px-3 py-2 text-center w-24">Status</th>
                      <th className="px-3 py-2 text-center w-16">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading ? (
                      <tr>
                        <td colSpan="9" className="text-center py-8 text-text-muted text-[12px]">
                          Loading live labour cost streams...
                        </td>
                      </tr>
                    ) : pagedData.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="text-center py-8 text-text-muted text-[12px]">
                          No labour cost records found for the selected filters.
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
                                {item.reference_no}
                              </span>
                              <span className="text-[10px] text-text-muted flex items-center gap-1">
                                <Badge variant={item.source_color} className="text-[8px] py-0 px-1 font-mono">
                                  {item.source_label}
                                </Badge>
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium text-text-primary text-[12px] truncate" title={item.project_name}>
                                {item.project_name}
                              </span>
                              <span className="text-[10px] text-text-muted truncate">
                                {item.site_name}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-text-primary text-[11px] truncate max-w-[150px]">
                            {item.contractor_name}
                          </td>
                          <td className="px-3 py-2 text-center font-mono text-[11px] text-text-secondary">
                            {item.date}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[11px] text-text-muted">
                            ₹{item.gross_amount.toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 text-[11px]">
                            ₹{item.net_amount.toLocaleString('en-IN')}
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
                              title="View Labour 360 Dossier"
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
                      <div className="flex items-center gap-1.5">
                        <Badge variant={item.source_color} className="text-[8px] py-0 px-1 font-mono">
                          {item.source_label}
                        </Badge>
                        <span className="font-bold text-text-primary text-xs">{item.reference_no}</span>
                      </div>
                      <p className="text-[11px] text-text-muted truncate mt-0.5">{item.project_name}</p>
                    </div>
                    <span className="font-bold font-mono text-emerald-600 text-xs">
                      ₹{item.net_amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-border/60">
                    <div>
                      <span className="text-[10px] text-text-muted block">Contractor</span>
                      <span className="text-text-primary truncate block">{item.contractor_name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-text-muted block">Date</span>
                      <span className="font-mono text-text-secondary">{item.date}</span>
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
                    <th className="px-3 py-2">Project Code & Title</th>
                    <th className="px-3 py-2 text-right w-28">Labour Budget</th>
                    <th className="px-3 py-2 text-right w-28">Wage Payroll</th>
                    <th className="px-3 py-2 text-right w-28">Daily Wages</th>
                    <th className="px-3 py-2 text-right w-28 font-bold text-emerald-600">Total Actual</th>
                    <th className="px-3 py-2 text-right w-28">Variance</th>
                    <th className="px-3 py-2 text-center w-24">Burn %</th>
                    <th className="px-3 py-2 text-center w-28">Cost Status</th>
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
                        ₹{(item.labour_budget / 100000).toFixed(2)}L
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-text-secondary">
                        ₹{(item.wages_cost / 100000).toFixed(2)}L
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-text-secondary">
                        ₹{(item.daily_cost / 100000).toFixed(2)}L
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 text-[11px]">
                        ₹{(item.total_incurred / 100000).toFixed(2)}L
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

        {/* TAB 3: Wage Payroll Periods */}
        {activeTab === 'payroll' && (
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
                    <th className="px-3 py-2">Wage Period Code</th>
                    <th className="px-3 py-2">Project & Site</th>
                    <th className="px-3 py-2">Contractor</th>
                    <th className="px-3 py-2 text-center w-36">Period Window</th>
                    <th className="px-3 py-2 text-right w-24">Gross Wages</th>
                    <th className="px-3 py-2 text-right w-24">Additions</th>
                    <th className="px-3 py-2 text-right w-24">Deductions</th>
                    <th className="px-3 py-2 text-right w-28 font-bold text-emerald-600">Net Payable</th>
                    <th className="px-3 py-2 text-center w-24">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pagedData.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="text-center py-8 text-text-muted text-[12px]">
                        No wage payroll records found.
                      </td>
                    </tr>
                  ) : (
                    pagedData.map((w, idx) => (
                      <tr key={w.id} className="hover:bg-surface-muted/30 transition-colors">
                        <td className="px-3 py-2 text-center font-medium text-text-primary text-[11px]">
                          {(page - 1) * perPage + idx + 1}
                        </td>
                        <td className="px-3 py-2 font-mono font-semibold text-text-primary text-[12px]">
                          {w.period_code}
                        </td>
                        <td className="px-3 py-2">
                          <span className="font-medium text-text-primary text-[11px] block">{w.project_name}</span>
                          <span className="text-[10px] text-text-muted block">{w.site_name}</span>
                        </td>
                        <td className="px-3 py-2 text-[11px] text-text-secondary">
                          {w.contractor_name || 'Direct Roll Muster'}
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-[10px] text-text-muted">
                          {w.period_start} → {w.period_end}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[11px] text-text-primary">
                          ₹{Number(w.gross_wages || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[11px] text-emerald-600">
                          ₹{Number(w.total_additions || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[11px] text-red-500">
                          ₹{Number(w.total_deductions || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 text-[11px]">
                          ₹{Number(w.net_payable || w.gross_wages || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Badge variant={w.status_code === 'APPROVED' ? 'success' : w.status_code === 'SUBMITTED' ? 'info' : 'neutral'} className="text-[9px]">
                            {w.status_name || w.status_code}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </DataTableContainer>
          </div>
        )}

        {/* TAB 4: Daily Resource Wages */}
        {activeTab === 'daily' && (
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
                    <th className="px-3 py-2">Wage Date</th>
                    <th className="px-3 py-2">Project & Site</th>
                    <th className="px-3 py-2">Subcontractor / Gang</th>
                    <th className="px-3 py-2">Remarks / Work Description</th>
                    <th className="px-3 py-2 text-right w-32 font-bold text-emerald-600">Daily Amount</th>
                    <th className="px-3 py-2 text-center w-24">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pagedData.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-text-muted text-[12px]">
                        No daily wage registers found.
                      </td>
                    </tr>
                  ) : (
                    pagedData.map((d, idx) => (
                      <tr key={d.id} className="hover:bg-surface-muted/30 transition-colors">
                        <td className="px-3 py-2 text-center font-medium text-text-primary text-[11px]">
                          {(page - 1) * perPage + idx + 1}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-text-primary font-semibold">
                          {d.wage_date}
                        </td>
                        <td className="px-3 py-2">
                          <span className="font-medium text-text-primary text-[11px] block">{d.project_name}</span>
                          <span className="text-[10px] text-text-muted block">{d.site_name}</span>
                        </td>
                        <td className="px-3 py-2 text-[11px] text-text-secondary font-medium">
                          {d.contractor_name || 'Subcontractor'}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-text-muted truncate max-w-xs">
                          {d.global_remarks || 'Daily site manpower allocation'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 text-[11px]">
                          ₹{Number(d.total_amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Badge variant={d.status === 'APPROVED' ? 'success' : 'neutral'} className="text-[9px]">
                            {d.status || 'RECORDED'}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </DataTableContainer>
          </div>
        )}

        {/* TAB 5: Attendance Utilisation & Hours */}
        {activeTab === 'attendance' && (
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
                    <th className="px-3 py-2">Attendance Date</th>
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2 text-center w-28">Worker Entries</th>
                    <th className="px-3 py-2 text-right w-28">Regular Hours</th>
                    <th className="px-3 py-2 text-right w-28 text-amber-600">Overtime Hours</th>
                    <th className="px-3 py-2 text-center w-28 font-bold text-primary">Est. Mandays</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pagedData.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-text-muted text-[12px]">
                        No labour utilisation records found.
                      </td>
                    </tr>
                  ) : (
                    pagedData.map((r, idx) => (
                      <tr key={idx} className="hover:bg-surface-muted/30 transition-colors">
                        <td className="px-3 py-2 text-center font-medium text-text-primary text-[11px]">
                          {(page - 1) * perPage + idx + 1}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-text-primary font-semibold">
                          {r.attendance_date}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-text-secondary font-medium">
                          {r.project_name}
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-[11px] text-text-primary">
                          {r.worker_entries} Workers
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[11px] text-text-primary">
                          {r.regular_hours} hrs
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[11px] text-amber-600 font-medium">
                          {r.overtime_hours} hrs
                        </td>
                        <td className="px-3 py-2 text-center font-mono font-bold text-primary text-[11px]">
                          {Math.max(1, Math.round(Number(r.regular_hours || 0) / 8))} Mandays
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </DataTableContainer>
          </div>
        )}
      </div>

      {/* Dossier 360 Inspection Modal */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface border border-border rounded-xl shadow-level-3 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-muted/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <HardHat className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">{viewingItem.reference_no}</h3>
                  <span className="text-[11px] font-mono text-text-muted">
                    {viewingItem.source_label} • {viewingItem.contractor_name}
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setViewingItem(null)}>✕</Button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3 bg-surface-muted/30 p-3.5 rounded-lg border border-border">
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Net Labour Incurred</span>
                  <span className="font-bold text-emerald-600 font-mono text-base">
                    ₹{viewingItem.net_amount.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Gross Invoiced / Base</span>
                  <span className="font-bold text-text-primary font-mono text-base">
                    ₹{viewingItem.gross_amount.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Project Name</span>
                  <span className="font-medium text-text-primary truncate block">{viewingItem.project_name}</span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Site Location</span>
                  <span className="font-medium text-text-secondary truncate block">{viewingItem.site_name}</span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Date / Period Range</span>
                  <span className="font-mono text-text-primary">{viewingItem.period_range}</span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Operational Status</span>
                  <Badge variant={viewingItem.status_variant} className="text-[9px] uppercase">
                    {viewingItem.status}
                  </Badge>
                </div>
              </div>

              {viewingItem.notes && (
                <div className="border border-border rounded-lg p-3 space-y-1">
                  <span className="font-bold text-text-primary block text-[11px]">Audit / Allocation Notes:</span>
                  <p className="text-text-secondary bg-surface-muted/30 p-2 rounded border border-border/50 leading-relaxed font-mono text-[11px]">
                    {viewingItem.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-border bg-surface-muted/20 flex justify-between items-center">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-3.5 h-3.5 mr-1" /> Print Cost Docket
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
export default LabourCostsPage;
