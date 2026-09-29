import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Boxes, Plus, Edit, Trash2, Search, Filter, Layers,
  FileSpreadsheet, IndianRupee, Eye, Calculator, CheckCircle2,
  ListTree, MoreVertical, RotateCcw
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
import { boqApi, projectsApi, mastersApi } from '../../../api/apiservice';
import { useAuth } from '../../auth/context/AuthContext';
import { RateAnalysisModal } from '../components/RateAnalysisModal';

const extractArray = (res) => {
  if (Array.isArray(res)) return res;
  if (res?.data && Array.isArray(res.data)) return res.data;
  if (res?.data?.boq_items && Array.isArray(res.data.boq_items)) return res.data.boq_items;
  if (res?.data?.items && Array.isArray(res.data.items)) return res.data.items;
  if (res?.data?.boq_sections && Array.isArray(res.data.boq_sections)) return res.data.boq_sections;
  if (res?.data?.sections && Array.isArray(res.data.sections)) return res.data.sections;
  if (res?.data?.data && Array.isArray(res.data.data)) return res.data.data;
  if (res?.items && Array.isArray(res.items)) return res.items;
  if (res?.boq_items && Array.isArray(res.boq_items)) return res.boq_items;
  return [];
};

const formatCurrency = (val) => {
  const num = Number(val || 0);
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

const EMPTY_FORM = {
  project_id: '',
  boq_id: '',
  section_id: '',
  item_code: '',
  item_name: '',
  uom_id: '',
  work_category_id: '',
  quantity: '0',
  rate: '0',
  amount: '0',
  wastage_percentage: '0',
  progress_weightage: '0',
  is_provisional: false,
  specification: '',
};

export function BoqItemsPage() {
  const { user, hasPermission } = useAuth();
  const isAdmin = Boolean(user?.is_super_admin) || String(user?.role_name || user?.role || '').toLowerCase().includes('admin');
  const canCreate = isAdmin || hasPermission('boq.create');
  const canUpdate = isAdmin || hasPermission('boq.update');
  const canDelete = isAdmin || hasPermission('boq.delete');

  const [projects, setProjects] = useState([]);
  const [boqs, setBoqs] = useState([]);
  const [sections, setSections] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [workCategories, setWorkCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formSections, setFormSections] = useState([]);

  // Filters
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [selectedBoqId, setSelectedBoqId] = useState('all');
  const [selectedSectionId, setSelectedSectionId] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState(null);
  const perPage = 10;

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [rateModalItem, setRateModalItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initial Load: Projects, BOQs, Masters
  useEffect(() => {
    Promise.all([
      projectsApi.list().catch(() => ({ data: { projects: [] } })),
      boqApi.list().catch(() => ({ data: { project_boqs: [] } })),
      mastersApi.all().catch(() => ({ data: {} })),
    ]).then(([pRes, bRes, mRes]) => {
      const pList = pRes?.data?.projects ?? pRes?.projects ?? (Array.isArray(pRes?.data) ? pRes.data : []);
      const bList = bRes?.data?.project_boqs ?? bRes?.project_boqs ?? (Array.isArray(bRes?.data) ? bRes.data : []);

      const masters = mRes?.data || mRes || {};
      const uList = masters.units_of_measurement || masters.uoms || [];
      const wcList = masters.work_categories || [];

      setProjects(Array.isArray(pList) ? pList : []);
      setBoqs(Array.isArray(bList) ? bList : []);
      setUoms(Array.isArray(uList) ? uList : []);
      setWorkCategories(Array.isArray(wcList) ? wcList : []);
    });
  }, []);

  // Fetch sections when BOQ selected
  // Request tracking to prevent race conditions
  const fetchItemsIdRef = useRef(0);

  // Helper to fetch with automatic retry on transient failure
  const fetchWithRetry = async (fn, maxRetries = 2, delayMs = 250) => {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
        }
      }
    }
    throw lastError;
  };

  useEffect(() => {
    if (selectedBoqId !== 'all') {
      fetchWithRetry(() => boqApi.sections.list(Number(selectedBoqId)))
        .then(res => {
          const list = extractArray(res);
          setSections(list);
        })
        .catch(() => setSections([]));
    } else {
      const boqsToFetch = boqs.filter(b => selectedProjectId === 'all' || String(b.project_id) === String(selectedProjectId));
      if (boqsToFetch.length === 0) {
        setSections([]);
      } else {
        (async () => {
          let allSecs = [];
          const batchSize = 2;
          for (let i = 0; i < boqsToFetch.length; i += batchSize) {
            const chunk = boqsToFetch.slice(i, i + batchSize);
            const chunkResults = await Promise.all(
              chunk.map(b => fetchWithRetry(() => boqApi.sections.list(Number(b.id))).catch(() => null))
            );
            chunkResults.forEach(res => {
              if (res) {
                const list = extractArray(res);
                allSecs = [...allSecs, ...list];
              }
            });
          }
          setSections(allSecs);
        })();
      }
    }
  }, [selectedBoqId, selectedProjectId, boqs]);

  // Fetch BOQ Items reliably
  const fetchItems = useCallback(async () => {
    const currentFetchId = ++fetchItemsIdRef.current;
    setLoading(true);

    try {
      if (selectedBoqId !== 'all') {
        const params = {};
        if (selectedSectionId !== 'all') params.section_id = selectedSectionId;
        const res = await fetchWithRetry(() => boqApi.items.list(Number(selectedBoqId), params));
        if (currentFetchId !== fetchItemsIdRef.current) return;

        const list = extractArray(res);
        const b = boqs.find(boq => String(boq.id) === String(selectedBoqId));
        const enhancedList = list.map(itm => ({
          ...itm,
          boq_name: itm.boq_name || b?.boq_name,
          boq_code: itm.boq_code || b?.boq_code,
          project_id: itm.project_id || b?.project_id,
          boq_id: itm.boq_id || b?.id,
          boq_status: b?.status_code || b?.status_name || b?.status,
        }));
        setItems(enhancedList);
      } else {
        let currentBoqs = boqs;
        if (currentBoqs.length === 0) {
          try {
            const rawBoqs = await fetchWithRetry(() => boqApi.list());
            const bList = extractArray(rawBoqs?.data?.project_boqs || rawBoqs?.project_boqs || rawBoqs?.data || rawBoqs);
            if (Array.isArray(bList) && bList.length > 0) {
              currentBoqs = bList;
              setBoqs(bList);
            }
          } catch (err) {
            console.warn('Could not preload BOQ list for items:', err);
          }
        }

        const boqsToFetch = currentBoqs.filter(b => selectedProjectId === 'all' || String(b.project_id) === String(selectedProjectId));
        if (boqsToFetch.length === 0) {
          if (currentFetchId === fetchItemsIdRef.current) setItems([]);
        } else {
          let allItems = [];
          const batchSize = 2;

          for (let i = 0; i < boqsToFetch.length; i += batchSize) {
            if (currentFetchId !== fetchItemsIdRef.current) return;

            const chunk = boqsToFetch.slice(i, i + batchSize);
            const chunkResults = await Promise.all(
              chunk.map(async (b) => {
                try {
                  const res = await fetchWithRetry(() => boqApi.items.list(Number(b.id)));
                  const list = extractArray(res);
                  return list.map(itm => ({
                    ...itm,
                    boq_name: itm.boq_name || b.boq_name,
                    boq_code: itm.boq_code || b.boq_code,
                    project_id: itm.project_id || b.project_id,
                    boq_id: itm.boq_id || b.id,
                    boq_status: b.status_code || b.status_name || b.status,
                  }));
                } catch {
                  return [];
                }
              })
            );

            allItems = [...allItems, ...chunkResults.flat()];
          }

          if (selectedSectionId !== 'all') {
            allItems = allItems.filter(item => String(item.section_id) === String(selectedSectionId));
          }

          if (currentFetchId === fetchItemsIdRef.current) {
            setItems(allItems);
          }
        }
      }
    } catch {
      if (currentFetchId === fetchItemsIdRef.current) {
        setItems([]);
      }
    } finally {
      if (currentFetchId === fetchItemsIdRef.current) {
        setLoading(false);
      }
    }
  }, [selectedBoqId, selectedSectionId, selectedProjectId, boqs]);

  useEffect(() => {
    fetchItems();
  }, [selectedBoqId, selectedSectionId, selectedProjectId, boqs, fetchItems]);

  // Fetch sections specifically for the modal form when the BOQ changes
  useEffect(() => {
    if (form.boq_id) {
      boqApi.sections.list(Number(form.boq_id)).then(res => {
        const list = extractArray(res);
        setFormSections(list);
      }).catch(() => {
        setFormSections([]);
      });
    } else {
      setFormSections([]);
    }
  }, [form.boq_id]);

  // Helper to auto-generate item code based on previous items in target BOQ
  const getNextItemCode = (targetBoqId, allItems = []) => {
    const boqItems = targetBoqId
      ? allItems.filter(i => String(i.boq_id) === String(targetBoqId))
      : allItems;

    if (!boqItems.length) {
      return 'ITM-01';
    }

    let maxNum = 0;
    let detectedPrefix = 'ITM-';
    let padLength = 2;

    boqItems.forEach(item => {
      const code = String(item.item_code || '').trim();
      const match = code.match(/^(.*?)(\d+)$/);
      if (match) {
        const prefix = match[1];
        const numStr = match[2];
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
          detectedPrefix = prefix;
          padLength = Math.max(padLength, numStr.length);
        }
      }
    });

    if (maxNum === 0) {
      return `ITM-0${boqItems.length + 1}`;
    }

    const nextNum = String(maxNum + 1).padStart(padLength, '0');
    return `${detectedPrefix}${nextNum}`;
  };

  // Form Handlers
  const handleOpenAdd = () => {
    const defaultProj = selectedProjectId !== 'all' ? selectedProjectId : (projects[0]?.id ? String(projects[0].id) : '');
    const availableBoqs = boqs.filter(b => !defaultProj || String(b.project_id) === String(defaultProj));
    const defaultBoq = selectedBoqId !== 'all' ? selectedBoqId : (availableBoqs[0]?.id ? String(availableBoqs[0].id) : '');
    const availableSecs = sections.filter(s => !defaultBoq || String(s.boq_id) === String(defaultBoq));
    const defaultSec = selectedSectionId !== 'all' ? selectedSectionId : (availableSecs[0]?.id ? String(availableSecs[0].id) : '');
    const defaultUom = uoms[0]?.id ? String(uoms[0].id) : '';
    const defaultWc = workCategories[0]?.id ? String(workCategories[0].id) : '';

    setForm({
      ...EMPTY_FORM,
      project_id: defaultProj,
      boq_id: defaultBoq,
      section_id: defaultSec,
      uom_id: defaultUom,
      work_category_id: defaultWc,
      item_code: getNextItemCode(defaultBoq, items),
      quantity: '1',
      rate: '0',
      amount: '0',
    });
    setErrors({});
    setIsAddOpen(true);
  };

  const handleOpenEdit = (itm) => {
    setForm({
      project_id: String(itm.project_id || ''),
      boq_id: String(itm.boq_id || ''),
      section_id: String(itm.section_id || ''),
      item_code: itm.item_code || '',
      item_name: itm.item_name || '',
      uom_id: String(itm.uom_id || ''),
      work_category_id: String(itm.work_category_id || ''),
      quantity: String(itm.quantity || '0'),
      rate: String(itm.rate || '0'),
      amount: String(itm.amount || '0'),
      wastage_percentage: String(itm.wastage_percentage || '0'),
      progress_weightage: String(itm.progress_weightage || '0'),
      is_provisional: Boolean(itm.is_provisional),
      specification: itm.specification || '',
    });
    setErrors({});
    setEditingItem(itm);
  };

  const handleFormChange = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'quantity' || field === 'rate') {
        const q = Number(field === 'quantity' ? value : prev.quantity) || 0;
        const r = Number(field === 'rate' ? value : prev.rate) || 0;
        next.amount = String(Math.round(q * r * 100) / 100);
      }
      if (field === 'boq_id' && !editingItem) {
        next.item_code = getNextItemCode(value, items);
      }
      return next;
    });
    setErrors(prev => ({ ...prev, [field]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.item_name.trim()) errs.item_name = 'Item description is required.';
    if (!form.boq_id) errs.boq_id = 'Target BOQ is required.';
    if (!form.section_id) errs.section_id = 'Target Section is required.';
    if (!form.uom_id) errs.uom_id = 'Unit of measurement is required.';
    if (!form.work_category_id) errs.work_category_id = 'Work category is required.';
    if (isNaN(Number(form.quantity)) || Number(form.quantity) <= 0) errs.quantity = 'Quantity must be greater than 0.';
    if (isNaN(Number(form.rate)) || Number(form.rate) < 0) errs.rate = 'Rate must be 0 or greater.';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    try {
      const itmCode = (form.item_code && form.item_code.trim())
        ? form.item_code.trim().toUpperCase()
        : getNextItemCode(form.boq_id, items);

      const payload = {
        section_id: Number(form.section_id),
        uom_id: Number(form.uom_id),
        work_category_id: Number(form.work_category_id),
        item_code: itmCode,
        item_name: form.item_name.trim(),
        quantity: Number(form.quantity),
        rate: Number(form.rate),
        amount: Math.round(Number(form.quantity) * Number(form.rate) * 100) / 100,
        wastage_percentage: Number(form.wastage_percentage || 0),
        progress_weightage: Number(form.progress_weightage || 0),
        is_provisional: form.is_provisional ? 1 : 0,
        specification: form.specification?.trim() || null,
      };

      const targetBoqId = Number(form.boq_id);
      if (editingItem?.id) {
        await boqApi.items.update(targetBoqId, editingItem.id, payload);
        toast.success(`BOQ item ${payload.item_code} updated successfully.`);
      } else {
        await boqApi.items.create(targetBoqId, payload);
        toast.success(`BOQ item ${payload.item_code} created successfully.`);
      }

      fetchItems();
      setIsAddOpen(false);
      setEditingItem(null);
    } catch (error) {
      setErrors(error?.errors || {});
      toast.error(error?.message || 'Failed to save BOQ item. Ensure BOQ is in Draft.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteItem?.id) return;
    try {
      await boqApi.items.remove(deleteItem.boq_id, deleteItem.id);
      toast.success(`BOQ item ${deleteItem.item_code || ''} deleted.`);
      setDeleteItem(null);
      fetchItems();
    } catch (error) {
      toast.error(error?.message || 'Failed to delete BOQ item.');
    }
  };

  const handleResetFilters = () => {
    setSelectedProjectId('all');
    setSelectedBoqId('all');
    setSelectedSectionId('all');
    setSearch('');
    setPage(1);
  };

  // Filtered List
  const filtered = useMemo(() => {
    return items.filter(itm => {
      if (selectedProjectId !== 'all' && String(itm.project_id) !== String(selectedProjectId)) return false;
      if (selectedBoqId !== 'all' && String(itm.boq_id) !== String(selectedBoqId)) return false;
      if (selectedSectionId !== 'all' && String(itm.section_id) !== String(selectedSectionId)) return false;
      if (search) {
        const q = search.toLowerCase();
        const code = (itm.item_code || '').toLowerCase();
        const name = (itm.item_name || '').toLowerCase();
        const spec = (itm.specification || '').toLowerCase();
        const sec = (itm.section_name || '').toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !spec.includes(q) && !sec.includes(q)) return false;
      }
      return true;
    });
  }, [items, selectedProjectId, selectedBoqId, selectedSectionId, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  // Metrics
  const totalAmount = useMemo(() => items.reduce((acc, itm) => acc + Number(itm.amount || 0), 0), [items]);

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'BOQ & Project Budget', href: '/boq' },
    { label: 'BOQ Items' },
  ];

  const hasActiveFilters = selectedProjectId !== 'all' || selectedBoqId !== 'all' || selectedSectionId !== 'all' || Boolean(search);

  return (
    <PageContainer>
      <PageHeader
        title="BOQ Items Register"
        breadcrumbs={breadcrumbs}
        description="Detailed bill of items with unit rates, quantities, specifications, and rate component analysis."
      />

      <div className="flex flex-col gap-3 sm:gap-4 w-full">
        {/* KPI Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <KpiCard
            label="Total Items"
            value={items.length}
            status="primary"
            icon={<Boxes className="w-4 h-4" />}
          />
          <KpiCard
            label="Total BOQ Sections"
            value={sections.length}
            status="info"
            icon={<Layers className="w-4 h-4 text-sky-500" />}
          />
          <KpiCard
            label="Active Scope Value"
            value={formatCurrency(totalAmount)}
            status="success"
            icon={<IndianRupee className="w-4 h-4 text-emerald-500" />}
          />
          <KpiCard
            label="Provisional Items"
            value={items.filter(i => i.is_provisional).length}
            status="neutral"
            icon={<FileSpreadsheet className="w-4 h-4 text-amber-500" />}
          />
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-surface border border-border rounded-lg p-2.5 sm:p-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="w-full sm:w-44">
              <Select
                options={[
                  { value: 'all', label: 'All Projects' },
                  ...projects.map(p => ({ value: String(p.id), label: p.project_name || p.name, })),
                ]}
                value={selectedProjectId}
                onChange={(val) => {
                  setSelectedProjectId(val);
                  setSelectedBoqId('all');
                  setSelectedSectionId('all');
                }}
                className="text-xs h-8"
              />
            </div>

            <div className="w-full sm:w-48">
              <Select
                options={[
                  { value: 'all', label: 'All BOQs' },
                  ...boqs
                    .filter(b => selectedProjectId === 'all' || String(b.project_id) === String(selectedProjectId))
                    .map(b => ({ value: String(b.id), label: `${b.boq_code || 'BOQ'} - ${b.boq_name || b.name}` })),
                ]}
                value={selectedBoqId}
                onChange={(val) => {
                  setSelectedBoqId(val);
                  setSelectedSectionId('all');
                }}
                className="text-xs h-8"
              />
            </div>

            <div className="w-full sm:w-44">
              <Select
                options={[
                  { value: 'all', label: 'All Sections' },
                  ...sections
                    .filter(s => selectedBoqId === 'all' || String(s.boq_id) === String(selectedBoqId))
                    .map(s => ({ value: String(s.id), label: `${s.section_code} - ${s.section_name}` })),
                ]}
                value={selectedSectionId}
                onChange={setSelectedSectionId}
                className="text-xs h-8"
              />
            </div>

            <div className="w-full sm:w-56">
              <SearchField
                placeholder="Search item code, description, spec..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8 px-2 text-text-muted hover:text-text-primary"
                onClick={handleResetFilters}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Reset
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end">
            {canCreate && (
              <Button
                variant="primary"
                size="sm"
                className="text-xs h-8 shadow-xs"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={handleOpenAdd}
              >
                Add Item
              </Button>
            )}
          </div>
        </div>

        {/* Items Table - Hidden on Mobile (< sm) */}
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
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-[12px] table-auto">
              <thead className="bg-surface-muted text-text-secondary text-[11px] uppercase font-semibold border-b border-border tracking-wider">
                <tr>
                  <th className="px-3 py-2.5 w-12 text-center">#</th>
                  <th className="px-3 py-2.5 w-28">Item Code</th>
                  <th className="px-3 py-2.5 min-w-[200px]">Item Description & Specification</th>
                  <th className="px-3 py-2.5 min-w-[140px]">Section</th>
                  <th className="px-3 py-2.5 text-right w-24">Quantity</th>
                  <th className="px-3 py-2.5 text-center w-16">UOM</th>
                  <th className="px-3 py-2.5 text-right w-28">Rate (₹)</th>
                  <th className="px-3 py-2.5 text-right w-32">Amount (₹)</th>
                  <th className="px-3 py-2.5 text-center w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="text-center py-12 text-text-muted text-[13px]">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span>Loading BOQ items...</span>
                      </div>
                    </td>
                  </tr>
                ) : paged.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-12 text-text-muted text-[13px]">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Boxes className="w-8 h-8 text-text-muted/60" />
                        <span className="font-medium text-text-secondary">No BOQ Items Found</span>
                        <span className="text-xs text-text-muted">No items match the current project, BOQ, or section selection.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paged.map((itm, idx) => {
                    const isMenuOpen = openMenuId === itm.id;
                    const boqStatus = String(itm.boq_status || '').toUpperCase();
                    const isBoqDraft = !boqStatus || boqStatus.includes('DRAFT');

                    return (
                      <tr key={itm.id || idx} className="hover:bg-surface-muted/30 transition-colors">
                        <td className="px-3 py-2.5 text-center font-medium text-text-primary text-[11px]">
                          {(page - 1) * perPage + idx + 1}
                        </td>
                        <td className="px-3 py-2.5 font-mono font-semibold text-text-primary text-[11px] whitespace-nowrap">
                          <span className="bg-surface-muted px-1.5 py-0.5 rounded border border-border">
                            {itm.item_code}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-semibold text-text-primary text-[12px] truncate block max-w-[280px]" title={itm.item_name}>
                            {itm.item_name}
                          </span>
                          {itm.specification && (
                            <span className="text-[10px] text-text-muted truncate block max-w-[280px]" title={itm.specification}>
                              {itm.specification}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-text-primary text-[11px] font-medium truncate block max-w-[160px]" title={itm.section_name}>
                            {itm.section_name || 'Civil'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-text-primary text-[11px] whitespace-nowrap">
                          {Number(itm.quantity || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <Badge variant="neutral" className="text-[9px] font-mono px-1.5 py-0.5">
                            {itm.unit_symbol || itm.unit_code || itm.uom_name || 'Unit'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-text-secondary text-[11px] whitespace-nowrap">
                          {formatCurrency(itm.rate)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-text-primary text-[12px] whitespace-nowrap">
                          {formatCurrency(itm.amount || (itm.quantity * itm.rate))}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1 relative">
                            {/* Primary Action: View */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 hover:bg-surface-muted hover:text-primary transition-colors"
                              title="View Item Details"
                              onClick={() => setViewingItem(itm)}
                            >
                              <Eye className="w-3.5 h-3.5 text-text-secondary hover:text-primary" />
                            </Button>

                            {/* Action Pattern: [⋮] Three-dot menu */}
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-7 w-7 p-0 transition-colors ${
                                  isMenuOpen ? 'bg-surface-muted text-primary' : 'hover:bg-surface-muted text-text-secondary'
                                }`}
                                title="More Options"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(isMenuOpen ? null : itm.id);
                                }}
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </Button>

                              {isMenuOpen && (
                                <div
                                  ref={menuRef}
                                  className="absolute right-0 top-8 z-50 w-40 bg-surface border border-border rounded-sm shadow-xl p-1 text-[11px] animate-in fade-in zoom-in-95 duration-100"
                                >
                                  {/* Rate Analysis */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setRateModalItem(itm);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-xs hover:bg-surface-muted flex items-center gap-2 text-primary font-medium transition-colors"
                                  >
                                    <Calculator className="w-3.5 h-3.5 text-primary" />
                                    <span>Rate Analysis</span>
                                  </button>

                                  {/* Edit */}
                                  {canUpdate && isBoqDraft && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        handleOpenEdit(itm);
                                      }}
                                      className="w-full text-left px-2.5 py-1.5 rounded-xs hover:bg-surface-muted flex items-center gap-2 text-text-primary transition-colors"
                                    >
                                      <Edit className="w-3.5 h-3.5 text-text-secondary" />
                                      <span>Edit</span>
                                    </button>
                                  )}

                                  {/* Delete */}
                                  {canDelete && isBoqDraft && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        setDeleteItem(itm);
                                      }}
                                      className="w-full text-left px-2.5 py-1.5 rounded-xs hover:bg-error/10 text-error flex items-center gap-2 font-medium transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-error" />
                                      <span>Delete</span>
                                    </button>
                                  )}

                                  {!isBoqDraft && (
                                    <div className="px-2.5 py-1 text-text-muted text-[10px] italic border-t border-border/60 mt-1 pt-1">
                                      Locked ({itm.boq_status || 'Approved'})
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </DataTableContainer>
      </div>

      {/* Mobile View - Cards List for Phones (< sm) */}
      <div className="block sm:hidden space-y-3">
        {loading ? (
          <div className="bg-surface border border-border rounded-lg p-8 text-center text-text-muted text-[13px]">
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Loading BOQ Items...</span>
            </div>
          </div>
        ) : paged.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg p-8 text-center text-text-muted text-[13px]">
            <Boxes className="w-8 h-8 text-text-muted/60 mx-auto mb-2" />
            <p className="font-medium text-text-secondary">No Items Found</p>
            <p className="text-xs text-text-muted mt-1">No items match the current filter criteria.</p>
          </div>
        ) : (
          paged.map((itm, idx) => {
            const boqStatus = String(itm.boq_status || '').toUpperCase();
            const isBoqDraft = !boqStatus || boqStatus.includes('DRAFT');
            const total = Math.round(Number(itm.quantity || 0) * Number(itm.rate || 0) * 100) / 100;

            return (
              <div key={itm.id || idx} className="bg-surface border border-border rounded-lg p-3.5 shadow-xs space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <span className="font-mono text-[10px] font-bold text-primary">
                        {itm.item_code}
                      </span>
                      {itm.is_provisional && (
                        <Badge variant="warning" className="text-[7px] font-bold uppercase tracking-wider h-3.5 px-1 inline-flex items-center leading-none">
                          Provisional
                        </Badge>
                      )}
                    </div>
                    <h4 className="font-semibold text-text-primary text-[13px] leading-snug truncate" title={itm.item_name}>
                      {itm.item_name}
                    </h4>
                    {itm.specification && (
                      <span className="text-[11px] text-text-muted truncate block" title={itm.specification}>
                        {itm.specification}
                      </span>
                    )}
                  </div>
                  <Badge variant="neutral" className="text-[8px] font-bold uppercase tracking-wider h-4 px-1.5 inline-flex items-center leading-none shrink-0">
                    {itm.work_category_name || itm.category_name || 'General'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/60">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-text-muted block">Section</span>
                    <span className="text-text-primary text-[11px] truncate block" title={itm.section_name}>
                      {itm.section_code ? `${itm.section_code} - ${itm.section_name}` : (itm.section_name || '—')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-text-muted block">Total Amount</span>
                    <span className="font-mono font-bold text-primary text-[12px]">
                      {formatCurrency(itm.amount || total)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/40">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-text-muted block">Quantity</span>
                    <span className="font-mono font-semibold text-text-primary text-[11px]">
                      {Number(itm.quantity || 0).toLocaleString('en-IN')} {itm.uom_symbol || itm.uom_code || ''}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-text-muted block">Unit Rate</span>
                    <span className="font-mono text-text-primary text-[11px]">
                      ₹{Number(itm.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                  <span className="text-[10px] text-text-muted font-mono truncate max-w-[100px]">
                    {itm.boq_name || itm.boq_code || `#${(page - 1) * perPage + idx + 1}`}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-primary hover:bg-primary/10"
                      title="Rate Analysis"
                      onClick={() => setRateModalItem(itm)}
                    >
                      <Calculator className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] px-2"
                      onClick={() => setViewingItem(itm)}
                    >
                      <Eye className="w-3 h-3 mr-1" /> View
                    </Button>
                    {canUpdate && isBoqDraft && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title="Edit Item"
                        onClick={() => handleOpenEdit(itm)}
                      >
                        <Edit className="w-3.5 h-3.5 text-text-secondary hover:text-primary" />
                      </Button>
                    )}
                    {canDelete && isBoqDraft && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-error"
                        title="Delete Item"
                        onClick={() => setDeleteItem(itm)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
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

      {/* Add / Edit Item Modal */}
      <EntityEditModal
        isOpen={isAddOpen || Boolean(editingItem)}
        onClose={() => {
          setIsAddOpen(false);
          setEditingItem(null);
        }}
        size="lg"
      >
        <EntityEditModal.Header
          icon={Boxes}
          title={editingItem ? `Edit BOQ Item — ${editingItem.item_code}` : 'Create BOQ Item'}
          subtitle="Add bill item with quantity, unit rate, and work classification."
          onClose={() => {
            setIsAddOpen(false);
            setEditingItem(null);
          }}
        />
        <form id="item-form" onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <EntityEditModal.Body>
            <EntityEditModal.Section title="BOQ & Section Assignment">
              <EntityEditModal.Grid>
                {!editingItem && (
                  <>
                    <FormField label="Parent Project" required>
                      <Select
                        options={projects.map(p => ({ value: String(p.id), label: p.project_name || p.name, }))}
                        value={form.project_id}
                        onChange={(v) => {
                          handleFormChange('project_id', v);
                          handleFormChange('boq_id', '');
                          handleFormChange('section_id', '');
                        }}
                      />
                    </FormField>

                    <FormField label="Target BOQ" required error={errors.boq_id}>
                      <Select
                        options={boqs.filter(b => !form.project_id || String(b.project_id) === String(form.project_id)).map(b => ({
                          value: String(b.id),
                          label: `${b.boq_code || 'BOQ'} - ${b.boq_name || b.name}`,
                        }))}
                        value={form.boq_id}
                        onChange={(v) => {
                          handleFormChange('boq_id', v);
                          handleFormChange('section_id', '');
                        }}
                        placeholder="Select BOQ..."
                      />
                    </FormField>
                  </>
                )}

                <FormField label="BOQ Section" required error={errors.section_id} className="sm:col-span-2">
                  <Select
                    options={formSections.map(s => ({ value: String(s.id), label: `${s.section_code} — ${s.section_name}` }))}
                    value={form.section_id}
                    onChange={(v) => handleFormChange('section_id', v)}
                    placeholder={formSections.length === 0 ? "Select BOQ first..." : "Select target section..."}
                  />
                </FormField>
              </EntityEditModal.Grid>
            </EntityEditModal.Section>

            <EntityEditModal.Section title="Item Specifications">
              <EntityEditModal.Grid>
                <FormField label="Item Description / Title" required error={errors.item_name} className="sm:col-span-2">
                  <Input
                    value={form.item_name}
                    onChange={(e) => handleFormChange('item_name', e.target.value)}
                    placeholder="e.g. Earthwork excavation in ordinary soil"
                  />
                </FormField>

                <FormField label="Work Category" required error={errors.work_category_id}>
                  <Select
                    options={workCategories.map(wc => ({ value: String(wc.id), label: `${wc.code || wc.category_code} - ${wc.name || wc.category_name}` }))}
                    value={form.work_category_id}
                    onChange={(v) => handleFormChange('work_category_id', v)}
                    placeholder="Select Work Category"
                  />
                </FormField>

                <FormField label="Unit of Measurement (UOM)" required error={errors.uom_id}>
                  <Select
                    options={uoms.map(u => ({ value: String(u.id), label: `${u.symbol || u.unit_symbol || u.code || u.unit_code} (${u.name || u.unit_name})` }))}
                    value={form.uom_id}
                    onChange={(v) => handleFormChange('uom_id', v)}
                    placeholder="Select UOM"
                  />
                </FormField>

                <FormField label="Quantity" required error={errors.quantity}>
                  <Input
                    type="number"
                    step="0.001"
                    value={form.quantity}
                    onChange={(e) => handleFormChange('quantity', e.target.value)}
                    placeholder="0"
                  />
                </FormField>

                <FormField label="Unit Rate (₹)" required error={errors.rate}>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.rate}
                    onChange={(e) => handleFormChange('rate', e.target.value)}
                    placeholder="0.00"
                  />
                </FormField>

                <FormField label="Total Amount (₹)">
                  <Input
                    value={formatCurrency(form.amount)}
                    disabled
                    className="bg-surface-muted font-mono font-bold"
                  />
                </FormField>

                <FormField label="Wastage Percentage (%)" error={errors.wastage_percentage}>
                  <Input
                    type="number"
                    step="0.1"
                    value={form.wastage_percentage}
                    onChange={(e) => handleFormChange('wastage_percentage', e.target.value)}
                    placeholder="0"
                  />
                </FormField>
              </EntityEditModal.Grid>
            </EntityEditModal.Section>

            <EntityEditModal.Section title="Technical Specifications" noBorder>
              <FormField label="Technical Specification / Clause Notes">
                <Textarea
                  value={form.specification}
                  onChange={(e) => handleFormChange('specification', e.target.value)}
                  placeholder="Detailed material grades, execution method, drawing references, and testing standards..."
                  rows={3}
                />
              </FormField>
            </EntityEditModal.Section>
          </EntityEditModal.Body>

          <EntityEditModal.Footer
            formId="item-form"
            submitLabel={editingItem ? 'Update Item' : 'Create Item'}
            onCancel={() => {
              setIsAddOpen(false);
              setEditingItem(null);
            }}
            isSubmitting={saving}
          />
        </form>
      </EntityEditModal>

      {/* View Item Details Modal */}
      {viewingItem && (
        <EntityEditModal isOpen={Boolean(viewingItem)} onClose={() => setViewingItem(null)} size="md">
          <EntityEditModal.Header
            icon={Boxes}
            title={`Item: ${viewingItem.item_code}`}
            subtitle={viewingItem.item_name}
            onClose={() => setViewingItem(null)}
          />
          <EntityEditModal.Body>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-surface-muted/30 rounded-lg border border-border">
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Section</span>
                  <span className="font-semibold text-text-primary text-xs">{viewingItem.section_name || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Total Item Value</span>
                  <span className="font-mono font-bold text-text-primary text-xs">{formatCurrency(viewingItem.amount)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Quantity & UOM</span>
                  <span className="font-medium text-text-primary text-xs">{viewingItem.quantity} {viewingItem.unit_symbol || viewingItem.uom_name || ''}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Unit Rate</span>
                  <span className="font-mono font-medium text-text-primary text-xs">{formatCurrency(viewingItem.rate)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Wastage %</span>
                  <span className="font-medium text-text-primary text-xs">{viewingItem.wastage_percentage ?? 0}%</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Provisional</span>
                  <span className="font-medium text-text-primary text-xs">{viewingItem.is_provisional ? 'Yes' : 'No'}</span>
                </div>
              </div>

              {viewingItem.specification && (
                <div>
                  <h4 className="text-[11px] font-bold text-text-secondary uppercase mb-1">Specification</h4>
                  <p className="text-xs text-text-primary bg-surface p-3 rounded border border-border whitespace-pre-wrap">
                    {viewingItem.specification}
                  </p>
                </div>
              )}
            </div>
          </EntityEditModal.Body>
          <div className="p-4 border-t border-border bg-surface flex justify-between items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const itm = viewingItem;
                setViewingItem(null);
                setRateModalItem(itm);
              }}
              leftIcon={<Calculator className="w-3.5 h-3.5 text-primary" />}
            >
              Analyze Rates
            </Button>
            <Button variant="outline" size="sm" onClick={() => setViewingItem(null)}>
              Close
            </Button>
          </div>
        </EntityEditModal>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteItem)}
        title="Delete BOQ Item"
        message={`Are you sure you want to delete item "${deleteItem?.item_code} — ${deleteItem?.item_name}"?`}
        variant="danger"
        confirmLabel="Delete Item"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteItem(null)}
      />

      {/* Rate Analysis Modal */}
      {rateModalItem && (
        <RateAnalysisModal
          isOpen={Boolean(rateModalItem)}
          item={rateModalItem}
          onClose={() => setRateModalItem(null)}
        />
      )}
    </PageContainer>
  );
}

export default BoqItemsPage;
