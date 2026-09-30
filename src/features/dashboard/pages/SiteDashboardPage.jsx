import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  Building, MapPin, Briefcase, Activity, AlertTriangle, 
  CheckCircle2, Clock, Calendar, RefreshCw, Plus, Users, 
  Layers, Map, FileText, ArrowRight, X, AlertCircle, 
  ShieldAlert, DollarSign, Filter
} from 'lucide-react';
import { 
  dashboardApi, 
  sitesApi, 
  siteZonesApi, 
  workLocationsApi, 
  dailyReportsApi, 
  projectsApi 
} from '../../../api/apiservice';

const DEFAULT_SEVERITY_COLORS = {
  CRITICAL: '#B91C1C',
  HIGH: '#EF4444',
  MEDIUM: '#F59E0B',
  LOW: '#10B981',
  INFO: '#3B82F6',
};

const DEFAULT_STATUS_COLORS = {
  OPEN: '#0056C9',
  ACKNOWLEDGED: '#8B5CF6',
  IN_PROGRESS: '#F59E0B',
  RESOLVED: '#10B981',
  DISMISSED: '#6B7280',
};

const SITE_STATUS_COLORS = {
  ACTIVE: '#10B981',
  PLANNED: '#3B82F6',
  MOBILIZATION: '#F59E0B',
  COMPLETED: '#0056C9',
  ON_HOLD: '#6B7280',
};

const formatCurrency = (val) => {
  const num = Number(val || 0);
  if (Math.abs(num) >= 10000000) {
    return `₹${(num / 10000000).toFixed(2)} Cr`;
  }
  if (Math.abs(num) >= 100000) {
    return `₹${(num / 100000).toFixed(2)} L`;
  }
  return `₹${num.toLocaleString('en-IN')}`;
};

export function SiteDashboardPage() {
  const navigate = useNavigate();

  // Filters
  const [selectedProjectId, setSelectedProjectId] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');

  // Live Data States
  const [sitesList, setSitesList] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [zonesList, setZonesList] = useState([]);
  const [locationsList, setLocationsList] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [dailyReports, setDailyReports] = useState([]);
  const [overview, setOverview] = useState({
    project_count: 0,
    daily_report_count: 0,
    open_issue_count: 0,
    open_alert_count: 0,
    approved_budget: 0,
    expense_actual: 0,
    subcontract_actual: 0,
    labour_actual: 0,
    total_actual_cost: 0,
    budget_balance: 0,
  });
  const [masters, setMasters] = useState({
    alert_types: [],
    alert_severities: [],
    alert_statuses: [],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Create Alert Modal State
  const [createAlertModalOpen, setCreateAlertModalOpen] = useState(false);
  const [alertForm, setAlertForm] = useState({
    site_id: '',
    project_id: '',
    alert_type_id: '',
    severity_id: '',
    title: '',
    message: '',
    due_date: '',
    assigned_to: '',
  });
  const [submittingAlert, setSubmittingAlert] = useState(false);

  // Fetch all site dashboard intelligence
  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    const projectParams = selectedProjectId !== 'ALL' ? { project_id: Number(selectedProjectId) } : {};

    try {
      const [
        sitesRes,
        projectsRes,
        zonesRes,
        locsRes,
        reportsRes,
        overviewRes,
        alertsRes,
        mastersRes,
      ] = await Promise.allSettled([
        sitesApi.list(projectParams),
        projectsApi.list(),
        siteZonesApi.list(),
        workLocationsApi.list(),
        dailyReportsApi.list(),
        dashboardApi.overview(projectParams),
        dashboardApi.alerts(projectParams),
        dashboardApi.masters(),
      ]);

      if (sitesRes.status === 'fulfilled') {
        const sList = sitesRes.value?.data?.sites || 
          (Array.isArray(sitesRes.value?.data) ? sitesRes.value.data : []);
        setSitesList(sList);
      }

      if (projectsRes.status === 'fulfilled') {
        const pList = projectsRes.value?.data?.projects || 
          (Array.isArray(projectsRes.value?.data) ? projectsRes.value.data : []);
        setProjectsList(pList);
      }

      if (zonesRes.status === 'fulfilled') {
        const zList = zonesRes.value?.data?.site_zones || 
          (Array.isArray(zonesRes.value?.data) ? zonesRes.value.data : []);
        setZonesList(zList);
      }

      if (locsRes.status === 'fulfilled') {
        const lList = locsRes.value?.data?.work_locations || 
          (Array.isArray(locsRes.value?.data) ? locsRes.value.data : []);
        setLocationsList(lList);
      }

      if (reportsRes.status === 'fulfilled') {
        const dList = reportsRes.value?.data?.daily_reports || 
          (Array.isArray(reportsRes.value?.data) ? reportsRes.value.data : []);
        setDailyReports(dList);
      }

      if (overviewRes.status === 'fulfilled' && overviewRes.value?.data?.dashboard) {
        const d = overviewRes.value.data.dashboard;
        setOverview({
          project_count: Number(d.project_count || 0),
          daily_report_count: Number(d.daily_report_count || 0),
          open_issue_count: Number(d.open_issue_count || 0),
          open_alert_count: Number(d.open_alert_count || 0),
          approved_budget: Number(d.approved_budget || 0),
          expense_actual: Number(d.expense_actual || 0),
          subcontract_actual: Number(d.subcontract_actual || 0),
          labour_actual: Number(d.labour_actual || 0),
          total_actual_cost: Number(d.total_actual_cost || 0),
          budget_balance: Number(d.budget_balance || 0),
        });
      }

      if (alertsRes.status === 'fulfilled' && alertsRes.value?.data?.alerts) {
        setAlerts(alertsRes.value.data.alerts);
      }

      if (mastersRes.status === 'fulfilled' && mastersRes.value?.data?.masters) {
        setMasters(mastersRes.value.data.masters);
      }
    } catch (err) {
      console.error('Failed to load site dashboard data:', err);
      setError(err?.message || 'Failed to load site intelligence.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Color helpers
  const getSeverityColor = (code) => {
    const found = masters.alert_severities?.find(s => (s.severity_code || s.code) === code);
    return found?.color || DEFAULT_SEVERITY_COLORS[code] || '#6B7280';
  };

  const getStatusColor = (code) => {
    const found = masters.alert_statuses?.find(s => (s.status_code || s.code) === code);
    return found?.color || DEFAULT_STATUS_COLORS[code] || '#6B7280';
  };

  // Filtered Sites
  const filteredSites = useMemo(() => {
    return sitesList.filter(s => {
      if (selectedStatusFilter !== 'ALL') {
        const status = (s.site_status_name || s.status || '').toUpperCase();
        if (!status.includes(selectedStatusFilter)) return false;
      }
      return true;
    });
  }, [sitesList, selectedStatusFilter]);

  // Aggregated Counts
  const primarySitesCount = useMemo(() => {
    return sitesList.filter(s => s.is_primary === 1 || s.is_primary === '1').length;
  }, [sitesList]);

  const activeSitesCount = useMemo(() => {
    return sitesList.filter(s => {
      const st = (s.site_status_name || s.status || '').toUpperCase();
      return st === 'ACTIVE' || st === 'UNDER CONSTRUCTION' || st === 'PLANNED';
    }).length;
  }, [sitesList]);

  // Chart: Sites by Status Donut
  const siteStatusData = useMemo(() => {
    const counts = sitesList.reduce((acc, s) => {
      const status = (s.site_status_name || s.status || 'Active').toUpperCase();
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    const colors = ['#10B981', '#0056C9', '#3B82F6', '#F59E0B', '#6B7280', '#8B5CF6'];
    return Object.keys(counts).map((key, idx) => ({
      name: key,
      value: counts[key],
      color: SITE_STATUS_COLORS[key] || colors[idx % colors.length]
    }));
  }, [sitesList]);

  // Chart: Site Types Donut
  const siteTypeData = useMemo(() => {
    const counts = sitesList.reduce((acc, s) => {
      const t = (s.site_type_name || 'Main Site').trim();
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {});
    const colors = ['#0056C9', '#3B82F6', '#93C5FD', '#10B981', '#F59E0B'];
    return Object.keys(counts).map((key, idx) => ({
      name: key,
      value: counts[key],
      color: colors[idx % colors.length]
    }));
  }, [sitesList]);

  // Chart: Zones and Locations per Site
  const siteDensityData = useMemo(() => {
    return sitesList.slice(0, 8).map(s => {
      const siteZones = zonesList.filter(z => Number(z.site_id) === Number(s.id)).length;
      const siteLocs = locationsList.filter(l => Number(l.site_id) === Number(s.id)).length;
      return {
        name: s.site_name || s.site_code || `Site #${s.id}`,
        zones: siteZones,
        locations: siteLocs,
      };
    });
  }, [sitesList, zonesList, locationsList]);

  // Alert Action Handler
  const handleAlertAction = async (id, actionName) => {
    try {
      await dashboardApi.alertAction(id, actionName, {});
      await fetchDashboardData(true);
    } catch (err) {
      alert(err?.message || 'Failed to execute alert action.');
    }
  };

  // Create Alert Submit
  const handleCreateAlertSubmit = async (e) => {
    e.preventDefault();
    if (!alertForm.title || !alertForm.alert_type_id || !alertForm.severity_id) {
      alert('Please fill all required alert fields.');
      return;
    }
    try {
      setSubmittingAlert(true);
      await dashboardApi.createAlert({
        site_id: alertForm.site_id ? Number(alertForm.site_id) : null,
        project_id: alertForm.project_id ? Number(alertForm.project_id) : null,
        alert_type_id: Number(alertForm.alert_type_id),
        severity_id: Number(alertForm.severity_id),
        title: alertForm.title,
        message: alertForm.message,
        due_date: alertForm.due_date || null,
        assigned_to: alertForm.assigned_to || null,
      });
      setCreateAlertModalOpen(false);
      setAlertForm({
        site_id: '',
        project_id: '',
        alert_type_id: '',
        severity_id: '',
        title: '',
        message: '',
        due_date: '',
        assigned_to: '',
      });
      await fetchDashboardData(true);
    } catch (err) {
      alert(err?.message || 'Failed to create site alert.');
    } finally {
      setSubmittingAlert(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-[#061A33] font-['Manrope',sans-serif] p-6 pb-20">
      
      {/* TOP HEADER & CONTROLS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide bg-[#0056C9]/10 text-[#0056C9]">
              Field Intelligence
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#061A33] uppercase tracking-wide mt-1">
            Site Dashboard
          </h1>
          <p className="text-sm text-gray-500">
            Field operations command center: site distribution, zones, work locations, safety hazards, and DPR activity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Project Filter */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
            <Briefcase className="w-4 h-4 text-[#0056C9]" />
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="text-sm font-semibold text-[#061A33] bg-transparent focus:outline-none cursor-pointer max-w-[220px]"
            >
              <option value="ALL">All Projects ({projectsList.length})</option>
              {projectsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_name || p.name || `Project #${p.id}`}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setCreateAlertModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold bg-[#0056C9] hover:bg-blue-700 text-white rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Raise Site Alert</span>
          </button>

          <button
            onClick={() => fetchDashboardData(true)}
            disabled={isLoading || isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium border border-gray-200 bg-white rounded-lg hover:bg-gray-50 shadow-sm transition disabled:opacity-60"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Updating...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between text-red-700 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-[#B91C1C]" />
            <span>{error}</span>
          </div>
          <button onClick={() => fetchDashboardData()} className="font-bold underline">
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="bg-white p-4 rounded-xl border border-gray-200 animate-pulse h-24"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 animate-pulse h-80 lg:col-span-2"></div>
            <div className="bg-white p-6 rounded-xl border border-gray-200 animate-pulse h-80"></div>
          </div>
        </div>
      ) : (
        <>
          {/* TOP SITE KPI CARDS STRIP */}
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Sites</span>
              <div className="text-2xl font-bold mt-1 text-[#061A33]">{sitesList.length}</div>
              <span className="text-[10px] text-gray-400">{primarySitesCount} primary locations</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Active Sites</span>
              <div className="text-2xl font-bold mt-1 text-[#10B981]">{activeSitesCount}</div>
              <span className="text-[10px] text-gray-400">Under execution</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Site Zones</span>
              <div className="text-2xl font-bold mt-1 text-[#0056C9]">{zonesList.length}</div>
              <span className="text-[10px] text-gray-400">Configured zones</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Work Locations</span>
              <div className="text-2xl font-bold mt-1 text-[#061A33]">{locationsList.length}</div>
              <span className="text-[10px] text-gray-400">Physical spot spots</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Daily Reports</span>
              <div className="text-2xl font-bold mt-1 text-[#061A33]">{dailyReports.length || overview.daily_report_count}</div>
              <span className="text-[10px] text-gray-400">Site DPRs logged</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Open Alerts</span>
              <div className="text-2xl font-bold mt-1 text-[#B91C1C]">{overview.open_alert_count || alerts.length}</div>
              <span className="text-[10px] text-gray-400">Safety & operational risks</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Project Budget</span>
              <div className="text-lg font-bold mt-1 text-[#061A33]">{formatCurrency(overview.approved_budget)}</div>
              <span className="text-[10px] text-gray-400">Approved funds</span>
            </div>
          </div>

          {/* VISUAL ANALYTICS ROW 1: ZONES DENSITY & SITE STATUS DONUT */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            
            {/* Zones & Locations per Site Bar Chart */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm lg:col-span-2 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#061A33] uppercase tracking-wide">
                      Site Density: Zones & Work Locations
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">Physical sub-divisions and execution work locations configured per site</p>
                  </div>
                  <span className="text-xs font-semibold text-[#0056C9]">Top {siteDensityData.length} Sites</span>
                </div>

                {siteDensityData.length > 0 ? (
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={siteDensityData} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
                        <defs>
                          <linearGradient id="siteZonesGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0056C9" stopOpacity={0.35}/>
                            <stop offset="95%" stopColor="#0056C9" stopOpacity={0.0}/>
                          </linearGradient>
                          <linearGradient id="workLocationsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis 
                          dataKey="name" 
                          tick={{ fontSize: 11, fill: '#6B7280' }} 
                          interval={0} 
                          angle={-15} 
                          textAnchor="end" 
                        />
                        <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} allowDecimals={false} />
                        <Tooltip 
                          contentStyle={{ 
                            borderRadius: '8px', 
                            border: 'none', 
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            backgroundColor: '#FFFFFF' 
                          }} 
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                        <Area 
                          type="monotone" 
                          dataKey="zones" 
                          name="Site Zones" 
                          stroke="#0056C9" 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#siteZonesGradient)" 
                          dot={{ r: 4, fill: '#0056C9', strokeWidth: 2, stroke: '#FFFFFF' }}
                          activeDot={{ r: 6, fill: '#0056C9', stroke: '#FFFFFF', strokeWidth: 2 }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="locations" 
                          name="Work Locations" 
                          stroke="#3B82F6" 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#workLocationsGradient)" 
                          dot={{ r: 4, fill: '#3B82F6', strokeWidth: 2, stroke: '#FFFFFF' }}
                          activeDot={{ r: 6, fill: '#3B82F6', stroke: '#FFFFFF', strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">
                    No site zone or location data available
                  </div>
                )}
              </div>
            </div>

            {/* Sites by Status Donut */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#061A33] uppercase tracking-wide mb-1">
                  Sites by Status
                </h3>
                <p className="text-xs text-gray-400 mb-4">Operational status across field sites</p>

                {siteStatusData.length > 0 ? (
                  <>
                    <div className="relative w-full h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={siteStatusData}
                            cx="50%" cy="50%"
                            innerRadius={55} outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {siteStatusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-xl font-bold text-[#061A33]">{sitesList.length}</span>
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Total Sites</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-center gap-3 mt-3 pt-3 border-t border-gray-100">
                      {siteStatusData.map((s) => (
                        <div key={s.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }}></div>
                          <span>{s.name}: <strong>{s.value}</strong></span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
                    No site records
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* COMPREHENSIVE ALL SITES TABLE */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/70">
              <div>
                <h3 className="text-sm font-bold text-[#061A33] uppercase tracking-wide">
                  Sites Directory & Operational Status ({filteredSites.length})
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium">Status:</span>
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="px-2.5 py-1 text-xs font-medium border border-gray-200 rounded-md bg-white focus:outline-none focus:border-[#0056C9]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PLANNED">Planned</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-4">Site Name & Code</th>
                    <th className="px-5 py-4">Project</th>
                    <th className="px-5 py-4">Type</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Location</th>
                    <th className="px-5 py-4">Site In-Charge</th>
                    <th className="px-5 py-4 text-right">Zones / Locations</th>
                    <th className="px-5 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSites.length > 0 ? (
                    filteredSites.map((s) => {
                      const siteZones = zonesList.filter(z => Number(z.site_id) === Number(s.id)).length;
                      const siteLocs = locationsList.filter(l => Number(l.site_id) === Number(s.id)).length;
                      return (
                        <tr key={s.id} className="hover:bg-gray-50/60 transition">
                          <td className="px-5 py-4">
                            <div className="font-bold text-[#061A33] flex items-center gap-2">
                              <span>{s.site_name || `Site #${s.id}`}</span>
                              {(s.is_primary === 1 || s.is_primary === '1') && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-blue-50 text-[#0056C9] border border-blue-200">
                                  Primary
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">{s.site_code || `SITE-${s.id}`}</div>
                          </td>
                          <td className="px-5 py-4 font-medium text-gray-700">
                            {s.project_name || '—'}
                          </td>
                          <td className="px-5 py-4 text-xs text-gray-600">
                            {s.site_type_name || 'Main Site'}
                          </td>
                          <td className="px-5 py-4">
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700">
                              {s.site_status_name || s.status || 'Active'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-xs text-gray-600">
                            {[s.city, s.district].filter(Boolean).join(', ') || '—'}
                          </td>
                          <td className="px-5 py-4 text-xs text-gray-700 font-medium">
                            {[s.site_engineer_first_name, s.site_engineer_last_name].filter(Boolean).join(' ') || s.site_engineer_name || 'Unassigned'}
                          </td>
                          <td className="px-5 py-4 text-right font-bold text-[#061A33]">
                            {siteZones} zones • {siteLocs} locs
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              onClick={() => navigate('/sites/zones')}
                              className="text-xs font-bold text-[#0056C9] hover:underline flex items-center justify-end gap-1 ml-auto"
                            >
                              <span>Manage</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="8" className="px-5 py-8 text-center text-gray-400 text-sm">
                        No sites found matching the filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SITE OPERATIONAL ALERTS & SAFETY HAZARDS */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/70">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#B91C1C]" />
                <h3 className="text-sm font-bold text-[#061A33] uppercase tracking-wide">
                  Site Safety & Operational Risk Alerts ({alerts.length})
                </h3>
              </div>
              <button
                onClick={() => setCreateAlertModalOpen(true)}
                className="text-xs font-bold text-[#0056C9] hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Raise Alert</span>
              </button>
            </div>

            <div className="divide-y divide-gray-100">
              {alerts.length > 0 ? (
                alerts.map((alert) => (
                  <div key={alert.id} className="p-5 hover:bg-gray-50/60 transition">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span 
                          className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide"
                          style={{
                            backgroundColor: `${getSeverityColor(alert.severity_code)}15`,
                            color: getSeverityColor(alert.severity_code),
                          }}
                        >
                          {alert.severity_name || alert.severity_code}
                        </span>
                        <span className="text-xs font-bold text-gray-600">
                          {alert.alert_type_name || alert.alert_type_code}
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs font-bold text-[#061A33]">
                          {alert.project_name || 'Site Field Operation'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        {alert.due_date && (
                          <span className="text-gray-500">
                            Due: <strong className="text-gray-700">{alert.due_date}</strong>
                          </span>
                        )}
                        <span 
                          className="px-2 py-0.5 rounded text-[11px] font-semibold"
                          style={{
                            backgroundColor: `${getStatusColor(alert.status_code)}15`,
                            color: getStatusColor(alert.status_code),
                          }}
                        >
                          {alert.status_name || alert.status_code}
                        </span>
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-[#061A33] mb-1">
                      {alert.title}
                    </h4>
                    <p className="text-xs text-gray-600 leading-relaxed mb-3">
                      {alert.message}
                    </p>

                    {alert.status_code !== 'RESOLVED' && alert.status_code !== 'DISMISSED' && (
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                        {alert.status_code === 'OPEN' && (
                          <button
                            onClick={() => handleAlertAction(alert.id, 'acknowledge')}
                            className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold rounded transition"
                          >
                            Acknowledge
                          </button>
                        )}
                        {(alert.status_code === 'OPEN' || alert.status_code === 'ACKNOWLEDGED') && (
                          <button
                            onClick={() => handleAlertAction(alert.id, 'start')}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#0056C9] text-xs font-semibold rounded transition"
                          >
                            Start Investigation
                          </button>
                        )}
                        <button
                          onClick={() => handleAlertAction(alert.id, 'resolve')}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded transition"
                        >
                          Mark as Resolved
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-400 text-sm">
                  <CheckCircle2 className="w-8 h-8 text-[#10B981] mx-auto mb-2" />
                  <span>No open site safety hazards or field alerts logged.</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* CREATE ALERT MODAL */}
      {createAlertModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#061A33]/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 mb-4">
              <h3 className="text-base font-bold text-[#061A33]">Raise Site Alert / Hazard</h3>
              <button
                onClick={() => setCreateAlertModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAlertSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Site *
                  </label>
                  <select
                    required
                    value={alertForm.site_id}
                    onChange={(e) => {
                      const sid = e.target.value;
                      const siteObj = sitesList.find(s => Number(s.id) === Number(sid));
                      setAlertForm({ 
                        ...alertForm, 
                        site_id: sid,
                        project_id: siteObj?.project_id || alertForm.project_id
                      });
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-[#0056C9]"
                  >
                    <option value="">Select Site</option>
                    {sitesList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.site_name || s.name || `Site #${s.id}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Severity *
                  </label>
                  <select
                    required
                    value={alertForm.severity_id}
                    onChange={(e) => setAlertForm({ ...alertForm, severity_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-[#0056C9]"
                  >
                    <option value="">Select Severity</option>
                    {masters.alert_severities?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.severity_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Alert Type *
                </label>
                <select
                  required
                  value={alertForm.alert_type_id}
                  onChange={(e) => setAlertForm({ ...alertForm, alert_type_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-[#0056C9]"
                >
                  <option value="">Select Type</option>
                  {masters.alert_types?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.alert_type_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Alert Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scaffolding stability check required in Zone A"
                  value={alertForm.title}
                  onChange={(e) => setAlertForm({ ...alertForm, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#0056C9]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Description *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe the field safety issue, observation, or operational blocker..."
                  value={alertForm.message}
                  onChange={(e) => setAlertForm({ ...alertForm, message: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#0056C9]"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={alertForm.due_date}
                    onChange={(e) => setAlertForm({ ...alertForm, due_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#0056C9]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Assignee
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Site Supervisor / Safety Officer"
                    value={alertForm.assigned_to}
                    onChange={(e) => setAlertForm({ ...alertForm, assigned_to: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#0056C9]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setCreateAlertModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAlert}
                  className="px-4 py-2 text-sm font-semibold bg-[#0056C9] hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-60"
                >
                  {submittingAlert ? 'Submitting...' : 'Raise Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
