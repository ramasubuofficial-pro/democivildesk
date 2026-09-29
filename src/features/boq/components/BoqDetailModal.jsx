import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, FileSpreadsheet, Plus, Edit, Trash2, ChevronDown, ChevronRight,
  Calculator, CheckCircle2, XCircle, Send, Layers, Boxes, Sparkles, AlertCircle,
  Download, ExternalLink, Share2
} from 'lucide-react';
import { boqApi } from '../../../api/apiservice';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { toast } from '../../../components/composite/Toast';
import { useAuth } from '../../auth/context/AuthContext';
import { RateAnalysisModal } from './RateAnalysisModal';
import { previewBoqTemplate, downloadBoqTemplate, shareBoqLink } from '../utils/boqExport';

const formatCurrency = (val) => {
  const num = Number(val || 0);
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

const getStatusVariant = (status) => {
  const s = String(status || '').toLowerCase();
  if (s.includes('approved')) return 'success';
  if (s.includes('review') || s.includes('submitted') || s.includes('pending')) return 'warning';
  if (s.includes('rejected')) return 'error';
  return 'neutral';
};

const COMPONENT_TYPE_BADGES = {
  1: { name: 'Material', variant: 'primary' },
  2: { name: 'Labour', variant: 'warning' },
  3: { name: 'Equipment', variant: 'neutral' },
  4: { name: 'Subcontract', variant: 'secondary' },
  5: { name: 'Overheads', variant: 'neutral' },
};

function ItemRateComponentsSubRow({ boqId, item }) {
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    boqApi.rateComponents.list(boqId, item.id)
      .then((res) => {
        if (!active) return;
        const list = res?.data?.rate_components ?? res?.rate_components ?? (Array.isArray(res?.data) ? res.data : []);
        setComponents(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (active) setComponents([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [boqId, item.id]);

  if (loading) {
    return (
      <tr className="bg-surface-subtle/80">
        <td colSpan="7" className="pl-16 py-2.5 text-[11px] text-text-muted">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Loading rate analysis breakdown...</span>
          </div>
        </td>
      </tr>
    );
  }

  if (components.length === 0) {
    return (
      <tr className="bg-surface-subtle/80">
        <td colSpan="7" className="pl-16 py-2 text-[11px] text-text-muted italic">
          No rate components analyzed for this item.
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-surface-subtle/80">
      <td colSpan="7" className="pl-14 pr-4 py-2.5">
        <div className="border border-border/80 rounded-md bg-surface p-2.5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5 text-primary" />
              Rate Components Breakdown ({components.length})
            </span>
            <span className="text-[11px] font-semibold text-text-primary">
              Derived Unit Rate: {formatCurrency(components.reduce((sum, c) => sum + (Number(c.quantity_factor || 1) * Number(c.component_rate || 0)), 0))} / {item.unit_symbol || item.unit_name || 'Unit'}
            </span>
          </div>
          <table className="w-full text-left text-[11px]">
            <thead className="text-[10px] uppercase text-text-muted font-semibold border-b border-border/60">
              <tr>
                <th className="py-1 px-2 w-28">Type</th>
                <th className="py-1 px-2">Component Name</th>
                <th className="py-1 px-2 text-right w-24">Qty Factor</th>
                <th className="py-1 px-2 text-right w-24">Component Rate</th>
                <th className="py-1 px-2 text-right w-28">Rate Contribution</th>
                <th className="py-1 px-2">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {components.map((comp, cIdx) => {
                const typeInfo = COMPONENT_TYPE_BADGES[comp.component_type_id] || { name: comp.component_type_name || 'Other', variant: 'neutral' };
                const contrib = (Number(comp.quantity_factor || 1) * Number(comp.component_rate || 0));
                return (
                  <tr key={comp.id || cIdx} className="hover:bg-surface-muted/30">
                    <td className="py-1 px-2">
                      <Badge variant={typeInfo.variant} className="text-[8px] font-semibold uppercase px-1.5 py-0.2">
                        {typeInfo.name}
                      </Badge>
                    </td>
                    <td className="py-1 px-2 font-medium text-text-primary">
                      {comp.component_name || '—'}
                    </td>
                    <td className="py-1 px-2 text-right font-mono text-text-secondary">
                      {comp.quantity_factor ?? '1'}
                    </td>
                    <td className="py-1 px-2 text-right font-mono text-text-secondary">
                      {formatCurrency(comp.component_rate)}
                    </td>
                    <td className="py-1 px-2 text-right font-mono font-semibold text-text-primary">
                      {formatCurrency(contrib)}
                    </td>
                    <td className="py-1 px-2 text-text-muted text-[10px] truncate max-w-[150px]" title={comp.remarks}>
                      {comp.remarks || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}

function ItemRow({ item, boqId, isBoqDraft, onOpenRateModal }) {
  const [expandedRate, setExpandedRate] = useState(false);

  return (
    <>
      <tr className="bg-surface hover:bg-surface-muted/30 transition-colors">
        <td className="px-3 py-2 text-center">
          <button
            type="button"
            onClick={() => setExpandedRate(!expandedRate)}
            title={expandedRate ? "Hide rate components" : "View rate components"}
            className="p-1 text-text-muted hover:text-primary transition-colors"
          >
            {expandedRate ? <ChevronDown className="w-3.5 h-3.5 text-primary" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </td>
        <td className="px-3 py-2 font-mono font-medium text-text-secondary text-[11px] whitespace-nowrap">
          {item.item_code || '—'}
        </td>
        <td className="px-3 py-2">
          <span className="font-medium text-text-primary text-[12px] block" title={item.item_name}>
            {item.item_name || item.description || '—'}
          </span>
          {item.specification && (
            <span className="text-[10px] text-text-muted block truncate max-w-[320px]" title={item.specification}>
              {item.specification}
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-right font-mono text-text-secondary text-[11px] whitespace-nowrap">
          {item.quantity ?? '—'} <span className="text-[10px] text-text-muted">{item.unit_symbol || item.unit_name || item.unit || ''}</span>
        </td>
        <td className="px-3 py-2 text-right font-mono text-text-secondary text-[11px] whitespace-nowrap">
          {formatCurrency(item.rate)}
        </td>
        <td className="px-3 py-2 text-right font-mono font-semibold text-text-primary text-[11px] whitespace-nowrap">
          {formatCurrency(item.amount || (item.quantity * item.rate))}
        </td>
        <td className="px-3 py-2 text-center">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[10px] font-medium text-text-secondary hover:text-primary"
            onClick={() => onOpenRateModal(item)}
            title="Manage Rate Analysis"
          >
            <Calculator className="w-3 h-3 mr-1 text-primary" />
            Rates
          </Button>
        </td>
      </tr>
      {expandedRate && (
        <ItemRateComponentsSubRow boqId={boqId} item={item} />
      )}
    </>
  );
}

function SectionCard({ section, items: propItems, boqId, isBoqDraft, onOpenRateModal }) {
  const [expanded, setExpanded] = useState(true);
  const [items, setItems] = useState(propItems || []);
  const [loadingItems, setLoadingItems] = useState(false);

  // Synchronize items when propItems updates
  useEffect(() => {
    if (propItems !== undefined) {
      setItems(propItems);
    }
  }, [propItems]);

  const fetchItems = () => {
    setLoadingItems(true);
    boqApi.items.list(boqId, { section_id: section.id })
      .then((res) => {
        const list = res?.data?.boq_items ?? res?.data?.items ?? res?.boq_items ?? res?.items ?? (Array.isArray(res?.data) ? res.data : []);
        setItems(Array.isArray(list) ? list : []);
      })
      .catch(() => setItems([]))
      .finally(() => setLoadingItems(false));
  };

  return (
    <div className="border border-border rounded-lg bg-surface overflow-hidden shadow-xs">
      {/* Section Header Accordion Bar */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-surface-muted/50 hover:bg-surface-muted cursor-pointer transition-colors border-b border-border/80"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <button type="button" className="text-text-muted hover:text-text-primary p-0.5">
            {expanded ? <ChevronDown className="w-4 h-4 text-text-secondary" /> : <ChevronRight className="w-4 h-4 text-text-secondary" />}
          </button>
          <span className="font-mono font-bold text-text-primary text-[12px] bg-primary/10 text-primary px-2 py-0.5 rounded-xs">
            {section.section_code || 'SEC'}
          </span>
          <div>
            <h4 className="font-semibold text-text-primary text-[13px]">{section.section_name || section.name || 'Untitled Section'}</h4>
            {section.description && (
              <p className="text-[11px] text-text-muted truncate max-w-[400px]">{section.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-[11px] text-text-secondary">
            <strong>{items.length}</strong> {items.length === 1 ? 'item' : 'items'}
          </span>
          <span className="font-mono font-bold text-text-primary text-[13px]">
            {formatCurrency(section.section_amount || items.reduce((sum, i) => sum + Number(i.amount || (Number(i.quantity || 0) * Number(i.rate || 0)) || 0), 0))}
          </span>
        </div>
      </div>

      {/* Section Items Table */}
      {expanded && (
        <div className="overflow-x-auto">
          {loadingItems ? (
            <div className="py-6 text-center text-text-muted text-[12px]">
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span>Loading items for {section.section_code}...</span>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="py-6 text-center text-text-muted text-[12px] italic">
              No items defined in this section yet.
            </div>
          ) : (
            <table className="w-full text-left text-[12px]">
              <thead className="bg-surface-muted/30 text-text-secondary text-[10px] uppercase font-semibold border-b border-border tracking-wider">
                <tr>
                  <th className="px-3 py-2 w-8"></th>
                  <th className="px-3 py-2 w-28">Item Code</th>
                  <th className="px-3 py-2">Item Description</th>
                  <th className="px-3 py-2 text-right w-24">Quantity</th>
                  <th className="px-3 py-2 text-right w-28">Unit Rate</th>
                  <th className="px-3 py-2 text-right w-32">Amount</th>
                  <th className="px-3 py-2 text-center w-24">Rate Analysis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    boqId={boqId}
                    isBoqDraft={isBoqDraft}
                    onOpenRateModal={onOpenRateModal}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export function BoqDetailModal({ isOpen, boq, onClose, onRefresh, onEdit }) {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const isAdmin = Boolean(user?.is_super_admin) || String(user?.role_name || user?.role || '').toLowerCase().includes('admin');
  const canApprove = isAdmin || hasPermission('boq.approve');
  const canSubmit = isAdmin || hasPermission('boq.submit');
  const canUpdate = isAdmin || hasPermission('boq.update');

  const [detail, setDetail] = useState(null);
  const [sections, setSections] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Dialog states for approval & rejection
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionReasonError, setRejectionReasonError] = useState('');
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);

  // Rate analysis modal target
  const [rateModalItem, setRateModalItem] = useState(null);

  useEffect(() => {
    if (!isOpen || !boq?.id) return;
    setLoading(true);
    Promise.all([
      boqApi.get(boq.id),
      boqApi.sections.list(boq.id),
      boqApi.items.list(boq.id),
    ])
      .then(([detailRes, sectionsRes, itemsRes]) => {
        setDetail(detailRes?.data?.project_boq ?? detailRes?.data ?? detailRes);
        const sList = sectionsRes?.data?.boq_sections ?? sectionsRes?.data?.sections ?? sectionsRes?.sections ?? (Array.isArray(sectionsRes?.data) ? sectionsRes.data : []);
        setSections(Array.isArray(sList) ? sList : []);
        const iList = itemsRes?.data?.boq_items ?? itemsRes?.data?.items ?? itemsRes?.boq_items ?? itemsRes?.items ?? (Array.isArray(itemsRes?.data) ? itemsRes.data : []);
        setAllItems(Array.isArray(iList) ? iList : []);
      })
      .catch(() => {
        setDetail(boq);
        setSections([]);
        setAllItems([]);
      })
      .finally(() => setLoading(false));
  }, [isOpen, boq?.id, refreshKey]);

  if (!isOpen || !boq) return null;

  const d = detail || boq;
  const status = d.status_name || d.status || (d.status_code === 'UNDER_REVIEW' ? 'Under Review' : d.status_code) || 'Draft';
  const statusCode = String(d.status_code || d.status || status).toUpperCase();
  const isDraft = statusCode.includes('DRAFT');
  const isSubmitted = statusCode.includes('REVIEW') || statusCode.includes('SUBMITTED');
  const isApproved = statusCode.includes('APPROVED');
  const isRejected = statusCode.includes('REJECTED');

  const handleConfirmSubmit = async () => {
    setActionLoading(true);
    try {
      await boqApi.submit(boq.id, {});
      toast.success('BOQ submitted for approval successfully.');
      setRefreshKey((v) => v + 1);
      onRefresh?.();
    } catch (err) {
      toast.error(err?.message || 'Failed to submit BOQ.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmApprove = async () => {
    setActionLoading(true);
    try {
      await boqApi.approve(boq.id, {});
      toast.success('BOQ approved successfully.');
      setApproveDialogOpen(false);
      setRefreshKey((v) => v + 1);
      onRefresh?.();
    } catch (err) {
      toast.error(err?.message || 'Failed to approve BOQ.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    const trimmed = rejectionReason.trim();
    if (!trimmed) {
      setRejectionReasonError('Rejection reason is required.');
      return;
    }
    setActionLoading(true);
    try {
      await boqApi.reject(boq.id, { remarks: trimmed });
      toast.success('BOQ rejected successfully.');
      setRejectionDialogOpen(false);
      setRejectionReason('');
      setRejectionReasonError('');
      setRefreshKey((v) => v + 1);
      onRefresh?.();
    } catch (err) {
      toast.error(err?.message || 'Failed to reject BOQ.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-surface border border-border rounded-lg shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-border bg-surface-muted/30 shrink-0">
            <div className="flex gap-3.5 items-center">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-text-primary">{d.boq_name || d.name || 'BOQ Details'}</h2>
                  <Badge variant={getStatusVariant(status)} className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 inline-flex items-center">
                    {status}
                  </Badge>
                </div>
                <p className="text-xs text-text-secondary mt-0.5">
                  <span className="font-mono font-semibold">{d.boq_code || d.code}</span> · Project: <strong>{d.project_name || 'Project'}</strong> {d.project_code ? `(${d.project_code})` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Share Public Link Button */}
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-medium text-text-secondary hover:text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 shadow-2xs"
                onClick={() => shareBoqLink(d)}
                leftIcon={<Share2 className="w-3.5 h-3.5 text-indigo-600" />}
                title="Copy Public Share Link (No Auth Required)"
              >
                Share Link
              </Button>

              {/* Preview BOQ Report Template Button */}
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-medium text-text-secondary hover:text-sky-700 hover:bg-sky-50 hover:border-sky-300 shadow-2xs"
                onClick={() => previewBoqTemplate({ ...d, sections, items: allItems })}
                leftIcon={<ExternalLink className="w-3.5 h-3.5 text-sky-600" />}
                title="Preview BOQ Report Template"
              >
                Preview BOQ
              </Button>

              {/* Download BOQ Report Template Button */}
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-medium text-text-secondary hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 shadow-2xs"
                onClick={() => downloadBoqTemplate({ ...d, sections, items: allItems })}
                leftIcon={<Download className="w-3.5 h-3.5 text-emerald-600" />}
                title="Download BOQ Report Template"
              >
                Download BOQ
              </Button>

              {/* Status Actions */}
              {isDraft && canSubmit && (
                <Button
                  variant="primary"
                  size="sm"
                  className="h-8 text-xs font-medium shadow-xs"
                  onClick={handleConfirmSubmit}
                  disabled={actionLoading}
                  leftIcon={<Send className="w-3.5 h-3.5" />}
                >
                  Submit for Approval
                </Button>
              )}

              {isSubmitted && canApprove && (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    className="h-8 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                    onClick={() => setApproveDialogOpen(true)}
                    disabled={actionLoading}
                    leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-medium text-rose-600 border-rose-200 hover:bg-rose-50"
                    onClick={() => {
                      setRejectionReason('');
                      setRejectionReasonError('');
                      setRejectionDialogOpen(true);
                    }}
                    disabled={actionLoading}
                    leftIcon={<XCircle className="w-3.5 h-3.5" />}
                  >
                    Reject
                  </Button>
                </>
              )}

              {isRejected && canUpdate && (
                <Button
                  variant="primary"
                  size="sm"
                  className="h-8 text-xs font-medium shadow-xs"
                  onClick={() => {
                    onClose?.();
                    if (onEdit) {
                      onEdit(d);
                    } else {
                      navigate(`/boq/${d.id}/edit`);
                    }
                  }}
                  leftIcon={<Edit className="w-3.5 h-3.5" />}
                >
                  Edit & Re-submit BOQ
                </Button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-muted rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-6 py-3 border-b border-border bg-surface shrink-0">
            <div>
              <div className="text-[10px] text-text-secondary uppercase font-semibold">Total Sections</div>
              <div className="text-lg font-bold text-text-primary flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-primary" />
                {sections.length}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-text-secondary uppercase font-semibold">Total BOQ Items</div>
              <div className="text-lg font-bold text-text-primary flex items-center gap-1.5">
                <Boxes className="w-4 h-4 text-secondary" />
                {allItems.length}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-text-secondary uppercase font-semibold">Total BOQ Amount</div>
              <div className="text-lg font-bold font-mono text-text-primary">
                {formatCurrency(d.total_amount || d.grand_total)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-text-secondary uppercase font-semibold">Baseline Date</div>
              <div className="text-sm font-semibold text-text-primary mt-1">
                {d.boq_date ? d.boq_date.substring(0, 10) : '—'}
              </div>
            </div>
          </div>

          {/* Hierarchy Display (Section -> Items -> Rate Components) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-surface-muted/20">
            {/* Approval / Review Information for REJECTED BOQ (Requirements 6, 7, 8) */}
            {isRejected && (
              <div className="bg-rose-50/90 border border-rose-200 rounded-lg p-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                      <XCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900">Approval / Review Information</h4>
                        <Badge variant="error" className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 inline-flex items-center">
                          REJECTED
                        </Badge>
                      </div>
                      <div className="text-xs text-rose-800 mt-1">
                        <span className="font-semibold text-rose-950">Rejection Reason: </span>
                        <span>
                          {d.rejection_reason || d.rejection_remarks || d.remarks || (
                            <span className="italic text-rose-600">Rejection reason was submitted by approver (current API does not store/return reason field).</span>
                          )}
                        </span>
                      </div>
                      {d.updated_at && (
                        <div className="text-[10px] text-rose-600 mt-1">
                          Reviewed: {new Date(d.updated_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>

                  {canUpdate && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-semibold bg-white border-rose-300 text-rose-700 hover:bg-rose-100 hover:border-rose-400 shrink-0 shadow-2xs self-start sm:self-auto"
                      onClick={() => {
                        onClose?.();
                        if (onEdit) {
                          onEdit(d);
                        } else {
                          navigate(`/boq/${d.id}/edit`);
                        }
                      }}
                    >
                      <Edit className="w-3.5 h-3.5 mr-1 text-rose-600" />
                      Edit & Re-submit BOQ
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Approval Information for APPROVED BOQ */}
            {isApproved && (
              <div className="bg-emerald-50/90 border border-emerald-200 rounded-lg p-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900">Approval / Review Information</h4>
                      <Badge variant="success" className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 inline-flex items-center">
                        APPROVED
                      </Badge>
                    </div>
                    <p className="text-xs text-emerald-800 mt-1">
                      {d.approved_by_first_name
                        ? `Approved by ${d.approved_by_first_name} ${d.approved_by_last_name || ''} ${d.approved_by_employee_code ? `(${d.approved_by_employee_code})` : ''}`
                        : 'This BOQ has been reviewed and approved as the active baseline for this project.'}
                      {d.approved_at ? ` on ${new Date(d.approved_at).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {loading ? (
              <div className="py-16 text-center text-text-muted text-[13px]">
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span>Loading BOQ Sections & Items hierarchy...</span>
                </div>
              </div>
            ) : sections.length === 0 && allItems.length === 0 ? (
              <div className="py-16 text-center text-text-muted text-[13px] bg-surface rounded-lg border border-border p-8">
                <FileSpreadsheet className="w-8 h-8 text-text-muted/60 mx-auto mb-2" />
                <h3 className="font-semibold text-text-secondary">No Sections or Items Found</h3>
                <p className="text-xs text-text-muted mt-1">This BOQ does not have any sections or items defined yet.</p>
              </div>
            ) : (
              <>
                {sections.map((section) => {
                  const sectionItems = allItems.filter(
                    (item) => Number(item.section_id) === Number(section.id)
                  );
                  return (
                    <SectionCard
                      key={section.id}
                      section={section}
                      items={sectionItems}
                      boqId={boq.id}
                      isBoqDraft={isDraft}
                      onOpenRateModal={(item) => setRateModalItem({ ...item, boq_id: boq.id })}
                    />
                  );
                })}

                {/* Unassigned or General Items (items not belonging to any displayed section) */}
                {(() => {
                  const unassigned = allItems.filter(
                    (item) => !item.section_id || !sections.some((s) => Number(s.id) === Number(item.section_id))
                  );
                  if (unassigned.length === 0) return null;
                  return (
                    <SectionCard
                      key="unassigned-general-items"
                      section={{
                        id: 'unassigned',
                        section_code: 'GEN',
                        section_name: 'General / Uncategorized Items',
                        description: 'Items created without a section assignment',
                        section_amount: unassigned.reduce(
                          (sum, i) => sum + Number(i.amount || (Number(i.quantity || 0) * Number(i.rate || 0)) || 0),
                          0
                        ),
                      }}
                      items={unassigned}
                      boqId={boq.id}
                      isBoqDraft={isDraft}
                      onOpenRateModal={(item) => setRateModalItem({ ...item, boq_id: boq.id })}
                    />
                  );
                })()}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Rejection Modal in BOQ Details (Requirements 3, 4, 5, 18, 19) */}
      {rejectionDialogOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
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
                  {d.boq_code || d.code || '—'}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase text-text-muted">BOQ Name:</div>
                <div className="text-xs font-medium text-text-primary">
                  {d.boq_name || d.name || '—'}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Reason for Rejection <span className="text-error">*</span>
                </label>
                <textarea
                  rows={4}
                  value={rejectionReason}
                  onChange={(e) => {
                    setRejectionReason(e.target.value);
                    if (rejectionReasonError && e.target.value.trim()) {
                      setRejectionReasonError('');
                    }
                  }}
                  placeholder="Enter the reason for rejecting this BOQ..."
                  className={`w-full text-xs p-2.5 rounded-md border ${
                    rejectionReasonError ? 'border-error ring-1 ring-error' : 'border-border'
                  } bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {rejectionReasonError && (
                  <p className="text-[11px] text-error mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {rejectionReasonError}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRejectionDialogOpen(false);
                  setRejectionReason('');
                  setRejectionReasonError('');
                }}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="error"
                size="sm"
                onClick={handleConfirmReject}
                disabled={actionLoading || !rejectionReason.trim()}
                className="bg-rose-600 hover:bg-rose-700 text-white font-medium"
              >
                {actionLoading ? 'Rejecting...' : 'Reject BOQ'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Confirmation Dialog in BOQ Details */}
      {approveDialogOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-lg shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary">Approve BOQ</h3>
                <p className="text-xs text-text-muted">Confirm approval for this project BOQ.</p>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <div>
                <div className="text-[11px] font-semibold uppercase text-text-muted">BOQ Code:</div>
                <div className="text-sm font-mono font-bold text-text-primary">
                  {d.boq_code || d.code || '—'}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase text-text-muted">BOQ Name:</div>
                <div className="text-xs font-medium text-text-primary">
                  {d.boq_name || d.name || '—'}
                </div>
              </div>
              <p className="text-xs text-text-secondary pt-2">
                Are you sure you want to approve this BOQ? This will move the status to <strong>APPROVED</strong>.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setApproveDialogOpen(false)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmApprove}
                disabled={actionLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {actionLoading ? 'Approving...' : 'Approve BOQ'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rate Analysis Modal trigger */}
      {rateModalItem && (
        <RateAnalysisModal
          isOpen={Boolean(rateModalItem)}
          item={rateModalItem}
          onClose={() => setRateModalItem(null)}
        />
      )}
    </>
  );
}

export default BoqDetailModal;
