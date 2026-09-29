import { useState, useEffect } from 'react';
import {
  Eye,
  CheckCircle2,
  XCircle,
  Crown,
  Edit,
  Building2
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { DataTableContainer } from '../../../components/composite/DataTableContainer';
import { Pagination } from '../../../components/composite/Pagination';
import { branchesApi } from '../../../api/apiservice';
import { BranchFormModal } from './BranchFormModal';
import { BranchDetailModal } from './BranchDetailModal';

function extractBranchList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.branches)) return response.branches;
  if (Array.isArray(response.data?.branches)) return response.data.branches;
  if (Array.isArray(response.data?.data)) return response.data.data;
  if (response.data && typeof response.data === 'object' && (response.data.id || response.data.branch_name || response.data.name)) {
    return [response.data];
  }
  if (response && typeof response === 'object' && (response.id || response.branch_name || response.name)) {
    return [response];
  }
  return [];
}

export function BranchTable({ searchQuery = '', refreshTrigger = 0 }) {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [editingBranch, setEditingBranch] = useState(null);
  const [page, setPage] = useState(1);
  const perPage = 10;

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const response = await branchesApi.list();
      const list = extractBranchList(response);
      setBranches(list);
    } catch (error) {
      console.error("[BranchTable] Failed to fetch branches:", error);
      setBranches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, [refreshTrigger]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const filteredBranches = branches.filter((branch) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = (branch.branch_name || branch.name || '').toLowerCase();
    const code = (branch.branch_code || branch.code || '').toLowerCase();
    const city = (branch.city || branch.location || '').toLowerCase();
    const gstin = (branch.gstin || branch.gst || '').toLowerCase();
    return name.includes(q) || code.includes(q) || city.includes(q) || gstin.includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filteredBranches.length / perPage));
  const pagedBranches = filteredBranches.slice((page - 1) * perPage, page * perPage);

  const renderPagination = () => (
    <Pagination
      currentPage={page}
      totalPages={totalPages}
      totalItems={filteredBranches.length}
      itemsPerPage={perPage}
      onPageChange={setPage}
      onItemsPerPageChange={() => {}}
    />
  );

  return (
    <>
      {/* Desktop & Tablet Table */}
      <div className="hidden sm:block">
        <DataTableContainer pagination={renderPagination()}>
          <table className="w-full text-left text-[12px] whitespace-nowrap table-fixed">
            <thead className="bg-surface-muted text-text-secondary text-[10px] uppercase font-bold border-b border-border tracking-wider">
              <tr>
                <th className="px-2 py-1.5 w-10 text-center">#</th>
                <th className="px-2 py-1.5 w-20">Branch Code</th>
                <th className="px-2 py-1.5 w-40">Branch Name</th>
                <th className="px-2 py-1.5 w-32">Company</th>
                <th className="px-2 py-1.5 w-28">GSTIN</th>
                <th className="px-2 py-1.5 w-24">City</th>
                <th className="px-2 py-1.5 w-24">State</th>
                <th className="px-2 py-1.5 w-28">Phone</th>
                <th className="px-2 py-1.5 w-16 text-center">Type</th>
                <th className="px-2 py-1.5 w-16 text-center">Status</th>
                <th className="px-2 py-1.5 text-center w-16">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan="11" className="text-center py-4 text-text-muted text-[11px]">
                    Loading branches from database...
                  </td>
                </tr>
              ) : pagedBranches.length === 0 ? (
                <tr>
                  <td colSpan="11" className="text-center py-4 text-text-muted text-[11px]">
                    No branches found in the database.
                  </td>
                </tr>
              ) : (
                pagedBranches.map((branch, index) => {
                  const branchCode = branch.branch_code || branch.code || '—';
                  const branchName = branch.branch_name || branch.name || 'Branch';
                  const gstin = branch.gstin || branch.gst || '—';
                  const city = branch.city || '—';
                  const state = branch.state_name || branch.state || '—';
                  const companyName = branch.company_name || (branch.company_id ? `Company #${branch.company_id}` : '—');
                  const phone = branch.phone || branch.contact || '—';

                  const isHQ = branch.is_head_office === 1 || branch.is_head_office === '1' || branch.is_head_office === true || branch.head_office === 1;
                  const isActive = branch.is_active === 1 || branch.is_active === '1' || branch.is_active === true || branch.status === 'Active' || branch.status === 1 || branch.is_active === undefined;

                  return (
                    <tr key={branch.id || index} className="hover:bg-surface-muted/30 transition-colors group">
                      <td className="px-2 py-1 text-center font-medium text-text-secondary text-[11px]">{(page - 1) * perPage + index + 1}</td>
                      <td className="px-2 py-1 font-mono font-semibold text-text-primary text-[11px]">{branchCode}</td>
                      <td className="px-2 py-1 font-medium text-text-primary truncate" title={branchName}>
                        <div className="flex items-center gap-1.5">
                          {isHQ && <Crown className="w-3 h-3 text-amber-500 shrink-0" title="Head Office" />}
                          <span className="truncate">{branchName}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1 text-text-secondary truncate text-[11px]" title={companyName}>
                        {companyName}
                      </td>
                      <td className="px-2 py-1 font-mono text-text-secondary text-[11px]">{gstin}</td>
                      <td className="px-2 py-1 text-text-secondary truncate text-[11px]" title={city}>
                        {city}
                      </td>
                      <td className="px-2 py-1 text-text-secondary truncate text-[11px]" title={state}>
                        {state}
                      </td>
                      <td className="px-2 py-1 text-text-secondary text-[11px]">{phone}</td>
                      <td className="px-2 py-1 text-center">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isHQ ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' : 'bg-surface-muted text-text-secondary border border-border'}`}>
                          {isHQ ? 'HQ' : 'Branch'}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-center">
                        <Badge
                          variant={isActive ? 'success' : 'neutral'}
                          className="text-[8px] font-bold uppercase tracking-wider h-4 px-1 inline-flex items-center gap-0.5 leading-none"
                        >
                          {isActive ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                          {isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-2 py-1">
                        <div className="flex items-center justify-center gap-0.5">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setSelectedBranch(branch)}
                            className="h-6 w-6 p-0" 
                            title="View Branch Details"
                          >
                            <Eye className="w-3.5 h-3.5 text-text-secondary hover:text-primary" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setEditingBranch(branch)}
                            className="h-6 w-6 p-0" 
                            title="Edit Branch"
                          >
                            <Edit className="w-3.5 h-3.5 text-text-secondary hover:text-primary" />
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
          <div className="bg-surface border border-border rounded-lg p-6 text-center text-text-muted text-[13px]">
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Loading branches...</span>
            </div>
          </div>
        ) : pagedBranches.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg p-6 text-center text-text-muted text-[13px]">
            <Building2 className="w-8 h-8 text-text-muted/60 mx-auto mb-2" />
            <p className="font-medium text-text-secondary">No Branches Found</p>
            <p className="text-xs text-text-muted mt-1">No records match the current search query.</p>
          </div>
        ) : (
          pagedBranches.map((branch, index) => {
            const branchCode = branch.branch_code || branch.code || '—';
            const branchName = branch.branch_name || branch.name || 'Branch';
            const gstin = branch.gstin || branch.gst || '—';
            const city = branch.city || '—';
            const state = branch.state_name || branch.state || '—';
            const companyName = branch.company_name || (branch.company_id ? `Company #${branch.company_id}` : '—');
            const phone = branch.phone || branch.contact || '—';

            const isHQ = branch.is_head_office === 1 || branch.is_head_office === '1' || branch.is_head_office === true || branch.head_office === 1;
            const isActive = branch.is_active === 1 || branch.is_active === '1' || branch.is_active === true || branch.status === 'Active' || branch.status === 1 || branch.is_active === undefined;

            return (
              <div key={branch.id || index} className="bg-surface border border-border rounded-lg p-3.5 shadow-xs space-y-2.5">
                {/* Card Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[10px] font-bold text-primary block">
                        {branchCode}
                      </span>
                      <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isHQ ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' : 'bg-surface-muted text-text-secondary border border-border'}`}>
                        {isHQ ? 'HQ' : 'Branch'}
                      </span>
                    </div>
                    <h4 className="font-semibold text-text-primary text-[13px] leading-snug truncate flex items-center gap-1 mt-0.5" title={branchName}>
                      {isHQ && <Crown className="w-3 h-3 text-amber-500 shrink-0" title="Head Office" />}
                      <span className="truncate">{branchName}</span>
                    </h4>
                    {companyName !== '—' && (
                      <span className="text-[11px] text-text-muted truncate block">
                        {companyName}
                      </span>
                    )}
                  </div>
                  <Badge
                    variant={isActive ? 'success' : 'neutral'}
                    className="text-[8px] font-bold uppercase tracking-wider h-4 px-1.5 inline-flex items-center gap-0.5 leading-none shrink-0"
                  >
                    {isActive ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                    {isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                {/* Card Details Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/60">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-text-muted block">Contact</span>
                    <span className="text-[11px] text-text-primary truncate block font-mono">
                      {phone !== '—' ? phone : 'No phone'}
                    </span>
                    {gstin !== '—' && (
                      <span className="text-[10px] text-text-muted font-mono block truncate">
                        GST: {gstin}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-text-muted block">Location</span>
                    <span className="text-[11px] text-text-primary font-medium block truncate" title={`${city}, ${state}`}>
                      {city !== '—' ? `${city}, ${state}` : state}
                    </span>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                  <span className="text-[10px] text-text-muted font-mono">
                    #{(page - 1) * perPage + index + 1}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-[11px] px-2.5"
                      onClick={() => setSelectedBranch(branch)}
                    >
                      <Eye className="w-3 h-3 mr-1" /> View
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-[11px] px-2.5"
                      onClick={() => setEditingBranch(branch)}
                    >
                      <Edit className="w-3 h-3 mr-1" /> Edit
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Mobile Pagination */}
        <div className="pt-2">
          {renderPagination()}
        </div>
      </div>

      {selectedBranch && (
        <BranchDetailModal
          branch={selectedBranch}
          onClose={() => setSelectedBranch(null)}
        />
      )}

      {editingBranch && (
        <BranchFormModal
          isOpen={Boolean(editingBranch)}
          branch={editingBranch}
          onClose={() => setEditingBranch(null)}
          onSaveSuccess={fetchBranches}
        />
      )}
    </>
  );
}
