import { useEffect, useState } from 'react';
import { X, MapPin, Users, Grid3x3, MapPinned, Plus, Trash2, Edit } from 'lucide-react';
import { sitesApi, siteZonesApi, workLocationsApi } from '../../../api/apiservice';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { FormField } from '../../../components/composite/FormField';
import { toast } from '../../../components/composite/Toast';

function TabButton({ active, onClick, icon: Icon, label, shortLabel, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1 sm:gap-2 px-1 sm:px-4 py-2.5 sm:py-3 text-[11px] sm:text-[13px] font-medium border-b-2 transition-colors -mb-px relative z-10 w-full text-center ${
        active
          ? 'border-primary text-primary font-semibold'
          : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
      }`}
    >
      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
      <span className="truncate">
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{shortLabel || label}</span>
      </span>
      {count !== undefined && (
        <span className="ml-1 bg-surface-muted text-text-secondary text-[10px] font-bold px-1.5 py-0.5 rounded-full">{count}</span>
      )}
    </button>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">{label}</span>
      <span className="text-[13px] text-text-primary break-words">{value || '—'}</span>
    </div>
  );
}

function TeamMembersTab({ siteId }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!siteId) return;
    setLoading(true);
    sitesApi.teamMembers.list(siteId)
      .then((res) => setMembers(res?.data?.team_members ?? res?.data?.data ?? res?.team_members ?? []))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, [siteId]);

  if (loading) return <div className="py-8 text-center text-text-muted text-[12px]">Loading team members...</div>;
  if (members.length === 0) return <div className="py-8 text-center text-text-muted text-[12px]">No team members assigned to this site.</div>;

  return (
    <div className="w-full">
      <table className="w-full text-left text-[11px] sm:text-[12px]">
        <thead className="bg-surface-muted text-text-secondary text-[10px] sm:text-[11px] uppercase font-semibold border-b border-border tracking-wider">
          <tr>
            <th className="px-2 sm:px-3 py-2 w-7 sm:w-10">#</th>
            <th className="px-2 sm:px-3 py-2">Name</th>
            <th className="px-2 sm:px-3 py-2">Role</th>
            <th className="px-2 sm:px-3 py-2 text-right sm:text-left">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {members.map((m, i) => (
            <tr key={m.id || i} className="hover:bg-surface-muted/30">
              <td className="px-2 sm:px-3 py-1.5 text-text-secondary">{i + 1}</td>
              <td className="px-2 sm:px-3 py-1.5 text-text-primary font-medium truncate max-w-[110px] sm:max-w-none">
                {m.first_name || m.user_name || '—'} {m.last_name || ''}
              </td>
              <td className="px-2 sm:px-3 py-1.5 text-text-secondary truncate max-w-[80px] sm:max-w-none">
                {m.role_name || m.team_role_name || m.role || '—'}
              </td>
              <td className="px-2 sm:px-3 py-1.5 text-right sm:text-left">
                <Badge variant={m.is_active ? 'success' : 'neutral'} className="text-[8px] px-1.5 py-0.5">
                  {m.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WorkZonesTab({ siteId }) {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!siteId) return;
    setLoading(true);
    siteZonesApi.list({ site_id: siteId })
      .then((res) => setZones(res?.data?.zones ?? res?.data?.data ?? res?.zones ?? []))
      .catch(() => setZones([]))
      .finally(() => setLoading(false));
  }, [siteId]);

  if (loading) return <div className="py-8 text-center text-text-muted text-[12px]">Loading work zones...</div>;
  if (zones.length === 0) return <div className="py-8 text-center text-text-muted text-[12px]">No work zones defined for this site.</div>;

  return (
    <div className="w-full">
      {/* Mobile view - clean fixed list without horizontal scroll */}
      <div className="sm:hidden divide-y divide-border">
        {zones.map((z, i) => (
          <div key={z.id || i} className="py-2.5 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-text-primary text-[11px]">{z.zone_code || '—'}</span>
                <span className="text-text-secondary text-[11px]">·</span>
                <span className="text-[11px] text-text-secondary truncate">{z.zone_type_name || z.zone_type || z.type_name || '—'}</span>
              </div>
              <p className="text-[12px] font-medium text-text-primary truncate mt-0.5">{z.zone_name || z.name || '—'}</p>
            </div>
            <Badge variant={z.is_active ? 'success' : 'neutral'} className="text-[8px] shrink-0">
              {z.status_name || (z.is_active ? 'Active' : 'Inactive')}
            </Badge>
          </div>
        ))}
      </div>

      {/* Desktop view */}
      <div className="hidden sm:block overflow-x-auto min-w-full">
        <table className="w-full text-left text-[12px]">
          <thead className="bg-surface-muted text-text-secondary text-[11px] uppercase font-semibold border-b border-border tracking-wider">
            <tr>
              <th className="px-3 py-2 w-10">#</th>
              <th className="px-3 py-2">Zone Code</th>
              <th className="px-3 py-2">Zone Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {zones.map((z, i) => (
              <tr key={z.id || i} className="hover:bg-surface-muted/30">
                <td className="px-3 py-1.5 text-text-primary">{i + 1}</td>
                <td className="px-3 py-1.5 font-mono font-semibold text-text-primary text-[11px]">{z.zone_code || '—'}</td>
                <td className="px-3 py-1.5 text-text-primary font-medium">{z.zone_name || z.name || '—'}</td>
                <td className="px-3 py-1.5 text-text-secondary">{z.zone_type_name || z.zone_type || z.type_name || '—'}</td>
                <td className="px-3 py-1.5"><Badge variant={z.is_active ? 'success' : 'neutral'} className="text-[8px]">{z.status_name || (z.is_active ? 'Active' : 'Inactive')}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WorkLocationsTab({ siteId }) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!siteId) return;
    setLoading(true);
    workLocationsApi.list({ site_id: siteId })
      .then((res) => setLocations(res?.data?.work_locations ?? res?.data?.data ?? res?.work_locations ?? []))
      .catch(() => setLocations([]))
      .finally(() => setLoading(false));
  }, [siteId]);

  if (loading) return <div className="py-8 text-center text-text-muted text-[12px]">Loading work locations...</div>;
  if (locations.length === 0) return <div className="py-8 text-center text-text-muted text-[12px]">No work locations defined for this site.</div>;

  return (
    <div className="w-full">
      {/* Mobile view - clean fixed list without horizontal scroll */}
      <div className="sm:hidden divide-y divide-border">
        {locations.map((loc, i) => (
          <div key={loc.id || i} className="py-2.5 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-text-primary text-[11px]">{loc.location_code || '—'}</span>
                <span className="text-text-secondary text-[11px]">·</span>
                <span className="text-[11px] text-text-secondary truncate">{loc.location_type_name || loc.location_type || loc.type_name || '—'}</span>
              </div>
              <p className="text-[12px] font-medium text-text-primary truncate mt-0.5">{loc.location_name || loc.name || '—'}</p>
            </div>
            <Badge variant={loc.is_active ? 'success' : 'neutral'} className="text-[8px] shrink-0">
              {loc.status_name || (loc.is_active ? 'Active' : 'Inactive')}
            </Badge>
          </div>
        ))}
      </div>

      {/* Desktop view */}
      <div className="hidden sm:block overflow-x-auto min-w-full">
        <table className="w-full text-left text-[12px]">
          <thead className="bg-surface-muted text-text-secondary text-[11px] uppercase font-semibold border-b border-border tracking-wider">
            <tr>
              <th className="px-3 py-2 w-10">#</th>
              <th className="px-3 py-2">Location Code</th>
              <th className="px-3 py-2">Location Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {locations.map((loc, i) => (
              <tr key={loc.id || i} className="hover:bg-surface-muted/30">
                <td className="px-3 py-1.5 text-text-primary">{i + 1}</td>
                <td className="px-3 py-1.5 font-mono font-semibold text-text-primary text-[11px]">{loc.location_code || '—'}</td>
                <td className="px-3 py-1.5 text-text-primary font-medium">{loc.location_name || loc.name || '—'}</td>
                <td className="px-3 py-1.5 text-text-secondary">{loc.location_type_name || loc.location_type || loc.type_name || '—'}</td>
                <td className="px-3 py-1.5"><Badge variant={loc.is_active ? 'success' : 'neutral'} className="text-[8px]">{loc.status_name || (loc.is_active ? 'Active' : 'Inactive')}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SiteDetailModal({ isOpen, site, onClose, onEdit, onDelete }) {
  const [activeTab, setActiveTab] = useState('details');

  if (!isOpen || !site) return null;

  const status = site.status_name || site.status || 'Draft';
  const getStatusVariant = (s) => {
    const v = String(s).toLowerCase();
    if (v.includes('active') || v.includes('progress')) return 'success';
    if (v.includes('hold') || v.includes('pending')) return 'warning';
    if (v.includes('complete')) return 'info';
    return 'neutral';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6">
      <div className="bg-surface border border-border rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-3.5 sm:px-6 py-3.5 sm:py-5 border-b border-border bg-surface-muted/30 shrink-0">
          <div className="flex gap-2.5 sm:gap-4 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md bg-primary/10 flex items-center justify-center text-primary flex-shrink-0 mt-0.5">
              <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="flex flex-col gap-0.5 sm:gap-1 min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-text-primary leading-snug truncate">{site.site_name || site.name}</h2>
                <Badge variant={getStatusVariant(status)} className="text-[8px] font-bold uppercase shrink-0">{status}</Badge>
              </div>
              <p className="text-[11px] sm:text-xs text-text-secondary leading-tight truncate">{site.site_code || site.code} · {site.project_name || 'No project'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(site)}
                className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-muted rounded-md transition-colors"
                title="Edit Site Details"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(site)}
                className="p-1.5 text-text-secondary hover:text-error hover:bg-error/10 rounded-md transition-colors"
                title="Delete Site"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-muted rounded-md transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs - Fixed width 4-column layout, no horizontal scroll */}
        <div className="border-b border-border bg-surface px-1 sm:px-6">
          <div className="grid grid-cols-4 -mb-px w-full">
            <TabButton active={activeTab === 'details'} onClick={() => setActiveTab('details')} icon={MapPin} label="Details" shortLabel="Details" />
            <TabButton active={activeTab === 'team'} onClick={() => setActiveTab('team')} icon={Users} label="Team" shortLabel="Team" />
            <TabButton active={activeTab === 'zones'} onClick={() => setActiveTab('zones')} icon={Grid3x3} label="Work Zones" shortLabel="Zones" />
            <TabButton active={activeTab === 'locations'} onClick={() => setActiveTab('locations')} icon={MapPinned} label="Locations" shortLabel="Locations" />
          </div>
        </div>

        {/* Body - Prevent horizontal scroll */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 sm:p-6">
          {activeTab === 'details' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 sm:gap-x-8 gap-y-3.5 sm:gap-y-4">
              <DetailRow label="Site Code" value={site.site_code || site.code} />
              <DetailRow label="Site Name" value={site.site_name || site.name} />
              <DetailRow label="Project" value={site.project_name || site.project} />
              <DetailRow label="Site Type" value={site.site_type_name || site.type_name || site.site_type} />
              <DetailRow label="Branch" value={site.branch_name} />
              <DetailRow label="Status" value={status} />
              <DetailRow label="Address" value={[site.address_line1, site.address_line2].filter(Boolean).join(', ') || site.address} />
              <DetailRow label="City" value={site.city} />
              <DetailRow label="State" value={site.state_name || site.state} />
              <DetailRow label="Pincode" value={site.postal_code || site.pincode} />
              <DetailRow label="Start Date" value={(site.planned_start_date || site.start_date) ? String(site.planned_start_date || site.start_date).split(' ')[0] : null} />
              <DetailRow label="Expected Completion" value={(site.expected_end_date || site.expected_completion_date) ? String(site.expected_end_date || site.expected_completion_date).split(' ')[0] : null} />
              {site.description && <div className="col-span-full"><DetailRow label="Description" value={site.description} /></div>}
            </div>
          )}
          {activeTab === 'team' && <TeamMembersTab siteId={site.id} />}
          {activeTab === 'zones' && <WorkZonesTab siteId={site.id} />}
          {activeTab === 'locations' && <WorkLocationsTab siteId={site.id} />}
        </div>
      </div>
    </div>
  );
}
