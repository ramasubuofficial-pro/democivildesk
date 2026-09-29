import { useEffect, useState } from 'react';
import { MapPin, Building2, User, Calendar, CheckSquare } from 'lucide-react';
import { sitesApi, projectsApi, mastersApi, usersApi } from '../../../api/apiservice';
import { EntityEditModal } from '../../../components/composite/EntityEditModal';
import { FormField } from '../../../components/composite/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { toast } from '../../../components/composite/Toast';

const EMPTY_FORM = {
  project_id: '',
  site_code: '',
  site_name: '',
  site_type_id: '',
  site_status_id: '',
  address_line1: '',
  address_line2: '',
  landmark: '',
  city: '',
  district: '',
  state_name: '',
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
  is_primary: false,
  notes: '',
};

export function SiteFormModal({ isOpen, site = null, onClose, onSaveSuccess }) {
  const isEditing = Boolean(site?.id);
  const [form, setForm] = useState(EMPTY_FORM);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [teamRoles, setTeamRoles] = useState([]);
  const [masters, setMasters] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (site) {
      setForm({
        ...EMPTY_FORM,
        project_id: String(site.project_id ?? ''),
        site_code: site.site_code || '',
        site_name: site.site_name || '',
        site_type_id: String(site.site_type_id ?? '1'),
        site_status_id: String(site.site_status_id ?? '1'),
        address_line1: site.address_line1 || site.address || '',
        address_line2: site.address_line2 || '',
        landmark: site.landmark || '',
        city: site.city || '',
        district: site.district || '',
        state_name: site.state_name || site.state || '',
        postal_code: site.postal_code || site.pincode || '',
        latitude: site.latitude !== undefined && site.latitude !== null ? String(site.latitude) : '',
        longitude: site.longitude !== undefined && site.longitude !== null ? String(site.longitude) : '',
        geofence_radius_m: site.geofence_radius_m ? String(site.geofence_radius_m) : '100',
        contact_name: site.contact_name || '',
        contact_phone: site.contact_phone || '',
        site_engineer_id: String(site.site_engineer_id ?? ''),
        supervisor_id: String(site.supervisor_id ?? ''),
        planned_start_date: site.planned_start_date ? site.planned_start_date.split(' ')[0] : (site.start_date ? site.start_date.split(' ')[0] : ''),
        actual_start_date: site.actual_start_date ? site.actual_start_date.split(' ')[0] : '',
        expected_end_date: site.expected_end_date ? site.expected_end_date.split(' ')[0] : (site.expected_completion_date ? site.expected_completion_date.split(' ')[0] : ''),
        actual_end_date: site.actual_end_date ? site.actual_end_date.split(' ')[0] : '',
        progress_percentage: String(site.progress_percentage ?? 0),
        is_primary: Boolean(site.is_primary),
        notes: site.notes || site.description || '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});

    Promise.all([
      mastersApi.all().catch(() => ({ data: {} })),
      projectsApi.list().catch(() => ({ data: { projects: [] } })),
      usersApi.list().catch(() => ({ data: { users: [] } })),
    ]).then(([masterRes, projRes, userRes]) => {
      setMasters(masterRes?.data ?? masterRes ?? {});
      const pList = projRes?.data?.projects ?? projRes?.projects ?? (Array.isArray(projRes?.data) ? projRes.data : []);
      const uList = userRes?.data?.users ?? userRes?.users ?? (Array.isArray(userRes?.data) ? userRes.data : []);
      const roles = masterRes?.data?.project_team_roles ?? masterRes?.data?.team_roles ?? [];
      setProjects(Array.isArray(pList) ? pList : []);
      setUsers(Array.isArray(uList) ? uList : []);
      setTeamRoles(Array.isArray(roles) ? roles : []);

      if (!site && pList.length > 0) {
        setForm(f => {
          const draftStatus = masterRes?.data?.site_statuses?.find(s => (s.code || s.status_code || '').toUpperCase() === 'DRAFT');
          return {
            ...f,
            project_id: String(pList[0].id),
            site_code: `SITE-0${Math.floor(Math.random() * 90 + 10)}`,
            site_type_id: masterRes?.data?.site_types?.[0]?.id ? String(masterRes.data.site_types[0].id) : '',
            site_status_id: draftStatus ? String(draftStatus.id) : '',
          };
        });
      }
    });
  }, [isOpen, site]);

  const change = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: null }));
  };

  const validate = () => {
    const next = {};
    if (!String(form.site_name ?? '').trim()) next.site_name = 'Site name is required.';
    if (!String(form.project_id ?? '').trim()) next.project_id = 'Project is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const nullableNumber = (value) => (value === '' || value === null || value === undefined ? null : Number(value));
      const autoCode = String(form.site_code ?? '').trim() || `SITE-0${Math.floor(Math.random() * 90 + 10)}`;
      const payload = {
        project_id: Number(form.project_id),
        site_code: autoCode,
        site_name: form.site_name.trim(),
        site_type_id: nullableNumber(form.site_type_id),
        site_status_id: nullableNumber(form.site_status_id),
        address_line1: form.address_line1 || null,
        address_line2: form.address_line2 || null,
        landmark: form.landmark || null,
        city: form.city || null,
        district: form.district || null,
        state_name: form.state_name || null,
        country_code: 'IN',
        postal_code: form.postal_code || null,
        latitude: form.latitude !== '' && form.latitude != null ? Number(form.latitude) : null,
        longitude: form.longitude !== '' && form.longitude != null ? Number(form.longitude) : null,
        geofence_radius_m: form.geofence_radius_m ? Number(form.geofence_radius_m) : 100,
        contact_name: form.contact_name || null,
        contact_phone: form.contact_phone || null,
        site_engineer_id: nullableNumber(form.site_engineer_id),
        supervisor_id: nullableNumber(form.supervisor_id),
        planned_start_date: form.planned_start_date || null,
        actual_start_date: form.actual_start_date || null,
        expected_end_date: form.expected_end_date || null,
        actual_end_date: form.actual_end_date || null,
        progress_percentage: Number(form.progress_percentage || 0),
        is_primary: form.is_primary ? 1 : 0,
        notes: form.notes || null,
      };

      let finalSiteId = null;

      if (isEditing) {
        await sitesApi.update(site.id, payload);
        finalSiteId = site.id;
        
        // The backend explicitly unsets site_status_id in the update method.
        // If the user changed the status, we must call the change-status API.
        if (String(site.site_status_id) !== String(payload.site_status_id)) {
          await sitesApi.changeStatus(site.id, {
            site_status_id: payload.site_status_id,
            change_reason: 'Status updated via Site Register form'
          });
        }
        
        toast.success('Site updated successfully.');
      } else {
        const res = await sitesApi.create(payload);
        finalSiteId = res?.data?.site?.id || res?.site?.id || res?.data?.id || res?.id;
        toast.success('Site created successfully.');
      }

      // Ensure Team Assignments for Engineer and Supervisor
      if (finalSiteId) {
        const getRoleId = (codePattern) => {
          const role = teamRoles.find(r => 
            String(r.code || r.name || r.role_name || '').toUpperCase().includes(codePattern)
          );
          return role ? Number(role.id) : null;
        };

        try {
          const teamRes = await sitesApi.teamMembers.list(finalSiteId);
          const existingTeam = teamRes?.data?.team_members ?? teamRes?.data?.data ?? teamRes?.team_members ?? [];
          
          const promises = [];
          
          if (form.site_engineer_id) {
            const roleId = getRoleId('ENGINEER') || 2;
            const exists = existingTeam.some(m => 
              String(m.user_id) === String(form.site_engineer_id) && String(m.team_role_id) === String(roleId)
            );
            if (!exists) {
              promises.push(
                sitesApi.teamMembers.create(finalSiteId, {
                  site_id: finalSiteId,
                  user_id: Number(form.site_engineer_id),
                  team_role_id: roleId,
                  is_primary: 1,
                  can_approve: 1,
                  is_active: 1
                }).catch(e => console.error('Auto-assign Engineer failed', e))
              );
            }
          }

          if (form.supervisor_id) {
            const roleId = getRoleId('SUPERVISOR') || 3;
            const exists = existingTeam.some(m => 
              String(m.user_id) === String(form.supervisor_id) && String(m.team_role_id) === String(roleId)
            );
            if (!exists) {
              promises.push(
                sitesApi.teamMembers.create(finalSiteId, {
                  site_id: finalSiteId,
                  user_id: Number(form.supervisor_id),
                  team_role_id: roleId,
                  is_primary: 0,
                  can_approve: 0,
                  is_active: 1
                }).catch(e => console.error('Auto-assign Supervisor failed', e))
              );
            }
          }

          if (promises.length > 0) {
            await Promise.all(promises);
          }
        } catch (teamErr) {
          toast.error('Site saved, but some Team Assignments could not be completed.');
        }
      }

      onSaveSuccess?.();
      onClose();
    } catch (error) {
      setErrors(error?.errors ?? {});
      toast.error(error?.message || 'Unable to save site record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <EntityEditModal isOpen={isOpen} onClose={onClose}>
      <EntityEditModal.Header
        icon={MapPin}
        title={isEditing ? 'Edit Site Register' : 'Add New Project Site'}
        subtitle="Manage physical job site boundaries, engineer allocations, and timeline."
        onClose={onClose}
      />

      <form id="site-form" onSubmit={submit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <EntityEditModal.Body>
          <EntityEditModal.Section title="General Site Identification">
            <EntityEditModal.Grid>
              <FormField label="Parent Project" required error={errors.project_id}>
                <Select
                  options={projects.map(p => ({ value: String(p.id), label: p.project_name || p.name }))}
                  value={form.project_id}
                  onChange={(v) => change('project_id', v)}
                />
              </FormField>

              <FormField label="Site Name" required className="md:col-span-2" error={errors.site_name}>
                <Input
                  value={form.site_name}
                  onChange={(e) => change('site_name', e.target.value)}
                  placeholder="e.g. Tower A Foundation & Main Plot"
                />
              </FormField>

              <FormField label="Site Type" required error={errors.site_type_id}>
                <Select
                  options={(masters.site_types || []).map(t => ({
                    value: String(t.id),
                    label: t.type_name || t.name
                  }))}
                  value={form.site_type_id}
                  onChange={(v) => change('site_type_id', v)}
                />
              </FormField>

              <FormField label="Site Status" required error={errors.site_status_id}>
                <Select
                  options={(masters.site_statuses || []).map(s => ({
                    value: String(s.id),
                    label: s.status_name || s.name
                  }))}
                  value={form.site_status_id}
                  onChange={(v) => change('site_status_id', v)}
                />
              </FormField>
            </EntityEditModal.Grid>
          </EntityEditModal.Section>

          <EntityEditModal.Section title="Location & Address">
            <EntityEditModal.Grid>
              <FormField label="Address Line 1" className="md:col-span-2" error={errors.address_line1}>
                <Input
                  value={form.address_line1}
                  onChange={(e) => change('address_line1', e.target.value)}
                  placeholder="Plot / Survey No., Street"
                />
              </FormField>

              <FormField label="Landmark" error={errors.landmark}>
                <Input
                  value={form.landmark}
                  onChange={(e) => change('landmark', e.target.value)}
                  placeholder="Near Highway Bypass"
                />
              </FormField>

              <FormField label="City / Town" error={errors.city}>
                <Input
                  value={form.city}
                  onChange={(e) => change('city', e.target.value)}
                  placeholder="e.g. Chennai"
                />
              </FormField>

              <FormField label="State" error={errors.state_name}>
                <Input
                  value={form.state_name}
                  onChange={(e) => change('state_name', e.target.value)}
                  placeholder="e.g. Tamil Nadu"
                />
              </FormField>

              <FormField label="Postal Code / PIN" error={errors.postal_code}>
                <Input
                  value={form.postal_code}
                  onChange={(e) => change('postal_code', e.target.value)}
                  placeholder="600001"
                />
              </FormField>
              
              <FormField label="Latitude" error={errors.latitude}>
                <Input
                  type="number"
                  step="any"
                  value={form.latitude}
                  onChange={(e) => change('latitude', e.target.value)}
                  placeholder="11.0308"
                />
              </FormField>

              <FormField label="Longitude" error={errors.longitude}>
                <Input
                  type="number"
                  step="any"
                  value={form.longitude}
                  onChange={(e) => change('longitude', e.target.value)}
                  placeholder="77.0399"
                />
              </FormField>
            </EntityEditModal.Grid>
          </EntityEditModal.Section>

          <EntityEditModal.Section title="Personnel & Schedule">
            <EntityEditModal.Grid>
              <FormField label="Site Engineer Incharge" error={errors.site_engineer_id}>
                <Select
                  options={[
                    { value: '', label: 'Select Site Engineer' },
                    ...users.map(u => ({ value: String(u.id), label: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.name || u.email || 'User' }))
                  ]}
                  value={form.site_engineer_id}
                  onChange={(v) => change('site_engineer_id', v)}
                />
              </FormField>

              <FormField label="Site Supervisor" error={errors.supervisor_id}>
                <Select
                  options={[
                    { value: '', label: 'Select Supervisor' },
                    ...users.map(u => ({ value: String(u.id), label: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.name || u.email || 'User' }))
                  ]}
                  value={form.supervisor_id}
                  onChange={(v) => change('supervisor_id', v)}
                />
              </FormField>

              <FormField label="Planned Start Date" error={errors.planned_start_date}>
                <Input
                  type="date"
                  value={form.planned_start_date}
                  onChange={(e) => change('planned_start_date', e.target.value)}
                />
              </FormField>

              <FormField label="Expected End Date" error={errors.expected_end_date}>
                <Input
                  type="date"
                  value={form.expected_end_date}
                  onChange={(e) => change('expected_end_date', e.target.value)}
                />
              </FormField>

              <div className="md:col-span-2 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-text-primary">
                  <input
                    type="checkbox"
                    checked={form.is_primary}
                    onChange={(e) => change('is_primary', e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                  />
                  <span>Designate as Primary Project Site</span>
                </label>
              </div>

              <FormField label="Site Notes & Scope" className="md:col-span-2" error={errors.notes}>
                <Textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => change('notes', e.target.value)}
                  placeholder="Special instructions, perimeter boundary notes..."
                />
              </FormField>
            </EntityEditModal.Grid>
          </EntityEditModal.Section>
        </EntityEditModal.Body>

        <EntityEditModal.Footer
          formId="site-form"
          submitLabel={isEditing ? 'Update Site' : 'Register Site'}
          onCancel={onClose}
          isSubmitting={saving}
        />
      </form>
    </EntityEditModal>
  );
}
