import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Layers, CheckCircle2, IndianRupee, Clock, ShieldCheck,
  Search, Filter, Eye, Edit, Trash2, Plus, Building,
  Check, AlertCircle, Sparkles, AlertTriangle, BarChart3,
  Printer, RefreshCw, ArrowRight, Boxes, PackageCheck,
  TrendingDown, TrendingUp, Info, FileText, ChevronRight, Calendar
} from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageContainer } from '../../../components/layout/PageContainer';
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
import {
  projectsApi,
  sitesApi,
  siteZonesApi,
  materialsApi,
  materialManagementApi,
  dailyReportsApi,
  unitsApi
} from '../../../api/apiservice';
import { useAuth } from '../../auth/context/AuthContext';

const INR = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;

const extractArray = (res) => {
  if (Array.isArray(res)) return res;
  if (res?.data && Array.isArray(res.data)) return res.data;
  if (res?.data && typeof res.data === 'object') {
    for (const key in res.data) {
      if (Array.isArray(res.data[key])) return res.data[key];
    }
  }
  if (res && typeof res === 'object') {
    for (const key in res) {
      if (Array.isArray(res[key])) return res[key];
    }
  }
  return [];
};

const getTodayDate = () => new Date().toISOString().split('T')[0];

const EMPTY_FORM = {
  project_id: '',
  site_id: '',
  consumption_date: getTodayDate(),
  daily_report_id: '',
  material_id: '',
  uom_id: '',
  zone_id: '',
  source_type_id: '1', // 1: Manual, 2: Stock Transaction, 3: Measurement
  stock_transaction_id: '',
  issued_qty: '',
  consumed_qty: '',
  returned_qty: '0',
  wasted_qty: '0',
  unit_rate: '',
  remarks: '',
};

export function MaterialConsumptionPage() {
  const { hasPermission } = useAuth();
  const [projects, setProjects] = useState([]);
  const [sites, setSites] = useState([]);
  const [siteZones, setSiteZones] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [units, setUnits] = useState([]);
  const [dailyReports, setDailyReports] = useState([]);
  const [sourceTypes, setSourceTypes] = useState([]);
  const [stockLevels, setStockLevels] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [rawConsumptions, setRawConsumptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filters & Pagination
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [selectedSiteId, setSelectedSiteId] = useState('all');
  const [selectedMaterialId, setSelectedMaterialId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
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

  // Load foundational masters & records
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      projectsApi.list().catch(() => ({ data: [] })),
      sitesApi.list().catch(() => ({ data: [] })),
      siteZonesApi.list().catch(() => ({ data: [] })),
      materialsApi.catalogue.list().catch(() => ({ data: [] })),
      unitsApi.list().catch(() => ({ data: [] })),
      dailyReportsApi.masters().catch(() => ({ data: [] })),
      dailyReportsApi.list().catch(() => ({ data: [] })),
      materialManagementApi.stock().catch(() => ({ data: [] })),
      materialManagementApi.transactions.list().catch(() => ({ data: [] })),
    ])
      .then(async ([
        projRes,
        sitesRes,
        zonesRes,
        matRes,
        unitsRes,
        dprMastersRes,
        dprListRes,
        stockRes,
        txRes,
      ]) => {
        if (!isMounted) return;

        const pList = extractArray(projRes);
        setProjects(pList);

        const sList = extractArray(sitesRes);
        setSites(sList);

        const zList = extractArray(zonesRes);
        setSiteZones(zList);

        const mList = extractArray(matRes);
        setMaterials(mList);

        const uList = extractArray(unitsRes);
        setUnits(uList);

        // Extract DPR Masters (e.g. material_source_types)
        const dprMasters = dprMastersRes?.data?.masters || dprMastersRes?.masters || {};
        const srcTypes = extractArray(dprMasters.material_source_types || [
          { id: 1, source_type_code: 'MANUAL', source_type_name: 'Manual Entry' },
          { id: 2, source_type_code: 'STOCK_TRANSACTION', source_type_name: 'Store Issue Transaction' },
          { id: 3, source_type_code: 'MEASUREMENT', source_type_name: 'Work Measurement Link' },
        ]);
        setSourceTypes(srcTypes);

        // Extract Stock Levels & Transactions
        const stkList = extractArray(stockRes);
        setStockLevels(stkList);

        const tList = extractArray(txRes);
        setTransactions(tList);

        // Extract Daily Site Reports
        const rList = extractArray(dprListRes);
        setDailyReports(rList);

        // Fetch material consumption entries from each recent report
        const fetchedConsumptions = [];
        const reportsToFetch = rList.slice(0, 30); // sample up to 30 recent reports

        for (const report of reportsToFetch) {
          try {
            const consRes = await dailyReportsApi.materialConsumption.list(report.id);
            const items = extractArray(consRes);
            for (const item of items) {
              fetchedConsumptions.push({
                ...item,
                daily_report_id: report.id,
                report_no: report.report_no || `DPR #${report.id}`,
                report_date: report.report_date || report.created_at?.split('T')[0] || '—',
                project_id: report.project_id,
                site_id: report.site_id,
                report_status: report.status_code || 'DRAFT',
              });
            }
          } catch {
            // Ignore individual report fetch errors
          }
        }

        if (isMounted) {
          setRawConsumptions(fetchedConsumptions);
        }
      })
      .catch((err) => {
        console.error('Failed to load material consumption data:', err);
        toast.error('Failed to load material consumption records.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  // Selected project & site objects in form
  const selectedProjectObj = useMemo(() => {
    return projects.find((p) => String(p.id) === String(form.project_id)) || null;
  }, [projects, form.project_id]);

  const selectedSiteObj = useMemo(() => {
    return sites.find((s) => String(s.id) === String(form.site_id)) || null;
  }, [sites, form.site_id]);

  // Filtered Sites based on selected Project in Form
  const formAvailableSites = useMemo(() => {
    if (!form.project_id) return [];
    return sites.filter((s) => String(s.project_id) === String(form.project_id));
  }, [sites, form.project_id]);

  // Filtered Zones for selected Site
  const formAvailableZones = useMemo(() => {
    if (!form.site_id) return [];
    return siteZones.filter((z) => String(z.site_id) === String(form.site_id));
  }, [siteZones, form.site_id]);

  // Matched Daily Site Report on this exact Project, Site, and Date
  const matchedDateReport = useMemo(() => {
    if (!form.project_id || !form.site_id || !form.consumption_date) return null;
    return dailyReports.find(
      (r) =>
        String(r.project_id) === String(form.project_id) &&
        String(r.site_id) === String(form.site_id) &&
        String(r.report_date).split('T')[0] === String(form.consumption_date)
    ) || null;
  }, [dailyReports, form.project_id, form.site_id, form.consumption_date]);

  const matchedReportIsEditable = useMemo(() => {
    if (!matchedDateReport) return false;
    const status = String(matchedDateReport.status_code || '').toUpperCase();
    return status === 'DRAFT' || status === 'REOPENED' || status === 'REJECTED' || !status;
  }, [matchedDateReport]);

  const matchedReportIsLocked = useMemo(() => {
    if (!matchedDateReport) return false;
    return !matchedReportIsEditable;
  }, [matchedDateReport, matchedReportIsEditable]);

  // Editable Daily Reports for this project & site (for manual fallback)
  const editableSiteReports = useMemo(() => {
    return dailyReports.filter((r) => {
      if (form.project_id && String(r.project_id) !== String(form.project_id)) return false;
      if (form.site_id && String(r.site_id) !== String(form.site_id)) return false;
      const status = String(r.status_code || '').toUpperCase();
      return status === 'DRAFT' || status === 'REOPENED' || status === 'REJECTED' || !status;
    });
  }, [dailyReports, form.project_id, form.site_id]);

  // Filtered Store Issue Transactions based on selected Project in Form
  const formAvailableTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (form.project_id && String(t.project_id) !== String(form.project_id)) return false;
      return true;
    });
  }, [transactions, form.project_id]);

  // Unified Consumption Records Aggregation
  const normalizedConsumptions = useMemo(() => {
    return rawConsumptions.map((c) => {
      const proj = projects.find((p) => String(p.id) === String(c.project_id));
      const site = sites.find((s) => String(s.id) === String(c.site_id));
      const zone = siteZones.find((z) => String(z.id) === String(c.zone_id));
      const mat = materials.find((m) => String(m.id) === String(c.material_id));
      const uom = units.find((u) => String(u.id) === String(c.uom_id));
      const srcType = sourceTypes.find((st) => String(st.id) === String(c.source_type_id));
      const tx = transactions.find((t) => String(t.id) === String(c.stock_transaction_id));

      // Match current store stock from Material Management Stock
      const stock = stockLevels.find(
        (s) =>
          String(s.material_id) === String(c.material_id) &&
          (!c.site_id || String(s.site_id) === String(c.site_id))
      );

      const issued = Number(c.issued_qty || 0);
      const consumed = Number(c.consumed_qty || 0);
      const returned = Number(c.returned_qty || 0);
      const wasted = Number(c.wasted_qty || 0);
      const rate = Number(c.unit_rate || mat?.standard_cost || 0);
      const value = Number(c.consumption_value || Math.round(consumed * rate));

      // Wastage percentage calculation
      const wastagePct = consumed > 0 ? Number(((wasted / consumed) * 100).toFixed(1)) : 0;
      const isOverrun = wastagePct > 5.0;
      const wastageCost = Math.round(wasted * rate);

      return {
        id: c.id,
        daily_report_id: c.daily_report_id,
        report_no: c.report_no || `DPR #${c.daily_report_id}`,
        report_date: c.report_date || '—',
        report_status: c.report_status || 'DRAFT',
        project_id: c.project_id,
        project_code: proj?.project_code || 'PRJ',
        project_name: proj?.project_name || `Project #${c.project_id}`,
        site_id: c.site_id,
        site_name: site?.site_name || 'Main Site',
        zone_id: c.zone_id,
        zone_name: zone?.zone_name || zone?.name || 'General Area',
        material_id: c.material_id,
        material_code: mat?.material_code || `MAT-${c.material_id}`,
        material_name: mat?.material_name || mat?.item_name || `Material #${c.material_id}`,
        category_name: mat?.category_name || mat?.category || 'General Material',
        uom_id: c.uom_id,
        uom_code: uom?.unit_code || uom?.unit_name || mat?.base_uom_name || 'Units',
        source_type_id: c.source_type_id,
        source_type_name: srcType?.source_type_name || srcType?.source_type_code || 'Site Store Issue',
        stock_transaction_id: c.stock_transaction_id,
        transaction_no: tx?.transaction_no || null,
        issued_qty: issued,
        consumed_qty: consumed,
        returned_qty: returned,
        wasted_qty: wasted,
        balance_unaccounted: Math.max(0, issued - (consumed + returned + wasted)),
        unit_rate: rate,
        consumption_value: value,
        wastage_pct: wastagePct,
        wastage_cost: wastageCost,
        is_overrun: isOverrun,
        status_label: isOverrun ? 'Overrun (> 5%)' : 'Within Tolerance',
        status_variant: isOverrun ? 'error' : 'success',
        available_stock: stock ? Number(stock.available_qty || 0) : null,
        min_stock: stock ? Number(stock.minimum_stock_qty || 0) : null,
        is_below_minimum: stock ? Boolean(stock.below_minimum) : false,
        remarks: c.remarks || '',
        raw: c,
      };
    });
  }, [
    rawConsumptions,
    projects,
    sites,
    siteZones,
    materials,
    units,
    sourceTypes,
    transactions,
    stockLevels,
  ]);

  // Safe Filtered List
  const filtered = useMemo(() => {
    return normalizedConsumptions.filter((c) => {
      if (selectedProjectId !== 'all' && String(c.project_id) !== String(selectedProjectId)) {
        return false;
      }
      if (selectedSiteId !== 'all' && String(c.site_id) !== String(selectedSiteId)) {
        return false;
      }
      if (selectedMaterialId !== 'all' && String(c.material_id) !== String(selectedMaterialId)) {
        return false;
      }
      if (statusFilter !== 'all') {
        if (statusFilter === 'normal' && c.is_overrun) return false;
        if (statusFilter === 'overrun' && !c.is_overrun) return false;
        if (statusFilter === 'critical_stock' && !c.is_below_minimum) return false;
      }
      if (search) {
        const s = search.toLowerCase();
        const mat = String(c.material_name || '').toLowerCase();
        const code = String(c.material_code || '').toLowerCase();
        const rep = String(c.report_no || '').toLowerCase();
        const site = String(c.site_name || '').toLowerCase();
        const proj = String(c.project_name || '').toLowerCase();
        const rem = String(c.remarks || '').toLowerCase();
        if (
          !mat.includes(s) &&
          !code.includes(s) &&
          !rep.includes(s) &&
          !site.includes(s) &&
          !proj.includes(s) &&
          !rem.includes(s)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [
    normalizedConsumptions,
    selectedProjectId,
    selectedSiteId,
    selectedMaterialId,
    statusFilter,
    search,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  // Executive KPI Summary Aggregations
  const totalConsumptionValue = useMemo(() => {
    return normalizedConsumptions.reduce((acc, c) => acc + Number(c.consumption_value || 0), 0);
  }, [normalizedConsumptions]);

  const distinctMaterialsCount = useMemo(() => {
    const ids = new Set(normalizedConsumptions.map((c) => String(c.material_id)));
    return ids.size;
  }, [normalizedConsumptions]);

  const totalWastageLoss = useMemo(() => {
    return normalizedConsumptions.reduce((acc, c) => acc + Number(c.wastage_cost || 0), 0);
  }, [normalizedConsumptions]);

  const criticalStockAlertsCount = useMemo(() => {
    const matched = new Set(
      normalizedConsumptions
        .filter((c) => c.is_below_minimum)
        .map((c) => String(c.material_id))
    );
    return matched.size;
  }, [normalizedConsumptions]);

  // Form Handlers
  const handleOpenAdd = () => {
    // Pick default project that actually has sites
    const projectWithSites = projects.find((p) => sites.some((s) => String(s.project_id) === String(p.id)));
    const defaultProj =
      selectedProjectId !== 'all'
        ? selectedProjectId
        : projectWithSites?.id
          ? String(projectWithSites.id)
          : projects[0]?.id
            ? String(projects[0].id)
            : '';

    const defSites = defaultProj
      ? sites.filter((s) => String(s.project_id) === String(defaultProj))
      : sites;

    const defaultSite =
      selectedSiteId !== 'all' && defSites.some((s) => String(s.id) === String(selectedSiteId))
        ? selectedSiteId
        : defSites[0]?.id
          ? String(defSites[0].id)
          : '';

    const defaultMaterial =
      selectedMaterialId !== 'all' && materials.some((m) => String(m.id) === String(selectedMaterialId))
        ? selectedMaterialId
        : materials[0]?.id
          ? String(materials[0].id)
          : '';

    const matObj = materials.find((m) => String(m.id) === String(defaultMaterial));
    const todayDate = getTodayDate();

    setForm({
      ...EMPTY_FORM,
      project_id: defaultProj,
      site_id: defaultSite,
      consumption_date: todayDate,
      daily_report_id: '',
      material_id: defaultMaterial,
      uom_id: matObj?.base_uom_id ? String(matObj.base_uom_id) : units[0]?.id ? String(units[0].id) : '',
      source_type_id: sourceTypes[0]?.id ? String(sourceTypes[0].id) : '1',
      unit_rate: matObj?.standard_cost ? String(matObj.standard_cost) : '',
    });
    setErrors({});
    setIsAddOpen(true);
  };

  const handleOpenEdit = (item) => {
    setForm({
      project_id: String(item.project_id || ''),
      site_id: String(item.site_id || ''),
      consumption_date: String(item.report_date || getTodayDate()),
      daily_report_id: String(item.daily_report_id || ''),
      material_id: String(item.material_id || ''),
      uom_id: String(item.uom_id || ''),
      zone_id: item.zone_id ? String(item.zone_id) : '',
      source_type_id: String(item.source_type_id || '1'),
      stock_transaction_id: item.stock_transaction_id ? String(item.stock_transaction_id) : '',
      issued_qty: String(item.issued_qty || '0'),
      consumed_qty: String(item.consumed_qty || '0'),
      returned_qty: String(item.returned_qty || '0'),
      wasted_qty: String(item.wasted_qty || '0'),
      unit_rate: String(item.unit_rate || '0'),
      remarks: item.remarks || '',
    });
    setErrors({});
    setEditingItem(item);
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      // When Project changes, update Site, Zone, and reset DPR
      if (field === 'project_id') {
        const availSites = sites.filter((s) => String(s.project_id) === String(value));
        next.site_id = availSites[0]?.id ? String(availSites[0].id) : '';
        next.zone_id = '';
        next.daily_report_id = '';
      }

      // When Site changes, reset Zone and DPR
      if (field === 'site_id') {
        next.zone_id = '';
        next.daily_report_id = '';
      }

      // When Material changes, prefill UOM & Unit Rate
      if (field === 'material_id') {
        const mat = materials.find((m) => String(m.id) === String(value));
        if (mat) {
          if (mat.base_uom_id) next.uom_id = String(mat.base_uom_id);
          if (mat.standard_cost && !prev.unit_rate) next.unit_rate = String(mat.standard_cost);
        }
      }

      return next;
    });
    setErrors((prev) => ({ ...prev, [field]: null }));
  };

  // Real-time stock for selected material in form
  const selectedMaterialStock = useMemo(() => {
    if (!form.material_id) return null;
    return stockLevels.find(
      (s) =>
        String(s.material_id) === String(form.material_id) &&
        (!form.site_id || String(s.site_id) === String(form.site_id))
    );
  }, [stockLevels, form.material_id, form.site_id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};

    if (!form.project_id) {
      errs.project_id = 'Project selection is required.';
    }
    if (!form.site_id) {
      errs.site_id = 'Site location is required. Selected project must have an active site.';
    }
    if (!form.consumption_date) {
      errs.consumption_date = 'Consumption date is required.';
    }
    if (!form.material_id) {
      errs.material_id = 'Material item is required.';
    }
    if (!form.uom_id) {
      errs.uom_id = 'Unit of measurement is required.';
    }
    if (!form.source_type_id) {
      errs.source_type_id = 'Source channel is required.';
    }
    if (form.consumed_qty === '' || Number(form.consumed_qty) < 0 || isNaN(Number(form.consumed_qty))) {
      errs.consumed_qty = 'Valid consumed quantity is required (>= 0).';
    }

    if (!editingItem && matchedReportIsLocked) {
      errs.consumption_date = `The Daily Site Report (${matchedDateReport?.report_no}) for this date is ${matchedDateReport?.status_code || 'locked'}. Please select another date.`;
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        material_id: Number(form.material_id),
        uom_id: Number(form.uom_id),
        source_type_id: Number(form.source_type_id),
        issued_qty: Number(form.issued_qty || 0),
        consumed_qty: Number(form.consumed_qty || 0),
        returned_qty: Number(form.returned_qty || 0),
        wasted_qty: Number(form.wasted_qty || 0),
        unit_rate: Number(form.unit_rate || 0),
        remarks: form.remarks || '',
      };

      if (form.zone_id) payload.zone_id = Number(form.zone_id);
      if (form.stock_transaction_id) payload.stock_transaction_id = Number(form.stock_transaction_id);

      if (editingItem?.id) {
        await dailyReportsApi.materialConsumption.update(
          editingItem.daily_report_id,
          editingItem.id,
          payload
        );
        toast.success('Material consumption record updated successfully.');
      } else {
        let targetReportId = form.daily_report_id;

        // If no explicit report was picked, check if an editable report exists on this date
        if (!targetReportId) {
          if (matchedDateReport && matchedReportIsEditable) {
            targetReportId = matchedDateReport.id;
          } else {
            // Auto-create Daily Site Report container for this project, site, and date
            const projObj = projects.find((p) => String(p.id) === String(form.project_id));
            const projCode = (projObj?.project_code || 'PRJ').toUpperCase().replace(/[^A-Z0-9]/g, '');
            const dateStr = form.consumption_date.replace(/-/g, '');
            const randSuffix = Math.floor(1000 + Math.random() * 9000);
            const reportNo = `DSR-${projCode}-${dateStr}-${randSuffix}`.slice(0, 40);

            const dsrRes = await dailyReportsApi.create({
              project_id: Number(form.project_id),
              site_id: Number(form.site_id),
              report_no: reportNo,
              report_date: form.consumption_date,
              shift_type_id: 1, // General shift
              overall_work_summary: `Site material consumption entry for ${form.consumption_date}`,
            });

            const createdDsr = dsrRes?.data?.daily_site_report || dsrRes?.daily_site_report || dsrRes?.data || dsrRes;
            targetReportId = createdDsr?.id;
            if (!targetReportId) {
              throw new Error('Unable to initialize Daily Site Report for this consumption entry.');
            }
          }
        }

        await dailyReportsApi.materialConsumption.create(Number(targetReportId), payload);
        toast.success('Material consumption entry recorded successfully.');
      }

      setIsAddOpen(false);
      setEditingItem(null);
      refresh();
    } catch (err) {
      console.error('Failed to save material consumption:', err);
      toast.error(err?.message || 'Failed to save material consumption record.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteItem?.id || !deleteItem?.daily_report_id) return;
    try {
      await dailyReportsApi.materialConsumption.remove(deleteItem.daily_report_id, deleteItem.id);
      toast.success('Consumption record deleted successfully.');
      setDeleteItem(null);
      refresh();
    } catch (err) {
      console.error('Failed to remove consumption record:', err);
      toast.error(err?.message || 'Failed to remove consumption entry.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Materials & Inventory', href: '/materials/catalogue' },
    { label: 'Material Consumption' },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Standalone Material Consumption & Wastage Ledger"
        breadcrumbs={breadcrumbs}
        description="Unified operational consumption tracking across site operations, theoretical norms vs actual site burn rates, and inventory stock correlation."
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            className="h-8 text-xs text-text-secondary hover:text-text-primary"
            title="Refresh Data"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-8 text-xs text-text-secondary hover:text-text-primary"
            title="Print Consumption Statement"
          >
            <Printer className="w-3.5 h-3.5 mr-1" /> Print Report
          </Button>
        </div>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:gap-4 w-full">
        {/* KPI Summary Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <KpiCard
            label="Total Consumed Value"
            value={INR(totalConsumptionValue)}
            status="primary"
            icon={<IndianRupee className="w-4 h-4 text-primary" />}
          />
          <KpiCard
            label="Materials Tracked"
            value={`${distinctMaterialsCount} Items`}
            status="neutral"
            icon={<Boxes className="w-4 h-4 text-sky-500" />}
          />
          <KpiCard
            label="Total Wastage / Scrap Cost"
            value={INR(totalWastageLoss)}
            status={totalWastageLoss > 0 ? 'warning' : 'success'}
            icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
          />
          <KpiCard
            label="Critical Low Stock Warnings"
            value={`${criticalStockAlertsCount} Materials`}
            status={criticalStockAlertsCount > 0 ? 'error' : 'success'}
            icon={<ShieldCheck className="w-4 h-4 text-emerald-500" />}
          />
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-surface border border-border rounded-lg p-2.5 sm:p-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="w-full sm:w-48">
              <Select
                options={[
                  { value: 'all', label: 'All Projects' },
                  ...projects.map((p) => ({
                    value: String(p.id),
                    label: p.project_name || p.name,
                  })),
                ]}
                value={selectedProjectId}
                onChange={(v) => {
                  setSelectedProjectId(v);
                  setSelectedSiteId('all');
                }}
                className="text-xs h-8"
              />
            </div>

            <div className="w-full sm:w-44">
              <Select
                options={[
                  { value: 'all', label: 'All Sites' },
                  ...sites
                    .filter(
                      (s) =>
                        selectedProjectId === 'all' ||
                        String(s.project_id) === String(selectedProjectId)
                    )
                    .map((s) => ({
                      value: String(s.id),
                      label: s.site_name || `Site #${s.id}`,
                    })),
                ]}
                value={selectedSiteId}
                onChange={setSelectedSiteId}
                className="text-xs h-8"
              />
            </div>

            <div className="w-full sm:w-44">
              <Select
                options={[
                  { value: 'all', label: 'All Wastage Status' },
                  { value: 'normal', label: 'Within Permissible (<= 5%)' },
                  { value: 'overrun', label: 'Wastage Overrun (> 5%)' },
                  { value: 'critical_stock', label: 'Store Stock Below Min' },
                ]}
                value={statusFilter}
                onChange={setStatusFilter}
                className="text-xs h-8"
              />
            </div>

            <div className="w-full sm:w-56">
              <SearchField
                placeholder="Search material, DPR no, site..."
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
              Log Consumption
            </Button>
          </div>
        </div>

        {/* Desktop & Tablet Table (Clean, balanced, fluid layout with no clipping) */}
        <div className="hidden sm:block border border-border rounded-lg bg-surface shadow-xs w-full overflow-x-auto">
          <table className="w-full text-left text-xs table-fixed min-w-[860px]">
            <thead className="bg-surface-muted text-text-secondary text-[11px] uppercase font-semibold border-b border-border tracking-wider">
              <tr>
                <th className="px-2 py-2.5 w-10 text-center">#</th>
                <th className="px-3 py-2.5 w-[16%]">Daily Report & Date</th>
                <th className="px-3 py-2.5 w-[24%]">Material & Category</th>
                <th className="px-3 py-2.5 w-[18%]">Issued ➔ Consumed</th>
                <th className="px-3 py-2.5 text-left w-[15%]">Valuation (₹)</th>
                <th className="px-3 py-2.5 text-center w-[14%]">Store Stock</th>
                <th className="px-2 py-2.5 text-center w-[13%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-text-muted text-xs">
                    <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-primary" />
                    Loading aggregated material consumption records...
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-text-muted text-xs">
                    No material consumption records found matching criteria.
                  </td>
                </tr>
              ) : (
                paged.map((c, idx) => (
                  <tr key={c.id || idx} className="hover:bg-surface-muted/30 transition-colors group">
                    <td className="px-2 py-2.5 text-center font-medium text-text-muted text-[11px]">
                      {(page - 1) * perPage + idx + 1}
                    </td>

                    <td className="px-3 py-2.5">
                      <div className="flex flex-col min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                            {c.report_no}
                          </span>
                          <span className="text-[10px] text-text-muted font-mono">{c.report_date}</span>
                        </div>
                        <span className="font-semibold text-text-primary text-[12px] truncate pt-0.5" title={c.site_name}>
                          {c.site_name}
                        </span>
                        <span className="text-[10px] text-text-muted truncate">
                          {c.project_code} • {c.zone_name}
                        </span>
                      </div>
                    </td>

                    <td className="px-3 py-2.5">
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="font-semibold text-text-primary text-[12px] truncate" title={c.material_name}>
                          {c.material_name}
                        </span>
                        <span className="text-[10px] text-text-muted truncate pt-0.5">
                          <span className="font-mono text-text-secondary">{c.material_code}</span> • {c.category_name}
                        </span>
                        <div className="pt-1 flex items-center gap-1">
                          <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-surface-muted border border-border text-text-secondary">
                            {c.source_type_name}
                          </span>
                          {c.transaction_no && (
                            <span className="text-[9px] font-mono text-primary bg-primary/5 px-1 rounded">
                              {c.transaction_no}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-2.5">
                      <div className="flex flex-col">
                        <div className="flex items-baseline gap-1">
                          <span className="font-bold text-text-primary text-xs tabular-nums">
                            {c.consumed_qty} {c.uom_code}
                          </span>
                          <span className="text-[10px] text-text-muted">
                            (of {c.issued_qty})
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] pt-0.5">
                          <span className={c.is_overrun ? 'text-rose-600 font-bold' : 'text-emerald-700 font-medium'}>
                            Waste: {c.wasted_qty} ({c.wastage_pct}%)
                          </span>
                          {c.returned_qty > 0 && (
                            <span className="text-text-muted">
                              • Ret: {c.returned_qty}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-2.5 text-left">
                      <div className="flex flex-col">
                        <span className="font-bold text-emerald-600 text-xs tabular-nums">
                          {INR(c.consumption_value)}
                        </span>
                        <span className="text-[10px] text-text-muted tabular-nums">
                          {INR(c.unit_rate)} / {c.uom_code}
                        </span>
                        {c.wastage_cost > 0 && (
                          <span className="text-[10px] text-rose-600 font-medium tabular-nums">
                            Waste Loss: {INR(c.wastage_cost)}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      <div className="flex flex-col items-center">
                        {c.available_stock !== null ? (
                          <>
                            <span className={`text-[11px] font-semibold tabular-nums ${
                              c.is_below_minimum ? 'text-rose-600 font-bold' : 'text-text-primary'
                            }`}>
                              {c.available_stock} {c.uom_code}
                            </span>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mt-0.5 ${
                              c.is_below_minimum
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {c.is_below_minimum ? 'Low Stock' : 'In Store'}
                            </span>
                          </>
                        ) : (
                          <span className="text-text-muted text-[11px] font-mono">—</span>
                        )}
                      </div>
                    </td>

                    <td className="px-2 py-2.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          className="p-1.5 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                          title="View Consumption Dossier 360"
                          onClick={() => setViewingItem(c)}
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          className="p-1.5 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                          title="Edit Consumption Record"
                          onClick={() => handleOpenEdit(c)}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                          title="Delete Consumption Record"
                          onClick={() => setDeleteItem(c)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination inside container without extra overflow */}
          <div className="border-t border-border px-3 py-2.5 bg-surface flex items-center justify-between text-xs">
            <span className="text-text-muted text-[11px]">
              Showing {filtered.length === 0 ? 0 : (page - 1) * perPage + 1} to{' '}
              {Math.min(page * perPage, filtered.length)} of {filtered.length} consumption logs
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                ‹ Previous
              </Button>
              <span className="font-mono text-xs text-text-secondary">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next ›
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile View - Cards List (< sm) */}
        <div className="block sm:hidden space-y-3">
          {loading ? (
            <div className="py-12 text-center text-text-muted text-xs">
              <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-primary" />
              Loading consumption logs...
            </div>
          ) : paged.length === 0 ? (
            <div className="py-12 text-center text-text-muted text-xs">
              No consumption logs found.
            </div>
          ) : (
            paged.map((c, idx) => (
              <div key={c.id || idx} className="bg-surface border border-border rounded-lg p-3.5 shadow-xs space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-[10px] font-bold text-primary block">
                      {c.report_no} • {c.report_date}
                    </span>
                    <h4 className="font-semibold text-text-primary text-[13px] leading-snug">{c.material_name}</h4>
                    <span className="text-[10px] text-text-muted">{c.site_name} • {c.project_name}</span>
                  </div>
                  <Badge variant={c.status_variant} className="text-[8px] font-bold uppercase tracking-wider shrink-0">
                    {c.status_label}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/60">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-text-muted block">Consumed</span>
                    <span className="font-mono font-medium text-text-primary text-[11px]">
                      {c.consumed_qty} {c.uom_code}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-text-muted block">Consumption Value</span>
                    <span className="font-mono font-bold text-emerald-600 text-[12px]">
                      {INR(c.consumption_value)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-border/60 text-xs">
                  <span className={`text-[10px] font-medium ${c.is_overrun ? 'text-rose-600 font-bold' : 'text-text-muted'}`}>
                    Wastage: {c.wasted_qty} ({c.wastage_pct}%)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="p-1.5 text-text-secondary hover:text-primary hover:bg-primary/10 border border-border rounded-md transition-colors"
                      title="View Details"
                      onClick={() => setViewingItem(c)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      className="p-1.5 text-text-secondary hover:text-primary hover:bg-primary/10 border border-border rounded-md transition-colors"
                      title="Edit Record"
                      onClick={() => handleOpenEdit(c)}
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-md transition-colors"
                      title="Delete Record"
                      onClick={() => setDeleteItem(c)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
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

      {/* View Consumption Dossier 360 Modal */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface border border-border rounded-xl shadow-level-3 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-muted/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">{viewingItem.material_name}</h3>
                  <span className="text-[11px] font-mono text-text-muted">
                    {viewingItem.report_no} • {viewingItem.report_date} • {viewingItem.site_name}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={viewingItem.status_variant} className="text-[9px] font-bold uppercase">
                  {viewingItem.status_label}
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => setViewingItem(null)}>✕</Button>
              </div>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              {/* Financial & Quantities Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-muted/30 p-3.5 rounded-lg border border-border">
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Issued to Site</span>
                  <span className="font-bold text-text-primary font-mono text-sm">
                    {viewingItem.issued_qty} {viewingItem.uom_code}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Actual Consumed</span>
                  <span className="font-bold text-emerald-600 font-mono text-sm">
                    {viewingItem.consumed_qty} {viewingItem.uom_code}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Returned to Store</span>
                  <span className="font-bold text-sky-600 font-mono text-sm">
                    {viewingItem.returned_qty} {viewingItem.uom_code}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Scrap / Wastage</span>
                  <span className={`font-bold font-mono text-sm ${viewingItem.is_overrun ? 'text-rose-600' : 'text-amber-600'}`}>
                    {viewingItem.wasted_qty} ({viewingItem.wastage_pct}%)
                  </span>
                </div>
              </div>

              {/* Valuation Details */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-emerald-50/50 rounded-lg border border-emerald-200/80 text-emerald-950">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Unit Valuation Rate</span>
                  <span className="font-mono font-bold text-xs">{INR(viewingItem.unit_rate)} / {viewingItem.uom_code}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Total Consumed Value</span>
                  <span className="font-mono font-bold text-base text-emerald-700">{INR(viewingItem.consumption_value)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Wastage Loss Value</span>
                  <span className="font-mono font-bold text-xs text-rose-700">{INR(viewingItem.wastage_cost)}</span>
                </div>
              </div>

              {/* Operational Inventory Context */}
              <div className="border border-border rounded-lg p-3.5 space-y-2 bg-surface">
                <span className="font-bold text-text-primary block text-[11px] uppercase tracking-wider">
                  Material Management & Stock Correlation
                </span>
                <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                  <div>
                    <span className="text-text-muted block text-[10px]">Material Item Code</span>
                    <span className="font-mono font-semibold text-text-primary">{viewingItem.material_code}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block text-[10px]">Source Issue Channel</span>
                    <span className="font-medium text-text-primary">{viewingItem.source_type_name}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block text-[10px]">Parent Daily Site Report</span>
                    <span className="font-mono font-semibold text-primary">{viewingItem.report_no}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block text-[10px]">Site Work Zone</span>
                    <span className="font-medium text-text-primary">{viewingItem.zone_name}</span>
                  </div>
                  {viewingItem.available_stock !== null && (
                    <div className="col-span-2 pt-1 border-t border-border flex items-center justify-between">
                      <span className="text-text-muted text-[10px]">Current Available Store Stock (Warehouse):</span>
                      <span className={`font-mono font-bold text-xs ${viewingItem.is_below_minimum ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {viewingItem.available_stock} {viewingItem.uom_code} {viewingItem.is_below_minimum ? '(BELOW REORDER LEVEL)' : '(Adequate)'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {viewingItem.remarks && (
                <div className="border border-border rounded-lg p-3 space-y-1">
                  <span className="font-bold text-text-primary block text-[11px]">Site Consumption Remarks:</span>
                  <p className="text-text-secondary bg-surface-muted/30 p-2 rounded border border-border/50">
                    {viewingItem.remarks}
                  </p>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-border bg-surface-muted/20 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setViewingItem(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Consumption Modal */}
      <EntityEditModal
        isOpen={Boolean(isAddOpen || editingItem)}
        onClose={() => {
          setIsAddOpen(false);
          setEditingItem(null);
        }}
      >
        <EntityEditModal.Header
          icon={BarChart3}
          title={editingItem ? 'Edit Material Consumption Entry' : 'Log Material Site Consumption'}
          subtitle="Record daily material issued, consumed, returned, and scrap/wastage against site daily reports."
          onClose={() => {
            setIsAddOpen(false);
            setEditingItem(null);
          }}
        />
        <form id="mcn-form" onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <EntityEditModal.Body>
            <EntityEditModal.Section title="1. Project, Site Location & Date">
              <EntityEditModal.Grid>
                <FormField label="Project" required error={errors.project_id}>
                  <Select
                    options={projects.map((p) => {
                      const siteCount = sites.filter((s) => String(s.project_id) === String(p.id)).length;
                      return {
                        value: String(p.id),
                        label: p.project_name || p.name,
                      };
                    })}
                    value={form.project_id}
                    onChange={(v) => handleFormChange('project_id', v)}
                  />
                </FormField>

                <FormField label="Site Location" required error={errors.site_id}>
                  <Select
                    disabled={formAvailableSites.length === 0}
                    options={
                      formAvailableSites.length > 0
                        ? formAvailableSites.map((s) => ({
                            value: String(s.id),
                            label: s.site_name || `Site #${s.id}`,
                          }))
                        : [{ value: '', label: 'No sites found for this project' }]
                    }
                    value={form.site_id}
                    onChange={(v) => handleFormChange('site_id', v)}
                    placeholder={formAvailableSites.length === 0 ? 'No sites configured' : 'Select site location'}
                  />
                </FormField>

                <FormField label="Consumption Date" required error={errors.consumption_date}>
                  <Input
                    type="date"
                    disabled={Boolean(editingItem)}
                    value={form.consumption_date}
                    onChange={(e) => handleFormChange('consumption_date', e.target.value)}
                  />
                </FormField>

                <FormField label="Site Work Zone / Area (Optional)">
                  <Select
                    options={[
                      { value: '', label: 'General Site Area (Unzoned)' },
                      ...formAvailableZones.map((z) => ({
                        value: String(z.id),
                        label: z.zone_name || z.name,
                      })),
                    ]}
                    value={form.zone_id}
                    onChange={(v) => handleFormChange('zone_id', v)}
                  />
                </FormField>

                {editingItem && (
                  <div className="md:col-span-2 p-2.5 bg-surface-muted/60 border border-border rounded-lg flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                      <div>
                        <span className="font-bold text-text-primary">Parent Daily Site Report: </span>
                        <span className="font-mono font-semibold text-primary">{editingItem.report_no}</span>
                        <span className="text-text-muted ml-1.5">({editingItem.report_date} • {editingItem.site_name})</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono">
                      {editingItem.report_status}
                    </Badge>
                  </div>
                )}

                {!editingItem && formAvailableSites.length === 0 && (
                  <div className="md:col-span-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-950 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      The selected project has no site locations configured yet. Please select a project with active sites (e.g. <strong>Greenfield Residency</strong> or <strong>gowtham sweets</strong>) to record material consumption.
                    </span>
                  </div>
                )}

                {!editingItem && matchedDateReport && matchedReportIsLocked && (
                  <div className="md:col-span-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-950 text-xs space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">
                          Daily Report {matchedDateReport.report_no} on {matchedDateReport.report_date} is {matchedDateReport.status_name || matchedDateReport.status_code}.
                        </span>
                        <p className="text-[11px] text-rose-800 pt-0.5">
                          This report is finalized/closed for new operational entries. Please choose a different consumption date above.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </EntityEditModal.Grid>
            </EntityEditModal.Section>

            <EntityEditModal.Section title="2. Material Item, Store Inventory & Valuation">
              <EntityEditModal.Grid>
                <FormField label="Material Item" required error={errors.material_id} className="md:col-span-2">
                  <Select
                    options={materials.map((m) => ({
                      value: String(m.id),
                      label: m.material_name || m.item_name || m.name,
                    }))}
                    value={form.material_id}
                    onChange={(v) => handleFormChange('material_id', v)}
                  />
                </FormField>

                {/* Stock Correlation Indicator */}
                <div className="md:col-span-2 p-2.5 rounded-lg border text-xs flex items-center justify-between bg-surface-muted/40 border-border">
                  <div className="flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-sky-600 shrink-0" />
                    {selectedMaterialStock ? (
                      <span>
                        Warehouse Available Stock:{' '}
                        <strong className="text-text-primary">
                          {selectedMaterialStock.available_qty} {selectedMaterialStock.base_uom_name || ''}
                        </strong>
                        {selectedMaterialStock.minimum_stock_qty > 0 && (
                          <span className="text-text-muted ml-2">
                            (Min: {selectedMaterialStock.minimum_stock_qty})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-text-secondary">
                        Direct Site Procurement / Manual Entry (No current warehouse stock balance tracked)
                      </span>
                    )}
                  </div>
                  {selectedMaterialStock && (
                    <Badge
                      variant={selectedMaterialStock.below_minimum ? 'error' : 'success'}
                      className="text-[9px] font-bold uppercase tracking-wider"
                    >
                      {selectedMaterialStock.below_minimum ? 'Below Safety Stock' : 'Adequate In Store'}
                    </Badge>
                  )}
                </div>

                <FormField label="Unit of Measurement (UOM)" required error={errors.uom_id}>
                  <Select
                    options={units.map((u) => ({
                      value: String(u.id),
                      label: u.unit_name || u.name || u.unit_code,
                    }))}
                    value={form.uom_id}
                    onChange={(v) => handleFormChange('uom_id', v)}
                  />
                </FormField>

                <FormField label="Unit Valuation Rate (₹)">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={form.unit_rate}
                    onChange={(e) => handleFormChange('unit_rate', e.target.value)}
                    placeholder="Rate per unit"
                  />
                </FormField>

                <FormField label="Source Channel" required error={errors.source_type_id}>
                  <Select
                    options={sourceTypes.map((st) => ({
                      value: String(st.id),
                      label: st.source_type_name || st.source_type_code,
                    }))}
                    value={form.source_type_id}
                    onChange={(v) => handleFormChange('source_type_id', v)}
                  />
                </FormField>

                <FormField label="Linked Store Issue Transaction (Optional)">
                  <Select
                    options={[
                      { value: '', label: 'None (Direct / Manual Entry)' },
                      ...formAvailableTransactions.map((t) => ({
                        value: String(t.id),
                        label: t.transaction_no || `Transaction #${t.id}`,
                      })),
                    ]}
                    value={form.stock_transaction_id}
                    onChange={(v) => handleFormChange('stock_transaction_id', v)}
                  />
                </FormField>
              </EntityEditModal.Grid>
            </EntityEditModal.Section>

            <EntityEditModal.Section title="3. Consumption & Wastage Quantities">
              <EntityEditModal.Grid>
                <FormField label="Issued Qty to Site">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={form.issued_qty}
                    onChange={(e) => handleFormChange('issued_qty', e.target.value)}
                    placeholder="Quantity issued"
                  />
                </FormField>

                <FormField label="Actual Consumed Qty" required error={errors.consumed_qty}>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={form.consumed_qty}
                    onChange={(e) => handleFormChange('consumed_qty', e.target.value)}
                    placeholder="Quantity incorporated into work"
                    className="font-bold text-primary"
                  />
                </FormField>

                <FormField label="Returned to Store Qty">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={form.returned_qty}
                    onChange={(e) => handleFormChange('returned_qty', e.target.value)}
                    placeholder="Unused returned"
                  />
                </FormField>

                <FormField label="Wasted / Scrap Qty">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={form.wasted_qty}
                    onChange={(e) => handleFormChange('wasted_qty', e.target.value)}
                    placeholder="Cut-offs, spills, test cubes"
                  />
                </FormField>

                {/* Real-time Calculation & Reconciliation Card */}
                {(() => {
                  const consumedNum = Number(form.consumed_qty || 0);
                  const wastedNum = Number(form.wasted_qty || 0);
                  const returnedNum = Number(form.returned_qty || 0);
                  const issuedNum = Number(form.issued_qty || 0);
                  const rateNum = Number(form.unit_rate || 0);

                  const estValue = Math.round(consumedNum * rateNum);
                  const wastagePct = consumedNum > 0 ? Number(((wastedNum / consumedNum) * 100).toFixed(1)) : 0;
                  const wastageCost = Math.round(wastedNum * rateNum);
                  const isOverrun = wastagePct > 5.0;
                  const balance = issuedNum > 0 ? issuedNum - (consumedNum + returnedNum + wastedNum) : null;

                  return (
                    <div className="md:col-span-2 p-3.5 bg-surface-muted/50 rounded-lg border border-border space-y-2.5 text-xs">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div>
                          <span className="text-text-muted block text-[10px] uppercase font-bold">Estimated Consumption Value</span>
                          <span className="font-mono font-bold text-sm text-emerald-600">{INR(estValue)}</span>
                        </div>
                        <div>
                          <span className="text-text-muted block text-[10px] uppercase font-bold">Wastage Rate</span>
                          <span className={`font-mono font-bold text-sm ${isOverrun ? 'text-rose-600' : 'text-text-primary'}`}>
                            {wastedNum > 0 ? `${wastagePct}%` : '0.0%'}
                          </span>
                          {wastageCost > 0 && (
                            <span className="text-[10px] text-rose-600 block">({INR(wastageCost)} loss)</span>
                          )}
                        </div>
                        {balance !== null && (
                          <div>
                            <span className="text-text-muted block text-[10px] uppercase font-bold">Balance Unaccounted</span>
                            <span className={`font-mono font-bold text-sm ${balance < 0 ? 'text-rose-600' : 'text-text-primary'}`}>
                              {balance.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-text-muted block">
                              {balance > 0 ? 'remaining on site' : balance === 0 ? 'fully reconciled' : 'exceeds issued'}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border/60">
                        <span className="text-[11px] text-text-secondary">Wastage Compliance Standard:</span>
                        <Badge variant={isOverrun ? 'error' : 'success'} className="text-[9px] font-bold uppercase tracking-wider">
                          {isOverrun ? 'Wastage Overrun (> 5% Threshold)' : 'Within Permissible Tolerance (<= 5%)'}
                        </Badge>
                      </div>
                    </div>
                  );
                })()}

                <FormField label="Remarks / Pour Location Notes" className="md:col-span-2">
                  <Textarea
                    rows={2}
                    value={form.remarks}
                    onChange={(e) => handleFormChange('remarks', e.target.value)}
                    placeholder="Work location, batch number, pump priming notes..."
                  />
                </FormField>
              </EntityEditModal.Grid>
            </EntityEditModal.Section>
          </EntityEditModal.Body>

          <EntityEditModal.Footer
            formId="mcn-form"
            submitLabel={editingItem ? 'Update Consumption Log' : 'Save Consumption Entry'}
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
        isOpen={Boolean(deleteItem)}
        title="Delete Material Consumption Record"
        message={`Are you sure you want to delete the consumption entry for "${deleteItem?.material_name}" under ${deleteItem?.report_no}? This will recalculate report totals.`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteItem(null)}
      />
    </PageContainer>
  );
}

export default MaterialConsumptionPage;
