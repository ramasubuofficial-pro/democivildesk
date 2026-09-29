import { useState, useEffect, useRef } from 'react';
import { Eye, Edit, MoreVertical, CheckCircle2, XCircle, Building } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { DataTableContainer } from '../../../components/composite/DataTableContainer';
import { Pagination } from '../../../components/composite/Pagination';
import { companiesApi } from '../../../api/apiservice';
import { toast } from '../../../components/composite/Toast';
import { CompanyFormModal } from './CompanyFormModal';
import { CompanyDetailModal } from './CompanyDetailModal';

function extractCompaniesList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.companies)) return response.companies;
  if (Array.isArray(response.data?.companies)) return response.data.companies;
  if (Array.isArray(response.data?.data)) return response.data.data;
  return [];
}

export function CompanyTable({
  searchQuery = '',
  statusFilter = 'all'
}) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [editingCompany, setEditingCompany] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [page, setPage] = useState(1);
  const perPage = 10;

  const menuRef = useRef(null);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const response = await companiesApi.list();
      setCompanies(extractCompaniesList(response));
    } catch (error) {
      console.error("[CompanyTable] Failed to fetch companies:", error);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCompanies = companies.filter((company) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = (company.company_name || company.name || '').toLowerCase();
      const code = (company.company_code || '').toLowerCase();
      const email = (company.email || '').toLowerCase();
      const gstin = (company.gstin || '').toLowerCase();
      const pan = (company.pan || '').toLowerCase();
      if (!name.includes(q) && !code.includes(q) && !email.includes(q) && !gstin.includes(q) && !pan.includes(q)) return false;
    }

    if (statusFilter !== 'all') {
      const isActive = company.is_active == 1 || company.is_active === true || company.status === 'Active';
      if (statusFilter === 'active' && !isActive) return false;
      if (statusFilter === 'inactive' && isActive) return false;
    }

    return true;
  });

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCompanies.length / perPage));
  const pagedCompanies = filteredCompanies.slice((page - 1) * perPage, page * perPage);

  const renderPagination = () => (
    <Pagination 
      currentPage={page}
      totalPages={totalPages}
      totalItems={filteredCompanies.length}
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
            <thead className="bg-surface-muted text-text-secondary text-[11px] uppercase font-semibold border-b border-border tracking-wider">
              <tr>
                <th className="px-2 py-1.5 w-10 text-center">#</th>
                <th className="px-2 py-1.5 w-20">Com Code</th>
                <th className="px-2 py-1.5 w-44">Company Name</th>
                <th className="px-2 py-1.5 w-40">Email</th>
                <th className="px-2 py-1.5 w-28">Phone</th>
                <th className="px-2 py-1.5 w-28">City</th>
                <th className="px-2 py-1.5 w-28">State</th>
                <th className="px-2 py-1.5 w-20 text-center">Status</th>
                <th className="px-2 py-1.5 text-center w-16">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan="9" className="text-center py-6 text-text-muted text-[12px]">Loading companies from database...</td>
                </tr>
              ) : pagedCompanies.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-6 text-text-muted text-[12px]">No companies found.</td>
                </tr>
              ) : (
                pagedCompanies.map((company, index) => {
                  const code = company.company_code || '—';
                  const name = company.company_name || company.name || '—';
                  const email = company.email;
                  const phone = company.phone;
                  const city = company.city || '—';
                  const state = company.state_name || company.state_code || '—';
                  const isActive = company.is_active == 1 || company.is_active === true || company.status === 'Active';
                  const isMenuOpen = openMenuId === company.id;

                  return (
                    <tr key={company.id || index} className="hover:bg-surface-muted/30 transition-colors group relative">
                      <td className="px-2 py-1 text-center font-medium text-text-primary text-[11px]">{(page - 1) * perPage + index + 1}</td>
                      <td className="px-2 py-1 font-mono font-semibold text-text-primary text-[11px]">{code}</td>
                      <td className="px-2 py-1 font-medium text-text-primary truncate" title={name}>
                        {name}
                      </td>
                      <td className="px-2 py-1 text-text-secondary truncate text-[11px]" title={email}>
                        {email || '—'}
                      </td>
                      <td className="px-2 py-1 text-text-secondary truncate text-[11px]">
                        {phone || '—'}
                      </td>
                      <td className="px-2 py-1 text-text-secondary truncate text-[11px]" title={city}>
                        {city}
                      </td>
                      <td className="px-2 py-1 text-text-secondary truncate text-[11px]" title={state}>
                        {state}
                      </td>
                      <td className="px-2 py-1 text-center">
                        <Badge 
                          variant={isActive ? 'success' : 'neutral'}
                          className="text-[8px] font-bold uppercase tracking-wider h-4 px-1.5 inline-flex items-center gap-0.5 leading-none"
                        >
                          {isActive ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                          {isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-2 py-1">
                        <div className="flex items-center justify-center gap-0.5">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedCompany(company)} className="h-6 w-6 p-0" title="View">
                            <Eye className="w-3.5 h-3.5 text-text-secondary hover:text-primary" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditingCompany(company)} className="h-6 w-6 p-0" title="Edit">
                            <Edit className="w-3.5 h-3.5 text-text-secondary hover:text-primary" />
                          </Button>
                          <div className="relative">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(isMenuOpen ? null : company.id);
                              }}
                              className={`h-6 w-6 p-0 ${isMenuOpen ? 'text-primary bg-surface-muted' : 'text-text-secondary'}`}
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </Button>
                            {isMenuOpen && (
                              <div 
                                ref={menuRef}
                                className="absolute right-0 top-7 z-50 w-44 bg-surface border border-border rounded-sm shadow-xl p-1 text-[11px] animate-in fade-in zoom-in-95 duration-100"
                              >
                                <button onClick={() => { setSelectedCompany(company); setOpenMenuId(null); }} className="w-full text-left px-2.5 py-1.5 rounded-xs hover:bg-surface-muted flex items-center gap-2 text-text-primary">
                                  <Eye className="w-3.5 h-3.5 text-primary" /> <span>View Details</span>
                                </button>
                                <button onClick={() => { setEditingCompany(company); setOpenMenuId(null); }} className="w-full text-left px-2.5 py-1.5 rounded-xs hover:bg-surface-muted flex items-center gap-2 text-text-primary">
                                  <Edit className="w-3.5 h-3.5 text-text-secondary" /> <span>Edit Company</span>
                                </button>
                              </div>
                            )}
                          </div>
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
              <span>Loading companies...</span>
            </div>
          </div>
        ) : pagedCompanies.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg p-6 text-center text-text-muted text-[13px]">
            <Building className="w-8 h-8 text-text-muted/60 mx-auto mb-2" />
            <p className="font-medium text-text-secondary">No Companies Found</p>
            <p className="text-xs text-text-muted mt-1">No records match the selected status or search query.</p>
          </div>
        ) : (
          pagedCompanies.map((company, index) => {
            const code = company.company_code || '—';
            const name = company.company_name || company.name || '—';
            const legal = company.legal_name;
            const gstin = company.gstin;
            const pan = company.pan;
            const email = company.email;
            const phone = company.phone;
            const city = company.city || '—';
            const state = company.state_name || company.state_code || '—';
            const isActive = company.is_active == 1 || company.is_active === true || company.status === 'Active';

            return (
              <div key={company.id || index} className="bg-surface border border-border rounded-lg p-3.5 shadow-xs space-y-2.5">
                {/* Card Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-[10px] font-bold text-primary block truncate">
                      {code}
                    </span>
                    <h4 className="font-semibold text-text-primary text-[13px] leading-snug truncate" title={name}>
                      {name}
                    </h4>
                    {legal && legal !== name && (
                      <span className="text-[11px] text-text-muted truncate block">
                        {legal}
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
                    <span className="text-[11px] text-text-primary truncate block" title={email}>
                      {email || '—'}
                    </span>
                    <span className="text-[10px] text-text-muted block font-mono">
                      {phone || '—'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-text-muted block">Location</span>
                    <span className="text-[11px] text-text-primary font-medium block truncate" title={`${city}, ${state}`}>
                      {city !== '—' ? `${city}, ${state}` : state}
                    </span>
                    {(gstin || pan) && (
                      <span className="text-[10px] text-text-muted font-mono block truncate">
                        {gstin ? `GST: ${gstin}` : `PAN: ${pan}`}
                      </span>
                    )}
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
                      onClick={() => setSelectedCompany(company)}
                    >
                      <Eye className="w-3 h-3 mr-1" /> View
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-[11px] px-2.5"
                      onClick={() => setEditingCompany(company)}
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

            {selectedCompany && (
              <CompanyDetailModal 
                company={selectedCompany} 
                onClose={() => setSelectedCompany(null)} 
              />
            )}

            {editingCompany && (
              <CompanyFormModal
                isOpen={Boolean(editingCompany)}
                company={editingCompany}
                onClose={() => setEditingCompany(null)}
                onSaveSuccess={fetchCompanies}
              />
            )}
          </>
        );
      }
