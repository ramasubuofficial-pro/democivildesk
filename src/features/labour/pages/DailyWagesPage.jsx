import { useState, useEffect, useMemo } from 'react';
import {
  Building2, Plus, Wallet, Search, CheckCircle2,
  MapPin, Clock, ArrowRight, ShieldCheck, UserCircle, Eye,
  FileText, Trash2, Tag, Calendar, ArrowLeft
} from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageContainer } from '../../../components/layout/PageContainer';
import { DataTableContainer } from '../../../components/composite/DataTableContainer';
import { Pagination } from '../../../components/composite/Pagination';
import { SearchField } from '../../../components/composite/SearchField';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { Input } from '../../../components/ui/Input';
import { FormField } from '../../../components/composite/FormField';
import { toast } from '../../../components/composite/Toast';
import { request } from '../../../api/apiservice';

const LEGACY_MOCK_CONTRACTOR_CODES = new Set(['SUB-2026-001', 'SUB-2026-002', 'SUB-2026-003', 'SUB-2026-004']);
const LEGACY_MOCK_TEMPLATES = new Set([
  'MM', 'FM', 'Concrete Mixer', 'Lead Carpenter', 'Assistant Carpenter',
  'Wood Cutting Machine', 'Centering Mestri', 'Centering Helper',
  'Scaffolding & Props Set', 'Bar Bender Skilled', 'Bar Bender Helper',
  'Rebar Bending & Cutting Unit'
]);


export function DailyWagesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Add Wages Form State - Defaults to first site
  const [selectedSite, setSelectedSite] = useState(null);
  const [viewingSite, setViewingSite] = useState(null);
  const [subcontractors, setSubcontractors] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedSubcontractorId, setSelectedSubcontractorId] = useState('');
  const [wageDate, setWageDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [wageEntries, setWageEntries] = useState({});
  const [wageRates, setWageRates] = useState({});
  const [wageRemarks, setWageRemarks] = useState({});
  const [globalRemarks, setGlobalRemarks] = useState('');
  const [customItems, setCustomItems] = useState([]);
  
  const [itemFilter, setItemFilter] = useState('All');
  const [itemSearch, setItemSearch] = useState('');

  const [dailyWagesList, setDailyWagesList] = useState([]); // Will hold data from backend
  const [sitesList, setSitesList] = useState([]);

  useEffect(() => {
    const fetchSites = async () => {
      try {
        const res = await request.get('/sites');
        const list = res?.data?.sites ?? res?.sites ?? (Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);
        setSitesList(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('Failed to load sites:', err);
      }
    };
    fetchSites();

    const fetchData = async () => {
      try {
        const subsRes = await request.get('/subcontracts/contractors');
        let finalSubs = subsRes?.data?.subcontractors ?? subsRes?.data?.data ?? subsRes?.subcontractors ?? subsRes?.data ?? subsRes ?? [];
        if (!Array.isArray(finalSubs)) finalSubs = [];
        setSubcontractors(finalSubs);
        if (finalSubs.length > 0) {
          setSelectedSubcontractorId(String(finalSubs[0].id));
        }
      } catch (err) {
        toast.error('Failed to load subcontractors');
      }
    };
    fetchData();

    const fetchDailyWages = async () => {
      try {
        const response = await request.get('/daily-wages');
        let wages = [];
        if (Array.isArray(response)) wages = response;
        else if (Array.isArray(response?.data)) wages = response.data;
        else if (Array.isArray(response?.data?.data)) wages = response.data.data;
        else if (Array.isArray(response?.daily_wages)) wages = response.daily_wages;
        else if (Array.isArray(response?.data?.daily_wages)) wages = response.data.daily_wages;
        else if (Array.isArray(response?.wages)) wages = response.wages;
        else if (Array.isArray(response?.data?.wages)) wages = response.data.wages;
        
        setDailyWagesList(wages);
      } catch (err) {
        toast.error('Failed to load daily wages from backend');
        setDailyWagesList([]);
      }
    };
    fetchDailyWages();
  }, []);

  useEffect(() => {
    const fetchTemplates = async () => {
      if (!selectedSubcontractorId) {
        setTemplates([]);
        return;
      }
      const selectedSub = subcontractors.find(s => String(s.id) === String(selectedSubcontractorId));
      if (!selectedSub) return;
      const typeId = selectedSub.subcontractor_type_id || selectedSub.contractor_type_id;
      if (!typeId) {
        setTemplates([]);
        return;
      }
      try {
        const res = await request.get(`/subcontracts/types/${typeId}/templates`);
        const backendData = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : (Object.values(res || {}).find(Array.isArray) || Object.values(res?.data || {}).find(Array.isArray) || []));
        const normalizedTemplates = backendData.map(t => ({
          ...t,
          id: Number(t.id),
          type_id: t.subcontractor_type_id || t.type_id,
          description: t.item_description || t.description || t.template_name || t.name,
          uom: t.unit || t.uom,
          is_active: t.status == 1 || t.is_active == 1 || t.is_active === true,
          calculate_maistry: t.maistry_scope == 1 || t.calculate_maistry == 1,
          classification: t.classification || 'Labour'
        }));
        setTemplates(normalizedTemplates);
      } catch (err) {
        toast.error('Failed to load templates for this subcontractor');
        setTemplates([]);
      }
    };
    fetchTemplates();
  }, [selectedSubcontractorId, subcontractors]);

  const handleOpenWages = (site) => {
    setSelectedSite(site);
    setSelectedSubcontractorId(subcontractors.length > 0 ? String(subcontractors[0].id) : '');
    setWageEntries({});
    setWageRates({});
    setWageRemarks({});
    setGlobalRemarks('');
    setCustomItems([]);
    setItemFilter('All');
    setItemSearch('');
    setWageDate(new Date().toISOString().split('T')[0]);
  };

  const handleCloseWages = () => {
    setSelectedSite(null);
  };

  const selectedSub = subcontractors.find(s => String(s.id) === String(selectedSubcontractorId));
  const availableTemplates = useMemo(() => {
    if (!selectedSub) return [];
    return templates.filter(t => Boolean(t.is_active));
  }, [selectedSub, templates]);

  // Set default rates when subcontractor changes
  useEffect(() => {
    if (availableTemplates.length > 0) {
      const initialRates = {};
      availableTemplates.forEach(t => {
        initialRates[t.id] = t.default_rate;
      });
      setWageRates(prev => ({ ...prev, ...initialRates }));
    }
  }, [availableTemplates]);

  const handleAddCustomItem = () => {
    const newId = `custom-${Date.now()}`;
    setCustomItems(prev => [...prev, {
      id: newId,
      description: '',
      classification: 'Manpower',
      uom: 'shift',
      default_rate: 0,
      isCustom: true
    }]);
  };

  const handleCustomItemChange = (id, field, value) => {
    setCustomItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleRemoveItem = (id, isCustom) => {
    if (isCustom) {
      setCustomItems(prev => prev.filter(item => item.id !== id));
    }
    setWageEntries(prev => { const next = {...prev}; delete next[id]; return next; });
    setWageRemarks(prev => { const next = {...prev}; delete next[id]; return next; });
    if (!isCustom) {
       // Reset rate to default
       const template = availableTemplates.find(t => t.id === id);
       if (template) {
         setWageRates(prev => ({ ...prev, [id]: template.default_rate }));
       }
    }
  };

  const allTemplates = useMemo(() => {
    return [...availableTemplates, ...customItems];
  }, [availableTemplates, customItems]);

  const filteredTemplates = useMemo(() => {
    return allTemplates.filter(t => {
      const matchesSearch = t.description.toLowerCase().includes(itemSearch.toLowerCase());
      const matchesFilter = itemFilter === 'All' || 
                            (itemFilter === 'Expenses' && (t.classification === 'Expense' || t.classification === 'Expenses')) ||
                            t.classification === itemFilter;
      return matchesSearch && matchesFilter;
    });
  }, [allTemplates, itemSearch, itemFilter]);

  const filledItemsCount = useMemo(() => {
    return allTemplates.filter(t => Number(wageEntries[t.id]) > 0).length;
  }, [allTemplates, wageEntries]);

  const totalWages = useMemo(() => {
    return allTemplates.reduce((acc, t) => {
      const rate = wageRates[t.id] !== undefined && wageRates[t.id] !== '' 
        ? Number(wageRates[t.id]) 
        : Number(t.default_rate || 0);
      const shift = Number(wageEntries[t.id] || 0);
      return acc + (rate * shift);
    }, 0);
  }, [allTemplates, wageRates, wageEntries]);

  const handleSubmitWages = (e) => {
    e.preventDefault();
    if (!selectedSubcontractorId) {
      toast.error('Please select a subcontractor.');
      return;
    }

    if (filledItemsCount === 0) {
      toast.error('Please enter shifts for at least one item.');
      return;
    }

    const submitData = async () => {
      try {
        const submittedItems = allTemplates
          .filter(t => Number(wageEntries[t.id]) > 0)
          .map(t => ({
            id: t.id,
            description: t.description,
            classification: t.classification,
            uom: t.uom,
            shift: wageEntries[t.id],
            rate: wageRates[t.id] !== undefined && wageRates[t.id] !== '' ? Number(wageRates[t.id]) : Number(t.default_rate || 0),
            remarks: wageRemarks[t.id] || '',
            isCustom: t.isCustom
          }));

        const newEntry = {
          project_id: selectedSite.project_id || 1, // Validation requires project_id
          site_id: selectedSite.id,
          subcontractor_id: selectedSubcontractorId,
          wage_date: wageDate,
          global_remarks: globalRemarks,
          lines: submittedItems.map(item => {
            const cls = String(item.classification || '').toLowerCase();
            let mappedClass = 'Manpower';
            if (cls.includes('equip')) mappedClass = 'Equipment';
            else if (cls.includes('expens')) mappedClass = 'Expense';

            return {
              description: item.description,
              classification: mappedClass,
              uom: item.uom,
              quantity: Number(item.shift) || 0,
              rate: Number(item.rate) || 0,
              amount: (Number(item.shift) || 0) * (Number(item.rate) || 0),
              remarks: item.remarks || ''
            };
          })
        };
        
        await request.post('/daily-wages', newEntry);
        
        // Refresh list from backend after successful submit
        const response = await request.get('/daily-wages');
        let wages = [];
        if (Array.isArray(response)) wages = response;
        else if (Array.isArray(response?.data)) wages = response.data;
        else if (Array.isArray(response?.data?.data)) wages = response.data.data;
        else if (Array.isArray(response?.daily_wages)) wages = response.daily_wages;
        else if (Array.isArray(response?.data?.daily_wages)) wages = response.data.daily_wages;
        else if (Array.isArray(response?.wages)) wages = response.wages;
        else if (Array.isArray(response?.data?.wages)) wages = response.data.wages;
        
        setDailyWagesList(wages);

        toast.success('Daily wages submitted successfully.');
        handleCloseWages();
      } catch {
        toast.error('Failed to save daily wages.');
      }
    };
    submitData();
  };

  const filteredSites = useMemo(() => {
    if (!searchQuery) return sitesList;
    const q = searchQuery.toLowerCase();
    return sitesList.filter(s =>
      (s.site_name || s.name || '').toLowerCase().includes(q) ||
      (s.site_code || '').toLowerCase().includes(q) ||
      (s.project_name || '').toLowerCase().includes(q) ||
      (s.project_code || '').toLowerCase().includes(q)
    );
  }, [searchQuery, sitesList]);

  const totalPages = Math.max(1, Math.ceil(filteredSites.length / perPage));
  const pagedSites = filteredSites.slice((page - 1) * perPage, page * perPage);

  const getSiteWageStatus = (siteId) => {
    const today = new Date().toISOString().split('T')[0];
    const hasSubmittedToday = dailyWagesList.some(w => {
      const wDate = (w.date || w.wage_date || '').split('T')[0];
      const sId = String(w.site_id || w.project_site_id);
      return sId === String(siteId) && wDate === today;
    });
    return hasSubmittedToday ? 'SUBMITTED' : 'PENDING';
  };

  const getStatusVariant = (status) => {
    return status === 'SUBMITTED' ? 'success' : 'warning';
  };

  if (viewingSite) {
    const today = new Date().toISOString().split('T')[0];
    const todaysEntries = dailyWagesList.filter(w => {
      const wDate = (w.date || w.wage_date || '').split('T')[0];
      const sId = String(w.site_id || w.project_site_id);
      return sId === String(viewingSite.id) && wDate === today;
    });

    return (
      <PageContainer>
        <div className="flex items-center gap-3 mb-4">
          <button 
            onClick={() => setViewingSite(null)}
            className="p-2 -ml-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-text-primary">View Submitted Wages</h1>
            <p className="text-[13px] text-text-secondary">For {viewingSite.site_name} on {today}</p>
          </div>
        </div>

        {todaysEntries.length === 0 ? (
          <div className="bg-surface rounded-xl border border-border shadow-sm p-8 text-center text-text-muted">
            No wages submitted for today yet.
          </div>
        ) : (
          <div className="space-y-6">
            {todaysEntries.map((entry, index) => {
              const sub = subcontractors.find(s => String(s.id) === String(entry.subcontractor_id));
              
              let allEntryItems = [];
              if (entry.lines && Array.isArray(entry.lines)) {
                allEntryItems = entry.lines.map(line => ({
                  id: line.id || line.template_id || `line-${Math.random()}`,
                  description: line.item_description || line.description,
                  classification: line.classification || 'Labour',
                  uom: line.uom || line.unit || 'Shift',
                  shift: line.qty || line.shift || 0,
                  rate: line.rate || 0,
                  remarks: line.remarks || ''
                }));
              } else if (entry.submittedItems) {
                allEntryItems = entry.submittedItems;
              } else {
                if (entry.entries) {
                  Object.keys(entry.entries).forEach(itemId => {
                    if (!String(itemId).startsWith('custom-')) {
                      const t = templates.find(temp => String(temp.id) === String(itemId)) || {
                        id: itemId, description: `Item ${itemId}`, classification: 'Labour', uom: 'shift'
                      };
                      if (t) {
                        allEntryItems.push({
                          ...t,
                          shift: entry.entries[itemId],
                          rate: entry.rates?.[itemId] || 0,
                          remarks: entry.remarks?.[itemId] || ''
                        });
                      }
                    }
                  });
                }
                if (entry.customItems) {
                  entry.customItems.forEach(ci => {
                    if (entry.entries?.[ci.id]) {
                      allEntryItems.push({
                        ...ci,
                        shift: entry.entries[ci.id],
                        rate: entry.rates?.[ci.id] || 0,
                        remarks: entry.remarks?.[ci.id] || ''
                      });
                    }
                  });
                }
              }

              const entryTotal = allEntryItems.reduce((acc, item) => acc + (Number(item.shift) * Number(item.rate)), 0);

              return (
                <div key={entry.id || index} className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
                  <div className="bg-primary/5 p-4 border-b border-border flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-text-primary">{sub?.contractor_name || 'Unknown Subcontractor'}</h3>
                      <p className="text-[12px] text-text-secondary">{sub?.subcontractor_type_label || 'Trade'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[12px] text-text-secondary font-medium">Total Wages</p>
                      <p className="font-bold text-primary">₹{entryTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[12px]">
                      <thead className="bg-surface-muted text-text-secondary text-[10px] uppercase font-bold border-b border-border">
                        <tr>
                          <th className="px-4 py-3">Item</th>
                          <th className="px-4 py-3 text-center">Type</th>
                          <th className="px-4 py-3 text-center">Unit</th>
                          <th className="px-4 py-3 text-center">Qty</th>
                          <th className="px-4 py-3 text-center">Rate (₹)</th>
                          <th className="px-4 py-3 text-center">Amount (₹)</th>
                          <th className="px-4 py-3">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {allEntryItems.map(item => {
                          const amount = Number(item.shift) * Number(item.rate);
                          const isExpense = item.classification === 'Expense' || item.classification === 'Expenses';
                          const isEquipment = item.classification === 'Equipment';
                          const badgeColors = isExpense ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                              isEquipment ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                              'bg-indigo-100 text-indigo-800 border-indigo-200';
                          return (
                            <tr key={item.id} className="hover:bg-surface-muted/30">
                              <td className="px-4 py-2.5 font-bold text-text-primary">{item.description}</td>
                              <td className="px-4 py-2.5 text-center">
                                <Badge className={`text-[9px] uppercase tracking-wider font-bold gap-1 py-0.5 px-2 ${badgeColors}`}>
                                  {item.classification}
                                </Badge>
                              </td>
                              <td className="px-4 py-2.5 text-center text-text-secondary">{item.uom}</td>
                              <td className="px-4 py-2.5 text-center font-bold">{item.shift}</td>
                              <td className="px-4 py-2.5 text-center">{Number(item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td className="px-4 py-2.5 text-center font-bold text-text-primary">
                                ₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-2.5 text-text-secondary">{item.remarks || '—'}</td>
                            </tr>
                          );
                        })}
                        {allEntryItems.length === 0 && (
                          <tr>
                            <td colSpan="7" className="px-4 py-8 text-center text-text-muted text-[13px]">
                              No items recorded for this entry.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {entry.globalRemarks && (
                    <div className="p-4 border-t border-border bg-surface-muted/30">
                      <p className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">Overall Remarks</p>
                      <p className="text-[13px] text-text-primary">{entry.globalRemarks}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </PageContainer>
    );
  }

  if (selectedSite) {
    return (
      <PageContainer>
        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <button 
            onClick={handleCloseWages}
            className="p-1.5 sm:p-2 -ml-1 sm:-ml-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-text-primary">Submit Daily Wages</h1>
            <p className="text-xs sm:text-[13px] text-text-secondary">For {selectedSite.site_name}</p>
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-border shadow-sm flex flex-col w-full mb-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-6 border-b border-border bg-primary/5 rounded-t-xl">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-surface flex items-center justify-center text-primary shadow-sm border border-border shrink-0">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-text-primary leading-tight">New Daily Entry</h2>
                <p className="text-xs sm:text-[13px] text-text-secondary mt-0.5">Select subcontractor & date to auto-load trade items</p>
              </div>
            </div>
            <Badge variant="success" className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1.5 px-2.5 py-1 text-xs self-start sm:self-auto shadow-sm font-bold shrink-0">
              <Tag className="w-3.5 h-3.5" />
              {availableTemplates.length} items loaded
            </Badge>
          </div>

          <form onSubmit={handleSubmitWages} className="flex flex-col flex-1">
            <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6">
              {/* Form Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <FormField label="SUBCONTRACTOR" required>
                  <Select
                    leftIcon={<Search className="w-4 h-4 text-text-muted" />}
                    options={[
                      { value: '', label: 'Select a Subcontractor...' },
                      ...subcontractors.map(s => ({
                        value: String(s.id),
                        label: s.contractor_name || s.name
                      }))
                    ]}
                    value={selectedSubcontractorId}
                    onChange={(val) => {
                      if (val === 'search') {
                        // TODO: Open a search modal or implement searchable dropdown logic
                        toast.info('Search functionality will be implemented by backend team');
                      } else {
                        setSelectedSubcontractorId(val);
                      }
                    }}
                    className="w-full"
                  />
                </FormField>
                <FormField label="LOG DATE" required>
                  <div className="relative">
                    <Input
                      type="date"
                      value={wageDate}
                      onChange={(e) => setWageDate(e.target.value)}
                      className="w-full pl-10 h-10 sm:h-11 border-2 focus:border-primary font-medium text-xs sm:text-sm"
                    />
                    <Calendar className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </FormField>
              </div>
              
              {selectedSubcontractorId && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 sm:p-3.5 flex flex-wrap items-center gap-2 text-xs sm:text-[13px] text-primary shadow-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="font-semibold">Trade: {selectedSub?.subcontractor_type_label || 'General'}</span>
                  <span className="text-primary/70">•</span>
                  <span className="font-medium">{availableTemplates.length} trade items auto-loaded</span>
                </div>
              )}

              {/* Filters & Table section */}
              {selectedSubcontractorId && (
                <div className="space-y-4 pt-3 sm:pt-4 border-t border-border">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="w-full sm:w-80">
                      <SearchField
                        placeholder="Filter loaded items (e.g. Mason, Tea)..."
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        className="h-9 sm:h-10 text-xs sm:text-sm"
                      />
                    </div>
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden sm:block border border-border rounded-xl overflow-x-auto shadow-sm">
                    <table className="w-full text-left text-[12px] table-fixed">
                      <thead className="bg-surface-muted text-text-secondary text-[10px] uppercase font-bold border-b border-border tracking-wider">
                        <tr>
                          <th className="px-2 py-3.5 w-10 text-center">#</th>
                          <th className="px-2 py-3.5 w-[18%]">ITEM</th>
                          <th className="px-2 py-3.5 w-[12%] text-center">TYPE</th>
                          <th className="px-2 py-3.5 w-[8%] text-center">UNIT</th>
                          <th className="px-2 py-3.5 w-[14%] text-center">QTY</th>
                          <th className="px-2 py-3.5 w-[14%] text-center">RATE (₹)</th>
                          <th className="px-2 py-3.5 w-[14%] text-center">AMOUNT (₹)</th>
                          <th className="px-2 py-3.5 w-[16%]">REMARKS</th>
                          <th className="px-2 py-3.5 w-10 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border bg-surface">
                        {filteredTemplates.length === 0 ? (
                          <tr>
                            <td colSpan="9" className="px-4 py-8 text-center text-text-muted text-[13px]">
                              No items found.
                            </td>
                          </tr>
                        ) : (
                          filteredTemplates.map((t, idx) => {
                            const qty = Number(wageEntries[t.id] || 0);
                            const rate = Number(wageRates[t.id] !== undefined ? wageRates[t.id] : (t.default_rate || 0));
                            const amount = qty * rate;
                            const isExpense = t.classification === 'Expense' || t.classification === 'Expenses';
                            const isEquipment = t.classification === 'Equipment';
                            const badgeColors = isExpense ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                                isEquipment ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                                'bg-indigo-100 text-indigo-800 border-indigo-200';
                            
                            return (
                              <tr key={t.id} className="hover:bg-surface-muted/30 transition-colors group">
                                <td className="px-2 py-3 text-center font-medium text-text-secondary">{idx + 1}</td>
                                <td className="px-2 py-3 font-bold text-text-primary text-[13px]">
                                  {t.isCustom ? (
                                    <Input 
                                      value={t.description} 
                                      onChange={(e) => handleCustomItemChange(t.id, 'description', e.target.value)}
                                      className="h-8 text-[12px] font-bold w-full"
                                      placeholder="Item Name"
                                    />
                                  ) : t.description}
                                </td>
                                <td className="px-2 py-3 text-center align-middle">
                                  {t.isCustom ? (
                                     <Select 
                                       value={t.classification}
                                       onChange={(val) => handleCustomItemChange(t.id, 'classification', val)}
                                       options={[
                                         {value: 'Manpower', label: 'Manpower'},
                                         {value: 'Equipment', label: 'Equipment'},
                                         {value: 'Expense', label: 'Expense'}
                                       ]}
                                       className="h-8 text-[11px] w-full"
                                     />
                                  ) : (
                                    <Badge className={`text-[9px] uppercase tracking-wider font-bold gap-1 py-0.5 px-2 ${badgeColors}`}>
                                      {isExpense ? <Wallet className="w-3 h-3" /> : (isEquipment ? <Building2 className="w-3 h-3" /> : <UserCircle className="w-3 h-3" />)}
                                      {t.classification}
                                    </Badge>
                                  )}
                                </td>
                                <td className="px-2 py-3 text-center text-text-secondary font-medium">
                                  {t.isCustom ? (
                                    <Input 
                                      value={t.uom} 
                                      onChange={(e) => handleCustomItemChange(t.id, 'uom', e.target.value)}
                                      className="h-8 text-[12px] text-center w-full"
                                    />
                                  ) : t.uom}
                                </td>
                                <td className="px-2 py-3">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    className="h-8 text-center font-bold"
                                    value={wageEntries[t.id] || ''}
                                    onChange={(e) => setWageEntries(prev => ({ ...prev, [t.id]: e.target.value }))}
                                  />
                                </td>
                                <td className="px-2 py-3">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    className="h-8 text-center font-medium"
                                    value={wageRates[t.id] !== undefined ? wageRates[t.id] : (t.default_rate || '')}
                                    onChange={(e) => setWageRates(prev => ({ ...prev, [t.id]: e.target.value }))}
                                  />
                                </td>
                                <td className="px-2 py-3 text-center font-bold text-[14px] text-text-primary">
                                  ₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="px-2 py-3">
                                  <Input
                                    className="h-8 text-[12px]"
                                    placeholder="—"
                                    value={wageRemarks[t.id] || ''}
                                    onChange={(e) => setWageRemarks(prev => ({ ...prev, [t.id]: e.target.value }))}
                                  />
                                </td>
                                <td className="px-2 py-3 text-center">
                                  <button 
                                    type="button" 
                                    onClick={() => handleRemoveItem(t.id, t.isCustom)}
                                    className="p-1.5 text-text-muted hover:text-red-600 hover:bg-red-50 rounded-md transition-colors opacity-50 group-hover:opacity-100"
                                    title="Clear / Remove"
                                  >
                                    <Trash2 className="w-4.5 h-4.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      <tfoot className="bg-surface-muted border-t-2 border-border">
                        <tr>
                          <td colSpan="6" className="px-4 py-4 text-right font-extrabold text-[12px] text-text-primary tracking-wider">
                            GRAND TOTAL ({filledItemsCount} ITEMS FILLED)
                          </td>
                          <td className="px-4 py-4 text-center font-black text-[16px] text-emerald-600">
                            ₹{totalWages.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td colSpan="2"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Mobile Cards View (< sm) */}
                  <div className="block sm:hidden space-y-3">
                    {filteredTemplates.length === 0 ? (
                      <div className="p-6 text-center text-text-muted text-xs bg-surface border border-border rounded-xl">
                        No items found.
                      </div>
                    ) : (
                      filteredTemplates.map((t, idx) => {
                        const qty = Number(wageEntries[t.id] || 0);
                        const rate = Number(wageRates[t.id] !== undefined ? wageRates[t.id] : (t.default_rate || 0));
                        const amount = qty * rate;
                        const isExpense = t.classification === 'Expense' || t.classification === 'Expenses';
                        const isEquipment = t.classification === 'Equipment';
                        const badgeColors = isExpense ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                            isEquipment ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                            'bg-indigo-100 text-indigo-800 border-indigo-200';

                        return (
                          <div key={t.id} className="bg-surface border border-border rounded-xl p-3.5 shadow-xs space-y-3">
                            {/* Card Header: #, Name, Classification Badge, Remove */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <span className="w-5 h-5 rounded-full bg-surface-muted text-text-secondary font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                                  {idx + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  {t.isCustom ? (
                                    <Input 
                                      value={t.description} 
                                      onChange={(e) => handleCustomItemChange(t.id, 'description', e.target.value)}
                                      className="h-8 text-[12px] font-bold w-full"
                                      placeholder="Item Name"
                                    />
                                  ) : (
                                    <h4 className="font-bold text-text-primary text-[13px] leading-snug">{t.description}</h4>
                                  )}
                                  
                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    {t.isCustom ? (
                                      <Select 
                                        value={t.classification}
                                        onChange={(val) => handleCustomItemChange(t.id, 'classification', val)}
                                        options={[
                                          {value: 'Manpower', label: 'Manpower'},
                                          {value: 'Equipment', label: 'Equipment'},
                                          {value: 'Expense', label: 'Expense'}
                                        ]}
                                        className="h-7 text-[10px] w-28"
                                      />
                                    ) : (
                                      <Badge className={`text-[8px] uppercase tracking-wider font-bold gap-1 py-0.5 px-1.5 ${badgeColors}`}>
                                        {isExpense ? <Wallet className="w-2.5 h-2.5" /> : (isEquipment ? <Building2 className="w-2.5 h-2.5" /> : <UserCircle className="w-2.5 h-2.5" />)}
                                        {t.classification}
                                      </Badge>
                                    )}
                                    <span className="text-[10px] text-text-secondary bg-surface-muted px-1.5 py-0.5 rounded border border-border">
                                      {t.isCustom ? (
                                        <input 
                                          value={t.uom} 
                                          onChange={(e) => handleCustomItemChange(t.id, 'uom', e.target.value)}
                                          className="w-12 bg-transparent text-center font-medium"
                                          placeholder="Unit"
                                        />
                                      ) : `Unit: ${t.uom}`}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <button 
                                type="button" 
                                onClick={() => handleRemoveItem(t.id, t.isCustom)}
                                className="p-1.5 text-text-muted hover:text-red-600 hover:bg-red-50 rounded-md transition-colors shrink-0"
                                title="Clear / Remove"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Qty, Rate, Amount Inputs Grid */}
                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60">
                              <div>
                                <label className="block text-[10px] uppercase font-bold text-text-secondary mb-1">
                                  Qty
                                </label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  className="h-9 text-center font-bold text-xs"
                                  placeholder="0"
                                  value={wageEntries[t.id] || ''}
                                  onChange={(e) => setWageEntries(prev => ({ ...prev, [t.id]: e.target.value }))}
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] uppercase font-bold text-text-secondary mb-1">
                                  Rate (₹)
                                </label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  className="h-9 text-center font-medium text-xs"
                                  placeholder="0"
                                  value={wageRates[t.id] !== undefined ? wageRates[t.id] : (t.default_rate || '')}
                                  onChange={(e) => setWageRates(prev => ({ ...prev, [t.id]: e.target.value }))}
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] uppercase font-bold text-text-secondary mb-1">
                                  Amount (₹)
                                </label>
                                <div className="h-9 flex items-center justify-center font-bold text-xs bg-surface-muted/60 rounded-md border border-border text-text-primary">
                                  ₹{amount > 0 ? amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '0'}
                                </div>
                              </div>
                            </div>

                            {/* Remarks Input */}
                            <div className="pt-1">
                              <Input
                                className="h-8 text-[11px]"
                                placeholder="Remarks (optional)..."
                                value={wageRemarks[t.id] || ''}
                                onChange={(e) => setWageRemarks(prev => ({ ...prev, [t.id]: e.target.value }))}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* Mobile Grand Total Card */}
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-text-secondary block">Grand Total</span>
                        <span className="text-xs text-text-muted font-medium">{filledItemsCount} items filled</span>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-black text-emerald-600">
                          ₹{totalWages.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleAddCustomItem} className="gap-2 text-primary border-primary/30 hover:bg-primary/5 font-semibold shadow-sm text-xs">
                      <Plus className="w-3.5 h-3.5" />
                      Add Custom Item
                    </Button>
                  </div>
                  
                  <div className="pt-2 sm:pt-4">
                    <label className="block text-[10px] sm:text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5 sm:mb-2">
                      REMARKS (OPTIONAL)
                    </label>
                    <textarea 
                      className="w-full min-h-[70px] sm:min-h-[80px] rounded-lg border border-border bg-surface p-3 text-xs sm:text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y shadow-sm"
                      placeholder="Any additional site notes for the day..."
                      value={globalRemarks}
                      onChange={(e) => setGlobalRemarks(e.target.value)}
                    ></textarea>
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="mt-auto border-t border-border bg-surface-muted/30 px-3.5 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-b-xl">
              <div className="text-xs sm:text-[13px] font-semibold text-text-secondary text-center sm:text-left">
                <span className="text-text-primary font-bold">{filledItemsCount}</span> of {allTemplates.length} items logged
              </div>
              <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                 <Button type="button" variant="outline" onClick={handleCloseWages} className="font-semibold flex-1 sm:flex-none px-4 sm:px-6 h-9 sm:h-10 text-xs sm:text-sm">
                   Cancel
                 </Button>
                 <Button 
                   type="submit" 
                   variant="primary" 
                   className="bg-gray-900 hover:bg-gray-800 text-white font-semibold flex-1 sm:flex-none px-4 sm:px-6 h-9 sm:h-10 text-xs sm:text-sm shadow-md truncate"
                   disabled={!selectedSubcontractorId || filledItemsCount === 0}
                 >
                   Submit Daily Log
                 </Button>
              </div>
            </div>
          </form>
        </div>
      </PageContainer>
    );
  }

  // Original list view rendering
  return (
    <PageContainer>
      <PageHeader
        title="Daily Wages"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Labour & Attendance', href: '/labour' },
          { label: 'Daily Wages' }
        ]}
      />

      <div className="flex flex-col gap-3 sm:gap-4 w-full">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-surface border border-border rounded-lg p-2.5 sm:p-3 shadow-xs">
          <div className="w-full sm:w-72">
            <SearchField
              placeholder="Search by site or project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Desktop & Tablet Table */}
        <div className="hidden sm:block">
          <DataTableContainer
            pagination={
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={filteredSites.length}
                itemsPerPage={perPage}
                onPageChange={setPage}
              />
            }
          >
            <table className="w-full text-left text-[12px] table-auto">
              <thead className="bg-surface-muted text-text-secondary text-[11px] uppercase font-semibold border-b border-border tracking-wider">
                <tr>
                  <th className="px-3 py-2.5 w-10 text-center">#</th>
                  <th className="px-3 py-2.5">Site Details</th>
                  <th className="px-3 py-2.5">Associated Project</th>
                  <th className="px-3 py-2.5">Site Type</th>
                  <th className="px-3 py-2.5">Location & City</th>
                  <th className="px-3 py-2.5">Site Incharge</th>
                  <th className="px-3 py-2.5 text-center w-28">Wages Status</th>
                  <th className="px-3 py-2.5 text-center w-36">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pagedSites.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-8 text-text-muted text-[12px]">
                      No sites found.
                    </td>
                  </tr>
                ) : (
                  pagedSites.map((site, idx) => (
                    <tr key={site.id} className="hover:bg-surface-muted/30 transition-colors group">
                      <td className="px-3 py-2.5 text-center font-medium text-text-primary text-[11px]">
                        {(page - 1) * perPage + idx + 1}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-text-primary text-[13px] leading-tight truncate">
                            {site.site_name || site.name}
                          </span>
                          <span className="font-mono text-[10px] text-text-muted">
                            {site.site_code}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col min-w-0">
                          <span className="text-text-primary text-[12px] truncate">
                            {site.project_name}
                          </span>
                          <span className="font-mono text-[10px] text-text-muted">
                            {site.project_code}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant="neutral" className="text-[10px] h-5">
                          {site.site_type_name || site.type_name || site.site_type || 'Main Construction'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-text-secondary truncate">
                        {[site.city, site.state_name].filter(Boolean).join(', ') || site.address_line1 || site.location || 'Site Area'}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-text-secondary truncate">
                        {[site.site_engineer_first_name, site.site_engineer_last_name].filter(Boolean).join(' ') || site.contact_name || site.incharge || 'Assigned Lead'}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Badge
                          variant={getStatusVariant(getSiteWageStatus(site.id))}
                          className="text-[8px] font-bold uppercase tracking-wider h-4 px-1.5 inline-flex items-center leading-none"
                        >
                          {getSiteWageStatus(site.id)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {getSiteWageStatus(site.id) === 'SUBMITTED' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => setViewingSite(site)} 
                              className="text-primary hover:bg-primary/10 h-7 w-7"
                              title="View Submitted Wages"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="primary"
                            size="sm"
                            className="h-7 text-[11px] px-3 font-semibold"
                            onClick={() => handleOpenWages(site)}
                          >
                            Add Wages
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
        <div className="block sm:hidden space-y-3 mt-2">
          {pagedSites.map((site, idx) => (
            <div key={site.id} className="bg-surface border border-border rounded-xl p-3.5 shadow-sm flex flex-col gap-3">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                      {site.site_code}
                    </span>
                    <span className="text-[11px] text-text-muted truncate">
                      {site.project_name}
                    </span>
                  </div>
                  <h4 className="font-semibold text-text-primary text-[15px] leading-tight truncate">
                    {site.site_name}
                  </h4>
                </div>
                <Badge
                  variant={getStatusVariant(getSiteWageStatus(site.id))}
                  className="text-[9px] font-bold uppercase tracking-wider h-5 px-2 inline-flex items-center shrink-0"
                >
                  {getSiteWageStatus(site.id)}
                </Badge>
              </div>

              <div className="flex items-center text-[12px] text-text-secondary gap-3 bg-surface-muted/50 p-2 rounded-lg border border-border/50">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <MapPin className="w-3.5 h-3.5 shrink-0 text-text-muted" />
                  <span className="truncate">{[site.city, site.state_name].filter(Boolean).join(', ') || site.address_line1 || site.location || 'Site Area'}</span>
                </div>
                <div className="w-px h-3.5 bg-border shrink-0" />
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <UserCircle className="w-3.5 h-3.5 shrink-0 text-text-muted" />
                  <span className="truncate">{[site.site_engineer_first_name, site.site_engineer_last_name].filter(Boolean).join(' ') || site.contact_name || site.incharge || 'Assigned Lead'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {getSiteWageStatus(site.id) === 'SUBMITTED' && (
                  <Button 
                    variant="outline" 
                    className="h-10 px-3 text-primary border-primary/20 shadow-xs"
                    onClick={() => setViewingSite(site)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant={getSiteWageStatus(site.id) === 'SUBMITTED' ? 'outline' : 'primary'}
                  className="flex-1 h-10 text-[13px] font-semibold rounded-lg shadow-xs"
                  onClick={() => handleOpenWages(site)}
                >
                  Add Wages
                </Button>
              </div>
            </div>
          ))}
          <div className="pt-2">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={filteredSites.length}
              itemsPerPage={perPage}
              onPageChange={setPage}
            />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
