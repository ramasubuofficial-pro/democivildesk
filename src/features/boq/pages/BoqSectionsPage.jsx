import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Layers, FolderTree, Plus, Edit, Trash2, Search, Filter,
  FileSpreadsheet, IndianRupee, Eye, ChevronRight, CheckCircle2,
  Boxes, ListTree, MoreVertical, RotateCcw
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
import { boqApi, projectsApi } from '../../../api/apiservice';
import { useAuth } from '../../auth/context/AuthContext';

const extractArray = (res) => {
  if (Array.isArray(res)) return res;
  if (res?.data?.boq_sections && Array.isArray(res.data.boq_sections)) return res.data.boq_sections;
  if (res?.data?.boq_items && Array.isArray(res.data.boq_items)) return res.data.boq_items;
  if (res?.data?.sections && Array.isArray(res.data.sections)) return res.data.sections;
  if (res?.data?.items && Array.isArray(res.data.items)) return res.data.items;
  if (res?.data && Array.isArray(res.data)) return res.data;
  if (res?.data?.data && Array.isArray(res.data.data)) return res.data.data;
  if (res?.boq_sections && Array.isArray(res.boq_sections)) return res.boq_sections;
  if (res?.boq_items && Array.isArray(res.boq_items)) return res.boq_items;
  if (res?.sections && Array.isArray(res.sections)) return res.sections;
  if (res?.items && Array.isArray(res.items)) return res.items;
  return [];
};

const formatCurrency = (val) => {
  const num = Number(val || 0);
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

const EMPTY_FORM = {
  project_id: '',
  boq_id: '',
  parent_section_id: '',
  section_code: '',
  section_name: '',
  display_order: '0',
  description: '',
};

export function BoqSectionsPage() {
  const { user, hasPermission } = useAuth();
  const isAdmin = Boolean(user?.is_super_admin) || String(user?.role_name || user?.role || '').toLowerCase().includes('admin');
  const canCreate = isAdmin || hasPermission('boq.create');
  const canUpdate = isAdmin || hasPermission('boq.update');
  const canDelete = isAdmin || hasPermission('boq.delete');

  const [projects, setProjects] = useState([]);
  const [boqs, setBoqs] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [selectedBoqId, setSelectedBoqId] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState(null);
  const perPage = 10;

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [viewingSection, setViewingSection] = useState(null);
  const [deleteSection, setDeleteSection] = useState(null);
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

  // Request tracking to prevent race conditions
  const fetchIdRef = useRef(0);

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

  // Load Projects & BOQs
  useEffect(() => {
    Promise.all([
      projectsApi.list().catch(() => ({ data: { projects: [] } })),
      boqApi.list().catch(() => ({ data: { project_boqs: [] } })),
    ]).then(([pRes, bRes]) => {
      const pList = pRes?.data?.projects ?? pRes?.projects ?? (Array.isArray(pRes?.data) ? pRes.data : []);
      const bList = bRes?.data?.project_boqs ?? bRes?.project_boqs ?? (Array.isArray(bRes?.data) ? bRes.data : []);
      setProjects(Array.isArray(pList) ? pList : []);
      setBoqs(Array.isArray(bList) ? bList : []);
    });
  }, []);

  // Fetch sections reliably with accurate items count, concurrency control, and retry
  const fetchSections = useCallback(async () => {
    const currentFetchId = ++fetchIdRef.current;
    setLoading(true);

    try {
      if (selectedBoqId !== 'all') {
        const [res, itemsRes] = await Promise.all([
          fetchWithRetry(() => boqApi.sections.list(Number(selectedBoqId))),
          fetchWithRetry(() => boqApi.items.list(Number(selectedBoqId))).catch(() => null),
        ]);

        if (currentFetchId !== fetchIdRef.current) return;

        const list = extractArray(res);
        const boqItems = extractArray(itemsRes);
        const b = boqs.find(boq => String(boq.id) === String(selectedBoqId));
        const enhancedList = list.map(s => {
          const matchingItems = boqItems.filter(item => (
            (item.section_id !== null && item.section_id !== undefined && s.id !== null && s.id !== undefined) &&
            (Number(item.section_id) === Number(s.id) || String(item.section_id) === String(s.id))
          ));
          return {
            ...s,
            item_count: matchingItems.length,
            boq_name: s.boq_name || b?.boq_name,
            boq_code: s.boq_code || b?.boq_code,
            project_id: s.project_id || b?.project_id,
            boq_id: s.boq_id || b?.id,
            boq_status: b?.status_code || b?.status_name || b?.status,
          };
        });
        setSections(enhancedList);
      } else {
        // If boqs is still empty on initial load, fetch the list directly
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
            console.warn('Could not preload BOQ list for sections:', err);
          }
        }

        const boqsToFetch = currentBoqs.filter(b => selectedProjectId === 'all' || String(b.project_id) === String(selectedProjectId));
        if (boqsToFetch.length === 0) {
          if (currentFetchId === fetchIdRef.current) setSections([]);
        } else {
          // Process BOQs in controlled batches of 2 to avoid server process throttling & session locks
          const allSections = [];
          const batchSize = 2;

          for (let i = 0; i < boqsToFetch.length; i += batchSize) {
            if (currentFetchId !== fetchIdRef.current) return;

            const chunk = boqsToFetch.slice(i, i + batchSize);
            const chunkResults = await Promise.all(
              chunk.map(async (b) => {
                try {
                  const [res, itemsRes] = await Promise.all([
                    fetchWithRetry(() => boqApi.sections.list(Number(b.id))),
                    fetchWithRetry(() => boqApi.items.list(Number(b.id)), 1, 150).catch(() => null),
                  ]);
                  const list = extractArray(res);
                  const boqItems = extractArray(itemsRes);
                  return list.map(s => {
                    const matchingItems = boqItems.filter(item => (
                      (item.section_id !== null && item.section_id !== undefined && s.id !== null && s.id !== undefined) &&
                      (Number(item.section_id) === Number(s.id) || String(item.section_id) === String(s.id))
                    ));
                    return {
                      ...s,
                      item_count: matchingItems.length,
                      boq_name: s.boq_name || b.boq_name,
                      boq_code: s.boq_code || b.boq_code,
                      project_id: s.project_id || b.project_id,
                      boq_id: s.boq_id || b.id,
                      boq_status: b.status_code || b.status_name || b.status,
                    };
                  });
                } catch (err) {
                  console.error(`Failed to fetch sections for BOQ ${b.id}:`, err);
                  return [];
                }
              })
            );

            allSections.push(...chunkResults.flat());
          }

          if (currentFetchId === fetchIdRef.current) {
            setSections(allSections);
          }
        }
      }
    } catch (err) {
      console.error('fetchSections error:', err);
      if (currentFetchId === fetchIdRef.current) {
        setSections([]);
      }
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [selectedBoqId, selectedProjectId, boqs]);

  useEffect(() => {
    fetchSections();
  }, [selectedBoqId, selectedProjectId, boqs, fetchSections]);

  // Helper to auto-generate next section code based on previous code
  const getNextSectionCode = (targetBoqId, sectionList) => {
    const matching = (sectionList || []).filter(s => !targetBoqId || String(s.boq_id) === String(targetBoqId));
    const pool = matching.length > 0 ? matching : (sectionList || []);
    let maxNum = 0;
    let prefix = 'SEC-';
    let padLen = 2;
    pool.forEach(s => {
      const code = String(s.section_code || '').trim();
      const m = code.match(/^(.*?)(\d+)$/);
      if (m) {
        const num = parseInt(m[2], 10);
        if (num > maxNum) {
          maxNum = num;
          prefix = m[1];
          padLen = m[2].length;
        }
      }
    });
    if (maxNum > 0) {
      const nextNum = maxNum + 1;
      return `${prefix}${String(nextNum).padStart(Math.max(padLen, String(nextNum).length), '0')}`;
    }
    return 'SEC-01';
  };

  // Form Handlers
  const handleOpenAdd = () => {
    const defaultProj = selectedProjectId !== 'all' ? selectedProjectId : (projects[0]?.id ? String(projects[0].id) : '');
    const availableBoqs = boqs.filter(b => !defaultProj || String(b.project_id) === String(defaultProj));
    const defaultBoq = selectedBoqId !== 'all' ? selectedBoqId : (availableBoqs[0]?.id ? String(availableBoqs[0].id) : '');

    setForm({
      ...EMPTY_FORM,
      project_id: defaultProj,
      boq_id: defaultBoq,
      section_code: getNextSectionCode(defaultBoq, sections),
    });
    setErrors({});
    setIsAddOpen(true);
  };

  const handleOpenEdit = (sec) => {
    setForm({
      project_id: String(sec.project_id || ''),
      boq_id: String(sec.boq_id || ''),
      parent_section_id: String(sec.parent_section_id || ''),
      section_code: sec.section_code || '',
      section_name: sec.section_name || '',
      display_order: String(sec.display_order || '0'),
      description: sec.description || '',
    });
    setErrors({});
    setEditingSection(sec);
  };

  const handleFormChange = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'boq_id' && !editingSection) {
        next.section_code = getNextSectionCode(value, sections);
      }
      return next;
    });
    setErrors(prev => ({ ...prev, [field]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.section_name.trim()) errs.section_name = 'Section name is required.';
    if (!form.boq_id) errs.boq_id = 'Target BOQ is required.';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    try {
      const secCode = (form.section_code && form.section_code.trim())
        ? form.section_code.trim().toUpperCase()
        : getNextSectionCode(form.boq_id, sections);

      const payload = {
        section_code: secCode,
        section_name: form.section_name.trim(),
        parent_section_id: form.parent_section_id ? Number(form.parent_section_id) : null,
        display_order: Number(form.display_order || 0),
        description: form.description?.trim() || null,
      };

      const targetBoqId = Number(form.boq_id);
      if (editingSection?.id) {
        await boqApi.sections.update(targetBoqId, editingSection.id, payload);
        toast.success(`Section ${payload.section_code} updated successfully.`);
      } else {
        await boqApi.sections.create(targetBoqId, payload);
        toast.success(`Section ${payload.section_code} created successfully.`);
      }
      fetchSections();
      setIsAddOpen(false);
      setEditingSection(null);
    } catch (error) {
      setErrors(error?.errors || {});
      toast.error(error?.message || 'Failed to save BOQ section.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteSection?.id) return;
    try {
      await boqApi.sections.remove(deleteSection.boq_id, deleteSection.id);
      setSections(prev => prev.filter(s => s.id !== deleteSection.id));
      toast.success(`Section ${deleteSection.section_code || ''} deleted.`);
      setDeleteSection(null);
    } catch (error) {
      toast.error(error?.message || 'Failed to delete BOQ section.');
    }
  };

  const handleResetFilters = () => {
    setSelectedProjectId('all');
    setSelectedBoqId('all');
    setSearch('');
    setPage(1);
  };

  // Filtered List
  const filtered = useMemo(() => {
    return sections.filter(sec => {
      if (selectedProjectId !== 'all' && String(sec.project_id) !== String(selectedProjectId)) return false;
      if (selectedBoqId !== 'all' && String(sec.boq_id) !== String(selectedBoqId)) return false;
      if (search) {
        const q = search.toLowerCase();
        const code = (sec.section_code || '').toLowerCase();
        const name = (sec.section_name || '').toLowerCase();
        const boqN = (sec.boq_name || '').toLowerCase();
        const desc = (sec.description || '').toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !boqN.includes(q) && !desc.includes(q)) return false;
      }
      return true;
    });
  }, [sections, selectedProjectId, selectedBoqId, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  // Metrics
  const totalAmount = useMemo(() => sections.reduce((acc, s) => acc + Number(s.section_amount || 0), 0), [sections]);
  const totalItemsCount = useMemo(() => sections.reduce((acc, s) => acc + Number(s.item_count || 0), 0), [sections]);

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'BOQ & Project Budget', href: '/boq' },
    { label: 'BOQ Sections' },
  ];

  const hasActiveFilters = selectedProjectId !== 'all' || selectedBoqId !== 'all' || Boolean(search);

  return (
    <PageContainer>
      <PageHeader
        title="BOQ Sections"
        breadcrumbs={breadcrumbs}
        description="Hierarchical Work Breakdown Structure (WBS) and section divisions of project BOQs."
      />

      <div className="flex flex-col gap-3 sm:gap-4 w-full">
        {/* KPI Summary Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <KpiCard
            label="Total Sections"
            value={sections.length}
            status="primary"
            icon={<ListTree className="w-4 h-4" />}
          />
          <KpiCard
            label="Total Line Items"
            value={totalItemsCount}
            status="info"
            icon={<Boxes className="w-4 h-4 text-sky-500" />}
          />
          <KpiCard
            label="Sections Hierarchy"
            value="Nested / Flat"
            status="success"
            icon={<FolderTree className="w-4 h-4 text-emerald-500" />}
          />
          <KpiCard
            label="Total Section Value"
            value={formatCurrency(totalAmount)}
            status="neutral"
            icon={<IndianRupee className="w-4 h-4 text-amber-500" />}
          />
        </div>

        {/* Filter and Project/BOQ Selector Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-surface border border-border rounded-lg p-2.5 sm:p-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="w-full sm:w-48">
              <Select
                options={[
                  { value: 'all', label: 'All Projects' },
                  ...projects.map(p => ({ value: String(p.id), label: p.project_name || p.name, })),
                ]}
                value={selectedProjectId}
                onChange={(val) => {
                  setSelectedProjectId(val);
                  setSelectedBoqId('all');
                }}
                className="text-xs h-8"
              />
            </div>

            <div className="w-full sm:w-56">
              <Select
                options={[
                  { value: 'all', label: 'All BOQs (Consolidated)' },
                  ...boqs
                    .filter(b => selectedProjectId === 'all' || String(b.project_id) === String(selectedProjectId))
                    .map(b => ({ value: String(b.id), label: `${b.boq_code || 'BOQ'} - ${b.boq_name || b.name}` })),
                ]}
                value={selectedBoqId}
                onChange={setSelectedBoqId}
                className="text-xs h-8"
              />
            </div>

            <div className="w-full sm:w-56">
              <SearchField
                placeholder="Search section code, title, description..."
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
                Add Section
              </Button>
            )}
          </div>
        </div>

        {/* Section Table - Hidden on Mobile (< sm) */}
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
                  <th className="px-3 py-2.5 w-32">Section Code</th>
                  <th className="px-3 py-2.5 min-w-[200px]">Section Title</th>
                  <th className="px-3 py-2.5 min-w-[180px]">Parent BOQ</th>
                  <th className="px-3 py-2.5 text-center w-24">Items Count</th>
                  <th className="px-3 py-2.5 text-right w-36">Total Amount</th>
                  <th className="px-3 py-2.5 text-center w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-12 text-text-muted text-[13px]">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span>Loading BOQ Sections...</span>
                      </div>
                    </td>
                  </tr>
                ) : paged.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-12 text-text-muted text-[13px]">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ListTree className="w-8 h-8 text-text-muted/60" />
                        <span className="font-medium text-text-secondary">No Sections Found</span>
                        <span className="text-xs text-text-muted">No sections match the current project or BOQ filter.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paged.map((sec, idx) => {
                    const isMenuOpen = openMenuId === sec.id;
                    const boqStatus = String(sec.boq_status || '').toUpperCase();
                    const isBoqDraft = !boqStatus || boqStatus.includes('DRAFT');

                    return (
                      <tr key={sec.id || idx} className="hover:bg-surface-muted/30 transition-colors">
                        <td className="px-3 py-2.5 text-center font-medium text-text-primary text-[11px]">
                          {(page - 1) * perPage + idx + 1}
                        </td>
                        <td className="px-3 py-2.5 font-mono font-semibold text-text-primary text-[11px] whitespace-nowrap">
                          <span className="bg-surface-muted px-1.5 py-0.5 rounded border border-border">
                            {sec.section_code}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-semibold text-text-primary text-[12px] truncate block max-w-[280px]" title={sec.section_name}>
                            {sec.section_name}
                          </span>
                          {sec.description && (
                            <span className="text-[10px] text-text-muted truncate block max-w-[280px]" title={sec.description}>
                              {sec.description}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-text-primary text-[11px] font-medium truncate block max-w-[220px]" title={sec.boq_name}>
                            {sec.boq_name || '—'}
                          </span>
                          <span className="text-[10px] text-text-muted font-mono truncate block">
                            {sec.boq_code || ''}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <Badge variant="info" className="text-[10px] font-mono font-bold px-2">
                            {sec.item_count || 0} {sec.item_count === 1 ? 'item' : 'items'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-text-primary text-[12px] whitespace-nowrap">
                          {formatCurrency(sec.section_amount || sec.total_amount)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1 relative">
                            {/* Primary Action: View */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 hover:bg-surface-muted hover:text-primary transition-colors"
                              title="View Section Details"
                              onClick={() => setViewingSection(sec)}
                            >
                              <Eye className="w-3.5 h-3.5 text-text-secondary hover:text-primary" />
                            </Button>

                            {/* [⋮] Action Menu */}
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
                                  setOpenMenuId(isMenuOpen ? null : sec.id);
                                }}
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </Button>

                              {isMenuOpen && (
                                <div
                                  ref={menuRef}
                                  className="absolute right-0 top-8 z-50 w-44 bg-surface border border-border rounded-sm shadow-xl p-1 text-[11px] animate-in fade-in zoom-in-95 duration-100"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setViewingSection(sec);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-xs hover:bg-surface-muted flex items-center gap-2 text-text-primary transition-colors"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-text-secondary" />
                                    <span>View Details</span>
                                  </button>

                                  {canUpdate && isBoqDraft && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        handleOpenEdit(sec);
                                      }}
                                      className="w-full text-left px-2.5 py-1.5 rounded-xs hover:bg-surface-muted flex items-center gap-2 text-text-primary transition-colors"
                                    >
                                      <Edit className="w-3.5 h-3.5 text-text-secondary" />
                                      <span>Edit</span>
                                    </button>
                                  )}

                                  {canDelete && isBoqDraft && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        setDeleteSection(sec);
                                      }}
                                      className="w-full text-left px-2.5 py-1.5 rounded-xs hover:bg-error/10 text-error flex items-center gap-2 font-medium transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-error" />
                                      <span>Delete</span>
                                    </button>
                                  )}

                                  {!isBoqDraft && (
                                    <div className="px-2.5 py-1 text-text-muted text-[10px] italic border-t border-border/60 mt-1 pt-1">
                                      Locked ({sec.boq_status || 'Approved'})
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
              <span>Loading BOQ Sections...</span>
            </div>
          </div>
        ) : paged.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg p-8 text-center text-text-muted text-[13px]">
            <ListTree className="w-8 h-8 text-text-muted/60 mx-auto mb-2" />
            <p className="font-medium text-text-secondary">No Sections Found</p>
            <p className="text-xs text-text-muted mt-1">No sections match the current filter.</p>
          </div>
        ) : (
          paged.map((sec, idx) => {
            const boqStatus = String(sec.boq_status || '').toUpperCase();
            const isBoqDraft = !boqStatus || boqStatus.includes('DRAFT');

            return (
              <div key={sec.id || idx} className="bg-surface border border-border rounded-lg p-3.5 shadow-xs space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-[10px] font-bold text-primary block truncate">
                      {sec.section_code}
                    </span>
                    <h4 className="font-semibold text-text-primary text-[13px] leading-snug truncate" title={sec.section_name}>
                      {sec.section_name}
                    </h4>
                    {sec.description && (
                      <span className="text-[11px] text-text-muted truncate block" title={sec.description}>
                        {sec.description}
                      </span>
                    )}
                  </div>
                  <Badge variant="info" className="text-[8px] font-bold uppercase tracking-wider h-4 px-1.5 inline-flex items-center leading-none shrink-0">
                    {sec.item_count || 0} {sec.item_count === 1 ? 'item' : 'items'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/60">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-text-muted block">Parent BOQ</span>
                    <span className="text-text-primary text-[11px] font-medium truncate block" title={sec.boq_name}>
                      {sec.boq_name || '—'}
                    </span>
                    <span className="text-[10px] text-text-muted font-mono truncate block">
                      {sec.boq_code || ''}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-text-muted block">Section Amount</span>
                    <span className="font-mono font-bold text-primary text-[12px]">
                      {formatCurrency(sec.section_amount || sec.total_amount)}
                    </span>
                  </div>
                </div>

                {sec.parent_section_name && (
                  <div className="text-[10px] text-text-muted pt-1 border-t border-border/40">
                    Parent Section: <span className="font-medium text-text-primary">{sec.parent_section_name}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                  <span className="text-[10px] text-text-muted font-mono">
                    #{(page - 1) * perPage + idx + 1}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] px-2"
                      onClick={() => setViewingSection(sec)}
                    >
                      <Eye className="w-3 h-3 mr-1" /> View
                    </Button>
                    {canUpdate && isBoqDraft && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title="Edit Section"
                        onClick={() => handleOpenEdit(sec)}
                      >
                        <Edit className="w-3.5 h-3.5 text-text-secondary hover:text-primary" />
                      </Button>
                    )}
                    {canDelete && isBoqDraft && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-error"
                        title="Delete Section"
                        onClick={() => setDeleteSection(sec)}
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

      {/* Add / Edit Section Modal */}
      <EntityEditModal
        isOpen={isAddOpen || Boolean(editingSection)}
        onClose={() => {
          setIsAddOpen(false);
          setEditingSection(null);
        }}
        size="md"
      >
        <EntityEditModal.Header
          icon={Layers}
          title={editingSection ? `Edit Section — ${editingSection.section_code}` : 'Create BOQ Section'}
          subtitle="Define hierarchical section division for project BOQ."
          onClose={() => {
            setIsAddOpen(false);
            setEditingSection(null);
          }}
        />
        <form id="section-form" onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <EntityEditModal.Body>
            <EntityEditModal.Section title="Section Information">
              <EntityEditModal.Grid>
                {!editingSection && (
                  <>
                    <FormField label="Project" required>
                      <Select
                        options={projects.map(p => ({ value: String(p.id), label: p.project_name || p.name, }))}
                        value={form.project_id}
                        onChange={(v) => handleFormChange('project_id', v)}
                      />
                    </FormField>

                    <FormField label="Target BOQ" required error={errors.boq_id}>
                      <Select
                        options={boqs.filter(b => !form.project_id || String(b.project_id) === String(form.project_id)).map(b => ({
                          value: String(b.id),
                          label: `${b.boq_code || 'BOQ'} - ${b.boq_name || b.name}`,
                        }))}
                        value={form.boq_id}
                        onChange={(v) => handleFormChange('boq_id', v)}
                        placeholder="Select BOQ..."
                      />
                    </FormField>
                  </>
                )}

                <FormField label="Parent Section (Optional)" className="sm:col-span-2">
                  <Select
                    options={[
                      { value: '', label: 'None (Top-level section)' },
                      ...sections
                        .filter(s => String(s.boq_id) === String(form.boq_id) && (!editingSection || s.id !== editingSection.id))
                        .map(s => ({ value: String(s.id), label: `${s.section_code} - ${s.section_name}` })),
                    ]}
                    value={form.parent_section_id}
                    onChange={(v) => handleFormChange('parent_section_id', v)}
                    placeholder="Top-level section"
                  />
                </FormField>

                <FormField label="Section Name / Title" required error={errors.section_name} className="sm:col-span-2">
                  <Input
                    value={form.section_name}
                    onChange={(e) => handleFormChange('section_name', e.target.value)}
                    placeholder="e.g. Earthwork & Excavation"
                  />
                </FormField>

                <FormField label="Display Sort Order">
                  <Input
                    type="number"
                    value={form.display_order}
                    onChange={(e) => handleFormChange('display_order', e.target.value)}
                    placeholder="0"
                  />
                </FormField>
              </EntityEditModal.Grid>
            </EntityEditModal.Section>

            <EntityEditModal.Section title="Scope Description" noBorder>
              <FormField label="Work Scope Description">
                <Textarea
                  value={form.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  placeholder="Describe the scope of work included in this section..."
                  rows={3}
                />
              </FormField>
            </EntityEditModal.Section>
          </EntityEditModal.Body>

          <EntityEditModal.Footer
            formId="section-form"
            submitLabel={editingSection ? 'Update Section' : 'Create Section'}
            onCancel={() => {
              setIsAddOpen(false);
              setEditingSection(null);
            }}
            isSubmitting={saving}
          />
        </form>
      </EntityEditModal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteSection)}
        title="Delete BOQ Section"
        message={`Are you sure you want to delete section "${deleteSection?.section_code} — ${deleteSection?.section_name}"?`}
        variant="danger"
        confirmLabel="Delete Section"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteSection(null)}
      />

      {/* View Section Details Modal */}
      {viewingSection && (
        <EntityEditModal isOpen={Boolean(viewingSection)} onClose={() => setViewingSection(null)} size="md">
          <EntityEditModal.Header
            icon={ListTree}
            title={`Section: ${viewingSection.section_code}`}
            subtitle={viewingSection.section_name}
            onClose={() => setViewingSection(null)}
          />
          <EntityEditModal.Body>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3 bg-surface-muted/30 rounded-lg border border-border">
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Parent BOQ</span>
                  <span className="font-semibold text-text-primary text-xs">{viewingSection.boq_name || '—'} ({viewingSection.boq_code || ''})</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Total Section Value</span>
                  <span className="font-mono font-bold text-text-primary text-xs">{formatCurrency(viewingSection.section_amount || viewingSection.total_amount)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Items Count</span>
                  <span className="font-medium text-text-primary text-xs">{viewingSection.item_count || 0} {viewingSection.item_count === 1 ? 'line item' : 'line items'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Display Order</span>
                  <span className="font-medium text-text-primary text-xs">{viewingSection.display_order ?? 0}</span>
                </div>
              </div>

              {viewingSection.description && (
                <div>
                  <h4 className="text-[11px] font-bold text-text-secondary uppercase mb-1">Scope Description</h4>
                  <p className="text-xs text-text-primary bg-surface p-3 rounded border border-border">
                    {viewingSection.description}
                  </p>
                </div>
              )}
            </div>
          </EntityEditModal.Body>
          <div className="p-4 border-t border-border bg-surface flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setViewingSection(null)}>
              Close
            </Button>
          </div>
        </EntityEditModal>
      )}
    </PageContainer>
  );
}

export default BoqSectionsPage;
