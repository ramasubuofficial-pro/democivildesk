import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ReferenceLine
} from 'recharts';
import { 
  Briefcase, Activity, AlertTriangle, CheckCircle2, Clock, 
  Calendar, RefreshCw, Plus, MapPin, Building, FileText, 
  ShieldAlert, ExternalLink, ArrowRight, X, AlertCircle, 
  Layers, DollarSign, CheckSquare, Users, TrendingUp, Filter
} from 'lucide-react';
import { 
  dashboardApi, 
  projectsApi, 
  sitesApi, 
  managementReviewsApi 
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

const PROJECT_STATUS_COLORS = {
  ACTIVE: '#10B981',
  PLANNING: '#3B82F6',
  ON_HOLD: '#F59E0B',
  COMPLETED: '#0056C9',
  CANCELLED: '#6B7280',
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

export function ProjectDashboardPage() {
  const navigate = useNavigate();

  // Filters
  const [selectedProjectId, setSelectedProjectId] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');

  // Live Data States
  const [projectsList, setProjectsList] = useState([]);
  const [performanceList, setPerformanceList] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [sites, setSites] = useState([]);
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
    project_id: '',
    alert_type_id: '',
    severity_id: '',
    title: '',
    message: '',
    due_date: '',
    assigned_to: '',
  });
  const [submittingAlert, setSubmittingAlert] = useState(false);

  // Fetch Dashboard Data from live APIs
  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    const params = selectedProjectId !== 'ALL' ? { project_id: Number(selectedProjectId) } : {};

    try {
      const [
        projectsRes,
        overviewRes,
        perfRes,
        alertsRes,
        sitesRes,
        mastersRes,
      ] = await Promise.allSettled([
        projectsApi.list(),
        dashboardApi.overview(params),
        dashboardApi.projectPerformance(params),
        dashboardApi.alerts(params),
        sitesApi.list(params),
        dashboardApi.masters(),
      ]);

      if (projectsRes.status === 'fulfilled') {
        const list = projectsRes.value?.data?.projects || 
          (Array.isArray(projectsRes.value?.data) ? projectsRes.value.data : []);
        setProjectsList(list);
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

      if (perfRes.status === 'fulfilled' && perfRes.value?.data?.projects) {
        setPerformanceList(perfRes.value.data.projects.map(p => ({
          ...p,
          planned_progress_percentage: Number(p.planned_progress_percentage || 0),
          actual_progress_percentage: Number(p.actual_progress_percentage || 0),
          progress_variance: Number(p.progress_variance || 0),
          report_count: Number(p.report_count || 0),
        })));
      }

      if (alertsRes.status === 'fulfilled' && alertsRes.value?.data?.alerts) {
        setAlerts(alertsRes.value.data.alerts);
      }

      if (sitesRes.status === 'fulfilled') {
        const sList = sitesRes.value?.data?.sites || 
          (Array.isArray(sitesRes.value?.data) ? sitesRes.value.data : []);
        setSites(sList);
      }

      if (mastersRes.status === 'fulfilled' && mastersRes.value?.data?.masters) {
        setMasters(mastersRes.value.data.masters);
      }
    } catch (err) {
      console.error('Failed to fetch project dashboard data:', err);
      setError(err?.message || 'Failed to load project dashboard.');
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

  // Filtered Projects
  const filteredPerformance = useMemo(() => {
    return performanceList.filter(p => {
      if (selectedStatusFilter !== 'ALL') {
        const status = (p.status || p.project_status || '').toUpperCase();
        if (!status.includes(selectedStatusFilter)) return false;
      }
      return true;
    });
  }, [performanceList, selectedStatusFilter]);

  // Aggregated KPIs
  const totalBudget = useMemo(() => {
    if (overview.approved_budget > 0) return overview.approved_budget;
    return projectsList.reduce((sum, p) => sum + Number(p.approved_budget || p.contract_value || 0), 0);
  }, [overview.approved_budget, projectsList]);

  const averageProgress = useMemo(() => {
    if (performanceList.length === 0) return 0;
    const sum = performanceList.reduce((acc, p) => acc + (p.actual_progress_percentage || 0), 0);
    return (sum / performanceList.length).toFixed(1);
  }, [performanceList]);

  const delayedProjectsCount = useMemo(() => {
    return performanceList.filter(p => p.progress_variance < -2).length;
  }, [performanceList]);

  const criticalAlertsCount = useMemo(() => {
    return alerts.filter(a => a.severity_code === 'CRITICAL').length;
  }, [alerts]);

  // Charts: Project Status Donut
  const projectStatusData = useMemo(() => {
    const counts = projectsList.reduce((acc, p) => {
      const status = (p.status_name || p.status || 'Active').toUpperCase();
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    const colors = ['#10B981', '#0056C9', '#3B82F6', '#F59E0B', '#6B7280', '#8B5CF6'];
    return Object.keys(counts).map((key, idx) => ({
      name: key,
      value: counts[key],
      color: PROJECT_STATUS_COLORS[key] || colors[idx % colors.length]
    }));
  }, [projectsList]);

  // Charts: Cost Breakdown Donut
  const costBreakdownData = useMemo(() => [
    { name: 'Direct Expense', value: overview.expense_actual || 0, color: '#0056C9' },
    { name: 'Subcontracts', value: overview.subcontract_actual || 0, color: '#3B82F6' },
    { name: 'Labour Wages', value: overview.labour_actual || 0, color: '#93C5FD' },
  ].filter(c => c.value > 0), [overview]);

  // Charts: Project Progress Comparison
  const progressChartData = useMemo(() => {
    return performanceList.slice(0, 10).map(p => ({
      code: p.project_code || `PRJ-${p.id}`,
      name: p.project_name || p.project_code || `PRJ-${p.id}`,
      planned: p.planned_progress_percentage || 0,
      actual: p.actual_progress_percentage || 0,
      variance: p.progress_variance || 0,
    }));
  }, [performanceList]);

  // Alert Action Handler
  const handleAlertAction = async (id, actionName) => {
    try {
      await dashboardApi.alertAction(id, actionName, {});
      await fetchDashboardData(true);
    } catch (err) {
      alert(err?.message || 'Failed to update alert action.');
    }
  };

  // Create Alert Submit
  const handleCreateAlertSubmit = async (e) => {
    e.preventDefault();
    if (!alertForm.title || !alertForm.alert_type_id || !alertForm.severity_id || !alertForm.project_id) {
      alert('Please fill all required alert fields including project.');
      return;
    }
    try {
      setSubmittingAlert(true);
      await dashboardApi.createAlert({
        project_id: Number(alertForm.project_id),
        alert_type_id: Number(alertForm.alert_type_id),
        severity_id: Number(alertForm.severity_id),
        title: alertForm.title,
        message: alertForm.message,
        due_date: alertForm.due_date || null,
        assigned_to: alertForm.assigned_to || null,
      });
      setCreateAlertModalOpen(false);
      setAlertForm({
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
      alert(err?.message || 'Failed to create alert.');
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
              Portfolio Analytics
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#061A33] uppercase tracking-wide mt-1">
            Projects Dashboard
          </h1>
          <p className="text-sm text-gray-500">
            Real-time portfolio intelligence: project progress comparison, budget utilization, schedule health, and risks.
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
            <span>Raise Alert</span>
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
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
            {[...Array(8)].map((_, i) => (
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
          {/* TOP PORTFOLIO KPI CARDS STRIP */}
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Projects</span>
              <div className="text-2xl font-bold mt-1 text-[#061A33]">
                {overview.project_count || projectsList.length}
              </div>
              <span className="text-[10px] text-gray-400">Active portfolio</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Avg Progress</span>
              <div className="text-2xl font-bold mt-1 text-[#0056C9]">
                {averageProgress}%
              </div>
              <span className="text-[10px] text-gray-400">Physical completion</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Delayed Projects</span>
              <div className={`text-2xl font-bold mt-1 ${delayedProjectsCount > 0 ? 'text-[#B91C1C]' : 'text-[#10B981]'}`}>
                {delayedProjectsCount}
              </div>
              <span className="text-[10px] text-gray-400">Behind schedule</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Approved Budget</span>
              <div className="text-xl font-bold mt-1 text-[#061A33]">
                {formatCurrency(totalBudget)}
              </div>
              <span className="text-[10px] text-gray-400">Total approved</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Actual Spent</span>
              <div className="text-xl font-bold mt-1 text-[#061A33]">
                {formatCurrency(overview.total_actual_cost)}
              </div>
              <span className="text-[10px] text-gray-400">Incurred cost</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Budget Balance</span>
              <div className={`text-xl font-bold mt-1 ${overview.budget_balance >= 0 ? 'text-[#10B981]' : 'text-[#B91C1C]'}`}>
                {formatCurrency(overview.budget_balance)}
              </div>
              <span className="text-[10px] text-gray-400">Remaining funds</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Daily Reports</span>
              <div className="text-2xl font-bold mt-1 text-[#061A33]">
                {overview.daily_report_count}
              </div>
              <span className="text-[10px] text-gray-400">Site submissions</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Open Alerts</span>
              <div className="text-2xl font-bold mt-1 text-[#B91C1C]">
                {overview.open_alert_count || alerts.length}
              </div>
              <span className="text-[10px] text-gray-400">{criticalAlertsCount} critical risks</span>
            </div>
          </div>

          {/* VISUAL ANALYTICS ROW 1: COMPARATIVE PROGRESS & STATUS DONUT */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            
            {/* Planned vs Actual Progress Bar Chart */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm lg:col-span-2 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#061A33] uppercase tracking-wide">
                      Project Progress Comparison (%)
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">Planned vs Actual progress achieved across projects</p>
                  </div>
                  <span className="text-xs font-semibold text-[#0056C9]">Top {progressChartData.length} Projects</span>
                </div>

                {progressChartData.length > 0 ? (
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={progressChartData} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis 
                          dataKey="code" 
                          tick={{ fontSize: 11, fill: '#6B7280' }} 
                          interval={0} 
                        />
                        <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#6B7280' }} />
                        <Tooltip 
                          formatter={(v, name) => [`${v}%`, name]}
                          labelFormatter={(code, payload) => {
                            const item = payload?.[0]?.payload;
                            return item ? `${item.name} (${item.code})` : code;
                          }}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                        <Bar dataKey="planned" name="Planned Progress" fill="#93C5FD" radius={[4, 4, 0, 0]} barSize={16} />
                        <Bar dataKey="actual" name="Actual Progress" fill="#0056C9" radius={[4, 4, 0, 0]} barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">
                    No project performance data available
                  </div>
                )}
              </div>
            </div>

            {/* Project Status Donut */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#061A33] uppercase tracking-wide mb-1">
                  Projects by Status
                </h3>
                <p className="text-xs text-gray-400 mb-4">Portfolio lifecycle distribution</p>

                {projectStatusData.length > 0 ? (
                  <>
                    <div className="relative w-full h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={projectStatusData}
                            cx="50%" cy="50%"
                            innerRadius={55} outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {projectStatusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-xl font-bold text-[#061A33]">{projectsList.length}</span>
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Total</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-center gap-3 mt-3 pt-3 border-t border-gray-100">
                      {projectStatusData.map((s) => (
                        <div key={s.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }}></div>
                          <span>{s.name}: <strong>{s.value}</strong></span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
                    No project records
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* VISUAL ANALYTICS ROW 2: PROGRESS VARIANCE & COST BREAKDOWN */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            
            {/* Progress Variance Bar Chart */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#061A33] uppercase tracking-wide">
                      Progress Variance Analysis
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">Deviation from planned baseline (Positive = Ahead, Negative = Behind)</p>
                  </div>
                </div>

                {progressChartData.length > 0 ? (
                  <div className="h-[240px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={progressChartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                        <XAxis type="number" tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#6B7280' }} />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#061A33', fontWeight: 600 }} width={120} />
                        <Tooltip cursor={{ fill: '#F9FAFB' }} formatter={v => `${v}%`} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <ReferenceLine x={0} stroke="#9CA3AF" />
                        <Bar dataKey="variance" name="Variance" radius={4} barSize={16}>
                          {progressChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.variance >= 0 ? '#10B981' : '#B91C1C'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[240px] flex items-center justify-center text-gray-400 text-sm">
                    No variance data
                  </div>
                )}
              </div>
            </div>

            {/* Cost Breakdown Donut */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#061A33] uppercase tracking-wide">
                      Actual Cost Breakdown
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">Portfolio expense, subcontract, and labour split</p>
                  </div>
                  <span className="text-xs font-bold text-[#061A33]">
                    Total: {formatCurrency(overview.total_actual_cost)}
                  </span>
                </div>

                {costBreakdownData.length > 0 ? (
                  <>
                    <div className="relative w-full h-[190px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={costBreakdownData}
                            cx="50%" cy="50%"
                            innerRadius={55} outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {costBreakdownData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(v) => formatCurrency(v)}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-base font-bold text-[#061A33]">{formatCurrency(overview.total_actual_cost)}</span>
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Actual Cost</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-2 pt-3 border-t border-gray-100 text-center">
                      <div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase">Expense</div>
                        <div className="text-xs font-bold text-[#061A33]">{formatCurrency(overview.expense_actual)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase">Subcontracts</div>
                        <div className="text-xs font-bold text-[#061A33]">{formatCurrency(overview.subcontract_actual)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase">Labour</div>
                        <div className="text-xs font-bold text-[#061A33]">{formatCurrency(overview.labour_actual)}</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
                    No cost entries recorded
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* COMPREHENSIVE PROJECTS PERFORMANCE TABLE */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/70">
              <div>
                <h3 className="text-sm font-bold text-[#061A33] uppercase tracking-wide">
                  Projects Directory & Performance Table ({filteredPerformance.length})
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
                  <option value="PLANNING">Planning</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-4">Project</th>
                    <th className="px-5 py-4 w-60">Progress (Plan vs Actual)</th>
                    <th className="px-5 py-4 text-right">Variance</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Timeline</th>
                    <th className="px-5 py-4 text-right">Daily Reports</th>
                    <th className="px-5 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPerformance.length > 0 ? (
                    filteredPerformance.map((p) => {
                      const statusStr = p.progress_variance >= 0 ? 'On Track' : (p.progress_variance < -3 ? 'Delayed' : 'Watch');
                      const statusColor = p.progress_variance >= 0 ? '#10B981' : (p.progress_variance < -3 ? '#B91C1C' : '#F59E0B');
                      return (
                        <tr key={p.id} className="hover:bg-gray-50/60 transition">
                          <td className="px-5 py-4">
                            <div className="font-bold text-[#061A33]">{p.project_name || `Project #${p.id}`}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{p.project_code || `PRJ-${p.id}`}</div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="space-y-1.5">
                              <div className="flex items-center text-xs">
                                <span className="w-14 text-gray-500">Planned</span>
                                <div className="flex-1 bg-gray-100 h-1.5 rounded-full overflow-hidden mx-2">
                                  <div className="bg-[#93C5FD] h-full" style={{ width: `${Math.min(100, p.planned_progress_percentage)}%` }}></div>
                                </div>
                                <span className="w-8 text-right font-medium">{p.planned_progress_percentage}%</span>
                              </div>
                              <div className="flex items-center text-xs">
                                <span className="w-14 text-[#061A33] font-bold">Actual</span>
                                <div className="flex-1 bg-gray-100 h-1.5 rounded-full overflow-hidden mx-2">
                                  <div className="bg-[#0056C9] h-full" style={{ width: `${Math.min(100, p.actual_progress_percentage)}%` }}></div>
                                </div>
                                <span className="w-8 text-right font-bold text-[#0056C9]">{p.actual_progress_percentage}%</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <span className={`font-bold text-sm ${p.progress_variance >= 0 ? 'text-[#10B981]' : 'text-[#B91C1C]'}`}>
                              {p.progress_variance > 0 ? '+' : ''}{p.progress_variance}%
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span 
                              className="px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wide inline-block"
                              style={{ backgroundColor: `${statusColor}15`, color: statusColor }}
                            >
                              {statusStr}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-xs">
                            <div className="text-gray-500">Start: <span className="text-[#061A33] font-medium">{p.planned_start_date || '—'}</span></div>
                            <div className="text-gray-500 mt-0.5">End: <span className="text-[#061A33] font-medium">{p.expected_completion_date || '—'}</span></div>
                          </td>
                          <td className="px-5 py-4 text-right font-bold text-[#061A33]">
                            {p.report_count}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              onClick={() => navigate(`/projects/overview?id=${p.id}`)}
                              className="text-xs font-bold text-[#0056C9] hover:underline flex items-center justify-end gap-1 ml-auto"
                            >
                              <span>Overview</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-5 py-8 text-center text-gray-400 text-sm">
                        No projects found matching the filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* PROJECT RISKS & ALERTS REGISTER */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/70">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#B91C1C]" />
                <h3 className="text-sm font-bold text-[#061A33] uppercase tracking-wide">
                  Active Project Alerts & Operational Risks ({alerts.length})
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
                          {alert.project_name || 'Organization'}
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
                  <span>No active operational alerts or project risks logged.</span>
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
              <h3 className="text-base font-bold text-[#061A33]">Raise Project Alert</h3>
              <button
                onClick={() => setCreateAlertModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAlertSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Project *
                </label>
                <select
                  required
                  value={alertForm.project_id}
                  onChange={(e) => setAlertForm({ ...alertForm, project_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-[#0056C9]"
                >
                  <option value="">Select Project</option>
                  {projectsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.project_name || p.name || `Project #${p.id}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                  Alert Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Schedule delay on Zone 2 foundation pouring"
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
                  placeholder="Describe the operational blocker, impact, and required actions..."
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
                    placeholder="e.g. Project Manager"
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
                  {submittingAlert ? 'Submitting...' : 'Create Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
