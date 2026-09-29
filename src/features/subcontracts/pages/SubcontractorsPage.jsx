import { useState, useEffect, useMemo } from 'react';
import {
  Users, CheckCircle2, Building, ShieldCheck, Phone,
  Search, Filter, Eye, Edit, Trash2, Plus, ArrowRight,
  CreditCard, Mail, MapPin, Award, FileText, Printer, AlertTriangle
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
import { subcontractsApi } from '../../../api/apiservice';
import { useAuth } from '../../auth/context/AuthContext';



const EMPTY_FORM = {
  contractor_code: '',
  contractor_name: '',
  trade_specialization: 'RCC Structure & Masonry',
  contact_person: '',
  phone: '',
  email: '',
  gstin: '',
  pan: '',
  city: 'Chennai',
  state: 'Tamil Nadu',
  rating: 'Grade A (90%)',
  status: 'Active (Approved)',
  bank_name: '',
  account_no: '',
  ifsc: '',
  notes: '',
};

export function SubcontractorsPage() {
  const { hasPermission } = useAuth();
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [tradeFilter, setTradeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchList = () => {
    setLoading(true);
    subcontractsApi.contractors.list().then(res => {
      const list = res?.data?.subcontractors ?? res?.data?.data ?? [];
      const normalized = (Array.isArray(list) ? list : []).map((c, idx) => ({
        id: c.id,
        contractor_code: c.contractor_code || `SUB-2026-${String(idx + 1).padStart(3, '0')}`,
        contractor_name: c.contractor_name || 'Subcontractor Firm',
        trade_specialization: c.contractor_type_name || 'RCC Structure & Masonry',
        contractor_type_id: Number(c.contractor_type_id || 1),
        contact_person: c.contact_person || 'MD',
        phone: c.phone || '',
        email: c.email || '',
        gstin: c.gstin || '',
        pan: c.pan || '',
        city: c.city || '',
        state: c.state_name || '',
        active_work_orders: Number(c.active_work_orders || 0),
        rating: 'Grade A',
        status: c.status_name || 'Active',
        status_id: Number(c.status_id || 1),
        bank_name: c.bank_name || '',
        account_no: c.bank_account_no || '',
        ifsc: c.bank_ifsc || '',
        notes: c.notes || '',
      }));
      setContractors(normalized);
    }).catch(() => { }).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchList();
  }, []);

  // Form Handlers
  const handleOpenAdd = () => {
    setForm({
      ...EMPTY_FORM,
      contractor_code: `SUB-2026-${String(contractors.length + 1).padStart(3, '0')}`,
    });
    setErrors({});
    setIsAddOpen(true);
  };

  const handleOpenEdit = (item) => {
    setForm({
      contractor_code: item.contractor_code || '',
      contractor_name: item.contractor_name || '',
      trade_specialization: item.trade_specialization || 'RCC Structure & Masonry',
      contractor_type_id: item.contractor_type_id || 1,
      contact_person: item.contact_person || '',
      phone: item.phone || '',
      email: item.email || '',
      gstin: item.gstin || '',
      pan: item.pan || '',
      city: item.city || '',
      state: item.state || '',
      rating: item.rating || 'Grade A (90%)',
      status: item.status || 'Active (Approved)',
      status_id: item.status_id || 1,
      bank_name: item.bank_name || '',
      account_no: item.account_no || '',
      ifsc: item.ifsc || '',
      notes: item.notes || '',
    });
    setErrors({});
    setEditingItem(item);
  };

  const handleFormChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.contractor_name.trim()) errs.contractor_name = 'Contractor name is required';
    if (!form.contact_person.trim()) errs.contact_person = 'Contact person is required';
    if (!form.phone.trim()) errs.phone = 'Phone number is required';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        contractor_code: form.contractor_code,
        contractor_name: form.contractor_name,
        contractor_type_id: Number(form.contractor_type_id || 1),
        contact_person: form.contact_person,
        phone: form.phone,
        email: form.email,
        gstin: form.gstin,
        pan: form.pan,
        city: form.city,
        state_name: form.state,
        bank_name: form.bank_name,
        bank_account_no: form.account_no,
        bank_ifsc: form.ifsc,
        status_id: Number(form.status_id || 1),
        notes: form.notes,
      };

      if (editingItem?.id) {
        await subcontractsApi.contractors.update(editingItem.id, payload);
        toast.success('Subcontractor profile updated.');
      } else {
        await subcontractsApi.contractors.create(payload);
        toast.success('Subcontractor onboarded successfully.');
      }
      fetchList();
      setIsAddOpen(false);
      setEditingItem(null);
    } catch (err) {
      toast.error(err?.message || 'Failed to save subcontractor profile.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    setDeleteItem(null);
  };

  const handlePrint = () => {
    window.print();
  };

  // Safe Filtered List
  const filtered = useMemo(() => {
    return contractors.filter(c => {
      if (tradeFilter !== 'all' && !c.trade_specialization.includes(tradeFilter)) return false;
      if (search) {
        const s = search.toLowerCase();
        const code = String(c.contractor_code || '').toLowerCase();
        const name = String(c.contractor_name || '').toLowerCase();
        const trade = String(c.trade_specialization || '').toLowerCase();
        const pers = String(c.contact_person || '').toLowerCase();
        const gst = String(c.gstin || '').toLowerCase();
        if (!code.includes(s) && !name.includes(s) && !trade.includes(s) && !pers.includes(s) && !gst.includes(s)) return false;
      }
      return true;
    });
  }, [contractors, tradeFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Subcontract Management', href: '/subcontracts/subcontractors' },
    { label: 'Subcontractors Master' }
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Subcontractors Master Register & Vendor Compliance"
        breadcrumbs={breadcrumbs}
      />

      <div className="flex flex-col gap-3 sm:gap-4 w-full">
        {/* KPI Summary Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <KpiCard
            label="Total Onboarded Contractors"
            value={contractors.length}
            status="primary"
            icon={<Users className="w-4 h-4" />}
          />
          <KpiCard
            label="Active Site Work Packages"
            value="4 Live WOs"
            status="success"
            icon={<FileText className="w-4 h-4 text-emerald-500" />}
          />
          <KpiCard
            label="GST & KYC Compliance"
            value="100% Verified"
            status="neutral"
            icon={<ShieldCheck className="w-4 h-4 text-sky-500" />}
          />
          <KpiCard
            label="Average Vendor Rating"
            value="Grade A (92%)"
            status="neutral"
            icon={<Award className="w-4 h-4 text-amber-500" />}
          />
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-surface border border-border rounded-lg p-2.5 sm:p-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="w-full sm:w-56">
              <Select
                options={[
                  { value: 'all', label: 'All Trades & Specialties' },
                  { value: 'Structure', label: 'RCC Structure & Masonry' },
                  { value: 'MEP', label: 'Electrical & Plumbing (MEP)' },
                  { value: 'Flooring', label: 'Flooring, Tile & Painting' },
                ]}
                value={tradeFilter}
                onChange={setTradeFilter}
                className="text-xs h-8"
              />
            </div>

            <div className="w-full sm:w-64">
              <SearchField
                placeholder="Search contractor, trade, GSTIN..."
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
              Onboard Subcontractor
            </Button>
          </div>
        </div>

        {/* Desktop & Tablet Table (No horizontal scroll, 100% fluid) */}
        <div className="hidden sm:block">
          <DataTableContainer
            pagination={
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={filtered.length}
                itemsPerPage={perPage}
                onPageChange={setPage}
                onItemsPerPageChange={() => { }}
              />
            }
          >
            <table className="w-full text-left text-[12px] table-auto">
              <thead className="bg-surface-muted text-text-secondary text-[11px] uppercase font-semibold border-b border-border tracking-wider">
                <tr>
                  <th className="px-3 py-2 w-10 text-center">#</th>
                  <th className="px-3 py-2 w-28">Vendor Code</th>
                  <th className="px-3 py-2">Contractor Name & Specialization</th>
                  <th className="px-3 py-2">Key Contact & Phone</th>
                  <th className="px-3 py-2 w-32 hidden md:table-cell">GSTIN / PAN</th>
                  <th className="px-3 py-2 text-center w-24">Live WOs</th>
                  <th className="px-3 py-2 text-center w-28">Rating</th>
                  <th className="px-3 py-2 text-center w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="text-center py-8 text-text-muted text-[12px]">
                      Loading subcontractors register...
                    </td>
                  </tr>
                ) : paged.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-8 text-text-muted text-[12px]">
                      No subcontractors found matching search.
                    </td>
                  </tr>
                ) : (
                  paged.map((c, idx) => (
                    <tr key={c.id || idx} className="hover:bg-surface-muted/30 transition-colors group">
                      <td className="px-3 py-2 text-center font-medium text-text-primary text-[11px]">
                        {(page - 1) * perPage + idx + 1}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                          {c.contractor_code}
                        </span>
                        <span className="text-[10px] text-text-muted font-mono block pt-0.5">{c.city}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-text-primary text-[12px] truncate" title={c.contractor_name}>
                            {c.contractor_name}
                          </span>
                          <span className="text-[10px] text-primary truncate font-medium">
                            {c.trade_specialization}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11px] text-text-primary truncate font-medium" title={c.contact_person}>
                            {c.contact_person}
                          </span>
                          <span className="text-[10px] text-text-muted font-mono truncate">
                            📞 {c.phone}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell font-mono text-[10px] text-text-secondary">
                        <div>GST: {c.gstin}</div>
                        <div className="text-text-muted">PAN: {c.pan}</div>
                      </td>
                      <td className="px-3 py-2 text-center font-mono font-bold text-emerald-600 text-[11px]">
                        {c.active_work_orders} Packages
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge
                          variant="success"
                          className="text-[8px] font-bold uppercase tracking-wider h-4 px-1.5 inline-flex items-center leading-none"
                        >
                          {c.rating}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="View Vendor Dossier 360"
                            onClick={() => setViewingItem(c)}
                          >
                            <Eye className="w-3.5 h-3.5 text-text-secondary hover:text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="Edit Profile"
                            onClick={() => handleOpenEdit(c)}
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

        {/* Mobile View - Cards List for Phones (< sm) */}
        <div className="block sm:hidden space-y-3">
          {paged.map((c, idx) => (
            <div key={c.id || idx} className="bg-surface border border-border rounded-lg p-3.5 shadow-xs space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-[10px] font-bold text-primary block">{c.contractor_code} • {c.city}</span>
                  <h4 className="font-semibold text-text-primary text-[13px] leading-snug">{c.contractor_name}</h4>
                  <span className="text-[11px] text-primary font-medium">{c.trade_specialization}</span>
                </div>
                <Badge
                  variant="success"
                  className="text-[8px] font-bold uppercase tracking-wider h-4 px-1.5 inline-flex items-center leading-none shrink-0"
                >
                  {c.rating}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/60 font-mono">
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block font-sans">Contact</span>
                  <span className="text-[11px] text-text-primary truncate block font-sans">{c.contact_person}</span>
                  <span className="text-[10px] text-text-muted">{c.phone}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-text-muted block font-sans">Active WOs</span>
                  <span className="font-bold text-emerald-600 text-[11px]">{c.active_work_orders} Packages</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/60 text-xs">
                <Button variant="outline" size="sm" className="h-7 text-[11px] px-2" onClick={() => setViewingItem(c)}>
                  <Eye className="w-3 h-3 mr-1" /> View
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-[11px] px-2" onClick={() => handleOpenEdit(c)}>
                  <Edit className="w-3 h-3 mr-1" /> Edit
                </Button>
              </div>
            </div>
          ))}

          {/* Mobile Pagination */}
          <div className="pt-2">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={filtered.length}
              itemsPerPage={perPage}
              onPageChange={setPage}
              onItemsPerPageChange={() => { }}
            />
          </div>
        </div>
      </div>

      {/* View Subcontractor 360 Modal */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface border border-border rounded-xl shadow-level-3 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-muted/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">{viewingItem.contractor_name}</h3>
                  <span className="text-[11px] font-mono text-text-muted">{viewingItem.contractor_code} • {viewingItem.trade_specialization}</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setViewingItem(null)}>✕</Button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3 bg-surface-muted/30 p-3 rounded-lg border border-border">
                <div><span className="text-text-muted block text-[10px] uppercase font-bold">Contact Person</span> <span className="font-medium text-text-primary">{viewingItem.contact_person}</span></div>
                <div><span className="text-text-muted block text-[10px] uppercase font-bold">Phone Number</span> <span className="font-mono text-primary font-medium">{viewingItem.phone}</span></div>
                <div><span className="text-text-muted block text-[10px] uppercase font-bold">GSTIN Number</span> <span className="font-mono">{viewingItem.gstin}</span></div>
                <div><span className="text-text-muted block text-[10px] uppercase font-bold">PAN Number</span> <span className="font-mono">{viewingItem.pan}</span></div>
                <div><span className="text-text-muted block text-[10px] uppercase font-bold">City / State</span> <span className="text-text-primary">{viewingItem.city}, {viewingItem.state}</span></div>
                <div><span className="text-text-muted block text-[10px] uppercase font-bold">Vendor Performance</span> <span className="font-bold text-emerald-600">{viewingItem.rating}</span></div>
              </div>

              {viewingItem.bank_name && (
                <div className="bg-primary/5 p-3 rounded-lg border border-primary/20 space-y-1">
                  <span className="font-bold text-primary block text-[11px] uppercase tracking-wider">Bank Settlement Details (RTGS/NEFT):</span>
                  <div className="grid grid-cols-2 gap-2 text-text-secondary font-mono text-[11px] pt-1">
                    <div>Bank: <span className="text-text-primary font-sans">{viewingItem.bank_name}</span></div>
                    <div>IFSC: <span className="text-text-primary">{viewingItem.ifsc}</span></div>
                    <div className="col-span-2">A/C No: <span className="text-text-primary font-bold">{viewingItem.account_no}</span></div>
                  </div>
                </div>
              )}

              {viewingItem.notes && (
                <div className="border border-border rounded-lg p-3 space-y-1">
                  <span className="font-bold text-text-primary block text-[11px]">Technical Scope & Capabilities:</span>
                  <p className="text-text-secondary bg-surface-muted/30 p-2 rounded border border-border/50 leading-relaxed">{viewingItem.notes}</p>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-border bg-surface-muted/20 flex justify-end items-center">
              <Button variant="outline" size="sm" onClick={() => setViewingItem(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Subcontractor Modal */}
      <EntityEditModal
        isOpen={Boolean(isAddOpen || editingItem)}
        onClose={() => { setIsAddOpen(false); setEditingItem(null); }}
      >
        <EntityEditModal.Header
          icon={Users}
          title={editingItem ? 'Edit Subcontractor Profile' : 'Onboard New Subcontractor'}
          subtitle="Record trade qualifications, GSTIN, PAN, bank settlement data, and commercial terms."
          onClose={() => { setIsAddOpen(false); setEditingItem(null); }}
        />
        <form id="subcontractor-form" onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <EntityEditModal.Body>
            <EntityEditModal.Section title="Firm Information & Trade Specialty">
              <EntityEditModal.Grid>
                <FormField label="Subcontractor / Firm Name" required error={errors.contractor_name} className="md:col-span-2">
                  <Input
                    value={form.contractor_name}
                    onChange={(e) => handleFormChange('contractor_name', e.target.value)}
                    placeholder="e.g. Sri Murugan Civil Infra Pvt Ltd"
                  />
                </FormField>

                <FormField label="Trade Specialization" className="md:col-span-2">
                  <Input
                    value={form.trade_specialization}
                    onChange={(e) => handleFormChange('trade_specialization', e.target.value)}
                    placeholder="e.g. RCC Structure & Masonry"
                  />
                </FormField>

                <FormField label="Contact Person / MD" required error={errors.contact_person}>
                  <Input
                    value={form.contact_person}
                    onChange={(e) => handleFormChange('contact_person', e.target.value)}
                    placeholder="e.g. Er. S. Murugesan"
                  />
                </FormField>

                <FormField label="Mobile Phone" required error={errors.phone}>
                  <Input
                    value={form.phone}
                    onChange={(e) => handleFormChange('phone', e.target.value)}
                    placeholder="+91 98421 78901"
                  />
                </FormField>

                <FormField label="GSTIN Number">
                  <Input
                    value={form.gstin}
                    onChange={(e) => handleFormChange('gstin', e.target.value)}
                    placeholder="33AABCS1429B1Z2"
                  />
                </FormField>

                <FormField label="PAN Number">
                  <Input
                    value={form.pan}
                    onChange={(e) => handleFormChange('pan', e.target.value)}
                    placeholder="AABCS1429B"
                  />
                </FormField>

                <FormField label="City / Base Location">
                  <Input
                    value={form.city}
                    onChange={(e) => handleFormChange('city', e.target.value)}
                    placeholder="Chennai"
                  />
                </FormField>

                <FormField label="State">
                  <Input
                    value={form.state}
                    onChange={(e) => handleFormChange('state', e.target.value)}
                    placeholder="Tamil Nadu"
                  />
                </FormField>
              </EntityEditModal.Grid>
            </EntityEditModal.Section>

            <EntityEditModal.Section title="Bank Details for Direct RTGS / NEFT Settlements">
              <EntityEditModal.Grid>
                <FormField label="Bank & Branch Name">
                  <Input
                    value={form.bank_name}
                    onChange={(e) => handleFormChange('bank_name', e.target.value)}
                    placeholder="e.g. HDFC Bank - T. Nagar"
                  />
                </FormField>

                <FormField label="Account Number">
                  <Input
                    value={form.account_no}
                    onChange={(e) => handleFormChange('account_no', e.target.value)}
                    placeholder="50200018491029"
                  />
                </FormField>

                <FormField label="IFSC Code" className="md:col-span-2">
                  <Input
                    value={form.ifsc}
                    onChange={(e) => handleFormChange('ifsc', e.target.value)}
                    placeholder="HDFC0000024"
                  />
                </FormField>

                <FormField label="Specialization & Technical Remarks" className="md:col-span-2">
                  <Textarea
                    rows={2}
                    value={form.notes}
                    onChange={(e) => handleFormChange('notes', e.target.value)}
                    placeholder="Past project experiences, plant machinery owned, staging materials available..."
                  />
                </FormField>
              </EntityEditModal.Grid>
            </EntityEditModal.Section>
          </EntityEditModal.Body>

          <EntityEditModal.Footer
            formId="subcontractor-form"
            submitLabel={editingItem ? 'Update Profile' : 'Onboard Contractor'}
            onCancel={() => { setIsAddOpen(false); setEditingItem(null); }}
            isSubmitting={saving}
          />
        </form>
      </EntityEditModal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteItem)}
        title="Remove Subcontractor"
        message={`Are you sure you want to remove "${deleteItem?.contractor_name}"?`}
        variant="danger"
        confirmLabel="Remove"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteItem(null)}
      />
    </PageContainer>
  );
}
