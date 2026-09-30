import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Legend
} from 'recharts';
import { 
  Search, Calendar, Filter, Bell, AlertTriangle, 
  CheckCircle2, Clock, Info, ShieldAlert, ArrowRight,
  MoreVertical, X, CheckSquare, RefreshCw, Plus
} from 'lucide-react';
import { dashboardApi, managementReviewsApi } from '../../../api/apiservice';

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

export function AlertsDashboardPage() {
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [activeTab, setActiveTab] = useState('alerts'); // 'alerts' or 'reviews'
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [selectedType, setSelectedType] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Live Data
  const [alerts, setAlerts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [masters, setMasters] = useState({
    alert_types: [],
    alert_severities: [],
    alert_statuses: [],
    alert_actions: [],
    review_types: [],
    review_priorities: [],
    review_statuses: []
  });

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const [mastersRes, alertsRes, reviewsRes] = await Promise.allSettled([
        dashboardApi.masters(),
        dashboardApi.alerts(),
        managementReviewsApi.list()
      ]);

      if (mastersRes.status === 'fulfilled' && mastersRes.value?.data?.masters) {
        setMasters(mastersRes.value.data.masters);
      }
      if (alertsRes.status === 'fulfilled' && alertsRes.value?.data?.alerts) {
        setAlerts(alertsRes.value.data.alerts);
      }
      if (reviewsRes.status === 'fulfilled' && reviewsRes.value?.data?.management_reviews) {
        setReviews(reviewsRes.value.data.management_reviews);
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
      setError(err?.message || 'Failed to load alerts data.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getSeverityColor = (code) => {
    const found = masters.alert_severities?.find(s => (s.severity_code || s.code) === code);
    return found?.color || DEFAULT_SEVERITY_COLORS[code] || '#6B7280';
  };

  const getStatusColor = (code) => {
    const found = masters.alert_statuses?.find(s => (s.status_code || s.code) === code);
    return found?.color || DEFAULT_STATUS_COLORS[code] || '#6B7280';
  };

  // Filtered Alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => {
      if (selectedType && a.alert_type_code !== selectedType) return false;
      if (selectedSeverity && a.severity_code !== selectedSeverity) return false;
      if (selectedStatus && a.status_code !== selectedStatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = a.title?.toLowerCase().includes(q);
        const matchesProject = a.project_name?.toLowerCase().includes(q);
        const matchesMessage = a.message?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesProject && !matchesMessage) return false;
      }
      return true;
    });
  }, [alerts, selectedType, selectedSeverity, selectedStatus, searchQuery]);

  // Aggregated Summary Data
  const summaryData = useMemo(() => {
    const total = alerts.length;
    const open = alerts.filter(a => a.status_code === 'OPEN').length;
    const critical = alerts.filter(a => a.severity_code === 'CRITICAL').length;
    const inProgress = alerts.filter(a => a.status_code === 'IN_PROGRESS').length;
    const resolved = alerts.filter(a => a.status_code === 'RESOLVED').length;
    return {
      total_alerts: total,
      open_alerts: open,
      critical_alerts: critical,
      in_progress_alerts: inProgress,
      resolved_alerts: resolved
    };
  }, [alerts]);

  const statusDistribution = useMemo(() => {
    const counts = alerts.reduce((acc, curr) => {
      const code = curr.status_code || 'OPEN';
      acc[code] = (acc[code] || 0) + 1;
      return acc;
    }, {});
    const list = masters.alert_statuses?.length > 0
      ? masters.alert_statuses
      : Object.keys(counts).map(k => ({ status_code: k, status_name: k }));
    return list.map(s => ({
      status_code: s.status_code,
      status_name: s.status_name || s.status_code,
      count: counts[s.status_code] || 0
    })).filter(s => s.count > 0);
  }, [alerts, masters.alert_statuses]);

  const severityDistribution = useMemo(() => {
    const counts = alerts.reduce((acc, curr) => {
      const code = curr.severity_code || 'INFO';
      acc[code] = (acc[code] || 0) + 1;
      return acc;
    }, {});
    const list = masters.alert_severities?.length > 0
      ? masters.alert_severities
      : Object.keys(counts).map(k => ({ severity_code: k, severity_name: k }));
    return list.map(s => ({
      severity_code: s.severity_code,
      severity_name: s.severity_name || s.severity_code,
      count: counts[s.severity_code] || 0
    })).filter(s => s.count > 0);
  }, [alerts, masters.alert_severities]);

  const typeDistribution = useMemo(() => {
    const counts = alerts.reduce((acc, curr) => {
      const name = curr.alert_type_name || curr.alert_type_code || 'Other';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});
    return Object.keys(counts).map(k => ({
      alert_type_name: k,
      count: counts[k]
    }));
  }, [alerts]);

  const resolutionData = useMemo(() => {
    const total = alerts.length;
    const resolved = summaryData.resolved_alerts;
    return {
      total,
      resolved,
      percentage: total > 0 ? Math.round((resolved / total) * 100) : 0
    };
  }, [alerts, summaryData.resolved_alerts]);

  // Reviews Summary
  const reviewsSummary = useMemo(() => {
    const total = reviews.length;
    const open = reviews.filter(r => r.status_code === 'OPEN').length;
    const in_progress = reviews.filter(r => r.status_code === 'IN_PROGRESS').length;
    const completed = reviews.filter(r => r.status_code === 'COMPLETED').length;
    const critical = reviews.filter(r => r.priority_code === 'CRITICAL').length;
    return { total, open, in_progress, completed, critical };
  }, [reviews]);

  // Handle Quick Action
  const handleAlertAction = async (id, actionName) => {
    try {
      await dashboardApi.alertAction(id, actionName, {});
      await fetchData(true);
      if (selectedAlert && selectedAlert.id === id) {
        setSelectedAlert(null);
      }
    } catch (err) {
      alert(err?.message || 'Failed to update alert status');
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-[#061A33] font-['Manrope',sans-serif] p-6 pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#061A33]">Alerts & Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">Live management of operational alerts, risks, pending reviews, and field notifications.</p>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search alerts..." 
              className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0056C9] w-64 bg-white" 
            />
          </div>
          <button 
            onClick={() => fetchData(true)}
            disabled={isLoading || isRefreshing}
            className="p-2 border border-gray-200 bg-white rounded-md hover:bg-gray-50 transition" 
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between text-red-700 text-sm">
          <span>{error}</span>
          <button onClick={() => fetchData()} className="font-semibold underline">Retry</button>
        </div>
      )}

      {/* TABS */}
      <div className="flex border-b border-gray-200 mb-6">
        <button 
          onClick={() => setActiveTab('alerts')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'alerts' ? 'border-[#0056C9] text-[#0056C9]' : 'border-transparent text-gray-500 hover:text-[#061A33]'}`}
        >
          Alerts Dashboard ({alerts.length})
        </button>
        <button 
          onClick={() => setActiveTab('reviews')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'reviews' ? 'border-[#0056C9] text-[#0056C9]' : 'border-transparent text-gray-500 hover:text-[#061A33]'}`}
        >
          Reviews & Follow-ups ({reviews.length})
        </button>
      </div>

      {/* FILTER BAR (Alerts Tab) */}
      {activeTab === 'alerts' && (
        <div className="flex flex-wrap items-center gap-3 mb-6 bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
          <select 
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#0056C9]"
          >
            <option value="">All Alert Types</option>
            {masters.alert_types?.map(t => (
              <option key={t.id || t.alert_type_code} value={t.alert_type_code}>
                {t.alert_type_name}
              </option>
            ))}
          </select>

          <select 
            value={selectedSeverity}
            onChange={e => setSelectedSeverity(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#0056C9]"
          >
            <option value="">All Severities</option>
            {masters.alert_severities?.map(s => (
              <option key={s.id || s.severity_code} value={s.severity_code}>
                {s.severity_name}
              </option>
            ))}
          </select>

          <select 
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#0056C9]"
          >
            <option value="">All Statuses</option>
            {masters.alert_statuses?.map(s => (
              <option key={s.id || s.status_code} value={s.status_code}>
                {s.status_name}
              </option>
            ))}
          </select>

          {(selectedType || selectedSeverity || selectedStatus || searchQuery) && (
            <button 
              onClick={() => { setSelectedType(''); setSelectedSeverity(''); setSelectedStatus(''); setSearchQuery(''); }}
              className="text-xs text-[#0056C9] font-medium hover:underline ml-auto"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* ALERTS TAB CONTENT */}
      {activeTab === 'alerts' && (
        <>
          {/* KPI CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Alerts</span>
              <div className="text-2xl font-bold mt-2 text-[#061A33]">{summaryData.total_alerts}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Open Alerts</span>
              <div className="text-2xl font-bold mt-2 text-[#0056C9]">{summaryData.open_alerts}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs text-[#B91C1C] font-bold uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5"/> Critical Alerts
              </span>
              <div className="text-2xl font-bold mt-2 text-[#B91C1C]">{summaryData.critical_alerts}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">In Progress</span>
              <div className="text-2xl font-bold mt-2 text-[#F59E0B]">{summaryData.in_progress_alerts}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5"/> Resolved
              </span>
              <div className="text-2xl font-bold mt-2 text-[#10B981]">{summaryData.resolved_alerts}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* STATUS DONUT */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm col-span-1">
              <h2 className="text-sm font-bold text-[#061A33] mb-4">Alerts by Status</h2>
              {statusDistribution.length > 0 ? (
                <>
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={75}
                          paddingAngle={2}
                          dataKey="count"
                          nameKey="status_name"
                        >
                          {statusDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getStatusColor(entry.status_code)} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3 mt-2">
                    {statusDistribution.map(s => (
                      <div key={s.status_code} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getStatusColor(s.status_code) }}></div>
                        {s.status_name}: <span className="font-bold">{s.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
                  No status data available
                </div>
              )}
            </div>

            {/* SEVERITY CHART */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm col-span-2">
              <h2 className="text-sm font-bold text-[#061A33] mb-4">Alerts by Severity</h2>
              {severityDistribution.length > 0 ? (
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={severityDistribution} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="severity_name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} width={80} />
                      <Tooltip cursor={{ fill: '#F9FAFB' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                        {severityDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getSeverityColor(entry.severity_code)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[240px] flex items-center justify-center text-gray-400 text-sm">
                  No severity distribution data
                </div>
              )}
            </div>
          </div>

          {/* ALERTS LIST */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-sm font-bold text-[#061A33]">Active Operational Alerts ({filteredAlerts.length})</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {filteredAlerts.length > 0 ? (
                filteredAlerts.map(alert => (
                  <div 
                    key={alert.id} 
                    className="p-5 hover:bg-gray-50/70 transition-colors cursor-pointer group" 
                    onClick={() => setSelectedAlert(alert)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span 
                          className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase" 
                          style={{ backgroundColor: `${getSeverityColor(alert.severity_code)}15`, color: getSeverityColor(alert.severity_code) }}
                        >
                          {alert.severity_name || alert.severity_code}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">{alert.alert_type_name || alert.alert_type_code}</span>
                      </div>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3"/> {alert.alert_date || 'Recent'}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-[#061A33] mb-1 group-hover:text-[#0056C9] transition-colors">
                      {alert.title}
                    </h3>
                    <div className="text-xs text-gray-500 mb-2">
                      <span className="font-semibold text-gray-700">Project:</span> {alert.project_name || 'General'}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{alert.message}</p>
                    
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getStatusColor(alert.status_code) }}></span>
                          <span className="text-gray-600 font-medium">{alert.status_name || alert.status_code}</span>
                        </div>
                        <div className="text-gray-500">
                          Assigned to: <span className="font-medium text-gray-700">{alert.assigned_to || 'Unassigned'}</span>
                        </div>
                        {alert.due_date && (
                          <div className="text-gray-500">
                            Due: <span className="font-medium text-gray-700">{alert.due_date}</span>
                          </div>
                        )}
                      </div>
                      <button className="text-xs text-[#0056C9] font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Manage <ArrowRight className="w-3.5 h-3.5"/>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-400 text-sm">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[#10B981]" />
                  No alerts match your search or filter criteria.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* REVIEWS TAB CONTENT */}
      {activeTab === 'reviews' && (
        <div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs text-gray-500 font-bold uppercase">Total Reviews</span>
              <div className="text-2xl font-bold mt-1 text-[#061A33]">{reviewsSummary.total}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs text-gray-500 font-bold uppercase">Open</span>
              <div className="text-2xl font-bold mt-1 text-[#0056C9]">{reviewsSummary.open}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs text-gray-500 font-bold uppercase">In Progress</span>
              <div className="text-2xl font-bold mt-1 text-[#F59E0B]">{reviewsSummary.in_progress}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs text-gray-500 font-bold uppercase">Completed</span>
              <div className="text-2xl font-bold mt-1 text-[#10B981]">{reviewsSummary.completed}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm border-l-4 border-l-[#B91C1C]">
              <span className="text-xs text-[#B91C1C] font-bold uppercase">Critical Priority</span>
              <div className="text-2xl font-bold mt-1 text-[#B91C1C]">{reviewsSummary.critical}</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200">
              <h2 className="text-sm font-bold text-[#061A33]">Management Review Records ({reviews.length})</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {reviews.length > 0 ? (
                reviews.map(r => (
                  <div key={r.id} className="p-5 hover:bg-gray-50 transition">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          r.priority_code === 'CRITICAL' ? 'bg-[#B91C1C] text-white' : 'bg-blue-50 text-blue-700'
                        }`}>
                          {r.priority_name || r.priority_code}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">{r.review_type_name || r.review_type_code}</span>
                      </div>
                      <span className="text-xs text-gray-400">{r.review_date}</span>
                    </div>
                    <h3 className="text-sm font-bold text-[#061A33] mb-1">{r.subject}</h3>
                    <div className="text-xs text-gray-500 mb-2">Project: <span className="font-semibold text-gray-700">{r.project_name}</span></div>
                    <p className="text-sm text-gray-600 mb-3">{r.observations}</p>
                    {r.action_required && (
                      <div className="p-2.5 bg-amber-50/60 border border-amber-200/60 rounded text-xs text-amber-900 mb-2">
                        <span className="font-bold">Action Required:</span> {r.action_required}
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
                      <div>Assigned To: <span className="font-medium text-gray-700">{r.assigned_to || 'Unassigned'}</span></div>
                      <div className="font-semibold text-[#0056C9] uppercase">{r.status_name || r.status_code}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-400 text-sm">
                  <CheckSquare className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  No management review notes recorded.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ALERT DETAIL DRAWER */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-[#061A33]/20 backdrop-blur-sm" onClick={() => setSelectedAlert(null)}></div>
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-base font-bold text-[#061A33]">Alert Details</h2>
              <button onClick={() => setSelectedAlert(null)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex items-center gap-2 mb-4">
                <span 
                  className="px-2.5 py-1 rounded text-xs font-bold tracking-wide uppercase" 
                  style={{ backgroundColor: `${getSeverityColor(selectedAlert.severity_code)}15`, color: getSeverityColor(selectedAlert.severity_code) }}
                >
                  {selectedAlert.severity_name || selectedAlert.severity_code}
                </span>
                <span className="text-sm font-medium text-gray-600">{selectedAlert.alert_type_name || selectedAlert.alert_type_code}</span>
              </div>
              
              <h3 className="text-lg font-bold text-[#061A33] mb-4">{selectedAlert.title}</h3>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-3 text-sm border border-gray-100">
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-gray-500">Alert No</span>
                  <span className="col-span-2 font-mono text-xs font-medium text-[#061A33]">{selectedAlert.alert_no || selectedAlert.id}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-gray-500">Project</span>
                  <span className="col-span-2 font-medium text-[#061A33]">{selectedAlert.project_name || 'General'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-gray-500">Status</span>
                  <span className="col-span-2 font-medium flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getStatusColor(selectedAlert.status_code) }}></div>
                    {selectedAlert.status_name || selectedAlert.status_code}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-gray-500">Assigned To</span>
                  <span className="col-span-2 font-medium text-[#061A33]">{selectedAlert.assigned_to || 'Unassigned'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-gray-500">Alert Date</span>
                  <span className="col-span-2 font-medium text-[#061A33]">{selectedAlert.alert_date || '—'}</span>
                </div>
                {selectedAlert.due_date && (
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-gray-500">Due Date</span>
                    <span className="col-span-2 font-medium text-[#061A33]">{selectedAlert.due_date}</span>
                  </div>
                )}
              </div>

              <div className="mb-6">
                <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Message & Observations</h4>
                <p className="text-sm text-gray-700 leading-relaxed bg-white p-3 border border-gray-200 rounded-lg">{selectedAlert.message}</p>
              </div>

              {/* Action Buttons based on status */}
              <div className="space-y-2 mt-6">
                <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Take Action</h4>
                {selectedAlert.status_code === 'OPEN' && (
                  <button 
                    onClick={() => handleAlertAction(selectedAlert.id, 'acknowledge')}
                    className="w-full py-2.5 px-4 bg-[#8B5CF6] hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
                  >
                    Acknowledge Alert
                  </button>
                )}
                {(selectedAlert.status_code === 'OPEN' || selectedAlert.status_code === 'ACKNOWLEDGED') && (
                  <button 
                    onClick={() => handleAlertAction(selectedAlert.id, 'start')}
                    className="w-full py-2.5 px-4 bg-[#0056C9] hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
                  >
                    Start Investigation (In Progress)
                  </button>
                )}
                {selectedAlert.status_code !== 'RESOLVED' && selectedAlert.status_code !== 'DISMISSED' && (
                  <button 
                    onClick={() => handleAlertAction(selectedAlert.id, 'resolve')}
                    className="w-full py-2.5 px-4 bg-[#10B981] hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
                  >
                    Mark as Resolved
                  </button>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <button 
                onClick={() => setSelectedAlert(null)}
                className="w-full px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-lg text-sm font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
