import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Save,
  Building2,
  MapPin,
  Compass,
  Phone,
  Users,
  Calendar,
  Activity,
  FileText,
  AlertCircle,
  Loader2,
  Info,
  ArrowLeft,
  LocateFixed,
} from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageContainer } from '../../../components/layout/PageContainer';
import { FormField } from '../../../components/composite/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { toast } from '../../../components/composite/Toast';
import { sitesApi, projectsApi, mastersApi, usersApi } from '../../../api/apiservice';

/**
 * Generate the next project-specific site code based on existing site codes
 * in the selected parent project (e.g. SITE-01 -> SITE-02).
 */
export const generateNextSiteCode = (existingSites = []) => {
  let maxSeq = 0;
  let prefix = 'SITE-';
  let padLen = 2;

  if (Array.isArray(existingSites) && existingSites.length > 0) {
    existingSites.forEach((s) => {
      const code = String(s.site_code || s.code || '').trim();
      const match = code.match(/^(.*?)(\d+)$/);
      if (match) {
        const num = parseInt(match[2], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
          prefix = match[1];
          padLen = Math.max(padLen, match[2].length);
        }
      }
    });
  }

  const nextNum = maxSeq + 1;
  let nextCode = `${prefix}${String(nextNum).padStart(padLen, '0')}`;

  // Collision avoidance check against existing sites for this project
  const existingSet = new Set(
    (existingSites || []).map((s) => String(s.site_code || s.code || '').toUpperCase().trim())
  );
  let counter = nextNum;
  while (existingSet.has(nextCode.toUpperCase())) {
    counter++;
    nextCode = `${prefix}${String(counter).padStart(padLen, '0')}`;
  }

  return nextCode;
};

const EMPTY_FORM = {
  project_id: '',
  site_name: '',
  site_type_id: '',
  site_status_id: '',
  is_primary: false,
  address_line1: '',
  address_line2: '',
  landmark: '',
  city: '',
  district: '',
  state_name: '',
  state_code: '',
  country_code: 'IN',
  postal_code: '',
  latitude: '',
  longitude: '',
  geofence_radius_m: '100',
  contact_name: '',
  contact_phone: '',
  site_engineer_id: '',
  supervisor_id: '',
  planned_start_date: '',
  actual_start_date: '',
  expected_end_date: '',
  actual_end_date: '',
  progress_percentage: '0',
  notes: '',
};

export function SiteCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Master / Reference data
  const [projects, setProjects] = useState([]);
  const [siteTypes, setSiteTypes] = useState([]);
  const [siteStatuses, setSiteStatuses] = useState([]);
  const [users, setUsers] = useState([]);
  const [teamRoles, setTeamRoles] = useState([]);

  // DRAFT status resolved from backend master data (never hardcoded)
  const [draftStatusId, setDraftStatusId] = useState(null);
  const [draftStatusName, setDraftStatusName] = useState('');

  // Cache of existing sites per project for fast code resolution
  const projectSitesCache = useRef({});

  // Fetch reference data on mount
  useEffect(() => {
    let isMounted = true;
    setLoadingInitial(true);

    Promise.all([
      projectsApi.list().catch(() => ({ data: { projects: [] } })),
      mastersApi.all().catch(() => ({ data: {} })),
      usersApi.list().catch(() => ({ data: { users: [] } })),
    ])
      .then(([projRes, mastersRes, usersRes]) => {
        if (!isMounted) return;

        const pList =
          projRes?.data?.projects ??
          projRes?.projects ??
          (Array.isArray(projRes?.data) ? projRes.data : Array.isArray(projRes) ? projRes : []);
        setProjects(Array.isArray(pList) ? pList : []);

        const mData = mastersRes?.data ?? mastersRes ?? {};
        const types = Array.isArray(mData.site_types) ? mData.site_types : [];
        const statuses = Array.isArray(mData.site_statuses) ? mData.site_statuses : [];
        const roles = mData.project_team_roles ?? mData.team_roles ?? [];
        setSiteTypes(types);
        setSiteStatuses(statuses);
        setTeamRoles(Array.isArray(roles) ? roles : []);

        // Resolve DRAFT status from backend master data (match by code or name, case-insensitive, fallback to first)
        const draft = statuses.find(
          (s) => (s.code || s.status_code || '').toUpperCase() === 'DRAFT' || (s.name || s.status_name || '').toUpperCase() === 'DRAFT'
        ) || statuses[0];
        if (draft) {
          setDraftStatusId(String(draft.id));
          setDraftStatusName(draft.name || draft.status_name || 'Draft');
        }

        const uList =
          usersRes?.data?.users ??
          usersRes?.users ??
          (Array.isArray(usersRes?.data) ? usersRes.data : Array.isArray(usersRes) ? usersRes : []);
        setUsers(Array.isArray(uList) ? uList : []);

        // Preselect defaults (site_status_id initially set to Draft)
        setForm((prev) => ({
          ...prev,
          site_type_id: prev.site_type_id || (types[0]?.id ? String(types[0].id) : ''),
          site_status_id: prev.site_status_id || (draft?.id ? String(draft.id) : (statuses[0]?.id ? String(statuses[0].id) : '')),
        }));
      })
      .finally(() => {
        if (isMounted) setLoadingInitial(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch and cache project sites whenever project_id changes
  const handleProjectChange = useCallback((projectId) => {
    setForm((prev) => ({ ...prev, project_id: projectId }));
    setErrors((prev) => ({ ...prev, project_id: null }));

    if (!projectId) return;

    if (!projectSitesCache.current[projectId]) {
      sitesApi
        .list({ project_id: projectId })
        .then((res) => {
          const list =
            res?.data?.sites ??
            res?.sites ??
            (Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);
          projectSitesCache.current[projectId] = Array.isArray(list) ? list : [];
        })
        .catch(() => {
          projectSitesCache.current[projectId] = [];
        });
    }
  }, []);

  const [fetchingLocation, setFetchingLocation] = useState(false);

  const handleFetchLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }

    setFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        setForm((prev) => ({
          ...prev,
          latitude: String(Number(lat.toFixed(6))),
          longitude: String(Number(lng.toFixed(6))),
        }));

        setErrors((prev) => ({
          ...prev,
          latitude: null,
          longitude: null,
        }));

        setFetchingLocation(false);
        toast.success(
          accuracy
            ? `Location detected: ${lat.toFixed(6)}, ${lng.toFixed(6)} (±${Math.round(accuracy)}m)`
            : `Location detected: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
        );
      },
      (error) => {
        setFetchingLocation(false);
        let errMsg = 'Failed to fetch location.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errMsg = 'Location permission was denied. Please allow location access in your browser.';
            break;
          case error.POSITION_UNAVAILABLE:
            errMsg = 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            errMsg = 'Location request timed out. Please try again.';
            break;
          default:
            errMsg = error.message || 'Unable to retrieve location coordinates.';
            break;
        }
        toast.error(errMsg);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const validate = () => {
    const errs = {};

    if (!String(form.project_id || '').trim()) {
      errs.project_id = 'Parent project is required.';
    }

    if (!String(form.site_name || '').trim()) {
      errs.site_name = 'Site name is required.';
    } else if (form.site_name.trim().length > 180) {
      errs.site_name = 'Site name cannot exceed 180 characters.';
    }

    if (!String(form.site_type_id || '').trim()) {
      errs.site_type_id = 'Site type is required.';
    }

    if (!String(form.site_status_id || '').trim()) {
      errs.site_status_id = 'Site status is required.';
    }

    // State Code validation (if provided, must be exactly 2 alphanumeric chars)
    if (form.state_code && form.state_code.trim()) {
      if (!/^[a-zA-Z0-9]{2}$/.test(form.state_code.trim())) {
        errs.state_code = 'State code must be exactly 2 alphanumeric characters (e.g. TN, DL).';
      }
    }

    // Latitude validation (if provided, must be -90 to 90)
    if (form.latitude !== '' && form.latitude !== null && form.latitude !== undefined) {
      const lat = Number(form.latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        errs.latitude = 'Latitude must be a valid number between -90 and 90.';
      }
    }

    // Longitude validation (if provided, must be -180 to 180)
    if (form.longitude !== '' && form.longitude !== null && form.longitude !== undefined) {
      const lng = Number(form.longitude);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        errs.longitude = 'Longitude must be a valid number between -180 and 180.';
      }
    }

    // Geofence Radius validation (if provided, must be positive number)
    if (form.geofence_radius_m !== '' && form.geofence_radius_m !== null && form.geofence_radius_m !== undefined) {
      const rad = Number(form.geofence_radius_m);
      if (isNaN(rad) || rad <= 0) {
        errs.geofence_radius_m = 'Geofence radius must be a positive number.';
      }
    }

    // Progress Percentage validation (0 to 100)
    if (form.progress_percentage !== '' && form.progress_percentage !== null) {
      const prog = Number(form.progress_percentage);
      if (isNaN(prog) || prog < 0 || prog > 100) {
        errs.progress_percentage = 'Progress percentage must be between 0 and 100.';
      }
    }

    // Date validation: Expected End Date >= Planned Start Date
    if (form.planned_start_date && form.expected_end_date) {
      if (form.expected_end_date < form.planned_start_date) {
        errs.expected_end_date = 'Expected end date cannot be earlier than planned start date.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      toast.error('Please resolve the errors highlighted below.');
      return;
    }

    setSaving(true);

    try {
      const projectId = Number(form.project_id);

      // Ensure we have the existing sites for this project to safely generate the next sequence
      let projectSites = projectSitesCache.current[form.project_id];
      if (!projectSites) {
        try {
          const res = await sitesApi.list({ project_id: projectId });
          projectSites =
            res?.data?.sites ??
            res?.sites ??
            (Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);
          projectSitesCache.current[form.project_id] = projectSites;
        } catch {
          projectSites = [];
        }
      }

      // Automatically generate project-specific site code internally
      const generatedSiteCode = generateNextSiteCode(projectSites);

      const payload = {
        project_id: projectId,
        site_code: generatedSiteCode,
        site_name: form.site_name.trim(),
        site_type_id: Number(form.site_type_id),
        site_status_id: Number(form.site_status_id || draftStatusId),
        is_primary: form.is_primary ? 1 : 0,
        address_line1: form.address_line1.trim() || null,
        address_line2: form.address_line2.trim() || null,
        landmark: form.landmark.trim() || null,
        city: form.city.trim() || null,
        district: form.district.trim() || null,
        state_name: form.state_name.trim() || null,
        state_code: form.state_code.trim() ? form.state_code.trim().toUpperCase() : null,
        country_code: form.country_code.trim() ? form.country_code.trim().toUpperCase() : 'IN',
        postal_code: form.postal_code.trim() || null,
        latitude: form.latitude !== '' && form.latitude !== null ? Number(form.latitude) : null,
        longitude: form.longitude !== '' && form.longitude !== null ? Number(form.longitude) : null,
        geofence_radius_m:
          form.geofence_radius_m !== '' && form.geofence_radius_m !== null
            ? Number(form.geofence_radius_m)
            : 100,
        contact_name: form.contact_name.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        site_engineer_id: form.site_engineer_id ? Number(form.site_engineer_id) : null,
        supervisor_id: form.supervisor_id ? Number(form.supervisor_id) : null,
        planned_start_date: form.planned_start_date || null,
        actual_start_date: form.actual_start_date || null,
        expected_end_date: form.expected_end_date || null,
        actual_end_date: form.actual_end_date || null,
        progress_percentage:
          form.progress_percentage !== '' ? Number(form.progress_percentage) : 0,
        notes: form.notes.trim() || null,
      };

      const res = await sitesApi.create(payload);
      const newSiteId = res?.data?.site?.id || res?.site?.id || res?.data?.id || res?.id;

      // Ensure Team Assignments for Engineer and Supervisor
      if (newSiteId) {
        const getRoleId = (codePattern) => {
          const role = teamRoles.find(r => 
            String(r.code || r.name || r.role_name || '').toUpperCase().includes(codePattern)
          );
          return role ? Number(role.id) : null;
        };

        const promises = [];
        
        if (form.site_engineer_id) {
          const roleId = getRoleId('ENGINEER') || 2; // Fallback to 2
          promises.push(
            sitesApi.teamMembers.create(newSiteId, {
              site_id: newSiteId,
              user_id: Number(form.site_engineer_id),
              team_role_id: roleId,
              is_primary: 1,
              can_approve: 1,
              is_active: 1
            }).catch(e => console.error('Auto-assign Engineer failed', e))
          );
        }

        if (form.supervisor_id) {
          const roleId = getRoleId('SUPERVISOR') || 3; // Fallback to 3
          promises.push(
            sitesApi.teamMembers.create(newSiteId, {
              site_id: newSiteId,
              user_id: Number(form.supervisor_id),
              team_role_id: roleId,
              is_primary: 0,
              can_approve: 0,
              is_active: 1
            }).catch(e => console.error('Auto-assign Supervisor failed', e))
          );
        }

        if (promises.length > 0) {
          try {
            await Promise.all(promises);
          } catch (teamErr) {
            toast.error('Site created successfully, but some Team Assignments could not be completed.');
          }
        }
      }

      toast.success('Site created successfully.');
      navigate('/sites');
    } catch (err) {
      if (err?.errors) {
        if (Array.isArray(err.errors)) {
          if (err.errors.length > 0) {
            setErrors({ _general: err.errors.join(', ') });
          } else {
            setErrors({ _general: err.message || 'Validation failed due to a constraint not tied to a specific field. Please check your data.' });
          }
        } else {
          // It's an object. Some fields might be hidden (e.g. site_code). 
          // Let's put a summary of all errors in _general just in case they aren't visible on the UI.
          const errorValues = Object.values(err.errors).flat();
          setErrors({
            ...err.errors,
            _general: errorValues.length > 0 ? `Validation Errors: ${errorValues.join(' | ')}` : (err.message || 'Validation failed.')
          });
        }
      } else {
        setErrors({ _general: err?.message || 'Unable to create site. Please try again.' });
      }
      toast.error(err?.message || 'Unable to create site. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Sites & Locations', href: '/sites' },
    { label: 'Site Register', href: '/sites' },
    { label: 'Create Site' },
  ];

  if (loadingInitial) {
    return (
      <PageContainer>
        <PageHeader
          title="Create Site"
          subtitle="Register a new project site and configure its location, responsible team, schedule, and operational details."
          breadcrumbs={breadcrumbs}
          actions={
            <Button variant="secondary" onClick={() => navigate('/sites')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Site Register
            </Button>
          }
        />
        <div className="flex flex-col items-center justify-center py-20 text-text-secondary gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm font-medium">Loading form configuration...</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Create Site"
        subtitle="Register a new project site and configure its location, responsible team, schedule, and operational details."
        breadcrumbs={breadcrumbs}
        actions={
          <Button variant="secondary" onClick={() => navigate('/sites')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Site Register
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="w-full space-y-5 pb-14" noValidate>
        {/* Card 1: Site Information */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border text-text-primary font-semibold text-sm">
            <Building2 className="w-4 h-4 text-primary" />
            <span>Site Information</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Project" required error={errors.project_id}>
              <Select
                options={[
                  { value: '', label: 'Select Project' },
                  ...projects.map((p) => ({
                    value: String(p.id),
                    label: p.project_name || p.name || 'Unnamed Project',
                  })),
                ]}
                value={form.project_id}
                onChange={handleProjectChange}
                disabled={saving}
              />
            </FormField>

            <FormField label="Site Name" required error={errors.site_name}>
              <Input
                value={form.site_name}
                onChange={(e) => handleChange('site_name', e.target.value)}
                placeholder="e.g. Greenfield Residency Main Site"
                disabled={saving}
              />
            </FormField>

            <FormField label="Site Type" required error={errors.site_type_id}>
              <Select
                options={[
                  { value: '', label: 'Select Site Type' },
                  ...siteTypes.map((t) => ({
                    value: String(t.id),
                    label: t.type_name || t.name || `#${t.id}`,
                  })),
                ]}
                value={form.site_type_id}
                onChange={(v) => handleChange('site_type_id', v)}
                disabled={saving}
              />
            </FormField>

            <div className="flex flex-col justify-center pt-2 md:pt-6">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.is_primary}
                  onChange={(e) => handleChange('is_primary', e.target.checked)}
                  disabled={saving}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                <span className="text-xs font-medium text-text-primary">
                  Designate as Primary Project Site
                </span>
              </label>
              <p className="text-[11px] text-text-secondary mt-1 ml-7">
                Designates this site as the main physical hub or primary location for the project.
              </p>
            </div>
          </div>
        </Card>

        {/* Card 2: Site Team (Moved next to Site Information) */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border text-text-primary font-semibold text-sm">
            <Users className="w-4 h-4 text-primary" />
            <span>Site Team</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Site Engineer" error={errors.site_engineer_id}>
              <Select
                options={[
                  { value: '', label: 'Select Site Engineer' },
                  ...users.map((u) => ({
                    value: String(u.id),
                    label: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.name || u.email || 'User',
                  })),
                ]}
                value={form.site_engineer_id}
                onChange={(v) => handleChange('site_engineer_id', v)}
                disabled={saving}
              />
            </FormField>

            <FormField label="Site Supervisor" error={errors.supervisor_id}>
              <Select
                options={[
                  { value: '', label: 'Select Site Supervisor' },
                  ...users.map((u) => ({
                    value: String(u.id),
                    label: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.name || u.email || 'User',
                  })),
                ]}
                value={form.supervisor_id}
                onChange={(v) => handleChange('supervisor_id', v)}
                disabled={saving}
              />
            </FormField>
          </div>
        </Card>

        {/* Card 3: Site Schedule (Moved next to Site Team) */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border text-text-primary font-semibold text-sm">
            <Calendar className="w-4 h-4 text-primary" />
            <span>Site Schedule</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Planned Start Date" error={errors.planned_start_date}>
              <Input
                type="date"
                value={form.planned_start_date}
                onChange={(e) => handleChange('planned_start_date', e.target.value)}
                disabled={saving}
              />
            </FormField>

            <FormField label="Expected End Date" error={errors.expected_end_date}>
              <Input
                type="date"
                value={form.expected_end_date}
                onChange={(e) => handleChange('expected_end_date', e.target.value)}
                disabled={saving}
              />
            </FormField>
          </div>
        </Card>

        {/* Card 4: Site Status & Progress (Moved next to Site Schedule with editable Initial Status dropdown) */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border text-text-primary font-semibold text-sm">
            <Activity className="w-4 h-4 text-primary" />
            <span>Site Status & Progress</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Initial Status" required error={errors.site_status_id}>
              <Select
                options={[
                  { value: '', label: 'Select Status' },
                  ...siteStatuses.map((s) => ({
                    value: String(s.id),
                    label: s.status_name || s.name || s.type_name || `#${s.id}`,
                  })),
                ]}
                value={form.site_status_id}
                onChange={(v) => handleChange('site_status_id', v)}
                disabled={saving}
              />
            </FormField>

            <FormField label="Progress Percentage (%)" error={errors.progress_percentage}>
              <Input
                type="number"
                min="0"
                max="100"
                step="1"
                value={form.progress_percentage}
                onChange={(e) => handleChange('progress_percentage', e.target.value)}
                placeholder="0"
                disabled={saving}
              />
            </FormField>
          </div>

          {errors._general && (
            <div className="mt-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errors._general}</span>
            </div>
          )}
        </Card>

        {/* Card 5: Site Location */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border text-text-primary font-semibold text-sm">
            <MapPin className="w-4 h-4 text-primary" />
            <span>Site Location</span>
          </div>

          <div className="space-y-4">
            <FormField label="Address Line 1" error={errors.address_line1}>
              <Input
                value={form.address_line1}
                onChange={(e) => handleChange('address_line1', e.target.value)}
                placeholder="Plot / Survey No., Street, Building Name"
                disabled={saving}
              />
            </FormField>

            <FormField label="Address Line 2" error={errors.address_line2}>
              <Input
                value={form.address_line2}
                onChange={(e) => handleChange('address_line2', e.target.value)}
                placeholder="Apartment, suite, unit, floor, etc. (Optional)"
                disabled={saving}
              />
            </FormField>

            <FormField label="Landmark" error={errors.landmark}>
              <Input
                value={form.landmark}
                onChange={(e) => handleChange('landmark', e.target.value)}
                placeholder="Near Highway Junction, Opposite Park, etc."
                disabled={saving}
              />
            </FormField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="City" error={errors.city}>
                <Input
                  value={form.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder="e.g. Chennai"
                  disabled={saving}
                />
              </FormField>

              <FormField label="District" error={errors.district}>
                <Input
                  value={form.district}
                  onChange={(e) => handleChange('district', e.target.value)}
                  placeholder="e.g. Coimbatore"
                  disabled={saving}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="State" error={errors.state_name}>
                <Input
                  value={form.state_name}
                  onChange={(e) => handleChange('state_name', e.target.value)}
                  placeholder="e.g. Tamil Nadu"
                  disabled={saving}
                />
              </FormField>

              <FormField label="State Code" error={errors.state_code}>
                <Input
                  value={form.state_code}
                  onChange={(e) => handleChange('state_code', e.target.value.toUpperCase())}
                  placeholder="e.g. TN"
                  maxLength={2}
                  disabled={saving}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Country" error={errors.country_code}>
                <Input
                  value={form.country_code}
                  onChange={(e) => handleChange('country_code', e.target.value.toUpperCase())}
                  placeholder="IN"
                  maxLength={2}
                  disabled={saving}
                />
              </FormField>

              <FormField label="Postal Code" error={errors.postal_code}>
                <Input
                  value={form.postal_code}
                  onChange={(e) => handleChange('postal_code', e.target.value)}
                  placeholder="e.g. 600001"
                  disabled={saving}
                />
              </FormField>
            </div>
          </div>
        </Card>

        {/* Card 6: Geo Location */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
            <div className="flex items-center gap-2 text-text-primary font-semibold text-sm">
              <Compass className="w-4 h-4 text-primary" />
              <span>Geo Location</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleFetchLocation}
              disabled={fetchingLocation || saving}
              className="text-xs flex items-center gap-1.5 h-8 px-3 text-primary border-primary/30 hover:bg-primary/5 transition-colors cursor-pointer"
            >
              {fetchingLocation ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  <span>Fetching Location...</span>
                </>
              ) : (
                <>
                  <LocateFixed className="w-3.5 h-3.5 text-primary" />
                  <span>Fetch Current Location</span>
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Latitude" error={errors.latitude}>
              <Input
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) => handleChange('latitude', e.target.value)}
                placeholder="e.g. 11.0168"
                disabled={saving}
              />
            </FormField>

            <FormField label="Longitude" error={errors.longitude}>
              <Input
                type="number"
                step="any"
                value={form.longitude}
                onChange={(e) => handleChange('longitude', e.target.value)}
                placeholder="e.g. 76.9558"
                disabled={saving}
              />
            </FormField>

            <FormField label="Geofence Radius (m)" error={errors.geofence_radius_m}>
              <Input
                type="number"
                min="1"
                value={form.geofence_radius_m}
                onChange={(e) => handleChange('geofence_radius_m', e.target.value)}
                placeholder="100"
                disabled={saving}
              />
            </FormField>
          </div>
        </Card>

        {/* Card 7: Site Contact */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border text-text-primary font-semibold text-sm">
            <Phone className="w-4 h-4 text-primary" />
            <span>Site Contact</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Contact Name" error={errors.contact_name}>
              <Input
                value={form.contact_name}
                onChange={(e) => handleChange('contact_name', e.target.value)}
                placeholder="e.g. Rajesh Kumar"
                disabled={saving}
              />
            </FormField>

            <FormField label="Contact Phone" error={errors.contact_phone}>
              <Input
                type="tel"
                value={form.contact_phone}
                onChange={(e) => handleChange('contact_phone', e.target.value)}
                placeholder="e.g. +91 98765 43210"
                disabled={saving}
              />
            </FormField>
          </div>
        </Card>

        {/* Card 8: Additional Information */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border text-text-primary font-semibold text-sm">
            <FileText className="w-4 h-4 text-primary" />
            <span>Additional Information</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <FormField label="Notes" error={errors.notes}>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Enter any additional site instructions, operational notes, or remarks..."
                disabled={saving}
              />
            </FormField>
          </div>
        </Card>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/sites')}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            leftIcon={saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Site'}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
