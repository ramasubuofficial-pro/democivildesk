import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Package, Plus, Edit, Trash2, ShieldCheck, ChevronRight, HelpCircle, Eye, Tag } from 'lucide-react';
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
import { Textarea } from '../../../components/ui/Textarea';
import { FormField } from '../../../components/composite/FormField';
import { EntityEditModal } from '../../../components/composite/EntityEditModal';
import { ConfirmDialog } from '../../../components/composite/ConfirmDialog';
import { toast } from '../../../components/composite/Toast';
import { materialsApi } from '../../../api/apiservice';
import { useAuth } from '../../auth/context/AuthContext';


export function MaterialCataloguePage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMasterSection = location.pathname.startsWith('/masters');

  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const perPage = 10;

  // View & Delete Modals
  const [viewingItem, setViewingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [resMaterials, resCategories, resMasters] = await Promise.all([
        materialsApi.catalogue.list(),
        materialsApi.categories.list(),
        materialsApi.masters(),
      ]);

      const matList = resMaterials?.data?.materials ?? resMaterials?.materials ?? (Array.isArray(resMaterials) ? resMaterials : []);
      setMaterials(Array.isArray(matList) ? matList : []);

      const catList = resCategories?.data?.material_categories ?? resCategories?.material_categories ?? [];
      setCategories(Array.isArray(catList) ? catList : []);

      const uomList = resMasters?.data?.masters?.units ?? resMasters?.masters?.units ?? [];
      setUoms(Array.isArray(uomList) ? uomList : []);
    } catch {
      toast.error('Failed to load material catalogue data.');
      setMaterials([]);
      setCategories([]);
      setUoms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Navigate to New / Edit Dedicated Form Page
  const handleOpenAdd = () => {
    navigate(isMasterSection ? '/masters/materials/new' : '/materials/catalogue/new');
  };

  const handleOpenEdit = (item) => {
    navigate(isMasterSection ? `/masters/materials/${item.id}/edit` : `/materials/catalogue/${item.id}/edit`);
  };

  const confirmDelete = async () => {
    if (!deletingItem?.id) return;
    try {
      await materialsApi.catalogue.remove(deletingItem.id);
      toast.success('Material item removed from catalogue.');
      setDeletingItem(null);
      fetchData();
    } catch (err) {
      toast.error(err?.message || 'Unable to delete material item.');
    }
  };

  // Filters & Search
  const filtered = useMemo(() => {
    return materials.filter((item) => {
      if (categoryFilter !== 'all' && String(item.material_category_id) !== categoryFilter) return false;

      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        String(item.material_name || '').toLowerCase().includes(q) ||
        String(item.material_code || '').toLowerCase().includes(q) ||
        String(item.specification || '').toLowerCase().includes(q) ||
        String(item.brand_preference || '').toLowerCase().includes(q)
      );
    });
  }, [materials, searchQuery, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  // Metrics
  const totalCount = materials.length;
  const activeCount = materials.filter(m => m.is_active).length;
  const minStockAlerts = materials.filter(m => Number(m.stock_qty || 0) < Number(m.minimum_stock_qty || 0)).length;

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Masters' },
    { label: 'Material Catalogue' },
  ];

  return (
    <PageContainer>
      <PageHeader title="Material Catalogue" breadcrumbs={breadcrumbs} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <KpiCard label="Catalogue Items" value={totalCount} icon={<Package />} status="primary" />
        <KpiCard label="Active Items" value={activeCount} icon={<ShieldCheck />} status="success" />
        <KpiCard label="Low Stock Items" value={minStockAlerts} icon={<HelpCircle />} status="warning" />
      </div>

      <div className="flex flex-col gap-4">
        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="w-full sm:w-[260px]">
              <SearchField
                placeholder="Search material code, name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-48">
              <Select
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={[
                  { value: 'all', label: 'All Categories' },
                  ...categories.map((c) => ({ value: String(c.id), label: c.category_name || c.name }))
                ]}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            {hasPermission('materials.manage_master') && (
              <Button
                variant="primary"
                className="h-9 px-3 text-[13px]"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={handleOpenAdd}
              >
                Add Material
              </Button>
            )}
          </div>
        </div>

        {/* Data Table */}
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
          <table className="w-full text-left text-[12px] whitespace-nowrap table-fixed">
            <thead className="bg-surface-muted text-text-secondary text-[11px] uppercase font-semibold border-b border-border tracking-wider">
              <tr>
                <th className="px-3 py-2 w-12 text-center">#</th>
                <th className="px-3 py-2 w-28">Code</th>
                <th className="px-3 py-2 w-48">Material Name</th>
                <th className="px-3 py-2 w-32">UOM</th>
                <th className="px-3 py-2 w-32 text-right">Standard Rate</th>
                <th className="px-3 py-2 w-28 text-center">GST %</th>
                <th className="px-3 py-2 hidden md:table-cell">Brand Preference</th>
                <th className="px-3 py-2 w-24 text-center">Status</th>
                <th className="px-3 py-2 w-24 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-text-muted text-[12px]">
                    Retrieving material items...
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-text-muted text-[12px]">
                    No materials found.
                  </td>
                </tr>
              ) : (
                paged.map((item, index) => (
                  <tr key={item.id || index} className="hover:bg-surface-muted/30 transition-colors">
                    <td className="px-3 py-2 text-center font-medium text-text-primary text-[11px]">
                      {(page - 1) * perPage + index + 1}
                    </td>
                    <td className="px-3 py-2 font-mono font-semibold text-text-primary text-[11px]">
                      {item.material_code || '—'}
                    </td>
                    <td className="px-3 py-2 font-medium text-text-primary text-[11px] truncate">
                      {item.material_name || '—'}
                    </td>
                    <td className="px-3 py-2 text-text-primary text-[11px]">
                      {item.unit_symbol || item.uom || '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-text-primary text-[11px] font-semibold">
                      ₹{Number(item.standard_rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-center text-text-primary text-[11px]">
                      {item.gst_rate !== null && item.gst_rate !== undefined ? `${item.gst_rate}%` : '—'}
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell text-text-secondary text-[11px] truncate">
                      {item.brand_preference || '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          item.is_active ? 'bg-success/10 text-success' : 'bg-surface-muted text-text-secondary'
                        }`}
                      >
                        {item.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          title="View Details"
                          onClick={() => setViewingItem(item)}
                        >
                          <Eye className="w-3.5 h-3.5 text-text-secondary hover:text-primary" />
                        </Button>
                        {hasPermission('materials.manage_master') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="Edit"
                            onClick={() => handleOpenEdit(item)}
                          >
                            <Edit className="w-3.5 h-3.5 text-text-secondary hover:text-primary" />
                          </Button>
                        )}
                        {hasPermission('materials.manage_master') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="Delete"
                            onClick={() => setDeletingItem(item)}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-text-secondary hover:text-error" />
                          </Button>
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


      {/* View Details Modal */}
      <EntityEditModal
        isOpen={Boolean(viewingItem)}
        onClose={() => setViewingItem(null)}
      >
        <EntityEditModal.Header
          icon={Package}
          title="Material Specifications"
          subtitle="Detailed stock properties, GST rates, and storage parameters."
          onClose={() => setViewingItem(null)}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <EntityEditModal.Body>
            <EntityEditModal.Section title="Material SKU Profile">
              <EntityEditModal.Grid>
                <div>
                  <div className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Material Name</div>
                  <div className="text-[13px] font-medium text-text-primary mt-1">{viewingItem?.material_name || '—'}</div>
                </div>

                <div>
                  <div className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Material Code</div>
                  <div className="text-[13px] font-mono font-semibold text-text-primary mt-1">{viewingItem?.material_code || '—'}</div>
                </div>

                <div>
                  <div className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Standard Unit Price</div>
                  <div className="text-[13px] font-semibold text-text-primary mt-1">
                    ₹{Number(viewingItem?.standard_rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">GST Rate & HSN</div>
                  <div className="text-[13px] text-text-primary mt-1">
                    {viewingItem?.gst_rate}% (HSN: {viewingItem?.hsn_code || '—'})
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Stock Alert Limits</div>
                  <div className="text-[12px] text-text-secondary mt-1">
                    Min Stock: {viewingItem?.minimum_stock_qty || '0'} | Reorder: {viewingItem?.reorder_qty || '0'}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Storage Hint</div>
                  <div className="text-[13px] text-text-primary mt-1">{viewingItem?.storage_location_hint || '—'}</div>
                </div>

                <div className="md:col-span-2">
                  <div className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Specification Notes</div>
                  <div className="text-[12px] text-text-secondary mt-1 whitespace-pre-wrap leading-relaxed">
                    {viewingItem?.notes || 'No specifications notes provided.'}
                  </div>
                </div>
              </EntityEditModal.Grid>
            </EntityEditModal.Section>
          </EntityEditModal.Body>
          <div className="flex items-center justify-end border-t border-border px-4 py-3 bg-surface-subtle">
            <Button variant="ghost" className="h-9 px-4 text-[13px]" onClick={() => setViewingItem(null)}>
              Close
            </Button>
          </div>
        </div>
      </EntityEditModal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deletingItem)}
        title="Delete Material SKU"
        message="Are you sure you want to delete this material catalogue item? It cannot be undone if it has already been used in purchase orders or receipt documents."
        variant="danger"
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingItem(null)}
      />
    </PageContainer>
  );
}
