import { useState, useEffect, Fragment } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Printer, Share2, Download, Loader2, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { toast } from '../../../components/composite/Toast';

export function BoqPublicPreviewPage() {
  const { id: paramId } = useParams();
  const [searchParams] = useSearchParams();
  const id = paramId || searchParams.get('id') || searchParams.get('view');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [boq, setBoq] = useState(null);

  useEffect(() => {
    if (!id) {
      setError('No BOQ identifier provided.');
      setLoading(false);
      return;
    }

    const fetchBoq = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiBase = import.meta.env.VITE_API_BASE_URL || '/api';
        // Try public endpoint first
        let res;
        try {
          res = await axios.get(`${apiBase}/public/boqs/${id}`, { withCredentials: true });
        } catch (e) {
          // Fallback to standard endpoint
          res = await axios.get(`${apiBase}/project-boqs/${id}`, { withCredentials: true });
        }

        const data = res?.data?.data?.project_boq ?? res?.data?.project_boq ?? res?.data?.data ?? res?.data;
        if (data) {
          let sections = data.sections || [];
          let items = data.items || [];

          // If sections/items weren't embedded, attempt to load them
          if ((!sections.length || !items.length) && data.id) {
            try {
              const [sRes, iRes] = await Promise.all([
                axios.get(`${apiBase}/project-boqs/${data.id}/sections`, { withCredentials: true }).catch(() => null),
                axios.get(`${apiBase}/project-boqs/${data.id}/items`, { withCredentials: true }).catch(() => null),
              ]);
              if (sRes?.data) {
                sections = sRes.data.data?.boq_sections ?? sRes.data.data ?? sRes.data;
              }
              if (iRes?.data) {
                items = iRes.data.data?.boq_items ?? iRes.data.data ?? iRes.data;
              }
            } catch (err) {
              console.warn('Could not fetch nested sections/items:', err);
            }
          }

          setBoq({
            ...data,
            sections: Array.isArray(sections) ? sections : [],
            items: Array.isArray(items) ? items : []
          });
        } else {
          setError('Bill of Quantities (BOQ) record not found.');
        }
      } catch (err) {
        console.error('Failed to load BOQ preview:', err);
        setError(err.response?.data?.message || err.message || 'Failed to load BOQ record.');
      } finally {
        setLoading(false);
      }
    };

    fetchBoq();
  }, [id]);

  const handleCopyLink = () => {
    const url = window.location.href;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url)
        .then(() => toast.success('Public share link copied to clipboard!'))
        .catch(() => toast.info(`Share link: ${url}`));
    } else {
      try {
        const el = document.createElement('textarea');
        el.value = url;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        toast.success('Public share link copied to clipboard!');
      } catch {
        toast.info(`Share link: ${url}`);
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium">Loading Bill of Quantities Report...</p>
        </div>
      </div>
    );
  }

  if (error || !boq) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md w-full text-center shadow-md">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800 mb-1">BOQ Report Unavailable</h2>
          <p className="text-sm text-slate-600 mb-5">{error || 'The requested BOQ record could not be found.'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  const boqCode = boq.boq_code || boq.code || `BOQ-${boq.id}`;
  const boqName = boq.boq_name || boq.name || 'Schedule of Rates';
  const projectName = boq.project_name || 'Project Scope';
  const projectCode = boq.project_code ? ` (${boq.project_code})` : '';
  const baselineDate = boq.boq_date ? boq.boq_date.substring(0, 10) : '—';
  const exportedOn = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  const totalVal = Number(boq.total_amount || boq.grand_total || 0);
  const totalFormatted = '₹ ' + totalVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Status color styles
  const sText = boq.status_name || boq.status_code || boq.status || 'Active BOQ';
  const sLower = String(sText).toLowerCase();
  let statusBadgeClass = 'bg-slate-100 text-slate-700 border-slate-300';
  if (sLower.includes('approved')) {
    statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (sLower.includes('reject')) {
    statusBadgeClass = 'bg-red-50 text-red-700 border-red-200';
  } else if (sLower.includes('review') || sLower.includes('submit')) {
    statusBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
  }

  const sections = boq.sections || [];
  const items = boq.items || [];

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-3 sm:px-6 font-sans text-slate-900 print:bg-white print:p-0">
      {/* Top Action Bar */}
      <div className="max-w-[1080px] mx-auto mb-4 flex items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">CivilDesk ERP • Public Document View</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-md shadow-xs transition"
            title="Copy Public Shareable Link"
          >
            <Share2 className="w-3.5 h-3.5 text-sky-600" />
            <span>Copy Link</span>
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-md shadow-xs transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save as PDF</span>
          </button>
        </div>
      </div>

      {/* Main Document Container */}
      <div className="max-w-[1080px] mx-auto bg-white border border-slate-300 rounded-lg shadow-md p-6 sm:p-9 print:border-none print:shadow-none print:p-0">
        {/* Header Bar */}
        <div className="flex items-start justify-between border-b-2 border-blue-600 pb-4 mb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">CIVILDESK ERP</h1>
            <h2 className="text-xs sm:text-sm font-bold text-blue-600 uppercase tracking-wider mt-0.5">BILL OF QUANTITIES (BOQ) REPORT</h2>
          </div>
          <div className="text-right">
            <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider border ${statusBadgeClass}`}>
              {sText}
            </span>
          </div>
        </div>

        {/* Metadata Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 sm:p-4 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-xs">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">BOQ Code</span>
            <span className="text-sm font-bold font-mono text-blue-600 mt-0.5">{boqCode}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">BOQ Title</span>
            <span className="text-sm font-semibold text-slate-900 mt-0.5">{boqName}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Parent Project</span>
            <span className="text-sm font-semibold text-slate-900 mt-0.5">{projectName}{projectCode}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Baseline Date</span>
            <span className="text-xs font-semibold text-slate-800 mt-0.5">{baselineDate}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Exported On</span>
            <span className="text-xs font-semibold text-slate-800 mt-0.5">{exportedOn}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Grand Total Amount (₹)</span>
            <span className="text-sm font-black font-mono text-emerald-700 mt-0.5">{totalFormatted}</span>
          </div>
        </div>

        {/* Itemized BOQ Table */}
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white uppercase text-[10px] font-bold tracking-wider">
                <th className="p-2 border border-slate-900 text-center w-10">Sl No</th>
                <th className="p-2 border border-slate-900 w-20">Section Code</th>
                <th className="p-2 border border-slate-900 w-28">Section Name</th>
                <th className="p-2 border border-slate-900 w-20">Item Code</th>
                <th className="p-2 border border-slate-900">Item Description</th>
                <th className="p-2 border border-slate-900 text-right w-16">Quantity</th>
                <th className="p-2 border border-slate-900 text-center w-12">UOM</th>
                <th className="p-2 border border-slate-900 text-right w-24">Unit Rate (₹)</th>
                <th className="p-2 border border-slate-900 text-right w-28">Total Amount (₹)</th>
                <th className="p-2 border border-slate-900 w-32">Specification / Notes</th>
              </tr>
            </thead>
            <tbody>
              {sections.length > 0 ? (
                sections.map((sec, sIdx) => {
                  const secItems = items.filter(
                    (it) => String(it.section_id || it.boq_section_id) === String(sec.id)
                  );
                  return (
                    <Fragment key={sec.id || sIdx}>
                      <tr className="bg-slate-100 border border-slate-300">
                        <td colSpan={10} className="p-2 font-bold text-slate-900 text-[11px] border border-slate-300">
                          <span className="inline-block bg-blue-600 text-white px-1.5 py-0.5 rounded text-[10px] font-mono mr-2">
                            {sec.section_code || 'SEC'}
                          </span>
                          {sec.section_name || sec.name || 'Section Scope'}
                          {sec.description && (
                            <span className="font-normal text-slate-500 text-[10px] ml-2">— {sec.description}</span>
                          )}
                        </td>
                      </tr>
                      {secItems.map((it, iIdx) => {
                        const qty = Number(it.quantity || it.qty || 0);
                        const rate = Number(it.rate || it.unit_rate || 0);
                        const amt = Number(it.amount || it.total_amount || (qty * rate) || 0);
                        return (
                          <tr key={it.id || iIdx} className="border-b border-slate-200 hover:bg-slate-50/50">
                            <td className="p-2 text-center text-slate-600 border border-slate-200">{iIdx + 1}</td>
                            <td className="p-2 font-mono font-semibold text-slate-800 border border-slate-200">{sec.section_code || '—'}</td>
                            <td className="p-2 text-slate-700 border border-slate-200">{sec.section_name || sec.name || '—'}</td>
                            <td className="p-2 font-mono font-semibold text-sky-600 border border-slate-200">{it.item_code || it.code || `ITEM-${it.id}`}</td>
                            <td className="p-2 font-medium text-slate-900 border border-slate-200">{it.item_name || it.description || it.item_description || '—'}</td>
                            <td className="p-2 text-right font-mono text-slate-800 border border-slate-200">{qty.toLocaleString('en-IN')}</td>
                            <td className="p-2 text-center text-slate-600 border border-slate-200">{it.unit_symbol || it.unit_name || it.unit || 'Nos'}</td>
                            <td className="p-2 text-right font-mono text-slate-700 border border-slate-200">₹ {rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="p-2 text-right font-mono font-bold text-slate-900 border border-slate-200">₹ {amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="p-2 text-[10px] text-slate-500 border border-slate-200">{it.specification || it.notes || it.remarks || '—'}</td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })
              ) : items.length > 0 ? (
                items.map((it, iIdx) => {
                  const qty = Number(it.quantity || it.qty || 0);
                  const rate = Number(it.rate || it.unit_rate || 0);
                  const amt = Number(it.amount || it.total_amount || (qty * rate) || 0);
                  return (
                    <tr key={it.id || iIdx} className="border-b border-slate-200 hover:bg-slate-50/50">
                      <td className="p-2 text-center text-slate-600 border border-slate-200">{iIdx + 1}</td>
                      <td className="p-2 font-mono font-semibold text-slate-800 border border-slate-200">SEC-01</td>
                      <td className="p-2 text-slate-700 border border-slate-200">Main Scope</td>
                      <td className="p-2 font-mono font-semibold text-sky-600 border border-slate-200">{it.item_code || it.code || `ITEM-${it.id}`}</td>
                      <td className="p-2 font-medium text-slate-900 border border-slate-200">{it.item_name || it.description || it.item_description || '—'}</td>
                      <td className="p-2 text-right font-mono text-slate-800 border border-slate-200">{qty.toLocaleString('en-IN')}</td>
                      <td className="p-2 text-center text-slate-600 border border-slate-200">{it.unit_symbol || it.unit_name || it.unit || 'Nos'}</td>
                      <td className="p-2 text-right font-mono text-slate-700 border border-slate-200">₹ {rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono font-bold text-slate-900 border border-slate-200">₹ {amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-2 text-[10px] text-slate-500 border border-slate-200">{it.specification || it.notes || it.remarks || '—'}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-slate-400 italic border border-slate-200">
                    No item breakdown recorded for this Bill of Quantities.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Grand Total Box */}
        <div className="flex justify-end mb-8">
          <div className="bg-slate-50 border-2 border-slate-900 rounded-md py-2.5 px-5 min-w-[280px] flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-600">Grand Total Amount:</span>
            <span className="text-base font-black font-mono text-emerald-700">{totalFormatted}</span>
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-6 mt-12 pt-5 border-t border-dashed border-slate-300 text-center">
          <div>
            <div className="w-4/5 mx-auto border-t border-slate-900 mb-1.5" />
            <div className="text-xs font-bold text-slate-800">Prepared By</div>
            <div className="text-[10px] text-slate-500">Quantity Surveyor / Estimation Team</div>
          </div>
          <div>
            <div className="w-4/5 mx-auto border-t border-slate-900 mb-1.5" />
            <div className="text-xs font-bold text-slate-800">Checked By</div>
            <div className="text-[10px] text-slate-500">Project Manager / Lead Engineer</div>
          </div>
          <div>
            <div className="w-4/5 mx-auto border-t border-slate-900 mb-1.5" />
            <div className="text-xs font-bold text-slate-800">Approved By</div>
            <div className="text-[10px] text-slate-500">Client Representative / Authority</div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center text-[9px] text-slate-400 mt-8 pt-3 border-t border-slate-100">
          This document is an authentic certified Bill of Quantities generated via CivilDesk Construction ERP. All rates, units, and quantities are binding as per tender baseline specifications.
        </div>
      </div>
    </div>
  );
}
