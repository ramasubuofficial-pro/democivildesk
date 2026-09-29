const fs = require('fs');
let code = fs.readFileSync('src/features/sites/pages/SiteEditPage.jsx', 'utf8');

// 1. Rename component and add useParams
code = code.replace(
  "import { useNavigate } from 'react-router-dom';",
  "import { useNavigate, useParams } from 'react-router-dom';"
);
code = code.replace("export function SiteCreatePage() {", "export function SiteEditPage() {\n  const { id } = useParams();");

// 2. Fetch data
code = code.replace(
  "        // Preselect defaults if available (status is auto-assigned, not user-selectable)",
  `        // Preselect defaults if available
        if (!id) {
          setForm((prev) => ({
            ...prev,
            site_type_id: prev.site_type_id || (types[0]?.id ? String(types[0].id) : ''),
          }));
        } else {
          sitesApi.get(id).then(res => {
            const data = res.data || res;
            setForm({
              project_id: data.project_id ? String(data.project_id) : '',
              site_code: data.site_code || '',
              site_name: data.site_name || '',
              site_type_id: data.site_type_id ? String(data.site_type_id) : '',
              site_status_id: data.site_status_id ? String(data.site_status_id) : '',
              address_line1: data.address_line1 || '',
              address_line2: data.address_line2 || '',
              landmark: data.landmark || '',
              city: data.city || '',
              state_code: data.state_code || '',
              pincode: data.pincode || '',
              latitude: data.latitude ? String(data.latitude) : '',
              longitude: data.longitude ? String(data.longitude) : '',
              geofence_radius_m: data.geofence_radius_m ? String(data.geofence_radius_m) : '',
              planned_start_date: data.planned_start_date ? data.planned_start_date.split(' ')[0] : '',
              planned_end_date: data.planned_end_date ? data.planned_end_date.split(' ')[0] : '',
              actual_start_date: data.actual_start_date ? data.actual_start_date.split(' ')[0] : '',
              actual_end_date: data.actual_end_date ? data.actual_end_date.split(' ')[0] : '',
              budget_allocation: data.budget_allocation ? String(data.budget_allocation) : '',
              engineer_in_charge_id: data.engineer_in_charge_id ? String(data.engineer_in_charge_id) : '',
              contact_phone: data.contact_phone || '',
              description: data.description || '',
            });
          }).catch(err => {
             console.error(err);
          });
        }`
);

// 3. Update validate method to check site_status_id instead of draftStatusId
code = code.replace(
  `    if (!draftStatusId) {\n      errs._general = 'Unable to resolve DRAFT status from master data. Cannot create site.';\n    }`,
  `    if (!String(form.site_status_id || '').trim()) {\n      errs.site_status_id = 'Site status is required.';\n    }`
);

// 4. Update save handler to use sitesApi.update
code = code.replace(
  "        site_status_id: Number(draftStatusId),",
  "        site_status_id: Number(form.site_status_id),"
);
code = code.replace(
  "      const res = await sitesApi.create(payload);",
  "      const res = await sitesApi.update(id, payload);"
);
code = code.replace(
  "toast.success(`Site ${res?.data?.site_code || payload.site_code} registered successfully.`);",
  "toast.success(`Site ${payload.site_code} updated successfully.`);"
);
code = code.replace(
  "        toast.success('Site registered successfully (local fallback).');",
  "        toast.success('Site updated successfully (local fallback).');"
);

// 5. Update UI text and disable site_code
code = code.replace(
  '        title="Create Site Register"',
  '        title="Edit Site Register"'
);
code = code.replace(
  '          Create a new operational site bound to a specific project. This site will act as a container for all subsequent work zones, BOQ entries, and labour records.',
  '          Manage physical job site boundaries, engineer allocations, and timeline.'
);

// We need to inject the status field back into the form. Find Site Type and put Status next to it.
code = code.replace(
  `            <FormField label="Site Type" required error={errors.site_type_id}>\n              <Select\n                options={[\n                  { value: '', label: 'Select Site Type' },\n                  ...siteTypes.map((t) => ({\n                    value: String(t.id),\n                    label: t.name || t.type_name || \`Type #\${t.id}\`,\n                  })),\n                ]}\n                value={form.site_type_id}\n                onChange={(v) => handleChange('site_type_id', v)}\n              />\n            </FormField>\n\n            {/* Auto-Assigned Status Indicator */}\n            <div className="flex flex-col gap-1.5 justify-end">\n              <label className="text-sm font-medium text-muted-foreground">\n                Initial Status\n              </label>\n              <div className="flex items-center gap-2 h-10 px-3 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-600 font-medium">\n                <span className="w-2 h-2 rounded-full bg-slate-400" />\n                {draftStatusName || 'DRAFT'}\n                <span className="text-xs text-slate-400 font-normal ml-auto">(Auto-assigned)</span>\n              </div>\n            </div>`,
  `            <FormField label="Site Type" required error={errors.site_type_id}>
              <Select
                options={[
                  { value: '', label: 'Select Site Type' },
                  ...siteTypes.map((t) => ({
                    value: String(t.id),
                    label: t.name || t.type_name || \`Type #\${t.id}\`,
                  })),
                ]}
                value={form.site_type_id}
                onChange={(v) => handleChange('site_type_id', v)}
              />
            </FormField>

            <FormField label="Site Status" required error={errors.site_status_id}>
              <Select
                options={[
                  { value: '', label: 'Select Status' },
                  ...siteStatuses.map((t) => ({
                    value: String(t.id),
                    label: t.name || t.status_name || \`Status #\${t.id}\`,
                  })),
                ]}
                value={form.site_status_id}
                onChange={(v) => handleChange('site_status_id', v)}
              />
            </FormField>`
);

code = code.replace(
  `            <FormField label="Site Code" required error={errors.site_code}>\n              <Input\n                placeholder="e.g. SITE-01"\n                value={form.site_code}\n                onChange={(e) => handleChange('site_code', e.target.value)}\n              />\n            </FormField>`,
  `            <FormField label="Site Code" required error={errors.site_code}>\n              <Input\n                placeholder="e.g. SITE-01"\n                value={form.site_code}\n                onChange={(e) => handleChange('site_code', e.target.value)}\n                disabled\n              />\n            </FormField>`
);

code = code.replace(
  '                  Create Site',
  '                  Update Site'
);
code = code.replace(
  "        { label: 'Register New Site' }",
  "        { label: 'Edit Site' }"
);

fs.writeFileSync('src/features/sites/pages/SiteEditPage.jsx', code);
console.log('Done modifying SiteEditPage.jsx');
