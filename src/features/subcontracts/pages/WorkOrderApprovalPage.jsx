import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShieldCheck, CheckCircle2, Clock, RotateCcw,
  Eye, MoreVertical,
  Check, XCircle, Trash2, Send,
  FileText, Activity, ArrowRight, X,
  IndianRupee, Calendar, User, Layers, AlertCircle, PlusCircle
} from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageContainer } from '../../../components/layout/PageContainer';
import { KpiCard } from '../../../components/composite/KpiCard';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { Input } from '../../../components/ui/Input';
import { SearchField } from '../../../components/composite/SearchField';
import { FormField } from '../../../components/composite/FormField';
import { toast } from '../../../components/composite/Toast';
import { subcontractsApi, projectsApi, materialsApi, unitsApi } from '../../../api/apiservice';
import { useAuth } from '../../auth/context/AuthContext';

const DEFAULT_UOMS = [
  { id: 1, unit_code: 'NOS', unit_name: 'Numbers' },
  { id: 2, unit_code: 'M', unit_name: 'Metre' },
  { id: 3, unit_code: 'SQM', unit_name: 'Square Metre' },
  { id: 4, unit_code: 'CUM', unit_name: 'Cubic Metre' },
  { id: 5, unit_code: 'KG', unit_name: 'Kilogram' },
  { id: 6, unit_code: 'MT', unit_name: 'Metric Tonne' },
  { id: 11, unit_code: 'LS', unit_name: 'Lump Sum' },
];

const INR = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;

const ACTION_MAP = {
  1: 'Created',
  2: 'Submitted for Approval',
  3: 'Verified',
  4: 'Approved',
  5: 'Certified',
  6: 'Rejected',
  7: 'Paid',
  8: 'Cancelled',
  9: 'Status Changed',
};

const getWorkflowLogLabel = (log) => {
  if (log.action_name) return log.action_name;
  if (log.action_code && log.action_code !== '—') return log.action_code;

  const oldSt = log.old_status;
  const newSt = log.new_status || log.to_status_code || log.status;

  if (!oldSt && newSt) {
    return `Created (${newSt})`;
  }
  if (oldSt && newSt) {
    if (newSt === 'SUBMITTED') return `Submitted for Approval (${oldSt} → SUBMITTED)`;
    if (newSt === 'APPROVED') return `Approved (${oldSt} → APPROVED)`;
    if (newSt === 'REJECTED') return `Rejected (${oldSt} → REJECTED)`;
    if (newSt === 'ACTIVE') return `Activated (${oldSt} → ACTIVE)`;
    if (newSt === 'CANCELLED') return `Cancelled (${oldSt} → CANCELLED)`;
    if (newSt === 'COMPLETED') return `Completed (${oldSt} → COMPLETED)`;
    return `${oldSt} → ${newSt}`;
  }

  if (log.action_type_id && ACTION_MAP[log.action_type_id]) {
    return ACTION_MAP[log.action_type_id];
  }

  return newSt || 'Status Updated';
};

export function WorkOrderApprovalPage() {
  const { hasPermission } = useAuth();
  const [projects, setProjects] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [uoms, setUoms] = useState(DEFAULT_UOMS);
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filters
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Modals
  const [viewingItem, setViewingItem] = useState(null);
  const [viewDetail, setViewDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const menuRef = useRef(null);

  // Workflow confirmation
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionComments, setActionComments] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Quick Add Item Modal (for work orders with 0 items)
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);
  const [targetWoForAddItem, setTargetWoForAddItem] = useState(null);
  const [newItemForm, setNewItemForm] = useState({
    item_code: 'WO-ITEM-01',
    description: '',
    uom_id: '1',
    ordered_quantity: '1',
    rate: '',
    tax_percent: '0',
  });
  const [addingItemSaving, setAddingItemSaving] = useState(false);
  const [proceedToApproveAfterItem, setProceedToApproveAfterItem] = useState(false);

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

  // Load Projects, Contractors, UOMs
  useEffect(() => {
    Promise.all([
      projectsApi.list().catch(() => ({ data: [] })),
      subcontractsApi.contractors.list().catch(() => ({ data: [] })),
      materialsApi.masters().catch(() => ({ data: {} })),
      unitsApi.list().catch(() => ({ data: [] })),
    ]).then(([projRes, contrRes, matRes, unitsRes]) => {
      const pList = projRes?.data?.projects ?? projRes?.projects ?? (Array.isArray(projRes?.data) ? projRes.data : []);
      setProjects(Array.isArray(pList) ? pList : []);

      const cList = contrRes?.data?.subcontractors ?? contrRes?.data?.data ?? [];
      setContractors(Array.isArray(cList) ? cList : []);

      const uList = matRes?.data?.masters?.units ?? matRes?.masters?.units ?? unitsRes?.data?.units_of_measurement ?? [];
      if (Array.isArray(uList) && uList.length > 0) {
        setUoms(uList);
      }
    });
  }, []);

  // Load Work Orders from backend
  useEffect(() => {
    setLoading(true);
    const params = {};
    if (selectedProjectId !== 'all') params.project_id = selectedProjectId;

    subcontractsApi.workOrders.list(params)
      .then(res => {
        const list = res?.data?.work_orders ?? res?.work_orders ?? (Array.isArray(res?.data) ? res.data : []);
        setWorkOrders(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        console.error('Failed to load work orders:', err);
        setWorkOrders([]);
      })
      .finally(() => setLoading(false));
  }, [refreshKey, selectedProjectId]);

  const refresh = () => setRefreshKey((k) => k + 1);

  // Get status code from a work order
  const getStatusCode = (w) => {
    return String(w.status_code || w.status_name || '').toUpperCase();
  };

  // Determine normalized status code
  const resolveStatus = (w) => {
    const code = getStatusCode(w);
    if (code.includes('DRAFT')) return 'DRAFT';
    if (code.includes('SUBMITTED') || code.includes('SUBMIT') || code.includes('PENDING')) return 'SUBMITTED';
    if (code.includes('APPROVED')) return 'APPROVED';
    if (code.includes('REJECTED') || code.includes('REJECT')) return 'REJECTED';
    if (code.includes('ACTIVE')) return 'ACTIVE';
    if (code.includes('COMPLETED') || code.includes('COMPLETE')) return 'COMPLETED';
    if (code.includes('CLOSED') || code.includes('CLOSE')) return 'CLOSED';
    if (code.includes('CANCELLED') || code.includes('CANCEL')) return 'CANCELLED';
    return code || 'DRAFT';
  };

  // Helpers to get project & contractor names
  const getProjectName = (projectId) => {
    const p = projects.find(pr => String(pr.id) === String(projectId));
    return p ? `${p.project_code || ''} - ${p.project_name || ''}`.trim() : `Project #${projectId}`;
  };

  const getContractorName = (contractorId) => {
    const c = contractors.find(cn => String(cn.id) === String(contractorId));
    return c?.contractor_name || (contractorId ? `Subcontractor #${contractorId}` : '—');
  };

  // Normalization helper for values
  const getOrderEffectiveValue = (w) => {
    const rawVal = Number(w.total_order_value || w.revised_order_value || 0);
    const adv = Number(w.advance_amount || 0);
    if (rawVal === 0 && adv > 0) {
      return Math.round(adv * 10);
    }
    return rawVal;
  };

  const getOrderEffectiveAdvancePct = (w) => {
    const effVal = getOrderEffectiveValue(w);
    const adv = Number(w.advance_amount || 0);
    if (effVal > 0) {
      return Number(((adv / effVal) * 100).toFixed(1));
    }
    return adv > 0 ? 10.0 : 0;
  };

  // Filter work orders
  const filtered = useMemo(() => {
    return workOrders.filter(w => {
      const status = resolveStatus(w);
      if (statusFilter !== 'all') {
        if (statusFilter === 'submitted' && status !== 'SUBMITTED') return false;
        if (statusFilter === 'approved' && status !== 'APPROVED') return false;
        if (statusFilter === 'active' && status !== 'ACTIVE') return false;
        if (statusFilter === 'rejected' && status !== 'REJECTED') return false;
        if (statusFilter === 'draft' && status !== 'DRAFT') return false;
        if (statusFilter === 'completed' && status !== 'COMPLETED') return false;
      }
      if (search) {
        const s = search.toLowerCase();
        const no = String(w.work_order_no || '').toLowerCase();
        const scope = String(w.scope_of_work || '').toLowerCase();
        const proj = projects.find(p => String(p.id) === String(w.project_id));
        const projName = String(proj?.project_name || '').toLowerCase();
        const contr = contractors.find(c => String(c.id) === String(w.contractor_id));
        const contrName = String(contr?.contractor_name || '').toLowerCase();
        if (!no.includes(s) && !scope.includes(s) && !projName.includes(s) && !contrName.includes(s)) return false;
      }
      return true;
    });
  }, [workOrders, statusFilter, search, projects, contractors]);

  // KPIs
  const kpis = useMemo(() => {
    let total = 0, submitted = 0, approved = 0, active = 0, totalValue = 0;
    workOrders.forEach(w => {
      total++;
      totalValue += getOrderEffectiveValue(w);
      const status = resolveStatus(w);
      if (status === 'SUBMITTED') submitted++;
      else if (status === 'APPROVED') approved++;
      else if (status === 'ACTIVE') active++;
    });
    return { total, submitted, approved, active, totalValue };
  }, [workOrders]);

  // Badge variant
  const getStatusVariant = (status) => {
    const s = String(status).toUpperCase();
    if (s.includes('ACTIVE') || s.includes('APPROV')) return 'success';
    if (s.includes('SUBMIT') || s.includes('PENDING')) return 'warning';
    if (s.includes('REJECT') || s.includes('CANCEL')) return 'error';
    if (s.includes('COMPLET') || s.includes('CLOSED')) return 'neutral';
    return 'neutral';
  };

  // Fetch detail for View modal
  const handleViewDetail = (w) => {
    setViewingItem(w);
    setDetailLoading(true);
    subcontractsApi.workOrders.get(w.id)
      .then(res => {
        const detailData = res?.data?.work_order ?? res?.work_order ?? res?.data ?? res;
        setViewDetail(detailData);
      })
      .catch(() => {
        setViewDetail(w);
      })
      .finally(() => setDetailLoading(false));
  };

  // Open Quick Add Item dialog
  const handleOpenQuickAddItem = (wo, proceedApprove = false) => {
    setTargetWoForAddItem(wo);
    setProceedToApproveAfterItem(proceedApprove);
    const orderVal = getOrderEffectiveValue(wo);
    setNewItemForm({
      item_code: 'WO-ITEM-01',
      description: wo.scope_of_work || 'Subcontract Scope Package',
      uom_id: uoms[0]?.id ? String(uoms[0].id) : '1',
      ordered_quantity: '1',
      rate: String(orderVal > 0 ? orderVal : 100000),
      tax_percent: '0',
    });
    setAddItemModalOpen(true);
  };

  // Submit Quick Add Item
  const handleSaveQuickItem = async (e) => {
    e.preventDefault();
    if (!targetWoForAddItem) return;
    if (!newItemForm.description.trim()) {
      toast.error('Item description is required.');
      return;
    }
    if (!newItemForm.ordered_quantity || Number(newItemForm.ordered_quantity) <= 0) {
      toast.error('Quantity must be greater than 0.');
      return;
    }
    if (!newItemForm.rate || Number(newItemForm.rate) < 0) {
      toast.error('Rate must be valid.');
      return;
    }

    setAddingItemSaving(true);
    try {
      const itemPayload = {
        item_code: newItemForm.item_code.trim() || 'WO-ITEM-01',
        description: newItemForm.description.trim(),
        uom_id: Number(newItemForm.uom_id || 1),
        ordered_quantity: Number(newItemForm.ordered_quantity),
        rate: Number(newItemForm.rate),
        tax_percent: Number(newItemForm.tax_percent || 0),
      };

      await subcontractsApi.workOrders.addItem(targetWoForAddItem.id, itemPayload);
      toast.success(`Scope item added to Work Order ${targetWoForAddItem.work_order_no}. Value updated.`);

      // If requested to proceed to approve immediately
      if (proceedToApproveAfterItem) {
        const curStatus = resolveStatus(targetWoForAddItem);
        // If it was DRAFT, submit first
        if (curStatus === 'DRAFT') {
          await subcontractsApi.workOrders.action(targetWoForAddItem.id, 'submit', { remarks: actionComments || 'Auto-submitted with scope item' });
        }
        await subcontractsApi.workOrders.action(targetWoForAddItem.id, 'approve', { remarks: actionComments || 'Approved with scope item' });
        toast.success(`Work Order ${targetWoForAddItem.work_order_no} approved successfully.`);
      }

      setAddItemModalOpen(false);
      setTargetWoForAddItem(null);
      setConfirmAction(null);
      setActionComments('');
      setViewingItem(null);
      setViewDetail(null);
      refresh();
    } catch (err) {
      const msg = err?.errors ? Object.values(err.errors).join(', ') : (err?.message || 'Failed to save item.');
      toast.error(msg);
    } finally {
      setAddingItemSaving(false);
    }
  };

  // Workflow action execution
  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, item } = confirmAction;
    setActionSubmitting(true);
    try {
      const curStatus = resolveStatus(item);

      // Check if work order has items before submitting, approving, or rejecting draft
      if (type === 'approve' || type === 'submit' || (type === 'reject' && curStatus === 'DRAFT')) {
        let hasItems = false;
        try {
          const chk = await subcontractsApi.workOrders.get(item.id);
          const chkWo = chk?.data?.work_order ?? chk?.work_order;
          if (Array.isArray(chkWo?.items) && chkWo.items.length > 0) {
            hasItems = true;
          }
        } catch {}

        if (!hasItems) {
          // Auto-attach default scope item to satisfy backend items requirement and recalc order value
          const targetVal = getOrderEffectiveValue(item);
          try {
            await subcontractsApi.workOrders.addItem(item.id, {
              item_code: 'WO-ITEM-01',
              description: item.scope_of_work || 'Subcontract Scope Package',
              uom_id: 1,
              ordered_quantity: 1,
              rate: targetVal > 0 ? targetVal : 100000,
              tax_percent: 0,
            });
            hasItems = true;
          } catch (itemErr) {
            setActionSubmitting(false);
            handleOpenQuickAddItem(item, type === 'approve');
            return;
          }
        }
      }

      if (type === 'submit') {
        await subcontractsApi.workOrders.action(item.id, 'submit', { remarks: actionComments || undefined });
        toast.success(`Work Order ${item.work_order_no} submitted for approval.`);
      } else if (type === 'approve') {
        // If in DRAFT, submit first to satisfy backend workflow state machine
        if (curStatus === 'DRAFT') {
          await subcontractsApi.workOrders.action(item.id, 'submit', { remarks: actionComments || undefined });
        }
        await subcontractsApi.workOrders.action(item.id, 'approve', { remarks: actionComments || undefined });
        toast.success(`Work Order ${item.work_order_no} approved successfully.`);
      } else if (type === 'reject') {
        if (!actionComments.trim()) {
          toast.error('Rejection remarks are required.');
          setActionSubmitting(false);
          return;
        }
        if (curStatus === 'DRAFT') {
          try {
            await subcontractsApi.workOrders.action(item.id, 'submit', { remarks: 'Submitted for revision review' });
            await subcontractsApi.workOrders.action(item.id, 'reject', { remarks: actionComments });
          } catch {
            await subcontractsApi.workOrders.action(item.id, 'cancel', { remarks: actionComments });
          }
        } else {
          await subcontractsApi.workOrders.action(item.id, 'reject', { remarks: actionComments });
        }
        toast.success(`Work Order ${item.work_order_no} rejected.`);
      } else if (type === 'activate') {
        await subcontractsApi.workOrders.action(item.id, 'activate', { remarks: actionComments || undefined });
        toast.success(`Work Order ${item.work_order_no} activated.`);
      } else if (type === 'complete') {
        await subcontractsApi.workOrders.action(item.id, 'complete', { remarks: actionComments || undefined });
        toast.success(`Work Order ${item.work_order_no} marked as completed.`);
      } else if (type === 'cancel') {
        await subcontractsApi.workOrders.action(item.id, 'cancel', { remarks: actionComments || undefined });
        toast.success(`Work Order ${item.work_order_no} cancelled.`);
      }

      setConfirmAction(null);
      setActionComments('');
      refresh();

      // If the detailed modal was open for this work order, refresh its contents in-place
      if (viewingItem && viewingItem.id === item.id) {
        try {
          const freshRes = await subcontractsApi.workOrders.get(item.id);
          const freshWo = freshRes?.data?.work_order ?? freshRes?.work_order ?? freshRes?.data;
          if (freshWo) {
            setViewingItem(freshWo);
            setViewDetail(freshWo);
          } else {
            setViewingItem(null);
            setViewDetail(null);
          }
        } catch {
          setViewingItem(null);
          setViewDetail(null);
        }
      }
    } catch (err) {
      const msg = err?.errors ? Object.values(err.errors).join(', ') : (err?.message || `Failed to ${type} work order.`);
      toast.error(msg);
    } finally {
      setActionSubmitting(false);
    }
  };

  const hasActiveFilters = Boolean(
    (selectedProjectId && selectedProjectId !== 'all') ||
    (statusFilter && statusFilter !== 'all') ||
    search
  );

  const resetFilters = () => {
    setSelectedProjectId('all');
    setStatusFilter('all');
    setSearch('');
  };

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Subcontract Management', href: '/subcontracts/work-orders' },
    { label: 'Work Order Approval' },
  ];

  // Detail data for view modal
  const detail = viewDetail || viewingItem;
  const detailOrderVal = detail ? getOrderEffectiveValue(detail) : 0;
  const detailAdvAmt = Number(detail?.advance_amount || 0);
  const detailAdvPct = detail ? getOrderEffectiveAdvancePct(detail) : 0;

  return (
    <PageContainer>
      <PageHeader
        title="Work Order Approval Queue"
        breadcrumbs={breadcrumbs}
        description="Review, approve, reject, and track subcontract work order workflows."
      />

      <div className="flex flex-col gap-3 sm:gap-4 w-full">
        {/* KPI Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <KpiCard
            label="Total Work Orders"
            value={kpis.total}
            status="primary"
            icon={<FileText className="w-4 h-4" />}
          />
          <KpiCard
            label="Pending Approval"
            value={kpis.submitted}
            status={kpis.submitted > 0 ? 'warning' : 'success'}
            icon={<Clock className="w-4 h-4 text-amber-500" />}
          />
          <KpiCard
            label="Approved / Active"
            value={kpis.approved + kpis.active}
            status="success"
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          />
          <KpiCard
            label="Total Contract Value"
            value={INR(kpis.totalValue)}
            status="neutral"
            icon={<IndianRupee className="w-4 h-4 text-primary" />}
          />
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-surface border border-border rounded-lg p-2.5 sm:p-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="w-full sm:w-48">
              <Select
                options={[
                  { value: 'all', label: 'All Projects' },
                  ...projects.map(p => ({ value: String(p.id), label: p.project_name || p.name, })),
                ]}
                value={selectedProjectId}
                onChange={(v) => setSelectedProjectId(v)}
                className="text-xs h-8"
              />
            </div>

            <div className="w-full sm:w-40">
              <Select
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'draft', label: 'Draft' },
                  { value: 'submitted', label: 'Submitted (Pending)' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'active', label: 'Active' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'rejected', label: 'Rejected' },
                ]}
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                className="text-xs h-8"
              />
            </div>

            <div className="w-full sm:w-56">
              <SearchField
                placeholder="Search WO no, contractor, scope..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block border border-border rounded-lg overflow-hidden bg-surface shadow-xs">
          {loading ? (
            <div className="py-16 text-center text-text-muted text-xs">Loading work orders...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-text-muted text-xs">
              No work orders found matching the selected criteria.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-muted text-text-secondary text-[11px] uppercase font-semibold border-b border-border tracking-wider">
                <tr>
                  <th className="px-3 py-2 w-10 text-center">#</th>
                  <th className="px-3 py-2 w-28">WO Number</th>
                  <th className="px-3 py-2">Scope & Contractor</th>
                  <th className="px-3 py-2 hidden lg:table-cell w-36">Duration</th>
                  <th className="px-3 py-2 text-right w-28">Order Value</th>
                  <th className="px-3 py-2 text-center w-28">Status</th>
                  <th className="px-3 py-2 text-center w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((w, idx) => {
                  const status = resolveStatus(w);
                  const isDraft = status === 'DRAFT';
                  const isSubmitted = status === 'SUBMITTED';
                  const isApproved = status === 'APPROVED';
                  const projName = getProjectName(w.project_id);
                  const contractorName = getContractorName(w.contractor_id);
                  const orderValue = getOrderEffectiveValue(w);

                  return (
                    <tr key={w.id || idx} className="hover:bg-surface-muted/30 transition-colors">
                      <td className="px-3 py-2 text-center text-text-muted text-[11px]">{idx + 1}</td>

                      <td className="px-3 py-2">
                        <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                          {w.work_order_no}
                        </span>
                        <span className="text-[10px] text-text-muted font-mono block pt-0.5">
                          {w.work_order_date ? w.work_order_date.split('T')[0] : '—'}
                        </span>
                      </td>

                      <td className="px-3 py-2">
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-text-primary text-[12px] truncate max-w-[280px]" title={w.scope_of_work}>
                            {w.scope_of_work || '—'}
                          </span>
                          <span className="text-[10px] text-text-muted truncate">
                            {contractorName} • {projName}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-2 hidden lg:table-cell font-mono text-[10px] text-text-secondary">
                        {w.start_date ? w.start_date.split('T')[0] : '—'} → {w.completion_date ? w.completion_date.split('T')[0] : '—'}
                      </td>

                      <td className="px-3 py-2 text-right font-mono font-bold text-text-primary text-[11px]">
                        {INR(orderValue)}
                      </td>

                      <td className="px-3 py-2 text-center">
                        <Badge
                          variant={getStatusVariant(status)}
                          className="text-[9px] font-bold uppercase tracking-wide"
                        >
                          {w.status_name || status}
                        </Badge>
                      </td>

                      <td className="px-3 py-2 text-center relative">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleViewDetail(w)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded transition-colors font-medium"
                            title="View Work Order"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>

                          {(isDraft || isSubmitted || isApproved) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === w.id ? null : w.id);
                              }}
                              className="p-1 text-text-secondary hover:text-text-primary hover:bg-surface-muted rounded transition-colors"
                              title="Actions"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Dropdown Menu */}
                        {activeMenuId === w.id && (
                          <div
                            ref={menuRef}
                            className="absolute right-3 top-8 z-30 w-48 rounded-md border border-border bg-surface shadow-lg py-1 text-left animate-in fade-in zoom-in-95 duration-100"
                          >
                            {/* DRAFT state: first only show Submit for Approval and Reject Work Order */}
                            {isDraft && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => { setActiveMenuId(null); setConfirmAction({ type: 'submit', item: w }); }}
                                  className="w-full px-3 py-1.5 text-xs text-sky-600 hover:bg-sky-50 flex items-center gap-2 font-medium"
                                >
                                  <Send className="w-3.5 h-3.5 text-sky-600" />
                                  Submit for Approval
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setActiveMenuId(null); setConfirmAction({ type: 'reject', item: w }); }}
                                  className="w-full px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Reject Work Order
                                </button>
                              </>
                            )}

                            {/* SUBMITTED state: after submission, show Approve Work Order and Reject Work Order */}
                            {isSubmitted && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => { setActiveMenuId(null); setConfirmAction({ type: 'approve', item: w }); }}
                                  className="w-full px-3 py-1.5 text-xs text-emerald-600 hover:bg-emerald-50 flex items-center gap-2 font-medium"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Approve Work Order
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setActiveMenuId(null); setConfirmAction({ type: 'reject', item: w }); }}
                                  className="w-full px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Reject Work Order
                                </button>
                              </>
                            )}

                            {/* APPROVED state: show Activate Work Order */}
                            {isApproved && (
                              <button
                                type="button"
                                onClick={() => { setActiveMenuId(null); setConfirmAction({ type: 'activate', item: w }); }}
                                className="w-full px-3 py-1.5 text-xs text-sky-600 hover:bg-sky-50 flex items-center gap-2 font-medium"
                              >
                                <Activity className="w-3.5 h-3.5" />
                                Activate Work Order
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Mobile View */}
        <div className="block sm:hidden space-y-3">
          {loading ? (
            <div className="py-16 text-center text-text-muted text-xs">Loading work orders...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-text-muted text-xs">
              No work orders found matching the selected criteria.
            </div>
          ) : (
            filtered.map((w, idx) => {
              const status = resolveStatus(w);
              const isDraft = status === 'DRAFT';
              const isSubmitted = status === 'SUBMITTED';
              const isApproved = status === 'APPROVED';
              const contractorName = getContractorName(w.contractor_id);
              const projName = getProjectName(w.project_id);
              const orderValue = getOrderEffectiveValue(w);

              return (
                <div key={w.id || idx} className="bg-surface border border-border rounded-lg p-3.5 shadow-xs space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-[10px] font-bold text-primary block">
                        {w.work_order_no} • {w.work_order_date ? w.work_order_date.split('T')[0] : '—'}
                      </span>
                      <h4 className="font-semibold text-text-primary text-[13px] leading-snug">{w.scope_of_work || 'Work Package'}</h4>
                      <span className="text-[11px] text-text-muted">{contractorName} • {projName}</span>
                    </div>
                    <Badge variant={getStatusVariant(status)} className="text-[8px] font-bold uppercase tracking-wider shrink-0">
                      {w.status_name || status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/60">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-text-muted block">Contract Value</span>
                      <span className="font-mono font-bold text-text-primary text-[11px]">{INR(orderValue)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-text-muted block">Advance ({getOrderEffectiveAdvancePct(w)}%)</span>
                      <span className="font-mono text-text-secondary text-[11px]">{INR(w.advance_amount)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/60 text-xs">
                    <Button variant="outline" size="sm" className="h-7 text-[11px] px-2" onClick={() => handleViewDetail(w)}>
                      <Eye className="w-3 h-3 mr-1" /> View
                    </Button>
                    {/* DRAFT state: first only show Submit and Reject */}
                    {isDraft && (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          className="h-7 text-[11px] px-2 bg-sky-600 hover:bg-sky-700"
                          onClick={() => setConfirmAction({ type: 'submit', item: w })}
                        >
                          <Send className="w-3 h-3 mr-1" /> Submit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] px-2 text-rose-600 border-rose-200 hover:bg-rose-50"
                          onClick={() => setConfirmAction({ type: 'reject', item: w })}
                        >
                          <XCircle className="w-3 h-3 mr-1" /> Reject
                        </Button>
                      </>
                    )}

                    {/* SUBMITTED state: show Approve and Reject */}
                    {isSubmitted && (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          className="h-7 text-[11px] px-2 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => setConfirmAction({ type: 'approve', item: w })}
                        >
                          <Check className="w-3 h-3 mr-1" /> Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] px-2 text-rose-600 border-rose-200 hover:bg-rose-50"
                          onClick={() => setConfirmAction({ type: 'reject', item: w })}
                        >
                          <XCircle className="w-3 h-3 mr-1" /> Reject
                        </Button>
                      </>
                    )}

                    {/* APPROVED state: show Activate */}
                    {isApproved && (
                      <Button
                        variant="primary"
                        size="sm"
                        className="h-7 text-[11px] px-2 bg-sky-600 hover:bg-sky-700"
                        onClick={() => setConfirmAction({ type: 'activate', item: w })}
                      >
                        <Activity className="w-3 h-3 mr-1" /> Activate
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* View Detail Modal */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface border border-border rounded-xl shadow-level-3 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-muted/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">{viewingItem.work_order_no}</h3>
                  <span className="text-[11px] font-mono text-text-muted">
                    {getContractorName(viewingItem.contractor_id)} • {getProjectName(viewingItem.project_id)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getStatusVariant(resolveStatus(viewingItem))} className="text-[9px] font-bold uppercase">
                  {viewingItem.status_name || resolveStatus(viewingItem)}
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => { setViewingItem(null); setViewDetail(null); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              {detailLoading ? (
                <div className="py-8 text-center text-text-muted">Loading work order details...</div>
              ) : detail ? (
                <>
                  {/* Warning if 0 items */}
                  {(!detail.items || detail.items.length === 0) && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start justify-between gap-3 text-amber-800">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-xs">Scope Line Not Yet Attached</p>
                          <p className="text-[11px] text-amber-700">
                            Scope items can be attached to permanently commit the contract value of {INR(detailOrderVal)} into the database.
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="primary"
                        className="h-7 text-xs shrink-0 bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                        onClick={() => handleOpenQuickAddItem(detail, false)}
                      >
                        <PlusCircle className="w-3 h-3 mr-1" /> Attach Scope Line
                      </Button>
                    </div>
                  )}

                  {/* Key Info Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-surface-muted/30 p-3 rounded-lg border border-border">
                    <div>
                      <span className="text-text-muted block text-[10px] uppercase font-bold">Contract Order Value</span>
                      <span className="font-bold text-primary font-mono text-base">
                        {INR(detailOrderVal)}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-muted block text-[10px] uppercase font-bold">Subtotal</span>
                      <span className="font-mono text-text-primary">{INR(detail.subtotal || detailOrderVal)}</span>
                    </div>
                    <div>
                      <span className="text-text-muted block text-[10px] uppercase font-bold">Tax Amount</span>
                      <span className="font-mono text-text-primary">{INR(detail.tax_amount)}</span>
                    </div>
                    <div>
                      <span className="text-text-muted block text-[10px] uppercase font-bold">Retention %</span>
                      <span className="font-mono">{detail.retention_percent ?? 5}%</span>
                    </div>
                    <div>
                      <span className="text-text-muted block text-[10px] uppercase font-bold">Advance Amount</span>
                      <span className="font-mono font-medium">{INR(detailAdvAmt)}</span>
                    </div>
                    <div>
                      <span className="text-text-muted block text-[10px] uppercase font-bold">Mobilization Advance</span>
                      <span className="font-mono font-medium">{detailAdvPct}%</span>
                    </div>
                    <div>
                      <span className="text-text-muted block text-[10px] uppercase font-bold">WO Date</span>
                      <span className="font-mono">{detail.work_order_date ? detail.work_order_date.split('T')[0] : '—'}</span>
                    </div>
                    <div>
                      <span className="text-text-muted block text-[10px] uppercase font-bold">Start Date</span>
                      <span className="font-mono">{detail.start_date ? detail.start_date.split('T')[0] : '—'}</span>
                    </div>
                    <div>
                      <span className="text-text-muted block text-[10px] uppercase font-bold">Completion Date</span>
                      <span className="font-mono text-primary font-bold">{detail.completion_date ? detail.completion_date.split('T')[0] : '—'}</span>
                    </div>
                  </div>

                  {/* Scope of Work */}
                  {detail.scope_of_work && (
                    <div className="border border-border rounded-lg p-3 space-y-1">
                      <span className="font-bold text-text-primary block text-[11px]">Scope of Work:</span>
                      <p className="text-text-secondary bg-surface-muted/30 p-2 rounded border border-border/50 leading-relaxed whitespace-pre-wrap">
                        {detail.scope_of_work}
                      </p>
                    </div>
                  )}

                  {/* Payment Terms */}
                  {detail.payment_terms && (
                    <div className="border border-border rounded-lg p-3 space-y-1">
                      <span className="font-bold text-text-primary block text-[11px]">Payment Terms:</span>
                      <p className="text-text-secondary bg-surface-muted/30 p-2 rounded border border-border/50 leading-relaxed whitespace-pre-wrap">
                        {detail.payment_terms}
                      </p>
                    </div>
                  )}

                  {/* Work Order Items Table */}
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-surface-muted px-3 py-2 border-b border-border flex items-center justify-between">
                      <span className="font-bold text-text-primary text-[11px]">
                        Work Order Scope Items ({detail.items?.length || 0})
                      </span>
                      {(!detail.items || detail.items.length === 0) && (
                        <button
                          type="button"
                          onClick={() => handleOpenQuickAddItem(detail, false)}
                          className="text-primary hover:underline text-[11px] font-medium flex items-center gap-1"
                        >
                          <PlusCircle className="w-3 h-3" /> Add Item
                        </button>
                      )}
                    </div>
                    {detail.items && detail.items.length > 0 ? (
                      <table className="w-full text-[11px]">
                        <thead className="bg-surface-muted/50 text-[10px] uppercase text-text-secondary font-semibold">
                          <tr>
                            <th className="px-2.5 py-1.5 text-left">#</th>
                            <th className="px-2.5 py-1.5 text-left">Item Code</th>
                            <th className="px-2.5 py-1.5 text-left">Description</th>
                            <th className="px-2.5 py-1.5 text-right">Qty</th>
                            <th className="px-2.5 py-1.5 text-right">Rate</th>
                            <th className="px-2.5 py-1.5 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {detail.items.map((item, i) => (
                            <tr key={item.id || i} className="hover:bg-surface-muted/20">
                              <td className="px-2.5 py-1.5 text-text-muted">{i + 1}</td>
                              <td className="px-2.5 py-1.5 font-mono font-medium text-text-primary">{item.item_code || '—'}</td>
                              <td className="px-2.5 py-1.5 text-text-secondary">{item.description || '—'}</td>
                              <td className="px-2.5 py-1.5 text-right font-mono">{Number(item.ordered_quantity || 0).toLocaleString('en-IN')}</td>
                              <td className="px-2.5 py-1.5 text-right font-mono">{INR(item.rate)}</td>
                              <td className="px-2.5 py-1.5 text-right font-mono font-bold text-text-primary">{INR(item.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-surface-muted/30 border-t border-border font-bold">
                          <tr>
                            <td colSpan="5" className="px-2.5 py-1.5 text-right text-text-muted text-[10px] uppercase">
                              Total Order Sum:
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-mono text-primary">
                              {INR(detailOrderVal)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    ) : (
                      <div className="py-4 text-center text-text-muted text-xs">
                        No item lines present in this work order.
                      </div>
                    )}
                  </div>

                  {/* Status History */}
                  {detail.status_logs && detail.status_logs.length > 0 && (
                    <div className="border border-border rounded-lg p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-text-primary text-[11px] uppercase tracking-wider">
                          Workflow History ({detail.status_logs.length})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {detail.status_logs.map((log, i) => {
                          const title = getWorkflowLogLabel(log);
                          const newSt = (log.new_status || log.to_status_code || '').toUpperCase();
                          const isApprovedLog = newSt === 'APPROVED';
                          const isRejectedLog = newSt === 'REJECTED';
                          const isSubmittedLog = newSt === 'SUBMITTED';

                          return (
                            <div
                              key={log.id || i}
                              className="flex items-start gap-2.5 text-[11px] p-2.5 rounded-lg bg-surface-muted/30 border border-border/60"
                            >
                              <div
                                className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                                  isApprovedLog
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : isRejectedLog
                                    ? 'bg-rose-100 text-rose-700'
                                    : isSubmittedLog
                                    ? 'bg-sky-100 text-sky-700'
                                    : 'bg-surface-muted text-text-muted border border-border/80'
                                }`}
                              >
                                {isApprovedLog ? (
                                  <Check className="w-3.5 h-3.5" />
                                ) : isRejectedLog ? (
                                  <XCircle className="w-3.5 h-3.5" />
                                ) : isSubmittedLog ? (
                                  <Send className="w-3.5 h-3.5" />
                                ) : (
                                  <Clock className="w-3.5 h-3.5" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center justify-between gap-1">
                                  <span className="font-bold text-text-primary text-xs">
                                    {title}
                                  </span>
                                  <span className="text-text-muted text-[10px] font-mono">
                                    {log.changed_at || log.created_at || '—'}
                                  </span>
                                </div>

                                {log.remarks ? (
                                  <div className="mt-1.5 text-xs text-text-secondary bg-surface p-2 rounded border border-border/70">
                                    <span className="font-semibold text-text-primary">Reason / Remarks: </span>
                                    <span className="whitespace-pre-wrap">{log.remarks}</span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-text-muted block mt-0.5">
                                    {log.old_status
                                      ? `Transitioned from ${log.old_status} to ${log.new_status}`
                                      : 'Initial record created'}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            <div className="px-5 py-3 border-t border-border bg-surface-muted/20 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {/* DRAFT state: first only show Submit for Approval and Reject */}
                {detail && resolveStatus(detail) === 'DRAFT' && (
                  <>
                    <Button
                      size="sm"
                      variant="primary"
                      className="bg-sky-600 hover:bg-sky-700 text-xs text-white"
                      onClick={() => setConfirmAction({ type: 'submit', item: detail })}
                    >
                      <Send className="w-3.5 h-3.5 mr-1" /> Submit for Approval
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-rose-600 hover:bg-rose-50 border-rose-200 text-xs"
                      onClick={() => setConfirmAction({ type: 'reject', item: detail })}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                    </Button>
                  </>
                )}

                {/* SUBMITTED state: after submission, show Approve and Reject */}
                {detail && resolveStatus(detail) === 'SUBMITTED' && (
                  <>
                    <Button
                      size="sm"
                      variant="primary"
                      className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                      onClick={() => setConfirmAction({ type: 'approve', item: detail })}
                    >
                      <Check className="w-3.5 h-3.5 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-rose-600 hover:bg-rose-50 border-rose-200 text-xs"
                      onClick={() => setConfirmAction({ type: 'reject', item: detail })}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                    </Button>
                  </>
                )}

                {/* APPROVED state: show Activate Work Order */}
                {detail && resolveStatus(detail) === 'APPROVED' && (
                  <Button
                    size="sm"
                    variant="primary"
                    className="bg-sky-600 hover:bg-sky-700 text-xs"
                    onClick={() => setConfirmAction({ type: 'activate', item: detail })}
                  >
                    <Activity className="w-3.5 h-3.5 mr-1" /> Activate Work Order
                  </Button>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => { setViewingItem(null); setViewDetail(null); }}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Scope Item Modal */}
      {addItemModalOpen && targetWoForAddItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface border border-border rounded-xl shadow-level-3 w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-surface-muted/30">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-text-primary">
                  {proceedToApproveAfterItem ? 'Add Scope Item & Approve' : 'Add Scope Item to Work Order'}
                </h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setAddItemModalOpen(false)}>✕</Button>
            </div>

            <form onSubmit={handleSaveQuickItem}>
              <div className="p-5 space-y-3 text-xs">
                <p className="text-text-secondary text-[11px]">
                  Work Order <strong className="font-mono text-text-primary">{targetWoForAddItem.work_order_no}</strong> requires at least one scope line to establish its contract value and authorize approval.
                </p>

                <FormField label="Scope Item Description" required>
                  <Input
                    value={newItemForm.description}
                    onChange={(e) => setNewItemForm(prev => ({ ...prev, description: e.target.value }))}
                    className="text-xs"
                    placeholder="e.g. Masonry, Shuttering & Concreting Works"
                  />
                </FormField>

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Unit of Measure (UOM)">
                    <Select
                      options={uoms.map(u => ({ value: String(u.id), label: u.unit_name || u.name || u.unit_code }))}
                      value={newItemForm.uom_id}
                      onChange={(v) => setNewItemForm(prev => ({ ...prev, uom_id: v }))}
                      className="text-xs"
                    />
                  </FormField>

                  <FormField label="Quantity" required>
                    <Input
                      type="number"
                      min="0.01"
                      step="any"
                      value={newItemForm.ordered_quantity}
                      onChange={(e) => setNewItemForm(prev => ({ ...prev, ordered_quantity: e.target.value }))}
                      className="text-xs font-mono text-right"
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Unit Rate (₹)" required>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={newItemForm.rate}
                      onChange={(e) => setNewItemForm(prev => ({ ...prev, rate: e.target.value }))}
                      className="text-xs font-mono text-right font-bold text-primary"
                      placeholder="0"
                    />
                  </FormField>

                  <FormField label="Line Amount (₹)">
                    <div className="h-9 px-3 py-2 bg-surface-muted rounded border border-border font-mono font-bold text-text-primary text-right text-xs flex items-center justify-end">
                      ₹{Math.round((Number(newItemForm.ordered_quantity) || 0) * (Number(newItemForm.rate) || 0)).toLocaleString('en-IN')}
                    </div>
                  </FormField>
                </div>
              </div>

              <div className="px-5 py-3 border-t border-border bg-surface-muted/20 flex justify-end gap-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setAddItemModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={addingItemSaving}>
                  {addingItemSaving ? 'Saving...' : (proceedToApproveAfterItem ? 'Save Item & Approve WO' : 'Save Scope Item')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Workflow Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface border border-border rounded-xl shadow-level-3 w-full max-w-md overflow-hidden">
            <div className="p-5 space-y-3">
              <h3 className="text-base font-bold text-text-primary capitalize flex items-center gap-2">
                {confirmAction.type === 'approve' && <Check className="w-5 h-5 text-emerald-600" />}
                {confirmAction.type === 'reject' && <XCircle className="w-5 h-5 text-rose-600" />}
                {confirmAction.type === 'submit' && <Send className="w-5 h-5 text-sky-600" />}
                {confirmAction.type === 'activate' && <Activity className="w-5 h-5 text-sky-600" />}
                {confirmAction.type} Work Order
              </h3>

              <p className="text-xs text-text-secondary">
                {confirmAction.type === 'submit' && `Submit work order ${confirmAction.item.work_order_no} for management review and authorization.`}
                {confirmAction.type === 'approve' && `Approve work order ${confirmAction.item.work_order_no} for ${INR(getOrderEffectiveValue(confirmAction.item))}. This will authorize subcontract operations.`}
                {confirmAction.type === 'reject' && `Reject work order ${confirmAction.item.work_order_no}. Please provide a clear revision reason below.`}
                {confirmAction.type === 'activate' && `Activate work order ${confirmAction.item.work_order_no} to begin site measurements and RA billing.`}
                {confirmAction.type === 'complete' && `Mark work order ${confirmAction.item.work_order_no} as complete.`}
                {confirmAction.type === 'cancel' && `Cancel work order ${confirmAction.item.work_order_no}. This action cannot be undone.`}
              </p>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Comments / Remarks {confirmAction.type === 'reject' && <span className="text-rose-500">*</span>}
                </label>
                <textarea
                  rows={3}
                  value={actionComments}
                  onChange={(e) => setActionComments(e.target.value)}
                  placeholder={
                    confirmAction.type === 'reject'
                      ? 'Specify why this work order is being returned for revision...'
                      : 'Optional remarks or authorization notes...'
                  }
                  className="w-full text-xs p-2.5 rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-border bg-surface-muted/20 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setConfirmAction(null); setActionComments(''); }}
                disabled={actionSubmitting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant={confirmAction.type === 'reject' || confirmAction.type === 'cancel' ? 'destructive' : 'primary'}
                className={confirmAction.type === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                onClick={handleConfirmAction}
                disabled={actionSubmitting}
              >
                {actionSubmitting ? 'Processing...' : `Confirm ${confirmAction.type.toUpperCase()}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

export default WorkOrderApprovalPage;
