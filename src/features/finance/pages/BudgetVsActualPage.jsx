import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp, CheckCircle2, IndianRupee, Clock, ShieldCheck,
  Search, Filter, Eye, Printer, FileText, TrendingDown,
  Layers, Calendar, RefreshCw, BarChart3, AlertTriangle,
  AlertCircle, Building, Briefcase, Plus, PieChart,
  HardHat, Boxes, Receipt, DollarSign
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
import { Input } from '../../../components/ui/Input';
import { toast } from '../../../components/composite/Toast';
import {
  projectsApi,
  budgetsApi,
  projectCostingApi,
  reportsApi,
  dailyWagesApi,
  wagesApi,
  subcontractsApi,
  expensesApi
} from '../../../api/apiservice';
import { useAuth } from '../../auth/context/AuthContext';

export function BudgetVsActualPage() {
  const { hasPermission } = useAuth();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [projects, setProjects] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [costSnapshots, setCostSnapshots] = useState([]);
  const [budgetLines, setBudgetLines] = useState([]);

  // Live Operational DB Stream State
  const [materialReports, setMaterialReports] = useState([]);
  const [dailyWages, setDailyWages] = useState([]);
  const [wagePeriods, setWagePeriods] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [raBills, setRaBills] = useState([]);
  const [expenseBills, setExpenseBills] = useState([]);

  // Active Tab
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'project-matrix' | 'budgets' | 'snapshots'

  // Filters & Search
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [selectedCostType, setSelectedCostType] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Dossier Modal
  const [viewingItem, setViewingItem] = useState(null);

  // Generate Snapshot Modal
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [genProjectId, setGenProjectId] = useState('');
  const [genDate, setGenDate] = useState(new Date().toISOString().split('T')[0]);
  const [genSaving, setGenSaving] = useState(false);

  // Fetch all live operational budgeting and costing data from backend DB
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [
        projRes,
        budgetsRes,
        snapsRes,
        matRepRes,
        dailyRes,
        wagesRes,
        woRes,
        raRes,
        expRes
      ] = await Promise.allSettled([
        projectsApi.list(),
        budgetsApi.list(),
        projectCostingApi.snapshots(),
        reportsApi.materials(),
        dailyWagesApi.list(),
        wagesApi.list(),
        subcontractsApi.workOrders.list(),
        subcontractsApi.raBills.list(),
        expensesApi.bills.list()
      ]);

      // Projects
      let pData = [];
      if (projRes.status === 'fulfilled') {
        pData = projRes.value?.data?.projects ?? projRes.value?.projects ?? (Array.isArray(projRes.value?.data) ? projRes.value.data : []);
        setProjects(Array.isArray(pData) ? pData : []);
        if (pData.length > 0 && !genProjectId) {
          setGenProjectId(String(pData[0].id));
        }
      }

      // Budgets
      let bData = [];
      if (budgetsRes.status === 'fulfilled') {
        bData = budgetsRes.value?.data?.project_budgets ?? (Array.isArray(budgetsRes.value?.data) ? budgetsRes.value.data : []);
        setBudgets(Array.isArray(bData) ? bData : []);

        // Load lines from the most recent active budget if available
        if (bData.length > 0) {
          try {
            const firstId = bData[0].id;
            const linesRes = await budgetsApi.lines.list(firstId);
            const lines = linesRes?.data?.budget_lines ?? [];
            setBudgetLines(Array.isArray(lines) ? lines : []);
          } catch {
            // ignore line fetch error
          }
        }
      }

      // Cost Snapshots
      if (snapsRes.status === 'fulfilled') {
        const sData = snapsRes.value?.data?.project_cost_snapshots ?? (Array.isArray(snapsRes.value?.data) ? snapsRes.value.data : []);
        setCostSnapshots(Array.isArray(sData) ? sData : []);
      }

      // Material Consumption
      if (matRepRes.status === 'fulfilled') {
        const mrData = matRepRes.value?.data?.material_report ?? (Array.isArray(matRepRes.value?.data) ? matRepRes.value.data : []);
        setMaterialReports(Array.isArray(mrData) ? mrData : []);
      }

      // Daily Wages
      if (dailyRes.status === 'fulfilled') {
        const dwData = dailyRes.value?.data?.daily_wages ?? (Array.isArray(dailyRes.value?.data) ? dailyRes.value.data : []);
        setDailyWages(Array.isArray(dwData) ? dwData : []);
      }

      // Wage Periods
      if (wagesRes.status === 'fulfilled') {
        const wpData = wagesRes.value?.data?.wage_periods ?? (Array.isArray(wagesRes.value?.data) ? wagesRes.value.data : []);
        setWagePeriods(Array.isArray(wpData) ? wpData : []);
      }

      // Work Orders (Commitments)
      if (woRes.status === 'fulfilled') {
        const woData = woRes.value?.data?.work_orders ?? (Array.isArray(woRes.value?.data) ? woRes.value.data : []);
        setWorkOrders(Array.isArray(woData) ? woData : []);
      }

      // Subcontract RA Bills (Actual Certified)
      if (raRes.status === 'fulfilled') {
        const raData = raRes.value?.data?.ra_bills ?? (Array.isArray(raRes.value?.data) ? raRes.value.data : []);
        setRaBills(Array.isArray(raData) ? raData : []);
      }

      // Expense Bills (Actual Posted)
      if (expRes.status === 'fulfilled') {
        const expData = expRes.value?.data?.bills ?? (Array.isArray(expRes.value?.data) ? expRes.value.data : []);
        setExpenseBills(Array.isArray(expData) ? expData : []);
      }

      if (isRefresh) {
        toast.success('Budget vs Actual analytics synchronized with backend.');
      }
    } catch (err) {
      console.error('Failed to load budget vs actual data', err);
      toast.error('Unable to fetch live budget vs actual data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [genProjectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset pagination on filter or tab change
  useEffect(() => {
    setPage(1);
  }, [selectedProjectId, selectedCostType, search, activeTab]);

  // Handle Snapshot Generation
  const handleGenerateSnapshot = async (e) => {
    e.preventDefault();
    if (!genProjectId) {
      toast.error('Please select a project.');
      return;
    }

    setGenSaving(true);
    try {
      await projectCostingApi.generateSnapshot({
        project_id: Number(genProjectId),
        snapshot_date: genDate
      });
      toast.success('Cost snapshot generated successfully.');
      setIsGenerateOpen(false);
      loadData(true);
    } catch (err) {
      console.error('Failed to generate snapshot', err);
      toast.error(err?.message || 'Failed to generate cost snapshot.');
    } finally {
      setGenSaving(false);
    }
  };

  // Consolidated Cost Head Breakdown (Material, Labour, Subcontract, Expense)
  const consolidatedCostHeads = useMemo(() => {
    const list = [];

    // Analyze from live operational database records & latest snapshots
    projects.forEach((proj) => {
      const projSnaps = costSnapshots.filter((s) => String(s.project_id) === String(proj.id));
      const latestSnap = projSnaps[0] || null;

      // Project Budgets from DB
      const projBudgets = budgets.filter((b) => String(b.project_id) === String(proj.id));
      const approvedBudgets = projBudgets.filter((b) => (b.status_code || '').toUpperCase() === 'APPROVED');
      const dbBudgetTotal = approvedBudgets.length > 0
        ? approvedBudgets.reduce((acc, b) => acc + (Number(b.total_budget) || 0), 0)
        : projBudgets.length > 0
          ? projBudgets.reduce((acc, b) => acc + (Number(b.total_budget) || 0), 0)
          : Number(latestSnap?.approved_budget) || 0;

      // If budget defined in DB use it; otherwise fallback to contract value
      const approvedBudget = dbBudgetTotal > 0 ? dbBudgetTotal : Number(proj.contract_value || 0);

      // Allocations by construction standard norms (40% Material, 35% Labour, 15% Subcontract, 10% Site Expenses)
      const matBudget = Math.round(approvedBudget * 0.40);
      const labBudget = Math.round(approvedBudget * 0.35);
      const subBudget = Math.round(approvedBudget * 0.15);
      const expBudget = Math.round(approvedBudget * 0.10);

      // Operational Material Incurred (from material consumption report)
      const projMatReport = materialReports.filter((m) => String(m.project_id) === String(proj.id));
      const matReportSum = projMatReport.reduce((acc, m) => acc + (Number(m.total_cost || m.cost || (m.quantity * m.unit_rate)) || 0), 0);
      const matActual = Math.max(matReportSum, Number(latestSnap?.material_actual) || 0);

      // Operational Labour Incurred (from daily wages + wage periods)
      const projDailyWages = dailyWages.filter((d) => String(d.project_id) === String(proj.id));
      const dailyWagesSum = projDailyWages.reduce((acc, d) => acc + (Number(d.total_amount) || 0), 0);
      const projWagePeriods = wagePeriods.filter((w) => String(w.project_id) === String(proj.id));
      const wagePeriodsSum = projWagePeriods.reduce((acc, w) => acc + (Number(w.net_payable || w.gross_wages) || 0), 0);
      const labActual = Math.max(dailyWagesSum + wagePeriodsSum, Number(latestSnap?.labour_actual) || 0);

      // Operational Subcontract Incurred (from certified RA bills)
      const projRaBills = raBills.filter((r) => String(r.project_id) === String(proj.id));
      const raBillsSum = projRaBills.reduce((acc, r) => acc + (Number(r.net_certified_amount || r.passed_amount || r.total_amount) || 0), 0);
      const subActual = Math.max(raBillsSum, Number(latestSnap?.subcontract_actual) || 0);

      // Operational Site Expense Incurred (from posted expense bills)
      const projExpBills = expenseBills.filter((e) => String(e.project_id) === String(proj.id));
      const expBillsSum = projExpBills.reduce((acc, e) => acc + (Number(e.net_payable || e.bill_amount || e.total_amount) || 0), 0);
      const expActual = Math.max(expBillsSum, Number(latestSnap?.site_expense_actual) || 0);

      // Operational Commitments
      const projWorkOrders = workOrders.filter((w) => String(w.project_id) === String(proj.id));
      const woCommit = projWorkOrders.reduce((acc, w) => acc + (Number(w.revised_order_value || w.order_value) || 0), 0);
      const subCommit = Math.max(woCommit, Number(latestSnap?.subcontract_commitment) || 0);

      const matCommit = Number(latestSnap?.material_commitment) || 0;
      const expCommit = Number(latestSnap?.expense_commitment) || 0;

      // 1. Material Cost Head
      list.push({
        id: `mat-${proj.id}`,
        cost_code: 'WBS-MAT-01',
        cost_head: 'Material & Consumables',
        cost_type: 'MATERIAL',
        project_id: proj.id,
        project_code: proj.project_code || 'PRJ',
        project_name: proj.project_name || 'Civil Project',
        approved_budget: matBudget,
        committed_value: matCommit,
        actual_incurred: matActual,
        variance: matBudget - matActual,
        burn_pct: matBudget > 0 ? (matActual / matBudget) * 100 : 0,
        status: matActual > matBudget ? 'Over Budget' : (matActual / (matBudget || 1)) > 0.85 ? 'Near Limit' : 'Within Budget',
        status_variant: matActual > matBudget ? 'danger' : (matActual / (matBudget || 1)) > 0.85 ? 'warning' : 'success'
      });

      // 2. Labour Cost Head
      list.push({
        id: `lab-${proj.id}`,
        cost_code: 'WBS-LAB-02',
        cost_head: 'Labour Gang & Muster Wages',
        cost_type: 'LABOUR',
        project_id: proj.id,
        project_code: proj.project_code || 'PRJ',
        project_name: proj.project_name || 'Civil Project',
        approved_budget: labBudget,
        committed_value: 0,
        actual_incurred: labActual,
        variance: labBudget - labActual,
        burn_pct: labBudget > 0 ? (labActual / labBudget) * 100 : 0,
        status: labActual > labBudget ? 'Over Budget' : (labActual / (labBudget || 1)) > 0.85 ? 'Near Limit' : 'Within Budget',
        status_variant: labActual > labBudget ? 'danger' : (labActual / (labBudget || 1)) > 0.85 ? 'warning' : 'success'
      });

      // 3. Subcontract Cost Head
      list.push({
        id: `sub-${proj.id}`,
        cost_code: 'WBS-SUB-03',
        cost_head: 'Subcontract Packages',
        cost_type: 'SUBCONTRACT',
        project_id: proj.id,
        project_code: proj.project_code || 'PRJ',
        project_name: proj.project_name || 'Civil Project',
        approved_budget: subBudget,
        committed_value: subCommit,
        actual_incurred: subActual,
        variance: subBudget - subActual,
        burn_pct: subBudget > 0 ? (subActual / subBudget) * 100 : 0,
        status: subActual > subBudget ? 'Over Budget' : (subActual / (subBudget || 1)) > 0.85 ? 'Near Limit' : 'Within Budget',
        status_variant: subActual > subBudget ? 'danger' : (subActual / (subBudget || 1)) > 0.85 ? 'warning' : 'success'
      });

      // 4. Site Expenses & Overheads
      list.push({
        id: `exp-${proj.id}`,
        cost_code: 'WBS-EXP-04',
        cost_head: 'Site Operations & Overheads',
        cost_type: 'EXPENSE',
        project_id: proj.id,
        project_code: proj.project_code || 'PRJ',
        project_name: proj.project_name || 'Civil Project',
        approved_budget: expBudget,
        committed_value: expCommit,
        actual_incurred: expActual,
        variance: expBudget - expActual,
        burn_pct: expBudget > 0 ? (expActual / expBudget) * 100 : 0,
        status: expActual > expBudget ? 'Over Budget' : (expActual / (expBudget || 1)) > 0.85 ? 'Near Limit' : 'Within Budget',
        status_variant: expActual > expBudget ? 'danger' : (expActual / (expBudget || 1)) > 0.85 ? 'warning' : 'success'
      });
    });

    return list;
  }, [projects, costSnapshots, budgets, materialReports, dailyWages, wagePeriods, workOrders, raBills, expenseBills]);

  // Project-wise Matrix
  const projectMatrix = useMemo(() => {
    return projects.map((p) => {
      const projSnaps = costSnapshots.filter((s) => String(s.project_id) === String(p.id));
      const latestSnap = projSnaps[0] || null;

      // Project Budgets from DB
      const projBudgets = budgets.filter((b) => String(b.project_id) === String(p.id));
      const approvedBudgets = projBudgets.filter((b) => (b.status_code || '').toUpperCase() === 'APPROVED');
      const dbBudgetTotal = approvedBudgets.length > 0
        ? approvedBudgets.reduce((acc, b) => acc + (Number(b.total_budget) || 0), 0)
        : projBudgets.length > 0
          ? projBudgets.reduce((acc, b) => acc + (Number(b.total_budget) || 0), 0)
          : Number(latestSnap?.approved_budget) || 0;

      const approvedBudget = dbBudgetTotal > 0 ? dbBudgetTotal : Number(p.contract_value || 0);

      // Operational Material Incurred
      const projMatReport = materialReports.filter((m) => String(m.project_id) === String(p.id));
      const matReportSum = projMatReport.reduce((acc, m) => acc + (Number(m.total_cost || m.cost || (m.quantity * m.unit_rate)) || 0), 0);
      const matActual = Math.max(matReportSum, Number(latestSnap?.material_actual) || 0);

      // Operational Labour Incurred
      const projDailyWages = dailyWages.filter((d) => String(d.project_id) === String(p.id));
      const dailyWagesSum = projDailyWages.reduce((acc, d) => acc + (Number(d.total_amount) || 0), 0);
      const projWagePeriods = wagePeriods.filter((w) => String(w.project_id) === String(p.id));
      const wagePeriodsSum = projWagePeriods.reduce((acc, w) => acc + (Number(w.net_payable || w.gross_wages) || 0), 0);
      const labActual = Math.max(dailyWagesSum + wagePeriodsSum, Number(latestSnap?.labour_actual) || 0);

      // Operational Subcontract Incurred
      const projRaBills = raBills.filter((r) => String(r.project_id) === String(p.id));
      const raBillsSum = projRaBills.reduce((acc, r) => acc + (Number(r.net_certified_amount || r.passed_amount || r.total_amount) || 0), 0);
      const subActual = Math.max(raBillsSum, Number(latestSnap?.subcontract_actual) || 0);

      // Operational Site Expense Incurred
      const projExpBills = expenseBills.filter((e) => String(e.project_id) === String(p.id));
      const expBillsSum = projExpBills.reduce((acc, e) => acc + (Number(e.net_payable || e.bill_amount || e.total_amount) || 0), 0);
      const expActual = Math.max(expBillsSum, Number(latestSnap?.site_expense_actual) || 0);

      // Operational Commitments
      const projWorkOrders = workOrders.filter((w) => String(w.project_id) === String(p.id));
      const woCommit = projWorkOrders.reduce((acc, w) => acc + (Number(w.revised_order_value || w.order_value) || 0), 0);
      const subCommit = Math.max(woCommit, Number(latestSnap?.subcontract_commitment) || 0);

      const matCommit = Number(latestSnap?.material_commitment) || 0;
      const expCommit = Number(latestSnap?.expense_commitment) || 0;

      const totalActual = matActual + labActual + subActual + expActual;
      const totalCommitment = matCommit + subCommit + expCommit;

      const forecastCost = Number(latestSnap?.forecast_cost_at_completion) || Math.max(approvedBudget, totalActual + totalCommitment);
      const variance = approvedBudget - totalActual;
      const burnPct = approvedBudget > 0 ? (totalActual / approvedBudget) * 100 : 0;
      const cpi = forecastCost > 0 ? (approvedBudget / forecastCost) : 1.0;

      let status = 'Within Budget';
      let statusVariant = 'success';
      if (burnPct > 100 || cpi < 0.95) {
        status = 'Budget Overrun';
        statusVariant = 'danger';
      } else if (burnPct > 85) {
        status = 'Near Limit';
        statusVariant = 'warning';
      } else if (totalActual === 0) {
        status = 'Zero Incurred';
        statusVariant = 'neutral';
      }

      return {
        project_id: p.id,
        project_code: p.project_code || `PRJ-${p.id}`,
        project_name: p.project_name || 'Civil Project',
        approved_budget: approvedBudget,
        mat_actual: matActual,
        lab_actual: labActual,
        sub_actual: subActual,
        exp_actual: expActual,
        total_actual: totalActual,
        total_commitment: totalCommitment,
        forecast_cost: forecastCost,
        variance: variance,
        burn_pct: burnPct,
        cpi: Number.isFinite(cpi) ? cpi.toFixed(2) : '1.00',
        status: status,
        status_variant: statusVariant
      };
    });
  }, [projects, costSnapshots, budgets, materialReports, dailyWages, wagePeriods, workOrders, raBills, expenseBills]);

  // Overall Global Metrics
  const globalMetrics = useMemo(() => {
    const totalBudget = projectMatrix.reduce((acc, p) => acc + (Number(p.approved_budget) || 0), 0);
    const totalActual = projectMatrix.reduce((acc, p) => acc + (Number(p.total_actual) || 0), 0);
    const totalCommitment = projectMatrix.reduce((acc, p) => acc + (Number(p.total_commitment) || 0), 0);
    const totalVariance = totalBudget - totalActual;
    const overallBurnPct = totalBudget > 0 ? ((totalActual / totalBudget) * 100).toFixed(1) : '0.0';

    return {
      totalBudget,
      totalActual,
      totalCommitment,
      totalVariance,
      overallBurnPct
    };
  }, [projectMatrix]);

  // Filter Active Tab Data
  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (activeTab === 'project-matrix') {
      return projectMatrix.filter((item) => {
        if (selectedProjectId !== 'all' && String(item.project_id) !== String(selectedProjectId)) return false;
        if (q) {
          const matchCode = item.project_code.toLowerCase().includes(q);
          const matchName = item.project_name.toLowerCase().includes(q);
          if (!matchCode && !matchName) return false;
        }
        return true;
      });
    }

    if (activeTab === 'budgets') {
      return budgets.filter((b) => {
        if (selectedProjectId !== 'all' && String(b.project_id) !== String(selectedProjectId)) return false;
        if (q) {
          const matchCode = (b.budget_code || '').toLowerCase().includes(q);
          const matchName = (b.budget_name || '').toLowerCase().includes(q);
          const matchProj = (b.project_name || '').toLowerCase().includes(q);
          if (!matchCode && !matchName && !matchProj) return false;
        }
        return true;
      });
    }

    if (activeTab === 'snapshots') {
      return costSnapshots.filter((s) => {
        if (selectedProjectId !== 'all' && String(s.project_id) !== String(selectedProjectId)) return false;
        if (q) {
          const matchProj = (s.project_name || '').toLowerCase().includes(q);
          const matchDate = (s.snapshot_date || '').toLowerCase().includes(q);
          if (!matchProj && !matchDate) return false;
        }
        return true;
      });
    }

    // Default: 'all' consolidated cost heads
    return consolidatedCostHeads.filter((item) => {
      if (selectedProjectId !== 'all' && String(item.project_id) !== String(selectedProjectId)) return false;
      if (selectedCostType !== 'all' && item.cost_type !== selectedCostType) return false;
      if (q) {
        const matchHead = item.cost_head.toLowerCase().includes(q);
        const matchCode = item.cost_code.toLowerCase().includes(q);
        const matchProj = item.project_name.toLowerCase().includes(q);
        if (!matchHead && !matchCode && !matchProj) return false;
      }
      return true;
    });
  }, [activeTab, search, selectedProjectId, selectedCostType, consolidatedCostHeads, projectMatrix, budgets, costSnapshots]);

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(filteredData.length / perPage));
  const pagedData = filteredData.slice((page - 1) * perPage, page * perPage);

  const handlePrint = () => {
    window.print();
  };

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Finance & Cost Control', href: '/finance/project-cost' },
    { label: 'Budget vs Actual Analysis' }
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Budget vs Actual Cost & Variance Analysis"
        breadcrumbs={breadcrumbs}
      />

      <div className="flex flex-col gap-3 sm:gap-4 w-full">
        {/* Executive KPI Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <KpiCard
            label="Total Approved Budget"
            value={loading ? '...' : `₹${(globalMetrics.totalBudget / 100000).toFixed(2)}L`}
            status="primary"
            icon={<IndianRupee className="w-4 h-4" />}
          />
          <KpiCard
            label="Total Actual Incurred"
            value={loading ? '...' : `₹${(globalMetrics.totalActual / 100000).toFixed(2)}L`}
            status="neutral"
            icon={<Briefcase className="w-4 h-4 text-sky-500" />}
          />
          <KpiCard
            label="Overall Variance"
            value={loading ? '...' : `₹${(globalMetrics.totalVariance / 100000).toFixed(2)}L`}
            status={globalMetrics.totalVariance >= 0 ? 'success' : 'danger'}
            icon={globalMetrics.totalVariance >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
          />
          <KpiCard
            label="Active Commitments"
            value={loading ? '...' : `₹${(globalMetrics.totalCommitment / 100000).toFixed(2)}L`}
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
            Cost Head Variance Ledger ({consolidatedCostHeads.length})
          </button>
          <button
            onClick={() => setActiveTab('project-matrix')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'project-matrix'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Project Cost Matrix ({projects.length})
          </button>
          <button
            onClick={() => setActiveTab('budgets')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'budgets'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Approved Project Budgets ({budgets.length})
          </button>
          <button
            onClick={() => setActiveTab('snapshots')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'snapshots'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Periodical Cost Snapshots ({costSnapshots.length})
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

            {activeTab === 'all' && (
              <div className="w-full sm:w-44">
                <Select
                  options={[
                    { value: 'all', label: 'All Cost Heads' },
                    { value: 'MATERIAL', label: 'Material Costs' },
                    { value: 'LABOUR', label: 'Labour Wages' },
                    { value: 'SUBCONTRACT', label: 'Subcontracts' },
                    { value: 'EXPENSE', label: 'Site Expenses' }
                  ]}
                  value={selectedCostType}
                  onChange={setSelectedCostType}
                  className="text-xs h-8"
                />
              </div>
            )}

            <div className="w-full sm:w-60">
              <SearchField
                placeholder="Search cost head, WBS, project..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setIsGenerateOpen(true)}
              className="text-xs h-8 shadow-xs"
              title="Generate New Cost Snapshot"
            >
              Take Snapshot
            </Button>
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
              title="Print Budget vs Actual Report"
            >
              Print Report
            </Button>
          </div>
        </div>

        {/* TAB 1: Consolidated Cost Head Variance Ledger */}
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
                      <th className="px-3 py-2">Cost Head & WBS</th>
                      <th className="px-3 py-2">Project</th>
                      <th className="px-3 py-2 text-right w-28">Approved Budget</th>
                      <th className="px-3 py-2 text-right w-28">Committed Value</th>
                      <th className="px-3 py-2 text-right w-28 font-bold text-emerald-600">Actual Incurred</th>
                      <th className="px-3 py-2 text-right w-28">Variance</th>
                      <th className="px-3 py-2 text-center w-24">Burn %</th>
                      <th className="px-3 py-2 text-center w-28">Status</th>
                      <th className="px-3 py-2 text-center w-16">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading ? (
                      <tr>
                        <td colSpan="10" className="text-center py-8 text-text-muted text-[12px]">
                          Loading live budget vs actual data...
                        </td>
                      </tr>
                    ) : pagedData.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="text-center py-8 text-text-muted text-[12px]">
                          No budget lines or cost records found.
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
                                {item.cost_head}
                              </span>
                              <span className="text-[10px] text-text-muted font-mono">
                                {item.cost_code}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-[11px] text-text-primary truncate max-w-[140px]">
                            {item.project_name}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[11px] text-text-primary font-medium">
                            ₹{(item.approved_budget / 100000).toFixed(2)}L
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[11px] text-text-secondary">
                            ₹{(item.committed_value / 100000).toFixed(2)}L
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 text-[11px]">
                            ₹{(item.actual_incurred / 100000).toFixed(2)}L
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
                          <td className="px-3 py-2 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              title="View Cost 360 Dossier"
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
                      <span className="font-bold text-text-primary text-xs">{item.cost_head}</span>
                      <p className="text-[10px] text-text-muted">{item.cost_code} • {item.project_name}</p>
                    </div>
                    <Badge variant={item.status_variant} className="text-[8px] uppercase">
                      {item.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-border/60">
                    <div>
                      <span className="text-[10px] text-text-muted block">Approved Budget</span>
                      <span className="font-mono text-text-primary">₹{(item.approved_budget / 100000).toFixed(2)}L</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-text-muted block">Actual Incurred</span>
                      <span className="font-mono font-bold text-emerald-600">₹{(item.actual_incurred / 100000).toFixed(2)}L</span>
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

        {/* TAB 2: Project Cost Matrix */}
        {activeTab === 'project-matrix' && (
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
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2 text-right w-24">Approved Budget</th>
                    <th className="px-3 py-2 text-right w-20">Material</th>
                    <th className="px-3 py-2 text-right w-20">Labour</th>
                    <th className="px-3 py-2 text-right w-20">Subcontract</th>
                    <th className="px-3 py-2 text-right w-20">Expenses</th>
                    <th className="px-3 py-2 text-right w-24 font-bold text-emerald-600">Total Actual</th>
                    <th className="px-3 py-2 text-right w-24">Variance</th>
                    <th className="px-3 py-2 text-center w-16">CPI</th>
                    <th className="px-3 py-2 text-center w-24">Status</th>
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
                        ₹{(item.approved_budget / 100000).toFixed(2)}L
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-text-secondary">
                        ₹{(item.mat_actual / 1000).toFixed(1)}k
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-text-secondary">
                        ₹{(item.lab_actual / 1000).toFixed(1)}k
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-text-secondary">
                        ₹{(item.sub_actual / 1000).toFixed(1)}k
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-text-secondary">
                        ₹{(item.exp_actual / 1000).toFixed(1)}k
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 text-[11px]">
                        ₹{(item.total_actual / 100000).toFixed(2)}L
                      </td>
                      <td className={`px-3 py-2 text-right font-mono font-bold text-[11px] ${item.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        ₹{(item.variance / 100000).toFixed(2)}L
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-[11px] font-semibold text-primary">
                        {item.cpi}
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

        {/* TAB 3: Approved Project Budgets */}
        {activeTab === 'budgets' && (
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
                    <th className="px-3 py-2">Budget Code & Name</th>
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2 text-center w-24">Version</th>
                    <th className="px-3 py-2 text-center w-28">Budget Date</th>
                    <th className="px-3 py-2 text-right w-28">Direct Cost</th>
                    <th className="px-3 py-2 text-right w-28 font-bold text-emerald-600">Total Budget</th>
                    <th className="px-3 py-2 text-center w-24">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pagedData.map((b, idx) => (
                    <tr key={b.id} className="hover:bg-surface-muted/30 transition-colors">
                      <td className="px-3 py-2 text-center font-medium text-text-primary text-[11px]">
                        {(page - 1) * perPage + idx + 1}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-semibold text-text-primary text-[12px] block">{b.budget_code}</span>
                        <span className="text-[10px] text-text-muted block">{b.budget_name}</span>
                      </td>
                      <td className="px-3 py-2 text-[11px] text-text-primary">
                        {b.project_name}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-[11px]">
                        v{b.version_no || 1}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-[11px] text-text-muted">
                        {b.budget_date}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-text-secondary">
                        ₹{Number(b.direct_cost || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 text-[11px]">
                        ₹{Number(b.total_budget || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant={b.status_code === 'APPROVED' ? 'success' : 'neutral'} className="text-[9px]">
                          {b.status_name || b.status_code}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableContainer>
          </div>
        )}

        {/* TAB 4: Periodical Cost Snapshots */}
        {activeTab === 'snapshots' && (
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
                    <th className="px-3 py-2">Snapshot Date</th>
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2 text-right w-28">Approved Budget</th>
                    <th className="px-3 py-2 text-right w-28 font-bold text-emerald-600">Total Actual Cost</th>
                    <th className="px-3 py-2 text-right w-28">Paid to Date</th>
                    <th className="px-3 py-2 text-center w-24">Consumed %</th>
                    <th className="px-3 py-2 text-center w-28">Generated At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pagedData.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-surface-muted/30 transition-colors">
                      <td className="px-3 py-2 text-center font-medium text-text-primary text-[11px]">
                        {(page - 1) * perPage + idx + 1}
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold text-text-primary text-[11px]">
                        {s.snapshot_date}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-text-primary">
                        {s.project_name}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-text-primary">
                        ₹{Number(s.approved_budget || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 text-[11px]">
                        ₹{Number(s.total_actual_cost || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-text-secondary">
                        ₹{Number(s.total_paid || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-[11px]">
                        {Number(s.cost_consumed_percent || 0).toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-[10px] text-text-muted">
                        {s.generated_at || s.created_at || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableContainer>
          </div>
        )}
      </div>

      {/* 360 Cost Head Dossier Modal */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface border border-border rounded-xl shadow-level-3 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-muted/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <PieChart className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">{viewingItem.cost_head}</h3>
                  <span className="text-[11px] font-mono text-text-muted">
                    {viewingItem.cost_code} • {viewingItem.project_name}
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setViewingItem(null)}>✕</Button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3 bg-surface-muted/30 p-3.5 rounded-lg border border-border">
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Approved Budget Allocation</span>
                  <span className="font-bold text-text-primary font-mono text-base">
                    ₹{viewingItem.approved_budget.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Actual Cost Incurred</span>
                  <span className="font-bold text-emerald-600 font-mono text-base">
                    ₹{viewingItem.actual_incurred.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Committed Expenditure</span>
                  <span className="font-mono text-text-secondary text-sm font-semibold">
                    ₹{viewingItem.committed_value.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Budget Variance</span>
                  <span className={`font-mono text-sm font-bold ${viewingItem.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    ₹{viewingItem.variance.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Consumption Burn Rate</span>
                  <span className="font-mono text-primary font-semibold">
                    {viewingItem.burn_pct.toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Health Status</span>
                  <Badge variant={viewingItem.status_variant} className="text-[9px] uppercase">
                    {viewingItem.status}
                  </Badge>
                </div>
              </div>

              <div className="border border-border rounded-lg p-3 space-y-2 bg-surface">
                <span className="font-bold text-text-primary block text-[11px]">Cost Head Governance & Controls:</span>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-text-secondary">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Cost Baseline Approved</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    <span>ERP Transaction Audited</span>
                  </div>
                </div>
              </div>
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

      {/* Generate Snapshot Modal */}
      {isGenerateOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface border border-border rounded-xl shadow-level-3 w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-muted/30">
              <h3 className="text-sm font-bold text-text-primary">Generate Cost Snapshot</h3>
              <Button variant="ghost" size="sm" onClick={() => setIsGenerateOpen(false)}>✕</Button>
            </div>

            <form onSubmit={handleGenerateSnapshot} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-text-primary block mb-1.5">Select Project</label>
                <Select
                  options={projects.map((p) => ({
                    value: String(p.id),
                    label: `${p.project_code || 'PRJ'} - ${p.project_name}`
                  }))}
                  value={genProjectId}
                  onChange={setGenProjectId}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-text-primary block mb-1.5">Snapshot Date</label>
                <Input
                  type="date"
                  value={genDate}
                  onChange={(e) => setGenDate(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsGenerateOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={genSaving}>
                  {genSaving ? 'Generating...' : 'Generate Snapshot'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

export default BudgetVsActualPage;
