import { useState, useEffect, useMemo, useCallback } from 'react';
import { Tag, Plus, Edit, Trash2, Award, BookmarkCheck } from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageContainer } from '../../../components/layout/PageContainer';
import { DataTableContainer } from '../../../components/composite/DataTableContainer';
import { Pagination } from '../../../components/composite/Pagination';
import { SearchField } from '../../../components/composite/SearchField';
import { KpiCard } from '../../../components/composite/KpiCard';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { FormField } from '../../../components/composite/FormField';
import { EntityEditModal } from '../../../components/composite/EntityEditModal';
import { ConfirmDialog } from '../../../components/composite/ConfirmDialog';
import { toast } from '../../../components/composite/Toast';
import { materialsApi } from '../../../api/apiservice';
import { useAuth } from '../../auth/context/AuthContext';

const EMPTY_FORM = {
  brand_name: '',
  brand_description: '',
};

const generateBrandCode = (name) => {
  const clean = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10);
  return `BRD-${clean || 'ITEM'}`;
};

export function BrandsPage() {
  const { hasPermission } = useAuth();
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Fetch brands from database
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await materialsApi.brands.list();
      const list = res?.data?.material_brands ?? res?.material_brands ?? (Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
      setBrands(Array.isArray(list) ? list : []);
    } catch (err) {
      toast.error(err?.message || 'Failed to load material brands from database.');
      setBrands([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Form Handlers
  const handleOpenAdd = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setIsAddOpen(true);
  };

  const handleOpenEdit = (item) => {
    setForm({
      brand_name: item.brand_name || '',
      brand_description: item.description || item.brand_description || '',
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
    const validationErrs = {};

    if (!form.brand_name || !form.brand_name.trim()) {
      validationErrs.brand_name = 'Brand name is required.';
    }

    if (Object.keys(validationErrs).length > 0) {
      setErrors(validationErrs);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        brand_code: editingItem?.brand_code || generateBrandCode(form.brand_name.trim()),
        brand_name: form.brand_name.trim(),
        description: form.brand_description ? form.brand_description.trim() : null,
        is_active: 1,
      };

      if (editingItem) {
        await materialsApi.brands.update(editingItem.id, payload);
        toast.success('Brand updated successfully in database.');
      } else {
        await materialsApi.brands.create(payload);
        toast.success('Brand added successfully to database.');
      }
      setIsAddOpen(false);
      setEditingItem(null);
      fetchData();
    } catch (err) {
      toast.error(err?.message || 'Failed to save brand to database.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingItem?.id) return;
    try {
      await materialsApi.brands.remove(deletingItem.id);
      toast.success('Brand deleted successfully from database.');
      setDeletingItem(null);
      fetchData();
    } catch (err) {
      toast.error(err?.message || 'Unable to delete brand from database.');
    }
  };

  // Filters & Search
  const filtered = useMemo(() => {
    return brands.filter((item) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        String(item.brand_name || '').toLowerCase().includes(q) ||
        String(item.brand_description || item.description || '').toLowerCase().includes(q)
      );
    });
  }, [brands, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Masters' },
    { label: 'Brands Registry' },
  ];

  return (
    <PageContainer>
      <PageHeader title="Brands Registry" breadcrumbs={breadcrumbs} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
        <KpiCard label="Total Registered Brands" value={brands.length} icon={<Tag />} status="primary" />
        <KpiCard label="Approved Manufacturers" value={brands.length} icon={<Award />} status="success" />
      </div>

      <div className="flex flex-col gap-4">
        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <div className="w-full sm:w-[280px]">
            <SearchField
              placeholder="Search by brand name or description..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex items-center gap-2 justify-end">
            {hasPermission('materials.manage_master') && (
              <Button
                variant="primary"
                className="h-9 px-3 text-[13px] w-full sm:w-auto"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={handleOpenAdd}
              >
                Add Brand
              </Button>
            )}
          </div>
        </div>

        {/* Desktop & Tablet Table */}
        <div className="hidden sm:block">
          <DataTableContainer
            pagination={
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalResults={filtered.length}
                pageSize={perPage}
                onPageChange={setPage}
              />
            }
          >
            <table className="w-full text-left text-[12px] min-w-[550px] table-auto">
              <thead className="bg-surface-muted text-text-secondary text-[11px] uppercase font-semibold border-b border-border tracking-wider">
                <tr>
                  <th className="px-3 py-2.5 w-12 text-center">#</th>
                  <th className="px-3 py-2.5 w-56">Brand Name</th>
                  <th className="px-3 py-2.5">Brand Description</th>
                  <th className="px-3 py-2.5 w-24 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-text-muted text-[12px]">
                      Loading registered brands...
                    </td>
                  </tr>
                ) : paged.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-text-muted text-[12px]">
                      No brands registered yet. Click &quot;Add Brand&quot; to add one.
                    </td>
                  </tr>
                ) : (
                  paged.map((item, index) => (
                    <tr key={item.id || index} className="hover:bg-surface-muted/30 transition-colors">
                      <td className="px-3 py-2.5 text-center font-medium text-text-primary text-[11px]">
                        {(page - 1) * perPage + index + 1}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-text-primary text-[12px]">
                        <div className="flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="truncate">{item.brand_name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-text-secondary text-[12px]">
                        <span className="line-clamp-2" title={item.brand_description || item.description || ''}>
                          {item.brand_description || item.description || <span className="text-text-muted italic">No description provided</span>}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {hasPermission('materials.manage_master') && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                title="Edit Brand"
                                onClick={() => handleOpenEdit(item)}
                              >
                                <Edit className="w-3.5 h-3.5 text-text-secondary hover:text-primary" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                title="Delete Brand"
                                onClick={() => setDeletingItem(item)}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-text-secondary hover:text-error" />
                              </Button>
                            </>
                          )}
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
            <div className="text-center py-8 text-text-muted text-[12px] bg-surface border border-border rounded-lg shadow-xs">
              Loading registered brands...
            </div>
          ) : paged.length === 0 ? (
            <div className="text-center py-8 text-text-muted text-[12px] bg-surface border border-border rounded-lg shadow-xs">
              No brands registered yet. Click &quot;Add Brand&quot; to add one.
            </div>
          ) : (
            <>
              <div className="space-y-2.5">
                {paged.map((item, index) => (
                  <div
                    key={item.id || index}
                    className="bg-surface border border-border rounded-lg p-3.5 shadow-xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                          <Tag className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-text-primary text-[14px] leading-tight truncate">
                            {item.brand_name}
                          </h4>
                          <span className="text-[11px] font-mono text-text-muted">
                            #{(page - 1) * perPage + index + 1}
                          </span>
                        </div>
                      </div>

                      {hasPermission('materials.manage_master') && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Edit Brand"
                            onClick={() => handleOpenEdit(item)}
                          >
                            <Edit className="w-4 h-4 text-text-secondary hover:text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Delete Brand"
                            onClick={() => setDeletingItem(item)}
                          >
                            <Trash2 className="w-4 h-4 text-text-secondary hover:text-error" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-border/60">
                      <span className="text-[10px] uppercase font-bold text-text-muted block mb-1">
                        Brand Description
                      </span>
                      <p className="text-[12px] text-text-secondary leading-relaxed break-words">
                        {item.brand_description || item.description || (
                          <span className="text-text-muted italic">No description provided</span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Mobile Pagination */}
              <div className="bg-surface border border-border rounded-lg p-3 shadow-xs">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalResults={filtered.length}
                  pageSize={perPage}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add / Edit Brand Modal */}
      <EntityEditModal
        isOpen={isAddOpen || Boolean(editingItem)}
        onClose={() => {
          setIsAddOpen(false);
          setEditingItem(null);
        }}
      >
        <EntityEditModal.Header
          icon={Tag}
          title={editingItem ? 'Edit Brand' : 'Add Brand'}
          subtitle="Configure brand name and details for materials preference mapping."
          onClose={() => {
            setIsAddOpen(false);
            setEditingItem(null);
          }}
        />
        <form id="brand-item-form" onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <EntityEditModal.Body>
            <EntityEditModal.Section title="Brand Information">
              <div className="space-y-4">
                <FormField label="Brand Name" required error={errors.brand_name}>
                  <Input
                    placeholder="e.g. Tata Steel, Ultratech, Astral"
                    value={form.brand_name}
                    onChange={(e) => handleFormChange('brand_name', e.target.value)}
                    autoFocus
                  />
                </FormField>

                <FormField label="Brand Description" error={errors.brand_description}>
                  <Textarea
                    placeholder="Optional details about this brand, product lines, or specifications..."
                    value={form.brand_description}
                    onChange={(e) => handleFormChange('brand_description', e.target.value)}
                    rows={4}
                  />
                </FormField>
              </div>
            </EntityEditModal.Section>
          </EntityEditModal.Body>
          <EntityEditModal.Footer
            formId="brand-item-form"
            submitLabel={editingItem ? 'Update Brand' : 'Add Brand'}
            onCancel={() => {
              setIsAddOpen(false);
              setEditingItem(null);
            }}
            isSubmitting={saving}
          />
        </form>
      </EntityEditModal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deletingItem)}
        title="Delete Brand"
        message={`Are you sure you want to delete brand "${deletingItem?.brand_name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingItem(null)}
      />
    </PageContainer>
  );
}
