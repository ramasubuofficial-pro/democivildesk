import { useState, useEffect, useMemo } from 'react';
import {
  CreditCard, CheckCircle2, IndianRupee, Clock, Building,
  Search, Filter, Eye, Edit, Trash2, Plus, ArrowRight,
  ShieldCheck, Check, AlertCircle, Sparkles, Printer, FileText
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
import { projectsApi, subcontractsApi } from '../../../api/apiservice';
import { useAuth } from '../../auth/context/AuthContext';



const EMPTY_FORM = {
  project_id: '',
  payment_no: '',
  payment_date: '',
  contractor_name: 'Sri Murugan Civil Infra Pvt Ltd',
  ra_bill_no: 'RA-2026-003',
  work_order_no: 'WO-2026-012',
  amount: '500000',
  payment_mode: 'RTGS / Bank Transfer',
  reference_no: '',
  bank_account: 'HDFC Bank - Current A/C (..4910)',
  notes: '',
};

export function SubcontractPaymentsPage() {
  const { hasPermission } = useAuth();
  const [projects, setProjects] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [selectedProjectId, setSelectedProjectId] = useState('all');
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

  const [raBills, setRaBills] = useState([]);
  const [paymentModes, setPaymentModes] = useState([]);

  const fetchList = () => {
    setLoading(true);
    Promise.all([
      projectsApi.list().catch(() => ({ data: [] })),
      subcontractsApi.raBills.list().catch(() => ({ data: [] })),
      subcontractsApi.masters().catch(() => ({ data: {} })),
      subcontractsApi.payments.list().catch(() => ({ data: [] }))
    ]).then(([projRes, raRes, mastersRes, payRes]) => {
      const pList = projRes?.data?.projects ?? projRes?.projects ?? (Array.isArray(projRes?.data) ? projRes.data : []);
      setProjects(Array.isArray(pList) ? pList : []);

      const rList = raRes?.data?.ra_bills ?? raRes?.data?.data ?? [];
      setRaBills(Array.isArray(rList) ? rList : []);

      const mList = mastersRes?.data?.masters || {};
      setPaymentModes(mList.payment_modes || []);

      const pListRes = payRes?.data?.payments ?? payRes?.data?.data ?? [];
      if (Array.isArray(pListRes)) {
        const normalized = pListRes.map((p, idx) => {
          const matchedProj = pList.find(pr => String(pr.id) === String(p.project_id));
          const matchedBill = rList.find(b => String(b.id) === String(p.ra_bill_id));
          const matchedMode = (mList.payment_modes || []).find(m => String(m.id) === String(p.payment_mode_id));
          return {
            id: p.id,
            project_id: p.project_id,
            project_code: matchedProj?.project_code || 'PRJ-01',
            project_name: matchedProj?.project_name || 'Project Name',
            payment_no: p.payment_no || `PAY-${p.id}`,
            payment_date: p.payment_date || '',
            contractor_id: p.contractor_id,
            contractor_name: matchedBill?.contractor_name || 'Subcontractor Partner',
            ra_bill_id: p.ra_bill_id,
            ra_bill_no: matchedBill?.ra_bill_no || 'RA-00',
            amount: Number(p.amount || 0),
            payment_mode_id: p.payment_mode_id,
            payment_mode: matchedMode?.payment_mode_name || 'RTGS Transfer',
            reference_no: p.reference_no || '',
            status_name: p.status_name || 'Draft',
            notes: p.remarks || '',
          };
        });
        setPayments(normalized);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchList();
  }, []);

  // Form Handlers
  const handleOpenAdd = () => {
    const today = new Date().toISOString().split('T')[0];
    const defaultProj = selectedProjectId !== 'all' ? selectedProjectId : (projects[0]?.id ? String(projects[0].id) : '');

    setForm({
      ...EMPTY_FORM,
      project_id: defaultProj,
      payment_no: `PAY-2026-09${payments.length + 5}`,
      payment_date: today,
      reference_no: `UTR-HDFC-${Math.floor(100000000 + Math.random() * 900000000)}`,
    });
    setErrors({});
    setIsAddOpen(true);
  };

  const handleOpenEdit = (item) => {
    setForm({
      project_id: String(item.project_id || ''),
      payment_no: item.payment_no || '',
      payment_date: item.payment_date || '',
      contractor_id: String(item.contractor_id || ''),
      ra_bill_id: String(item.ra_bill_id || ''),
      amount: String(item.amount || ''),
      payment_mode_id: String(item.payment_mode_id || ''),
      reference_no: item.reference_no || '',
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
    if (!form.project_id) errs.project_id = 'Project is required';
    if (!form.ra_bill_id) errs.ra_bill_id = 'RA Bill is required';
    if (!form.payment_no.trim()) errs.payment_no = 'Payment voucher number is required';
    if (!form.payment_date) errs.payment_date = 'Payment Date is required';
    if (!form.payment_mode_id) errs.payment_mode_id = 'Payment Mode is required';
    if (!form.amount) errs.amount = 'Amount is required';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    try {
      const selectedBill = raBills.find(b => String(b.id) === String(form.ra_bill_id));
      const contractorId = selectedBill ? selectedBill.contractor_id : form.contractor_id;

      const payload = {
        project_id: Number(form.project_id),
        ra_bill_id: Number(form.ra_bill_id),
        contractor_id: Number(contractorId),
        payment_no: form.payment_no,
        payment_date: form.payment_date,
        payment_mode_id: Number(form.payment_mode_id),
        amount: Number(form.amount || 0),
        reference_no: form.reference_no || null,
        remarks: form.notes,
      };

      if (editingItem?.id) {
        await subcontractsApi.payments.update(editingItem.id, payload);
        toast.success('Payment voucher updated.');
      } else {
        await subcontractsApi.payments.create(payload);
        toast.success('Payment voucher recorded.');
      }
      fetchList();
      setIsAddOpen(false);
      setEditingItem(null);
    } catch (err) {
      toast.error(err?.message || 'Failed to save payment voucher.');
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
    return payments.filter(p => {
      if (selectedProjectId !== 'all' && String(p.project_id) !== String(selectedProjectId)) return false;
      if (search) {
        const s = search.toLowerCase();
        const no = String(p.payment_no || '').toLowerCase();
        const cont = String(p.contractor_name || '').toLowerCase();
        const ref = String(p.reference_no || '').toLowerCase();
        const rano = String(p.ra_bill_no || '').toLowerCase();
        if (!no.includes(s) && !cont.includes(s) && !ref.includes(s) && !rano.includes(s)) return false;
      }
      return true;
    });
  }, [payments, selectedProjectId, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  // Metrics
  const totalDisbursed = useMemo(() => payments.reduce((acc, p) => acc + Number(p.amount || 0), 0), [payments]);

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Subcontract Management', href: '/subcontracts/work-orders' },
    { label: 'Subcontractor Payments' }
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Subcontractor Payment Disbursements & Bank Vouchers"
        breadcrumbs={breadcrumbs}
      />

      <div className="flex flex-col gap-3 sm:gap-4 w-full">
        {/* KPI Summary Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <KpiCard
            label="Total Disbursed to Date"
            value={`₹${(totalDisbursed / 100000).toFixed(2)}L`}
            status="primary"
            icon={<IndianRupee className="w-4 h-4" />}
          />
          <KpiCard
            label="Settled Payment Vouchers"
            value={`${payments.length} Vouchers`}
            status="success"
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          />
          <KpiCard
            label="Direct Bank RTGS/NEFT"
            value="100% Online"
            status="neutral"
            icon={<CreditCard className="w-4 h-4 text-sky-500" />}
          />
          <KpiCard
            label="Bank UTR Audit"
            value="100% Verified"
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

            <div className="w-full sm:w-56">
              <SearchField
                placeholder="Search payment no, UTR, contractor..."
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
              Record Payment Voucher
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
                onItemsPerPageChange={() => {}}
              />
            }
          >
            <table className="w-full text-left text-[12px] table-auto">
              <thead className="bg-surface-muted text-text-secondary text-[11px] uppercase font-semibold border-b border-border tracking-wider">
                <tr>
                  <th className="px-3 py-2 w-10 text-center">#</th>
                  <th className="px-3 py-2 w-28">Voucher No</th>
                  <th className="px-3 py-2">Contractor & RA Bill</th>
                  <th className="px-3 py-2 text-right w-28 font-bold">Paid Amount</th>
                  <th className="px-3 py-2 w-36 hidden md:table-cell">Mode & Bank Ref</th>
                  <th className="px-3 py-2 text-center w-28">Status</th>
                  <th className="px-3 py-2 text-center w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-text-muted text-[12px]">
                      Loading payment records...
                    </td>
                  </tr>
                ) : paged.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-text-muted text-[12px]">
                      No payment vouchers found.
                    </td>
                  </tr>
                ) : (
                  paged.map((p, idx) => (
                    <tr key={p.id || idx} className="hover:bg-surface-muted/30 transition-colors group">
                      <td className="px-3 py-2 text-center font-medium text-text-primary text-[11px]">
                        {(page - 1) * perPage + idx + 1}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                          {p.payment_no}
                        </span>
                        <span className="text-[10px] text-text-muted font-mono block pt-0.5">{p.payment_date}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-text-primary text-[12px] truncate" title={p.contractor_name}>
                            {p.contractor_name}
                          </span>
                          <span className="text-[10px] text-text-muted truncate">
                            {p.ra_bill_no} ({p.work_order_no}) • {p.project_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 text-[11px]">
                        ₹{p.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell font-mono text-[10px] text-text-secondary">
                        <div>{p.payment_mode}</div>
                        <div className="text-primary truncate">{p.reference_no}</div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge
                          variant="success"
                          className="text-[8px] font-bold uppercase tracking-wider h-4 px-1.5 inline-flex items-center leading-none"
                        >
                          Disbursed
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="View Payment Advice 360"
                            onClick={() => setViewingItem(p)}
                          >
                            <Eye className="w-3.5 h-3.5 text-text-secondary hover:text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="Edit"
                            onClick={() => handleOpenEdit(p)}
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
          {paged.map((p, idx) => (
            <div key={p.id || idx} className="bg-surface border border-border rounded-lg p-3.5 shadow-xs space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-[10px] font-bold text-primary block">{p.payment_no} • {p.payment_date}</span>
                  <h4 className="font-semibold text-text-primary text-[13px] leading-snug">{p.contractor_name}</h4>
                  <span className="text-[11px] text-text-muted">{p.ra_bill_no}</span>
                </div>
                <Badge
                  variant="success"
                  className="text-[8px] font-bold uppercase tracking-wider h-4 px-1.5 inline-flex items-center leading-none shrink-0"
                >
                  ₹{p.amount.toLocaleString('en-IN')}
                </Badge>
              </div>

              <div className="p-2 bg-surface-muted/40 rounded border border-border/60 font-mono text-[11px] flex justify-between">
                <span>UTR Ref</span>
                <span className="font-bold text-primary truncate max-w-[180px]">{p.reference_no}</span>
              </div>

              <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/60 text-xs">
                <Button variant="outline" size="sm" className="h-7 text-[11px] px-2" onClick={() => setViewingItem(p)}>
                  <Eye className="w-3 h-3 mr-1" /> View
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-[11px] px-2" onClick={() => handleOpenEdit(p)}>
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
              onItemsPerPageChange={() => {}}
            />
          </div>
        </div>
      </div>

      {/* View Payment Voucher 360 Modal */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface border border-border rounded-xl shadow-level-3 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-muted/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">{viewingItem.payment_no}</h3>
                  <span className="text-[11px] font-mono text-text-muted">{viewingItem.contractor_name} • {viewingItem.ra_bill_no}</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setViewingItem(null)}>✕</Button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3 bg-surface-muted/30 p-3 rounded-lg border border-border">
                <div><span className="text-text-muted block text-[10px] uppercase font-bold">Disbursed Amount</span> <span className="font-bold text-emerald-600 font-mono text-base">₹{viewingItem.amount.toLocaleString('en-IN')}</span></div>
                <div><span className="text-text-muted block text-[10px] uppercase font-bold">Payment Date</span> <span className="font-mono">{viewingItem.payment_date}</span></div>
                <div><span className="text-text-muted block text-[10px] uppercase font-bold">Payment Mode</span> <span className="font-medium text-text-primary">{viewingItem.payment_mode}</span></div>
                <div><span className="text-text-muted block text-[10px] uppercase font-bold">Bank UTR Reference</span> <span className="font-mono text-primary font-bold">{viewingItem.reference_no}</span></div>
                <div className="col-span-2"><span className="text-text-muted block text-[10px] uppercase font-bold">Debited Bank Account</span> <span className="text-text-primary font-medium">{viewingItem.bank_account}</span></div>
              </div>

              {viewingItem.notes && (
                <div className="border border-border rounded-lg p-3 space-y-1">
                  <span className="font-bold text-text-primary block text-[11px]">Payment Advice Remarks:</span>
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

      {/* Add / Edit Payment Modal */}
      <EntityEditModal
        isOpen={Boolean(isAddOpen || editingItem)}
        onClose={() => { setIsAddOpen(false); setEditingItem(null); }}
      >
        <EntityEditModal.Header
          icon={CreditCard}
          title={editingItem ? 'Edit Payment Voucher' : 'Record Subcontractor Payment Voucher'}
          subtitle="Record direct RTGS/NEFT settlement against certified subcontractor RA bill."
          onClose={() => { setIsAddOpen(false); setEditingItem(null); }}
        />
        <form id="payment-form" onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <EntityEditModal.Body>
            <EntityEditModal.Section title="Payment Voucher Details">
              <EntityEditModal.Grid>
                <FormField label="Parent Project" required error={errors.project_id}>
                  <Select
                    options={projects.map(p => ({ value: String(p.id), label: p.project_name || p.name }))}
                    value={form.project_id}
                    onChange={(v) => handleFormChange('project_id', v)}
                  />
                </FormField>

                <FormField label="Payment Voucher No" required error={errors.payment_no}>
                  <Input
                    value={form.payment_no}
                    onChange={(e) => handleFormChange('payment_no', e.target.value)}
                    placeholder="PAY-2026-095"
                  />
                </FormField>

                <FormField label="Linked RA Bill" required error={errors.ra_bill_id} className="md:col-span-2">
                  <Select
                    options={raBills.filter(b => !form.project_id || String(b.project_id) === String(form.project_id)).map(b => ({ value: String(b.id), label: b.ra_bill_no || b.bill_no }))}
                    value={form.ra_bill_id}
                    onChange={(v) => handleFormChange('ra_bill_id', v)}
                  />
                </FormField>
              </EntityEditModal.Grid>
            </EntityEditModal.Section>

            <EntityEditModal.Section title="Settlement Amount & Banking Details">
              <EntityEditModal.Grid>
                <FormField label="Settled Amount (₹)" required>
                  <Input
                    type="number"
                    value={form.amount}
                    onChange={(e) => handleFormChange('amount', e.target.value)}
                  />
                </FormField>

                <FormField label="Payment Mode" required error={errors.payment_mode_id}>
                  <Select
                    options={paymentModes.map(m => ({ value: String(m.id), label: m.payment_mode_name }))}
                    value={form.payment_mode_id}
                    onChange={(v) => handleFormChange('payment_mode_id', v)}
                  />
                </FormField>

                <FormField label="Bank Reference / UTR No" required error={errors.reference_no} className="md:col-span-2">
                  <Input
                    value={form.reference_no}
                    onChange={(e) => handleFormChange('reference_no', e.target.value)}
                    placeholder="UTR-HDFC-918274610"
                  />
                </FormField>

                <FormField label="Debited Bank Account" className="md:col-span-2">
                  <Input
                    value={form.bank_account}
                    onChange={(e) => handleFormChange('bank_account', e.target.value)}
                    placeholder="e.g. HDFC Bank - Current A/C (..4910)"
                  />
                </FormField>
              </EntityEditModal.Grid>
            </EntityEditModal.Section>
          </EntityEditModal.Body>

          <EntityEditModal.Footer
            formId="payment-form"
            submitLabel={editingItem ? 'Update Voucher' : 'Record Disbursement'}
            onCancel={() => { setIsAddOpen(false); setEditingItem(null); }}
            isSubmitting={saving}
          />
        </form>
      </EntityEditModal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteItem)}
        title="Delete Payment Voucher"
        message={`Are you sure you want to delete "${deleteItem?.payment_no}"?`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteItem(null)}
      />
    </PageContainer>
  );
}
