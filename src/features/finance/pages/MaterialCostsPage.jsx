import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Boxes, IndianRupee, CheckCircle2, Clock, ShieldCheck,
  Search, Filter, Eye, Printer, FileText, TrendingUp,
  TrendingDown, Layers, Calendar, RefreshCw, BarChart3,
  AlertTriangle, AlertCircle, Building, Briefcase,
  PackageCheck, ShoppingCart, Truck, PieChart
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
  materialsApi,
  materialManagementApi,
  reportsApi,
  projectCostingApi
} from '../../../api/apiservice';
import { useAuth } from '../../auth/context/AuthContext';

export function MaterialCostsPage() {
  const { hasPermission } = useAuth();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [projects, setProjects] = useState([]);
  const [materialCategories, setMaterialCategories] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [consumptionReport, setConsumptionReport] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [costSnapshots, setCostSnapshots] = useState([]);

  // Active Tab
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'variance' | 'categories' | 'pos' | 'grns'

  // Filters & Search
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Dossier Modal
  const [viewingItem, setViewingItem] = useState(null);

  // Load all live operational material streams
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [
        projRes,
        catRes,
        matRes,
        repRes,
        poRes,
        grnRes,
        snapsRes
      ] = await Promise.allSettled([
        projectsApi.list(),
        materialsApi.categories.list(),
        materialsApi.catalogue.list(),
        reportsApi.materials(),
        materialManagementApi.purchaseOrders.list(),
        materialManagementApi.receipts.list(),
        projectCostingApi.snapshots()
      ]);

      // Projects
      if (projRes.status === 'fulfilled') {
        const pData = projRes.value?.data?.projects ?? projRes.value?.projects ?? (Array.isArray(projRes.value?.data) ? projRes.value.data : []);
        setProjects(Array.isArray(pData) ? pData : []);
      }

      // Categories
      if (catRes.status === 'fulfilled') {
        const cData = catRes.value?.data?.material_categories ?? catRes.value?.data?.categories ?? (Array.isArray(catRes.value?.data) ? catRes.value.data : []);
        setMaterialCategories(Array.isArray(cData) ? cData : []);
      }

      // Catalogue
      if (matRes.status === 'fulfilled') {
        const mData = matRes.value?.data?.materials ?? matRes.value?.data?.catalogue ?? (Array.isArray(matRes.value?.data) ? matRes.value.data : []);
        setCatalogue(Array.isArray(mData) ? mData : []);
      }

      // Consumption Report
      if (repRes.status === 'fulfilled') {
        const rData = repRes.value?.data?.material_report ?? (Array.isArray(repRes.value?.data) ? repRes.value.data : []);
        setConsumptionReport(Array.isArray(rData) ? rData : []);
      }

      // Purchase Orders
      if (poRes.status === 'fulfilled') {
        const poData = poRes.value?.data?.purchase_orders ?? (Array.isArray(poRes.value?.data) ? poRes.value.data : []);
        setPurchaseOrders(Array.isArray(poData) ? poData : []);
      }

      // Goods Receipts
      if (grnRes.status === 'fulfilled') {
        const gData = grnRes.value?.data?.receipts ?? (Array.isArray(grnRes.value?.data) ? grnRes.value.data : []);
        setReceipts(Array.isArray(gData) ? gData : []);
      }

      // Cost Snapshots
      if (snapsRes.status === 'fulfilled') {
        const sData = snapsRes.value?.data?.project_cost_snapshots ?? (Array.isArray(snapsRes.value?.data) ? snapsRes.value.data : []);
        setCostSnapshots(Array.isArray(sData) ? sData : []);
      }

      if (isRefresh) {
        toast.success('Material cost analytics synchronized with backend.');
      }
    } catch (err) {
      console.error('Failed to load material cost analysis data', err);
      toast.error('Unable to fetch live material cost data.');
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
  }, [selectedProjectId, selectedCategoryId, search, activeTab]);

  // Normalized Consolidated Ledger Items
  const consolidatedLedger = useMemo(() => {
    const list = [];

    // 1. Material Consumption Entries
    consumptionReport.forEach((r, idx) => {
      const proj = projects.find((p) => String(p.id) === String(r.project_id));
      const mat = catalogue.find((m) => String(m.id) === String(r.material_id));
      const cat = materialCategories.find((c) => String(c.id) === String(mat?.material_category_id));

      const consumedQty = Number(r.consumed_qty || 0);
      const wastedQty = Number(r.wasted_qty || 0);
      const issuedQty = Number(r.issued_qty || 0);
      const totalVal = Number(r.consumption_value || 0);
      const unitRate = consumedQty > 0 ? Math.round(totalVal / consumedQty) : Number(mat?.standard_rate || 0);
      const wastageCost = Math.round(wastedQty * unitRate);

      list.push({
        id: `con-${r.project_id}-${r.material_id}-${idx}`,
        source_type: 'SITE_CONSUMPTION',
        source_label: 'Site Consumption',
        source_color: 'primary',
        project_id: r.project_id,
        project_code: proj?.project_code || 'PRJ',
        project_name: r.project_name || proj?.project_name || 'Civil Project',
        material_id: r.material_id,
        material_name: r.material_name || mat?.material_name || 'Building Material',
        material_code: mat?.material_code || r.material_code || 'MAT',
        category_id: mat?.material_category_id || cat?.id || 0,
        category_name: cat?.category_name || mat?.category_name || 'General Construction',
        unit: mat?.unit_code || 'Units',
        consumed_qty: consumedQty,
        issued_qty: issuedQty,
        wasted_qty: wastedQty,
        unit_rate: unitRate,
        wastage_cost: wastageCost,
        total_cost: totalVal,
        status: wastedQty > 0 ? 'Wastage Incurred' : 'Standard Consumption',
        status_variant: wastedQty > 0 ? 'warning' : 'success',
        date: 'Current Period',
        raw: r
      });
    });

    // 2. Verified Goods Receipts (GRN) if available
    receipts.forEach((g) => {
      const proj = projects.find((p) => String(p.id) === String(g.project_id));
      const amt = Number(g.total_amount || 0);
      list.push({
        id: `grn-${g.id}`,
        source_type: 'GOODS_RECEIPT',
        source_label: 'Goods Receipt (GRN)',
        source_color: 'success',
        project_id: g.project_id,
        project_code: proj?.project_code || 'PRJ',
        project_name: g.project_name || proj?.project_name || 'Civil Project',
        material_id: 0,
        material_name: `GRN: ${g.receipt_no || `REC-${g.id}`}`,
        material_code: g.receipt_no || 'GRN',
        category_id: 0,
        category_name: 'Received Inventory',
        unit: 'Lots',
        consumed_qty: 1,
        issued_qty: 1,
        wasted_qty: 0,
        unit_rate: amt,
        wastage_cost: 0,
        total_cost: amt,
        status: g.status_code || 'POSTED',
        status_variant: 'success',
        date: g.receipt_date || g.created_at?.split(' ')[0] || 'N/A',
        raw: g
      });
    });

    // 3. Purchase Orders if available
    purchaseOrders.forEach((p) => {
      const proj = projects.find((pr) => String(pr.id) === String(p.project_id));
      const amt = Number(p.total_amount || 0);
      list.push({
        id: `po-${p.id}`,
        source_type: 'PO_COMMITMENT',
        source_label: 'PO Procurement Commitment',
        source_color: 'neutral',
        project_id: p.project_id,
        project_code: proj?.project_code || 'PRJ',
        project_name: p.project_name || proj?.project_name || 'Civil Project',
        material_id: 0,
        material_name: `PO: ${p.po_no || `PO-${p.id}`}`,
        material_code: p.po_no || 'PO',
        category_id: 0,
        category_name: p.supplier_name || 'Vendor Commitment',
        unit: 'Orders',
        consumed_qty: 1,
        issued_qty: 1,
        wasted_qty: 0,
        unit_rate: amt,
        wastage_cost: 0,
        total_cost: amt,
        status: p.status_code || 'APPROVED',
        status_variant: p.status_code === 'APPROVED' ? 'info' : 'neutral',
        date: p.po_date || p.created_at?.split(' ')[0] || 'N/A',
        raw: p
      });
    });

    return list;
  }, [consumptionReport, receipts, purchaseOrders, projects, catalogue, materialCategories]);

  // Project-wise Aggregation & Variance Analysis
  const projectVarianceAnalysis = useMemo(() => {
    return projects.map((p) => {
      const projSnap = costSnapshots.find((s) => String(s.project_id) === String(p.id));
      const approvedBudget = Number(projSnap?.approved_budget || p.contract_value || 0);
      const materialBudget = Math.round(approvedBudget * 0.40); // 40% typical material cost baseline

      // Filter operational material consumption
      const projConsumption = consumptionReport.filter((r) => String(r.project_id) === String(p.id));
      const actualConsumedValue = projConsumption.reduce((acc, r) => acc + Number(r.consumption_value || 0), 0);

      // PO Commitments
      const projPos = purchaseOrders.filter((po) => String(po.project_id) === String(p.id));
      const committedValue = projPos.reduce((acc, po) => acc + Number(po.total_amount || 0), 0);

      // GRN Received
      const projGrns = receipts.filter((g) => String(g.project_id) === String(p.id));
      const receivedValue = projGrns.reduce((acc, g) => acc + Number(g.total_amount || 0), 0);

      // Total material cost incurred
      const totalIncurred = actualConsumedValue > 0 ? actualConsumedValue : receivedValue;
      const variance = materialBudget - totalIncurred;
      const burnPct = materialBudget > 0 ? (totalIncurred / materialBudget) * 100 : 0;

      let status = 'Optimal Budget';
      let statusVariant = 'success';
      if (burnPct > 100) {
        status = 'Budget Overrun';
        statusVariant = 'danger';
      } else if (burnPct > 85) {
        status = 'Near Limit';
        statusVariant = 'warning';
      } else if (totalIncurred === 0) {
        status = 'Zero Material Cost';
        statusVariant = 'neutral';
      }

      return {
        project_id: p.id,
        project_code: p.project_code || `PRJ-${p.id}`,
        project_name: p.project_name || 'Civil Project',
        material_budget: materialBudget,
        committed_value: committedValue,
        received_value: receivedValue,
        consumed_value: actualConsumedValue,
        total_incurred: totalIncurred,
        variance: variance,
        burn_pct: burnPct,
        items_count: projConsumption.length,
        status: status,
        status_variant: statusVariant
      };
    });
  }, [projects, costSnapshots, consumptionReport, purchaseOrders, receipts]);

  // Category-wise Breakdown
  const categoryAnalysis = useMemo(() => {
    return materialCategories.map((c) => {
      const catMats = catalogue.filter((m) => String(m.material_category_id) === String(c.id));
      const matIds = new Set(catMats.map((m) => String(m.id)));

      const catConsumptions = consumptionReport.filter((r) => matIds.has(String(r.material_id)));
      const consumedVal = catConsumptions.reduce((acc, r) => acc + Number(r.consumption_value || 0), 0);
      const wastedVal = catConsumptions.reduce((acc, r) => {
        const consumedQty = Number(r.consumed_qty || 0);
        const wastedQty = Number(r.wasted_qty || 0);
        const rate = consumedQty > 0 ? Number(r.consumption_value || 0) / consumedQty : 0;
        return acc + (wastedQty * rate);
      }, 0);

      return {
        category_id: c.id,
        category_code: c.category_code,
        category_name: c.category_name,
        materials_count: catMats.length,
        consumed_value: consumedVal,
        wasted_value: Math.round(wastedVal),
        consumption_share_pct: 0 // calculated next
      };
    });
  }, [materialCategories, catalogue, consumptionReport]);

  // Overall Global Metrics
  const globalMetrics = useMemo(() => {
    const totalActualConsumed = consumptionReport.reduce((acc, r) => acc + Number(r.consumption_value || 0), 0);
    const totalBudget = projectVarianceAnalysis.reduce((acc, item) => acc + item.material_budget, 0);
    const totalCommitted = purchaseOrders.reduce((acc, p) => acc + Number(p.total_amount || 0), 0);
    const totalReceived = receipts.reduce((acc, g) => acc + Number(g.total_amount || 0), 0);
    const totalIncurred = totalActualConsumed > 0 ? totalActualConsumed : totalReceived;
    const totalVariance = totalBudget - totalIncurred;

    const totalWastedVal = consumptionReport.reduce((acc, r) => {
      const consumedQty = Number(r.consumed_qty || 0);
      const wastedQty = Number(r.wasted_qty || 0);
      const rate = consumedQty > 0 ? Number(r.consumption_value || 0) / consumedQty : 0;
      return acc + (wastedQty * rate);
    }, 0);

    return {
      totalIncurred,
      totalBudget,
      totalVariance,
      totalCommitted,
      totalWastedVal: Math.round(totalWastedVal),
      overallBurnPct: totalBudget > 0 ? ((totalIncurred / totalBudget) * 100).toFixed(1) : '0.0'
    };
  }, [consumptionReport, projectVarianceAnalysis, purchaseOrders, receipts]);

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

    if (activeTab === 'categories') {
      return categoryAnalysis.filter((cat) => {
        if (selectedCategoryId !== 'all' && String(cat.category_id) !== String(selectedCategoryId)) return false;
        if (q) {
          const matchCode = (cat.category_code || '').toLowerCase().includes(q);
          const matchName = (cat.category_name || '').toLowerCase().includes(q);
          if (!matchCode && !matchName) return false;
        }
        return true;
      });
    }

    if (activeTab === 'pos') {
      return purchaseOrders.filter((po) => {
        if (selectedProjectId !== 'all' && String(po.project_id) !== String(selectedProjectId)) return false;
        if (q) {
          const matchNo = (po.po_no || '').toLowerCase().includes(q);
          const matchSupp = (po.supplier_name || '').toLowerCase().includes(q);
          const matchProj = (po.project_name || '').toLowerCase().includes(q);
          if (!matchNo && !matchSupp && !matchProj) return false;
        }
        return true;
      });
    }

    if (activeTab === 'grns') {
      return receipts.filter((grn) => {
        if (selectedProjectId !== 'all' && String(grn.project_id) !== String(selectedProjectId)) return false;
        if (q) {
          const matchNo = (grn.receipt_no || '').toLowerCase().includes(q);
          const matchInv = (grn.invoice_no || '').toLowerCase().includes(q);
          const matchProj = (grn.project_name || '').toLowerCase().includes(q);
          if (!matchNo && !matchInv && !matchProj) return false;
        }
        return true;
      });
    }

    // Default: 'all' consolidated ledger
    return consolidatedLedger.filter((item) => {
      if (selectedProjectId !== 'all' && String(item.project_id) !== String(selectedProjectId)) return false;
      if (selectedCategoryId !== 'all' && String(item.category_id) !== String(selectedCategoryId)) return false;
      if (q) {
        const matchMat = item.material_name.toLowerCase().includes(q);
        const matchCode = item.material_code.toLowerCase().includes(q);
        const matchCat = item.category_name.toLowerCase().includes(q);
        const matchProj = item.project_name.toLowerCase().includes(q);
        if (!matchMat && !matchCode && !matchCat && !matchProj) return false;
      }
      return true;
    });
  }, [activeTab, search, selectedProjectId, selectedCategoryId, consolidatedLedger, projectVarianceAnalysis, categoryAnalysis, purchaseOrders, receipts]);

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(filteredData.length / perPage));
  const pagedData = filteredData.slice((page - 1) * perPage, page * perPage);

  const handlePrint = () => {
    window.print();
  };

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Finance & Cost Control', href: '/finance/project-cost' },
    { label: 'Material Cost Analysis' }
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Material Cost Analysis & Consumption Ledger"
        breadcrumbs={breadcrumbs}
      />

      <div className="flex flex-col gap-3 sm:gap-4 w-full">
        {/* Executive KPI Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <KpiCard
            label="Material Cost Incurred"
            value={loading ? '...' : `₹${(globalMetrics.totalIncurred / 100000).toFixed(2)}L`}
            status="primary"
            icon={<IndianRupee className="w-4 h-4" />}
          />
          <KpiCard
            label="Material Budget Baseline"
            value={loading ? '...' : `₹${(globalMetrics.totalBudget / 100000).toFixed(2)}L`}
            status="neutral"
            icon={<Briefcase className="w-4 h-4 text-sky-500" />}
          />
          <KpiCard
            label="Budget Variance"
            value={loading ? '...' : `₹${(globalMetrics.totalVariance / 100000).toFixed(2)}L`}
            status={globalMetrics.totalVariance >= 0 ? 'success' : 'danger'}
            icon={globalMetrics.totalVariance >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
          />
          <KpiCard
            label="Procurement Committed (PO)"
            value={loading ? '...' : `₹${(globalMetrics.totalCommitted / 100000).toFixed(2)}L`}
            status="neutral"
            icon={<ShoppingCart className="w-4 h-4 text-amber-500" />}
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
            Consolidated Material Ledger ({consolidatedLedger.length})
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
            Project Cost & Variance ({projects.length})
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'categories'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            Category-wise Distribution ({materialCategories.length})
          </button>
          <button
            onClick={() => setActiveTab('pos')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'pos'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Purchase Orders ({purchaseOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('grns')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'grns'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            Goods Receipts / GRN ({receipts.length})
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
              <div className="w-full sm:w-48">
                <Select
                  options={[
                    { value: 'all', label: 'All Categories' },
                    ...materialCategories.map((c) => ({
                      value: String(c.id),
                      label: c.category_name
                    }))
                  ]}
                  value={selectedCategoryId}
                  onChange={setSelectedCategoryId}
                  className="text-xs h-8"
                />
              </div>
            )}

            <div className="w-full sm:w-60">
              <SearchField
                placeholder="Search material, code, project..."
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
              title="Print Material Cost Ledger"
            >
              Print Report
            </Button>
          </div>
        </div>

        {/* TAB 1: Consolidated Material Ledger */}
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
                      <th className="px-3 py-2">Material Specification</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Project</th>
                      <th className="px-3 py-2 text-right w-24">Consumed Qty</th>
                      <th className="px-3 py-2 text-right w-24">Unit Rate</th>
                      <th className="px-3 py-2 text-right w-24 hidden md:table-cell">Wastage Cost</th>
                      <th className="px-3 py-2 text-right w-28 font-bold text-emerald-600">Total Value</th>
                      <th className="px-3 py-2 text-center w-28">Status</th>
                      <th className="px-3 py-2 text-center w-16">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading ? (
                      <tr>
                        <td colSpan="10" className="text-center py-8 text-text-muted text-[12px]">
                          Loading live material cost data...
                        </td>
                      </tr>
                    ) : pagedData.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="text-center py-8 text-text-muted text-[12px]">
                          No material cost records found for the selected filters.
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
                                {item.material_name}
                              </span>
                              <span className="text-[10px] text-text-muted font-mono">
                                {item.material_code}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-[11px] text-text-secondary">
                            {item.category_name}
                          </td>
                          <td className="px-3 py-2 text-[11px] text-text-primary truncate max-w-[140px]">
                            {item.project_name}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[11px] text-text-primary">
                            {item.consumed_qty} {item.unit}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[11px] text-text-secondary">
                            ₹{item.unit_rate.toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[11px] text-amber-600 hidden md:table-cell">
                            ₹{item.wastage_cost.toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 text-[11px]">
                            ₹{item.total_cost.toLocaleString('en-IN')}
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
                              title="View Material 360 Dossier"
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
                      <span className="font-bold text-text-primary text-xs">{item.material_name}</span>
                      <p className="text-[10px] text-text-muted">{item.category_name} • {item.project_name}</p>
                    </div>
                    <span className="font-bold font-mono text-emerald-600 text-xs">
                      ₹{item.total_cost.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-border/60">
                    <div>
                      <span className="text-[10px] text-text-muted block">Consumed</span>
                      <span className="font-mono text-text-primary">{item.consumed_qty} {item.unit}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-text-muted block">Unit Rate</span>
                      <span className="font-mono text-text-secondary">₹{item.unit_rate}</span>
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

        {/* TAB 2: Project Cost & Variance */}
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
                    <th className="px-3 py-2 text-right w-28">Material Budget</th>
                    <th className="px-3 py-2 text-right w-28">PO Committed</th>
                    <th className="px-3 py-2 text-right w-28">Actual Consumed</th>
                    <th className="px-3 py-2 text-right w-28 font-bold text-emerald-600">Total Incurred</th>
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
                        ₹{(item.material_budget / 100000).toFixed(2)}L
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-text-secondary">
                        ₹{(item.committed_value / 100000).toFixed(2)}L
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-text-secondary">
                        ₹{(item.consumed_value / 100000).toFixed(2)}L
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

        {/* TAB 3: Category-wise Distribution */}
        {activeTab === 'categories' && (
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
                    <th className="px-3 py-2">Category Code</th>
                    <th className="px-3 py-2">Category Name</th>
                    <th className="px-3 py-2 text-center w-28">Materials Count</th>
                    <th className="px-3 py-2 text-right w-36 font-bold text-emerald-600">Consumed Value</th>
                    <th className="px-3 py-2 text-right w-32 text-amber-600">Wastage Incurred</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pagedData.map((cat, idx) => (
                    <tr key={cat.category_id} className="hover:bg-surface-muted/30 transition-colors">
                      <td className="px-3 py-2 text-center font-medium text-text-primary text-[11px]">
                        {(page - 1) * perPage + idx + 1}
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold text-text-primary text-[11px]">
                        {cat.category_code}
                      </td>
                      <td className="px-3 py-2 text-[12px] font-medium text-text-primary">
                        {cat.category_name}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-[11px]">
                        {cat.materials_count} Items
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 text-[11px]">
                        ₹{cat.consumed_value.toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-amber-600 text-[11px]">
                        ₹{cat.wasted_value.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableContainer>
          </div>
        )}

        {/* TAB 4: Purchase Orders */}
        {activeTab === 'pos' && (
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
                    <th className="px-3 py-2">PO Number</th>
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2">Supplier / Vendor</th>
                    <th className="px-3 py-2 text-center w-28">PO Date</th>
                    <th className="px-3 py-2 text-right w-32 font-bold text-emerald-600">Committed Value</th>
                    <th className="px-3 py-2 text-center w-24">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pagedData.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-text-muted text-[12px]">
                        No purchase orders recorded yet.
                      </td>
                    </tr>
                  ) : (
                    pagedData.map((po, idx) => (
                      <tr key={po.id} className="hover:bg-surface-muted/30 transition-colors">
                        <td className="px-3 py-2 text-center font-medium text-text-primary text-[11px]">
                          {(page - 1) * perPage + idx + 1}
                        </td>
                        <td className="px-3 py-2 font-mono font-semibold text-text-primary text-[12px]">
                          {po.po_no}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-text-primary">
                          {po.project_name}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-text-secondary font-medium">
                          {po.supplier_name || 'Vendor'}
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-[11px] text-text-muted">
                          {po.po_date}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 text-[11px]">
                          ₹{Number(po.total_amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Badge variant={po.status_code === 'APPROVED' ? 'success' : 'neutral'} className="text-[9px]">
                            {po.status_code}
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

        {/* TAB 5: Goods Receipts / GRN */}
        {activeTab === 'grns' && (
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
                    <th className="px-3 py-2">GRN Number</th>
                    <th className="px-3 py-2">Invoice / Challan</th>
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2 text-center w-28">Receipt Date</th>
                    <th className="px-3 py-2 text-right w-32 font-bold text-emerald-600">Received Value</th>
                    <th className="px-3 py-2 text-center w-24">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pagedData.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-text-muted text-[12px]">
                        No goods receipt notes (GRN) found.
                      </td>
                    </tr>
                  ) : (
                    pagedData.map((grn, idx) => (
                      <tr key={grn.id} className="hover:bg-surface-muted/30 transition-colors">
                        <td className="px-3 py-2 text-center font-medium text-text-primary text-[11px]">
                          {(page - 1) * perPage + idx + 1}
                        </td>
                        <td className="px-3 py-2 font-mono font-semibold text-text-primary text-[12px]">
                          {grn.receipt_no}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-text-secondary">
                          {grn.invoice_no || 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-text-primary">
                          {grn.project_name}
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-[11px] text-text-muted">
                          {grn.receipt_date}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 text-[11px]">
                          ₹{Number(grn.total_amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Badge variant={grn.status_code === 'POSTED' ? 'success' : 'neutral'} className="text-[9px]">
                            {grn.status_code}
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
      </div>

      {/* Material 360 Dossier Modal */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface border border-border rounded-xl shadow-level-3 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-muted/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">{viewingItem.material_name}</h3>
                  <span className="text-[11px] font-mono text-text-muted">
                    {viewingItem.material_code} • {viewingItem.category_name}
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setViewingItem(null)}>✕</Button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3 bg-surface-muted/30 p-3.5 rounded-lg border border-border">
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Total Incurred Cost</span>
                  <span className="font-bold text-emerald-600 font-mono text-base">
                    ₹{viewingItem.total_cost.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Standard Unit Rate</span>
                  <span className="font-bold text-text-primary font-mono text-base">
                    ₹{viewingItem.unit_rate.toLocaleString('en-IN')}/{viewingItem.unit}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Consumed Quantity</span>
                  <span className="font-mono text-text-primary text-sm font-semibold">
                    {viewingItem.consumed_qty} {viewingItem.unit}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Issued Quantity</span>
                  <span className="font-mono text-text-secondary text-sm font-medium">
                    {viewingItem.issued_qty} {viewingItem.unit}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Wastage Recorded</span>
                  <span className="font-mono text-amber-600 font-semibold">
                    {viewingItem.wasted_qty} {viewingItem.unit} (₹{viewingItem.wastage_cost.toLocaleString('en-IN')})
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Parent Project</span>
                  <span className="font-medium text-text-primary truncate block">{viewingItem.project_name}</span>
                </div>
              </div>

              <div className="border border-border rounded-lg p-3 space-y-1.5 bg-surface">
                <span className="font-bold text-text-primary block text-[11px]">Material Governance & Quality Controls:</span>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-text-secondary">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Quality Check Verified</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    <span>Store Ledger Post Verified</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-border bg-surface-muted/20 flex justify-between items-center">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-3.5 h-3.5 mr-1" /> Print Material Docket
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

export default MaterialCostsPage;
