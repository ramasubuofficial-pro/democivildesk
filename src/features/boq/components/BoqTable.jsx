import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Eye, Edit, Trash2, Send, CheckCircle2, XCircle, MoreVertical,
  FileSpreadsheet, ArrowUpDown, AlertCircle, Download, ExternalLink, Share2
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { DataTableContainer } from '../../../components/composite/DataTableContainer';
import { Pagination } from '../../../components/composite/Pagination';
import { ConfirmDialog } from '../../../components/composite/ConfirmDialog';
import { boqApi } from '../../../api/apiservice';
import { toast } from '../../../components/composite/Toast';
import { useAuth } from '../../auth/context/AuthContext';
import { previewBoqTemplate, downloadBoqTemplate, shareBoqLink } from '../utils/boqExport';

function extractList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data?.project_boqs)) return response.data.project_boqs;
  if (Array.isArray(response.project_boqs)) return response.project_boqs;
  if (Array.isArray(response.data?.data)) return response.data.data;
  if (Array.isArray(response.data)) return response.data;
  return [];
}

const getStatusVariant = (status) => {
  const s = String(status || '').toLowerCase();
  if (s.includes('approved')) return 'success';
  if (s.includes('review') || s.includes('submitted') || s.includes('pending')) return 'warning';
  if (s.includes('rejected')) return 'error';
  return 'neutral';
};

const formatCurrency = (val) => {
  const num = Number(val || 0);
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

export function BoqTable({ searchQuery = '', refreshKey = 0, onEdit, onView, filters, onAction }) {
  const { user, hasPermission } = useAuth();
  const isAdmin = Boolean(user?.is_super_admin) || String(user?.role_name || user?.role || '').toLowerCase().includes('admin');
  const canApprove = isAdmin || hasPermission('boq.approve');
  const canUpdate = isAdmin || hasPermission('boq.update');
  const canDelete = isAdmin || hasPermission('boq.delete');
  const canSubmit = isAdmin || hasPermission('boq.submit');

  const [boqs, setBoqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState(null);
  const perPage = 10;

  // Dialog states
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionDialog, setActionDialog] = useState(null); // { boq, type: 'submit' | 'approve' | 'reject' }
  const [actionReason, setActionReason] = useState('');
  const [actionReasonError, setActionReasonError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const menuRef = useRef(null);

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadBoqs = () => {
    setLoading(true);
    setError(null);
    boqApi.list()
      .then(async (res) => {
        const rawList = extractList(res);
        setBoqs(rawList);
        setLoading(false);

        // Asynchronously populate accurate section and item counts
        try {
          const enriched = await Promise.all(
            rawList.map(async (b) => {
              try {
                const [sRes, iRes] = await Promise.all([
                  boqApi.sections.list(b.id).catch(() => null),
                  boqApi.items.list(b.id).catch(() => null),
                ]);
                const sList = sRes?.data?.boq_sections ?? sRes?.data?.sections ?? sRes?.sections ?? (Array.isArray(sRes?.data) ? sRes.data : []);
                const iList = iRes?.data?.boq_items ?? iRes?.data?.items ?? iRes?.boq_items ?? iRes?.items ?? (Array.isArray(iRes?.data) ? iRes.data : []);
                return {
                  ...b,
                  section_count: Array.isArray(sList) ? sList.length : (b.section_count ?? 0),
                  item_count: Array.isArray(iList) ? iList.length : (b.item_count ?? 0),
                };
              } catch {
                return b;
              }
            })
          );
          setBoqs(enriched);
        } catch {
          // ignore background enrichment error
        }
      })
      .catch((err) => {
        setBoqs([]);
        setError(err?.message || 'Failed to load BOQs.');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadBoqs();
  }, [refreshKey]);

  const filtered = useMemo(() => {
    return boqs.filter((boq) => {
      if (filters?.project_id && filters.project_id !== 'all') {
        if (String(boq.project_id) !== String(filters.project_id)) return false;
      }
      if (filters?.status && filters.status !== 'all') {
        const s = String(boq.status_code || boq.status_name || boq.status || '').toLowerCase();
        const f = String(filters.status).toLowerCase();
        if (f === 'draft' && !s.includes('draft')) return false;
        if (f === 'under_review' && !s.includes('review') && !s.includes('submitted')) return false;
        if (f === 'approved' && !s.includes('approved')) return false;
        if (f === 'rejected' && !s.includes('rejected')) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = (boq.boq_name || boq.name || '').toLowerCase();
        const code = (boq.boq_code || boq.code || '').toLowerCase();
        const project = (boq.project_name || '').toLowerCase();
        const pCode = (boq.project_code || '').toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !project.includes(q) && !pCode.includes(q)) return false;
      }
      return true;
    });
  }, [boqs, filters, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const handleConfirmAction = async () => {
    if (!actionDialog?.boq) return;
    const { boq, type } = actionDialog;

    // Strict validation for Rejection: Reason is mandatory
    if (type === 'reject') {
      const trimmedReason = actionReason.trim();
      if (trimmedReason === '') {
        setActionReasonError('Rejection reason is required.');
        return;
      }
    }

    setActionLoading(true);
    try {
      if (type === 'submit') {
        await boqApi.submit(boq.id, {});
        toast.success('BOQ submitted for approval successfully.');
      } else if (type === 'approve') {
        await boqApi.approve(boq.id, {});
        toast.success('BOQ approved successfully.');
      } else if (type === 'reject') {
        await boqApi.reject(boq.id, { remarks: actionReason.trim() });
        toast.success('BOQ rejected successfully.');
      }
      setActionDialog(null);
      setActionReason('');
      setActionReasonError('');
      onAction?.();
      loadBoqs();
    } catch (err) {
      toast.error(err?.message || `Failed to ${type} BOQ.`);
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return;
    try {
      await boqApi.remove(deleteTarget.id);
      toast.success(`BOQ ${deleteTarget.boq_code || ''} removed successfully.`);
      onAction?.();
      loadBoqs();
    } catch (err) {
      toast.error(err?.message || 'Failed to delete BOQ.');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <>
      {/* Desktop Table View - Hidden on Mobile (< sm) */}
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
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-[12px] table-auto">
            <thead className="bg-surface-muted text-text-secondary text-[11px] uppercase font-semibold border-b border-border tracking-wider">
              <tr>
                <th className="px-3 py-2.5 w-12 text-center">#</th>
                <th className="px-3 py-2.5 w-32">BOQ Code</th>
                <th className="px-3 py-2.5 min-w-[160px]">BOQ Name</th>
                <th className="px-3 py-2.5 min-w-[180px]">Project</th>
                <th className="px-3 py-2.5 text-center w-28">Status</th>
                <th className="px-3 py-2.5 text-center w-20">Sections</th>
                <th className="px-3 py-2.5 text-center w-20">Items</th>
                <th className="px-3 py-2.5 text-right w-36">Total Amount</th>
                <th className="px-3 py-2.5 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan="9" className="text-center py-12 text-text-muted text-[13px]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span>Loading BOQ Register...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="9" className="text-center py-12 text-error text-[13px]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-6 h-6 text-error" />
                      <span>{error}</span>
                      <Button variant="outline" size="sm" onClick={loadBoqs} className="mt-2 text-xs">
                        Try Again
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-12 text-text-muted text-[13px]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileSpreadsheet className="w-8 h-8 text-text-muted/60" />
                      <span className="font-medium text-text-secondary">No BOQs Found</span>
                      <span className="text-xs text-text-muted">No records match the selected project, status, or search query.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paged.map((boq, index) => {
                  const status = boq.status_name || boq.status || (boq.status_code === 'UNDER_REVIEW' ? 'Under Review' : boq.status_code) || 'Draft';
                  const statusCode = String(boq.status_code || boq.status || status).toUpperCase();
                  const isDraft = statusCode.includes('DRAFT');
                  const isSubmitted = statusCode.includes('REVIEW') || statusCode.includes('SUBMITTED');
                  const isApproved = statusCode.includes('APPROVED');
                  const isRejected = statusCode.includes('REJECTED');
                  const total = boq.total_amount || boq.grand_total || 0;
                  const isMenuOpen = openMenuId === boq.id;

                  return (
                    <tr key={boq.id || index} className="hover:bg-surface-muted/30 transition-colors">
                      <td className="px-3 py-2.5 text-center font-medium text-text-primary text-[11px]">
                        {(page - 1) * perPage + index + 1}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-semibold text-text-primary text-[11px] whitespace-nowrap">
                        {boq.boq_code || boq.code || '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-medium text-text-primary text-[12px] truncate block max-w-[240px]" title={boq.boq_name || boq.name}>
                          {boq.boq_name || boq.name || '—'}
                        </span>
                        {boq.notes && (
                          <span className="text-[10px] text-text-muted truncate block max-w-[240px]" title={boq.notes}>
                            {boq.notes}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col min-w-0">
                          <span className="text-text-primary text-[12px] font-medium truncate max-w-[220px]" title={boq.project_name}>
                            {boq.project_name || '—'}
                          </span>
                          <span className="text-[10px] text-text-muted font-mono truncate">
                            {boq.project_code || ''}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <Badge
                          variant={getStatusVariant(status)}
                          className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 inline-flex items-center"
                        >
                          {status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-center text-text-secondary font-mono text-[11px]">
                        {boq.section_count ?? boq.sections_count ?? '0'}
                      </td>
                      <td className="px-3 py-2.5 text-center text-text-secondary font-mono text-[11px]">
                        {boq.item_count ?? boq.items_count ?? '0'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-text-primary text-[12px] whitespace-nowrap">
                        {formatCurrency(total)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1 relative">
                          {/* 1. Primary Action: View */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 hover:bg-surface-muted hover:text-primary transition-colors"
                            title="View BOQ Details"
                            onClick={() => onView?.(boq)}
                          >
                            <Eye className="w-3.5 h-3.5 text-text-secondary hover:text-primary" />
                          </Button>

                          {/* 2. Preview BOQ Report Template */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 hover:bg-sky-50 hover:text-sky-600 transition-colors"
                            title="Preview BOQ Report Template"
                            onClick={() => previewBoqTemplate(boq)}
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-text-secondary hover:text-sky-600" />
                          </Button>

                          {/* 3. Share Public Link */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                            title="Copy Public Share Link (No Auth Required)"
                            onClick={() => shareBoqLink(boq)}
                          >
                            <Share2 className="w-3.5 h-3.5 text-text-secondary hover:text-indigo-600" />
                          </Button>

                          {/* 4. Download BOQ Report */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                            title="Download BOQ Report Template"
                            onClick={() => downloadBoqTemplate(boq)}
                          >
                            <Download className="w-3.5 h-3.5 text-text-secondary hover:text-emerald-600" />
                          </Button>

                          {/* 5. Action Pattern: [⋮] Three-dot menu */}
                          <div className="relative">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-7 w-7 p-0 transition-colors ${
                                isMenuOpen ? 'bg-surface-muted text-primary' : 'hover:bg-surface-muted text-text-secondary'
                              }`}
                              title="More Options"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(isMenuOpen ? null : boq.id);
                              }}
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </Button>

                            {isMenuOpen && (
                              <div
                                ref={menuRef}
                                className="absolute right-0 top-8 z-50 w-48 bg-surface border border-border rounded-sm shadow-xl p-1 text-[11px] animate-in fade-in zoom-in-95 duration-100"
                              >
                                {/* Preview */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    previewBoqTemplate(boq);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-xs hover:bg-sky-50 text-sky-700 flex items-center gap-2 font-medium transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-sky-600" />
                                  <span>Preview BOQ Report</span>
                                </button>

                                {/* Share Public Link */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    shareBoqLink(boq);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-xs hover:bg-indigo-50 text-indigo-700 flex items-center gap-2 font-medium transition-colors"
                                >
                                  <Share2 className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Copy Share Link</span>
                                </button>

                                {/* Download */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    downloadBoqTemplate(boq);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-xs hover:bg-emerald-50 text-emerald-700 flex items-center gap-2 font-medium transition-colors border-b border-border/60 pb-1.5 mb-1"
                                >
                                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Download BOQ</span>
                                </button>
                                {/* Edit: DRAFT only & permitted */}
                                {isDraft && canUpdate && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      onEdit?.(boq);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-xs hover:bg-surface-muted flex items-center gap-2 text-text-primary transition-colors"
                                  >
                                    <Edit className="w-3.5 h-3.5 text-text-secondary" />
                                    <span>Edit</span>
                                  </button>
                                )}

                                {/* Edit & Re-submit: REJECTED only & permitted */}
                                {isRejected && canUpdate && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      onEdit?.(boq);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-xs hover:bg-surface-muted flex items-center gap-2 text-text-primary font-medium transition-colors"
                                  >
                                    <Edit className="w-3.5 h-3.5 text-text-secondary" />
                                    <span>Edit & Re-submit</span>
                                  </button>
                                )}

                                {/* Submit: DRAFT only & permitted */}
                                {isDraft && canSubmit && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setActionDialog({ boq, type: 'submit' });
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-xs hover:bg-info/10 text-info flex items-center gap-2 font-medium transition-colors"
                                  >
                                    <Send className="w-3.5 h-3.5 text-info" />
                                    <span>Submit for Review</span>
                                  </button>
                                )}

                                {/* Approve: SUBMITTED / UNDER_REVIEW & Admin/Approver */}
                                {isSubmitted && canApprove && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setActionDialog({ boq, type: 'approve' });
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-xs hover:bg-emerald-50 text-emerald-700 flex items-center gap-2 font-medium transition-colors"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Approve</span>
                                  </button>
                                )}

                                {/* Reject: SUBMITTED / UNDER_REVIEW & Admin/Approver */}
                                {isSubmitted && canApprove && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setActionReason('');
                                      setActionReasonError('');
                                      setActionDialog({ boq, type: 'reject' });
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-xs hover:bg-rose-50 text-rose-700 flex items-center gap-2 font-medium transition-colors"
                                  >
                                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                    <span>Reject</span>
                                  </button>
                                )}

                                {/* Delete: DRAFT only & permitted */}
                                {isDraft && canDelete && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setDeleteTarget(boq);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-xs hover:bg-error/10 text-error flex items-center gap-2 font-medium transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-error" />
                                    <span>Delete</span>
                                  </button>
                                )}

                                {/* Fallback if no actions allowed for this status */}
                                {!isDraft && !isSubmitted && !isRejected && (
                                  <div className="px-2.5 py-1.5 text-text-muted text-[10px] italic">
                                    No actions available for this status.
                                  </div>
                                )}
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
        </div>
      </DataTableContainer>
      </div>

      {/* Mobile View - Cards List for Phones (< sm) */}
      <div className="block sm:hidden space-y-3">
        {loading ? (
          <div className="bg-surface border border-border rounded-lg p-8 text-center text-text-muted text-[13px]">
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Loading BOQ Register...</span>
            </div>
          </div>
        ) : paged.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg p-8 text-center text-text-muted text-[13px]">
            <FileSpreadsheet className="w-8 h-8 text-text-muted/60 mx-auto mb-2" />
            <p className="font-medium text-text-secondary">No BOQs Found</p>
            <p className="text-xs text-text-muted mt-1">No records match the selected project, status, or search query.</p>
          </div>
        ) : (
          paged.map((boq, index) => {
            const status = boq.status_name || boq.status || (boq.status_code === 'UNDER_REVIEW' ? 'Under Review' : boq.status_code) || 'Draft';
            const statusCode = String(boq.status_code || boq.status || status).toUpperCase();
            const isDraft = statusCode.includes('DRAFT');
            const isSubmitted = statusCode.includes('REVIEW') || statusCode.includes('SUBMITTED');
            const isApproved = statusCode.includes('APPROVED');
            const isRejected = statusCode.includes('REJECTED');
            const total = boq.total_amount || boq.grand_total || 0;

            return (
              <div key={boq.id || index} className="bg-surface border border-border rounded-lg p-3.5 shadow-xs space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-[10px] font-bold text-primary block truncate">
                      {boq.boq_code || boq.code || '—'}
                    </span>
                    <h4 className="font-semibold text-text-primary text-[13px] leading-snug truncate" title={boq.boq_name || boq.name}>
                      {boq.boq_name || boq.name || '—'}
                    </h4>
                    <span className="text-[11px] text-text-muted truncate block">
                      {boq.project_name || '—'}
                    </span>
                  </div>
                  <Badge
                    variant={getStatusVariant(status)}
                    className="text-[8px] font-bold uppercase tracking-wider h-4 px-1.5 inline-flex items-center leading-none shrink-0"
                  >
                    {status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/60">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-text-muted block">Sections & Items</span>
                    <span className="text-text-primary text-[11px] font-medium block">
                      {boq.section_count || 0} secs • {boq.item_count || 0} items
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-text-muted block">Total Amount</span>
                    <span className="font-mono font-bold text-primary text-[12px]">
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>

                {boq.boq_date && (
                  <div className="text-[10px] text-text-muted pt-1 border-t border-border/40 flex items-center justify-between">
                    <span>Baseline: {boq.boq_date}</span>
                    {boq.valid_from && <span>Valid: {boq.valid_from}</span>}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                  <span className="text-[10px] text-text-muted font-mono">
                    #{(page - 1) * perPage + index + 1}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] px-2"
                      onClick={() => onView?.(boq)}
                    >
                      <Eye className="w-3 h-3 mr-1" /> View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-sky-50 text-sky-600"
                      title="Preview BOQ Report Template"
                      onClick={() => previewBoqTemplate(boq)}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-indigo-50 text-indigo-600"
                      title="Copy Public Share Link"
                      onClick={() => shareBoqLink(boq)}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-emerald-50 text-emerald-600"
                      title="Download BOQ Report Template"
                      onClick={() => downloadBoqTemplate(boq)}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                    {isDraft && canUpdate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title="Edit"
                        onClick={() => onEdit?.(boq)}
                      >
                        <Edit className="w-3.5 h-3.5 text-text-secondary hover:text-primary" />
                      </Button>
                    )}
                    {isRejected && canUpdate && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] px-2 font-medium"
                        title="Edit & Re-submit"
                        onClick={() => onEdit?.(boq)}
                      >
                        <Edit className="w-3 h-3 mr-1 text-primary" /> Re-submit
                      </Button>
                    )}
                    {isDraft && canSubmit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-info"
                        title="Submit"
                        onClick={() => {
                          setActionReason('');
                          setActionReasonError('');
                          setActionDialog({ boq, type: 'submit' });
                        }}
                      >
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {isSubmitted && canApprove && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-emerald-600 hover:bg-emerald-50"
                          title="Approve"
                          onClick={() => {
                            setActionReason('');
                            setActionReasonError('');
                            setActionDialog({ boq, type: 'approve' });
                          }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50"
                          title="Reject"
                          onClick={() => {
                            setActionReason('');
                            setActionReasonError('');
                            setActionDialog({ boq, type: 'reject' });
                          }}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                    {isDraft && canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-error"
                        title="Delete"
                        onClick={() => setDeleteTarget(boq)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
            totalItems={filtered.length}
            itemsPerPage={perPage}
            onPageChange={setPage}
            onItemsPerPageChange={() => {}}
          />
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete BOQ"
        message={`Are you sure you want to permanently delete BOQ "${deleteTarget?.boq_code || deleteTarget?.boq_name || ''}"? This action cannot be undone.`}
        variant="danger"
        confirmLabel="Delete BOQ"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Workflow Action Confirmation Dialog (Submit / Approve / Reject) */}
      {actionDialog && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          {actionDialog.type === 'reject' ? (
            /* Dedicated Rejection Modal (Requirements 3, 4, 5, 18, 19) */
            <div className="bg-surface border border-border rounded-lg shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-primary">Reject BOQ</h3>
                  <p className="text-xs text-text-muted">Enter the reason for rejecting this project BOQ.</p>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase text-text-muted">BOQ Code:</div>
                  <div className="text-sm font-mono font-bold text-text-primary">
                    {actionDialog.boq.boq_code || actionDialog.boq.code || '—'}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold uppercase text-text-muted">BOQ Name:</div>
                  <div className="text-xs font-medium text-text-primary">
                    {actionDialog.boq.boq_name || actionDialog.boq.name || '—'}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Reason for Rejection <span className="text-error">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={actionReason}
                    onChange={(e) => {
                      setActionReason(e.target.value);
                      if (actionReasonError && e.target.value.trim()) {
                        setActionReasonError('');
                      }
                    }}
                    placeholder="Enter the reason for rejecting this BOQ..."
                    className={`w-full text-xs p-2.5 rounded-md border ${
                      actionReasonError ? 'border-error ring-1 ring-error' : 'border-border'
                    } bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary`}
                  />
                  {actionReasonError && (
                    <p className="text-[11px] text-error mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {actionReasonError}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActionDialog(null);
                    setActionReason('');
                    setActionReasonError('');
                  }}
                  disabled={actionLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="error"
                  size="sm"
                  onClick={handleConfirmAction}
                  disabled={actionLoading || !actionReason.trim()}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-medium"
                >
                  {actionLoading ? 'Rejecting...' : 'Reject BOQ'}
                </Button>
              </div>
            </div>
          ) : (
            /* Approve & Submit Confirmation Dialog */
            <div className="bg-surface border border-border rounded-lg shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  actionDialog.type === 'approve' ? 'bg-emerald-100 text-emerald-600' : 'bg-info/10 text-info'
                }`}>
                  {actionDialog.type === 'approve' ? <CheckCircle2 className="w-5 h-5" /> : <Send className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-primary">
                    {actionDialog.type === 'approve' ? 'Approve BOQ' : 'Submit BOQ for Approval'}
                  </h3>
                  <p className="text-xs text-text-muted">
                    {actionDialog.type === 'approve'
                      ? 'Confirm approval for this project BOQ.'
                      : 'Submit this draft BOQ for review.'}
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase text-text-muted">BOQ Code:</div>
                  <div className="text-sm font-mono font-bold text-text-primary">
                    {actionDialog.boq.boq_code || actionDialog.boq.code || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase text-text-muted">BOQ Name:</div>
                  <div className="text-xs font-medium text-text-primary">
                    {actionDialog.boq.boq_name || actionDialog.boq.name || '—'}
                  </div>
                </div>
                <p className="text-xs text-text-secondary pt-2">
                  {actionDialog.type === 'approve' ? (
                    <>Are you sure you want to approve this BOQ? This will move the status to <strong>APPROVED</strong>.</>
                  ) : (
                    <>Are you sure you want to submit this BOQ? It will move to <strong>UNDER REVIEW</strong> for approver sign-off.</>
                  )}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActionDialog(null);
                    setActionReason('');
                    setActionReasonError('');
                  }}
                  disabled={actionLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleConfirmAction}
                  disabled={actionLoading}
                  className={actionDialog.type === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-medium' : 'font-medium'}
                >
                  {actionLoading
                    ? 'Processing...'
                    : (actionDialog.type === 'approve' ? 'Approve BOQ' : 'Submit BOQ')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default BoqTable;
