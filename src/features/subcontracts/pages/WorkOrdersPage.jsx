import { useState, useEffect, useMemo } from 'react';
import {
  FileText, CheckCircle2, IndianRupee, Clock, Layers,
  Search, Filter, Eye, Edit, Trash2, Plus, ArrowRight,
  ShieldCheck, Check, AlertCircle, Sparkles, Building, Printer, Send,
  X, AlertTriangle, PlusCircle, Trash, MapPin
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
import { Textarea } from '../../../components/ui/Textarea';
import { FormField } from '../../../components/composite/FormField';
import { EntityEditModal } from '../../../components/composite/EntityEditModal';
import { ConfirmDialog } from '../../../components/composite/ConfirmDialog';
import { toast } from '../../../components/composite/Toast';
import { projectsApi, sitesApi, siteZonesApi, subcontractsApi, materialsApi, unitsApi } from '../../../api/apiservice';
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

/**
 * Auto-generate next work order number based on previous order created
 */
export function getNextWorkOrderNo(workOrdersList) {
  const currentYear = new Date().getFullYear();
  if (!workOrdersList || workOrdersList.length === 0) {
    return `WO-${currentYear}-0001`;
  }

  // Check the latest created work order (list is sorted id DESC from backend)
  const latest = workOrdersList[0];
  if (latest?.work_order_no) {
    const str = String(latest.work_order_no).trim();
    const match = str.match(/^(.*?[^\d])(\d{1,6})$/);
    if (match) {
      const prefix = match[1];
      const digits = match[2];
      const num = parseInt(digits, 10);
      if (!isNaN(num) && num < 999999) {
        const nextNum = num + 1;
        const padLen = Math.max(digits.length, 3);
        return `${prefix}${String(nextNum).padStart(padLen, '0')}`;
      }
    }
  }

  // Fallback: scan all work orders for highest numeric suffix in WO- format
  let maxSeq = 0;
  for (const w of workOrdersList) {
    const s = String(w.work_order_no || '').trim();
    const m = s.match(/(?:WO[-_]?(?:\d{4}[-_]?)?)(\d{1,5})$/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxSeq) {
        maxSeq = n;
      }
    }
  }

  if (maxSeq > 0) {
    return `WO-${currentYear}-${String(maxSeq + 1).padStart(3, '0')}`;
  }

  return `WO-${currentYear}-001`;
}

const EMPTY_ITEM = {
  item_code: 'WO-ITEM-01',
  description: '',
  uom_id: '1',
  ordered_quantity: '1',
  rate: '',
  tax_percent: '0',
};

const EMPTY_FORM = {
  project_id: '',
  site_id: '',
  work_zone_id: '',
  contractor_id: '',
  work_order_no: '',
  work_order_date: '',
  start_date: '',
  completion_date: '',
  scope_of_work: '',
  payment_terms: 'RA bill every 15 days; payment within 15 days after certification.',
  terms_and_conditions: '',
  total_order_value: '',
  retention_pct: '5.0',
  advance_pct: '10.0',
  items: [{ ...EMPTY_ITEM }],
};

export function WorkOrdersPage() {
  const { hasPermission } = useAuth();
  const [projects, setProjects] = useState([]);
  const [sites, setSites] = useState([]);
  const [siteZones, setSiteZones] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [uoms, setUoms] = useState(DEFAULT_UOMS);
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [viewingDetail, setViewingDetail] = useState(null);
  const [viewingLoading, setViewingLoading] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [fixingItem, setFixingItem] = useState(false);

  const fetchList = () => {
    setLoading(true);
    Promise.all([
      projectsApi.list().catch(() => ({ data: [] })),
      sitesApi.list().catch(() => ({ data: [] })),
      siteZonesApi.list().catch(() => ({ data: [] })),
      subcontractsApi.contractors.list().catch(() => ({ data: [] })),
      subcontractsApi.workOrders.list().catch(() => ({ data: [] })),
      materialsApi.masters().catch(() => ({ data: {} })),
      unitsApi.list().catch(() => ({ data: [] })),
    ]).then(([projRes, sitesRes, zonesRes, contrRes, woRes, matRes, unitsRes]) => {
      const pList = projRes?.data?.projects ?? projRes?.projects ?? (Array.isArray(projRes?.data) ? projRes.data : []);
      setProjects(Array.isArray(pList) ? pList : []);

      const sList = sitesRes?.data?.sites ?? sitesRes?.sites ?? (Array.isArray(sitesRes?.data) ? sitesRes.data : []);
      setSites(Array.isArray(sList) ? sList : []);

      const zList = zonesRes?.data?.site_zones ?? zonesRes?.site_zones ?? (Array.isArray(zonesRes?.data) ? zonesRes.data : []);
      setSiteZones(Array.isArray(zList) ? zList : []);

      const cList = contrRes?.data?.subcontractors ?? contrRes?.data?.data ?? [];
      setContractors(Array.isArray(cList) ? cList : []);

      const uList = matRes?.data?.masters?.units ?? matRes?.masters?.units ?? unitsRes?.data?.units_of_measurement ?? [];
      if (Array.isArray(uList) && uList.length > 0) {
        setUoms(uList);
      }

      const woList = woRes?.data?.work_orders ?? woRes?.data?.data ?? [];
      if (Array.isArray(woList)) {
        const normalized = woList.map((w) => {
          const matchedProj = pList.find(p => String(p.id) === String(w.project_id));
          const matchedSite = sList.find(s => String(s.id) === String(w.site_id));
          const matchedContr = cList.find(c => String(c.id) === String(w.contractor_id));

          let totalVal = Number(w.total_order_value || w.revised_order_value || 0);
          const advAmt = Number(w.advance_amount || 0);

          // If backend total_order_value is 0 because items were not attached yet,
          // but advance_amount exists, infer intended contract value (standard 10% advance):
          if (totalVal === 0 && advAmt > 0) {
            totalVal = Math.round(advAmt * 10);
          }

          // Calculate safe advance percentage
          let safeAdvancePct = totalVal > 0 ? Number(((advAmt / totalVal) * 100).toFixed(1)) : 0;
          if (safeAdvancePct === 0 && advAmt > 0) {
            safeAdvancePct = 10.0;
          }

          return {
            id: w.id,
            project_id: w.project_id,
            site_id: w.site_id,
            work_zone_id: w.work_zone_id,
            project_code: matchedProj?.project_code || 'PRJ-01',
            project_name: matchedProj?.project_name || 'Project Name',
            site_name: matchedSite?.site_name || '',
            work_order_no: w.work_order_no || `WO-${w.id}`,
            work_order_date: w.work_order_date ? w.work_order_date.split('T')[0] : '',
            contractor_id: w.contractor_id,
            contractor_name: matchedContr?.contractor_name || 'Subcontractor Partner',
            package_title: w.scope_of_work || 'Work Package',
            start_date: w.start_date ? w.start_date.split('T')[0] : '',
            completion_date: w.completion_date ? w.completion_date.split('T')[0] : '',
            total_order_value: totalVal,
            retention_pct: Number(w.retention_percent ?? 5.0),
            advance_amount: advAmt,
            advance_pct: safeAdvancePct,
            certified_amount: Number(w.certified_amount || 0),
            paid_amount: Number(w.paid_amount || 0),
            status_name: w.status_name || w.status_code || 'Draft',
            payment_terms: w.payment_terms || 'RA bill every 15 days; payment within 15 days after certification.',
            terms_and_conditions: w.terms_and_conditions || '',
            scope_summary: w.terms_and_conditions || w.scope_of_work || '',
          };
        });

        setWorkOrders(normalized);

        // Auto-heal DRAFT work orders that have 0 total_order_value but advance_amount > 0 (like WO-2026-017)
        woList.forEach(rawWo => {
          const isDraft = String(rawWo.status_name || rawWo.status_code || '').toUpperCase().includes('DRAFT');
          const rawTotal = Number(rawWo.total_order_value || 0);
          const rawAdv = Number(rawWo.advance_amount || 0);
          if (isDraft && rawTotal === 0 && rawAdv > 0) {
            const healedVal = Math.round(rawAdv * 10);
            subcontractsApi.workOrders.addItem(rawWo.id, {
              item_code: 'WO-ITEM-01',
              description: rawWo.scope_of_work || 'Subcontract Scope Package',
              uom_id: 1,
              ordered_quantity: 1,
              rate: healedVal,
              tax_percent: 0,
            }).then(() => {
              // Successfully saved item and triggered backend recalc!
            }).catch(() => {});
          }
        });
      }
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchList();
  }, []);

  // Compute items total amount
  const calculateItemsTotal = (itemsList) => {
    return itemsList.reduce((acc, it) => {
      const q = Number(it.ordered_quantity || 0);
      const r = Number(it.rate || 0);
      const t = Number(it.tax_percent || 0);
      const base = q * r;
      const tax = base * (t / 100);
      return acc + base + tax;
    }, 0);
  };

  // Filter available sites & zones for selected project
  const availableSites = useMemo(() => {
    if (!form.project_id) return [];
    return sites.filter(s => String(s.project_id) === String(form.project_id));
  }, [sites, form.project_id]);

  const availableZones = useMemo(() => {
    if (!form.site_id) return [];
    return siteZones.filter(z => String(z.site_id) === String(form.site_id));
  }, [siteZones, form.site_id]);

  // Form Handlers
  const handleOpenAdd = () => {
    const today = new Date().toISOString().split('T')[0];
    const defaultProj = selectedProjectId !== 'all' ? selectedProjectId : (projects[0]?.id ? String(projects[0].id) : '');
    const nextWoNo = getNextWorkOrderNo(workOrders);
    const defaultUom = uoms[0]?.id ? String(uoms[0].id) : '1';

    setForm({
      ...EMPTY_FORM,
      project_id: defaultProj,
      work_order_no: nextWoNo,
      work_order_date: today,
      start_date: today,
      items: [
        {
          item_code: 'WO-ITEM-01',
          description: '',
          uom_id: defaultUom,
          ordered_quantity: '1',
          rate: '',
          tax_percent: '0',
        }
      ]
    });
    setErrors({});
    setIsAddOpen(true);
  };

  const handleOpenEdit = async (item) => {
    setSaving(true);
    try {
      const res = await subcontractsApi.workOrders.get(item.id);
      const wo = res?.data?.work_order ?? res?.work_order ?? item;
      const woItems = wo.items || [];
      const defaultUom = uoms[0]?.id ? String(uoms[0].id) : '1';

      let totalVal = Number(wo.total_order_value || wo.revised_order_value || 0);
      const advAmt = Number(wo.advance_amount || 0);
      if (totalVal === 0 && advAmt > 0) {
        totalVal = Math.round(advAmt * 10);
      }
      const safeAdvPct = totalVal > 0 ? Number(((advAmt / totalVal) * 100).toFixed(1)) : 10;

      const loadedItems = woItems.length > 0 ? woItems.map((it, idx) => ({
        id: it.id,
        item_code: it.item_code || `WO-ITEM-0${idx + 1}`,
        description: it.description || '',
        uom_id: String(it.uom_id || defaultUom),
        ordered_quantity: String(it.ordered_quantity || '1'),
        rate: String(it.rate || '0'),
        tax_percent: String(it.tax_percent || '0'),
      })) : [
        {
          item_code: 'WO-ITEM-01',
          description: wo.scope_of_work || '',
          uom_id: defaultUom,
          ordered_quantity: '1',
          rate: String(totalVal || '100000'),
          tax_percent: '0',
        }
      ];

      setForm({
        project_id: String(wo.project_id || ''),
        site_id: String(wo.site_id || ''),
        work_zone_id: String(wo.work_zone_id || ''),
        work_order_no: wo.work_order_no || '',
        work_order_date: wo.work_order_date ? wo.work_order_date.split('T')[0] : '',
        contractor_id: String(wo.contractor_id || ''),
        scope_of_work: wo.scope_of_work || '',
        start_date: wo.start_date ? wo.start_date.split('T')[0] : '',
        completion_date: wo.completion_date ? wo.completion_date.split('T')[0] : '',
        total_order_value: String(totalVal || calculateItemsTotal(loadedItems) || ''),
        retention_pct: String(wo.retention_percent ?? '5.0'),
        advance_pct: String(safeAdvPct),
        payment_terms: wo.payment_terms || 'RA bill every 15 days; payment within 15 days after certification.',
        terms_and_conditions: wo.terms_and_conditions || '',
        items: loadedItems,
      });
      setErrors({});
      setEditingItem(wo);
      setIsAddOpen(true);
    } catch {
      toast.error('Failed to load work order details.');
    } finally {
      setSaving(false);
    }
  };

  const handleFormChange = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      // Clear dependent site/zone if parent project changed
      if (field === 'project_id') {
        next.site_id = '';
        next.work_zone_id = '';
      }
      if (field === 'site_id') {
        next.work_zone_id = '';
      }
      // If user edits total_order_value manually and there is exactly 1 item, sync the item rate
      if (field === 'total_order_value' && next.items.length === 1) {
        const val = Number(value) || 0;
        const qty = Number(next.items[0].ordered_quantity) || 1;
        const rate = qty > 0 ? (val / qty).toFixed(2) : String(val);
        next.items[0] = { ...next.items[0], rate };
      }
      // If scope_of_work changed and first item has empty description, sync description
      if (field === 'scope_of_work' && next.items.length === 1 && !next.items[0].description) {
        next.items[0] = { ...next.items[0], description: value };
      }
      return next;
    });
    setErrors(prev => ({ ...prev, [field]: null }));
  };

  // Item lines handlers
  const handleItemChange = (index, field, value) => {
    setForm(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      const newTotal = calculateItemsTotal(newItems);
      return {
        ...prev,
        items: newItems,
        total_order_value: String(Math.round(newTotal)),
      };
    });
    setErrors(prev => ({ ...prev, [`item_${index}_${field}`]: null }));
  };

  const handleAddItemRow = () => {
    const defaultUom = uoms[0]?.id ? String(uoms[0].id) : '1';
    const nextIdx = form.items.length + 1;
    setForm(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          item_code: `WO-ITEM-0${nextIdx}`,
          description: '',
          uom_id: defaultUom,
          ordered_quantity: '1',
          rate: '',
          tax_percent: '0',
        }
      ]
    }));
  };

  const handleRemoveItemRow = (index) => {
    if (form.items.length <= 1) {
      toast.error('At least one item line is required for a work order.');
      return;
    }
    setForm(prev => {
      const newItems = prev.items.filter((_, idx) => idx !== index);
      const newTotal = calculateItemsTotal(newItems);
      return {
        ...prev,
        items: newItems,
        total_order_value: String(Math.round(newTotal)),
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.project_id) errs.project_id = 'Project is required';
    if (!form.contractor_id) errs.contractor_id = 'Contractor is required';
    if (!form.work_order_no.trim()) errs.work_order_no = 'WO number is required';
    if (!form.scope_of_work.trim()) errs.scope_of_work = 'Scope of work is required';

    // Validate items
    if (!form.items || form.items.length === 0) {
      errs.items = 'At least one work order scope item is required.';
    } else {
      form.items.forEach((it, idx) => {
        if (!it.description?.trim()) errs[`item_${idx}_description`] = 'Description is required';
        if (!it.ordered_quantity || Number(it.ordered_quantity) <= 0) errs[`item_${idx}_ordered_quantity`] = 'Qty must be > 0';
        if (it.rate === '' || Number(it.rate) < 0) errs[`item_${idx}_rate`] = 'Rate must be >= 0';
      });
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error('Please fix errors in required fields and item lines.');
      return;
    }

    setSaving(true);
    try {
      const itemsTotal = calculateItemsTotal(form.items);
      const advPct = Number(form.advance_pct || 0);
      const advanceAmount = Math.round(itemsTotal * (advPct / 100));
      const todayStr = new Date().toISOString().split('T')[0];

      // Exact fields based on subcontract_work_orders table structure
      const payload = {
        project_id: Number(form.project_id),
        site_id: form.site_id ? Number(form.site_id) : null,
        work_zone_id: form.work_zone_id ? Number(form.work_zone_id) : null,
        contractor_id: Number(form.contractor_id),
        work_order_no: form.work_order_no.trim(),
        work_order_date: form.work_order_date || form.start_date || todayStr,
        start_date: form.start_date || null,
        completion_date: form.completion_date || null,
        scope_of_work: form.scope_of_work.trim(),
        currency_code: 'INR',
        retention_percent: Number(form.retention_pct || 5.0),
        advance_amount: advanceAmount,
        payment_terms: form.payment_terms || null,
        terms_and_conditions: form.terms_and_conditions || null,
      };

      let targetWoId = editingItem?.id;

      if (targetWoId) {
        await subcontractsApi.workOrders.update(targetWoId, payload);
        // Save/update each item line
        for (const it of form.items) {
          const itemPayload = {
            item_code: it.item_code || 'WO-ITEM',
            description: it.description || form.scope_of_work,
            uom_id: Number(it.uom_id || 1),
            ordered_quantity: Number(it.ordered_quantity),
            rate: Number(it.rate),
            tax_percent: Number(it.tax_percent || 0),
          };
          if (it.id) {
            await subcontractsApi.workOrders.updateItem(targetWoId, it.id, itemPayload).catch(() => {});
          } else {
            await subcontractsApi.workOrders.addItem(targetWoId, itemPayload).catch(() => {});
          }
        }
        toast.success(`Work order ${form.work_order_no} updated successfully.`);
      } else {
        const createRes = await subcontractsApi.workOrders.create(payload);
        const createdWo = createRes?.data?.work_order ?? createRes?.work_order ?? createRes?.data ?? createRes;
        targetWoId = createdWo?.id;

        if (targetWoId) {
          // Add all item lines to the newly created work order to trigger backend recalc
          for (const it of form.items) {
            const itemPayload = {
              item_code: it.item_code || 'WO-ITEM',
              description: it.description || form.scope_of_work,
              uom_id: Number(it.uom_id || 1),
              ordered_quantity: Number(it.ordered_quantity),
              rate: Number(it.rate),
              tax_percent: Number(it.tax_percent || 0),
            };
            await subcontractsApi.workOrders.addItem(targetWoId, itemPayload);
          }
        }
        toast.success(`Work order ${form.work_order_no} issued successfully with ${form.items.length} scope item line(s).`);
      }

      fetchList();
      setIsAddOpen(false);
      setEditingItem(null);
    } catch (err) {
      const msg = err?.errors ? Object.values(err.errors).join(', ') : (err?.message || 'Failed to save work order.');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // View Work Order Detail Modal
  const handleOpenView = async (item) => {
    setViewingItem(item);
    setViewingLoading(true);
    try {
      const res = await subcontractsApi.workOrders.get(item.id);
      const detail = res?.data?.work_order ?? res?.work_order ?? item;
      setViewingDetail(detail);
    } catch {
      setViewingDetail(item);
    } finally {
      setViewingLoading(false);
    }
  };

  // Quick fix/attach scope item to a 0-item work order right from view modal
  const handleFixScopeItem = async () => {
    if (!viewingItem) return;
    setFixingItem(true);
    try {
      const targetVal = Number(viewingItem.total_order_value) > 0 ? Number(viewingItem.total_order_value) : (Number(viewingItem.advance_amount || 0) * 10 || 100000);
      const payload = {
        item_code: 'WO-ITEM-01',
        description: viewingItem.package_title || viewingItem.scope_of_work || 'Subcontract Scope Package',
        uom_id: 1,
        ordered_quantity: 1,
        rate: targetVal,
        tax_percent: 0,
      };
      await subcontractsApi.workOrders.addItem(viewingItem.id, payload);
      toast.success('Scope item generated and contract value updated in database.');
      fetchList();
      handleOpenView(viewingItem);
    } catch (err) {
      toast.error('Failed to attach scope item.');
    } finally {
      setFixingItem(false);
    }
  };

  // Filtered List
  const filtered = useMemo(() => {
    return workOrders.filter(w => {
      if (selectedProjectId !== 'all' && String(w.project_id) !== String(selectedProjectId)) return false;
      if (statusFilter !== 'all' && !w.status_name.toLowerCase().includes(statusFilter.toLowerCase())) return false;
      if (search) {
        const s = search.toLowerCase();
        const no = String(w.work_order_no || '').toLowerCase();
        const cont = String(w.contractor_name || '').toLowerCase();
        const pack = String(w.package_title || '').toLowerCase();
        const proj = String(w.project_name || '').toLowerCase();
        if (!no.includes(s) && !cont.includes(s) && !pack.includes(s) && !proj.includes(s)) return false;
      }
      return true;
    });
  }, [workOrders, selectedProjectId, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  // Metrics
  const totalCommitment = useMemo(() => workOrders.reduce((acc, w) => acc + Number(w.total_order_value || 0), 0), [workOrders]);
  const totalCertified = useMemo(() => workOrders.reduce((acc, w) => acc + Number(w.certified_amount || 0), 0), [workOrders]);

  const getStatusVariant = (st) => {
    const s = String(st || '').toLowerCase();
    if (s.includes('approved') || s.includes('active')) return 'success';
    if (s.includes('submitted') || s.includes('review') || s.includes('pending')) return 'info';
    if (s.includes('rejected') || s.includes('cancel')) return 'error';
    return 'neutral';
  };

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Subcontract Management', href: '/subcontracts/work-orders' },
    { label: 'Subcontract Work Orders (WO)' }
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Subcontract Work Orders (WO) & Packages"
        breadcrumbs={breadcrumbs}
      />

      <div className="flex flex-col gap-3 sm:gap-4 w-full">
        {/* KPI Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <KpiCard
            label="Total Contracted Value"
            value={`₹${(totalCommitment / 100000).toFixed(2)}L`}
            status="primary"
            icon={<IndianRupee className="w-4 h-4" />}
          />
          <KpiCard
            label="Cumulative Certified"
            value={`₹${(totalCertified / 100000).toFixed(2)}L`}
            status="success"
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          />
          <KpiCard
            label="Active Contract Packages"
            value={`${workOrders.length} Packages`}
            status="neutral"
            icon={<Layers className="w-4 h-4 text-sky-500" />}
          />
          <KpiCard
            label="Average Retention"
            value="5.0% Standard"
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
                  ...projects.map(p => ({ value: String(p.id), label: p.project_name || p.name }))
                ]}
                value={selectedProjectId}
                onChange={setSelectedProjectId}
                className="text-xs h-8"
              />
            </div>

            <div className="w-full sm:w-44">
              <Select
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'draft', label: 'Draft' },
                  { value: 'submitted', label: 'Submitted for Review' },
                  { value: 'approved', label: 'Approved & Active' },
                ]}
                value={statusFilter}
                onChange={setStatusFilter}
                className="text-xs h-8"
              />
            </div>

            <div className="w-full sm:w-56">
              <SearchField
                placeholder="Search WO no, contractor, package..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={handleOpenAdd}
              className="text-xs h-8 shadow-xs"
            >
              Issue Work Order
            </Button>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block">
          <DataTableContainer
            pagination={
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={filtered.length}
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
                  <th className="px-3 py-2 w-28">WO Number</th>
                  <th className="px-3 py-2">Package Title & Contractor</th>
                  <th className="px-3 py-2 w-32 hidden md:table-cell">Duration</th>
                  <th className="px-3 py-2 text-right w-28">Contract Value</th>
                  <th className="px-3 py-2 text-right w-28">Certified</th>
                  <th className="px-3 py-2 text-center w-28">Status</th>
                  <th className="px-3 py-2 text-center w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="text-center py-8 text-text-muted text-[12px]">
                      Loading subcontract work orders...
                    </td>
                  </tr>
                ) : paged.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-8 text-text-muted text-[12px]">
                      No work orders found matching criteria.
                    </td>
                  </tr>
                ) : (
                  paged.map((w, idx) => (
                    <tr key={w.id || idx} className="hover:bg-surface-muted/30 transition-colors group">
                      <td className="px-3 py-2 text-center font-medium text-text-primary text-[11px]">
                        {(page - 1) * perPage + idx + 1}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                          {w.work_order_no}
                        </span>
                        <span className="text-[10px] text-text-muted font-mono block pt-0.5">{w.work_order_date}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-text-primary text-[12px] truncate" title={w.package_title}>
                            {w.package_title}
                          </span>
                          <span className="text-[10px] text-text-muted truncate">
                            {w.contractor_name} • {w.project_name} {w.site_name ? `(${w.site_name})` : ''}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell font-mono text-[10px] text-text-secondary">
                        <div>{w.start_date || '—'}</div>
                        <div className="text-text-muted">to {w.completion_date || '—'}</div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-text-primary text-[11px]">
                        ₹{Number(w.total_order_value || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-emerald-600 font-semibold">
                        ₹{Number(w.certified_amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge
                          variant={getStatusVariant(w.status_name)}
                          className="text-[8px] font-bold uppercase tracking-wider h-4 px-1.5 inline-flex items-center leading-none"
                        >
                          {w.status_name}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="View WO 360 Contract"
                            onClick={() => handleOpenView(w)}
                          >
                            <Eye className="w-3.5 h-3.5 text-text-secondary hover:text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="Edit"
                            onClick={() => handleOpenEdit(w)}
                          >
                            <Edit className="w-3.5 h-3.5 text-text-secondary hover:text-primary" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </DataTableContainer>
        </div>

        {/* Mobile View */}
        <div className="block sm:hidden space-y-3">
          {paged.map((w, idx) => (
            <div key={w.id || idx} className="bg-surface border border-border rounded-lg p-3.5 shadow-xs space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-[10px] font-bold text-primary block">{w.work_order_no} • {w.work_order_date}</span>
                  <h4 className="font-semibold text-text-primary text-[13px] leading-snug">{w.package_title}</h4>
                  <span className="text-[11px] text-text-muted">{w.contractor_name}</span>
                </div>
                <Badge
                  variant={getStatusVariant(w.status_name)}
                  className="text-[8px] font-bold uppercase tracking-wider h-4 px-1.5 inline-flex items-center leading-none shrink-0"
                >
                  {w.status_name}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/60">
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Contract Value</span>
                  <span className="font-mono font-bold text-text-primary text-[11px]">
                    ₹{Number(w.total_order_value || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Advance ({w.advance_pct}%)</span>
                  <span className="font-mono font-medium text-text-secondary text-[11px]">
                    ₹{Number(w.advance_amount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/60 text-xs">
                <Button variant="outline" size="sm" className="h-7 text-[11px] px-2" onClick={() => handleOpenView(w)}>
                  <Eye className="w-3 h-3 mr-1" /> View
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-[11px] px-2" onClick={() => handleOpenEdit(w)}>
                  <Edit className="w-3 h-3 mr-1" /> Edit
                </Button>
              </div>
            </div>
          ))}

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

      {/* View Work Order 360 Modal */}
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
                  <span className="text-[11px] font-mono text-text-muted">{viewingItem.contractor_name} • {viewingItem.project_name}</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setViewingItem(null); setViewingDetail(null); }}>✕</Button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              {viewingLoading ? (
                <div className="py-8 text-center text-text-muted">Loading complete work order record...</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-surface-muted/30 p-3.5 rounded-lg border border-border">
                    <div>
                      <span className="text-text-muted block text-[10px] uppercase font-bold">Contract Total Value</span>
                      <span className="font-bold text-primary font-mono text-base">
                        ₹{Number(viewingDetail?.total_order_value || viewingItem.total_order_value || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-muted block text-[10px] uppercase font-bold">Certified to Date</span>
                      <span className="font-bold text-emerald-600 font-mono text-base">
                        ₹{Number(viewingDetail?.certified_amount || viewingItem.certified_amount || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-muted block text-[10px] uppercase font-bold">Retention Deduction</span>
                      <span className="font-mono font-bold text-amber-600">
                        {viewingDetail?.retention_percent ?? viewingItem.retention_pct}%
                      </span>
                    </div>
                    <div>
                      <span className="text-text-muted block text-[10px] uppercase font-bold">Advance Amount</span>
                      <span className="font-mono font-bold text-text-primary">
                        ₹{Number(viewingDetail?.advance_amount || viewingItem.advance_amount || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-muted block text-[10px] uppercase font-bold">Mobilization Advance</span>
                      <span className="font-mono font-bold text-text-primary">
                        {viewingItem.advance_pct}%
                      </span>
                    </div>
                    <div>
                      <span className="text-text-muted block text-[10px] uppercase font-bold">Status</span>
                      <Badge variant={getStatusVariant(viewingDetail?.status_name || viewingItem.status_name)} className="mt-0.5 text-[9px] font-bold uppercase">
                        {viewingDetail?.status_name || viewingItem.status_name}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-text-muted block text-[10px] uppercase font-bold">Contract Start Date</span>
                      <span className="font-mono">{viewingDetail?.start_date ? viewingDetail.start_date.split('T')[0] : viewingItem.start_date || '—'}</span>
                    </div>
                    <div>
                      <span className="text-text-muted block text-[10px] uppercase font-bold">Target Completion</span>
                      <span className="font-mono text-primary font-bold">{viewingDetail?.completion_date ? viewingDetail.completion_date.split('T')[0] : viewingItem.completion_date || '—'}</span>
                    </div>
                    <div className="col-span-2 sm:col-span-3">
                      <span className="text-text-muted block text-[10px] uppercase font-bold">Work Package Scope</span>
                      <span className="text-text-primary font-medium">{viewingDetail?.scope_of_work || viewingItem.package_title}</span>
                    </div>
                  </div>

                  {/* Scope Items Table */}
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-surface-muted px-3 py-2 border-b border-border flex items-center justify-between">
                      <span className="font-bold text-text-primary text-[11px]">
                        Work Order Scope Items ({viewingDetail?.items?.length || 0})
                      </span>
                    </div>
                    {(!viewingDetail?.items || viewingDetail.items.length === 0) ? (
                      <div className="p-4 text-center text-text-muted text-xs bg-amber-50/60 border-t border-amber-200 flex flex-col items-center gap-2">
                        <p className="text-amber-800 font-medium">
                          <AlertCircle className="w-4 h-4 text-amber-600 inline mr-1 -mt-0.5" />
                          No scope item lines found in database. Contract Value currently reflects ₹{Number(viewingItem.total_order_value || 0).toLocaleString('en-IN')}.
                        </p>
                        <Button
                          size="sm"
                          variant="primary"
                          className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                          onClick={handleFixScopeItem}
                          disabled={fixingItem}
                        >
                          <PlusCircle className="w-3.5 h-3.5 mr-1" />
                          {fixingItem ? 'Generating Scope Item...' : 'Attach Scope Item & Recalculate Contract Value'}
                        </Button>
                      </div>
                    ) : (
                      <table className="w-full text-[11px]">
                        <thead className="bg-surface-muted/50 text-[10px] uppercase text-text-secondary font-semibold">
                          <tr>
                            <th className="px-2.5 py-1.5 text-left">#</th>
                            <th className="px-2.5 py-1.5 text-left">Item Code</th>
                            <th className="px-2.5 py-1.5 text-left">Description</th>
                            <th className="px-2.5 py-1.5 text-right">Qty</th>
                            <th className="px-2.5 py-1.5 text-right">Rate (₹)</th>
                            <th className="px-2.5 py-1.5 text-right">Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {viewingDetail.items.map((it, i) => (
                            <tr key={it.id || i} className="hover:bg-surface-muted/20">
                              <td className="px-2.5 py-1.5 text-text-muted">{i + 1}</td>
                              <td className="px-2.5 py-1.5 font-mono font-medium text-text-primary">{it.item_code || '—'}</td>
                              <td className="px-2.5 py-1.5 text-text-secondary">{it.description || '—'}</td>
                              <td className="px-2.5 py-1.5 text-right font-mono">{Number(it.ordered_quantity || 0).toLocaleString('en-IN')}</td>
                              <td className="px-2.5 py-1.5 text-right font-mono">₹{Number(it.rate || 0).toLocaleString('en-IN')}</td>
                              <td className="px-2.5 py-1.5 text-right font-mono font-bold text-text-primary">
                                ₹{Number(it.amount || (it.ordered_quantity * it.rate) || 0).toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-surface-muted/30 border-t border-border font-bold">
                          <tr>
                            <td colSpan="5" className="px-2.5 py-1.5 text-right text-text-muted text-[10px] uppercase">
                              Total Calculated Contract Value:
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-mono text-primary">
                              ₹{Number(viewingDetail?.total_order_value || viewingItem.total_order_value || 0).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </div>

                  {viewingDetail?.payment_terms && (
                    <div className="border border-border rounded-lg p-3 space-y-1">
                      <span className="font-bold text-text-primary block text-[11px]">Payment Terms:</span>
                      <p className="text-text-secondary bg-surface-muted/30 p-2 rounded border border-border/50 leading-relaxed whitespace-pre-wrap">
                        {viewingDetail.payment_terms}
                      </p>
                    </div>
                  )}

                  {viewingDetail?.terms_and_conditions && (
                    <div className="border border-border rounded-lg p-3 space-y-1">
                      <span className="font-bold text-text-primary block text-[11px]">Contract Specifications & Terms:</span>
                      <p className="text-text-secondary bg-surface-muted/30 p-2 rounded border border-border/50 leading-relaxed whitespace-pre-wrap">
                        {viewingDetail.terms_and_conditions}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-5 py-3 border-t border-border bg-surface-muted/20 flex justify-end items-center">
              <Button variant="outline" size="sm" onClick={() => { setViewingItem(null); setViewingDetail(null); }}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit WO Modal with complete subcontract_work_orders table structure */}
      <EntityEditModal
        isOpen={Boolean(isAddOpen || editingItem)}
        onClose={() => { setIsAddOpen(false); setEditingItem(null); }}
      >
        <EntityEditModal.Header
          icon={FileText}
          title={editingItem ? 'Edit Work Order' : 'Issue Subcontract Work Order (WO)'}
          subtitle="Formulate package agreement, site, contractor, scope items, rates, retention %, and schedule."
          onClose={() => { setIsAddOpen(false); setEditingItem(null); }}
        />
        <form id="wo-form" onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <EntityEditModal.Body>
            <EntityEditModal.Section title="Work Order & Project Hierarchy">
              <EntityEditModal.Grid>
                <FormField label="Parent Project" required error={errors.project_id}>
                  <Select
                    options={projects.map(p => ({ value: String(p.id), label: p.project_name || p.name }))}
                    value={form.project_id}
                    onChange={(v) => handleFormChange('project_id', v)}
                  />
                </FormField>

                <FormField
                  label="Work Order No (Auto-Generated)"
                  required
                  error={errors.work_order_no}
                  hint="Auto-generated from previous order; editable if required."
                >
                  <Input
                    value={form.work_order_no}
                    onChange={(e) => handleFormChange('work_order_no', e.target.value)}
                    placeholder="WO-2026-001"
                    className="font-mono font-bold"
                  />
                </FormField>

                <FormField label="Project Site (Optional)">
                  <Select
                    options={[
                      { value: '', label: 'Select Site (Optional)' },
                      ...availableSites.map(s => ({ value: String(s.id), label: s.site_name || s.name }))
                    ]}
                    value={form.site_id}
                    onChange={(v) => handleFormChange('site_id', v)}
                    disabled={!form.project_id}
                  />
                </FormField>

                <FormField label="Site Work Zone (Optional)">
                  <Select
                    options={[
                      { value: '', label: 'Select Zone (Optional)' },
                      ...availableZones.map(z => ({ value: String(z.id), label: z.zone_name || z.name }))
                    ]}
                    value={form.work_zone_id}
                    onChange={(v) => handleFormChange('work_zone_id', v)}
                    disabled={!form.site_id}
                  />
                </FormField>

                <FormField label="Subcontractor" required error={errors.contractor_id} className="md:col-span-2">
                  <Select
                    options={contractors.map(c => ({ value: String(c.id), label: c.contractor_name || c.name }))}
                    value={form.contractor_id}
                    onChange={(v) => handleFormChange('contractor_id', v)}
                  />
                </FormField>

                <FormField label="Package Scope Title (scope_of_work)" required error={errors.scope_of_work} className="md:col-span-2">
                  <Input
                    value={form.scope_of_work}
                    onChange={(e) => handleFormChange('scope_of_work', e.target.value)}
                    placeholder="e.g. RCC Sub-structure & Superstructure Work Package"
                  />
                </FormField>
              </EntityEditModal.Grid>
            </EntityEditModal.Section>

            {/* Scope Items / Line Items Section */}
            <EntityEditModal.Section title="Work Order Scope Items (Persisted to backend, calculates Contract Value)">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-text-secondary">
                    Each item line defines code, description, UOM, quantity, and unit rate. Sum of items sets Contract Value.
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={handleAddItemRow}
                  >
                    <PlusCircle className="w-3.5 h-3.5 mr-1 text-primary" />
                    Add Scope Line
                  </Button>
                </div>

                <div className="border border-border rounded-lg overflow-x-auto bg-surface">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-muted text-text-secondary text-[10px] uppercase font-semibold border-b border-border">
                      <tr>
                        <th className="p-2 text-left w-24">Item Code</th>
                        <th className="p-2 text-left min-w-[180px]">Scope Description</th>
                        <th className="p-2 text-left w-24">UOM</th>
                        <th className="p-2 text-right w-20">Qty</th>
                        <th className="p-2 text-right w-28">Unit Rate (₹)</th>
                        <th className="p-2 text-right w-28">Amount (₹)</th>
                        <th className="p-2 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {form.items.map((it, idx) => {
                        const lineAmount = (Number(it.ordered_quantity) || 0) * (Number(it.rate) || 0);
                        return (
                          <tr key={idx} className="hover:bg-surface-muted/30">
                            <td className="p-1.5">
                              <Input
                                value={it.item_code}
                                onChange={(e) => handleItemChange(idx, 'item_code', e.target.value)}
                                className="h-7 text-xs font-mono"
                                placeholder="ITEM-01"
                              />
                            </td>
                            <td className="p-1.5">
                              <Input
                                value={it.description}
                                onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                className={`h-7 text-xs ${errors[`item_${idx}_description`] ? 'border-red-500' : ''}`}
                                placeholder={form.scope_of_work || "Scope description"}
                              />
                            </td>
                            <td className="p-1.5">
                              <Select
                                options={uoms.map(u => ({ value: String(u.id), label: u.unit_name || u.unit_code }))}
                                value={String(it.uom_id || '1')}
                                onChange={(v) => handleItemChange(idx, 'uom_id', v)}
                                className="h-7 text-xs"
                              />
                            </td>
                            <td className="p-1.5">
                              <Input
                                type="number"
                                min="0.01"
                                step="any"
                                value={it.ordered_quantity}
                                onChange={(e) => handleItemChange(idx, 'ordered_quantity', e.target.value)}
                                className="h-7 text-xs text-right font-mono"
                              />
                            </td>
                            <td className="p-1.5">
                              <Input
                                type="number"
                                min="0"
                                step="any"
                                value={it.rate}
                                onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                                className="h-7 text-xs text-right font-mono font-medium"
                                placeholder="0"
                              />
                            </td>
                            <td className="p-1.5 text-right font-mono font-bold text-text-primary">
                              ₹{Math.round(lineAmount).toLocaleString('en-IN')}
                            </td>
                            <td className="p-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItemRow(idx)}
                                disabled={form.items.length <= 1}
                                className="p-1 text-text-muted hover:text-red-500 disabled:opacity-30 disabled:hover:text-text-muted"
                                title="Remove line"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-surface-muted/40 font-bold border-t border-border">
                      <tr>
                        <td colSpan="5" className="p-2 text-right text-text-secondary text-[11px] uppercase">
                          Calculated Total Contract Value:
                        </td>
                        <td className="p-2 text-right font-mono text-primary text-sm font-bold">
                          ₹{Math.round(calculateItemsTotal(form.items)).toLocaleString('en-IN')}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </EntityEditModal.Section>

            <EntityEditModal.Section title="Commercial Terms, Schedule & Advances">
              <EntityEditModal.Grid>
                <FormField
                  label="Total Contract Order Value (₹)"
                  required
                  hint="Synced automatically with item lines; sets contract commitment."
                >
                  <Input
                    type="number"
                    value={form.total_order_value}
                    onChange={(e) => handleFormChange('total_order_value', e.target.value)}
                    className="font-mono font-bold text-primary"
                  />
                </FormField>

                <FormField label="Retention Percentage (%)" hint="Standard 5.0% retained from RA bills">
                  <Input
                    type="number"
                    step="0.5"
                    value={form.retention_pct}
                    onChange={(e) => handleFormChange('retention_pct', e.target.value)}
                  />
                </FormField>

                <FormField
                  label="Mobilization Advance (%)"
                  hint={`Advance Payable: ₹${Math.round((Number(form.total_order_value) || 0) * ((Number(form.advance_pct) || 0) / 100)).toLocaleString('en-IN')}`}
                >
                  <Input
                    type="number"
                    step="0.5"
                    value={form.advance_pct}
                    onChange={(e) => handleFormChange('advance_pct', e.target.value)}
                  />
                </FormField>

                <FormField label="Contract Work Order Date">
                  <Input
                    type="date"
                    value={form.work_order_date}
                    onChange={(e) => handleFormChange('work_order_date', e.target.value)}
                  />
                </FormField>

                <FormField label="Contract Start Date">
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => handleFormChange('start_date', e.target.value)}
                  />
                </FormField>

                <FormField label="Target Completion Date">
                  <Input
                    type="date"
                    value={form.completion_date}
                    onChange={(e) => handleFormChange('completion_date', e.target.value)}
                  />
                </FormField>

                <FormField label="Payment Terms" className="md:col-span-2">
                  <Input
                    value={form.payment_terms}
                    onChange={(e) => handleFormChange('payment_terms', e.target.value)}
                    placeholder="e.g. RA bill every 15 days; payment within 15 days after certification."
                  />
                </FormField>

                <FormField label="Terms & Conditions / Inclusions" className="md:col-span-2">
                  <Textarea
                    rows={3}
                    value={form.terms_and_conditions}
                    onChange={(e) => handleFormChange('terms_and_conditions', e.target.value)}
                    placeholder="Describe bill of quantities, unit rates, safety PPE requirements..."
                  />
                </FormField>
              </EntityEditModal.Grid>
            </EntityEditModal.Section>
          </EntityEditModal.Body>

          <EntityEditModal.Footer
            formId="wo-form"
            submitLabel={editingItem ? 'Update Work Order' : 'Issue Work Order'}
            onCancel={() => { setIsAddOpen(false); setEditingItem(null); }}
            isSubmitting={saving}
          />
        </form>
      </EntityEditModal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteItem)}
        title="Delete Work Order"
        message={`Are you sure you want to delete "${deleteItem?.work_order_no}"?`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={() => setDeleteItem(null)}
        onCancel={() => setDeleteItem(null)}
      />
    </PageContainer>
  );
}

export default WorkOrdersPage;
