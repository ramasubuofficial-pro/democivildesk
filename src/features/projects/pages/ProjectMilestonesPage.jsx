import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Flag, Plus, Edit, Trash2, Search, Eye, CheckCircle2, Clock,
  Layers, IndianRupee, Percent, AlertCircle
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
import { projectsApi, request, mastersApi } from '../../../api/apiservice';

const DEFAULT_STAGES = [
  { id: 1, code: 'PRE_CONSTRUCTION', name: 'Pre Construction' },
  { id: 2, code: 'SUBSTRUCTURE', name: 'Substructure' },
  { id: 3, code: 'SUPERSTRUCTURE', name: 'Superstructure' },
  { id: 4, code: 'FINISHING', name: 'Finishing' },
  { id: 5, code: 'MEP', name: 'MEP' },
  { id: 6, code: 'EXTERNAL', name: 'External' },
  { id: 7, code: 'HANDOVER', name: 'Handover' },
  { id: 8, code: 'OTHER', name: 'Other' },
];

const DEFAULT_STATUSES = [
  { id: 1, code: 'PLANNED', name: 'Planned' },
  { id: 2, code: 'IN_PROGRESS', name: 'In Progress' },
  { id: 3, code: 'COMPLETED', name: 'Completed' },
  { id: 4, code: 'ON_HOLD', name: 'On Hold' },
  { id: 5, code: 'DELAYED', name: 'Delayed' },
];

const EMPTY_FORM = {
  project_id: '',
  work_stage_id: '',
  milestone_code: '',
  milestone_name: '',
  target_date: '',
  actual_completion_date: '',
  weightage_percentage: '0',
  billing_trigger: false,
  billing_percentage: '0',
  progress_percentage: '0',
  status_id: '1',
  remarks: '',
};

export function ProjectMilestonesPage() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeStage, setActiveStage] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Master Data
  const [stages, setStages] = useState(DEFAULT_STAGES);
  const [statuses, setStatuses] = useState(DEFAULT_STATUSES);

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [viewingMilestone, setViewingMilestone] = useState(null);
  const [deleteMilestone, setDeleteMilestone] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Load Projects, Masters and Milestones
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, mileRes, mastersRes] = await Promise.all([
        projectsApi.list().catch(() => ({ data: { projects: [] } })),
        request.get('/project-milestones', { params: { per_page: 1000, all: true } }).catch(() => ({ data: { milestones: [] } })),
        mastersApi.all().catch(() => ({ data: {} })),
      ]);

      const pData = projRes?.data?.projects || projRes?.projects || (Array.isArray(projRes?.data) ? projRes.data : []);
      setProjects(Array.isArray(pData) ? pData : []);

      const mData = mileRes?.data?.milestones ?? mileRes?.data?.project_milestones ?? mileRes?.milestones ?? mileRes?.project_milestones ?? mileRes?.data?.data ?? mileRes?.data ?? [];
      setMilestones(Array.isArray(mData) ? mData : []);

      const rawStages = mastersRes?.data?.work_category_stages || mastersRes?.work_category_stages || [];
      if (Array.isArray(rawStages) && rawStages.length > 0) {
        setStages(rawStages);
      }

      const rawStatuses = mastersRes?.data?.project_milestone_statuses || mastersRes?.project_milestone_statuses || [];
      if (Array.isArray(rawStatuses) && rawStatuses.length > 0) {
        setStatuses(rawStatuses);
      }
    } catch (err) {
      console.error('Failed to fetch milestone data:', err);
      toast.error('Failed to fetch data.');
      setProjects([]);
      setMilestones([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Stage Lookup Map
  const stageMap = useMemo(() => {
    const map = {};
    stages.forEach(s => { map[s.id] = s; });
    return map;
  }, [stages]);

  // Status Lookup Map
  const statusMap = useMemo(() => {
    const map = {};
    statuses.forEach(s => { map[s.id] = s; });
    return map;
  }, [statuses]);

  // Get Clean Status Name
  const getStatusName = useCallback((m) => {
    if (m.status_name) return m.status_name;
    if (m.status_code && statusMap[m.status_id]?.name) return statusMap[m.status_id].name;
    if (typeof m.status === 'string' && m.status.trim()) return m.status;
    const found = statuses.find(s => String(s.id) === String(m.status_id));
    if (found) return found.name;
    return 'Planned';
  }, [statuses, statusMap]);

  // Get Status Badge Variant
  const getStatusVariant = (statusNameOrCode) => {
    const s = String(statusNameOrCode || '').toLowerCase();
    if (s.includes('complete')) return 'success';
    if (s.includes('progress')) return 'info';
    if (s.includes('delay') || s.includes('critical')) return 'error';
    if (s.includes('hold')) return 'warning';
    return 'neutral';
  };

  // Form Handlers
  const handleOpenAdd = () => {
    const nextNum = milestones.length + 1;
    const formattedCode = `MS-${String(nextNum).padStart(2, '0')}`;
    const initialProjId = selectedProjectId !== 'all' ? selectedProjectId : (projects[0]?.id ? String(projects[0].id) : '1');
    const initialStageId = stages[0]?.id ? String(stages[0].id) : '1';

    setForm({
      ...EMPTY_FORM,
      project_id: initialProjId,
      work_stage_id: initialStageId,
      milestone_code: formattedCode,
      target_date: new Date().toISOString().split('T')[0],
      weightage_percentage: '10',
      billing_trigger: false,
      billing_percentage: '0',
      progress_percentage: '0',
      status_id: '1',
      remarks: '',
    });
    setErrors({});
    setIsAddOpen(true);
  };

  const handleOpenEdit = (m) => {
    setForm({
      project_id: String(m.project_id || '1'),
      work_stage_id: String(m.work_stage_id || stages[0]?.id || '1'),
      milestone_code: m.milestone_code || '',
      milestone_name: m.milestone_name || '',
      weightage_percentage: String(m.weightage_percentage ?? m.weightage_percent ?? '0'),
      target_date: m.target_date ? m.target_date.split(' ')[0] : '',
      actual_completion_date: m.actual_completion_date ? m.actual_completion_date.split(' ')[0] : (m.actual_date ? m.actual_date.split(' ')[0] : ''),
      billing_trigger: Boolean(m.billing_trigger && m.billing_trigger !== '0'),
      billing_percentage: String(m.billing_percentage ?? '0'),
      progress_percentage: String(m.progress_percentage ?? '0'),
      status_id: String(m.status_id || '1'),
      remarks: m.remarks || m.deliverables || '',
    });
    setErrors({});
    setEditingMilestone(m);
  };

  const handleFormChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.project_id) errs.project_id = 'Project is required';
    if (!form.work_stage_id) errs.work_stage_id = 'Execution stage is required';
    if (!form.milestone_code?.trim()) errs.milestone_code = 'Milestone code is required';
    if (!form.milestone_name?.trim()) errs.milestone_name = 'Milestone name is required';
    if (!form.target_date) errs.target_date = 'Target date is required';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    try {
      const selectedProj = projects.find(p => String(p.id) === String(form.project_id));
      const stageObj = stages.find(s => String(s.id) === String(form.work_stage_id));
      const statusObj = statuses.find(s => String(s.id) === String(form.status_id));

      const payload = {
        project_id: Number(form.project_id),
        work_stage_id: Number(form.work_stage_id),
        milestone_code: form.milestone_code.trim(),
        milestone_name: form.milestone_name.trim(),
        target_date: form.target_date,
        actual_completion_date: form.actual_completion_date ? form.actual_completion_date : null,
        weightage_percentage: Number(form.weightage_percentage || 0),
        billing_trigger: form.billing_trigger ? 1 : 0,
        billing_percentage: form.billing_trigger ? Number(form.billing_percentage || 0) : 0,
        progress_percentage: Number(form.progress_percentage || 0),
        status_id: Number(form.status_id || 1),
        remarks: form.remarks || '',
      };

      if (editingMilestone?.id) {
        const res = await request.patch(`/project-milestones/${encodeURIComponent(editingMilestone.id)}`, payload);
        const updated = res?.data?.milestone ?? res?.data?.data ?? res?.data ?? res;
        const merged = {
          ...editingMilestone,
          ...payload,
          ...(typeof updated === 'object' ? updated : {}),
          project_name: selectedProj?.project_name || selectedProj?.name || editingMilestone.project_name,
          project_code: selectedProj?.project_code || editingMilestone.project_code,
          work_stage_name: stageObj?.name || editingMilestone.work_stage_name,
          status_name: statusObj?.name || editingMilestone.status_name,
        };
        setMilestones(prev => prev.map(m => String(m.id) === String(editingMilestone.id) ? merged : m));
        toast.success('Milestone updated successfully.');
      } else {
        const res = await request.post('/project-milestones', payload);
        const created = res?.data?.milestone ?? res?.data?.data ?? res?.data ?? res;
        const completeItem = {
          ...payload,
          ...(typeof created === 'object' ? created : {}),
          id: created?.id || Date.now(),
          project_name: selectedProj?.project_name || selectedProj?.name || 'Project',
          project_code: selectedProj?.project_code || 'PRJ',
          work_stage_name: stageObj?.name || 'General Stage',
          status_name: statusObj?.name || 'Planned',
        };
        setMilestones(prev => [completeItem, ...prev]);
        toast.success('Milestone created successfully.');
      }

      setIsAddOpen(false);
      setEditingMilestone(null);
    } catch (err) {
      console.error('Milestone save error:', err);
      let errMsg = err.message || 'Failed to save milestone.';
      const validationErrors = err.errors || err.response?.data?.errors;
      if (validationErrors && typeof validationErrors === 'object') {
        const firstError = Array.isArray(Object.values(validationErrors)[0])
          ? Object.values(validationErrors)[0][0]
          : Object.values(validationErrors)[0];
        errMsg = `${errMsg}: ${firstError}`;
      }
      toast.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteMilestone?.id) return;
    try {
      await request.delete(`/project-milestones/${encodeURIComponent(deleteMilestone.id)}`);
      setMilestones(prev => prev.filter(m => String(m.id) !== String(deleteMilestone.id)));
      toast.success('Milestone deleted successfully.');
    } catch (err) {
      toast.error(err.message || 'Failed to delete milestone.');
    } finally {
      setDeleteMilestone(null);
    }
  };

  // Filtered List
  const filtered = useMemo(() => {
    return milestones.filter(m => {
      // Project filter
      if (selectedProjectId !== 'all' && String(m.project_id) !== String(selectedProjectId)) {
        return false;
      }
      // Stage filter
      if (activeStage !== 'all' && String(m.work_stage_id) !== String(activeStage)) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'all') {
        const statusName = getStatusName(m).toLowerCase();
        if (String(m.status_id) !== String(statusFilter) && statusName !== statusFilter.toLowerCase()) {
          return false;
        }
      }
      // Search
      if (search) {
        const q = search.toLowerCase();
        const code = (m.milestone_code || '').toLowerCase();
        const name = (m.milestone_name || '').toLowerCase();
        const pCode = (m.project_code || '').toLowerCase();
        const pName = (m.project_name || '').toLowerCase();
        const stageName = (m.work_stage_name || '').toLowerCase();
        const rem = (m.remarks || m.deliverables || '').toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !pCode.includes(q) && !pName.includes(q) && !stageName.includes(q) && !rem.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [milestones, selectedProjectId, activeStage, statusFilter, search, getStatusName]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  // Metrics
  const completedCount = useMemo(() => {
    return milestones.filter(m => {
      const s = getStatusName(m).toLowerCase();
      return s.includes('complete') || Number(m.progress_percentage) >= 100;
    }).length;
  }, [milestones, getStatusName]);

  const inProgressCount = useMemo(() => {
    return milestones.filter(m => {
      const s = getStatusName(m).toLowerCase();
      const prog = Number(m.progress_percentage || 0);
      return (prog > 0 && prog < 100) || s.includes('progress');
    }).length;
  }, [milestones, getStatusName]);

  const totalBillingPct = useMemo(() => {
    return milestones.reduce((acc, m) => acc + (Number(m.billing_percentage) || 0), 0);
  }, [milestones]);

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Projects', href: '/projects' },
    { label: 'Project Milestones' }
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Project Milestones & Deliverables"
        breadcrumbs={breadcrumbs}
      />

      <div className="flex flex-col gap-3 sm:gap-4 w-full">
        {/* KPI Summary Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <KpiCard
            label="Total Milestones"
            value={milestones.length}
            status="primary"
            icon={<Flag className="w-4 h-4 text-primary" />}
          />
          <KpiCard
            label="Completed Deliverables"
            value={`${completedCount} / ${milestones.length}`}
            status="success"
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          />
          <KpiCard
            label="Active In-Progress"
            value={inProgressCount}
            status="info"
            icon={<Clock className="w-4 h-4 text-sky-500" />}
          />
          <KpiCard
            label="Total Billing Weightage"
            value={`${totalBillingPct.toFixed(0)}%`}
            status="neutral"
            icon={<Percent className="w-4 h-4 text-amber-500" />}
          />
        </div>

        {/* Filter and Project Selector Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-surface border border-border rounded-lg p-2.5 sm:p-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="w-full sm:w-56">
              <Select
                options={[
                  { value: 'all', label: 'All Projects (Consolidated)' },
                  ...projects.map(p => ({ value: String(p.id), label: p.project_name || p.name }))
                ]}
                value={selectedProjectId}
                onChange={setSelectedProjectId}
                className="text-xs h-8"
              />
            </div>

            <div className="w-full sm:w-52">
              <SearchField
                placeholder="Search milestone, code, scope..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="w-full sm:w-40">
              <Select
                options={[
                  { value: 'all', label: 'All Statuses' },
                  ...statuses.map(st => ({ value: String(st.id), label: st.name }))
                ]}
                value={statusFilter}
                onChange={setStatusFilter}
                className="text-xs h-8"
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
              Add Milestone
            </Button>
          </div>
        </div>

        {/* Work Stage Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
          <button
            onClick={() => setActiveStage('all')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all text-[11px] sm:text-xs ${
              activeStage === 'all'
                ? 'bg-primary text-white shadow-xs font-semibold'
                : 'bg-surface text-text-secondary border border-border hover:bg-surface-muted'
            }`}
          >
            All Stages
          </button>
          {stages.map(stage => (
            <button
              key={stage.id}
              onClick={() => setActiveStage(String(stage.id))}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all text-[11px] sm:text-xs ${
                activeStage === String(stage.id)
                  ? 'bg-primary text-white shadow-xs font-semibold'
                  : 'bg-surface text-text-secondary border border-border hover:bg-surface-muted'
              }`}
            >
              {stage.name}
            </button>
          ))}
        </div>

        {/* Desktop & Tablet Table */}
        <div className="hidden sm:block">
          <DataTableContainer
            pagination={
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalResults={filtered.length}
                itemsPerPage={perPage}
                onPageChange={setPage}
                onItemsPerPageChange={() => {}}
              />
            }
          >
            <table className="w-full text-left text-[12px] table-auto">
              <thead className="bg-surface-muted text-text-secondary text-[11px] uppercase font-semibold border-b border-border tracking-wider">
                <tr>
                  <th className="px-3 py-2.5 w-10 text-center">#</th>
                  <th className="px-3 py-2.5">Milestone & Stage</th>
                  <th className="px-3 py-2.5 hidden md:table-cell">Project</th>
                  <th className="px-3 py-2.5 text-center w-24">Weight %</th>
                  <th className="px-3 py-2.5 hidden lg:table-cell">Target Date</th>
                  <th className="px-3 py-2.5 text-center w-28">Billing Trigger</th>
                  <th className="px-3 py-2.5 w-32">Progress</th>
                  <th className="px-3 py-2.5 text-center w-28">Status</th>
                  <th className="px-3 py-2.5 text-center w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="text-center py-10 text-text-muted text-[12px]">
                      Loading project milestones...
                    </td>
                  </tr>
                ) : paged.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-10 text-text-muted text-[12px]">
                      No milestones found for this selection.
                    </td>
                  </tr>
                ) : (
                  paged.map((m, idx) => {
                    const statusText = getStatusName(m);
                    const weightVal = Number(m.weightage_percentage ?? m.weightage_percent ?? 0);
                    const progVal = Number(m.progress_percentage ?? 0);
                    const billingPct = Number(m.billing_percentage ?? 0);
                    const stageName = m.work_stage_name || stageMap[m.work_stage_id]?.name || m.stage_name || m.phase_name || 'General Stage';

                    return (
                      <tr key={m.id || idx} className="hover:bg-surface-muted/40 transition-colors group">
                        <td className="px-3 py-2.5 text-center font-medium text-text-primary text-[11px]">
                          {(page - 1) * perPage + idx + 1}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                                {m.milestone_code || `MS-${idx + 1}`}
                              </span>
                              <span className="font-semibold text-text-primary text-[12px] truncate" title={m.milestone_name}>
                                {m.milestone_name}
                              </span>
                            </div>
                            <span className="text-[10px] text-text-muted mt-0.5 flex items-center gap-1">
                              <Layers className="w-3 h-3 text-text-muted/70" />
                              {stageName}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 hidden md:table-cell">
                          <span className="text-text-primary text-[11px] font-medium truncate block max-w-[160px]" title={m.project_name}>
                            {m.project_name || `Project #${m.project_id}`}
                          </span>
                          {m.project_code && (
                            <span className="font-mono text-[10px] text-text-muted block">
                              {m.project_code}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono font-semibold text-text-secondary text-[11px]">
                          {weightVal.toFixed(0)}%
                        </td>
                        <td className="px-3 py-2.5 hidden lg:table-cell font-mono text-[11px] text-text-secondary">
                          <div className="flex flex-col">
                            <span>{m.target_date ? m.target_date.split(' ')[0] : '—'}</span>
                            {(m.actual_completion_date || m.actual_date) && (
                              <span className="text-[10px] text-emerald-600 font-medium">
                                Done: {(m.actual_completion_date || m.actual_date).split(' ')[0]}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {billingPct > 0 || m.billing_trigger ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                              {billingPct > 0 ? `${billingPct}% Billable` : 'Active Trigger'}
                            </span>
                          ) : (
                            <span className="text-text-muted text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-surface-muted border border-border/60 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  progVal >= 100
                                    ? 'bg-emerald-500'
                                    : progVal > 0
                                    ? 'bg-primary'
                                    : 'bg-transparent'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, progVal))}%` }}
                              />
                            </div>
                            <span className="font-mono text-[10px] font-bold text-text-secondary w-8 text-right shrink-0">
                              {progVal.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <Badge
                            variant={getStatusVariant(statusText)}
                            className="text-[9px] font-bold uppercase tracking-wider h-5 px-2 inline-flex items-center leading-none"
                          >
                            {statusText}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              title="View Deliverables & Scope"
                              onClick={() => setViewingMilestone(m)}
                            >
                              <Eye className="w-3.5 h-3.5 text-text-secondary hover:text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              title="Edit Milestone"
                              onClick={() => handleOpenEdit(m)}
                            >
                              <Edit className="w-3.5 h-3.5 text-text-secondary hover:text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              title="Delete Milestone"
                              onClick={() => setDeleteMilestone(m)}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-text-secondary hover:text-error" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </DataTableContainer>
        </div>

        {/* Mobile View - Cards List (< sm) */}
        <div className="block sm:hidden space-y-3">
          {loading ? (
            <div className="text-center py-8 text-text-muted text-xs bg-surface border border-border rounded-lg">
              Loading project milestones...
            </div>
          ) : paged.length === 0 ? (
            <div className="text-center py-8 text-text-muted text-xs bg-surface border border-border rounded-lg">
              No milestones found.
            </div>
          ) : (
            paged.map((m, idx) => {
              const statusText = getStatusName(m);
              const weightVal = Number(m.weightage_percentage ?? m.weightage_percent ?? 0);
              const progVal = Number(m.progress_percentage ?? 0);
              const billingPct = Number(m.billing_percentage ?? 0);
              const stageName = m.work_stage_name || stageMap[m.work_stage_id]?.name || m.stage_name || m.phase_name || 'General Stage';

              return (
                <div key={m.id || idx} className="bg-surface border border-border rounded-lg p-3.5 shadow-xs space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          {m.milestone_code || `MS-${idx + 1}`}
                        </span>
                        <span className="text-[10px] text-text-muted">{stageName}</span>
                      </div>
                      <h4 className="font-semibold text-text-primary text-[13px] leading-snug">{m.milestone_name}</h4>
                      <p className="text-[11px] text-text-secondary mt-0.5">{m.project_name || `Project #${m.project_id}`}</p>
                    </div>
                    <Badge
                      variant={getStatusVariant(statusText)}
                      className="text-[9px] font-bold uppercase tracking-wider h-5 px-2 inline-flex items-center leading-none shrink-0"
                    >
                      {statusText}
                    </Badge>
                  </div>

                  <div className="space-y-1 pt-1 border-t border-border/60">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-text-muted text-[11px]">Progress:</span>
                      <span className="font-mono font-bold text-text-primary">{progVal.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-surface-muted border border-border/60 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          progVal >= 100 ? 'bg-emerald-500' : progVal > 0 ? 'bg-primary' : 'bg-transparent'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, progVal))}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-border/60">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-text-muted block">Weight</span>
                      <span className="font-mono font-semibold text-text-secondary text-[11px]">{weightVal.toFixed(0)}%</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-text-muted block">Target</span>
                      <span className="font-mono text-text-secondary text-[11px]">{m.target_date ? m.target_date.split(' ')[0] : '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-text-muted block">Billing</span>
                      <span className="font-mono font-bold text-amber-600 text-[11px]">
                        {billingPct > 0 ? `${billingPct}%` : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-border/60 text-xs">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] px-2.5"
                      onClick={() => setViewingMilestone(m)}
                    >
                      <Eye className="w-3 h-3 mr-1" /> View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleOpenEdit(m)}
                    >
                      <Edit className="w-3.5 h-3.5 text-text-secondary" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setDeleteMilestone(m)}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-text-secondary hover:text-error" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}

          {/* Mobile Pagination */}
          <div className="pt-2">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalResults={filtered.length}
              itemsPerPage={perPage}
              onPageChange={setPage}
              onItemsPerPageChange={() => {}}
            />
          </div>
        </div>
      </div>

      {/* View Deliverable Scope Modal */}
      {viewingMilestone && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface border border-border rounded-xl shadow-level-3 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-muted/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Flag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">{viewingMilestone.milestone_name}</h3>
                  <span className="text-[11px] font-mono text-text-muted">
                    {viewingMilestone.milestone_code} • {viewingMilestone.work_stage_name || stageMap[viewingMilestone.work_stage_id]?.name || 'Stage'}
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setViewingMilestone(null)}>✕</Button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3 bg-surface-muted/30 p-3 rounded-lg border border-border">
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Project</span>
                  <span className="font-semibold text-text-primary">{viewingMilestone.project_name || `Project #${viewingMilestone.project_id}`}</span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Status</span>
                  <Badge variant={getStatusVariant(getStatusName(viewingMilestone))} className="mt-0.5 text-[9px] uppercase">
                    {getStatusName(viewingMilestone)}
                  </Badge>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Weightage</span>
                  <span className="font-mono font-bold text-text-primary">{Number(viewingMilestone.weightage_percentage ?? viewingMilestone.weightage_percent ?? 0).toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Progress</span>
                  <span className="font-mono font-bold text-primary">{Number(viewingMilestone.progress_percentage || 0).toFixed(0)}%</span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Target Date</span>
                  <span className="font-mono text-text-primary">{viewingMilestone.target_date ? viewingMilestone.target_date.split(' ')[0] : '—'}</span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Actual Completion Date</span>
                  <span className="font-mono text-emerald-600 font-medium">
                    {viewingMilestone.actual_completion_date ? viewingMilestone.actual_completion_date.split(' ')[0] : (viewingMilestone.actual_date ? viewingMilestone.actual_date.split(' ')[0] : 'Pending')}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Billing Milestone</span>
                  <span className="font-mono font-bold text-amber-600">
                    {Number(viewingMilestone.billing_percentage) > 0 ? `${viewingMilestone.billing_percentage}% of Project Value` : (viewingMilestone.billing_trigger ? 'Yes (Trigger Enabled)' : 'No billing trigger attached')}
                  </span>
                </div>
              </div>

              {(viewingMilestone.remarks || viewingMilestone.deliverables) && (
                <div className="border border-border rounded-lg p-3 space-y-1">
                  <span className="font-bold text-text-primary block text-[11px]">Deliverables & Scope Description:</span>
                  <p className="text-text-secondary whitespace-pre-wrap">{viewingMilestone.remarks || viewingMilestone.deliverables}</p>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-border bg-surface-muted/20 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setViewingMilestone(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Milestone Modal */}
      <EntityEditModal
        isOpen={Boolean(isAddOpen || editingMilestone)}
        onClose={() => { setIsAddOpen(false); setEditingMilestone(null); }}
      >
        <EntityEditModal.Header
          icon={Flag}
          title={editingMilestone ? 'Edit Project Milestone' : 'Add Project Milestone'}
          subtitle="Define execution stages, weightage, and milestone billing triggers."
          onClose={() => { setIsAddOpen(false); setEditingMilestone(null); }}
        />
        <form id="milestone-form" onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <EntityEditModal.Body>
            <EntityEditModal.Section title="Milestone Identification">
              <EntityEditModal.Grid>
                <FormField label="Target Project" required error={errors.project_id}>
                  <Select
                    options={projects.map(p => ({ value: String(p.id), label: p.project_name || p.name }))}
                    value={form.project_id}
                    onChange={(v) => handleFormChange('project_id', v)}
                  />
                </FormField>

                <FormField label="Execution Stage" required error={errors.work_stage_id}>
                  <Select
                    options={stages.map(s => ({ value: String(s.id), label: s.name }))}
                    value={form.work_stage_id}
                    onChange={(v) => handleFormChange('work_stage_id', v)}
                  />
                </FormField>

                <FormField label="Milestone Code" required error={errors.milestone_code}>
                  <Input
                    value={form.milestone_code}
                    onChange={(e) => handleFormChange('milestone_code', e.target.value)}
                    placeholder="e.g. MS-01"
                  />
                </FormField>

                <FormField label="Milestone Name" required error={errors.milestone_name} className="md:col-span-1">
                  <Input
                    value={form.milestone_name}
                    onChange={(e) => handleFormChange('milestone_name', e.target.value)}
                    placeholder="e.g. Raft Foundation Casting"
                  />
                </FormField>
              </EntityEditModal.Grid>
            </EntityEditModal.Section>

            <EntityEditModal.Section title="Schedule, Progress & Weightage">
              <EntityEditModal.Grid>
                <FormField label="Target Completion Date" required error={errors.target_date}>
                  <Input
                    type="date"
                    value={form.target_date}
                    onChange={(e) => handleFormChange('target_date', e.target.value)}
                  />
                </FormField>

                <FormField label="Actual Completion Date">
                  <Input
                    type="date"
                    value={form.actual_completion_date}
                    onChange={(e) => handleFormChange('actual_completion_date', e.target.value)}
                  />
                </FormField>

                <FormField label="Project Weightage (%)">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="e.g. 15"
                    value={form.weightage_percentage}
                    onChange={(e) => handleFormChange('weightage_percentage', e.target.value)}
                  />
                </FormField>

                <FormField label="Progress Percentage (%)">
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={form.progress_percentage}
                    onChange={(e) => handleFormChange('progress_percentage', e.target.value)}
                  />
                </FormField>

                <FormField label="Milestone Status">
                  <Select
                    options={statuses.map(st => ({ value: String(st.id), label: st.name }))}
                    value={form.status_id}
                    onChange={(v) => handleFormChange('status_id', v)}
                  />
                </FormField>

                <div className="flex flex-col justify-center space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer pt-2">
                    <input
                      type="checkbox"
                      checked={form.billing_trigger}
                      onChange={(e) => handleFormChange('billing_trigger', e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                    />
                    <span className="text-xs font-semibold text-text-primary">Enable Billing Trigger</span>
                  </label>
                  {form.billing_trigger && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        placeholder="Billing %"
                        value={form.billing_percentage}
                        onChange={(e) => handleFormChange('billing_percentage', e.target.value)}
                        className="h-8 text-xs w-28"
                      />
                      <span className="text-xs text-text-muted font-medium">% of Contract</span>
                    </div>
                  )}
                </div>

                <FormField label="Deliverables & Quality Acceptance Criteria" className="md:col-span-2">
                  <Textarea
                    rows={2}
                    value={form.remarks}
                    onChange={(e) => handleFormChange('remarks', e.target.value)}
                    placeholder="e.g. Concrete 28-day cube strength report approval and joint client site sign-off."
                  />
                </FormField>
              </EntityEditModal.Grid>
            </EntityEditModal.Section>
          </EntityEditModal.Body>

          <EntityEditModal.Footer
            formId="milestone-form"
            submitLabel={editingMilestone ? 'Update Milestone' : 'Create Milestone'}
            onCancel={() => { setIsAddOpen(false); setEditingMilestone(null); }}
            isSubmitting={saving}
          />
        </form>
      </EntityEditModal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteMilestone)}
        title="Delete Milestone"
        message={`Are you sure you want to delete "${deleteMilestone?.milestone_name}"?`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteMilestone(null)}
      />
    </PageContainer>
  );
}
