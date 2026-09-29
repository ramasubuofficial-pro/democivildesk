import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  HardHat, Printer, Download, Save, List, Plus, Trash2,
  RotateCcw, Check, CheckSquare, Square, ChevronDown,
  ArrowLeft, FileText, Calendar, Building2, User
} from 'lucide-react';
import { PageContainer } from '../../../components/layout/PageContainer';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { toast } from '../../../components/composite/Toast';
import { projectsApi, subcontractsApi } from '../../../api/apiservice';

const LOCAL_SLIPS_KEY = 'mock_maistry_slips';
const WEEKLY_PAYMENTS_KEY = 'mock_subcontractor_weekly_payments';

const INITIAL_SITES = [
  { id: 'SITE-01', name: 'BHARANI GARDEN', client: 'Sakthivel', code: 'BG-01' },
  { id: 'SITE-02', name: 'Greenfield Residency', client: 'K. Sundaramoorthy', code: 'GFR-01' },
  { id: 'SITE-03', name: 'Ajantha Theater Trichy Site', client: 'Trichy Cinemas', code: 'ATT-08' },
  { id: 'SITE-04', name: 'Karur Kulathupalayam Site', client: 'Karur Infra', code: 'KKP-02' }
];

const INITIAL_MAISTRIES = [
  { id: '1', name: 'Saravanan (Centering)', trade: 'Centering', site_id: 'SITE-01', phone: '98421 22345', log_count: 11 },
  { id: '2', name: 'Murugan (Masonry)', trade: 'Masonry', site_id: 'SITE-01', phone: '97890 54321', log_count: 8 },
  { id: '3', name: 'Apex Selvam (Steel Binding)', trade: 'Steel Binding', site_id: 'SITE-02', phone: '94432 99881', log_count: 14 },
  { id: '4', name: 'Kaveri Kumar (Carpentry)', trade: 'Formwork', site_id: 'SITE-01', phone: '98940 33445', log_count: 6 },
  { id: '5', name: 'Shiva (Plumbing Gang)', trade: 'Plumbing', site_id: 'SITE-03', phone: '96554 11223', log_count: 9 }
];

const DEFAULT_ROWS = [
  {
    category: 'LABOUR / MANPOWER',
    items: [
      { id: 'l-1', description: 'Centering', rate: 800, days: ['', '', '', '', '', '', '19.5'] }
    ]
  },
  {
    category: 'EQUIPMENT / RENTALS',
    items: [
      { id: 'e-1', description: 'Auto', rate: 0, days: ['', '', '', '', '', '', ''] },
      { id: 'e-2', description: 'Column Box Rent', rate: 0, days: ['', '', '', '', '', '', ''] }
    ]
  },
  {
    category: 'EXPENSES & CHARGES',
    items: [
      { id: 'ex-1', description: 'Binding Wire & Nails', rate: 500, days: ['', '', '', '', '', '', ''] },
      { id: 'ex-2', description: 'Bus Transport', rate: 16, days: ['', '', '', '', '', '', ''] },
      { id: 'ex-3', description: 'Tea', rate: 20, days: ['', '', '', '', '', '', ''] },
      { id: 'ex-4', description: 'Food', rate: 0, days: ['', '', '', '', '', '', ''] }
    ]
  }
];

export function MaistrySlipPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const slipPrintRef = useRef(null);

  // Top Selectors
  const [sites, setSites] = useState(INITIAL_SITES);
  const [maistries, setMaistries] = useState(INITIAL_MAISTRIES);
  const [selectedSiteId, setSelectedSiteId] = useState('SITE-01');
  const [selectedMaistryId, setSelectedMaistryId] = useState('1');

  // Dates (7-day week period)
  const [startDate, setStartDate] = useState('2026-08-25');
  const [endDate, setEndDate] = useState('2026-08-31');

  // Slip Style Theme: 'white' or 'yellow'
  const [slipTheme, setSlipTheme] = useState('white');

  // Options
  const [enableMaistryPct, setEnableMaistryPct] = useState(false);
  const [maistryPctValue, setMaistryPctValue] = useState(5);
  const [roundOff, setRoundOff] = useState(true);

  // Table Categories & Rows
  const [categories, setCategories] = useState(DEFAULT_ROWS);

  // Metadata
  const [refNo, setRefNo] = useState('MST-002-3108');
  const [savedSlips, setSavedSlips] = useState([]);

  // Load saved slips & existing edit id
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LOCAL_SLIPS_KEY) || '[]');
      setSavedSlips(saved);

      if (editId) {
        const found = saved.find(s => s.id === editId);
        if (found) {
          loadSlipIntoForm(found);
        }
      }
    } catch {
      setSavedSlips([]);
    }
  }, [editId]);

  // Load project sites & subcontractors if available
  useEffect(() => {
    projectsApi.list().then(res => {
      const pList = res?.data?.projects ?? res?.projects ?? (Array.isArray(res?.data) ? res.data : []);
      if (Array.isArray(pList) && pList.length > 0) {
        const mapped = pList.map((p, i) => ({
          id: String(p.id),
          name: p.project_name || p.name,
          client: p.client_name || 'Project Client',
          code: p.project_code || `SITE-0${i + 1}`
        }));
        setSites(mapped);
      }
    }).catch(() => {});

    try {
      const subs = JSON.parse(localStorage.getItem('mock_subcontractors_master') || '[]');
      const MOCK_CODES = new Set(['SUB-2026-001', 'SUB-2026-002', 'SUB-2026-003', 'SUB-2026-004']);
      const validSubs = subs.filter(s => !MOCK_CODES.has(s.contractor_code));
      if (validSubs.length > 0) {
        const mapped = validSubs.map((s, i) => ({
          id: String(s.id),
          name: `${s.contractor_name} (${s.trade || 'General'})`,
          trade: s.trade || 'General Civil',
          site_id: 'SITE-01',
          phone: s.phone || '',
          log_count: 5 + i
        }));
        setMaistries(mapped);
      }
    } catch {}
  }, []);

  const selectedSite = useMemo(() => {
    return sites.find(s => s.id === selectedSiteId) || sites[0] || { name: 'BHARANI GARDEN', client: 'Sakthivel' };
  }, [sites, selectedSiteId]);

  const selectedMaistry = useMemo(() => {
    return maistries.find(m => m.id === selectedMaistryId) || maistries[0] || { name: 'Saravanan (Centering)', trade: 'Centering' };
  }, [maistries, selectedMaistryId]);

  // Compute 7 days list from startDate to endDate
  const dateColumns = useMemo(() => {
    const dates = [];
    try {
      const start = new Date(startDate);
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        dates.push({
          label: `${day}/${month}`,
          fullDate: d.toISOString().split('T')[0]
        });
      }
    } catch {
      return [
        { label: '25/08' }, { label: '26/08' }, { label: '27/08' },
        { label: '28/08' }, { label: '29/08' }, { label: '30/08' }, { label: '31/08' }
      ];
    }
    return dates;
  }, [startDate]);

  // Quick Date Ranges
  const handleQuickLast7Days = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const handleQuickFullRange = () => {
    setStartDate('2026-08-25');
    setEndDate('2026-08-31');
  };

  // Add Rows
  const handleAddRow = (targetCategory) => {
    setCategories(prev => {
      return prev.map(cat => {
        if (cat.category === targetCategory) {
          return {
            ...cat,
            items: [
              ...cat.items,
              {
                id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                description: '',
                rate: 0,
                days: ['', '', '', '', '', '', '']
              }
            ]
          };
        }
        return cat;
      });
    });
  };

  const handleAddCustomCategory = () => {
    const newCatName = prompt('Enter custom category name:', 'OTHERS / CUSTOM');
    if (!newCatName) return;
    setCategories(prev => [
      ...prev,
      {
        category: newCatName.toUpperCase(),
        items: [
          {
            id: `item-${Date.now()}`,
            description: 'Custom Item',
            rate: 0,
            days: ['', '', '', '', '', '', '']
          }
        ]
      }
    ]);
  };

  // Modify Row
  const handleUpdateItem = (catIndex, itemIndex, field, value) => {
    setCategories(prev => {
      const next = [...prev];
      const targetCat = { ...next[catIndex] };
      const items = [...targetCat.items];
      items[itemIndex] = { ...items[itemIndex], [field]: value };
      targetCat.items = items;
      next[catIndex] = targetCat;
      return next;
    });
  };

  const handleUpdateDay = (catIndex, itemIndex, dayIndex, value) => {
    setCategories(prev => {
      const next = [...prev];
      const targetCat = { ...next[catIndex] };
      const items = [...targetCat.items];
      const days = [...items[itemIndex].days];
      days[dayIndex] = value;
      items[itemIndex] = { ...items[itemIndex], days };
      targetCat.items = items;
      next[catIndex] = targetCat;
      return next;
    });
  };

  const handleDeleteItem = (catIndex, itemIndex) => {
    setCategories(prev => {
      const next = [...prev];
      const targetCat = { ...next[catIndex] };
      targetCat.items = targetCat.items.filter((_, idx) => idx !== itemIndex);
      next[catIndex] = targetCat;
      return next;
    });
  };

  // Calculate totals
  const { subTotal, grandTotal, maistryCommission } = useMemo(() => {
    let total = 0;
    categories.forEach(cat => {
      cat.items.forEach(item => {
        const rate = Number(item.rate) || 0;
        const qty = item.days.reduce((acc, d) => acc + (Number(d) || 0), 0);
        total += (qty * rate);
      });
    });

    let commission = 0;
    if (enableMaistryPct) {
      commission = Math.round(total * (Number(maistryPctValue) / 100));
    }

    let finalTotal = total + commission;
    if (roundOff) {
      finalTotal = Math.round(finalTotal / 10) * 10;
    }

    return {
      subTotal: total,
      maistryCommission: commission,
      grandTotal: finalTotal
    };
  }, [categories, enableMaistryPct, maistryPctValue, roundOff]);

  // Reload Logs from DB
  const handleReloadLogs = () => {
    try {
      const dailyWages = JSON.parse(localStorage.getItem('mock_daily_wages') || '[]');
      const matched = dailyWages.filter(w => String(w.subcontractor_id) === String(selectedMaistryId));

      if (matched.length > 0) {
        let labourDays = 0;
        let labourRate = 800;
        matched.forEach(w => {
          if (w.entries) {
            Object.keys(w.entries).forEach(id => {
              labourDays += (Number(w.entries[id]) || 0);
              if (w.rates?.[id]) labourRate = Number(w.rates[id]);
            });
          }
        });

        if (labourDays > 0) {
          setCategories(prev => {
            return prev.map(cat => {
              if (cat.category === 'LABOUR / MANPOWER') {
                return {
                  ...cat,
                  items: [
                    {
                      id: 'l-synced',
                      description: selectedMaistry.trade || 'Centering Works',
                      rate: labourRate,
                      days: ['', '', '', '', '', '', String(labourDays)]
                    }
                  ]
                };
              }
              return cat;
            });
          });
          toast.success(`Loaded ${labourDays} shifts from DB for ${selectedMaistry.name}.`);
          return;
        }
      }
      toast.info('No new daily logs found for this maistry in DB. Keeping current template.');
    } catch {
      toast.error('Failed to reload logs.');
    }
  };

  // Save Slip
  const handleSaveSlip = () => {
    const slipId = editId || `slip-${Date.now()}`;
    const newSlip = {
      id: slipId,
      ref_no: refNo,
      site_id: selectedSiteId,
      site_name: selectedSite.name,
      client_name: selectedSite.client,
      maistry_id: selectedMaistryId,
      maistry_name: selectedMaistry.name,
      trade: selectedMaistry.trade,
      start_date: startDate,
      end_date: endDate,
      categories,
      grand_total: grandTotal,
      enable_maistry_pct: enableMaistryPct,
      maistry_pct_value: maistryPctValue,
      round_off: roundOff,
      saved_at: new Date().toISOString()
    };

    const existing = JSON.parse(localStorage.getItem(LOCAL_SLIPS_KEY) || '[]');
    const filtered = existing.filter(s => s.id !== slipId);
    const updated = [newSlip, ...filtered];
    localStorage.setItem(LOCAL_SLIPS_KEY, JSON.stringify(updated));
    setSavedSlips(updated);

    // Also sync to weekly payments list
    try {
      const weeklyPayments = JSON.parse(localStorage.getItem(WEEKLY_PAYMENTS_KEY) || '[]');
      const paymentRecord = {
        id: slipId,
        voucher_no: refNo,
        week_number: `${startDate} to ${endDate}`,
        week_start: startDate,
        week_end: endDate,
        project_id: selectedSiteId,
        project_name: selectedSite.name,
        site_name: selectedSite.name,
        contractor_id: selectedMaistryId,
        contractor_name: selectedMaistry.name,
        trade_category: selectedMaistry.trade,
        work_order_no: `WO-${refNo}`,
        total_mandays: 19.5,
        avg_rate_per_day: 800,
        gross_amount: grandTotal,
        advance_deduction: 0,
        other_deductions: 0,
        net_payable: grandTotal,
        payment_mode: 'RTGS / Bank Transfer',
        status: 'Approved',
        prepared_by: 'Site Engineer'
      };
      const payFiltered = weeklyPayments.filter(p => p.id !== slipId);
      localStorage.setItem(WEEKLY_PAYMENTS_KEY, JSON.stringify([paymentRecord, ...payFiltered]));
    } catch {}

    toast.success(`Maistry slip ${refNo} saved successfully.`);
  };

  const loadSlipIntoForm = (slip) => {
    setSelectedSiteId(slip.site_id || 'SITE-01');
    setSelectedMaistryId(slip.maistry_id || '1');
    setStartDate(slip.start_date || '2026-08-25');
    setEndDate(slip.end_date || '2026-08-31');
    setRefNo(slip.ref_no || `MST-${Date.now().toString().slice(-4)}`);
    if (slip.categories) setCategories(slip.categories);
    setEnableMaistryPct(Boolean(slip.enable_maistry_pct));
    if (slip.maistry_pct_value) setMaistryPctValue(slip.maistry_pct_value);
    setRoundOff(Boolean(slip.round_off));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCsv = () => {
    let csv = `CLIENT,${selectedSite.client},DATE,${endDate}\n`;
    csv += `SITE,${selectedSite.name},TYPE,${selectedMaistry.trade}\n`;
    csv += `MAISTRY,${selectedMaistry.name},REF NO,${refNo}\n\n`;
    csv += `#,Particulars,Rate,${dateColumns.map(d => d.label).join(',')},Qty,Amount\n`;

    let rowNum = 1;
    categories.forEach(cat => {
      csv += `${cat.category},,,,,,,,,\n`;
      cat.items.forEach(item => {
        const qty = item.days.reduce((acc, d) => acc + (Number(d) || 0), 0);
        const amt = qty * (Number(item.rate) || 0);
        csv += `${rowNum},"${item.description}",${item.rate},${item.days.map(d => d || '-').join(',')},${qty},${amt}\n`;
        rowNum++;
      });
    });
    csv += `,,,,,,,,,TOTAL AMOUNT,${grandTotal}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${selectedSite.name}_${selectedMaistry.name}_WeeklySlip.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Downloaded slip CSV.');
  };

  let globalRowCounter = 1;

  return (
    <PageContainer>
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border mb-6">
        <div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/subcontracts/weekly-payments')}
              className="p-1.5 -ml-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-muted transition-colors mr-1"
              title="Back to Weekly Payments list"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-primary border border-border">
              <HardHat className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-text-primary">Maistry Slip</h1>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Weekly work wages statement and 148 × 210 mm printable slip for site maistries.
          </p>
        </div>

        {/* Top Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Saved Slips Dropdown */}
          <div className="relative">
            <Select
              value=""
              onChange={(e) => {
                if (!e.target.value) return;
                const found = savedSlips.find(s => s.id === e.target.value);
                if (found) {
                  loadSlipIntoForm(found);
                  toast.success(`Loaded saved slip ${found.ref_no}`);
                }
              }}
              className="text-xs h-9 py-1 px-2.5 bg-surface border-border font-medium"
            >
              <option value="">Saved Maistry Slips ({savedSlips.length})</option>
              {savedSlips.map(s => (
                <option key={s.id} value={s.id}>
                  {s.ref_no} - {s.maistry_name} (₹{Number(s.grand_total).toLocaleString('en-IN')})
                </option>
              ))}
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/subcontracts/weekly-payments')}
            className="text-xs gap-1.5"
          >
            <List className="w-3.5 h-3.5" />
            Saved Slip List
          </Button>

          {/* White / Yellow Slip Toggle */}
          <div className="flex rounded-md border border-border bg-surface-muted p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setSlipTheme('white')}
              className={`px-3 py-1 rounded transition-colors ${slipTheme === 'white' ? 'bg-white text-text-primary shadow-xs font-bold' : 'text-text-secondary hover:text-text-primary'}`}
            >
              White Slip
            </button>
            <button
              type="button"
              onClick={() => setSlipTheme('yellow')}
              className={`px-3 py-1 rounded transition-colors ${slipTheme === 'yellow' ? 'bg-[#fef9c3] text-amber-900 border border-amber-300 shadow-xs font-bold' : 'text-text-secondary hover:text-text-primary'}`}
            >
              Yellow Slip
            </button>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveSlip}
            className="text-xs gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            Save Slip
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCsv}
            className="text-xs gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="text-xs gap-1.5 bg-slate-900 text-white hover:bg-slate-800 border-slate-900"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Slip
          </Button>
        </div>
      </div>

      {/* Control / Selector Card */}
      <div className="bg-surface rounded-xl border border-border p-4 mb-6 shadow-sm">
        {/* Row 1: Site, Maistry, Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
              1. SELECT SITE
            </label>
            <Select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="w-full text-xs font-medium uppercase"
            >
              {sites.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
              2. SELECT MAISTRY ({maistries.length} ON SITE)
            </label>
            <Select
              value={selectedMaistryId}
              onChange={(e) => setSelectedMaistryId(e.target.value)}
              className="w-full text-xs font-medium"
            >
              {maistries.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} - {m.log_count || 10} Logs
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
              3. START DATE
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
              4. END DATE
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-xs"
            />
          </div>
        </div>

        {/* Quick Ranges */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border mb-3">
          <span className="text-xs text-text-muted font-medium mr-1">Quick Ranges:</span>
          <button
            type="button"
            onClick={handleQuickLast7Days}
            className="px-2.5 py-1 text-xs font-semibold rounded bg-surface-muted hover:bg-border text-text-primary border border-border transition-colors"
          >
            Last 7 Days
          </button>
          <button
            type="button"
            onClick={handleQuickFullRange}
            className="px-2.5 py-1 text-xs font-semibold rounded bg-surface-muted hover:bg-border text-text-primary border border-border transition-colors"
          >
            Full Range (25/08 - 31/08, 1 Logs)
          </button>
        </div>

        {/* Add Line & Options */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-text-muted font-medium mr-1">Add Line:</span>
            <Button
              variant="outline"
              size="xs"
              onClick={() => handleAddRow('LABOUR / MANPOWER')}
              className="text-xs gap-1 text-text-primary"
            >
              <Plus className="w-3 h-3" /> Labour Row
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={() => handleAddRow('EQUIPMENT / RENTALS')}
              className="text-xs gap-1 text-text-primary"
            >
              <Plus className="w-3 h-3" /> Equipment / Rent
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={() => handleAddRow('EXPENSES & CHARGES')}
              className="text-xs gap-1 text-text-primary"
            >
              <Plus className="w-3 h-3" /> Expense Row
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={handleAddCustomCategory}
              className="text-xs gap-1 text-text-primary"
            >
              <Plus className="w-3 h-3" /> Others / Custom Item
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs text-text-primary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enableMaistryPct}
                onChange={(e) => setEnableMaistryPct(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
              />
              <span>{selectedMaistry.name} (%)</span>
            </label>

            <label className="flex items-center gap-1.5 text-xs text-text-primary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={roundOff}
                onChange={(e) => setRoundOff(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
              />
              <span>Round Off (10s)</span>
            </label>

            <Button
              variant="outline"
              size="xs"
              onClick={handleReloadLogs}
              className="text-xs gap-1 text-text-primary"
            >
              <RotateCcw className="w-3 h-3" />
              Reload Logs from DB
            </Button>
          </div>
        </div>
      </div>

      {/* Printable Slip Container */}
      <div className="flex justify-center mb-12">
        <div
          ref={slipPrintRef}
          id="maistry-printable-slip"
          className={`w-full max-w-[850px] border-2 border-black p-6 transition-colors shadow-sm ${
            slipTheme === 'yellow' ? 'bg-[#fffde7] text-black' : 'bg-white text-black'
          }`}
          style={{ minHeight: '600px', fontFamily: 'monospace, sans-serif' }}
        >
          {/* Slip Header Box */}
          <div className="border border-black mb-4">
            <div className="grid grid-cols-2 text-xs border-b border-black">
              <div className="p-2 border-r border-black font-bold uppercase flex items-center gap-2">
                <span className="w-20 inline-block text-black/70">CLIENT :</span>
                <span>{selectedSite.client}</span>
              </div>
              <div className="p-2 font-bold uppercase flex items-center gap-2">
                <span className="w-20 inline-block text-black/70">DATE :</span>
                <span>{endDate.split('-').reverse().join('-')}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 text-xs border-b border-black">
              <div className="p-2 border-r border-black font-bold uppercase flex items-center gap-2">
                <span className="w-20 inline-block text-black/70">SITE :</span>
                <span>{selectedSite.name}</span>
              </div>
              <div className="p-2 font-bold uppercase flex items-center gap-2">
                <span className="w-20 inline-block text-black/70">TYPE :</span>
                <span>{selectedMaistry.trade}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 text-xs">
              <div className="p-2 border-r border-black font-bold uppercase flex items-center gap-2">
                <span className="w-20 inline-block text-black/70">MAISTRY :</span>
                <span>{selectedMaistry.name}</span>
              </div>
              <div className="p-2 font-bold uppercase flex items-center gap-2">
                <span className="w-20 inline-block text-black/70">REF NO :</span>
                <span>{refNo}</span>
              </div>
            </div>
          </div>

          {/* Slip Table */}
          <div className="border border-black overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-black bg-black/5 font-bold uppercase text-[11px]">
                  <th className="p-1.5 border-r border-black w-8 text-center">#</th>
                  <th className="p-1.5 border-r border-black min-w-[180px]">Particulars / Description</th>
                  <th className="p-1.5 border-r border-black w-16 text-right">Rate (₹)</th>
                  {dateColumns.map((col, idx) => (
                    <th key={idx} className="p-1.5 border-r border-black w-12 text-center text-[10px]">
                      {col.label}
                    </th>
                  ))}
                  <th className="p-1.5 border-r border-black w-12 text-center">Qty</th>
                  <th className="p-1.5 w-20 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat, catIdx) => (
                  <React.Fragment key={cat.category}>
                    {/* Category Header Row */}
                    <tr className="bg-black/5 border-b border-black font-bold text-[10px] tracking-wider uppercase">
                      <td colSpan={12} className="p-1.5 pl-3">
                        {cat.category}
                      </td>
                    </tr>

                    {/* Category Items */}
                    {cat.items.map((item, itemIdx) => {
                      const currentRowNum = globalRowCounter++;
                      const qty = item.days.reduce((acc, d) => acc + (Number(d) || 0), 0);
                      const amount = qty * (Number(item.rate) || 0);

                      return (
                        <tr key={item.id} className="border-b border-black/80 hover:bg-black/5 group">
                          <td className="p-1.5 border-r border-black text-center font-bold">
                            {currentRowNum}
                          </td>
                          <td className="p-1 border-r border-black font-semibold">
                            <div className="flex items-center justify-between">
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) => handleUpdateItem(catIdx, itemIdx, 'description', e.target.value)}
                                className="w-full bg-transparent border-none p-0 focus:outline-none focus:ring-0 text-xs font-semibold"
                                placeholder="Description..."
                              />
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(catIdx, itemIdx)}
                                className="opacity-0 group-hover:opacity-100 text-black/40 hover:text-black p-0.5 print:hidden"
                                title="Remove row"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="p-1 border-r border-black text-right">
                            <input
                              type="number"
                              value={item.rate === 0 ? '0' : item.rate}
                              onChange={(e) => handleUpdateItem(catIdx, itemIdx, 'rate', e.target.value)}
                              className="w-full bg-transparent border-none p-0 text-right focus:outline-none focus:ring-0 text-xs font-mono font-medium"
                            />
                          </td>
                          {item.days.map((dayVal, dayIdx) => (
                            <td key={dayIdx} className="p-0.5 border-r border-black text-center">
                              <input
                                type="text"
                                value={dayVal === '' ? '' : dayVal}
                                onChange={(e) => handleUpdateDay(catIdx, itemIdx, dayIdx, e.target.value)}
                                placeholder="-"
                                className="w-full bg-transparent border-none p-0 text-center focus:outline-none focus:ring-0 text-xs font-mono placeholder:text-black/30"
                              />
                            </td>
                          ))}
                          <td className="p-1.5 border-r border-black text-center font-mono font-bold">
                            {qty > 0 ? qty : 0}
                          </td>
                          <td className="p-1.5 text-right font-mono font-bold">
                            {amount > 0 ? amount : 0}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}

                {/* Total Row */}
                <tr className="border-t-2 border-black font-bold text-xs bg-black/5">
                  <td colSpan={11} className="p-2 text-right uppercase tracking-wider font-extrabold border-r border-black">
                    TOTAL AMOUNT :
                  </td>
                  <td className="p-2 text-right font-mono text-sm font-black">
                    ₹{grandTotal.toLocaleString('en-IN')}
                  </td>
                </tr>

                {enableMaistryPct && (
                  <tr className="border-t border-black font-bold text-xs">
                    <td colSpan={11} className="p-1.5 text-right uppercase tracking-wider border-r border-black text-[11px]">
                      {selectedMaistry.name} ({maistryPctValue}%) :
                    </td>
                    <td className="p-1.5 text-right font-mono text-xs">
                      ₹{maistryCommission.toLocaleString('en-IN')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Signatures Area */}
          <div className="grid grid-cols-3 gap-8 pt-16 text-center text-xs font-bold uppercase tracking-wider mt-8">
            <div>
              <div className="border-t-2 border-black pt-1.5">
                Engineer
              </div>
            </div>
            <div>
              <div className="border-t-2 border-black pt-1.5">
                Supervisor
              </div>
            </div>
            <div>
              <div className="border-t-2 border-black pt-1.5">
                Receiver
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
