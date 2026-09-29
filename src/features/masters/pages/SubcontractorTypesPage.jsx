import { useState, useEffect, useMemo } from 'react';
import { Briefcase, Plus, Edit, Trash2, ShieldCheck, FileText, Eye, GripVertical } from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageContainer } from '../../../components/layout/PageContainer';
import { DataTableContainer } from '../../../components/composite/DataTableContainer';
import { Pagination } from '../../../components/composite/Pagination';
import { SearchField } from '../../../components/composite/SearchField';
import { KpiCard } from '../../../components/composite/KpiCard';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
import { Textarea } from '../../../components/ui/Textarea';
import { FormField } from '../../../components/composite/FormField';
import { EntityEditModal } from '../../../components/composite/EntityEditModal';
import { ConfirmDialog } from '../../../components/composite/ConfirmDialog';
import { toast } from '../../../components/composite/Toast';
import { subcontractsApi, request } from '../../../api/apiservice';

const EMPTY_FORM = {
  type_code: '',
  type_name: '',
  description: '',
  is_active: '1',
};

const LEGACY_MOCK_TYPE_CODES = new Set(['SUB-MAIS', 'SUB-CARP', 'SUB-CENT', 'SUB-BAR']);
const LEGACY_MOCK_TEMPLATES = new Set([
  'MM', 'FM', 'Concrete Mixer', 'Lead Carpenter', 'Assistant Carpenter',
  'Wood Cutting Machine', 'Centering Mestri', 'Centering Helper',
  'Scaffolding & Props Set', 'Bar Bender Skilled', 'Bar Bender Helper',
  'Rebar Bending & Cutting Unit'
]);

export function SubcontractorTypesPage() {
  const [types, setTypes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const fetchTemplates = async (typeId) => {
    setLoadingTemplates(true);
    try {
      const res = await request.get(`/subcontracts/types/${typeId}/templates`);
      const backendData = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : (Object.values(res || {}).find(Array.isArray) || Object.values(res?.data || {}).find(Array.isArray) || []));
      const normalizedTemplates = backendData.map(t => ({
        ...t,
        id: Number(t.id),
        type_id: t.subcontractor_type_id || t.type_id,
        description: t.item_description || t.description || t.template_name || t.name,
        uom: t.unit || t.uom,
        is_active: t.status == 1 || t.is_active == 1,
        calculate_maistry: t.maistry_scope == 1 || t.calculate_maistry == 1,
        classification: t.classification || 'Labour'
      }));
      setTemplates(normalizedTemplates);
    } catch (err) {
      toast.error('Failed to load templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleViewTemplates = (item) => {
    setViewingItem(item);
    fetchTemplates(item.id);
  };

  const [equipmentMasters, setEquipmentMasters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchTypes = async () => {
    setLoading(true);
    try {
      const res = await request.get('/subcontracts/types').catch(() => null);
      const backendTypes = res?.data?.types ?? res?.types ?? res?.data?.contractor_types ?? res?.contractor_types ?? res?.data?.data ?? res?.data ?? [];

      const liveTypes = (Array.isArray(backendTypes) ? backendTypes : []).map(t => ({
        id: t.id,
        type_code: t.contractor_type_code || t.type_code,
        type_name: t.contractor_type_name || t.type_name,
        description: t.description || `${t.contractor_type_name || t.type_name || ''} Contractor`,
        is_active: t.is_active === 1 || t.is_active === true || t.is_active === '1' ? 1 : 0,
        is_system: true,
      }));

      setTypes(liveTypes);
    } catch (err) {
      console.error('Failed to load subcontractor types from database', err);
      toast.error('Failed to load subcontractor types');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('mock_equipment_master');
      if (stored) {
        setEquipmentMasters(JSON.parse(stored).filter(e => e.is_active));
      }
    } catch {}
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  // Template Modal state
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [templateForm, setTemplateForm] = useState({
    classification: 'Labour',
    description: '',
    trade_category: '',
    uom: 'shift',
    default_rate: '0.00',
    is_active: true,
    calculate_maistry: false
  });



  // Form Handlers
  const handleOpenAdd = () => {
    setForm({ ...EMPTY_FORM });
    setErrors({});
    setIsAddOpen(true);
  };

  const handleOpenEdit = (item) => {
    setForm({
      type_code: item.type_code || '',
      type_name: item.type_name || '',
      description: item.description || '',
      is_active: item.is_active ? '1' : '0',
    });
    setErrors({});
    setEditingItem(item);
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.type_name.trim()) errs.type_name = 'Type Name is required';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      const autoCode = (form.type_code || `SUB-${form.type_name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)}` || `SUB-${Date.now().toString().slice(-4)}`).trim();
      const payload = {
        type_code: autoCode,
        code: autoCode,
        contractor_type_code: autoCode,
        contractor_type_name: form.type_name.trim(),
        type_name: form.type_name.trim(),
        name: form.type_name.trim(),
        description: form.description.trim(),
        is_active: form.is_active === '1' ? 1 : 0,
      };

      if (editingItem?.id) {
        await request.patch(`/subcontracts/types/${editingItem.id}`, payload);
        toast.success('Subcontractor Type updated successfully.');
      } else {
        await request.post('/subcontracts/types', payload);
        toast.success('Subcontractor Type created successfully.');
      }

      await fetchTypes();
      setIsAddOpen(false);
      setEditingItem(null);
    } catch (err) {
      toast.error(err?.message || 'Failed to save subcontractor type.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingItem?.id) return;
    try {
      try {
        await request.delete(`/subcontracts/types/${deletingItem.id}`);
      } catch {
        const fallbackPayload = {
          type_code: deletingItem.type_code || deletingItem.code || undefined,
          code: deletingItem.type_code || deletingItem.code || undefined,
          contractor_type_name: deletingItem.type_name || deletingItem.name || '',
          type_name: deletingItem.type_name || deletingItem.name || '',
          name: deletingItem.type_name || deletingItem.name || '',
          description: deletingItem.description || '',
          is_active: 0,
        };
        await request.patch(`/subcontracts/types/${deletingItem.id}`, fallbackPayload);
      }
      toast.success('Subcontractor Type deleted successfully.');
      await fetchTypes();
    } catch (err) {
      toast.error(err?.message || 'Failed to delete subcontractor type.');
    } finally {
      setDeletingItem(null);
    }
  };

  // Template Form Handlers
  const handleOpenTemplate = (item) => {
    setSelectedType(item);
    setTemplateForm({
      classification: 'Labour',
      description: '',
      trade_category: item.type_name,
      uom: 'Shift',
      custom_uom: '',
      default_rate: '0.00',
      is_active: true,
      calculate_maistry: false
    });
    setIsTemplateOpen(true);
  };

  const handleTemplateFormChange = (field, value) => {
    setTemplateForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleTemplateSubmit = async (e) => {
    e.preventDefault();
    if (!templateForm.description.trim()) {
      toast.error('Item Description is required');
      return;
    }

    let finalUom = templateForm.uom;
    if (templateForm.uom === 'Others') {
      if (!templateForm.custom_uom.trim()) {
        toast.error('Please specify the custom Unit of Measure');
        return;
      }
      finalUom = templateForm.custom_uom.trim();
    }

    const { custom_uom, ...restForm } = templateForm;
    const payload = {
      ...restForm,
      item_description: restForm.description,
      unit: finalUom,
      uom: finalUom,
      maistry_scope: restForm.calculate_maistry ? 1 : 0,
      status: restForm.is_active ? 1 : 0,
      subcontractor_type_id: selectedType.id
    };
    
    try {
      await request.post(`/subcontracts/types/${selectedType.id}/templates`, payload);
      toast.success('Template item created successfully.');
      setIsTemplateOpen(false);
      if (viewingItem && viewingItem.id === selectedType.id) {
        fetchTemplates(selectedType.id);
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to create template item');
    }
  };

  const handleSaveTemplateRates = async () => {
    try {
      if (!viewingItem) return;
      const promises = templates.map(t => 
        request.patch(`/subcontracts/types/${viewingItem.id}/templates/${t.id}`, { default_rate: t.default_rate, is_active: t.is_active ? 1 : 0, status: t.is_active ? 1 : 0 })
      );
      await Promise.all(promises);
      toast.success('Template rates saved successfully');
      setViewingItem(null);
    } catch (error) {
      toast.error('Failed to save template rates');
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm("Are you sure you want to delete this template item?")) return;
    try {
      await request.delete(`/subcontracts/types/${viewingItem.id}/templates/${templateId}`);
      toast.success('Template item deleted successfully');
      fetchTemplates(viewingItem.id);
    } catch (err) {
      toast.error('Failed to delete template item');
    }
  };

  const handleDragStart = (e, id) => {
    e.dataTransfer.setData('text/plain', id);
    e.currentTarget.style.opacity = '0.4';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    const draggedId = Number(e.dataTransfer.getData('text/plain'));
    if (draggedId === targetId || !draggedId) return;

    setTemplates(prev => {
      const copy = [...prev];
      const dragIdx = copy.findIndex(t => t.id === draggedId);
      const dropIdx = copy.findIndex(t => t.id === targetId);

      if (dragIdx > -1 && dropIdx > -1) {
        const [draggedItem] = copy.splice(dragIdx, 1);
        copy.splice(dropIdx, 0, draggedItem);
      }
      
      const orderedIds = copy.map(t => t.id);
      request.post(`/subcontracts/types/${viewingItem.id}/templates/reorder`, { ordered_ids: orderedIds })
        .catch(() => toast.error('Failed to reorder templates'));
        
      return copy;
    });
  };

  // Safe Filtered List
  const filteredTypes = useMemo(() => {
    if (!searchQuery) return types;
    const lower = searchQuery.toLowerCase();
    return types.filter((t) =>
      (t.type_code || '').toLowerCase().includes(lower) ||
      (t.type_name || '').toLowerCase().includes(lower) ||
      (t.description || '').toLowerCase().includes(lower)
    );
  }, [types, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredTypes.length / perPage));
  const pagedTypes = filteredTypes.slice((page - 1) * perPage, page * perPage);

  const activeCount = types.filter((t) => t.is_active).length;
  const totalCount = types.length;

  return (
    <PageContainer>
      <PageHeader
        title="Subcontractor Types"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Masters', href: '/masters/project-types' },
          { label: 'Subcontractor Types' },
        ]}
      />

      <div className="flex w-full flex-col gap-3 sm:gap-4">
        {/* KPI Ribbons */}
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 sm:gap-3">
          <KpiCard label="Total Types" value={totalCount} icon={<Briefcase />} status="info" />
          <KpiCard label="Active Types" value={activeCount} icon={<ShieldCheck className="text-emerald-500" />} status="success" />
        </div>

        {/* Controls */}
        <div className="flex flex-col items-stretch justify-between gap-2.5 rounded-lg border border-border bg-surface p-2.5 shadow-xs sm:flex-row sm:items-center sm:p-3">
          <div className="w-full sm:w-64">
            <SearchField
              placeholder="Search types..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="h-3.5 w-3.5" />}
            onClick={handleOpenAdd}
            className="h-8 text-xs shadow-xs"
          >
            Add Subcontractor Type
          </Button>
        </div>

        {/* Desktop & Tablet Table (No horizontal scroll, 100% fluid) */}
        <div className="hidden sm:block">
          <DataTableContainer
            pagination={
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={filteredTypes.length}
                itemsPerPage={perPage}
                onPageChange={setPage}
              />
            }
          >
            <table className="w-full table-auto text-left text-[12px]">
              <thead className="border-b border-border bg-surface-muted text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                <tr>
                  <th className="w-10 px-3 py-2 text-center">#</th>
                  <th className="w-32 px-3 py-2">Code</th>
                  <th className="px-3 py-2">Type Name</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="w-24 px-3 py-2 text-center">Status</th>
                  <th className="w-36 px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-[12px] text-text-muted">
                      Loading subcontractor types from database...
                    </td>
                  </tr>
                ) : pagedTypes.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-[12px] text-text-muted">
                      No subcontractor types found.
                    </td>
                  </tr>
                ) : (
                  pagedTypes.map((item, idx) => (
                    <tr key={item.id} className="group transition-colors hover:bg-surface-muted/30">
                      <td className="px-3 py-2 text-center text-[11px] font-medium text-text-primary">
                        {(page - 1) * perPage + idx + 1}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                          {item.type_code}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-semibold text-text-primary text-[12px] truncate" title={item.type_name}>
                          {item.type_name}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="block truncate text-[11px] text-text-secondary" title={item.description}>
                          {item.description || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge
                          variant={item.is_active ? 'success' : 'neutral'}
                          className="text-[9px] font-bold uppercase tracking-wider h-5 px-2 inline-flex items-center"
                        >
                          {item.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="View Templates"
                            onClick={() => handleViewTemplates(item)}
                          >
                            <Eye className="h-3.5 w-3.5 text-blue-500 hover:text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="Edit"
                            onClick={() => handleOpenEdit(item)}
                          >
                            <Edit className="h-3.5 w-3.5 text-text-secondary hover:text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="Delete"
                            onClick={() => setDeletingItem(item)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-text-secondary hover:text-red-500" />
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

        {/* Mobile View - Cards List for Phones (< sm) */}
        <div className="block sm:hidden space-y-3">
          {loading ? (
            <div className="py-8 text-center text-xs text-text-muted">Loading subcontractor types from database...</div>
          ) : pagedTypes.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-muted">No subcontractor types found.</div>
          ) : (
            pagedTypes.map((item, idx) => (
            <div key={item.id} className="bg-surface border border-border rounded-lg p-3.5 shadow-xs space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-[10px] font-bold text-primary block">{item.type_code}</span>
                  <h4 className="font-semibold text-text-primary text-[13px] leading-snug">{item.type_name}</h4>
                </div>
                <Badge
                  variant={item.is_active ? 'success' : 'neutral'}
                  className="text-[9px] font-bold uppercase tracking-wider h-5 px-2 inline-flex items-center"
                >
                  {item.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <div className="text-xs pt-1 border-t border-border/60 text-text-secondary">
                <span className="block text-[10px] uppercase font-bold text-text-muted mb-1">Description</span>
                {item.description || 'No description provided'}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/60">
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-[11px] px-2 text-blue-600 border-blue-200 bg-blue-50" onClick={() => handleViewTemplates(item)}>
                    <Eye className="w-3 h-3 mr-1" /> View
                  </Button>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-[11px] px-2" onClick={() => handleOpenEdit(item)}>
                    <Edit className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-[11px] px-2 text-red-500 hover:text-red-600 border-border" onClick={() => setDeletingItem(item)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          )))}
          {/* Mobile Pagination */}
          <div className="pt-2">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={filteredTypes.length}
              itemsPerPage={perPage}
              onPageChange={setPage}
            />
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <EntityEditModal
        isOpen={isAddOpen || !!editingItem}
        onClose={() => {
          setIsAddOpen(false);
          setEditingItem(null);
        }}
      >
        <EntityEditModal.Header
          icon={Briefcase}
          title={editingItem ? 'Edit Subcontractor Type' : 'Add Subcontractor Type'}
          subtitle="Define subcontractor type categories and their specializations."
          onClose={() => {
            setIsAddOpen(false);
            setEditingItem(null);
          }}
        />
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <EntityEditModal.Body>
            <EntityEditModal.Section title="Type Details">
              <EntityEditModal.Grid>
                <div className="sm:col-span-2">
                  <FormField label="Type Name" error={errors.type_name} required>
                    <Input
                      placeholder="e.g. Maistry, Carpenter"
                      value={form.type_name}
                      onChange={(e) => handleFormChange('type_name', e.target.value)}
                    />
                  </FormField>
                </div>

                <div className="sm:col-span-2">
                  <FormField label="Description">
                    <Textarea
                      placeholder="Enter detailed description..."
                      rows={2}
                      value={form.description}
                      onChange={(e) => handleFormChange('description', e.target.value)}
                    />
                  </FormField>
                </div>

                <FormField label="Status" error={errors.is_active}>
                  <Select
                    options={[
                      { value: '1', label: 'Active' },
                      { value: '0', label: 'Inactive' },
                    ]}
                    value={form.is_active}
                    onChange={(value) => handleFormChange('is_active', value)}
                  />
                </FormField>
              </EntityEditModal.Grid>
            </EntityEditModal.Section>
          </EntityEditModal.Body>
          <EntityEditModal.Footer>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAddOpen(false);
                setEditingItem(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Type'}
            </Button>
          </EntityEditModal.Footer>
        </form>
      </EntityEditModal>

      {/* View Templates Modal */}
      <EntityEditModal
        isOpen={!!viewingItem}
        onClose={() => setViewingItem(null)}
      >
        <EntityEditModal.Header
          icon={Eye}
          title={`Templates for ${viewingItem?.type_name || ''}`}
          subtitle="View associated items (Machinery, Equipment, Labour, Expenses)."
          onClose={() => setViewingItem(null)}
        />
        <EntityEditModal.Body>
          <div className="space-y-4 p-1">
            {loadingTemplates ? (
              <div className="text-center p-6 text-text-muted text-[13px]">Loading templates...</div>
            ) : templates.length === 0 ? (
              <div className="text-center p-6 bg-surface-muted border border-border rounded-lg text-text-muted text-[13px]">
                No templates have been added yet for this type.
              </div>
            ) : (
              <div className="border border-border rounded-lg divide-y divide-border overflow-hidden shadow-xs">
                {templates.map(t => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, t.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, t.id)}
                    className="p-3 bg-surface hover:bg-surface-muted/50 transition-colors flex flex-col sm:flex-row sm:items-center gap-3 cursor-move border-b border-border last:border-0"
                  >
                    <div className="pt-0.5 text-border hover:text-text-secondary transition-colors hidden sm:block shrink-0">
                      <GripVertical className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Name and classification */}
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <Badge variant="neutral" className="text-[9px] uppercase tracking-wider font-bold shrink-0">
                          {t.classification || 'ITEM'}
                        </Badge>
                        <span className="font-semibold text-text-primary text-[13px] truncate">
                          {t.description || 'Unnamed Item'}
                        </span>
                        {t.calculate_maistry && (
                          <span className="text-amber-700 font-sans font-medium text-[10px] bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-flex items-center shrink-0">
                            <ShieldCheck className="w-3 h-3 mr-1" /> Maistry Scope
                          </span>
                        )}
                      </div>

                      {/* Columns */}
                      <div className="flex items-center gap-4 sm:w-[250px] shrink-0 justify-between text-[12px]">
                        <div className="flex-1 flex justify-end">
                          <div className="relative w-24">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary text-[11px]">₹</span>
                            <Input
                              type="number"
                              value={t.default_rate}
                              onChange={(e) => {
                                const val = e.target.value;
                                setTemplates(prev => prev.map(tmpl => tmpl.id === t.id ? { ...tmpl, default_rate: val } : tmpl));
                              }}
                              className="h-7 w-full pl-6 pr-2 text-[12px] text-right font-medium"
                            />
                          </div>
                        </div>
                        <div className="w-16 text-text-secondary text-center">
                          {t.uom}
                        </div>
                        <div className="w-16 flex justify-end">
                          <Badge variant={t.is_active ? 'success' : 'neutral'} className="text-[9px] h-5 shrink-0">
                            {t.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="w-8 flex justify-end">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-text-secondary hover:text-red-500" onClick={() => handleDeleteTemplate(t.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </EntityEditModal.Body>
        <EntityEditModal.Footer>
          <div className="flex justify-end gap-2 w-full">
            <Button variant="outline" onClick={handleSaveTemplateRates}>
              Save Changes
            </Button>
            <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={() => {
              handleOpenTemplate(viewingItem);
              setViewingItem(null);
            }}>
              Add Template Item
            </Button>
          </div>
        </EntityEditModal.Footer>
      </EntityEditModal>

      {/* Add Template Item Modal */}
      <EntityEditModal
        isOpen={isTemplateOpen}
        onClose={() => setIsTemplateOpen(false)}
      >
        <EntityEditModal.Header
          icon={FileText}
          title="New Template Item"
          subtitle={`Add an item for ${selectedType?.type_name || ''}`}
          onClose={() => setIsTemplateOpen(false)}
        />
        <form onSubmit={handleTemplateSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <EntityEditModal.Body>
            <EntityEditModal.Section title="Item Details">
              <EntityEditModal.Grid>
                <div className="sm:col-span-2">
                  <FormField label="Item Classification" required>
                    <Select
                      options={[
                        { value: 'Labour', label: 'Labour' },
                        { value: 'Equipment', label: 'Equipment / Machinery' },
                        { value: 'Expense', label: 'Expense' },
                      ]}
                      value={templateForm.classification}
                      onChange={(value) => handleTemplateFormChange('classification', value)}
                    />
                  </FormField>
                </div>

                <div className="sm:col-span-2">
                  <FormField label="Item Description / Name" required>
                    {templateForm.classification === 'Equipment' ? (
                      <SearchableSelect
                        options={equipmentMasters.map(e => ({ value: e.name, label: e.name }))}
                        value={templateForm.description}
                        onChange={(val) => handleTemplateFormChange('description', val)}
                        placeholder="Search equipment..."
                      />
                    ) : (
                      <Input
                        placeholder="e.g. Carpenter, Scaffolding Pipe Set, Mixer"
                        value={templateForm.description}
                        onChange={(e) => handleTemplateFormChange('description', e.target.value)}
                      />
                    )}
                  </FormField>
                </div>

                <div className="sm:col-span-2">
                  <FormField label="Trade Category">
                    <Input
                      value={templateForm.trade_category}
                      onChange={(e) => handleTemplateFormChange('trade_category', e.target.value)}
                      disabled
                      className="bg-surface-muted cursor-not-allowed"
                    />
                  </FormField>
                </div>

                <FormField label="Unit of Measure">
                  <Select
                    options={[
                      { value: 'Shift', label: 'Shift' },
                      { value: 'Hours', label: 'Hours' },
                      { value: 'Day', label: 'Day' },
                      { value: 'Numbers', label: 'Numbers' },
                      { value: 'Quantity', label: 'Quantity' },
                      { value: 'Rental', lable: 'Rental' },
                      { value: 'Others', label: 'Others' }

                    ]}
                    placeholder="Select Unit..."
                    value={templateForm.uom}
                    onChange={(val) => handleTemplateFormChange('uom', val)}
                    className="w-full"
                  />
                  {templateForm.uom === 'Others' && (
                    <div className="mt-2">
                      <Input
                        placeholder="Enter custom unit (e.g. sqft)"
                        value={templateForm.custom_uom || ''}
                        onChange={(e) => handleTemplateFormChange('custom_uom', e.target.value)}
                      />
                    </div>
                  )}
                </FormField>

                <FormField label="Default Rate (₹)">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={templateForm.default_rate}
                    onChange={(e) => handleTemplateFormChange('default_rate', e.target.value)}
                  />
                </FormField>

                <div className="sm:col-span-2 pt-2 border-t border-border mt-2 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      checked={templateForm.is_active}
                      onChange={(e) => handleTemplateFormChange('is_active', e.target.checked)}
                    />
                    <span className="text-sm text-text-primary font-medium group-hover:text-primary transition-colors">
                      Active (Available in daily entry quick options)
                    </span>
                  </label>


                </div>
              </EntityEditModal.Grid>
            </EntityEditModal.Section>
          </EntityEditModal.Body>
          <EntityEditModal.Footer>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsTemplateOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create Item
            </Button>
          </EntityEditModal.Footer>
        </form>
      </EntityEditModal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingItem}
        title="Delete Subcontractor Type"
        message={`Are you sure you want to delete ${deletingItem?.type_name}? This action cannot be undone.`}
        confirmLabel="Delete"
        isDestructive
        onConfirm={confirmDelete}
        onCancel={() => setDeletingItem(null)}
      />
    </PageContainer>
  );
}
