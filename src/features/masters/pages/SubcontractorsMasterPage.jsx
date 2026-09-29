import { useState, useEffect, useMemo } from 'react';
import { Users, Plus, Edit, Trash2, ShieldCheck, MapPin } from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageContainer } from '../../../components/layout/PageContainer';
import { DataTableContainer } from '../../../components/composite/DataTableContainer';
import { Pagination } from '../../../components/composite/Pagination';
import { SearchField } from '../../../components/composite/SearchField';
import { KpiCard } from '../../../components/composite/KpiCard';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
import { FormField } from '../../../components/composite/FormField';
import { EntityEditModal } from '../../../components/composite/EntityEditModal';
import { ConfirmDialog } from '../../../components/composite/ConfirmDialog';
import { toast } from '../../../components/composite/Toast';

import { subcontractsApi } from '../../../api/apiservice';

const EMPTY_FORM = {
  contractor_name: '',
  phone: '',
  subcontractor_type_id: '',
};

export function SubcontractorsMasterPage() {
  // Subcontractor Type options from database
  const [typeOptions, setTypeOptions] = useState([]);
  const [subcontractors, setSubcontractors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const [mastersRes, contrRes] = await Promise.all([
        subcontractsApi.masters().catch(() => null),
        subcontractsApi.contractors.list().catch(() => null),
      ]);

      const typesList = mastersRes?.data?.masters?.contractor_types ?? mastersRes?.data?.contractor_types ?? [];
      const opts = (Array.isArray(typesList) ? typesList : []).map(t => ({
        value: String(t.id),
        label: t.contractor_type_name || t.name || 'Contractor Type',
      }));
      setTypeOptions(opts);

      const rawContractors = contrRes?.data?.subcontractors ?? contrRes?.data?.data ?? [];
      const normalized = (Array.isArray(rawContractors) ? rawContractors : []).map(c => {
        const matchedType = opts.find(o => o.value === String(c.contractor_type_id));
        const typeLabel = c.contractor_type_name
          ? `${c.contractor_type_code ? c.contractor_type_code + ' - ' : ''}${c.contractor_type_name}`.trim()
          : (matchedType ? matchedType.label : '');

        return {
          id: c.id,
          contractor_code: c.contractor_code || `SUB-${c.id}`,
          contractor_name: c.contractor_name || '',
          phone: c.phone || '',
          subcontractor_type_id: String(c.contractor_type_id || ''),
          subcontractor_type_label: typeLabel,
          status_id: c.status_id,
          is_active: c.status_code === 'ACTIVE' || c.is_active === 1 || c.status_id === 1,
        };
      });

      setSubcontractors(normalized);
      setSubcontractors(normalized);
    } catch (err) {
      console.error('Failed to load subcontractors data from database', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAdd = () => {
    setForm({ ...EMPTY_FORM });
    setErrors({});
    setIsAddOpen(true);
  };

  const handleOpenEdit = (item) => {
    setForm({
      contractor_name: item.contractor_name || '',
      phone: item.phone || '',
      subcontractor_type_id: item.subcontractor_type_id ? String(item.subcontractor_type_id) : '',
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
    if (!form.contractor_name.trim()) errs.contractor_name = 'Name is required';
    if (!form.subcontractor_type_id) errs.subcontractor_type_id = 'Subcontractor Type is required';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        contractor_code: editingItem?.contractor_code || `SUB-${Date.now().toString().slice(-6)}`,
        contractor_name: form.contractor_name.trim(),
        contractor_type_id: Number(form.subcontractor_type_id),
        phone: form.phone.trim() || undefined,
        status_id: 1,
      };

      if (editingItem?.id) {
        await subcontractsApi.contractors.update(editingItem.id, payload);
        toast.success('Subcontractor updated successfully.');
      } else {
        await subcontractsApi.contractors.create(payload);
        toast.success('Subcontractor onboarded successfully.');
      }

      await fetchData();
      setIsAddOpen(false);
      setEditingItem(null);
    } catch (err) {
      toast.error(err?.message || 'Failed to save subcontractor.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingItem?.id) return;
    try {
      try {
        await subcontractsApi.contractors.remove(deletingItem.id);
      } catch {
        await subcontractsApi.contractors.update(deletingItem.id, { status_id: 2 });
      }
      toast.success('Subcontractor deleted successfully.');
      await fetchData();
    } catch (err) {
      toast.error(err?.message || 'Failed to delete subcontractor.');
    } finally {
      setDeletingItem(null);
    }
  };

  // Safe Filtered List
  const filteredData = useMemo(() => {
    if (!searchQuery) return subcontractors;
    const lower = searchQuery.toLowerCase();
    return subcontractors.filter((t) =>
      (t.contractor_name || '').toLowerCase().includes(lower) ||
      (t.contractor_code || '').toLowerCase().includes(lower) ||
      (t.phone || '').toLowerCase().includes(lower) ||
      (t.subcontractor_type_label || '').toLowerCase().includes(lower)
    );
  }, [subcontractors, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / perPage));
  const pagedData = filteredData.slice((page - 1) * perPage, page * perPage);

  return (
    <PageContainer>
      <PageHeader
        title="Subcontractors"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Subcontractor Master', href: '/masters/subcontractor-types' },
          { label: 'Subcontractors' },
        ]}
      />

      <div className="flex w-full flex-col gap-3 sm:gap-4">
        {/* KPI Ribbons */}
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 sm:gap-3">
          <KpiCard label="Total Subcontractors" value={subcontractors.length} icon={<Users />} status="info" />
          <KpiCard label="Active Subcontractors" value={subcontractors.length} icon={<ShieldCheck className="text-emerald-500" />} status="success" />
        </div>

        {/* Controls */}
        <div className="flex flex-col items-stretch justify-between gap-2.5 rounded-lg border border-border bg-surface p-2.5 shadow-xs sm:flex-row sm:items-center sm:p-3">
          <div className="w-full sm:w-64">
            <SearchField
              placeholder="Search subcontractors..."
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
            Add New Subcontractor
          </Button>
        </div>

        {/* Desktop & Tablet Table */}
        <div className="hidden sm:block">
          <DataTableContainer
            pagination={
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={filteredData.length}
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
                  <th className="px-3 py-2">Contractor Name & Specialization</th>
                  <th className="px-3 py-2 w-48">Phone Number</th>
                  <th className="w-24 px-3 py-2 text-center">Status</th>
                  <th className="w-24 px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-[12px] text-text-muted">
                      Loading subcontractors from database...
                    </td>
                  </tr>
                ) : pagedData.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-[12px] text-text-muted">
                      No subcontractors found.
                    </td>
                  </tr>
                ) : (
                  pagedData.map((item, idx) => (
                    <tr key={item.id} className="group transition-colors hover:bg-surface-muted/30">
                      <td className="px-3 py-2 text-center text-[11px] font-medium text-text-primary">
                        {(page - 1) * perPage + idx + 1}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                          {item.contractor_code}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-text-primary text-[12px] truncate" title={item.contractor_name}>
                            {item.contractor_name}
                          </span>
                          <span className="text-[10px] text-primary truncate font-medium">
                            {item.subcontractor_type_label}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="block text-[11px] text-text-secondary font-mono">
                          {item.phone ? `📞 ${item.phone}` : '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge
                          variant="success"
                          className="text-[9px] font-bold uppercase tracking-wider h-5 px-2 inline-flex items-center"
                        >
                          Active
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
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
            <div className="py-8 text-center text-xs text-text-muted">Loading subcontractors from database...</div>
          ) : pagedData.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-muted">No subcontractors found.</div>
          ) : (
            pagedData.map((item) => (
              <div key={item.id} className="bg-surface border border-border rounded-lg p-3.5 shadow-xs space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-[10px] font-bold text-primary block mb-0.5">{item.contractor_code}</span>
                    <h4 className="font-semibold text-text-primary text-[13px] leading-snug">{item.contractor_name}</h4>
                    <span className="text-[11px] text-primary font-medium">{item.subcontractor_type_label}</span>
                  </div>
                  <Badge
                    variant="success"
                    className="text-[9px] font-bold uppercase tracking-wider h-5 px-2 inline-flex items-center shrink-0"
                  >
                    Active
                  </Badge>
                </div>

                <div className="text-xs pt-1 border-t border-border/60 text-text-secondary font-mono">
                  <span className="block text-[10px] uppercase font-bold text-text-muted mb-1 font-sans">Contact</span>
                  {item.phone || 'No number provided'}
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-border/60 gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-[11px] px-3" onClick={() => handleOpenEdit(item)}>
                    <Edit className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-[11px] px-3 text-red-500 hover:text-red-600 border-border" onClick={() => setDeletingItem(item)}>
                    <Trash2 className="w-3 h-3 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            )))}
          {/* Mobile Pagination */}
          <div className="pt-2">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={filteredData.length}
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
          icon={Users}
          title={editingItem ? 'Edit Subcontractor' : 'Add New Subcontractor'}
          subtitle="Onboard a new subcontractor to the master registry."
          onClose={() => {
            setIsAddOpen(false);
            setEditingItem(null);
          }}
        />
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <EntityEditModal.Body>
            <EntityEditModal.Section title="Contractor Information">
              <EntityEditModal.Grid>
                <FormField label="Contractor Name" error={errors.contractor_name} required>
                  <Input
                    placeholder="Enter full name"
                    value={form.contractor_name}
                    onChange={(e) => handleFormChange('contractor_name', e.target.value)}
                  />
                </FormField>

                <FormField label="Phone Number (Optional)" error={errors.phone}>
                  <Input
                    placeholder="e.g. +91 9876543210"
                    value={form.phone}
                    onChange={(e) => handleFormChange('phone', e.target.value)}
                  />
                </FormField>

                <div className="sm:col-span-2">
                  <FormField label="Subcontractor Type" error={errors.subcontractor_type_id} required>
                    <SearchableSelect
                      options={typeOptions}
                      placeholder="Search and select type..."
                      value={form.subcontractor_type_id}
                      onChange={(val) => handleFormChange('subcontractor_type_id', val)}
                    />
                  </FormField>
                </div>
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
              {submitting ? 'Saving...' : editingItem ? 'Save Changes' : 'Add Subcontractor'}
            </Button>
          </EntityEditModal.Footer>
        </form>
      </EntityEditModal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingItem}
        title="Delete Subcontractor"
        message={`Are you sure you want to delete ${deletingItem?.contractor_name}? This action cannot be undone.`}
        confirmLabel="Delete"
        isDestructive
        onConfirm={confirmDelete}
        onCancel={() => setDeletingItem(null)}
      />
    </PageContainer>
  );
}
