import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ReferenceLine
} from 'recharts';
import { 
  Briefcase, Activity, AlertCircle, AlertTriangle, 
  CheckCircle2, Clock, IndianRupee, MoreVertical, Search, Calendar, Filter, 
  ArrowRight, Download, RefreshCw, Layers, TrendingUp, DollarSign, ShieldAlert
} from 'lucide-react';
import { dashboardApi, projectsApi, managementReviewsApi } from '../../../api/apiservice';

// Default Master Fallbacks for colors and metadata
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
  CANCELLED: '#9CA3AF',
  COMPLETED: '#10B981',
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

const isOverdue = (dueDate, status) => {
  if (!dueDate) return false;
  const now = new Date();
  const due = new Date(dueDate);
  return due < now && !['RESOLVED', 'DISMISSED', 'COMPLETED', 'CANCELLED'].includes(status);
};

export function ExecutiveDashboardPage() {
  const navigate = useNavigate();
  const [selectedProject, setSelectedProject] = useState('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Live Data States
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
    budget_balance: 0
  });

  const [projectsList, setProjectsList] = useState([]);
  const [projectsPerformance, setProjectsPerformance] = useState([]);
  const [alertsData, setAlertsData] = useState([]);
  const [reviewsData, setReviewsData] = useState([]);
  const [masters, setMasters] = useState({
    alert_types: [],
    alert_severities: [],
    alert_statuses: [],
    alert_actions: [],
    review_types: [],
    review_priorities: [],
    review_statuses: []
  });

  // Fetch all dashboard data from real APIs
  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    const params = selectedProject !== 'ALL' ? { project_id: selectedProject } : {};

    try {
      const [
        projectsRes,
        mastersRes,
        overviewRes,
        performanceRes,
        alertsRes,
        reviewsRes
      ] = await Promise.allSettled([
        projectsApi.list(),
        dashboardApi.masters(),
        dashboardApi.overview(params),
        dashboardApi.projectPerformance(params),
        dashboardApi.alerts(params),
        managementReviewsApi.list(params)
      ]);

      if (projectsRes.status === 'fulfilled') {
        const list = projectsRes.value?.data?.projects || 
          (Array.isArray(projectsRes.value?.data) ? projectsRes.value.data : []);
        setProjectsList(list);
      }

      if (mastersRes.status === 'fulfilled' && mastersRes.value?.data?.masters) {
        setMasters(mastersRes.value.data.masters);
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

      if (performanceRes.status === 'fulfilled' && performanceRes.value?.data?.projects) {
        setProjectsPerformance(performanceRes.value.data.projects.map(p => ({
          ...p,
          project_code: p.project_code || `PRJ-${p.id}`,
          planned_progress_percentage: Number(p.planned_progress_percentage || 0),
          actual_progress_percentage: Number(p.actual_progress_percentage || 0),
          progress_variance: Number(p.progress_variance || 0),
          report_count: Number(p.report_count || 0),
        })));
      }

      if (alertsRes.status === 'fulfilled' && alertsRes.value?.data?.alerts) {
        setAlertsData(alertsRes.value.data.alerts);
      }

      if (reviewsRes.status === 'fulfilled' && reviewsRes.value?.data?.management_reviews) {
        setReviewsData(reviewsRes.value.data.management_reviews);
      }
    } catch (err) {
      console.error('Failed to load executive dashboard data:', err);
      setError(err?.message || 'Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Color resolution helpers
  const getSeverityColor = (code) => {
    const found = masters.alert_severities?.find(s => (s.severity_code || s.code) === code);
    return found?.color || DEFAULT_SEVERITY_COLORS[code] || '#6B7280';
  };

  const getStatusColor = (code) => {
    const found = masters.alert_statuses?.find(s => (s.status_code || s.code) === code);
    return found?.color || DEFAULT_STATUS_COLORS[code] || '#6B7280';
  };

  // Financial Calculations
  const utilization = useMemo(() => {
    if (!overview.approved_budget || overview.approved_budget <= 0) return 0;
    return Math.min(100, (overview.total_actual_cost / overview.approved_budget) * 100);
  }, [overview.total_actual_cost, overview.approved_budget]);

  // Cost Breakdown for Pie Chart
  const costBreakdownData = useMemo(() => [
    { name: 'Expense', value: overview.expense_actual || 0, color: '#0056C9' },
    { name: 'Subcontract', value: overview.subcontract_actual || 0, color: '#3B82F6' },
    { name: 'Labour', value: overview.labour_actual || 0, color: '#93C5FD' }
  ].filter(c => c.value > 0), [overview]);

  // Alerts Aggregations
  const overdueAlertsCount = useMemo(() => {
    return alertsData.filter(a => isOverdue(a.due_date, a.status_code)).length;
  }, [alertsData]);

  const criticalAlertsCount = useMemo(() => {
    return alertsData.filter(a => a.severity_code === 'CRITICAL').length;
  }, [alertsData]);

  const highAlertsCount = useMemo(() => {
    return alertsData.filter(a => a.severity_code === 'HIGH').length;
  }, [alertsData]);

  const statusDonutData = useMemo(() => {
    const counts = alertsData.reduce((acc, curr) => {
      const code = curr.status_code || 'OPEN';
      acc[code] = (acc[code] || 0) + 1;
      return acc;
    }, {});

    const definedStatuses = masters.alert_statuses?.length > 0
      ? masters.alert_statuses
      : Object.keys(counts).map(k => ({ status_code: k, status_name: k }));

    return definedStatuses.map(s => ({
      name: s.status_name || s.status_code,
      code: s.status_code,
      count: counts[s.status_code] || 0
    })).filter(s => s.count > 0);
  }, [alertsData, masters.alert_statuses]);

  const typeChartData = useMemo(() => {
    const counts = alertsData.reduce((acc, curr) => {
      const name = curr.alert_type_name || curr.alert_type_code || 'Other';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});
    return Object.keys(counts).map(k => ({ name: k, count: counts[k] }));
  }, [alertsData]);

  const severityChartData = useMemo(() => {
    const counts = alertsData.reduce((acc, curr) => {
      const code = curr.severity_code || 'INFO';
      acc[code] = (acc[code] || 0) + 1;
      return acc;
    }, {});

    const definedSeverities = masters.alert_severities?.length > 0
      ? masters.alert_severities
      : Object.keys(counts).map(k => ({ severity_code: k, severity_name: k }));

    return definedSeverities.map(s => ({
      name: s.severity_name || s.severity_code,
      code: s.severity_code,
      count: counts[s.severity_code] || 0
    })).filter(s => s.count > 0);
  }, [alertsData, masters.alert_severities]);

  // Management Reviews Aggregations
  const reviewTypeChartData = useMemo(() => {
    const counts = reviewsData.reduce((acc, curr) => {
      const name = curr.review_type_name || curr.review_type_code || 'Review';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});
    return Object.keys(counts).map(k => ({ name: k, count: counts[k] }));
  }, [reviewsData]);

  // Unified Management Attention Required Queue
  const attentionQueue = useMemo(() => {
    const queue = [];

    // 1. Projects behind schedule (variance < -2%)
    projectsPerformance
      .filter(p => p.progress_variance < -2)
      .forEach(p => {
        queue.push({
          id: `prj-${p.id}`,
          priority: p.progress_variance < -5 ? 'CRITICAL' : 'HIGH',
          project: p.project_name || `Project #${p.id}`,
          area: 'Progress Variance',
          issue: `Behind schedule by ${Math.abs(p.progress_variance)}% (Actual: ${p.actual_progress_percentage}% vs Plan: ${p.planned_progress_percentage}%)`,
          status: 'Behind Plan',
          due: p.expected_completion_date || '—',
          assignee: 'Project Manager'
        });
      });

    // 2. Critical & Overdue Alerts
    alertsData
      .filter(a => a.severity_code === 'CRITICAL' || isOverdue(a.due_date, a.status_code))
      .forEach(a => {
        queue.push({
          id: `alt-${a.id}`,
          priority: a.severity_code === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
          project: a.project_name || 'Organization',
          area: a.alert_type_name || 'Alert',
          issue: a.title || a.message || 'Action required on alert',
          status: a.status_name || a.status_code || 'OPEN',
          due: a.due_date || '—',
          assignee: a.assigned_to || 'Unassigned'
        });
      });

    // 3. High/Critical Open Reviews
    reviewsData
      .filter(r => (r.status_code === 'OPEN' || r.status_code === 'IN_PROGRESS') && (r.priority_code === 'HIGH' || r.priority_code === 'CRITICAL'))
      .forEach(r => {
        queue.push({
          id: `rev-${r.id}`,
          priority: r.priority_code || 'HIGH',
          project: r.project_name || 'General',
          area: r.review_type_name || 'Management Review',
          issue: r.subject || r.observations || 'Review pending action',
          status: r.status_name || r.status_code || 'OPEN',
          due: r.target_date || '—',
          assignee: r.assigned_to || 'Lead Engineer'
        });
      });

    return queue;
  }, [projectsPerformance, alertsData, reviewsData]);

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-[#061A33] font-['Manrope',sans-serif] p-6 pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#061A33] uppercase tracking-wide">Executive Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time command center: Project performance, financial health, risks, and executive decisions.</p>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <button 
            onClick={() => fetchDashboardData(true)}
            disabled={isLoading || isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium border border-gray-200 bg-white rounded-lg hover:bg-gray-50 shadow-sm transition disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 text-[#0056C9] ${isRefreshing ? 'animate-spin' : ''}`} /> 
            {isRefreshing ? 'Updating...' : 'Refresh'}
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
          <button 
            onClick={() => fetchDashboardData()} 
            className="px-3 py-1 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* GLOBAL FILTER BAR */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Briefcase className="w-4 h-4 text-gray-400" />
            <span>Project:</span>
            <select 
              value={selectedProject} 
              onChange={e => setSelectedProject(e.target.value)}
              className="ml-1 px-3 py-1.5 border border-gray-200 rounded-md text-sm font-medium focus:outline-none focus:border-[#0056C9] bg-white text-[#061A33]"
            >
              <option value="ALL">All Projects ({projectsList.length || projectsPerformance.length})</option>
              {(projectsList.length > 0 ? projectsList : projectsPerformance).map(p => (
                <option key={p.id} value={p.id}>
                  {p.project_name || p.project_code || `Project #${p.id}`}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>Period:</span>
            <select 
              value={selectedDateFilter}
              onChange={e => setSelectedDateFilter(e.target.value)}
              className="ml-1 px-3 py-1.5 border border-gray-200 rounded-md text-sm font-medium focus:outline-none focus:border-[#0056C9] bg-white text-[#061A33]"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-gray-500 font-medium">
          Source: <span className="font-semibold text-[#0056C9]">Live ERP Database</span>
        </div>
      </div>

      {/* LOADING STATE SKELETON OR DASHBOARD CONTENT */}
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm animate-pulse h-24 flex flex-col justify-between">
                <div className="h-3 bg-gray-200 rounded w-16"></div>
                <div className="h-6 bg-gray-200 rounded w-20"></div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 h-80 animate-pulse"></div>
            <div className="bg-white p-6 rounded-xl border border-gray-200 h-80 animate-pulse"></div>
          </div>
        </div>
      ) : (
        <>
          {/* EXECUTIVE KPI STRIP */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
            <div 
              onClick={() => navigate('/projects')}
              title="View Projects Portfolio"
              className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between hover:border-[#0056C9] hover:shadow-md cursor-pointer transition group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider group-hover:text-[#0056C9] transition">Projects</span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 group-hover:text-[#0056C9] transition transform group-hover:translate-x-0.5" />
              </div>
              <div className="text-2xl font-bold mt-1 text-[#061A33] group-hover:text-[#0056C9] transition">{overview.project_count}</div>
              <span className="text-[10px] text-gray-400">Total portfolio</span>
            </div>

            <div 
              onClick={() => navigate('/daily-operations/reports')}
              title="View Daily Progress Reports"
              className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between hover:border-[#0056C9] hover:shadow-md cursor-pointer transition group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider group-hover:text-[#0056C9] transition">Daily Reports</span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 group-hover:text-[#0056C9] transition transform group-hover:translate-x-0.5" />
              </div>
              <div className="text-2xl font-bold mt-1 text-[#061A33] group-hover:text-[#0056C9] transition">{overview.daily_report_count}</div>
              <span className="text-[10px] text-gray-400">Site submissions</span>
            </div>

            <div 
              onClick={() => navigate('/daily-operations/issues')}
              title="View Active Site Issues"
              className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between hover:border-[#F59E0B] hover:shadow-md cursor-pointer transition group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider group-hover:text-[#F59E0B] transition">Open Issues</span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 group-hover:text-[#F59E0B] transition transform group-hover:translate-x-0.5" />
              </div>
              <div className="text-2xl font-bold mt-1 text-[#F59E0B]">{overview.open_issue_count}</div>
              <span className="text-[10px] text-gray-400">Active blockers</span>
            </div>

            <div 
              onClick={() => navigate('/budgets')}
              title="View Project Budgets"
              className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between hover:border-[#0056C9] hover:shadow-md cursor-pointer transition group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider group-hover:text-[#0056C9] transition">Approved Budget</span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 group-hover:text-[#0056C9] transition transform group-hover:translate-x-0.5" />
              </div>
              <div className="text-xl font-bold mt-1 text-[#061A33] group-hover:text-[#0056C9] transition">{formatCurrency(overview.approved_budget)}</div>
              <span className="text-[10px] text-gray-400">Baseline allocation</span>
            </div>

            <div 
              onClick={() => navigate('/finance/project-cost')}
              title="View Project Cost Control"
              className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between hover:border-[#0056C9] hover:shadow-md cursor-pointer transition group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider group-hover:text-[#0056C9] transition">Actual Cost</span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 group-hover:text-[#0056C9] transition transform group-hover:translate-x-0.5" />
              </div>
              <div className="text-xl font-bold mt-1 text-[#061A33] group-hover:text-[#0056C9] transition">{formatCurrency(overview.total_actual_cost)}</div>
              <span className="text-[10px] text-gray-400">Incurred till date</span>
            </div>

            <div 
              onClick={() => navigate('/finance/budget-vs-actual')}
              title="View Budget Vs Actual Analysis"
              className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between hover:border-[#10B981] hover:shadow-md cursor-pointer transition group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider group-hover:text-[#10B981] transition">Budget Balance</span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 group-hover:text-[#10B981] transition transform group-hover:translate-x-0.5" />
              </div>
              <div className={`text-xl font-bold mt-1 ${overview.budget_balance >= 0 ? 'text-[#10B981]' : 'text-[#B91C1C]'}`}>
                {formatCurrency(overview.budget_balance)}
              </div>
              <span className="text-[10px] text-gray-400">Remaining funds</span>
            </div>

            <div 
              onClick={() => navigate('/reports/budget-vs-actual')}
              title="View Budget Utilization Report"
              className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between relative overflow-hidden hover:border-[#0056C9] hover:shadow-md cursor-pointer transition group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider group-hover:text-[#0056C9] transition">Budget Utilized</span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 group-hover:text-[#0056C9] transition transform group-hover:translate-x-0.5" />
              </div>
              <div className="text-xl font-bold mt-1 text-[#061A33] group-hover:text-[#0056C9] transition">{utilization.toFixed(1)}%</div>
              <div className="absolute bottom-0 left-0 h-1 bg-gray-100 w-full">
                <div 
                  className={`h-full ${utilization > 90 ? 'bg-[#B91C1C]' : 'bg-[#0056C9]'}`} 
                  style={{ width: `${Math.min(100, utilization)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* SECTION 1: PROJECT PERFORMANCE & COST BREAKDOWN */}
          <h2 className="text-lg font-bold text-[#061A33] mb-3 uppercase tracking-wide border-b border-gray-200 pb-2">Project Performance & Cost Breakdown</h2>
          
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
            {/* Left: Planned vs Actual Progress Area Chart (Maintained 2/3 width) */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm xl:col-span-2 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#061A33] uppercase tracking-wide">
                      Planned vs Actual Progress (%)
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">Comparative progress curve across projects (Hover for project name)</p>
                  </div>
                  <span className="text-xs font-semibold text-[#0056C9]">{projectsPerformance.length} Projects</span>
                </div>

                {projectsPerformance.length > 0 ? (
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={projectsPerformance} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
                        <defs>
                          <linearGradient id="execPlannedProgressGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#93C5FD" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#93C5FD" stopOpacity={0.0}/>
                          </linearGradient>
                          <linearGradient id="execActualProgressGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0056C9" stopOpacity={0.35}/>
                            <stop offset="95%" stopColor="#0056C9" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis 
                          dataKey="project_code" 
                          tick={{ fontSize: 11, fill: '#6B7280' }} 
                          interval={0} 
                          angle={-15} 
                          textAnchor="end" 
                        />
                        <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#6B7280' }} />
                        <Tooltip 
                          formatter={(v, name) => [`${v}%`, name]}
                          labelFormatter={(code, payload) => {
                            const item = payload?.[0]?.payload || projectsPerformance.find(p => (p.project_code || p.project_name) === code);
                            return item ? `${item.project_name} (${item.project_code || code})` : code;
                          }}
                          contentStyle={{ 
                            borderRadius: '8px', 
                            border: '1px solid #E5E7EB', 
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            backgroundColor: '#FFFFFF' 
                          }} 
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                        <Area 
                          type="monotone" 
                          dataKey="planned_progress_percentage" 
                          name="Planned Progress" 
                          stroke="#60A5FA" 
                          strokeWidth={2.5}
                          strokeDasharray="4 4"
                          fillOpacity={1} 
                          fill="url(#execPlannedProgressGradient)" 
                          dot={{ r: 4, fill: '#60A5FA', strokeWidth: 2, stroke: '#FFFFFF' }}
                          activeDot={{ r: 6, fill: '#60A5FA', stroke: '#FFFFFF', strokeWidth: 2 }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="actual_progress_percentage" 
                          name="Actual Progress" 
                          stroke="#0056C9" 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#execActualProgressGradient)" 
                          dot={{ r: 4, fill: '#0056C9', strokeWidth: 2, stroke: '#FFFFFF' }}
                          activeDot={{ r: 6, fill: '#0056C9', stroke: '#FFFFFF', strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[280px] flex flex-col items-center justify-center text-gray-400 text-sm">
                    <Activity className="w-10 h-10 mb-2 stroke-1 text-gray-300" />
                    <span>No project performance metrics available</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Actual Cost Breakdown (Reduced 1/3 Width) */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#061A33] uppercase tracking-wide mb-1">Actual Cost Breakdown</h3>
                <p className="text-xs text-gray-400 mb-3">Portfolio cost distribution</p>
              </div>
              {costBreakdownData.length > 0 ? (
                <>
                  <div className="relative w-full h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={costBreakdownData}
                          cx="50%" cy="50%"
                          innerRadius={60} outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {costBreakdownData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value) => formatCurrency(value)} 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-base font-bold text-[#061A33]">{formatCurrency(overview.total_actual_cost)}</span>
                      <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Total Actual</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100 text-center">
                    <div>
                      <div className="flex items-center justify-center gap-1 text-[11px] text-gray-500 mb-0.5 font-bold uppercase">
                        <div className="w-2 h-2 rounded-full bg-[#0056C9]"></div>
                        Expense
                      </div>
                      <div className="text-xs font-bold text-[#061A33]">{formatCurrency(overview.expense_actual)}</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1 text-[11px] text-gray-500 mb-0.5 font-bold uppercase">
                        <div className="w-2 h-2 rounded-full bg-[#3B82F6]"></div>
                        Subcon
                      </div>
                      <div className="text-xs font-bold text-[#061A33]">{formatCurrency(overview.subcontract_actual)}</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1 text-[11px] text-gray-500 mb-0.5 font-bold uppercase">
                        <div className="w-2 h-2 rounded-full bg-[#93C5FD]"></div>
                        Labour
                      </div>
                      <div className="text-xs font-bold text-[#061A33]">{formatCurrency(overview.labour_actual)}</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-[220px] flex flex-col items-center justify-center text-gray-400 text-sm">
                  <DollarSign className="w-10 h-10 mb-2 stroke-1 text-gray-300" />
                  <span>No recorded actual cost breakdowns yet</span>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: BUDGET UTILIZATION & VARIANCE ANALYSIS (EQUAL WIDTH 50% - 50%) */}
          <h2 className="text-lg font-bold text-[#061A33] mb-3 uppercase tracking-wide border-b border-gray-200 pb-2">Financial Health & Variance Analysis</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Left: Budget Utilization Status */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#061A33] uppercase tracking-wide">Budget Utilization Status</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Approved budget allocation vs incurred expenditure</p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded bg-[#0056C9]/10 text-[#0056C9]">
                    {utilization.toFixed(1)}% Consumed
                  </span>
                </div>
                
                <div className="mb-2 flex justify-between text-sm font-medium">
                  <span className="text-[#061A33] font-semibold">{formatCurrency(overview.total_actual_cost)} spent</span>
                  <span className={overview.budget_balance >= 0 ? 'text-gray-500' : 'text-red-500 font-bold'}>
                    {formatCurrency(overview.budget_balance)} {overview.budget_balance >= 0 ? 'remaining' : 'overrun'}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3.5 mb-2 overflow-hidden flex">
                  <div 
                    className={`h-full transition-all duration-500 ${utilization > 90 ? 'bg-[#B91C1C]' : 'bg-[#0056C9]'}`} 
                    style={{ width: `${Math.min(100, utilization)}%` }}
                  ></div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  Approved Total: <span className="font-bold text-[#061A33]">{formatCurrency(overview.approved_budget)}</span>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-100">
                <h4 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-wide">Financial Distribution</h4>
                <div className="space-y-3.5">
                  <div className="flex items-center text-sm">
                    <span className="w-36 text-gray-600 font-medium">Approved Budget</span>
                    <div className="flex-1 bg-gray-100 h-2.5 rounded-full overflow-hidden mx-3">
                      <div className="bg-[#061A33] h-full w-full"></div>
                    </div>
                    <span className="w-24 text-right font-bold text-[#061A33]">{formatCurrency(overview.approved_budget)}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <span className="w-36 text-gray-600 font-medium">Actual Incurred</span>
                    <div className="flex-1 bg-gray-100 h-2.5 rounded-full overflow-hidden mx-3">
                      <div className="bg-[#0056C9] h-full" style={{ width: `${Math.min(100, utilization)}%` }}></div>
                    </div>
                    <span className="w-24 text-right font-bold text-[#061A33]">{formatCurrency(overview.total_actual_cost)}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <span className="w-36 text-gray-600 font-medium">Balance</span>
                    <div className="flex-1 bg-gray-100 h-2.5 rounded-full overflow-hidden mx-3">
                      <div 
                        className={`h-full ${overview.budget_balance >= 0 ? 'bg-[#10B981]' : 'bg-[#B91C1C]'}`} 
                        style={{ width: `${overview.approved_budget > 0 ? Math.max(0, Math.min(100, (overview.budget_balance / overview.approved_budget) * 100)) : 0}%` }}
                      ></div>
                    </div>
                    <span className={`w-24 text-right font-bold ${overview.budget_balance >= 0 ? 'text-[#10B981]' : 'text-[#B91C1C]'}`}>
                      {formatCurrency(overview.budget_balance)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Progress Variance Analysis (Increased Width to Equal 50% Space) */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#061A33] uppercase tracking-wide">Progress Variance Analysis</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Deviation from planned baseline (% Ahead / Behind)</p>
                  </div>
                  <span className="text-xs font-semibold text-gray-500">Variance (%)</span>
                </div>
                {projectsPerformance.length > 0 ? (
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={projectsPerformance} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                        <XAxis type="number" tickFormatter={v => `${v}%`} tick={{ fontSize: 12, fill: '#6B7280' }} />
                        <YAxis 
                          dataKey="project_code" 
                          type="category" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 12, fill: '#061A33', fontWeight: 600 }} 
                          width={90} 
                        />
                        <Tooltip 
                          cursor={{ fill: '#F9FAFB' }} 
                          formatter={(v, name) => [`${v}%`, name]} 
                          labelFormatter={(code, payload) => {
                            const item = payload?.[0]?.payload || projectsPerformance.find(p => (p.project_code || p.project_name) === code);
                            return item ? `${item.project_name} (${item.project_code || code})` : code;
                          }}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                        />
                        <ReferenceLine x={0} stroke="#9CA3AF" />
                        <Bar dataKey="progress_variance" name="Variance" radius={4} barSize={16}>
                          {projectsPerformance.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.progress_variance >= 0 ? '#10B981' : '#B91C1C'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[280px] flex flex-col items-center justify-center text-gray-400 text-sm">
                    <Activity className="w-10 h-10 mb-2 stroke-1 text-gray-300" />
                    <span>No project variance data available</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Project Performance Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-8 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-4">Project</th>
                    <th className="px-5 py-4 w-64">Progress Status</th>
                    <th className="px-5 py-4 text-right">Variance</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Timeline</th>
                    <th className="px-5 py-4 text-right">Daily Reports</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {projectsPerformance.length > 0 ? (
                    projectsPerformance.map(p => {
                      const statusStr = p.progress_variance >= 0 ? 'On Track' : (p.progress_variance < -3 ? 'Delayed' : 'Watch');
                      const statusColor = p.progress_variance >= 0 ? '#10B981' : (p.progress_variance < -3 ? '#B91C1C' : '#F59E0B');
                      return (
                        <tr key={p.id} className="hover:bg-gray-50/50 transition">
                          <td className="px-5 py-4">
                            <div className="font-bold text-[#061A33]">{p.project_name || `Project #${p.id}`}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{p.project_code || `PRJ-${p.id}`}</div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="space-y-2">
                              <div className="flex items-center text-xs">
                                <span className="w-14 text-gray-500 font-medium">Planned</span>
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
                            {p.latest_report_date && (
                              <div className="text-gray-400 mt-0.5 text-[10px]">Latest: {p.latest_report_date}</div>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right font-bold text-[#061A33]">
                            {p.report_count}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-5 py-8 text-center text-gray-400 text-sm">
                        No projects recorded in the system.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ALERT & RISK CENTER */}
          <h2 className="text-lg font-bold text-[#061A33] mb-3 uppercase tracking-wide border-b border-gray-200 pb-2">Alert & Risk Center</h2>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Open Alerts</span>
              <div className="text-2xl font-bold mt-1 text-[#0056C9]">{overview.open_alert_count}</div>
              <span className="text-[10px] text-gray-400">Total active risks</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs text-[#B91C1C] font-bold uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5"/> Critical Alerts
              </span>
              <div className="text-2xl font-bold mt-1 text-[#B91C1C]">{criticalAlertsCount}</div>
              <span className="text-[10px] text-gray-400">Immediate action needed</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs text-[#EF4444] font-bold uppercase tracking-wider">High Severity</span>
              <div className="text-2xl font-bold mt-1 text-[#EF4444]">{highAlertsCount}</div>
              <span className="text-[10px] text-gray-400">Elevated concern</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs text-[#F59E0B] font-bold uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3.5 h-3.5"/> Overdue Alerts
              </span>
              <div className="text-2xl font-bold mt-1 text-[#F59E0B]">{overdueAlertsCount}</div>
              <span className="text-[10px] text-gray-400">Exceeded due date</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-sm font-bold text-[#061A33] mb-4">Alerts by Status</h3>
              {statusDonutData.length > 0 ? (
                <div className="h-[220px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusDonutData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="count">
                        {statusDonutData.map((entry, index) => <Cell key={`cell-${index}`} fill={getStatusColor(entry.code)} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-bold text-[#061A33]">{alertsData.length}</span>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total</span>
                  </div>
                </div>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
                  No alerts recorded
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-sm font-bold text-[#061A33] mb-4">Alerts by Type</h3>
              {typeChartData.length > 0 ? (
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={typeChartData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} width={110} />
                      <Tooltip cursor={{ fill: '#F9FAFB' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="count" fill="#0056C9" radius={[0, 4, 4, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
                  No alerts data
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-sm font-bold text-[#061A33] mb-4">Alerts by Severity</h3>
              {severityChartData.length > 0 ? (
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={severityChartData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} width={70} />
                      <Tooltip cursor={{ fill: '#F9FAFB' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={12}>
                        {severityChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={getSeverityColor(entry.code)} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
                  No alerts data
                </div>
              )}
            </div>
          </div>

          {/* MANAGEMENT REVIEWS & OPERATIONAL HEALTH */}
          <h2 className="text-lg font-bold text-[#061A33] mb-3 uppercase tracking-wide border-b border-gray-200 pb-2">Management Reviews & Operations</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#061A33] mb-5">Management Reviews Status</h3>
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center pb-2.5 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Total Reviews</span>
                    <span className="font-bold text-[#061A33]">{reviewsData.length}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2.5 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Open Reviews</span>
                    <span className="font-bold text-[#0056C9]">{reviewsData.filter(r => r.status_code === 'OPEN').length}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2.5 border-b border-gray-100">
                    <span className="text-sm text-gray-600">In Progress</span>
                    <span className="font-bold text-[#F59E0B]">{reviewsData.filter(r => r.status_code === 'IN_PROGRESS').length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#B91C1C] font-medium">Critical Priority</span>
                    <span className="font-bold text-[#B91C1C]">{reviewsData.filter(r => r.priority_code === 'CRITICAL').length}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-sm font-bold text-[#061A33] mb-4">Review Distribution</h3>
              {reviewTypeChartData.length > 0 ? (
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reviewTypeChartData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} width={90} />
                      <Tooltip cursor={{ fill: '#F9FAFB' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="count" fill="#061A33" radius={[0, 4, 4, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
                  No review notes recorded
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-wide">Executive Health Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-left">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Active Projects</span>
                    <span className="text-base font-bold text-[#061A33]">{overview.project_count}</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Budget Utilized</span>
                    <span className={`text-base font-bold ${utilization > 90 ? 'text-[#B91C1C]' : 'text-[#10B981]'}`}>
                      {utilization.toFixed(1)}%
                    </span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Open Issues</span>
                    <span className="text-base font-bold text-[#F59E0B]">{overview.open_issue_count}</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Critical Alerts</span>
                    <span className="text-base font-bold text-[#B91C1C]">{criticalAlertsCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* EXECUTIVE ATTENTION MATRIX */}
          <h2 className="text-lg font-bold text-[#B91C1C] mb-3 uppercase tracking-wide border-b border-gray-200 pb-2 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5"/> Management Attention Required ({attentionQueue.length})
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#B91C1C]/5 text-xs uppercase font-bold text-[#061A33] border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-4 w-24">Priority</th>
                    <th className="px-5 py-4 w-48">Project</th>
                    <th className="px-5 py-4 w-36">Area</th>
                    <th className="px-5 py-4">Issue / Action Required</th>
                    <th className="px-5 py-4 w-28">Status</th>
                    <th className="px-5 py-4 w-28">Due</th>
                    <th className="px-5 py-4 w-40">Assigned To</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {attentionQueue.length > 0 ? (
                    attentionQueue.map((item) => (
                      <tr key={item.id} className="hover:bg-red-50/20 transition">
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide inline-block ${
                            item.priority === 'CRITICAL' ? 'bg-[#B91C1C] text-white' : 'bg-[#EF4444]/10 text-[#EF4444]'
                          }`}>
                            {item.priority}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-bold text-[#061A33]">{item.project}</td>
                        <td className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{item.area}</td>
                        <td className="px-5 py-4 text-[#061A33] font-medium">{item.issue}</td>
                        <td className="px-5 py-4">
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700">
                            {item.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-500">{item.due}</td>
                        <td className="px-5 py-4 text-xs font-medium text-gray-700">{item.assignee}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-5 py-8 text-center text-gray-500 text-sm">
                        <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-[#10B981]" />
                        All operations are currently on track. No critical items require immediate executive attention.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
