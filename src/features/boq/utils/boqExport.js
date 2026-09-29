import { boqApi } from '../../../api/apiservice';
import { toast } from '../../../components/composite/Toast';

/**
 * Helper to build the full styled HTML document string for a BOQ
 */
async function generateBoqHtml(boq) {
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

  // Status badge styling
  let statusBg = '#f1f5f9';
  let statusColor = '#475569';
  const sText = boq.status_name || boq.status_code || boq.status || 'Active BOQ';
  const sLower = String(sText).toLowerCase();
  if (sLower.includes('approved')) {
    statusBg = '#dcfce7';
    statusColor = '#15803d';
  } else if (sLower.includes('reject')) {
    statusBg = '#fee2e2';
    statusColor = '#b91c1c';
  } else if (sLower.includes('review') || sLower.includes('submit')) {
    statusBg = '#fef3c7';
    statusColor = '#b45309';
  } else if (sLower.includes('draft')) {
    statusBg = '#f1f5f9';
    statusColor = '#475569';
  }

  // 1. Fetch full sections and items for this BOQ if not already present
  let sections = boq.sections || [];
  let items = boq.items || [];

  if (!Array.isArray(sections) || sections.length === 0 || !Array.isArray(items) || items.length === 0) {
    const [sRes, iRes] = await Promise.all([
      boqApi.sections.list(boq.id).catch(() => null),
      boqApi.items.list(boq.id).catch(() => null),
    ]);
    sections = sRes?.data?.boq_sections ?? sRes?.data?.sections ?? sRes?.sections ?? (Array.isArray(sRes?.data) ? sRes.data : []);
    items = iRes?.data?.boq_items ?? iRes?.data?.items ?? iRes?.boq_items ?? iRes?.items ?? (Array.isArray(iRes?.data) ? iRes.data : []);
  }

  // 2. Build Table Rows
  let rowsHtml = '';
  let rowNum = 1;

  if (Array.isArray(sections) && sections.length > 0) {
    sections.forEach((sec) => {
      const secItems = items.filter(
        (it) => String(it.section_id || it.boq_section_id) === String(sec.id)
      );

      // Section header divider row
      rowsHtml += `
        <tr class="section-header-row">
          <td colspan="10" style="background-color: #f1f5f9; padding: 7px 12px; font-weight: 700; color: #0f172a; border: 1px solid #cbd5e1; font-size: 11px;">
            <span style="display: inline-block; background: #2563eb; color: #ffffff; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-right: 8px;">
              ${sec.section_code || 'SEC'}
            </span>
            ${sec.section_name || sec.name || 'Section Scope'}
            ${sec.description ? `<span style="font-weight: 400; color: #64748b; margin-left: 8px; font-size: 10px;">— ${sec.description}</span>` : ''}
          </td>
        </tr>
      `;

      if (secItems.length > 0) {
        secItems.forEach((it) => {
          const qty = Number(it.quantity || it.qty || 0);
          const rate = Number(it.rate || it.unit_rate || 0);
          const amt = Number(it.amount || it.total_amount || (qty * rate) || 0);

          rowsHtml += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 8px; text-align: center; border: 1px solid #e2e8f0; font-size: 11px; color: #475569;">${rowNum++}</td>
              <td style="padding: 6px 8px; font-family: monospace; font-weight: 600; border: 1px solid #e2e8f0; font-size: 11px; color: #1e293b;">${sec.section_code || '—'}</td>
              <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-size: 11px; color: #334155;">${sec.section_name || sec.name || '—'}</td>
              <td style="padding: 6px 8px; font-family: monospace; font-weight: 600; border: 1px solid #e2e8f0; font-size: 11px; color: #0284c7;">${it.item_code || it.code || `ITEM-${it.id}`}</td>
              <td style="padding: 6px 8px; font-weight: 500; border: 1px solid #e2e8f0; font-size: 11px; color: #0f172a;">
                ${it.item_name || it.description || it.item_description || '—'}
              </td>
              <td style="padding: 6px 8px; text-align: right; font-family: monospace; border: 1px solid #e2e8f0; font-size: 11px; color: #1e293b;">${qty.toLocaleString('en-IN')}</td>
              <td style="padding: 6px 8px; text-align: center; border: 1px solid #e2e8f0; font-size: 11px; color: #64748b;">${it.unit_symbol || it.unit_name || it.unit || 'Nos'}</td>
              <td style="padding: 6px 8px; text-align: right; font-family: monospace; border: 1px solid #e2e8f0; font-size: 11px; color: #334155;">₹ ${rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 700; border: 1px solid #e2e8f0; font-size: 11px; color: #0f172a;">₹ ${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-size: 10px; color: #64748b;">${it.specification || it.notes || it.remarks || '—'}</td>
            </tr>
          `;
        });
      }
    });
  } else if (Array.isArray(items) && items.length > 0) {
    items.forEach((it) => {
      const qty = Number(it.quantity || it.qty || 0);
      const rate = Number(it.rate || it.unit_rate || 0);
      const amt = Number(it.amount || it.total_amount || (qty * rate) || 0);

      rowsHtml += `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 6px 8px; text-align: center; border: 1px solid #e2e8f0; font-size: 11px; color: #475569;">${rowNum++}</td>
          <td style="padding: 6px 8px; font-family: monospace; font-weight: 600; border: 1px solid #e2e8f0; font-size: 11px; color: #1e293b;">SEC-01</td>
          <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-size: 11px; color: #334155;">Main Scope</td>
          <td style="padding: 6px 8px; font-family: monospace; font-weight: 600; border: 1px solid #e2e8f0; font-size: 11px; color: #0284c7;">${it.item_code || it.code || `ITEM-${it.id}`}</td>
          <td style="padding: 6px 8px; font-weight: 500; border: 1px solid #e2e8f0; font-size: 11px; color: #0f172a;">
            ${it.item_name || it.description || it.item_description || '—'}
          </td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; border: 1px solid #e2e8f0; font-size: 11px; color: #1e293b;">${qty.toLocaleString('en-IN')}</td>
          <td style="padding: 6px 8px; text-align: center; border: 1px solid #e2e8f0; font-size: 11px; color: #64748b;">${it.unit_symbol || it.unit_name || it.unit || 'Nos'}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; border: 1px solid #e2e8f0; font-size: 11px; color: #334155;">₹ ${rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 700; border: 1px solid #e2e8f0; font-size: 11px; color: #0f172a;">₹ ${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-size: 10px; color: #64748b;">${it.specification || it.notes || it.remarks || '—'}</td>
        </tr>
      `;
    });
  } else {
    rowsHtml += `
      <tr>
        <td colspan="10" style="padding: 24px; text-align: center; color: #94a3b8; font-style: italic; border: 1px solid #e2e8f0;">
          No item breakdown recorded for this Bill of Quantities.
        </td>
      </tr>
    `;
  }

  // 3. Construct Document HTML
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CIVILDESK ERP - ${boqCode}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      padding: 24px;
      line-height: 1.4;
    }
    .page-container {
      max-width: 1080px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.06);
      padding: 32px 36px;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .company-title {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
    }
    .report-title {
      font-size: 13px;
      font-weight: 700;
      color: #2563eb;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 4px;
    }
    .meta-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 14px 16px;
      margin-bottom: 24px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px 18px;
    }
    .meta-item {
      display: flex;
      flex-direction: column;
    }
    .meta-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.03em;
    }
    .meta-value {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
      margin-top: 2px;
    }
    .meta-highlight {
      font-size: 14px;
      font-weight: 800;
      color: #047857;
      font-family: monospace;
    }
    table.boq-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 11px;
    }
    table.boq-table th {
      background-color: #0f172a;
      color: #ffffff;
      padding: 8px 8px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      border: 1px solid #0f172a;
    }
    .summary-card {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 32px;
    }
    .total-box {
      background: #f8fafc;
      border: 2px solid #0f172a;
      border-radius: 6px;
      padding: 12px 20px;
      min-width: 280px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .signatures {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      margin-top: 48px;
      padding-top: 20px;
      border-top: 1px dashed #cbd5e1;
    }
    .sig-block {
      text-align: center;
    }
    .sig-line {
      border-top: 1px solid #0f172a;
      margin-bottom: 6px;
      width: 80%;
      margin-left: auto;
      margin-right: auto;
    }
    .sig-title {
      font-size: 11px;
      font-weight: 700;
      color: #334155;
    }
    .sig-role {
      font-size: 10px;
      color: #64748b;
    }
    .footer-note {
      text-align: center;
      font-size: 9px;
      color: #94a3b8;
      margin-top: 28px;
      border-top: 1px solid #f1f5f9;
      padding-top: 10px;
    }
    .no-print {
      max-width: 1080px;
      margin: 0 auto 16px auto;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .btn {
      padding: 8px 18px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: background 0.15s ease;
    }
    .btn-primary {
      background: #2563eb;
      color: #ffffff;
    }
    .btn-primary:hover {
      background: #1d4ed8;
    }
    .btn-secondary {
      background: #ffffff;
      color: #334155;
      border: 1px solid #cbd5e1;
    }
    .btn-secondary:hover {
      background: #f1f5f9;
    }
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .page-container {
        border: none;
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn btn-secondary" onclick="navigator.clipboard.writeText(window.location.origin + '/boq-preview/${boq.id}').then(() => alert('Public share link copied to clipboard!')).catch(() => prompt('Public share link:', window.location.origin + '/boq-preview/${boq.id}'))">Copy Share Link</button>
    <button class="btn btn-primary" onclick="window.print()">Print / Save as PDF</button>
  </div>

  <div class="page-container">
    <!-- Header -->
    <div class="header-bar">
      <div>
        <h1 class="company-title">CIVILDESK ERP</h1>
        <h2 class="report-title">BILL OF QUANTITIES (BOQ) REPORT</h2>
      </div>
      <div style="text-align: right;">
        <span style="display: inline-block; background: ${statusBg}; color: ${statusColor}; padding: 4px 10px; border-radius: 4px; font-weight: 700; font-size: 11px; font-family: monospace;">
          ${sText}
        </span>
      </div>
    </div>

    <!-- Metadata Grid -->
    <div class="meta-card">
      <div class="meta-item">
        <span class="meta-label">BOQ Code</span>
        <span class="meta-value" style="font-family: monospace; color: #2563eb;">${boqCode}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">BOQ Title</span>
        <span class="meta-value">${boqName}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Parent Project</span>
        <span class="meta-value">${projectName}${projectCode}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Baseline Date</span>
        <span class="meta-value">${baselineDate}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Exported On</span>
        <span class="meta-value">${exportedOn}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Grand Total Amount (₹)</span>
        <span class="meta-value meta-highlight">${totalFormatted}</span>
      </div>
    </div>

    <!-- BOQ Itemized Schedule Table -->
    <table class="boq-table">
      <thead>
        <tr>
          <th style="width: 40px; text-align: center;">Sl No</th>
          <th style="width: 70px;">Section Code</th>
          <th style="width: 110px;">Section Name</th>
          <th style="width: 80px;">Item Code</th>
          <th>Item Description</th>
          <th style="width: 60px; text-align: right;">Quantity</th>
          <th style="width: 50px; text-align: center;">UOM</th>
          <th style="width: 90px; text-align: right;">Unit Rate (₹)</th>
          <th style="width: 105px; text-align: right;">Total Amount (₹)</th>
          <th style="width: 110px;">Specification / Notes</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <!-- Grand Total Box -->
    <div class="summary-card">
      <div class="total-box">
        <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #475569;">Grand Total Amount:</span>
        <span style="font-size: 16px; font-weight: 800; font-family: monospace; color: #047857;">${totalFormatted}</span>
      </div>
    </div>

    <!-- Sign-off Block -->
    <div class="signatures">
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-title">Prepared By</div>
        <div class="sig-role">Quantity Surveyor / Estimation Team</div>
      </div>
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-title">Checked By</div>
        <div class="sig-role">Project Manager / Lead Engineer</div>
      </div>
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-title">Approved By</div>
        <div class="sig-role">Client Representative / Authority</div>
      </div>
    </div>

    <!-- Footer Note -->
    <div class="footer-note">
      This document is an authentic certified Bill of Quantities generated via CivilDesk Construction ERP. All rates, units, and quantities are binding as per tender baseline specifications.
    </div>
  </div>
</body>
</html>`;
}

/**
 * Preview a full Bill of Quantities (BOQ) report template in a new window/tab
 * @param {Object} boq - The BOQ object
 */
export async function previewBoqTemplate(boq) {
  if (!boq?.id) {
    toast.error('Invalid BOQ selected for preview.');
    return;
  }

  const boqCode = boq.boq_code || boq.code || `BOQ-${boq.id}`;
  toast.info(`Opening preview for ${boqCode}...`);

  try {
    const documentHtml = await generateBoqHtml(boq);
    const blob = new Blob([documentHtml], { type: 'text/html;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    
    const win = window.open(url, '_blank');
    if (!win) {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    setTimeout(() => window.URL.revokeObjectURL(url), 60000);
  } catch (error) {
    console.error('BOQ Preview Error:', error);
    toast.error('Failed to preview BOQ template document.');
  }
}

/**
 * Generate and copy a direct public shareable link for a BOQ preview (unauthenticated)
 * @param {Object} boq - The BOQ object
 */
export function shareBoqLink(boq) {
  if (!boq?.id) {
    toast.error('Invalid BOQ selected.');
    return;
  }

  const boqCode = boq.boq_code || boq.code || `BOQ #${boq.id}`;
  const origin = window.location.origin || '';
  const shareUrl = `${origin}/boq-preview/${boq.id}`;

  const performFallbackCopy = () => {
    try {
      const el = document.createElement('textarea');
      el.value = shareUrl;
      el.setAttribute('readonly', '');
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      toast.success(`Shareable public preview link for ${boqCode} copied to clipboard!`);
    } catch {
      toast.info(`Share link: ${shareUrl}`);
    }
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        toast.success(`Shareable public preview link for ${boqCode} copied to clipboard!`);
      })
      .catch(() => {
        performFallbackCopy();
      });
  } else {
    performFallbackCopy();
  }
}

/**
 * Download a full Bill of Quantities (BOQ) report template as an HTML file
 * @param {Object} boq - The BOQ object
 */
export async function downloadBoqTemplate(boq) {
  if (!boq?.id) {
    toast.error('Invalid BOQ selected for download.');
    return;
  }

  const boqCode = boq.boq_code || boq.code || `BOQ-${boq.id}`;
  const boqName = boq.boq_name || boq.name || 'Schedule of Rates';

  toast.info(`Generating BOQ template for ${boqCode}...`);

  try {
    const documentHtml = await generateBoqHtml(boq);
    const blob = new Blob([documentHtml], { type: 'text/html;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);

    const downloadLink = document.createElement('a');
    const safeFilename = `BOQ_REPORT_${boqCode}_${boqName}`.replace(/[^a-zA-Z0-9-_]/g, '_');
    downloadLink.href = url;
    downloadLink.setAttribute('download', `${safeFilename}.html`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    toast.success(`BOQ report "${boqCode}" downloaded successfully.`);
  } catch (error) {
    console.error('BOQ Download Error:', error);
    toast.error('Failed to download BOQ template document.');
  }
}

export const downloadBoqAsCsv = downloadBoqTemplate;

