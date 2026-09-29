import { useState, useEffect } from 'react';
import { Eye, Edit, Trash2, MapPin, Building2, User, Calendar } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { DataTableContainer } from '../../../components/composite/DataTableContainer';
import { Pagination } from '../../../components/composite/Pagination';
import { ConfirmDialog } from '../../../components/composite/ConfirmDialog';
import { toast } from '../../../components/composite/Toast';
import { sitesApi } from '../../../api/apiservice';

function extractList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.sites)) return response.sites;
  if (Array.isArray(response.data?.sites)) return response.data.sites;
  if (Array.isArray(response.data?.data)) return response.data.data;
  return [];
}

const getStatusVariant = (status) => {
  const s = String(status || '').toLowerCase();
  if (s.includes('active') || s.includes('progress') || s.includes('construction')) return 'success';
  if (s.includes('hold') || s.includes('pending') || s.includes('draft')) return 'warning';
  if (s.includes('complete')) return 'info';
  if (s.includes('closed') || s.includes('cancel')) return 'error';
  return 'neutral';
};

export function SitesTable({ searchQuery = '', refreshKey = 0, onEdit, onView, filters, onRefresh }) {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [deleteSite, setDeleteSite] = useState(null);

  useEffect(() => {
    setLoading(true);
    sitesApi.list()
      .then((response) => setSites(extractList(response)))
      .catch(() => setSites([]))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const filtered = sites.filter((site) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = (site.site_name || site.name || '').toLowerCase();
      const code = (site.site_code || site.code || '').toLowerCase();
      const pName = (site.project_name || '').toLowerCase();
      const pCode = (site.project_code || '').toLowerCase();
      const city = (site.city || site.district || '').toLowerCase();
      if (!name.includes(q) && !code.includes(q) && !pName.includes(q) && !pCode.includes(q) && !city.includes(q)) return false;
    }
    if (filters?.project_id && filters.project_id !== 'all' && String(site.project_id) !== String(filters.project_id)) return false;
    if (filters?.status_id !== 'all' && String(site.site_status_id || site.status_id) !== String(filters.status_id)) return false;
    if (filters?.site_type_id !== 'all' && String(site.site_type_id) !== String(filters.site_type_id)) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const confirmDelete = async () => {
    if (!deleteSite?.id) return;
    try {
      await sitesApi.remove(deleteSite.id);
      toast.success('Site deleted successfully.');
      setDeleteSite(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error(err?.message || 'Failed to delete site.');
    }
  };

  return (
    <>
      {/* Desktop & Tablet Table View */}
      <div className="hidden sm:block">
        <DataTableContainer
          pagination={
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={filtered.length}
              itemsPerPage={perPage}
              onPageChange={setPage}
              onItemsPerPageChange={() => {}}
            />
          }
        >
          <table className="w-full text-left text-[12px] table-auto">
            <thead className="bg-surface-muted text-text-secondary text-[11px] uppercase font-semibold border-b border-border tracking-wider">
              <tr>
                <th className="px-3 py-2 w-10 text-center">#</th>
                <th className="px-3 py-2">Site Details</th>
                <th className="px-3 py-2">Associated Project</th>
                <th className="px-3 py-2 hidden md:table-cell">Site Type</th>
                <th className="px-3 py-2 hidden lg:table-cell">Location & City</th>
                <th className="px-3 py-2 hidden md:table-cell">Site Incharge</th>
                <th className="px-3 py-2 text-center w-24">Status</th>
                <th className="px-3 py-2 text-center w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan="8" className="text-center py-8 text-text-muted text-[12px]">Loading registered sites...</td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan="8" className="text-center py-8 text-text-muted text-[12px]">No sites registered matching your criteria.</td></tr>
              ) : (
                paged.map((site, index) => {
                  const code = site.site_code || site.code || '—';
                  const name = site.site_name || site.name || '—';
                  const project = site.project_name || site.project || '—';
                  const projectCode = site.project_code || '';
                  const typeName = site.site_type_name || site.type_name || site.site_type || 'Main Construction';
                  const status = site.site_status_name || site.status_name || site.status || 'Active';
                  const location = [site.city, site.state_name].filter(Boolean).join(', ') || site.address_line1 || site.location || 'Site Area';
                  const engineer = [site.site_engineer_first_name, site.site_engineer_last_name].filter(Boolean).join(' ') || site.contact_name || 'Assigned Lead';

                  return (
                    <tr key={site.id || index} className="hover:bg-surface-muted/30 transition-colors group">
                      <td className="px-3 py-2 text-center font-medium text-text-primary text-[11px]">
                        {(page - 1) * perPage + index + 1}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-text-primary text-[12px] truncate" title={name}>
                              {name}
                            </span>
                            {site.is_primary === 1 && (
                              <span className="text-[8px] font-bold bg-amber-500/10 text-amber-600 px-1 rounded">Primary</span>
                            )}
                          </div>
                          <span className="font-mono text-[10px] text-text-muted">
                            {code}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-text-primary text-[12px] truncate" title={project}>
                            {project}
                          </span>
                          {projectCode && (
                            <span className="text-[10px] font-mono text-text-muted">
                              {projectCode}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell">
                        <span className="text-text-secondary text-[11px] bg-surface-muted px-2 py-0.5 rounded border border-border">
                          {typeName}
                        </span>
                      </td>
                      <td className="px-3 py-2 hidden lg:table-cell">
                        <span className="text-text-secondary text-[11px] truncate block" title={location}>
                          {location}
                        </span>
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell">
                        <span className="text-text-secondary text-[11px] truncate block">
                          {engineer}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge
                          variant={getStatusVariant(status)}
                          className="text-[8px] font-bold uppercase tracking-wider h-4 px-1.5 inline-flex items-center leading-none"
                        >
                          {status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="View Site 360 Details"
                            onClick={() => onView(site)}
                          >
                            <Eye className="w-3.5 h-3.5 text-text-secondary hover:text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="Edit Site Details"
                            onClick={() => onEdit(site)}
                          >
                            <Edit className="w-3.5 h-3.5 text-text-secondary hover:text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="Delete Site"
                            onClick={() => setDeleteSite(site)}
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

      {/* Mobile View - Cards List for Phones (< sm) */}
      <div className="block sm:hidden space-y-3">
        {loading ? (
          <div className="text-center py-8 text-text-muted text-xs bg-surface border border-border rounded-lg">
            Loading registered sites...
          </div>
        ) : paged.length === 0 ? (
          <div className="text-center py-8 text-text-muted text-xs bg-surface border border-border rounded-lg">
            No sites registered.
          </div>
        ) : (
          paged.map((site, idx) => {
            const name = site.site_name || site.name || '—';
            const code = site.site_code || site.code || '—';
            const project = site.project_name || site.project || '—';
            const status = site.site_status_name || site.status_name || site.status || 'Active';
            const location = [site.city, site.state_name].filter(Boolean).join(', ') || 'Site Area';

            return (
              <div key={site.id || idx} className="bg-surface border border-border rounded-lg p-3.5 shadow-xs space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-text-primary text-[13px]">{name}</h4>
                    <span className="text-[10px] font-mono text-text-muted">{code}</span>
                  </div>
                  <Badge
                    variant={getStatusVariant(status)}
                    className="text-[8px] font-bold uppercase tracking-wider h-4 px-1.5 inline-flex items-center leading-none shrink-0"
                  >
                    {status}
                  </Badge>
                </div>

                <div className="text-xs pt-1 border-t border-border/60">
                  <span className="text-[10px] uppercase font-bold text-text-muted block">Project</span>
                  <span className="font-medium text-text-primary text-[11px] truncate block">{project}</span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                  <span className="text-[10px] text-text-secondary">{location}</span>
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" className="h-7 text-[11px] px-2" onClick={() => onView(site)}>
                      <Eye className="w-3 h-3 mr-1" /> View
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-text-secondary hover:text-primary" title="Edit Site Details" onClick={() => onEdit(site)}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-text-secondary hover:text-error hover:bg-error/10" title="Delete Site" onClick={() => setDeleteSite(site)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
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
            totalItems={filtered.length}
            itemsPerPage={perPage}
            onPageChange={setPage}
            onItemsPerPageChange={() => {}}
          />
        </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteSite)}
        title="Delete Site"
        message={`Are you sure you want to delete "${deleteSite?.site_name}"? This action cannot be undone.`}
        variant="danger"
        confirmLabel="Delete Site"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteSite(null)}
      />
    </>
  );
}
