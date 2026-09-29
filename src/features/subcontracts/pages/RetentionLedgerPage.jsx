import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Lock, CheckCircle2, IndianRupee, Clock, ShieldCheck,
  Search, Filter, Eye, Edit, Trash2, Plus, Building,
  Check, AlertCircle, Sparkles, Printer, ArrowRight, Unlock, Calculator,
  FileText, ChevronRight, Download, RefreshCw, Calendar, Tag, Info, ExternalLink
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
import { FormField } from '../../../components/composite/FormField';
import { toast } from '../../../components/composite/Toast';
import { subcontractsApi, projectsApi } from '../../../api/apiservice';
import { useAuth } from '../../auth/context/AuthContext';

const INR = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;

// Local storage helper for persisting release transactions
const STORAGE_KEY = 'civildesk_retention_releases';

const getStoredReleases = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveStoredRelease = (release) => {
  const existing = getStoredReleases();
  existing.unshift(release);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch (err) {
    console.warn('Failed to save release to localStorage', err);
  }
};

export function RetentionLedgerPage() {
  const { hasPermission } = useAuth();
  const [projects, setProjects] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [raBills, setRaBills] = useState([]);
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filters & Pagination
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Modals
  const [viewingItem, setViewingItem] = useState(null);
  const [releaseModalItem, setReleaseModalItem] = useState(null);
  const [releaseForm, setReleaseForm] = useState({
    amount: '',
    release_date: new Date().toISOString().split('T')[0],
    payment_mode: 'Bank Transfer (NEFT/RTGS)',
    reference_no: '',
    remarks: '',
  });
  const [savingRelease, setSavingRelease] = useState(false);

  // Load live data from Backend API services
  useEffect(() => {
    setLoading(true);
    Promise.all([
      projectsApi.list().catch(() => ({ data: [] })),
      subcontractsApi.contractors.list().catch(() => ({ data: [] })),
      subcontractsApi.workOrders.list().catch(() => ({ data: [] })),
      subcontractsApi.raBills.list().catch(() => ({ data: [] })),
    ])
      .then(([projRes, contrRes, woRes, raRes]) => {
        const pList = projRes?.data?.projects ?? projRes?.projects ?? (Array.isArray(projRes?.data) ? projRes.data : []);
        setProjects(Array.isArray(pList) ? pList : []);

        const cList = contrRes?.data?.subcontractors ?? contrRes?.data?.data ?? [];
        setContractors(Array.isArray(cList) ? cList : []);

        const wList = woRes?.data?.work_orders ?? woRes?.work_orders ?? (Array.isArray(woRes?.data) ? woRes.data : []);
        setWorkOrders(Array.isArray(wList) ? wList : []);

        const rList = raRes?.data?.ra_bills ?? raRes?.ra_bills ?? (Array.isArray(raRes?.data) ? raRes.data : []);
        setRaBills(Array.isArray(rList) ? rList : []);

        // Load stored release payments
        setReleases(getStoredReleases());
      })
      .catch((err) => {
        console.error('Failed to load retention ledger data:', err);
        toast.error('Failed to load subcontract ledger data.');
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  // Effective Order Value Helper
  const getOrderEffectiveValue = (w) => {
    const rawVal = Number(w.total_order_value || w.revised_order_value || 0);
    const adv = Number(w.advance_amount || 0);
    if (rawVal === 0 && adv > 0) {
      return Math.round(adv * 10);
    }
    return rawVal;
  };

  // Build Unified Retention Accounts
  const retentionAccounts = useMemo(() => {
    if (!workOrders.length && !loading) return [];

    // Group RA bills by work_order_id
    const raByWo = {};
    raBills.forEach((b) => {
      const wId = String(b.work_order_id || '');
      if (!raByWo[wId]) raByWo[wId] = [];
      raByWo[wId].push(b);
    });

    // Group Releases by work_order_id
    const relByWo = {};
    releases.forEach((rel) => {
      const wId = String(rel.work_order_id || '');
      if (!relByWo[wId]) relByWo[wId] = [];
      relByWo[wId].push(rel);
    });

    return workOrders.map((w) => {
      const proj = projects.find((p) => String(p.id) === String(w.project_id));
      const contr = contractors.find((c) => String(c.id) === String(w.contractor_id));
      const orderValue = getOrderEffectiveValue(w);
      const retentionPct = Number(w.retention_percent ?? 5.0);

      const associatedRaBills = raByWo[String(w.id)] || [];
      const woReleases = relByWo[String(w.id)] || [];

      // Calculate total retention deducted from certified RA bills
      const actualRaRetention = associatedRaBills.reduce((acc, b) => {
        return acc + Number(b.retention_amount || 0);
      }, 0);

      // Total certified work value
      const totalCertified = associatedRaBills.reduce((acc, b) => {
        return acc + Number(b.gross_work_value || 0);
      }, Number(w.certified_amount || 0));

      // If RA bills exist with retention, use actual; otherwise project standard retention
      const hasActualRa = actualRaRetention > 0;
      const totalRetentionDeducted = hasActualRa
        ? actualRaRetention
        : Math.round(orderValue * (retentionPct / 100));

      // Total released to contractor
      const totalReleased = woReleases.reduce((acc, r) => acc + Number(r.release_amount || 0), 0);

      // Balance currently held in escrow
      const balanceHeld = Math.max(0, totalRetentionDeducted - totalReleased);

      // Defect Liability Period (DLP) Expiry from work order completion_date or project defect_liability_end_date
      let dlpDateStr = '—';
      let isMatured = false;
      let daysRemaining = null;

      const baseDate = w.completion_date || proj?.defect_liability_end_date;
      if (baseDate) {
        dlpDateStr = String(baseDate).split('T')[0];
        const d = new Date(baseDate);
        if (!isNaN(d.getTime())) {
          const today = new Date();
          const diffTime = d.getTime() - today.getTime();
          daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          isMatured = daysRemaining <= 0;
        }
      }

      // Compute status name & variant
      let statusName = 'In Progress';
      let statusVariant = 'neutral';

      if (balanceHeld === 0 && totalRetentionDeducted > 0) {
        statusName = 'Fully Released';
        statusVariant = 'success';
      } else if (totalReleased > 0 && balanceHeld > 0) {
        const pct = Math.round((totalReleased / totalRetentionDeducted) * 100);
        statusName = `Partially Released (${pct}%)`;
        statusVariant = 'info';
      } else if (isMatured && balanceHeld > 0) {
        statusName = 'DLP Matured';
        statusVariant = 'warning';
      } else if (String(w.status_code || '').toUpperCase().includes('ACTIVE') || String(w.status_code || '').toUpperCase().includes('APPROV')) {
        statusName = 'DLP Active';
        statusVariant = 'primary';
      }

      return {
        id: w.id,
        work_order_no: w.work_order_no,
        work_order_date: w.work_order_date,
        project_id: w.project_id,
        project_name: proj ? `${proj.project_code || 'PRJ'} - ${proj.project_name || proj.name}` : `Project #${w.project_id}`,
        contractor_id: w.contractor_id,
        contractor_name: contr?.contractor_name || `Subcontractor #${w.contractor_id}`,
        contractor_code: contr?.contractor_code || 'COW',
        bank_details: {
          bank_name: contr?.bank_name || '—',
          account_no: contr?.bank_account_no || '—',
          ifsc: contr?.bank_ifsc || '—',
          account_name: contr?.bank_account_name || contr?.contractor_name || '—',
        },
        package_title: w.scope_of_work || 'Subcontract Package',
        contract_order_value: orderValue,
        retention_percent: retentionPct,
        total_certified: totalCertified,
        total_retention_deducted: totalRetentionDeducted,
        is_projected: !hasActualRa,
        retention_released: totalReleased,
        balance_retention_held: balanceHeld,
        dlp_expiry_date: dlpDateStr,
        days_remaining: daysRemaining,
        is_dlp_matured: isMatured,
        status_name: statusName,
        status_variant: statusVariant,
        ra_bills: associatedRaBills,
        releases: woReleases,
        raw_work_order: w,
      };
    });
  }, [workOrders, raBills, contractors, projects, releases, loading]);

  // Safe Filtered List
  const filtered = useMemo(() => {
    return retentionAccounts.filter((r) => {
      // Project filter
      if (selectedProjectId !== 'all' && String(r.project_id) !== String(selectedProjectId)) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'held' && r.balance_retention_held <= 0) return false;
        if (statusFilter === 'partial' && (r.retention_released <= 0 || r.balance_retention_held <= 0)) return false;
        if (statusFilter === 'released' && (r.balance_retention_held > 0 || r.total_retention_deducted <= 0)) return false;
        if (statusFilter === 'matured' && (!r.is_dlp_matured || r.balance_retention_held <= 0)) return false;
      }

      // Search filter
      if (search) {
        const s = search.toLowerCase();
        const cont = String(r.contractor_name || '').toLowerCase();
        const code = String(r.contractor_code || '').toLowerCase();
        const wo = String(r.work_order_no || '').toLowerCase();
        const pack = String(r.package_title || '').toLowerCase();
        const proj = String(r.project_name || '').toLowerCase();
        if (!cont.includes(s) && !code.includes(s) && !wo.includes(s) && !pack.includes(s) && !proj.includes(s)) {
          return false;
        }
      }
      return true;
    });
  }, [retentionAccounts, selectedProjectId, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  // Overall KPIs
  const totalHeldInEscrow = useMemo(() => {
    return retentionAccounts.reduce((acc, r) => acc + Number(r.balance_retention_held || 0), 0);
  }, [retentionAccounts]);

  const totalReleasedAll = useMemo(() => {
    return retentionAccounts.reduce((acc, r) => acc + Number(r.retention_released || 0), 0);
  }, [retentionAccounts]);

  const activeAccountsCount = useMemo(() => {
    return retentionAccounts.filter((r) => r.balance_retention_held > 0).length;
  }, [retentionAccounts]);

  const totalProtectedValue = useMemo(() => {
    return retentionAccounts
      .filter((r) => r.balance_retention_held > 0)
      .reduce((acc, r) => acc + Number(r.contract_order_value || 0), 0);
  }, [retentionAccounts]);

  // Release Modal Handler
  const handleOpenRelease = (item) => {
    setReleaseModalItem(item);
    setReleaseForm({
      amount: String(item.balance_retention_held || '0'),
      release_date: new Date().toISOString().split('T')[0],
      payment_mode: 'Bank Transfer (NEFT/RTGS)',
      reference_no: `RET-${item.work_order_no.replace(/\D/g, '') || Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString().slice(-4)}`,
      remarks: item.is_dlp_matured
        ? 'Final DLP maturity release authorized after inspection.'
        : 'Interim milestone retention release.',
    });
  };

  const handleConfirmRelease = () => {
    if (!releaseModalItem) return;
    const rel = Number(releaseForm.amount || 0);

    if (rel <= 0) {
      toast.error('Please specify a valid positive release amount.');
      return;
    }
    if (rel > releaseModalItem.balance_retention_held) {
      toast.error(`Release amount cannot exceed the available escrow balance of ${INR(releaseModalItem.balance_retention_held)}.`);
      return;
    }

    setSavingRelease(true);
    setTimeout(() => {
      const newRecord = {
        id: `REL-${Date.now()}`,
        work_order_id: releaseModalItem.id,
        work_order_no: releaseModalItem.work_order_no,
        contractor_name: releaseModalItem.contractor_name,
        release_amount: rel,
        release_date: releaseForm.release_date,
        payment_mode: releaseForm.payment_mode,
        reference_no: releaseForm.reference_no || `RET-REF-${Math.floor(100000 + Math.random() * 900000)}`,
        remarks: releaseForm.remarks || 'Retention release payment',
        created_at: new Date().toISOString(),
      };

      saveStoredRelease(newRecord);
      setReleases(getStoredReleases());

      // Update currently viewed dossier if open
      if (viewingItem && viewingItem.id === releaseModalItem.id) {
        setViewingItem((prev) => {
          const newRel = prev.retention_released + rel;
          const newBal = Math.max(0, prev.total_retention_deducted - newRel);
          return {
            ...prev,
            retention_released: newRel,
            balance_retention_held: newBal,
            releases: [newRecord, ...(prev.releases || [])],
            status_name: newBal === 0 ? '100% Fully Released (DLP Closed)' : `Partially Released (${Math.round((newRel / prev.total_retention_deducted) * 100)}%)`,
            status_variant: newBal === 0 ? 'success' : 'info',
          };
        });
      }

      toast.success(`Retention payment of ${INR(rel)} successfully recorded for ${releaseModalItem.contractor_name}.`);
      setReleaseModalItem(null);
      setSavingRelease(false);
    }, 300);
  };

  const handlePrint = () => {
    window.print();
  };

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Subcontract Management', href: '/subcontracts/work-orders' },
    { label: 'Retention Ledger & DLP' },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Subcontract Retention Money Ledger & Defect Liability (DLP)"
        breadcrumbs={breadcrumbs}
        description="Monitor subcontract retention withholdings, escrow balances, defect liability warranties, and process milestone releases."
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            className="h-8 text-xs text-text-secondary hover:text-text-primary"
            title="Refresh Data"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-8 text-xs text-text-secondary hover:text-text-primary"
            title="Print Retention Statement"
          >
            <Printer className="w-3.5 h-3.5 mr-1" /> Print Report
          </Button>
        </div>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:gap-4 w-full">
        {/* KPI Summary Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <KpiCard
            label="Total Retention Held (Escrow)"
            value={INR(totalHeldInEscrow)}
            status="primary"
            icon={<Lock className="w-4 h-4 text-amber-500" />}
          />
          <KpiCard
            label="Released to Date"
            value={INR(totalReleasedAll)}
            status="success"
            icon={<Unlock className="w-4 h-4 text-emerald-500" />}
          />
          <KpiCard
            label="Active Retention Accounts"
            value={`${activeAccountsCount} Packages`}
            status="neutral"
            icon={<Calculator className="w-4 h-4 text-sky-500" />}
          />
          <KpiCard
            label="DLP Protected Contract Value"
            value={INR(totalProtectedValue)}
            status="neutral"
            icon={<ShieldCheck className="w-4 h-4 text-primary" />}
          />
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-surface border border-border rounded-lg p-2.5 sm:p-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="w-full sm:w-48">
              <Select
                options={[
                  { value: 'all', label: 'All Projects' },
                  ...projects.map((p) => ({
                    value: String(p.id),
                    label: p.project_name || p.name,
                  })),
                ]}
                value={selectedProjectId}
                onChange={setSelectedProjectId}
                className="text-xs h-8"
              />
            </div>

            <div className="w-full sm:w-44">
              <Select
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'held', label: 'Active Balance Held' },
                  { value: 'partial', label: 'Partially Released' },
                  { value: 'matured', label: 'DLP Matured (Release Ready)' },
                  { value: 'released', label: 'Fully Released (Closed)' },
                ]}
                value={statusFilter}
                onChange={setStatusFilter}
                className="text-xs h-8"
              />
            </div>

            <div className="w-full sm:w-56">
              <SearchField
                placeholder="Search contractor, WO no, package..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Desktop & Tablet Table - Balanced 7-column layout */}
        <div className="hidden sm:block border border-border rounded-lg bg-surface shadow-xs w-full overflow-x-auto">
          <table className="w-full text-left text-xs table-fixed min-w-[840px]">
            <thead className="bg-surface-muted text-text-secondary text-[11px] uppercase font-semibold border-b border-border tracking-wider">
              <tr>
                <th className="px-2 py-2.5 w-10 text-center">#</th>
                <th className="px-3 py-2.5 w-[29%]">WO & Scope Package</th>
                <th className="px-3 py-2.5 w-[23%]">Contractor & Project</th>
                <th className="px-3 py-2.5 text-left w-[16%]">Retention in Escrow</th>
                <th className="px-3 py-2.5 text-center w-[12%]">DLP Expiry</th>
                <th className="px-3 py-2.5 text-center w-[11%]">Status</th>
                <th className="px-2 py-2.5 text-center w-[9%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-text-muted text-xs">
                    <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-primary" />
                    Loading retention ledger accounts...
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-text-muted text-xs">
                    No subcontract retention records found matching your filters.
                  </td>
                </tr>
              ) : (
                paged.map((r, idx) => (
                  <tr key={r.id || idx} className="hover:bg-surface-muted/30 transition-colors group">
                    <td className="px-2 py-2.5 text-center font-medium text-text-muted text-[11px]">
                      {(page - 1) * perPage + idx + 1}
                    </td>

                    <td className="px-3 py-2.5">
                      <div className="flex flex-col min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                            {r.work_order_no}
                          </span>
                          <span className="text-[10px] text-text-muted font-mono">
                            {r.work_order_date ? r.work_order_date.split('T')[0] : '—'}
                          </span>
                        </div>
                        <span className="font-semibold text-text-primary text-[12px] truncate pt-1" title={r.package_title}>
                          {r.package_title}
                        </span>
                      </div>
                    </td>

                    <td className="px-3 py-2.5">
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="font-semibold text-text-primary text-[12px] truncate" title={r.contractor_name}>
                          {r.contractor_name}
                        </span>
                        <span className="text-[10px] text-text-muted truncate pt-0.5">
                          <span className="font-mono text-text-secondary">{r.contractor_code}</span> • {r.project_name}
                        </span>
                      </div>
                    </td>

                    <td className="px-3 py-2.5 text-left">
                      <div className="flex flex-col">
                        <span className="font-bold text-amber-600 text-xs tabular-nums">
                          {INR(r.balance_retention_held)}
                        </span>
                        <span className="text-[10px] text-text-muted tabular-nums">
                          {r.retention_percent}% of {INR(r.contract_order_value)}
                        </span>
                        {r.retention_released > 0 && (
                          <span className="text-[10px] text-emerald-600 font-medium tabular-nums">
                            Rel: {INR(r.retention_released)}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      <div className="flex flex-col items-center">
                        <span className={`text-[11px] font-semibold tabular-nums ${
                          r.is_dlp_matured ? 'text-rose-600 font-bold' : 'text-text-primary'
                        }`}>
                          {r.dlp_expiry_date}
                        </span>
                        {r.dlp_expiry_date !== '—' && r.days_remaining !== null && (
                          <span className={`text-[10px] font-medium pt-0.5 ${
                            r.days_remaining <= 0 ? 'text-rose-600 font-bold' : 'text-emerald-700'
                          }`}>
                            {r.days_remaining <= 0 ? 'Matured / Ready' : `${r.days_remaining}d remaining`}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      <Badge variant={r.status_variant} className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">
                        {r.status_name}
                      </Badge>
                    </td>

                    <td className="px-2 py-2.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          className="p-1.5 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                          title="View Retention Dossier 360"
                          onClick={() => setViewingItem(r)}
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {r.balance_retention_held > 0 ? (
                          <button
                            type="button"
                            className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors"
                            title="Release Retention Money"
                            onClick={() => handleOpenRelease(r)}
                          >
                            <Unlock className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="p-1.5 text-emerald-600 inline-flex items-center justify-center" title="Retention Fully Settled">
                            <CheckCircle2 className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination inside container without extra overflow */}
          <div className="border-t border-border px-3 py-2.5 bg-surface flex items-center justify-between text-xs">
            <span className="text-text-muted text-[11px]">
              Showing {filtered.length === 0 ? 0 : (page - 1) * perPage + 1} to {Math.min(page * perPage, filtered.length)} of {filtered.length} accounts
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                ‹ Previous
              </Button>
              <span className="font-mono text-xs text-text-secondary">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next ›
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile View - Cards List (< sm) */}
        <div className="block sm:hidden space-y-3">
          {loading ? (
            <div className="py-12 text-center text-text-muted text-xs">
              <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-primary" />
              Loading retention accounts...
            </div>
          ) : paged.length === 0 ? (
            <div className="py-12 text-center text-text-muted text-xs">
              No retention accounts found.
            </div>
          ) : (
            paged.map((r, idx) => (
              <div key={r.id || idx} className="bg-surface border border-border rounded-lg p-3.5 shadow-xs space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-text-primary text-[13px] leading-snug">{r.contractor_name}</h4>
                    <span className="text-[11px] text-primary font-mono font-bold block">{r.work_order_no}</span>
                    <span className="text-[10px] text-text-muted">{r.project_name}</span>
                  </div>
                  <Badge variant={r.status_variant} className="text-[8px] font-bold uppercase tracking-wider shrink-0">
                    {r.status_name}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/60">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-text-muted block">Contract Value</span>
                    <span className="font-mono font-medium text-text-primary text-[11px]">{INR(r.contract_order_value)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-text-muted block">Escrow Held</span>
                    <span className="font-mono font-bold text-amber-600 text-[12px]">{INR(r.balance_retention_held)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-border/60 text-xs">
                  <span className="text-[10px] font-mono text-text-muted">
                    DLP: {r.dlp_expiry_date}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="p-1.5 text-text-secondary hover:text-primary hover:bg-primary/10 border border-border rounded-md transition-colors"
                      title="View Details"
                      onClick={() => setViewingItem(r)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {r.balance_retention_held > 0 && (
                      <button
                        type="button"
                        className="p-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition-colors"
                        title="Release Retention Money"
                        onClick={() => handleOpenRelease(r)}
                      >
                        <Unlock className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Mobile Pagination */}
          <div className="pt-2">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={filtered.length}
              itemsPerPage={perPage}
              onPageChange={setPage}
              onItemsPerPageChange={() => {}}
            />
          </div>
        </div>
      </div>

      {/* View Retention 360 Dossier Modal */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface border border-border rounded-xl shadow-level-3 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-muted/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">{viewingItem.contractor_name}</h3>
                  <span className="text-[11px] font-mono text-text-muted">
                    {viewingItem.work_order_no} • {viewingItem.project_name}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={viewingItem.status_variant} className="text-[9px] font-bold uppercase">
                  {viewingItem.status_name}
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => setViewingItem(null)}>✕</Button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              {/* Financial Balance Summary Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-muted/30 p-3.5 rounded-lg border border-border">
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Contract Value</span>
                  <span className="font-bold text-text-primary font-mono text-sm">
                    {INR(viewingItem.contract_order_value)}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Total Retained ({viewingItem.retention_percent}%)</span>
                  <span className="font-bold text-primary font-mono text-sm">
                    {INR(viewingItem.total_retention_deducted)}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Released to Date</span>
                  <span className="font-mono font-bold text-emerald-600 text-sm">
                    {INR(viewingItem.retention_released)}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Balance in Escrow</span>
                  <span className="font-bold text-amber-600 font-mono text-sm">
                    {INR(viewingItem.balance_retention_held)}
                  </span>
                </div>
              </div>

              {/* Package & Bank Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="border border-border rounded-lg p-3 space-y-1.5 bg-surface">
                  <span className="font-bold text-text-primary block text-[11px]">Work Scope Package</span>
                  <p className="text-text-secondary text-xs leading-relaxed bg-surface-muted/20 p-2 rounded border border-border/40">
                    {viewingItem.package_title}
                  </p>
                </div>

                <div className="border border-border rounded-lg p-3 space-y-1 bg-surface">
                  <span className="font-bold text-text-primary block text-[11px]">Subcontractor Banking Details</span>
                  <div className="text-[11px] text-text-secondary space-y-0.5">
                    <div><strong className="text-text-muted">Bank:</strong> {viewingItem.bank_details.bank_name}</div>
                    <div><strong className="text-text-muted">Account:</strong> <span className="font-mono">{viewingItem.bank_details.account_no}</span></div>
                    <div><strong className="text-text-muted">IFSC:</strong> <span className="font-mono">{viewingItem.bank_details.ifsc}</span></div>
                  </div>
                </div>
              </div>

              {/* Defect Liability Progress */}
              <div className="border border-border rounded-lg p-3 space-y-2 bg-surface">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-text-primary text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Defect Liability Period (DLP)
                  </span>
                  <span className="font-mono text-xs text-text-secondary">
                    Deadline: <strong>{viewingItem.dlp_expiry_date}</strong>
                  </span>
                </div>
                <div className="p-2.5 rounded bg-surface-muted/30 border border-border/50 text-[11px] flex items-center justify-between">
                  <span className="text-text-secondary">
                    {viewingItem.is_dlp_matured
                      ? 'The defect liability period has elapsed. The account is eligible for full final retention release.'
                      : `Retention guarantee is actively protecting against defect liabilities (${viewingItem.days_remaining ?? '—'} days until DLP maturity).`}
                  </span>
                  <Badge variant={viewingItem.is_dlp_matured ? 'success' : 'primary'} className="shrink-0 text-[9px] uppercase">
                    {viewingItem.is_dlp_matured ? 'Ready for Release' : 'Under Warranty'}
                  </Badge>
                </div>
              </div>

              {/* Associated RA Bills Withholding Breakdown */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-surface-muted px-3 py-2 border-b border-border flex items-center justify-between">
                  <span className="font-bold text-text-primary text-[11px] uppercase tracking-wider">
                    Associated Subcontract RA Bills ({viewingItem.ra_bills?.length || 0})
                  </span>
                </div>
                {viewingItem.ra_bills && viewingItem.ra_bills.length > 0 ? (
                  <table className="w-full text-[11px]">
                    <thead className="bg-surface-muted/50 text-[10px] uppercase text-text-secondary font-semibold">
                      <tr>
                        <th className="px-2.5 py-1.5 text-left">#</th>
                        <th className="px-2.5 py-1.5 text-left">RA Bill No</th>
                        <th className="px-2.5 py-1.5 text-left">Bill Date</th>
                        <th className="px-2.5 py-1.5 text-right">Gross Work Value</th>
                        <th className="px-2.5 py-1.5 text-right font-bold text-amber-600">Retention Deducted</th>
                        <th className="px-2.5 py-1.5 text-right">Net Certified</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {viewingItem.ra_bills.map((b, i) => (
                        <tr key={b.id || i} className="hover:bg-surface-muted/20">
                          <td className="px-2.5 py-1.5 text-text-muted">{i + 1}</td>
                          <td className="px-2.5 py-1.5 font-mono font-bold text-primary">{b.ra_bill_no}</td>
                          <td className="px-2.5 py-1.5 font-mono text-text-muted">{b.bill_date ? b.bill_date.split('T')[0] : '—'}</td>
                          <td className="px-2.5 py-1.5 text-right font-mono">{INR(b.gross_work_value)}</td>
                          <td className="px-2.5 py-1.5 text-right font-mono font-bold text-amber-600">-{INR(b.retention_amount)}</td>
                          <td className="px-2.5 py-1.5 text-right font-mono font-medium text-text-primary">{INR(b.net_certified_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-4 text-center text-text-muted text-xs">
                    No RA bills certified yet for this package. Retention deduction is projected from the contract order value.
                  </div>
                )}
              </div>

              {/* Release Payment History */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-surface-muted px-3 py-2 border-b border-border flex items-center justify-between">
                  <span className="font-bold text-text-primary text-[11px] uppercase tracking-wider">
                    Retention Release History ({viewingItem.releases?.length || 0})
                  </span>
                </div>
                {viewingItem.releases && viewingItem.releases.length > 0 ? (
                  <table className="w-full text-[11px]">
                    <thead className="bg-surface-muted/50 text-[10px] uppercase text-text-secondary font-semibold">
                      <tr>
                        <th className="px-2.5 py-1.5 text-left">#</th>
                        <th className="px-2.5 py-1.5 text-left">Date</th>
                        <th className="px-2.5 py-1.5 text-left">Mode / Ref</th>
                        <th className="px-2.5 py-1.5 text-left">Remarks</th>
                        <th className="px-2.5 py-1.5 text-right font-bold text-emerald-600">Amount Released</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {viewingItem.releases.map((rel, i) => (
                        <tr key={rel.id || i} className="hover:bg-surface-muted/20">
                          <td className="px-2.5 py-1.5 text-text-muted">{i + 1}</td>
                          <td className="px-2.5 py-1.5 font-mono">{rel.release_date}</td>
                          <td className="px-2.5 py-1.5">
                            <span className="font-medium text-text-primary block">{rel.payment_mode}</span>
                            <span className="font-mono text-[10px] text-text-muted">{rel.reference_no}</span>
                          </td>
                          <td className="px-2.5 py-1.5 text-text-secondary">{rel.remarks || '—'}</td>
                          <td className="px-2.5 py-1.5 text-right font-mono font-bold text-emerald-600">
                            {INR(rel.release_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-4 text-center text-text-muted text-xs">
                    No retention release payments recorded yet.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-border bg-surface-muted/20 flex items-center justify-between">
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={handlePrint}
                >
                  <Printer className="w-3.5 h-3.5 mr-1" /> Print Statement
                </Button>
              </div>

              <div className="flex items-center gap-2">
                {viewingItem.balance_retention_held > 0 && (
                  <Button
                    size="sm"
                    variant="primary"
                    className="bg-amber-600 hover:bg-amber-700 text-xs text-white"
                    onClick={() => {
                      handleOpenRelease(viewingItem);
                    }}
                  >
                    <Unlock className="w-3.5 h-3.5 mr-1" /> Release Retention
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setViewingItem(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Release Retention Modal */}
      {releaseModalItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface border border-border rounded-xl shadow-level-3 w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-muted/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
                  <Unlock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">Authorize Retention Release</h3>
                  <span className="text-[11px] font-mono text-text-muted">
                    {releaseModalItem.work_order_no} • {releaseModalItem.contractor_name}
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setReleaseModalItem(null)}>✕</Button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirmRelease();
              }}
            >
              <div className="p-5 space-y-3.5 text-xs">
                {/* Available Balance Box */}
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium block">Current Available Escrow Balance</span>
                    <span className="text-lg font-mono font-bold text-amber-700">
                      {INR(releaseModalItem.balance_retention_held)}
                    </span>
                  </div>
                  <Badge variant={releaseModalItem.is_dlp_matured ? 'success' : 'primary'} className="text-[9px] uppercase">
                    {releaseModalItem.is_dlp_matured ? 'DLP Matured' : 'DLP Active'}
                  </Badge>
                </div>

                <FormField label="Amount to Release (₹)" required hint={`Max payable: ${INR(releaseModalItem.balance_retention_held)}`}>
                  <Input
                    type="number"
                    min="1"
                    max={releaseModalItem.balance_retention_held}
                    step="any"
                    value={releaseForm.amount}
                    onChange={(e) => setReleaseForm((prev) => ({ ...prev, amount: e.target.value }))}
                    className="font-mono font-bold text-sm text-primary"
                    placeholder="Enter amount in ₹"
                    required
                  />
                </FormField>

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Release Date" required>
                    <Input
                      type="date"
                      value={releaseForm.release_date}
                      onChange={(e) => setReleaseForm((prev) => ({ ...prev, release_date: e.target.value }))}
                      required
                    />
                  </FormField>

                  <FormField label="Payment Mode" required>
                    <Select
                      options={[
                        { value: 'Bank Transfer (NEFT/RTGS)', label: 'Bank Transfer (NEFT/RTGS)' },
                        { value: 'Cheque Payment', label: 'Cheque Payment' },
                        { value: 'Demand Draft', label: 'Demand Draft' },
                        { value: 'Direct Bank Settlement', label: 'Direct Settlement' },
                      ]}
                      value={releaseForm.payment_mode}
                      onChange={(v) => setReleaseForm((prev) => ({ ...prev, payment_mode: v }))}
                    />
                  </FormField>
                </div>

                <FormField label="Instrument / UTR Reference No">
                  <Input
                    value={releaseForm.reference_no}
                    onChange={(e) => setReleaseForm((prev) => ({ ...prev, reference_no: e.target.value }))}
                    placeholder="e.g. UTR-982341209 / CHQ-10492"
                    className="font-mono"
                  />
                </FormField>

                <FormField label="Clearance Remarks / DLP Authority">
                  <Input
                    value={releaseForm.remarks}
                    onChange={(e) => setReleaseForm((prev) => ({ ...prev, remarks: e.target.value }))}
                    placeholder="e.g. Taking-Over Certificate approved by Resident Engineer"
                  />
                </FormField>

                <p className="text-[11px] text-text-muted flex items-start gap-1.5 pt-1">
                  <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <span>
                    Releasing retention formally updates the subcontractor defect liability escrow ledger and deducts the balance.
                  </span>
                </p>
              </div>

              <div className="px-5 py-3 border-t border-border bg-surface-muted/20 flex justify-end gap-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setReleaseModalItem(null)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={savingRelease}
                >
                  {savingRelease ? 'Recording Release...' : 'Confirm Release Payment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

export default RetentionLedgerPage;
