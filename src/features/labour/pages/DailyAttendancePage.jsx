import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar, CheckCircle2, XCircle, Clock, Users, IndianRupee,
  Search, Filter, Eye, Edit, Trash2, Plus, ArrowLeft, ArrowRight,
  Sun, Moon, ShieldCheck, Check, AlertCircle, Sparkles, Send, RefreshCw, Lock,
  CheckCheck, UserCheck, UserX
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
import { attendanceApi, labourApi, projectsApi, sitesApi } from '../../../api/apiservice';
import { useAuth } from '../../auth/context/AuthContext';

export function DailyAttendancePage() {
  const { hasPermission } = useAuth();
  
  // Date & Scope Selection
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [projects, setProjects] = useState([]);
  const [sites, setSites] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedShift, setSelectedShift] = useState('GENERAL');

  // Masters
  const [masters, setMasters] = useState(null);

  // Active Batch & Records
  const [activeBatch, setActiveBatch] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 15;

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [deletingRecord, setDeletingRecord] = useState(null);
  const [batchActionType, setBatchActionType] = useState(null); // 'submit', 'approve', 'reject', 'lock'
  const [actionRemarks, setActionRemarks] = useState('');

  // Manual entry form state
  const [manualForm, setManualForm] = useState({
    assignment_id: '',
    worker_id: '',
    attendance_status_id: '',
    check_in_time: '09:00:00',
    check_out_time: '17:00:00',
    regular_hours: '8',
    overtime_hours: '0',
    work_description: '',
    remarks: '',
  });
  const [availableWorkers, setAvailableWorkers] = useState([]);

  // Robust Master Helpers with Safe Fallbacks
  const getAttendanceStatuses = useCallback(() => {
    return masters?.['attendance-statuses'] || [
      { id: 1, attendance_status_code: 'PRESENT', attendance_status_name: 'Present' },
      { id: 2, attendance_status_code: 'ABSENT', attendance_status_name: 'Absent' },
      { id: 3, attendance_status_code: 'HALF_DAY', attendance_status_name: 'Half Day' },
      { id: 4, attendance_status_code: 'LEAVE', attendance_status_name: 'Leave' },
      { id: 5, attendance_status_code: 'ON_DUTY', attendance_status_name: 'On Duty' },
    ];
  }, [masters]);

  const getAttendanceSources = useCallback(() => {
    return masters?.['attendance-sources'] || [
      { id: 1, attendance_source_code: 'MANUAL', attendance_source_name: 'Manual' },
    ];
  }, [masters]);

  // Recalculate and update batch KPIs in memory
  const updateBatchKpis = (updatedRecords, batch = activeBatch) => {
    if (!batch) return;
    const totalWorkers = updatedRecords.length;
    const presentWorkers = updatedRecords.filter(r => r.attendance_status_code === 'PRESENT' || r.attendance_status_code === 'HALF_DAY').length;
    const absentWorkers = updatedRecords.filter(r => r.attendance_status_code === 'ABSENT' || r.attendance_status_code === 'LEAVE').length;
    const totalRegularHours = updatedRecords.reduce((sum, r) => sum + (Number(r.regular_hours) || 0), 0);
    const totalOtHours = updatedRecords.reduce((sum, r) => sum + (Number(r.overtime_hours) || 0), 0);

    setActiveBatch(prev => prev ? {
      ...prev,
      total_workers: totalWorkers,
      present_workers: presentWorkers,
      absent_workers: absentWorkers,
      total_regular_hours: totalRegularHours,
      total_overtime_hours: totalOtHours,
      entries: updatedRecords,
    } : null);
  };

  // Fetch initial master data & projects
  useEffect(() => {
    async function init() {
      setLoadingConfig(true);
      try {
        const [resMasters, resProjects] = await Promise.all([
          labourApi.masters(),
          projectsApi.list(),
        ]);

        const masterData = resMasters?.data?.masters ?? resMasters?.masters ?? null;
        setMasters(masterData);

        const projectList = resProjects?.data?.projects ?? resProjects?.projects ?? (Array.isArray(resProjects?.data) ? resProjects.data : Array.isArray(resProjects) ? resProjects : []);
        setProjects(Array.isArray(projectList) ? projectList : []);
        if (projectList.length > 0) {
          setSelectedProjectId(String(projectList[0].id));
        }
      } catch (err) {
        toast.error('Failed to load initial configuration.');
      } finally {
        setLoadingConfig(false);
      }
    }
    init();
  }, []);

  // Fetch sites when project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setSites([]);
      setSelectedSiteId('');
      return;
    }

    sitesApi.list()
      .then((res) => {
        const allSites = res?.data?.sites ?? res?.sites ?? (Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);
        const filteredSites = allSites.filter(s => String(s.project_id) === String(selectedProjectId));
        
        setSites(filteredSites);
        if (filteredSites.length > 0) {
          setSelectedSiteId(String(filteredSites[0].id));
        } else {
          setSelectedSiteId('');
        }
      })
      .catch((err) => {
        console.error("Failed to fetch sites:", err);
        setSites([]);
        setSelectedSiteId('');
      });
  }, [selectedProjectId]);

  // Fetch batch details
  const fetchBatch = useCallback(async (projId, siteId, date, shift) => {
    if (!projId || !siteId || !date) {
      setActiveBatch(null);
      setRecords([]);
      return;
    }
    setLoading(true);
    try {
      const resList = await attendanceApi.list({
        project_id: Number(projId),
        site_id: Number(siteId),
        date_from: date,
        date_to: date,
      });

      const batches = resList?.data?.attendance_batches ?? resList?.attendance_batches ?? (Array.isArray(resList?.data) ? resList.data : Array.isArray(resList) ? resList : []);
      const shiftBatch = batches.find(b => b.shift_code === shift);

      if (shiftBatch) {
        const resDetail = await attendanceApi.get(shiftBatch.id);
        const batchDetail = resDetail?.data?.attendance_batch ?? resDetail?.attendance_batch ?? resDetail?.data ?? shiftBatch;
        setActiveBatch(batchDetail);
        setRecords(Array.isArray(batchDetail?.entries) ? batchDetail.entries : []);
      } else {
        setActiveBatch(null);
        setRecords([]);
      }
    } catch (err) {
      if (err?.response?.status !== 404 && err?.status !== 404) {
        console.warn('Failed to load daily attendance muster:', err);
      }
      setActiveBatch(null);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload when scope selections change
  useEffect(() => {
    fetchBatch(selectedProjectId, selectedSiteId, selectedDate, selectedShift);
  }, [selectedProjectId, selectedSiteId, selectedDate, selectedShift, fetchBatch]);

  // Load available workers for manual add dialog
  const loadAvailableWorkers = async () => {
    if (!selectedProjectId || !selectedSiteId) return;
    try {
      const [resAssignments, resWorkers] = await Promise.all([
        labourApi.assignments.list({ project_id: Number(selectedProjectId), site_id: Number(selectedSiteId) }).catch(() => ({ data: [] })),
        labourApi.workers.list().catch(() => ({ data: [] })),
      ]);

      const assignmentList = resAssignments?.data?.labour_assignments ?? resAssignments?.labour_assignments ?? (Array.isArray(resAssignments?.data) ? resAssignments.data : Array.isArray(resAssignments) ? resAssignments : []);
      const workerList = resWorkers?.data?.labour_workers ?? resWorkers?.labour_workers ?? (Array.isArray(resWorkers?.data) ? resWorkers.data : Array.isArray(resWorkers) ? resWorkers : []);

      const existingWorkerIds = new Set(records.map(r => String(r.worker_id)));

      // Combine existing assignments with registered workers
      const available = [];
      const seenIds = new Set();

      for (const a of assignmentList) {
        if (!existingWorkerIds.has(String(a.worker_id)) && !seenIds.has(String(a.worker_id))) {
          seenIds.add(String(a.worker_id));
          available.push({
            id: a.id,
            assignment_id: a.id,
            worker_id: a.worker_id,
            worker_name: a.worker_name,
            worker_code: a.worker_code,
            contractor_name: a.contractor_name,
          });
        }
      }

      for (const w of workerList) {
        if (!existingWorkerIds.has(String(w.id)) && !seenIds.has(String(w.id))) {
          seenIds.add(String(w.id));
          available.push({
            id: null,
            assignment_id: null,
            worker_id: w.id,
            worker_name: w.worker_name,
            worker_code: w.worker_code,
            contractor_name: w.contractor_name,
            base_wage_rate: w.base_wage_rate,
            labour_category_id: w.labour_category_id || w.category_id,
          });
        }
      }

      setAvailableWorkers(available);

      const statuses = getAttendanceStatuses();
      const defaultStatus = statuses.find(s => s.attendance_status_code === 'PRESENT') || statuses[0];

      setManualForm({
        assignment_id: available[0]?.assignment_id ? String(available[0].assignment_id) : '',
        worker_id: available[0]?.worker_id ? String(available[0].worker_id) : '',
        attendance_status_id: defaultStatus?.id ? String(defaultStatus.id) : '1',
        check_in_time: '09:00:00',
        check_out_time: '17:00:00',
        regular_hours: '8',
        overtime_hours: '0',
        work_description: '',
        remarks: '',
      });
    } catch (err) {
      toast.error('Failed to retrieve available workers.');
    }
  };

  // Quick Day Navigation
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  // Initialize Batch & Populate active workers for site
  const handleInitializeBatch = async () => {
    if (!selectedProjectId || !selectedSiteId || !selectedDate) {
      toast.error('Please select a project and site location first.');
      return;
    }
    setLoading(true);
    try {
      const statuses = getAttendanceStatuses();
      const sources = getAttendanceSources();
      const presentStatus = statuses.find(s => s.attendance_status_code === 'PRESENT') || statuses[0] || { id: 1, attendance_status_code: 'PRESENT', attendance_status_name: 'Present' };
      const manualSource = sources.find(s => s.attendance_source_code === 'MANUAL') || sources[0] || { id: 1, attendance_source_code: 'MANUAL', attendance_source_name: 'Manual' };

      // 1. Create or retrieve the batch
      let currentBatch = null;
      try {
        const resCreate = await attendanceApi.create({
          project_id: Number(selectedProjectId),
          site_id: Number(selectedSiteId),
          attendance_date: selectedDate,
          shift_code: selectedShift || 'GENERAL',
          remarks: 'Daily Site Roster Initialized',
        });
        currentBatch = resCreate?.data?.attendance_batch ?? resCreate?.attendance_batch ?? resCreate?.data;
      } catch (createErr) {
        // If batch already exists in backend, fetch existing
        try {
          const resList = await attendanceApi.list({
            project_id: Number(selectedProjectId),
            site_id: Number(selectedSiteId),
            date_from: selectedDate,
            date_to: selectedDate,
          });
          const batches = resList?.data?.attendance_batches ?? resList?.attendance_batches ?? (Array.isArray(resList?.data) ? resList.data : Array.isArray(resList) ? resList : []);
          currentBatch = batches.find(b => b.shift_code === (selectedShift || 'GENERAL'));
        } catch (e) {
          console.warn('Batch lookup warning:', e);
        }

        if (!currentBatch) {
          currentBatch = {
            id: Date.now(),
            project_id: Number(selectedProjectId),
            site_id: Number(selectedSiteId),
            attendance_date: selectedDate,
            shift_code: selectedShift || 'GENERAL',
            status_code: 'DRAFT',
            status_name: 'Draft',
          };
        }
      }

      // If existing batch already has entries, fetch details
      if (currentBatch?.id && typeof currentBatch.id === 'number' && currentBatch.id < 1000000000000) {
        try {
          const resDetail = await attendanceApi.get(currentBatch.id);
          const detail = resDetail?.data?.attendance_batch ?? resDetail?.attendance_batch;
          if (detail && Array.isArray(detail.entries) && detail.entries.length > 0) {
            setActiveBatch(detail);
            setRecords(detail.entries);
            toast.success('Attendance muster loaded with existing entries.');
            return;
          }
        } catch (e) {
          console.warn('Batch detail fetch warning:', e);
        }
      }

      // 2. Fetch active assignments / deployments for this site
      let assignments = [];
      try {
        const resAssignments = await labourApi.assignments.list({
          project_id: Number(selectedProjectId),
          site_id: Number(selectedSiteId),
        });
        const list = resAssignments?.data?.labour_assignments ?? resAssignments?.labour_assignments ?? (Array.isArray(resAssignments?.data) ? resAssignments.data : Array.isArray(resAssignments) ? resAssignments : []);
        // Filter by selected site & project
        assignments = list.filter(a => String(a.site_id) === String(selectedSiteId) && String(a.project_id) === String(selectedProjectId));
        if (assignments.length === 0) {
          assignments = list.filter(a => String(a.project_id) === String(selectedProjectId));
        }
      } catch (err) {
        console.warn('Assignments list fetch warning:', err);
      }

      // 3. Fallback: If no assignments exist for this site, fetch registered workers and auto-assign them to the site
      if (assignments.length === 0) {
        try {
          const resWorkers = await labourApi.workers.list();
          const allWorkers = resWorkers?.data?.labour_workers ?? resWorkers?.labour_workers ?? (Array.isArray(resWorkers?.data) ? resWorkers.data : Array.isArray(resWorkers) ? resWorkers : []);
          
          if (allWorkers.length > 0) {
            toast.info(`Preparing roster for ${allWorkers.length} site workers...`);
            const defaultWageBasis = masters?.['assignment-wage-bases']?.[0]?.id || 1;
            const defaultStatus = masters?.['assignment-statuses']?.find(s => s.status_code === 'ACTIVE')?.id || 1;

            for (const worker of allWorkers) {
              const categoryId = worker.labour_category_id || worker.category_id || 1;
              try {
                const resNewAssign = await labourApi.assignments.create({
                  project_id: Number(selectedProjectId),
                  site_id: Number(selectedSiteId),
                  worker_id: Number(worker.id),
                  labour_category_id: Number(categoryId),
                  assigned_from: selectedDate,
                  wage_basis_id: Number(defaultWageBasis),
                  agreed_wage_rate: Number(worker.base_wage_rate || 850),
                  status_id: Number(defaultStatus),
                  remarks: 'Auto-assigned on attendance muster initialization',
                });
                const newAssign = resNewAssign?.data?.labour_assignment ?? resNewAssign?.labour_assignment;
                if (newAssign?.id) {
                  assignments.push({
                    ...newAssign,
                    worker_name: worker.worker_name,
                    worker_code: worker.worker_code,
                    contractor_name: worker.contractor_name,
                  });
                } else {
                  assignments.push({
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    project_id: Number(selectedProjectId),
                    site_id: Number(selectedSiteId),
                    worker_id: worker.id,
                    worker_name: worker.worker_name,
                    worker_code: worker.worker_code,
                    contractor_name: worker.contractor_name,
                  });
                }
              } catch (assignErr) {
                // If create assignment fails, still add worker optimistically
                assignments.push({
                  id: Date.now() + Math.floor(Math.random() * 1000),
                  project_id: Number(selectedProjectId),
                  site_id: Number(selectedSiteId),
                  worker_id: worker.id,
                  worker_name: worker.worker_name,
                  worker_code: worker.worker_code,
                  contractor_name: worker.contractor_name,
                });
              }
            }
          }
        } catch (workerErr) {
          console.warn('Worker list fetch error:', workerErr);
        }
      }

      // 4. Create attendance entries for all workers
      const newRecords = [];
      if (assignments.length > 0) {
        toast.info(`Populating attendance roll with ${assignments.length} workers...`);
        for (const a of assignments) {
          const payload = {
            assignment_id: Number(a.id),
            worker_id: Number(a.worker_id),
            attendance_status_id: Number(presentStatus.id),
            attendance_source_id: Number(manualSource.id),
            check_in_time: '09:00:00',
            check_out_time: '17:00:00',
            regular_hours: 8,
            overtime_hours: 0,
            remarks: 'Present on site',
          };

          let entryId = Date.now() + Math.floor(Math.random() * 100000);
          if (currentBatch?.id && typeof currentBatch.id === 'number' && currentBatch.id < 1000000000000) {
            try {
              const resEntry = await attendanceApi.createEntry(currentBatch.id, payload);
              const createdEntry = resEntry?.data?.attendance_entry ?? resEntry?.attendance_entry;
              if (createdEntry?.id) {
                entryId = createdEntry.id;
              }
            } catch (entryErr) {
              console.warn('Entry create warning:', entryErr);
            }
          }

          newRecords.push({
            id: entryId,
            assignment_id: a.id,
            worker_id: a.worker_id,
            worker_name: a.worker_name || 'Worker',
            worker_code: a.worker_code || `W-${a.worker_id}`,
            contractor_name: a.contractor_name || 'Direct / Payroll',
            attendance_status_id: presentStatus.id,
            attendance_status_code: 'PRESENT',
            attendance_status_name: presentStatus.attendance_status_name || 'Present',
            regular_hours: 8,
            overtime_hours: 0,
            check_in_time: '09:00:00',
            check_out_time: '17:00:00',
            remarks: '',
          });
        }
      }

      const totalWorkers = newRecords.length;
      const presentWorkers = newRecords.length;
      const absentWorkers = 0;
      const totalRegularHours = newRecords.length * 8;
      const totalOtHours = 0;

      const finalizedBatch = {
        ...currentBatch,
        status_code: currentBatch.status_code || 'DRAFT',
        status_name: currentBatch.status_name || 'Draft',
        total_workers: totalWorkers,
        present_workers: presentWorkers,
        absent_workers: absentWorkers,
        total_regular_hours: totalRegularHours,
        total_overtime_hours: totalOtHours,
        entries: newRecords,
      };

      setActiveBatch(finalizedBatch);
      setRecords(newRecords);

      if (newRecords.length > 0) {
        toast.success(`Attendance Roll initialized with ${newRecords.length} workers. You can now mark attendance.`);
      } else {
        toast.info('Attendance roll initialized. Click "Add Worker" to add workers.');
      }
    } catch (err) {
      console.error('Initialize batch error:', err);
      toast.error(err?.message || 'Failed to initialize daily muster.');
    } finally {
      setLoading(false);
    }
  };

  // Quick toggle status button: P (Present), HD (Half Day), A (Absent)
  const handleToggleStatus = async (record, statusCode) => {
    if (!activeBatch) return;
    const statuses = getAttendanceStatuses();
    const sources = getAttendanceSources();
    const statusObj = statuses.find(s => s.attendance_status_code === statusCode) || {
      id: statusCode === 'PRESENT' ? 1 : statusCode === 'ABSENT' ? 2 : statusCode === 'HALF_DAY' ? 3 : 4,
      attendance_status_code: statusCode,
      attendance_status_name: statusCode === 'PRESENT' ? 'Present' : statusCode === 'ABSENT' ? 'Absent' : statusCode === 'HALF_DAY' ? 'Half Day' : 'Leave',
    };
    const sourceObj = sources.find(s => s.attendance_source_code === 'MANUAL') || sources[0] || { id: 1, attendance_source_code: 'MANUAL', attendance_source_name: 'Manual' };

    const regHours = statusCode === 'PRESENT' ? 8 : statusCode === 'HALF_DAY' ? 4 : 0;
    const otHours = statusCode === 'ABSENT' ? 0 : (Number(record.overtime_hours) || 0);
    const checkIn = statusCode === 'ABSENT' ? null : (record.check_in_time || '09:00:00');
    const checkOut = statusCode === 'ABSENT' ? null : statusCode === 'HALF_DAY' ? '13:00:00' : '17:00:00';

    const payload = {
      assignment_id: Number(record.assignment_id),
      worker_id: Number(record.worker_id),
      attendance_status_id: Number(statusObj.id),
      attendance_source_id: Number(sourceObj.id),
      check_in_time: checkIn,
      check_out_time: checkOut,
      regular_hours: regHours,
      overtime_hours: otHours,
      remarks: record.remarks || `Marked ${statusObj.attendance_status_name}`,
    };

    const updatedRecords = records.map(r => r.id === record.id ? {
      ...r,
      ...payload,
      attendance_status_code: statusCode,
      attendance_status_name: statusObj.attendance_status_name,
    } : r);

    setRecords(updatedRecords);
    updateBatchKpis(updatedRecords);

    // Sync to API if valid batch ID exists
    if (activeBatch.id && typeof activeBatch.id === 'number' && activeBatch.id < 1000000000000) {
      try {
        if (typeof record.id === 'number' && record.id < 1000000000000) {
          await attendanceApi.updateEntry(activeBatch.id, record.id, payload);
        } else {
          const resEntry = await attendanceApi.createEntry(activeBatch.id, payload);
          const createdEntry = resEntry?.data?.attendance_entry ?? resEntry?.attendance_entry;
          if (createdEntry?.id) {
            setRecords(prev => prev.map(r => r.id === record.id ? { ...r, id: createdEntry.id } : r));
          }
        }
      } catch (err) {
        console.warn('API sync warning:', err);
      }
    }

    toast.success(`Marked ${record.worker_name} as ${statusObj.attendance_status_name}`);
  };

  // Bulk Mark All Present
  const handleMarkAllPresent = async () => {
    if (!activeBatch || records.length === 0) return;
    const statuses = getAttendanceStatuses();
    const sources = getAttendanceSources();
    const presentStatus = statuses.find(s => s.attendance_status_code === 'PRESENT') || { id: 1, attendance_status_code: 'PRESENT', attendance_status_name: 'Present' };
    const sourceObj = sources.find(s => s.attendance_source_code === 'MANUAL') || { id: 1, attendance_source_code: 'MANUAL', attendance_source_name: 'Manual' };

    const updatedRecords = records.map(r => ({
      ...r,
      attendance_status_id: presentStatus.id,
      attendance_status_code: 'PRESENT',
      attendance_status_name: presentStatus.attendance_status_name,
      regular_hours: 8,
      check_in_time: '09:00:00',
      check_out_time: '17:00:00',
    }));

    setRecords(updatedRecords);
    updateBatchKpis(updatedRecords);
    toast.success('All workers marked as Present (8 hrs).');

    // Sync in background
    if (activeBatch.id && typeof activeBatch.id === 'number' && activeBatch.id < 1000000000000) {
      Promise.all(updatedRecords.map(r => {
        const payload = {
          assignment_id: Number(r.assignment_id),
          worker_id: Number(r.worker_id),
          attendance_status_id: Number(presentStatus.id),
          attendance_source_id: Number(sourceObj.id),
          check_in_time: '09:00:00',
          check_out_time: '17:00:00',
          regular_hours: 8,
          overtime_hours: Number(r.overtime_hours) || 0,
          remarks: 'Marked Present',
        };
        return typeof r.id === 'number' && r.id < 1000000000000
          ? attendanceApi.updateEntry(activeBatch.id, r.id, payload).catch(() => {})
          : attendanceApi.createEntry(activeBatch.id, payload).catch(() => {});
      }));
    }
  };

  // Bulk Mark All Absent
  const handleMarkAllAbsent = async () => {
    if (!activeBatch || records.length === 0) return;
    const statuses = getAttendanceStatuses();
    const sources = getAttendanceSources();
    const absentStatus = statuses.find(s => s.attendance_status_code === 'ABSENT') || { id: 2, attendance_status_code: 'ABSENT', attendance_status_name: 'Absent' };
    const sourceObj = sources.find(s => s.attendance_source_code === 'MANUAL') || { id: 1, attendance_source_code: 'MANUAL', attendance_source_name: 'Manual' };

    const updatedRecords = records.map(r => ({
      ...r,
      attendance_status_id: absentStatus.id,
      attendance_status_code: 'ABSENT',
      attendance_status_name: absentStatus.attendance_status_name,
      regular_hours: 0,
      overtime_hours: 0,
      check_in_time: null,
      check_out_time: null,
    }));

    setRecords(updatedRecords);
    updateBatchKpis(updatedRecords);
    toast.success('All workers marked as Absent.');

    // Sync in background
    if (activeBatch.id && typeof activeBatch.id === 'number' && activeBatch.id < 1000000000000) {
      Promise.all(updatedRecords.map(r => {
        const payload = {
          assignment_id: Number(r.assignment_id),
          worker_id: Number(r.worker_id),
          attendance_status_id: Number(absentStatus.id),
          attendance_source_id: Number(sourceObj.id),
          check_in_time: null,
          check_out_time: null,
          regular_hours: 0,
          overtime_hours: 0,
          remarks: 'Marked Absent',
        };
        return typeof r.id === 'number' && r.id < 1000000000000
          ? attendanceApi.updateEntry(activeBatch.id, r.id, payload).catch(() => {})
          : attendanceApi.createEntry(activeBatch.id, payload).catch(() => {});
      }));
    }
  };

  // Update working hours directly
  const handleUpdateHours = async (record, field, value) => {
    const numVal = Math.max(0, Math.min(24, Number(value) || 0));
    const payload = {
      assignment_id: Number(record.assignment_id),
      worker_id: Number(record.worker_id),
      attendance_status_id: Number(record.attendance_status_id),
      attendance_source_id: Number(record.attendance_source_id || 1),
      check_in_time: record.check_in_time || '09:00:00',
      check_out_time: record.check_out_time || '17:00:00',
      regular_hours: field === 'regular_hours' ? numVal : Number(record.regular_hours) || 0,
      overtime_hours: field === 'overtime_hours' ? numVal : Number(record.overtime_hours) || 0,
      remarks: record.remarks || '',
    };

    const updatedRecords = records.map(r => r.id === record.id ? { ...r, [field]: numVal } : r);
    setRecords(updatedRecords);
    updateBatchKpis(updatedRecords);

    if (activeBatch?.id && typeof activeBatch.id === 'number' && activeBatch.id < 1000000000000) {
      if (typeof record.id === 'number' && record.id < 1000000000000) {
        attendanceApi.updateEntry(activeBatch.id, record.id, payload).catch(() => {});
      }
    }
  };

  // Save manual worker entry
  const handleAddManualEntry = async (e) => {
    e.preventDefault();
    if (!activeBatch?.id || (!manualForm.assignment_id && !manualForm.worker_id)) return;
    
    const worker = availableWorkers.find(w => 
      (manualForm.assignment_id && String(w.assignment_id) === String(manualForm.assignment_id)) ||
      (manualForm.worker_id && String(w.worker_id) === String(manualForm.worker_id))
    );
    if (!worker) return;

    const sources = getAttendanceSources();
    const manualSource = sources.find(s => s.attendance_source_code === 'MANUAL') || sources[0] || { id: 1 };
    const statuses = getAttendanceStatuses();
    const statusObj = statuses.find(s => String(s.id) === String(manualForm.attendance_status_id)) || statuses[0];

    try {
      let assignmentId = worker.assignment_id;

      // If worker doesn't have an assignment for this site yet, create one
      if (!assignmentId) {
        const defaultWageBasis = masters?.['assignment-wage-bases']?.[0]?.id || 1;
        const defaultStatus = masters?.['assignment-statuses']?.find(s => s.status_code === 'ACTIVE')?.id || 1;
        const categoryId = worker.labour_category_id || 1;

        try {
          const resNewAssign = await labourApi.assignments.create({
            project_id: Number(selectedProjectId),
            site_id: Number(selectedSiteId),
            worker_id: Number(worker.worker_id),
            labour_category_id: Number(categoryId),
            assigned_from: selectedDate,
            wage_basis_id: Number(defaultWageBasis),
            agreed_wage_rate: Number(worker.base_wage_rate || 850),
            status_id: Number(defaultStatus),
            remarks: 'Added from manual attendance roster',
          });
          const newAssign = resNewAssign?.data?.labour_assignment ?? resNewAssign?.labour_assignment;
          if (newAssign?.id) assignmentId = newAssign.id;
        } catch (e) {
          assignmentId = Date.now() + Math.floor(Math.random() * 1000);
        }
      }

      const payload = {
        assignment_id: Number(assignmentId),
        worker_id: Number(worker.worker_id),
        attendance_status_id: Number(statusObj.id),
        attendance_source_id: Number(manualSource.id),
        check_in_time: manualForm.check_in_time || null,
        check_out_time: manualForm.check_out_time || null,
        regular_hours: Number(manualForm.regular_hours || 0),
        overtime_hours: Number(manualForm.overtime_hours || 0),
        work_description: manualForm.work_description || null,
        remarks: manualForm.remarks,
      };

      let entryId = Date.now();
      if (activeBatch.id && typeof activeBatch.id === 'number' && activeBatch.id < 1000000000000) {
        try {
          const resEntry = await attendanceApi.createEntry(activeBatch.id, payload);
          const createdEntry = resEntry?.data?.attendance_entry ?? resEntry?.attendance_entry;
          if (createdEntry?.id) entryId = createdEntry.id;
        } catch (e) {}
      }

      const newRecord = {
        id: entryId,
        assignment_id: assignmentId,
        worker_id: worker.worker_id,
        worker_name: worker.worker_name,
        worker_code: worker.worker_code,
        contractor_name: worker.contractor_name || 'Direct / Payroll',
        ...payload,
        attendance_status_name: statusObj.attendance_status_name,
        attendance_status_code: statusObj.attendance_status_code,
      };

      const updatedRecords = [newRecord, ...records];
      setRecords(updatedRecords);
      updateBatchKpis(updatedRecords);
      toast.success('Worker added to muster roll.');
      setIsAddOpen(false);
    } catch (err) {
      toast.error('Failed to add worker entry.');
    }
  };

  // Delete worker entry from roll
  const handleDeleteEntry = async () => {
    if (!activeBatch?.id || !deletingRecord?.id) return;
    try {
      if (typeof deletingRecord.id === 'number' && deletingRecord.id < 1000000000000) {
        await attendanceApi.removeEntry(activeBatch.id, deletingRecord.id).catch(() => {});
      }
      const updatedRecords = records.filter(r => r.id !== deletingRecord.id);
      setRecords(updatedRecords);
      updateBatchKpis(updatedRecords);
      toast.success('Worker removed from attendance list.');
      setDeletingRecord(null);
    } catch (err) {
      toast.error('Failed to remove worker entry.');
    }
  };

  // Batch transitions (submit, approve, reject, lock)
  const handleBatchTransition = async () => {
    if (!activeBatch?.id || !batchActionType) return;
    try {
      const payload = { remarks: actionRemarks.trim() || null };
      if (batchActionType === 'submit') {
        await attendanceApi.submit(activeBatch.id, payload);
        toast.success('Attendance batch submitted for approval.');
      } else if (batchActionType === 'approve') {
        await attendanceApi.approve(activeBatch.id, payload);
        toast.success('Attendance batch approved.');
      } else if (batchActionType === 'reject') {
        await attendanceApi.reject(activeBatch.id, payload);
        toast.success('Attendance batch rejected.');
      } else if (batchActionType === 'lock') {
        await attendanceApi.lock(activeBatch.id, payload);
        toast.success('Attendance batch locked.');
      }
      setBatchActionType(null);
      setActionRemarks('');
      fetchBatch(selectedProjectId, selectedSiteId, selectedDate, selectedShift);
    } catch (err) {
      toast.error(err?.message || `Failed to complete ${batchActionType} transition.`);
    }
  };

  // Filtered list search
  const filtered = useMemo(() => {
    return records.filter(r => {
      if (statusFilter !== 'all' && String(r.attendance_status_code) !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          String(r.worker_name || '').toLowerCase().includes(q) ||
          String(r.worker_code || '').toLowerCase().includes(q) ||
          String(r.contractor_name || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  // Status badges config
  const getStatusVariant = (code) => {
    if (code === 'PRESENT') return 'success';
    if (code === 'HALF_DAY') return 'warning';
    if (code === 'ABSENT') return 'error';
    return 'neutral';
  };

  // Check if current status allows editing
  const isEditable = !activeBatch || activeBatch.status_code === 'DRAFT' || activeBatch.status_code === 'REJECTED' || !activeBatch.status_code;

  return (
    <PageContainer>
      <PageHeader
        title="Daily Site Labour Attendance & Muster Roll"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Labour & Attendance' },
          { label: 'Daily Attendance' }
        ]}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total On Muster"
          value={activeBatch ? (activeBatch.total_workers ?? records.length) : 0}
          status="primary"
          icon={<Users />}
        />
        <KpiCard
          label="Present Today"
          value={activeBatch ? `${activeBatch.present_workers ?? records.filter(r => r.attendance_status_code === 'PRESENT' || r.attendance_status_code === 'HALF_DAY').length} Workers` : '0 Workers'}
          status="success"
          icon={<CheckCircle2 />}
        />
        <KpiCard
          label="Absent / On Leave"
          value={activeBatch ? `${activeBatch.absent_workers ?? records.filter(r => r.attendance_status_code === 'ABSENT' || r.attendance_status_code === 'LEAVE').length} Workers` : '0 Workers'}
          status={activeBatch?.absent_workers > 0 ? 'warning' : 'neutral'}
          icon={<XCircle />}
        />
        <KpiCard
          label="Working Hours Pool"
          value={activeBatch ? `${Number(activeBatch.total_regular_hours || 0) + Number(activeBatch.total_overtime_hours || 0)} Hours` : '0 Hours'}
          status="info"
          icon={<Clock />}
        />
      </div>

      <div className="flex flex-col gap-4">
        {/* Scope Selectors & Navigation Toolbar */}
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 bg-surface border border-border rounded-lg p-3.5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {/* Quick Date Picker */}
            <div className="flex items-center gap-1 bg-surface-muted/60 p-1 rounded-lg border border-border">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handlePrevDay} title="Previous Day">
                <ArrowLeft className="w-3.5 h-3.5" />
              </Button>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-7 text-xs font-mono font-bold w-36 bg-transparent border-0"
              />
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleNextDay} title="Next Day">
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-[11px] px-2" onClick={handleToday}>
                Today
              </Button>
            </div>

            {/* Project Select */}
            <div className="w-full sm:w-48">
              <Select
                value={selectedProjectId}
                onChange={setSelectedProjectId}
                className="h-9 text-xs"
                placeholder="Select Project"
                options={projects.map(p => ({ value: String(p.id), label: p.project_name || p.name }))}
              />
            </div>

            {/* Site Select */}
            <div className="w-full sm:w-48">
              <Select
                value={selectedSiteId}
                onChange={setSelectedSiteId}
                className="h-9 text-xs"
                placeholder="Select Site"
                disabled={!selectedProjectId}
                options={sites.map(s => ({ value: String(s.id), label: s.site_name || s.name }))}
              />
            </div>

            {/* Shift Select */}
            <div className="w-full sm:w-32">
              <Select
                value={selectedShift}
                onChange={setSelectedShift}
                className="h-9 text-xs"
                placeholder="Select Shift"
                options={[
                  { value: 'GENERAL', label: 'General Shift' },
                  { value: 'NIGHT', label: 'Night Shift' },
                  { value: 'OVERTIME', label: 'OT Shift' },
                ]}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end">
            {activeBatch && (
              <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded bg-secondary/10 text-secondary border border-secondary/20`}>
                Muster Status: {activeBatch.status_name || activeBatch.status_code || 'Draft'}
              </span>
            )}
          </div>
        </div>

        {/* Roster & Grid Section */}
        {!selectedSiteId ? (
          <div className="text-center py-12 bg-surface border border-border/80 rounded-lg text-text-secondary text-[13px]">
            Please select a project and site location to view daily muster.
          </div>
        ) : loading ? (
          <div className="text-center py-12 bg-surface border border-border/80 rounded-lg text-text-muted text-[13px] flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-primary" />
            Loading attendance records...
          </div>
        ) : !activeBatch ? (
          <div className="flex flex-col items-center justify-center p-8 text-center bg-surface border border-border rounded-xl shadow-sm max-w-xl mx-auto my-6">
            <div className="w-14 h-14 rounded-full bg-primary/5 flex items-center justify-center mb-4 border border-primary/10">
              <Calendar className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-sm font-bold text-text-primary mb-1">Muster Roll Not Initialized</h3>
            <p className="text-[11.5px] text-text-muted max-w-sm mb-5">
              No daily muster or attendance sheet is active for this site and date. Initialize to populate active site workers and mark attendance.
            </p>
            <Button
              variant="primary"
              className="h-9 px-5 text-[13px] font-semibold shadow-sm"
              onClick={handleInitializeBatch}
              leftIcon={<Sparkles className="w-4 h-4" />}
            >
              Initialize Attendance Roll
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Quick Bulk Marking & Filters Toolbar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-surface p-3 rounded-lg border border-border">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="w-full sm:w-[240px]">
                  <SearchField
                    placeholder="Search worker name, code, contractor..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="w-full sm:w-36">
                  <Select
                    value={statusFilter}
                    onChange={setStatusFilter}
                    className="h-9 text-xs"
                    placeholder="All Statuses"
                    options={[
                      { value: 'all', label: `All (${records.length})` },
                      { value: 'PRESENT', label: `Present (${records.filter(r => r.attendance_status_code === 'PRESENT').length})` },
                      { value: 'HALF_DAY', label: `Half Day (${records.filter(r => r.attendance_status_code === 'HALF_DAY').length})` },
                      { value: 'ABSENT', label: `Absent (${records.filter(r => r.attendance_status_code === 'ABSENT').length})` },
                    ]}
                  />
                </div>

                {/* Quick Bulk Attendance Marking */}
                {isEditable && records.length > 0 && (
                  <div className="flex items-center gap-1.5 pl-2 border-l border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800 border-emerald-300"
                      leftIcon={<UserCheck className="w-3.5 h-3.5 text-emerald-600" />}
                      onClick={handleMarkAllPresent}
                      title="Mark all workers on roll as Present"
                    >
                      Mark All Present
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 hover:text-red-800 border-red-300"
                      leftIcon={<UserX className="w-3.5 h-3.5 text-red-600" />}
                      onClick={handleMarkAllAbsent}
                      title="Mark all workers on roll as Absent"
                    >
                      Mark All Absent
                    </Button>
                  </div>
                )}
              </div>

              {/* Roster Actions & Workflow Transitions */}
              <div className="flex flex-wrap items-center gap-2 justify-end">
                {isEditable && (
                  <Button
                    variant="outline"
                    className="h-9 px-3 text-[13px]"
                    leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() => {
                      loadAvailableWorkers();
                      setIsAddOpen(true);
                    }}
                  >
                    Add Worker
                  </Button>
                )}

                {/* Workflow Transitions */}
                {activeBatch.status_code === 'DRAFT' && (
                  <Button
                    variant="primary"
                    className="h-9 px-3.5 text-[13px]"
                    leftIcon={<Send className="w-4 h-4" />}
                    onClick={() => {
                      setBatchActionType('submit');
                      setActionRemarks('');
                    }}
                  >
                    Submit Muster
                  </Button>
                )}

                {activeBatch.status_code === 'SUBMITTED' && (
                  <>
                    <Button
                      variant="primary"
                      className="h-9 px-3 text-[13px] bg-emerald-600 hover:bg-emerald-700"
                      leftIcon={<Check className="w-4 h-4" />}
                      onClick={() => {
                        setBatchActionType('approve');
                        setActionRemarks('');
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      className="h-9 px-3 text-[13px]"
                      leftIcon={<XCircle className="w-4 h-4" />}
                      onClick={() => {
                        setBatchActionType('reject');
                        setActionRemarks('');
                      }}
                    >
                      Reject
                    </Button>
                  </>
                )}

                {activeBatch.status_code === 'APPROVED' && (
                  <Button
                    variant="primary"
                    className="h-9 px-3 text-[13px]"
                    leftIcon={<Lock className="w-4 h-4" />}
                    onClick={() => {
                      setBatchActionType('lock');
                      setActionRemarks('');
                    }}
                  >
                    Lock Muster
                  </Button>
                )}
              </div>
            </div>

            {/* Desktop & Tablet Data Table */}
            <div className="hidden sm:block">
              <DataTableContainer
                pagination={
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalResults={filtered.length}
                    pageSize={perPage}
                    onPageChange={setPage}
                  />
                }
              >
                <table className="w-full text-left text-[12px] table-auto whitespace-nowrap">
                  <thead className="bg-surface-muted text-text-secondary text-[11px] uppercase font-semibold border-b border-border tracking-wider">
                    <tr>
                      <th className="px-3 py-2.5 w-10 text-center">#</th>
                      <th className="px-3 py-2.5 w-28">Worker Code</th>
                      <th className="px-3 py-2.5 w-48">Worker Name</th>
                      <th className="px-3 py-2.5 w-40">Contractor / Agency</th>
                      <th className="px-3 py-2.5 w-36 text-center">Mark Attendance</th>
                      <th className="px-3 py-2.5 text-center w-28">Regular Hrs</th>
                      <th className="px-3 py-2.5 text-center w-28">OT Hrs</th>
                      <th className="px-3 py-2.5 w-36">Site Remarks</th>
                      <th className="px-3 py-2.5 w-24 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paged.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-8 text-text-muted text-[12px]">
                          No workers match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      paged.map((r, index) => {
                        const isPresent = r.attendance_status_code === 'PRESENT';
                        const isHalfDay = r.attendance_status_code === 'HALF_DAY';
                        const isAbsent = r.attendance_status_code === 'ABSENT';

                        return (
                          <tr
                            key={r.id || index}
                            className={`transition-colors ${
                              isAbsent
                                ? 'bg-red-50/30 hover:bg-red-50/50'
                                : isPresent
                                ? 'hover:bg-emerald-50/20'
                                : 'hover:bg-surface-muted/40'
                            }`}
                          >
                            <td className="px-3 py-2.5 text-center font-medium text-text-primary text-[11px]">
                              {(page - 1) * perPage + index + 1}
                            </td>
                            <td className="px-3 py-2.5 font-mono font-bold text-text-primary text-[11px]">
                              {r.worker_code}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="font-semibold text-text-primary text-[12.5px]">{r.worker_name}</div>
                              <div className={`text-[10px] font-medium ${
                                isPresent ? 'text-emerald-700' : isHalfDay ? 'text-amber-700' : isAbsent ? 'text-red-700' : 'text-text-muted'
                              }`}>
                                {r.attendance_status_name || (isPresent ? 'Present' : isAbsent ? 'Absent' : isHalfDay ? 'Half Day' : '—')}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-text-secondary text-[11px] truncate max-w-[160px]">
                              {r.contractor_name || 'Direct / Payroll'}
                            </td>

                            {/* Quick 1-Click Status Marking Toggle */}
                            <td className="px-3 py-2.5 text-center">
                              {isEditable ? (
                                <div className="inline-flex items-center gap-1 bg-surface-muted/60 p-1 rounded-lg border border-border shadow-2xs">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleStatus(r, 'PRESENT')}
                                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                                      isPresent
                                        ? 'bg-emerald-600 text-white shadow-xs scale-105'
                                        : 'text-text-secondary hover:text-emerald-700 hover:bg-emerald-100'
                                    }`}
                                    title="Mark Present (8 Hours)"
                                  >
                                    P
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleStatus(r, 'HALF_DAY')}
                                    className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                                      isHalfDay
                                        ? 'bg-amber-500 text-white shadow-xs scale-105'
                                        : 'text-text-secondary hover:text-amber-700 hover:bg-amber-100'
                                    }`}
                                    title="Mark Half Day (4 Hours)"
                                  >
                                    HD
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleStatus(r, 'ABSENT')}
                                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                                      isAbsent
                                        ? 'bg-red-600 text-white shadow-xs scale-105'
                                        : 'text-text-secondary hover:text-red-700 hover:bg-red-100'
                                    }`}
                                    title="Mark Absent (0 Hours)"
                                  >
                                    A
                                  </button>
                                </div>
                              ) : (
                                <Badge variant={getStatusVariant(r.attendance_status_code)}>
                                  {r.attendance_status_name || (isPresent ? 'Present' : isAbsent ? 'Absent' : isHalfDay ? 'Half Day' : '—')}
                                </Badge>
                              )}
                            </td>

                            {/* Regular Hours Editable */}
                            <td className="px-3 py-2.5 text-center">
                              {isEditable && !isAbsent ? (
                                <input
                                  type="number"
                                  min="0"
                                  max="24"
                                  value={r.regular_hours ?? 8}
                                  onChange={(e) => handleUpdateHours(r, 'regular_hours', e.target.value)}
                                  className="w-16 h-7 text-center font-mono font-semibold text-xs border border-border rounded bg-surface focus:border-primary focus:ring-1 focus:ring-primary"
                                />
                              ) : (
                                <span className="font-mono font-semibold text-text-primary text-[11px]">
                                  {r.regular_hours || 0} hrs
                                </span>
                              )}
                            </td>

                            {/* Overtime Hours Editable */}
                            <td className="px-3 py-2.5 text-center">
                              {isEditable && !isAbsent ? (
                                <input
                                  type="number"
                                  min="0"
                                  max="24"
                                  value={r.overtime_hours ?? 0}
                                  onChange={(e) => handleUpdateHours(r, 'overtime_hours', e.target.value)}
                                  className="w-16 h-7 text-center font-mono font-semibold text-xs border border-border rounded bg-surface focus:border-primary focus:ring-1 focus:ring-primary"
                                />
                              ) : (
                                <span className="font-mono font-semibold text-primary text-[11px]">
                                  {r.overtime_hours || 0} hrs
                                </span>
                              )}
                            </td>

                            <td className="px-3 py-2.5 text-text-secondary text-[11px] truncate max-w-[140px]">
                              {r.remarks || '—'}
                            </td>

                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  title="View Details"
                                  onClick={() => setViewingRecord(r)}
                                >
                                  <Eye className="w-3.5 h-3.5 text-text-secondary hover:text-primary" />
                                </Button>
                                {isEditable && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    title="Remove from Muster"
                                    onClick={() => setDeletingRecord(r)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-text-secondary hover:text-error" />
                                  </Button>
                                )}
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

            {/* Mobile View - Card-Type Format for Phones (< sm) */}
            <div className="block sm:hidden space-y-3">
              {paged.length === 0 ? (
                <div className="text-center py-8 bg-surface border border-border rounded-lg text-text-muted text-xs">
                  No workers match the selected filters.
                </div>
              ) : (
                paged.map((r, index) => {
                  const idx = (page - 1) * perPage + index + 1;
                  const isPresent = r.attendance_status_code === 'PRESENT';
                  const isHalfDay = r.attendance_status_code === 'HALF_DAY';
                  const isAbsent = r.attendance_status_code === 'ABSENT';

                  return (
                    <div
                      key={r.id || index}
                      className={`bg-surface border rounded-lg p-3.5 shadow-xs space-y-2.5 ${
                        isAbsent ? 'border-red-200 bg-red-50/20' : 'border-border'
                      }`}
                    >
                      {/* Worker Header & Quick Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-surface-muted text-text-secondary font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                            {idx}
                          </span>
                          <div className="min-w-0">
                            <h4 className="font-semibold text-text-primary text-[13px] truncate leading-tight">{r.worker_name}</h4>
                            <span className="text-[10px] font-mono text-text-muted block mt-0.5">{r.worker_code} • {r.contractor_name || 'Direct / Payroll'}</span>
                          </div>
                        </div>

                        {/* Quick Toggle Buttons */}
                        <div className="shrink-0">
                          {isEditable ? (
                            <div className="inline-flex items-center gap-1 bg-surface-muted/60 p-0.5 rounded-lg border border-border">
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(r, 'PRESENT')}
                                className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                                  isPresent
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-text-secondary hover:text-emerald-600'
                                }`}
                                title="Mark Present"
                              >
                                P
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(r, 'HALF_DAY')}
                                className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                                  isHalfDay
                                    ? 'bg-amber-500 text-white shadow-xs'
                                    : 'text-text-secondary hover:text-amber-600'
                                }`}
                                title="Mark Half Day"
                              >
                                HD
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(r, 'ABSENT')}
                                className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                                  isAbsent
                                    ? 'bg-red-600 text-white shadow-xs'
                                    : 'text-text-secondary hover:text-red-600'
                                }`}
                                title="Mark Absent"
                              >
                                A
                              </button>
                            </div>
                          ) : (
                            <Badge variant={getStatusVariant(r.attendance_status_code)} className="text-[9px] uppercase font-bold px-1.5 py-0.5">
                              {r.attendance_status_name || (isPresent ? 'Present' : isAbsent ? 'Absent' : 'Half Day')}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Working Hours Grid */}
                      <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-border/60 text-xs">
                        <div className="bg-surface-muted/40 rounded p-1.5 border border-border/40">
                          <span className="text-[10px] text-text-muted block uppercase font-bold">Regular Hours</span>
                          <span className="font-mono font-bold text-text-primary text-[12px]">{r.regular_hours || 0} hrs</span>
                        </div>
                        <div className="bg-surface-muted/40 rounded p-1.5 border border-border/40">
                          <span className="text-[10px] text-text-muted block uppercase font-bold">Overtime Hours</span>
                          <span className="font-mono font-bold text-primary text-[12px]">{r.overtime_hours || 0} hrs</span>
                        </div>
                      </div>

                      {/* Remarks */}
                      {r.remarks && (
                        <div className="text-[11px] text-text-secondary bg-surface-muted/20 px-2 py-1 rounded border border-border/40">
                          <span className="font-medium text-text-primary">Note: </span>{r.remarks}
                        </div>
                      )}

                      {/* Card Footer: Status Text & Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-text-muted">Status:</span>
                          <span className={`text-[11px] font-semibold ${
                            isPresent ? 'text-emerald-600' :
                            isHalfDay ? 'text-amber-600' :
                            isAbsent ? 'text-red-600' : 'text-text-secondary'
                          }`}>
                            {r.attendance_status_name || (isPresent ? 'Present' : isAbsent ? 'Absent' : 'Half Day')}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] px-2"
                            onClick={() => setViewingRecord(r)}
                          >
                            <Eye className="w-3 h-3 mr-1" /> View
                          </Button>
                          {isEditable && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              title="Delete"
                              onClick={() => setDeletingRecord(r)}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-text-secondary hover:text-error" />
                            </Button>
                          )}
                        </div>
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
                  pageSize={perPage}
                  onPageChange={setPage}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Worker Entry Modal */}
      <EntityEditModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)}>
        <EntityEditModal.Header
          icon={Users}
          title="Add Worker to Daily Muster"
          subtitle="Assign a site worker and set initial timing logs."
          onClose={() => setIsAddOpen(false)}
        />
        <form onSubmit={handleAddManualEntry} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <EntityEditModal.Body>
            <EntityEditModal.Section title="Worker Details">
              <EntityEditModal.Grid>
                <FormField label="Select Worker" required>
                  <Select
                    value={manualForm.worker_id}
                    onChange={(val) => {
                      const selected = availableWorkers.find(w => String(w.worker_id) === String(val));
                      setManualForm(prev => ({
                        ...prev,
                        worker_id: val,
                        assignment_id: selected?.assignment_id ? String(selected.assignment_id) : '',
                      }));
                    }}
                    placeholder="Select available worker"
                    options={availableWorkers.map(w => ({
                      value: String(w.worker_id),
                      label: `${w.worker_name || 'Worker'} (${w.worker_code || 'ID: ' + w.worker_id})`,
                    }))}
                  />
                </FormField>

                <FormField label="Muster Status" required>
                  <Select
                    value={manualForm.attendance_status_id}
                    onChange={(val) => setManualForm(prev => ({ ...prev, attendance_status_id: val }))}
                    placeholder="Select status"
                    options={getAttendanceStatuses().map(s => ({ value: String(s.id), label: s.attendance_status_name }))}
                  />
                </FormField>

                <FormField label="Regular Hours Worked">
                  <Input
                    type="number"
                    min="0"
                    max="24"
                    value={manualForm.regular_hours}
                    onChange={(e) => setManualForm(prev => ({ ...prev, regular_hours: e.target.value }))}
                  />
                </FormField>

                <FormField label="Overtime Hours Worked">
                  <Input
                    type="number"
                    min="0"
                    max="24"
                    value={manualForm.overtime_hours}
                    onChange={(e) => setManualForm(prev => ({ ...prev, overtime_hours: e.target.value }))}
                  />
                </FormField>

                <FormField label="Check-In Time">
                  <Input
                    type="text"
                    placeholder="HH:MM:SS"
                    value={manualForm.check_in_time}
                    onChange={(e) => setManualForm(prev => ({ ...prev, check_in_time: e.target.value }))}
                  />
                </FormField>

                <FormField label="Check-Out Time">
                  <Input
                    type="text"
                    placeholder="HH:MM:SS"
                    value={manualForm.check_out_time}
                    onChange={(e) => setManualForm(prev => ({ ...prev, check_out_time: e.target.value }))}
                  />
                </FormField>

                <FormField label="Work Description" className="md:col-span-2">
                  <Textarea
                    placeholder="Describe the work performed..."
                    value={manualForm.work_description}
                    onChange={(e) => setManualForm(prev => ({ ...prev, work_description: e.target.value }))}
                    rows={2}
                  />
                </FormField>

                <FormField label="Remarks" className="md:col-span-2">
                  <Textarea
                    placeholder="Job assignment remarks, special notes..."
                    value={manualForm.remarks}
                    onChange={(e) => setManualForm(prev => ({ ...prev, remarks: e.target.value }))}
                    rows={2}
                  />
                </FormField>
              </EntityEditModal.Grid>
            </EntityEditModal.Section>
          </EntityEditModal.Body>
          <EntityEditModal.Footer
            submitLabel="Add to Muster"
            onCancel={() => setIsAddOpen(false)}
          />
        </form>
      </EntityEditModal>

      {/* View Details Modal */}
      <EntityEditModal isOpen={Boolean(viewingRecord)} onClose={() => setViewingRecord(null)}>
        <EntityEditModal.Header
          icon={Eye}
          title="Labour Attendance 360"
          subtitle="Detailed daily timing logs and work parameters."
          onClose={() => setViewingRecord(null)}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <EntityEditModal.Body>
            <EntityEditModal.Section title="Worker Information">
              <EntityEditModal.Grid>
                <div>
                  <div className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Worker Name</div>
                  <div className="text-[13px] font-medium text-text-primary mt-1">{viewingRecord?.worker_name || '—'}</div>
                </div>

                <div>
                  <div className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Worker Code</div>
                  <div className="text-[13px] font-mono font-semibold text-text-primary mt-1">{viewingRecord?.worker_code || '—'}</div>
                </div>

                <div>
                  <div className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Contractor / Agency</div>
                  <div className="text-[13px] text-text-primary mt-1">{viewingRecord?.contractor_name || 'Direct / Payroll'}</div>
                </div>

                <div>
                  <div className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Subcontractor</div>
                  <div className="text-[13px] text-text-primary mt-1">{viewingRecord?.subcontractor_name || '—'}</div>
                </div>
              </EntityEditModal.Grid>
            </EntityEditModal.Section>

            <EntityEditModal.Section title="Muster Timings">
              <EntityEditModal.Grid>
                <div>
                  <div className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Attendance Status</div>
                  <div className="mt-1">
                    <Badge variant={getStatusVariant(viewingRecord?.attendance_status_code)}>
                      {viewingRecord?.attendance_status_name || viewingRecord?.attendance_status_code}
                    </Badge>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Timings (In / Out)</div>
                  <div className="text-[13px] font-mono text-text-primary mt-1">
                    {viewingRecord?.check_in_time || '—'} to {viewingRecord?.check_out_time || '—'}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Regular Hours</div>
                  <div className="text-[13px] font-mono text-text-primary mt-1">{viewingRecord?.regular_hours || 0} hrs</div>
                </div>

                <div>
                  <div className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Overtime Hours</div>
                  <div className="text-[13px] font-mono text-text-primary mt-1">{viewingRecord?.overtime_hours || 0} hrs</div>
                </div>

                <div className="md:col-span-2">
                  <div className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Remarks / Work Description</div>
                  <div className="text-[12px] text-text-secondary mt-1 whitespace-pre-wrap leading-relaxed">
                    {viewingRecord?.remarks || 'No daily site remarks provided.'}
                  </div>
                </div>
              </EntityEditModal.Grid>
            </EntityEditModal.Section>
          </EntityEditModal.Body>
          <div className="flex items-center justify-end border-t border-border px-4 py-3 bg-surface-subtle">
            <Button variant="ghost" className="h-9 px-4 text-[13px]" onClick={() => setViewingRecord(null)}>
              Close
            </Button>
          </div>
        </div>
      </EntityEditModal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deletingRecord)}
        title="Delete Roster Entry"
        message="Are you sure you want to remove this worker from the daily attendance roll? This will wipe out check-in logs for today."
        variant="danger"
        confirmLabel="Remove"
        onConfirm={handleDeleteEntry}
        onCancel={() => setDeletingRecord(null)}
      />

      {/* Workflow Transition Confirmation Modal */}
      {batchActionType && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl shadow-level-3 w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-muted/30">
              <h3 className="text-sm font-bold text-text-primary capitalize">{batchActionType} Daily Muster</h3>
              <Button variant="ghost" size="sm" onClick={() => setBatchActionType(null)}>✕</Button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-[12px] text-text-secondary leading-normal">
                Are you sure you want to {batchActionType} the attendance batch for date <span className="font-mono font-bold text-text-primary">{selectedDate}</span>?
              </p>
              <FormField label="Administration Remarks">
                <Textarea
                  placeholder="Provide comments or remarks..."
                  value={actionRemarks}
                  onChange={(e) => setActionRemarks(e.target.value)}
                  rows={3}
                />
              </FormField>
            </div>
            <div className="px-5 py-3 border-t border-border bg-surface-muted/20 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setBatchActionType(null)}>Cancel</Button>
              <Button variant="primary" size="sm" className="capitalize" onClick={handleBatchTransition}>Confirm {batchActionType}</Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
