import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard, CheckCircle2, IndianRupee, Clock, Building2,
  Search, Filter, Eye, Edit, Trash2, Plus, ArrowRight,
  ShieldCheck, Check, AlertCircle, Sparkles, Printer, FileText,
  Calendar, Users, DollarSign, ArrowUpRight, CheckSquare,
  ChevronDown, ExternalLink, X, RefreshCw
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

const LOCAL_STORAGE_KEY = 'mock_subcontractor_weekly_payments';

const INITIAL_SEED_DATA = [
  {
    id: 'swp-001',
    voucher_no: 'SWP-2026-W36-001',
    week_number: 'Week 36 (01 Sep - 07 Sep 2026)',
    week_start: '2026-09-01',
    week_end: '2026-09-07',
    project_id: '1',
    project_name: 'Greenfield Residency - Phase 1',
    site_id: 'SITE-01',
    site_name: 'Main Residential Tower A',
    contractor_id: '1',
    contractor_name: 'Sri Murugan Civil Infra Pvt Ltd',
    trade_category: 'Brick Masonry & Plastering',
    work_order_no: 'WO-2026-012',
    total_mandays: 64,
    avg_rate_per_day: 850,
    gross_amount: 54400,
    advance_deduction: 5000,
    other_deductions: 1400,
    net_payable: 48000,
    payment_mode: 'RTGS / Bank Transfer',
    bank_account: 'HDFC Bank - Current A/C (*4910)',
    reference_no: 'UTR-HDFC-982103482',
    payment_date: '2026-09-05',
    status: 'Paid',
    prepared_by: 'Site Supervisor (Ram)',
    approved_by: 'Project Manager (K. Sundar)',
    notes: 'Weekly settlement for Block B 3rd floor masonry work gang.'
  },
  {
    id: 'swp-002',
    voucher_no: 'SWP-2026-W36-002',
    week_number: 'Week 36 (01 Sep - 07 Sep 2026)',
    week_start: '2026-09-01',
    week_end: '2026-09-07',
    project_id: '1',
    project_name: 'Greenfield Residency - Phase 1',
    site_id: 'SITE-01',
    site_name: 'Basement Parking 2',
    contractor_id: '2',
    contractor_name: 'Apex Rebar & Steel Fabricators',
    trade_category: 'Rebar Cutting & Tying',
    work_order_no: 'WO-2026-018',
    total_mandays: 48,
    avg_rate_per_day: 950,
    gross_amount: 45600,
    advance_deduction: 3000,
    other_deductions: 600,
    net_payable: 42000,
    payment_mode: 'NEFT Transfer',
    bank_account: 'ICICI Bank - Escrow A/C (*2201)',
    reference_no: 'UTR-ICIC-749102834',
    payment_date: '2026-09-05',
    status: 'Paid',
    prepared_by: 'Steel Incharge',
    approved_by: 'Project Manager (K. Sundar)',
    notes: 'Weekly wages for raft foundation rebar binding crew.'
  },
  {
    id: 'swp-003',
    voucher_no: 'SWP-2026-W36-003',
    week_number: 'Week 36 (01 Sep - 07 Sep 2026)',
    week_start: '2026-09-01',
    week_end: '2026-09-07',
    project_id: '2',
    project_name: 'Karur Commercial Plaza',
    site_id: 'SITE-081',
    site_name: 'Ajantha Theater Trichy Site',
    contractor_id: '3',
    contractor_name: 'Royal Plastering & Tiles Gang',
    trade_category: 'Tile Laying & Flooring',
    work_order_no: 'WO-2026-022',
    total_mandays: 36,
    avg_rate_per_day: 900,
    gross_amount: 32400,
    advance_deduction: 2000,
    other_deductions: 400,
    net_payable: 30000,
    payment_mode: 'RTGS / Bank Transfer',
    bank_account: 'Axis Bank - Project A/C (*7721)',
    reference_no: '',
    payment_date: '',
    status: 'Approved',
    prepared_by: 'Site Supervisor',
    approved_by: 'Commercial Head',
    notes: 'Floor tiling 1st floor corridor completed and verified.'
  },
  {
    id: 'swp-004',
    voucher_no: 'SWP-2026-W36-004',
    week_number: 'Week 36 (01 Sep - 07 Sep 2026)',
    week_start: '2026-09-01',
    week_end: '2026-09-07',
    project_id: '2',
    project_name: 'Karur Commercial Plaza',
    site_id: 'SITE-020',
    site_name: 'Commercial Complex Wing B',
    contractor_id: '4',
    contractor_name: 'Shiva Plumbing & Sanitary Works',
    trade_category: 'Plumbing & Drainage',
    work_order_no: 'WO-2026-031',
    total_mandays: 28,
    avg_rate_per_day: 850,
    gross_amount: 23800,
    advance_deduction: 0,
    other_deductions: 800,
    net_payable: 23000,
    payment_mode: 'UPI / IMPS',
    bank_account: 'HDFC Bank - Current A/C (*4910)',
    reference_no: '',
    payment_date: '',
    status: 'Pending Approval',
    prepared_by: 'Junior Engineer',
    approved_by: '',
    notes: 'Vertical drainage pipe installation 1st to 4th floor.'
  },
  {
    id: 'swp-005',
    voucher_no: 'SWP-2026-W36-005',
    week_number: 'Week 36 (01 Sep - 07 Sep 2026)',
    week_start: '2026-09-01',
    week_end: '2026-09-07',
    project_id: '1',
    project_name: 'Greenfield Residency - Phase 1',
    site_id: 'SITE-01',
    site_name: 'Main Residential Tower A',
    contractor_id: '5',
    contractor_name: 'Kaveri Shuttering & Formwork',
    trade_category: 'Formwork & Shuttering',
    work_order_no: 'WO-2026-015',
    total_mandays: 52,
    avg_rate_per_day: 920,
    gross_amount: 47840,
    advance_deduction: 5000,
    other_deductions: 1840,
    net_payable: 41000,
    payment_mode: 'Cheque',
    bank_account: 'SBI Project Escrow (*0918)',
    reference_no: '',
    payment_date: '',
    status: 'Draft',
    prepared_by: 'Site Supervisor',
    approved_by: '',
    notes: 'Formwork de-shuttering and staging for 4th floor slab.'
  }
];

const EMPTY_FORM = {
  project_id: '',
  project_name: '',
  site_name: '',
  contractor_id: '',
  contractor_name: '',
  trade_category: '',
  work_order_no: '',
  week_start: '',
  week_end: '',
  total_mandays: '0',
  avg_rate_per_day: '850',
  gross_amount: '0',
  advance_deduction: '0',
  other_deductions: '0',
  net_payable: '0',
  payment_mode: 'RTGS / Bank Transfer',
  bank_account: 'HDFC Bank - Current A/C (*4910)',
  reference_no: '',
  payment_date: '',
  status: 'Pending Approval',
  notes: ''
};

export function SubcontractorWeeklyPaymentsPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [payments, setPayments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [subcontractors, setSubcontractors] = useState([]);
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
  const [deleteItem, setDeleteItem] = useState(null);
  const [disburseItem, setDisburseItem] = useState(null);
  const [disburseForm, setDisburseForm] = useState({
    payment_mode: 'RTGS / Bank Transfer',
    reference_no: '',
    payment_date: new Date().toISOString().split('T')[0],
    bank_account: 'HDFC Bank - Current A/C (*4910)'
  });

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Load from LocalStorage & API
  const loadData = () => {
    setLoading(true);
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        setPayments(JSON.parse(saved));
      } else {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_SEED_DATA));
        setPayments(INITIAL_SEED_DATA);
      }
    } catch {
      setPayments(INITIAL_SEED_DATA);
    }

    // Load projects and master subcontractors
    Promise.all([
      projectsApi.list().catch(() => ({ data: [] })),
      subcontractsApi.contractors.list().catch(() => ({ data: [] }))
    ]).then(([projRes, contrRes]) => {
      const pList = projRes?.data?.projects ?? projRes?.projects ?? (Array.isArray(projRes?.data) ? projRes.data : []);
      if (Array.isArray(pList) && pList.length > 0) {
        setProjects(pList);
      } else {
        setProjects([
          { id: '1', project_name: 'Greenfield Residency - Phase 1', project_code: 'PRJ-2026-001' },
          { id: '2', project_name: 'Karur Commercial Plaza', project_code: 'PRJ-2026-002' }
        ]);
      }

      const cList = contrRes?.data?.subcontractors ?? contrRes?.data?.data ?? [];
      let masterSubs = [];
      try {
        const rawSubs = JSON.parse(localStorage.getItem('mock_subcontractors_master') || '[]');
        const MOCK_CODES = new Set(['SUB-2026-001', 'SUB-2026-002', 'SUB-2026-003', 'SUB-2026-004']);
        masterSubs = rawSubs.filter(s => !MOCK_CODES.has(s.contractor_code));
      } catch {
        masterSubs = [];
      }

      const mergedSubs = [...masterSubs];
      if (Array.isArray(cList)) {
        cList.forEach(c => {
          if (!mergedSubs.some(m => String(m.id) === String(c.id))) {
            mergedSubs.push(c);
          }
        });
      }

      if (mergedSubs.length > 0) {
        setSubcontractors(mergedSubs);
      } else {
        setSubcontractors([
          { id: '1', contractor_name: 'Sri Murugan Civil Infra Pvt Ltd', trade: 'Masonry', phone: '+91 98421 22345' },
          { id: '2', contractor_name: 'Apex Rebar & Steel Fabricators', trade: 'Steel Binding', phone: '+91 97890 54321' },
          { id: '3', contractor_name: 'Royal Plastering & Tiles Gang', trade: 'Tiles & Flooring', phone: '+91 94432 99881' },
          { id: '4', contractor_name: 'Shiva Plumbing & Sanitary Works', trade: 'Plumbing', phone: '+91 96554 11223' },
          { id: '5', contractor_name: 'Kaveri Shuttering & Formwork', trade: 'Carpentry / Formwork', phone: '+91 98940 33445' },
        ]);
      }
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const savePaymentsList = (newList) => {
    setPayments(newList);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newList));
  };

  // KPIs
  const kpis = useMemo(() => {
    const totalPayout = payments.reduce((acc, p) => acc + (Number(p.net_payable) || 0), 0);
    const pendingApprovalItems = payments.filter(p => p.status === 'Pending Approval');
    const pendingApprovalAmt = pendingApprovalItems.reduce((acc, p) => acc + (Number(p.net_payable) || 0), 0);
    const approvedItems = payments.filter(p => p.status === 'Approved');
    const approvedAmt = approvedItems.reduce((acc, p) => acc + (Number(p.net_payable) || 0), 0);
    const paidItems = payments.filter(p => p.status === 'Paid');
    const paidAmt = paidItems.reduce((acc, p) => acc + (Number(p.net_payable) || 0), 0);

    return {
      totalPayout,
      pendingCount: pendingApprovalItems.length,
      pendingApprovalAmt,
      approvedCount: approvedItems.length,
      approvedAmt,
      paidCount: paidItems.length,
      paidAmt
    };
  }, [payments]);

  // Filtering
  const filteredPayments = useMemo(() => {
    return payments.filter(item => {
      if (selectedProjectId !== 'all' && String(item.project_id) !== String(selectedProjectId)) {
        return false;
      }
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchVoucher = item.voucher_no?.toLowerCase().includes(q);
        const matchSub = item.contractor_name?.toLowerCase().includes(q);
        const matchTrade = item.trade_category?.toLowerCase().includes(q);
        const matchSite = item.site_name?.toLowerCase().includes(q);
        const matchProj = item.project_name?.toLowerCase().includes(q);
        const matchRef = item.reference_no?.toLowerCase().includes(q);
        if (!matchVoucher && !matchSub && !matchTrade && !matchSite && !matchProj && !matchRef) {
          return false;
        }
      }
      return true;
    });
  }, [payments, selectedProjectId, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / perPage));
  const pagedList = filteredPayments.slice((page - 1) * perPage, page * perPage);

  // Helpers for Dates
  const getCurrentWeekDefaults = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diffToMonday));
    const sunday = new Date(now.setDate(diffToMonday + 6));
    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0]
    };
  };

  // Form Handlers
  const handleOpenAdd = () => {
    const { start, end } = getCurrentWeekDefaults();
    const nextSeq = payments.length + 1;
    const voucher_no = `SWP-2026-W36-${String(nextSeq).padStart(3, '0')}`;
    const defaultProj = projects[0] ? String(projects[0].id) : '1';
    const defaultProjName = projects[0]?.project_name || 'Greenfield Residency - Phase 1';

    setForm({
      ...EMPTY_FORM,
      voucher_no,
      project_id: defaultProj,
      project_name: defaultProjName,
      site_name: 'Main Site Tower A',
      week_start: start,
      week_end: end,
      work_order_no: `WO-2026-0${nextSeq + 10}`,
      status: 'Pending Approval'
    });
    setErrors({});
    setIsAddOpen(true);
  };

  const handleOpenEdit = (item) => {
    setForm({
      project_id: String(item.project_id || ''),
      project_name: item.project_name || '',
      site_name: item.site_name || '',
      contractor_id: String(item.contractor_id || ''),
      contractor_name: item.contractor_name || '',
      trade_category: item.trade_category || '',
      work_order_no: item.work_order_no || '',
      week_start: item.week_start || '',
      week_end: item.week_end || '',
      total_mandays: String(item.total_mandays || '0'),
      avg_rate_per_day: String(item.avg_rate_per_day || '850'),
      gross_amount: String(item.gross_amount || '0'),
      advance_deduction: String(item.advance_deduction || '0'),
      other_deductions: String(item.other_deductions || '0'),
      net_payable: String(item.net_payable || '0'),
      payment_mode: item.payment_mode || 'RTGS / Bank Transfer',
      bank_account: item.bank_account || '',
      reference_no: item.reference_no || '',
      payment_date: item.payment_date || '',
      status: item.status || 'Draft',
      notes: item.notes || ''
    });
    setErrors({});
    setEditingItem(item);
  };

  const handleFormChange = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      
      // Auto compute Gross Amount if mandays or rate changed
      if (field === 'total_mandays' || field === 'avg_rate_per_day') {
        const days = Number(next.total_mandays) || 0;
        const rate = Number(next.avg_rate_per_day) || 0;
        next.gross_amount = String(days * rate);
      }

      // Auto compute Net Payable
      if (field === 'total_mandays' || field === 'avg_rate_per_day' || field === 'gross_amount' || field === 'advance_deduction' || field === 'other_deductions') {
        const gross = Number(next.gross_amount) || 0;
        const adv = Number(next.advance_deduction) || 0;
        const oth = Number(next.other_deductions) || 0;
        next.net_payable = String(Math.max(0, gross - adv - oth));
      }

      if (field === 'project_id') {
        const proj = projects.find(p => String(p.id) === String(value));
        if (proj) next.project_name = proj.project_name || proj.name;
      }

      if (field === 'contractor_id') {
        const sub = subcontractors.find(s => String(s.id) === String(value));
        if (sub) {
          next.contractor_name = sub.contractor_name || sub.name;
          if (sub.trade || sub.category_name) {
            next.trade_category = sub.trade || sub.category_name;
          }
        }
      }

      return next;
    });
    setErrors(prev => ({ ...prev, [field]: null }));
  };

  // Auto-fill from Logged Daily Wages
  const handleAutoFillFromDailyWages = () => {
    if (!form.contractor_id) {
      toast.error('Please select a subcontractor first.');
      return;
    }

    try {
      const dailyWages = JSON.parse(localStorage.getItem('mock_daily_wages') || '[]');
      const matched = dailyWages.filter(w => String(w.subcontractor_id) === String(form.contractor_id));

      if (matched.length === 0) {
        toast.info('No daily wages logged for this subcontractor yet. You can manually enter shifts and rate.');
        return;
      }

      let totalDays = 0;
      let totalWageAmount = 0;

      matched.forEach(w => {
        if (w.entries) {
          Object.keys(w.entries).forEach(id => {
            const shift = Number(w.entries[id]) || 0;
            const rate = Number(w.rates?.[id]) || 850;
            totalDays += shift;
            totalWageAmount += (shift * rate);
          });
        }
      });

      if (totalDays > 0) {
        const avgRate = Math.round(totalWageAmount / totalDays);
        setForm(prev => {
          const gross = totalWageAmount;
          const adv = Number(prev.advance_deduction) || 0;
          const oth = Number(prev.other_deductions) || 0;
          return {
            ...prev,
            total_mandays: String(totalDays),
            avg_rate_per_day: String(avgRate),
            gross_amount: String(gross),
            net_payable: String(Math.max(0, gross - adv - oth)),
            notes: (prev.notes ? prev.notes + ' ' : '') + `(Auto-synced ${matched.length} daily wage logs)`
          };
        });
        toast.success(`Synced ${totalDays} shifts from ${matched.length} daily wage logs.`);
      } else {
        toast.info('Found daily wage entries, but shifts were 0.');
      }
    } catch {
      toast.error('Could not read daily wage logs.');
    }
  };

  const handleSaveForm = (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!form.contractor_id && !form.contractor_name) newErrors.contractor_id = 'Subcontractor is required';
    if (!form.project_id && !form.project_name) newErrors.project_id = 'Project is required';
    if (!form.week_start) newErrors.week_start = 'Week start date required';
    if (!form.week_end) newErrors.week_end = 'Week end date required';
    if (Number(form.net_payable) <= 0 && Number(form.gross_amount) <= 0) {
      newErrors.net_payable = 'Net payable amount must be greater than 0';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Please resolve validation errors.');
      return;
    }

    setSaving(true);
    setTimeout(() => {
      const week_number = `${form.week_start} to ${form.week_end}`;
      if (editingItem) {
        const updated = payments.map(p => {
          if (p.id === editingItem.id) {
            return {
              ...p,
              ...form,
              total_mandays: Number(form.total_mandays) || 0,
              avg_rate_per_day: Number(form.avg_rate_per_day) || 0,
              gross_amount: Number(form.gross_amount) || 0,
              advance_deduction: Number(form.advance_deduction) || 0,
              other_deductions: Number(form.other_deductions) || 0,
              net_payable: Number(form.net_payable) || 0,
              week_number
            };
          }
          return p;
        });
        savePaymentsList(updated);
        toast.success('Weekly payment record updated successfully.');
        setEditingItem(null);
      } else {
        const newRecord = {
          id: `swp-${Date.now()}`,
          voucher_no: form.voucher_no || `SWP-2026-${Date.now().toString().slice(-4)}`,
          ...form,
          total_mandays: Number(form.total_mandays) || 0,
          avg_rate_per_day: Number(form.avg_rate_per_day) || 0,
          gross_amount: Number(form.gross_amount) || 0,
          advance_deduction: Number(form.advance_deduction) || 0,
          other_deductions: Number(form.other_deductions) || 0,
          net_payable: Number(form.net_payable) || 0,
          week_number,
          prepared_by: 'Site Accounts'
        };
        savePaymentsList([newRecord, ...payments]);
        toast.success('New weekly payment batch created.');
        setIsAddOpen(false);
      }
      setSaving(false);
    }, 300);
  };

  const handleApprove = (item) => {
    const updated = payments.map(p => {
      if (p.id === item.id) {
        return {
          ...p,
          status: 'Approved',
          approved_by: 'Project Manager (Current User)'
        };
      }
      return p;
    });
    savePaymentsList(updated);
    toast.success(`Voucher ${item.voucher_no} approved for payout.`);
  };

  const handleOpenDisburse = (item) => {
    setDisburseItem(item);
    setDisburseForm({
      payment_mode: item.payment_mode || 'RTGS / Bank Transfer',
      reference_no: item.reference_no || `UTR-${Math.floor(100000000 + Math.random() * 900000000)}`,
      payment_date: new Date().toISOString().split('T')[0],
      bank_account: item.bank_account || 'HDFC Bank - Current A/C (*4910)'
    });
  };

  const handleConfirmDisburse = () => {
    if (!disburseForm.reference_no) {
      toast.error('Payment reference / UTR number is required.');
      return;
    }

    const updated = payments.map(p => {
      if (p.id === disburseItem.id) {
        return {
          ...p,
          status: 'Paid',
          payment_mode: disburseForm.payment_mode,
          reference_no: disburseForm.reference_no,
          payment_date: disburseForm.payment_date,
          bank_account: disburseForm.bank_account
        };
      }
      return p;
    });

    savePaymentsList(updated);
    toast.success(`Payment disbursed & recorded for ${disburseItem.contractor_name}.`);
    setDisburseItem(null);
  };

  const handleDelete = () => {
    if (!deleteItem) return;
    const updated = payments.filter(p => p.id !== deleteItem.id);
    savePaymentsList(updated);
    toast.success('Weekly payment record removed.');
    setDeleteItem(null);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Paid':
        return (
          <Badge
            variant="success"
            className="text-[8px] font-bold uppercase tracking-wider h-4 px-1.5 inline-flex items-center leading-none"
          >
            Disbursed
          </Badge>
        );
      case 'Approved':
        return (
          <Badge
            variant="info"
            className="text-[8px] font-bold uppercase tracking-wider h-4 px-1.5 inline-flex items-center leading-none"
          >
            Approved
          </Badge>
        );
      case 'Pending Approval':
        return (
          <Badge
            variant="warning"
            className="text-[8px] font-bold uppercase tracking-wider h-4 px-1.5 inline-flex items-center leading-none"
          >
            Pending
          </Badge>
        );
      default:
        return (
          <Badge
            variant="secondary"
            className="text-[8px] font-bold uppercase tracking-wider h-4 px-1.5 inline-flex items-center leading-none"
          >
            {status || 'Draft'}
          </Badge>
        );
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Subcontractor Weekly Payments"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Subcontract Management', href: '/subcontracts/subcontractors' },
          { label: 'Weekly Payments' }
        ]}
      />

      <div className="flex flex-col gap-3 sm:gap-4 w-full">
        {/* KPI Summary Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <KpiCard
            label="Total Weekly Payout"
            value={`₹${(kpis.totalPayout / 100000).toFixed(2)}L`}
            status="primary"
            icon={<IndianRupee className="w-4 h-4" />}
          />
          <KpiCard
            label="Pending Approval"
            value={`${kpis.pendingCount} Batches`}
            status="warning"
            icon={<Clock className="w-4 h-4 text-amber-500" />}
          />
          <KpiCard
            label="Approved for Payment"
            value={`₹${(kpis.approvedAmt / 100000).toFixed(2)}L`}
            status="neutral"
            icon={<ShieldCheck className="w-4 h-4 text-sky-500" />}
          />
          <KpiCard
            label="Paid This Cycle"
            value={`${kpis.paidCount} Disbursed`}
            status="success"
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          />
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-surface border border-border rounded-lg p-2.5 sm:p-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="w-full sm:w-48">
              <Select
                options={[
                  { value: 'all', label: 'All Projects' },
                  ...projects.map(p => ({ value: String(p.id), label: p.project_name || p.name, }))
                ]}
                value={selectedProjectId}
                onChange={setSelectedProjectId}
                className="text-xs h-8"
              />
            </div>

            <div className="w-full sm:w-40">
              <Select
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'Draft', label: 'Draft' },
                  { value: 'Pending Approval', label: 'Pending Approval' },
                  { value: 'Approved', label: 'Approved' },
                  { value: 'Paid', label: 'Paid' },
                ]}
                value={statusFilter}
                onChange={setStatusFilter}
                className="text-xs h-8"
              />
            </div>

            <div className="w-full sm:w-56">
              <SearchField
                placeholder="Search payment no, UTR, contractor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClear={() => setSearch('')}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => navigate('/subcontracts/weekly-payments/new')}
              className="text-xs h-8 shadow-xs"
            >
              New Weekly Payment
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
                totalItems={filteredPayments.length}
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
                  <th className="px-3 py-2">Contractor & Trade</th>
                  <th className="px-3 py-2 text-right w-28 font-bold">Paid Amount</th>
                  <th className="px-3 py-2 w-36 hidden md:table-cell">Site & Shifts</th>
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
                ) : pagedList.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-text-muted text-[12px]">
                      No weekly payments found.
                    </td>
                  </tr>
                ) : (
                  pagedList.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-surface-muted/30 transition-colors group">
                      <td className="px-3 py-2 text-center font-medium text-text-primary text-[11px]">
                        {(page - 1) * perPage + idx + 1}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                          {item.voucher_no}
                        </span>
                        <span className="text-[10px] text-text-muted font-mono block pt-0.5">
                          {item.week_start || item.payment_date}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-text-primary text-[12px] truncate" title={item.contractor_name}>
                            {item.contractor_name}
                          </span>
                          <span className="text-[10px] text-text-muted truncate">
                            {item.trade_category || 'General Civil Works'} • {item.project_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 text-[11px]">
                        ₹{Number(item.net_payable || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell font-mono text-[10px] text-text-secondary">
                        <div className="truncate max-w-[150px]">{item.site_name || item.project_name}</div>
                        <div className="text-primary truncate">{item.total_mandays || 0} shifts</div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          {item.status === 'Pending Approval' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              title="Approve Payment Batch"
                              onClick={() => handleApprove(item)}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {item.status === 'Approved' && (
                            <Button
                              variant="outline"
                              size="xs"
                              className="h-5 px-1.5 text-[9px] font-medium text-sky-700 bg-sky-50 border-sky-200 hover:bg-sky-100"
                              title="Pay Now"
                              onClick={() => handleOpenDisburse(item)}
                            >
                              Pay
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="View"
                            onClick={() => navigate(`/subcontracts/weekly-payments/new?id=${item.id}`)}
                          >
                            <Eye className="w-3.5 h-3.5 text-text-secondary hover:text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="Edit"
                            onClick={() => navigate(`/subcontracts/weekly-payments/new?id=${item.id}`)}
                          >
                            <Edit className="w-3.5 h-3.5 text-text-secondary hover:text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            title="Delete"
                            onClick={() => setDeleteItem(item)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
            <div className="p-8 text-center text-text-muted bg-surface rounded-lg border border-border shadow-xs">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
              Loading weekly payments...
            </div>
          ) : pagedList.length === 0 ? (
            <div className="p-8 text-center text-text-muted bg-surface rounded-lg border border-border shadow-xs">
              <CreditCard className="w-8 h-8 mx-auto mb-2 text-text-muted/40" />
              No subcontractor weekly payments found.
            </div>
          ) : (
            pagedList.map((item, idx) => (
              <div key={item.id || idx} className="bg-surface border border-border rounded-lg p-3.5 shadow-xs space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-[10px] font-bold text-primary block truncate">
                      {item.voucher_no} • {item.week_start || item.payment_date}
                    </span>
                    <h4 className="font-semibold text-text-primary text-[13px] leading-snug truncate mt-0.5">
                      {item.contractor_name}
                    </h4>
                    <span className="text-[11px] text-text-muted block truncate">
                      {item.trade_category || 'General Civil Works'} • {item.project_name}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge
                      variant="success"
                      className="text-[8px] font-bold uppercase tracking-wider h-4 px-1.5 inline-flex items-center leading-none shrink-0"
                    >
                      ₹{Number(item.net_payable || 0).toLocaleString('en-IN')}
                    </Badge>
                    <div className="pt-0.5">
                      {getStatusBadge(item.status)}
                    </div>
                  </div>
                </div>

                <div className="p-2 bg-surface-muted/40 rounded border border-border/60 font-mono text-[11px] flex items-center justify-between">
                  <span className="text-text-muted">Shifts & Site</span>
                  <span className="font-medium text-text-primary truncate max-w-[200px]">
                    {item.total_mandays || 0} shifts • {item.site_name || item.project_name}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/60 text-xs">
                  {item.status === 'Pending Approval' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] px-2 text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                      onClick={() => handleApprove(item)}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                    </Button>
                  )}
                  {item.status === 'Approved' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] px-2 text-sky-700 bg-sky-50 border-sky-200 hover:bg-sky-100"
                      onClick={() => handleOpenDisburse(item)}
                    >
                      Pay Now
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] px-2"
                    onClick={() => navigate(`/subcontracts/weekly-payments/new?id=${item.id}`)}
                  >
                    <Eye className="w-3 h-3 mr-1" /> View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] px-2"
                    onClick={() => navigate(`/subcontracts/weekly-payments/new?id=${item.id}`)}
                  >
                    <Edit className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] px-2 text-red-600 hover:bg-red-50"
                    onClick={() => setDeleteItem(item)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))
          )}

          {/* Mobile Pagination */}
          <div className="pt-2">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={filteredPayments.length}
              itemsPerPage={perPage}
              onPageChange={setPage}
              onItemsPerPageChange={() => {}}
            />
          </div>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {(isAddOpen || editingItem) && (
        <EntityEditModal
          isOpen={true}
          onClose={() => {
            setIsAddOpen(false);
            setEditingItem(null);
          }}
          title={editingItem ? `Edit Weekly Payment (${editingItem.voucher_no})` : 'New Subcontractor Weekly Payment'}
          size="lg"
        >
          <form onSubmit={handleSaveForm} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Project" required error={errors.project_id}>
                <Select
                  value={form.project_id}
                  onChange={(e) => handleFormChange('project_id', e.target.value)}
                >
                  <option value="">Select Project</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.project_name || p.name}</option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Site / Location" required>
                <Input
                  value={form.site_name}
                  onChange={(e) => handleFormChange('site_name', e.target.value)}
                  placeholder="e.g. Tower A Floor 4"
                />
              </FormField>

              <FormField label="Subcontractor Partner" required error={errors.contractor_id}>
                <Select
                  value={form.contractor_id}
                  onChange={(e) => handleFormChange('contractor_id', e.target.value)}
                >
                  <option value="">Select Subcontractor</option>
                  {subcontractors.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.contractor_name || s.name} {s.trade ? `(${s.trade})` : ''}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Trade / Work Category">
                <Input
                  value={form.trade_category}
                  onChange={(e) => handleFormChange('trade_category', e.target.value)}
                  placeholder="e.g. Masonry, Barbending, Tiles"
                />
              </FormField>

              <FormField label="Week Start Date" required error={errors.week_start}>
                <Input
                  type="date"
                  value={form.week_start}
                  onChange={(e) => handleFormChange('week_start', e.target.value)}
                />
              </FormField>

              <FormField label="Week End Date" required error={errors.week_end}>
                <Input
                  type="date"
                  value={form.week_end}
                  onChange={(e) => handleFormChange('week_end', e.target.value)}
                />
              </FormField>
            </div>

            {/* Quick Auto-Calculate Feature */}
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-xs text-primary flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Auto-Calculate from Logged Daily Site Wages
                </div>
                <p className="text-[11px] text-text-muted">
                  Reads shifts and trade rates logged in Daily Site Operations for this subcontractor.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleAutoFillFromDailyWages}
                className="gap-1 shrink-0 bg-white shadow-xs"
              >
                <RefreshCw className="w-3 h-3" />
                Auto-Calculate
              </Button>
            </div>

            {/* Calculations Section */}
            <div className="bg-surface-muted/50 p-4 rounded-xl border border-border space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                Wage & Manpower Calculation
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField label="Total Mandays / Shifts" required>
                  <Input
                    type="number"
                    step="0.5"
                    value={form.total_mandays}
                    onChange={(e) => handleFormChange('total_mandays', e.target.value)}
                    placeholder="0"
                  />
                </FormField>

                <FormField label="Avg Rate per Shift (₹)">
                  <Input
                    type="number"
                    value={form.avg_rate_per_day}
                    onChange={(e) => handleFormChange('avg_rate_per_day', e.target.value)}
                    placeholder="850"
                  />
                </FormField>

                <FormField label="Gross Amount (₹)" required>
                  <Input
                    type="number"
                    value={form.gross_amount}
                    onChange={(e) => handleFormChange('gross_amount', e.target.value)}
                    placeholder="0"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border">
                <FormField label="Advance Recovered (₹)">
                  <Input
                    type="number"
                    value={form.advance_deduction}
                    onChange={(e) => handleFormChange('advance_deduction', e.target.value)}
                    placeholder="0"
                  />
                </FormField>

                <FormField label="Other Deductions (Mess/Tools) (₹)">
                  <Input
                    type="number"
                    value={form.other_deductions}
                    onChange={(e) => handleFormChange('other_deductions', e.target.value)}
                    placeholder="0"
                  />
                </FormField>

                <FormField label="Net Payable Amount (₹)" required error={errors.net_payable}>
                  <div className="relative">
                    <Input
                      type="number"
                      className="font-bold text-primary text-base font-mono bg-primary/5"
                      value={form.net_payable}
                      onChange={(e) => handleFormChange('net_payable', e.target.value)}
                    />
                  </div>
                </FormField>
              </div>
            </div>

            {/* Payment & Bank Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Payment Method">
                <Select
                  value={form.payment_mode}
                  onChange={(e) => handleFormChange('payment_mode', e.target.value)}
                >
                  <option value="RTGS / Bank Transfer">RTGS / Bank Transfer</option>
                  <option value="NEFT Transfer">NEFT Transfer</option>
                  <option value="UPI / IMPS">UPI / IMPS</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                </Select>
              </FormField>

              <FormField label="Payment Account / Bank">
                <Input
                  value={form.bank_account}
                  onChange={(e) => handleFormChange('bank_account', e.target.value)}
                  placeholder="e.g. HDFC Current A/C"
                />
              </FormField>

              <FormField label="Approval Status">
                <Select
                  value={form.status}
                  onChange={(e) => handleFormChange('status', e.target.value)}
                >
                  <option value="Draft">Draft</option>
                  <option value="Pending Approval">Pending Approval</option>
                  <option value="Approved">Approved</option>
                  <option value="Paid">Paid</option>
                </Select>
              </FormField>
            </div>

            <FormField label="Supervisor Remarks / Settlement Notes">
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => handleFormChange('notes', e.target.value)}
                placeholder="Details of work executed, quality notes, gang details..."
              />
            </FormField>

            <div className="flex justify-end gap-2 pt-4 border-t border-border">
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
              <Button type="submit" variant="primary" loading={saving}>
                {editingItem ? 'Save Changes' : 'Create Weekly Payment'}
              </Button>
            </div>
          </form>
        </EntityEditModal>
      )}

      {/* Disburse / Pay Modal */}
      {disburseItem && (
        <EntityEditModal
          isOpen={true}
          onClose={() => setDisburseItem(null)}
          title={`Disburse Payment: ${disburseItem.voucher_no}`}
          size="md"
        >
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
              <div className="text-xs text-emerald-800 font-semibold uppercase tracking-wider">Subcontractor Partner</div>
              <div className="text-base font-bold text-emerald-950">{disburseItem.contractor_name}</div>
              <div className="mt-2 flex items-center justify-between text-xs text-emerald-900 border-t border-emerald-200 pt-2">
                <span>Net Payable Amount:</span>
                <span className="text-lg font-bold font-mono">₹{Number(disburseItem.net_payable).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <FormField label="Payment Date" required>
              <Input
                type="date"
                value={disburseForm.payment_date}
                onChange={(e) => setDisburseForm(prev => ({ ...prev, payment_date: e.target.value }))}
              />
            </FormField>

            <FormField label="Payment Mode" required>
              <Select
                value={disburseForm.payment_mode}
                onChange={(e) => setDisburseForm(prev => ({ ...prev, payment_mode: e.target.value }))}
              >
                <option value="RTGS / Bank Transfer">RTGS / Bank Transfer</option>
                <option value="NEFT Transfer">NEFT Transfer</option>
                <option value="UPI / IMPS">UPI / IMPS</option>
                <option value="Cheque">Cheque</option>
                <option value="Cash">Cash</option>
              </Select>
            </FormField>

            <FormField label="Transaction Ref # / UTR / Cheque #" required>
              <Input
                value={disburseForm.reference_no}
                onChange={(e) => setDisburseForm(prev => ({ ...prev, reference_no: e.target.value }))}
                placeholder="e.g. UTR-HDFC-9912048"
              />
            </FormField>

            <FormField label="Disbursing Bank Account">
              <Input
                value={disburseForm.bank_account}
                onChange={(e) => setDisburseForm(prev => ({ ...prev, bank_account: e.target.value }))}
              />
            </FormField>

            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setDisburseItem(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleConfirmDisburse} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Record Payout
              </Button>
            </div>
          </div>
        </EntityEditModal>
      )}

      {/* Voucher Detail & Print Modal */}
      {viewingItem && (
        <EntityEditModal
          isOpen={true}
          onClose={() => setViewingItem(null)}
          title={`Subcontractor Weekly Payment Voucher: ${viewingItem.voucher_no}`}
          size="lg"
        >
          <div className="space-y-6">
            {/* Printable Voucher Format */}
            <div id="printable-voucher" className="border border-border rounded-xl p-6 bg-white shadow-xs space-y-4">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-border pb-4">
                <div>
                  <div className="text-lg font-black tracking-tight text-primary">CIVIL DESK INFRASTRUCTURE</div>
                  <div className="text-xs text-text-muted">Subcontractor Weekly Wage Settlement Voucher</div>
                  <div className="text-xs text-text-muted mt-1">Project: <span className="font-semibold text-text-primary">{viewingItem.project_name}</span></div>
                  <div className="text-xs text-text-muted">Site: <span className="font-semibold text-text-primary">{viewingItem.site_name}</span></div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-text-muted uppercase font-bold">Voucher No</div>
                  <div className="text-base font-mono font-bold text-primary">{viewingItem.voucher_no}</div>
                  <div className="mt-1">{getStatusBadge(viewingItem.status)}</div>
                </div>
              </div>

              {/* Subcontractor & Week details */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-surface-muted/50 p-3 rounded-lg">
                <div>
                  <span className="text-text-muted uppercase font-bold block text-[10px]">Subcontractor Gang</span>
                  <span className="font-bold text-text-primary text-sm">{viewingItem.contractor_name}</span>
                  <div className="text-text-muted mt-0.5">Trade: {viewingItem.trade_category || 'Civil Contractor'}</div>
                  <div className="text-text-muted">Work Order: {viewingItem.work_order_no || 'N/A'}</div>
                </div>
                <div className="text-right">
                  <span className="text-text-muted uppercase font-bold block text-[10px]">Settlement Period</span>
                  <span className="font-semibold text-text-primary">{viewingItem.week_start} to {viewingItem.week_end}</span>
                  <div className="text-text-muted mt-0.5">Total Shifts: <span className="font-bold text-text-primary">{viewingItem.total_mandays} Mandays</span></div>
                  <div className="text-text-muted">Rate/Day: ₹{Number(viewingItem.avg_rate_per_day).toLocaleString('en-IN')}</div>
                </div>
              </div>

              {/* Financial Breakdown Table */}
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-surface-muted font-bold text-text-muted border-b border-border">
                    <tr>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="px-3 py-2 font-medium">Gross Wage Calculation ({viewingItem.total_mandays} Shifts @ ₹{viewingItem.avg_rate_per_day})</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">₹{Number(viewingItem.gross_amount).toLocaleString('en-IN')}</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-red-600">Less: Mid-week Advance Recovery</td>
                      <td className="px-3 py-2 text-right font-mono text-red-600">-₹{Number(viewingItem.advance_deduction || 0).toLocaleString('en-IN')}</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-red-600">Less: Mess / Tool / Material Deductions</td>
                      <td className="px-3 py-2 text-right font-mono text-red-600">-₹{Number(viewingItem.other_deductions || 0).toLocaleString('en-IN')}</td>
                    </tr>
                    <tr className="bg-primary/5 font-bold">
                      <td className="px-3 py-2.5 text-primary text-sm">Net Payable Amount</td>
                      <td className="px-3 py-2.5 text-right font-mono text-primary text-base font-bold">
                        ₹{Number(viewingItem.net_payable).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Payment Details */}
              <div className="grid grid-cols-2 gap-4 text-xs pt-2">
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Payment Method</span>
                  <span className="font-semibold">{viewingItem.payment_mode || 'Bank Transfer'}</span>
                  {viewingItem.bank_account && (
                    <div className="text-text-muted">{viewingItem.bank_account}</div>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-text-muted block text-[10px] uppercase font-bold">UTR / Reference No</span>
                  <span className="font-mono font-semibold">{viewingItem.reference_no || 'Pending disbursement'}</span>
                  {viewingItem.payment_date && (
                    <div className="text-text-muted">Paid Date: {viewingItem.payment_date}</div>
                  )}
                </div>
              </div>

              {viewingItem.notes && (
                <div className="text-xs bg-surface-muted p-2.5 rounded text-text-secondary">
                  <span className="font-semibold text-text-primary">Remarks: </span>
                  {viewingItem.notes}
                </div>
              )}

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-4 pt-8 text-center text-xs text-text-muted border-t border-dashed border-border mt-6">
                <div>
                  <div className="h-10 border-b border-text-muted/40 mb-1"></div>
                  <span>Prepared By: {viewingItem.prepared_by || 'Supervisor'}</span>
                </div>
                <div>
                  <div className="h-10 border-b border-text-muted/40 mb-1"></div>
                  <span>Verified By: Site Incharge</span>
                </div>
                <div>
                  <div className="h-10 border-b border-text-muted/40 mb-1"></div>
                  <span>Subcontractor Signature / Thumb</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end items-center pt-2">
              <Button variant="primary" onClick={() => setViewingItem(null)}>
                Close
              </Button>
            </div>
          </div>
        </EntityEditModal>
      )}

      {/* Delete Confirmation */}
      {deleteItem && (
        <ConfirmDialog
          isOpen={true}
          title="Delete Weekly Payment Batch?"
          message={`Are you sure you want to remove weekly voucher ${deleteItem.voucher_no} for ${deleteItem.contractor_name}? This action cannot be undone.`}
          confirmLabel="Delete Voucher"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteItem(null)}
        />
      )}
    </PageContainer>
  );
}
