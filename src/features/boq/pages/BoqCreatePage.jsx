import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FileSpreadsheet, Plus, Trash2, ChevronDown, ChevronRight,
  Send, Save, ArrowLeft, Layers, Boxes, IndianRupee,
  AlertCircle, CheckCircle2, Info, Sparkles, Hash, XCircle
} from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageContainer } from '../../../components/layout/PageContainer';
import { FormField } from '../../../components/composite/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { ConfirmDialog } from '../../../components/composite/ConfirmDialog';
import { toast } from '../../../components/composite/Toast';
import {
  boqApi,
  projectsApi,
  workCategoriesApi,
  unitsApi,
  sitesApi,
  mastersApi,
} from '../../../api/apiservice';
import { useAuth } from '../../auth/context/AuthContext';

const formatCurrency = (val) => {
  const num = Number(val || 0);
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const extractArray = (res, key) => {
  if (Array.isArray(res)) return res;
  if (key && res?.data?.[key] && Array.isArray(res.data[key])) return res.data[key];
  if (key && res?.[key] && Array.isArray(res[key])) return res[key];
  if (res?.data && Array.isArray(res.data)) return res.data;
  if (res?.data?.data && Array.isArray(res.data.data)) return res.data.data;
  return [];
};

const EMPTY_BOQ_FORM = {
  project_id: '',
  boq_code: '',
  boq_name: '',
  boq_date: new Date().toISOString().substring(0, 10),
  valid_from: '',
  currency_code: 'INR',
  notes: '',
};

export function BoqCreatePage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const isAdmin = Boolean(user?.is_super_admin) || String(user?.role_name || user?.role || '').toLowerCase().includes('admin');
  const canCreate = isAdmin || hasPermission('boq.create');
  const canUpdate = isAdmin || hasPermission('boq.update');

  // Master Data States
  const [projects, setProjects] = useState([]);
  const [workCategories, setWorkCategories] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [projectSites, setProjectSites] = useState([]);
  const [existingProjectBoqs, setExistingProjectBoqs] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Form State
  const [boqForm, setBoqForm] = useState(EMPTY_BOQ_FORM);
  const [sections, setSections] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const [boqStatus, setBoqStatus] = useState('DRAFT');
  const [rejectionReason, setRejectionReason] = useState('');

  // Monotonic sequence counters to avoid duplicate codes even after deletion
  const highestSectionSeqRef = useRef(0);

  // Submission / Loading States
  const [saving, setSaving] = useState(false);
  const [saveStepText, setSaveStepText] = useState('');
  const [confirmDeleteDialog, setConfirmDeleteDialog] = useState(null);

  // Helper to determine the next BOQ code based on project & existing BOQs
  const calculateNextBoqCode = useCallback((selectedProj, existingBoqs = []) => {
    if (!selectedProj) return '';
    const pCode = (selectedProj.project_code || 'PRJ').toUpperCase();

    const matchingBoqs = existingBoqs.filter(
      (b) => b.boq_code && (String(b.project_id) === String(selectedProj.id) || !selectedProj.id)
    );

    if (matchingBoqs.length === 0) {
      return `BOQ-${pCode}-001`;
    }

    let maxNum = 0;
    let prefix = `BOQ-${pCode}-`;
    let padLen = 3;

    matchingBoqs.forEach((b) => {
      const code = String(b.boq_code || '').trim();
      const m = code.match(/^(.*?)(\d+)$/);
      if (m) {
        const num = parseInt(m[2], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
          prefix = m[1];
          padLen = Math.max(padLen, m[2].length);
        }
      }
    });

    const nextNum = maxNum > 0 ? maxNum + 1 : 1;
    let nextCode = `${prefix}${String(nextNum).padStart(padLen, '0')}`;

    // Ensure collision avoidance
    const existingSet = new Set(matchingBoqs.map((b) => String(b.boq_code).toUpperCase()));
    let counter = nextNum;
    while (existingSet.has(nextCode.toUpperCase())) {
      counter++;
      nextCode = `${prefix}${String(counter).padStart(padLen, '0')}`;
    }

    return nextCode;
  }, []);

  // Helper to generate the next section code
  const getNextSectionCode = useCallback((seqNumber) => {
    return `SEC-${String(seqNumber).padStart(2, '0')}`;
  }, []);

  // Load Master Data
  useEffect(() => {
    let isMounted = true;
    setLoadingInitial(true);

    Promise.all([
      projectsApi.list().catch(() => ({ data: { projects: [] } })),
      workCategoriesApi.list().catch(() => ({ data: [] })),
      unitsApi.list().catch(() => ({ data: [] })),
      mastersApi.all().catch(() => ({ data: {} })),
      boqApi.list().catch(() => ({ data: [] })),
    ])
      .then(([projRes, catRes, uomRes, mRes, boqListRes]) => {
        if (!isMounted) return;

        const projList = extractArray(projRes, 'projects');
        let catList = extractArray(catRes, 'work_categories');
        let uomList = extractArray(uomRes, 'units_of_measurement');
        const allBoqs = extractArray(boqListRes, 'project_boqs');

        // Fallback from mastersApi if individual lists are empty
        const mastersData = mRes?.data || mRes || {};
        if (catList.length === 0 && Array.isArray(mastersData.work_categories)) {
          catList = mastersData.work_categories;
        }
        if (uomList.length === 0) {
          const mUoms = mastersData.units_of_measurement || mastersData.uoms || [];
          if (Array.isArray(mUoms) && mUoms.length > 0) uomList = mUoms;
        }

        setProjects(projList);
        setWorkCategories(catList.filter((c) => c.is_active !== 0));
        setUoms(uomList.filter((u) => u.is_active !== 0));
        setExistingProjectBoqs(allBoqs);

        // If creating a new BOQ, initialize with first section
        if (!isEditing) {
          highestSectionSeqRef.current = 1;
          const initialSecCode = getNextSectionCode(1);

          setSections([
            {
              tempId: `sec_${Date.now()}_1`,
              id: null,
              section_code: initialSecCode,
              section_name: '',
              description: '',
              display_order: 1,
              isExpanded: true,
              highestItemSeq: 0,
              items: [],
            },
          ]);
        }
      })
      .catch((err) => {
        toast.error('Failed to load master data. ' + (err?.message || ''));
      })
      .finally(() => {
        if (isMounted) setLoadingInitial(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isEditing, getNextSectionCode]);

  // Load existing BOQ if in Edit Mode
  useEffect(() => {
    if (!isEditing) return;

    let isMounted = true;
    setLoadingInitial(true);

    Promise.all([
      boqApi.get(id),
      boqApi.sections.list(id).catch(() => ({ data: [] })),
      boqApi.items.list(id).catch(() => ({ data: [] })),
    ])
      .then(([boqRes, secRes, itmRes]) => {
        if (!isMounted) return;
        const boqData = boqRes?.data?.project_boq ?? boqRes?.data ?? boqRes;
        if (!boqData || !boqData.id) {
          toast.error('Project BOQ not found.');
          navigate('/boq');
          return;
        }

        // Only allow editing DRAFT or REJECTED BOQs (Requirements 8, 9, 14)
        const statusCode = String(boqData.status_code || boqData.status_name || '').toUpperCase();
        if (statusCode && !statusCode.includes('DRAFT') && !statusCode.includes('REJECTED')) {
          toast.error('Only DRAFT or REJECTED BOQs can be edited. This BOQ is currently ' + statusCode);
          navigate('/boq');
          return;
        }

        const isCurrentlyRejected = statusCode.includes('REJECTED');
        setBoqStatus(isCurrentlyRejected ? 'REJECTED' : 'DRAFT');
        setRejectionReason(boqData.rejection_reason || boqData.rejection_remarks || boqData.remarks || '');

        setBoqForm({
          project_id: String(boqData.project_id || ''),
          boq_code: boqData.boq_code || '',
          boq_name: boqData.boq_name || '',
          boq_date: boqData.boq_date ? boqData.boq_date.substring(0, 10) : '',
          valid_from: boqData.valid_from ? boqData.valid_from.substring(0, 10) : '',
          currency_code: boqData.currency_code || 'INR',
          notes: boqData.notes || '',
        });

        const rawSections = extractArray(secRes, 'boq_sections');
        const rawItems = extractArray(itmRes, 'boq_items');

        highestSectionSeqRef.current = rawSections.length;

        const populatedSections = rawSections.map((sec, sIdx) => {
          const secItems = rawItems
            .filter((itm) => Number(itm.section_id) === Number(sec.id))
            .map((itm, iIdx) => ({
              tempId: `itm_existing_${itm.id}`,
              id: itm.id,
              section_id: itm.section_id,
              item_code: itm.item_code || `${sIdx + 1}.${iIdx + 1}`,
              item_name: itm.item_name || '',
              work_category_id: String(itm.work_category_id || ''),
              uom_id: String(itm.uom_id || ''),
              site_id: itm.site_id ? String(itm.site_id) : '',
              quantity: Number(itm.quantity || 0),
              rate: Number(itm.rate || 0),
              amount: Number(itm.amount || Number(itm.quantity || 0) * Number(itm.rate || 0)),
              specification: itm.specification || '',
              notes: itm.notes || '',
            }));

          return {
            tempId: `sec_existing_${sec.id}`,
            id: sec.id,
            section_code: sec.section_code || getNextSectionCode(sIdx + 1),
            section_name: sec.section_name || '',
            description: sec.description || '',
            display_order: Number(sec.display_order || sIdx + 1),
            isExpanded: true,
            highestItemSeq: secItems.length,
            items: secItems,
          };
        });

        setSections(populatedSections);
      })
      .catch((err) => {
        toast.error('Failed to load BOQ details. ' + (err?.message || ''));
        navigate('/boq');
      })
      .finally(() => {
        if (isMounted) setLoadingInitial(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id, isEditing, navigate, getNextSectionCode]);

  // Load project sites whenever project changes
  useEffect(() => {
    if (!boqForm.project_id) {
      setProjectSites([]);
      return;
    }
    sitesApi.list({ project_id: boqForm.project_id })
      .then((res) => {
        const list = extractArray(res, 'project_sites');
        setProjectSites(list);
      })
      .catch(() => setProjectSites([]));
  }, [boqForm.project_id]);

  // Handle Project Selection & Automatic BOQ Code Generation
  const handleProjectSelect = (projectId) => {
    const proj = projects.find((p) => String(p.id) === String(projectId));
    const nextBoqCode = calculateNextBoqCode(proj, existingProjectBoqs);

    setBoqForm((prev) => ({
      ...prev,
      project_id: projectId,
      boq_code: nextBoqCode,
    }));

    setFormErrors((prev) => ({ ...prev, project_id: null }));

    // Reset section code prefixes if switching project to prevent stale codes
    if (!isEditing) {
      setSections((prev) =>
        prev.map((sec, idx) => ({
          ...sec,
          section_code: getNextSectionCode(idx + 1),
        }))
      );
    }
  };

  const handleBoqChange = (field, value) => {
    setBoqForm((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => ({ ...prev, [field]: null }));
  };

  // -------------------------------------------------------------
  // Section Management (Automated Section Code Generation)
  // -------------------------------------------------------------
  const handleAddSection = () => {
    highestSectionSeqRef.current += 1;
    const newSeq = highestSectionSeqRef.current;
    const newSecCode = getNextSectionCode(newSeq);

    const newSection = {
      tempId: `sec_${Date.now()}_${newSeq}`,
      id: null,
      section_code: newSecCode,
      section_name: '',
      description: '',
      display_order: sections.length + 1,
      isExpanded: true,
      highestItemSeq: 0,
      items: [],
    };

    setSections((prev) => [...prev, newSection]);
    setFormErrors((prev) => ({ ...prev, sections: null }));
  };

  const handleSectionChange = (sectionTempId, field, value) => {
    setSections((prev) =>
      prev.map((sec) => (sec.tempId === sectionTempId ? { ...sec, [field]: value } : sec))
    );
    setFormErrors((prev) => ({ ...prev, [`${sectionTempId}_${field}`]: null }));
  };

  const handleToggleSectionExpand = (sectionTempId) => {
    setSections((prev) =>
      prev.map((sec) => (sec.tempId === sectionTempId ? { ...sec, isExpanded: !sec.isExpanded } : sec))
    );
  };

  const handlePromptDeleteSection = (sec, secIndex) => {
    const itemCount = sec.items?.length || 0;
    const hasData = Boolean(sec.section_name?.trim()) || itemCount > 0;
    if (hasData) {
      setConfirmDeleteDialog({
        type: 'section',
        target: sec,
        title: `Delete Section ${String(secIndex + 1).padStart(2, '0')} (${sec.section_code})?`,
        message: `This section contains ${itemCount} item(s). Deleting it will remove this entire section and its line items.`,
      });
    } else {
      executeDeleteSection(sec.tempId);
    }
  };

  const executeDeleteSection = (sectionTempId) => {
    setSections((prev) => prev.filter((s) => s.tempId !== sectionTempId));
  };

  // -------------------------------------------------------------
  // Items Management (Automated Hierarchical Item Code Generation)
  // -------------------------------------------------------------
  const handleAddItem = (sectionTempId) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.tempId !== sectionTempId) return sec;

        const secIndex = prev.findIndex((s) => s.tempId === sectionTempId) + 1;
        const nextItemSeq = (sec.highestItemSeq || 0) + 1;

        // Auto-select first active UOM and Work Category as sensible defaults
        const defaultCatId = workCategories[0] ? String(workCategories[0].id) : '';
        const defaultUomId = uoms[0] ? String(uoms[0].id) : '';

        // Hierarchical code: SectionIndex.ItemIndex (e.g. 1.1, 1.2, 2.1, 2.2)
        const autoItemCode = `${secIndex}.${nextItemSeq}`;

        const newItem = {
          tempId: `itm_${Date.now()}_${secIndex}_${nextItemSeq}`,
          id: null,
          item_code: autoItemCode,
          item_name: '',
          work_category_id: defaultCatId,
          uom_id: defaultUomId,
          site_id: '',
          quantity: 1,
          rate: 0,
          amount: 0,
          specification: '',
          notes: '',
        };

        return {
          ...sec,
          isExpanded: true,
          highestItemSeq: nextItemSeq,
          items: [...sec.items, newItem],
        };
      })
    );
    setFormErrors((prev) => ({ ...prev, items: null }));
  };

  const handleItemChange = (sectionTempId, itemTempId, field, value) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.tempId !== sectionTempId) return sec;
        const updatedItems = sec.items.map((itm) => {
          if (itm.tempId !== itemTempId) return itm;

          const nextItm = { ...itm, [field]: value };
          if (field === 'quantity' || field === 'rate') {
            const q = field === 'quantity' ? Number(value || 0) : Number(itm.quantity || 0);
            const r = field === 'rate' ? Number(value || 0) : Number(itm.rate || 0);
            nextItm.amount = Math.round(q * r * 100) / 100;
          }
          return nextItm;
        });

        return { ...sec, items: updatedItems };
      })
    );
    setFormErrors((prev) => ({ ...prev, [`${itemTempId}_${field}`]: null }));
  };

  const handlePromptDeleteItem = (sec, itm) => {
    if (itm.item_name?.trim() || Number(itm.quantity || 0) > 0 || Number(itm.rate || 0) > 0) {
      setConfirmDeleteDialog({
        type: 'item',
        target: { secTempId: sec.tempId, itmTempId: itm.tempId, code: itm.item_code },
        title: `Remove Item ${itm.item_code}?`,
        message: 'Are you sure you want to remove this line item from the section?',
      });
    } else {
      executeDeleteItem(sec.tempId, itm.tempId);
    }
  };

  const executeDeleteItem = (sectionTempId, itemTempId) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.tempId !== sectionTempId) return sec;
        return {
          ...sec,
          items: sec.items.filter((i) => i.tempId !== itemTempId),
        };
      })
    );
  };

  // -------------------------------------------------------------
  // Dynamic Summary Calculations
  // -------------------------------------------------------------
  const summary = useMemo(() => {
    let totalSections = sections.length;
    let totalItems = 0;
    let grandTotal = 0;

    sections.forEach((sec) => {
      totalItems += sec.items?.length || 0;
      sec.items?.forEach((itm) => {
        const amt = Number(itm.amount || Number(itm.quantity || 0) * Number(itm.rate || 0) || 0);
        grandTotal += amt;
      });
    });

    return {
      totalSections,
      totalItems,
      grandTotal: Math.round(grandTotal * 100) / 100,
      isValidToSubmit: totalSections >= 1 && totalItems >= 1,
    };
  }, [sections]);

  // -------------------------------------------------------------
  // Validation Logic
  // -------------------------------------------------------------
  const validateForm = (isSubmitAction = false) => {
    const errors = {};

    // 1. BOQ Master Info Validation
    if (!boqForm.project_id) {
      errors.project_id = 'Project selection is required.';
    }
    if (!boqForm.boq_name.trim()) {
      errors.boq_name = 'BOQ Title / Name is required.';
    }
    if (!boqForm.boq_date) {
      errors.boq_date = 'BOQ Baseline Date is required.';
    }

    // 2. Strict Requirement Check for "Submit BOQ"
    const sectionCount = summary.totalSections;
    const totalItemCount = summary.totalItems;

    if (isSubmitAction) {
      if (sectionCount === 0 && totalItemCount === 0) {
        toast.error('Add at least one section and one item before submitting the BOQ.');
        errors.general = 'Add at least one section and one item before submitting the BOQ.';
        setFormErrors(errors);
        return false;
      }
      if (sectionCount === 0) {
        toast.error('At least one section is required to submit the BOQ.');
        errors.sections = 'At least one section is required to submit the BOQ.';
        setFormErrors(errors);
        return false;
      }
      if (totalItemCount === 0) {
        toast.error('At least one item is required to submit the BOQ.');
        errors.items = 'At least one item is required to submit the BOQ.';
        setFormErrors(errors);
        return false;
      }
    }

    // 3. Sections & Items Field Validation
    sections.forEach((sec, sIdx) => {
      if (!sec.section_name.trim()) {
        errors[`${sec.tempId}_section_name`] = `Section Name is required (Section ${sIdx + 1}).`;
      }

      sec.items?.forEach((itm, iIdx) => {
        if (!itm.item_name.trim()) {
          errors[`${itm.tempId}_item_name`] = `Description is required (Item ${itm.item_code || iIdx + 1}).`;
        }
        if (!itm.work_category_id) {
          errors[`${itm.tempId}_work_category_id`] = `Work category is required.`;
        }
        if (!itm.uom_id) {
          errors[`${itm.tempId}_uom_id`] = `Unit (UOM) is required.`;
        }
        if (Number(itm.quantity) <= 0 && isSubmitAction) {
          errors[`${itm.tempId}_quantity`] = `Quantity must be greater than 0.`;
        }
        if (Number(itm.rate) < 0) {
          errors[`${itm.tempId}_rate`] = `Rate cannot be negative.`;
        }
      });
    });

    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      const firstKey = Object.keys(errors)[0];
      toast.error(errors[firstKey] || 'Please complete all required fields highlighted in red.');
      return false;
    }

    return true;
  };

  // -------------------------------------------------------------
  // Save & Submit Workflow (Existing API Persistence)
  // -------------------------------------------------------------
  const handleSave = async (submitForReview = false) => {
    if (!validateForm(submitForReview)) {
      return;
    }

    setSaving(true);
    try {
      setSaveStepText(isEditing ? 'Updating BOQ master...' : 'Creating BOQ master record...');

      // Ensure final BOQ Code is established
      let finalBoqCode = boqForm.boq_code;
      if (!finalBoqCode) {
        const proj = projects.find((p) => String(p.id) === String(boqForm.project_id));
        finalBoqCode = calculateNextBoqCode(proj, existingProjectBoqs);
      }

      const boqPayload = {
        project_id: Number(boqForm.project_id),
        boq_code: finalBoqCode,
        boq_name: boqForm.boq_name.trim(),
        boq_date: boqForm.boq_date,
        valid_from: boqForm.valid_from || null,
        currency_code: boqForm.currency_code || 'INR',
        notes: boqForm.notes?.trim() || null,
      };

      let targetBoqId = id;
      if (isEditing) {
        await boqApi.update(id, boqPayload);
      } else {
        const createRes = await boqApi.create(boqPayload);
        const createdBoq = createRes?.data?.project_boq ?? createRes?.data ?? createRes;
        targetBoqId = createdBoq?.id;
        if (!targetBoqId) {
          throw new Error('Failed to retrieve created BOQ ID from server.');
        }
      }

      // 2. Persist Sections and their Items
      for (let sIdx = 0; sIdx < sections.length; sIdx++) {
        const sec = sections[sIdx];
        setSaveStepText(`Saving Section ${sIdx + 1} of ${sections.length}: "${sec.section_name}"...`);

        const secPayload = {
          section_code: sec.section_code.trim().toUpperCase(),
          section_name: sec.section_name.trim(),
          description: sec.description?.trim() || null,
          display_order: sIdx + 1,
        };

        let targetSectionId = sec.id;
        if (isEditing && targetSectionId) {
          await boqApi.sections.update(targetBoqId, targetSectionId, secPayload);
        } else {
          const secRes = await boqApi.sections.create(targetBoqId, secPayload);
          const createdSec = secRes?.data?.boq_section ?? secRes?.data ?? secRes;
          targetSectionId = createdSec?.id;
        }

        // Save items under this section
        for (let iIdx = 0; iIdx < (sec.items?.length || 0); iIdx++) {
          const itm = sec.items[iIdx];
          setSaveStepText(
            `Saving Section ${sIdx + 1} item ${iIdx + 1} of ${sec.items.length}: "${itm.item_name}"...`
          );

          const itmPayload = {
            section_id: targetSectionId,
            work_category_id: Number(itm.work_category_id),
            uom_id: Number(itm.uom_id),
            site_id: itm.site_id ? Number(itm.site_id) : null,
            item_code: itm.item_code.trim().toUpperCase(),
            item_name: itm.item_name.trim(),
            quantity: Number(itm.quantity || 0),
            rate: Number(itm.rate || 0),
            amount: Math.round(Number(itm.quantity || 0) * Number(itm.rate || 0) * 100) / 100,
            specification: itm.specification?.trim() || null,
            notes: itm.notes?.trim() || null,
            display_order: iIdx + 1,
          };

          if (isEditing && itm.id) {
            await boqApi.items.update(targetBoqId, itm.id, itmPayload);
          } else {
            await boqApi.items.create(targetBoqId, itmPayload);
          }
        }
      }

      // 3. Submit for review if requested
      if (submitForReview) {
        setSaveStepText(boqStatus === 'REJECTED' ? 'Re-submitting BOQ for review & approval...' : 'Submitting BOQ for review & approval...');
        await boqApi.submit(targetBoqId, {
          remarks: boqStatus === 'REJECTED' ? 'Re-submitted for approval after corrections' : 'Submitted via Create BOQ workflow'
        });
        toast.success('BOQ submitted for approval successfully.');
      } else {
        toast.success(
          boqStatus === 'REJECTED'
            ? `BOQ ${finalBoqCode} changes saved successfully.`
            : `BOQ ${finalBoqCode} saved as Draft successfully.`
        );
      }

      // Return to BOQ Register
      navigate('/boq', { replace: true });
    } catch (err) {
      console.error('Error saving BOQ:', err);
      toast.error(err?.message || 'Failed to complete BOQ save workflow.');
    } finally {
      setSaving(false);
      setSaveStepText('');
    }
  };

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'BOQ & Project Budget', href: '/boq' },
    { label: 'BOQ Register', href: '/boq' },
    { label: isEditing ? 'Edit BOQ' : 'Create BOQ' },
  ];

  if (loadingInitial) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-text-secondary">Loading BOQ workspace & catalogues...</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/80">
        <PageHeader
          title={isEditing ? `Edit BOQ — ${boqForm.boq_code || ''}` : 'Create Bill of Quantities (BOQ)'}
          breadcrumbs={breadcrumbs}
          description="Build project scope hierarchy with multi-level sections, line items, scheduled quantities, and rate specifications."
        />
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/boq')}
            disabled={saving}
            className="text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to Register
          </Button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex flex-col gap-5 mt-3 pb-20">
        {/* Rejected BOQ Notice Banner (Requirements 8, 9, 14, 15) */}
        {boqStatus === 'REJECTED' && (
          <div className="bg-rose-50/90 border border-rose-200 rounded-lg p-4 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                <XCircle className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900">
                    Review History: Rejected BOQ Correction
                  </h4>
                  <Badge variant="error" className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 inline-flex items-center">REJECTED</Badge>
                </div>
                <p className="text-xs text-rose-800 mt-1">
                  This BOQ was rejected during approval review. You can update the scope, sections, items, and unit rates below, save your progress, and re-submit it for approval using this same BOQ record.
                </p>
                {rejectionReason && (
                  <div className="mt-2.5 p-2.5 bg-white rounded border border-rose-200 text-xs text-rose-950">
                    <span className="font-semibold text-rose-900">Rejection Reason: </span>
                    <span>{rejectionReason}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 1. BOQ Master Information Card (Manual BOQ Code input removed) */}
        <div className="bg-surface border border-border rounded-lg p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-text-primary tracking-tight">
                1. BOQ Master Information
              </h3>
            </div>
            {/* Auto-generated BOQ Code Pill */}
            {boqForm.boq_code ? (
              <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-md">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">BOQ Code:</span>
                <span className="font-mono text-xs font-bold text-primary">{boqForm.boq_code}</span>
              </div>
            ) : (
              <span className="text-[11px] text-text-muted italic">Code generated upon selecting project</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Parent Project Selection */}
            <FormField label="Parent Project" required error={formErrors.project_id} className="lg:col-span-2">
              <Select
                value={boqForm.project_id}
                onChange={handleProjectSelect}
                disabled={isEditing || saving}
                options={[
                  { value: '', label: 'Select project...' },
                  ...projects.map((p) => ({
                    value: String(p.id),
                    label: p.project_name || p.name,
                  })),
                ]}
                placeholder="Select project"
              />
            </FormField>

            {/* Baseline BOQ Date */}
            <FormField label="BOQ Date" required error={formErrors.boq_date}>
              <Input
                type="date"
                value={boqForm.boq_date}
                onChange={(e) => handleBoqChange('boq_date', e.target.value)}
                disabled={saving}
              />
            </FormField>

            {/* Valid From Date */}
            <FormField label="Valid From" error={formErrors.valid_from}>
              <Input
                type="date"
                value={boqForm.valid_from}
                onChange={(e) => handleBoqChange('valid_from', e.target.value)}
                disabled={saving}
              />
            </FormField>

            {/* BOQ Title / Name */}
            <FormField label="BOQ Title / Name" required error={formErrors.boq_name} className="lg:col-span-4">
              <Input
                value={boqForm.boq_name}
                onChange={(e) => handleBoqChange('boq_name', e.target.value)}
                placeholder="e.g. Civil & Structural Superstructure Works Phase 1"
                disabled={saving}
              />
            </FormField>

            {/* Scope / Engineering Notes */}
            <FormField label="Scope of Work / Engineering Remarks" error={formErrors.notes} className="lg:col-span-4">
              <Textarea
                value={boqForm.notes}
                onChange={(e) => handleBoqChange('notes', e.target.value)}
                placeholder="Enter scope summary, drawings references (e.g. DWG-STR-101), site specifications, and special pricing clauses..."
                rows={2}
                disabled={saving}
              />
            </FormField>
          </div>
        </div>

        {/* 2. Work Sections & Line Items Area */}
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-text-primary tracking-tight">
                  2. Work Sections & Scheduled Line Items
                </h3>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Organize work into logical sections (e.g. Earthwork, Concrete, Masonry). Section codes and item codes are generated automatically.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddSection}
              disabled={saving}
              className="text-xs h-8 shadow-2xs self-start sm:self-auto shrink-0 bg-surface hover:bg-surface-muted font-medium"
            >
              <Plus className="w-3.5 h-3.5 mr-1 text-primary" />
              Add Section
            </Button>
          </div>

          {/* Submission Requirement Alert */}
          {!summary.isValidToSubmit && (
            <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/25 rounded-md px-3.5 py-2.5 text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold">Submission Requirement:</span>
                <span>A BOQ must contain at least</span>
                <strong className={summary.totalSections >= 1 ? 'text-emerald-700' : 'text-amber-900 font-bold'}>
                  1 Section ({summary.totalSections}/1)
                </strong>
                <span>and at least</span>
                <strong className={summary.totalItems >= 1 ? 'text-emerald-700' : 'text-amber-900 font-bold'}>
                  1 Line Item ({summary.totalItems}/1)
                </strong>
                <span>before it can be submitted for review.</span>
              </div>
            </div>
          )}

          {/* Empty State when no sections */}
          {sections.length === 0 && (
            <div className="border border-dashed border-border rounded-lg p-8 bg-surface-subtle/40 text-center flex flex-col items-center justify-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-text-muted shadow-2xs">
                <Layers className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-text-primary">No work sections added yet</h4>
              <p className="text-xs text-text-muted max-w-sm">
                A Bill of Quantities requires at least one work section. Click below to add your first work section.
              </p>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleAddSection}
                disabled={saving}
                className="text-xs mt-1"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add First Section
              </Button>
            </div>
          )}

          {/* Section Cards List */}
          <div className="flex flex-col gap-4">
            {sections.map((section, sIndex) => {
              const secItemCount = section.items?.length || 0;
              const secAmount = section.items?.reduce(
                (sum, i) => sum + (Number(i.amount) || Number(i.quantity || 0) * Number(i.rate || 0) || 0),
                0
              ) || 0;

              return (
                <div
                  key={section.tempId}
                  className="bg-surface border border-border rounded-lg shadow-xs overflow-hidden transition-all"
                >
                  {/* Section Top Header Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-surface-muted/50 border-b border-border/80">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleSectionExpand(section.tempId)}
                        className="text-text-muted hover:text-text-primary p-0.5 rounded-xs transition-colors"
                        title={section.isExpanded ? 'Collapse section' : 'Expand section'}
                      >
                        {section.isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-text-secondary" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-text-secondary" />
                        )}
                      </button>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-xs">
                          SECTION {String(sIndex + 1).padStart(2, '0')}
                        </span>
                        <span className="font-mono text-xs font-semibold text-text-secondary bg-surface px-2 py-0.5 rounded-xs border border-border/60">
                          {section.section_code}
                        </span>
                      </div>

                      <span className="text-xs font-semibold text-text-primary truncate max-w-[200px] sm:max-w-xs md:max-w-md">
                        {section.section_name.trim() || 'Untitled Section'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] text-text-secondary font-medium">
                        {secItemCount} {secItemCount === 1 ? 'item' : 'items'}
                      </span>

                      <span className="font-mono text-xs font-bold text-text-primary bg-surface border border-border px-2.5 py-0.5 rounded-xs">
                        {formatCurrency(secAmount)}
                      </span>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePromptDeleteSection(section, sIndex)}
                        disabled={saving}
                        className="text-text-muted hover:text-error hover:bg-error/10 h-7 w-7 p-0"
                        title="Delete this section"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Section Expanded Content */}
                  {section.isExpanded && (
                    <div className="p-4 sm:p-5 flex flex-col gap-4">
                      {/* Section Name and Description (Section Code input removed) */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <FormField
                          label="Section Name"
                          required
                          error={formErrors[`${section.tempId}_section_name`]}
                          className="sm:col-span-1"
                        >
                          <Input
                            value={section.section_name}
                            onChange={(e) =>
                              handleSectionChange(section.tempId, 'section_name', e.target.value)
                            }
                            placeholder="e.g. Earthwork & Substructure"
                            disabled={saving}
                          />
                        </FormField>

                        <FormField
                          label="Section Scope Description (Optional)"
                          className="sm:col-span-2"
                        >
                          <Input
                            value={section.description}
                            onChange={(e) =>
                              handleSectionChange(section.tempId, 'description', e.target.value)
                            }
                            placeholder="Brief description of work scope covered under this section..."
                            disabled={saving}
                          />
                        </FormField>
                      </div>

                      {/* Line Items Table Area */}
                      <div className="flex flex-col gap-2 pt-2 border-t border-border/70">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Boxes className="w-3.5 h-3.5 text-text-secondary" />
                            <span className="text-[11px] font-bold text-text-primary uppercase tracking-wider">
                              Section {sIndex + 1} Line Items
                            </span>
                            <span className="text-[11px] text-text-muted font-normal">
                              ({secItemCount} {secItemCount === 1 ? 'item' : 'items'})
                            </span>
                          </div>
                        </div>

                        {/* Items Table with enhanced spacing and auto-generated read-only codes */}
                        {secItemCount === 0 ? (
                          <div className="border border-dashed border-border/80 rounded-md py-5 text-center bg-surface-subtle/30">
                            <p className="text-xs text-text-muted">
                              No items in this section yet. Click{' '}
                              <button
                                type="button"
                                onClick={() => handleAddItem(section.tempId)}
                                className="text-primary font-semibold hover:underline"
                              >
                                + Add Item
                              </button>{' '}
                              to add line items, units, quantities, and rates.
                            </p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto border border-border/80 rounded-md bg-surface shadow-2xs">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead className="bg-surface-muted/70 text-text-secondary text-[10px] font-bold uppercase tracking-wider border-b border-border/80">
                                <tr>
                                  <th className="py-2.5 px-2.5 w-8 text-center text-text-muted">#</th>
                                  <th className="py-2.5 px-2.5 w-20 text-center">Item Code</th>
                                  <th className="py-2.5 px-3 min-w-[320px]">Description / Item Name *</th>
                                  <th className="py-2.5 px-2.5 w-44">Work Category *</th>
                                  <th className="py-2.5 px-2.5 w-28">Unit (UOM) *</th>
                                  <th className="py-2.5 px-2.5 w-28 text-right">Quantity *</th>
                                  <th className="py-2.5 px-2.5 w-28 text-right">Rate (₹)</th>
                                  <th className="py-2.5 px-3 w-32 text-right">Amount (₹)</th>
                                  <th className="py-2.5 px-2 w-10 text-center">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/60">
                                {section.items.map((item, iIndex) => {
                                  const itmAmount = Math.round(
                                    (Number(item.quantity) || 0) * (Number(item.rate) || 0) * 100
                                  ) / 100;

                                  const itmNameErr = formErrors[`${item.tempId}_item_name`];
                                  const catErr = formErrors[`${item.tempId}_work_category_id`];
                                  const uomErr = formErrors[`${item.tempId}_uom_id`];
                                  const qtyErr = formErrors[`${item.tempId}_quantity`];

                                  return (
                                    <tr
                                      key={item.tempId}
                                      className="hover:bg-surface-muted/20 transition-colors"
                                    >
                                      {/* Row Index */}
                                      <td className="py-2 px-2.5 text-center font-mono text-[11px] text-text-muted">
                                        {iIndex + 1}
                                      </td>

                                      {/* Read-Only System Generated Item Code Badge */}
                                      <td className="py-2 px-2.5 text-center">
                                        <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-surface-muted/80 text-text-primary rounded border border-border/70 inline-block shadow-2xs">
                                          {item.item_code}
                                        </span>
                                      </td>

                                      {/* Item Description (Expanded Width) */}
                                      <td className="py-2 px-3">
                                        <Input
                                          value={item.item_name}
                                          onChange={(e) =>
                                            handleItemChange(
                                              section.tempId,
                                              item.tempId,
                                              'item_name',
                                              e.target.value
                                            )
                                          }
                                          placeholder="e.g. Excavation in hard rock with hydraulic breaker and disposal"
                                          disabled={saving}
                                          className={`text-xs h-8 px-2.5 ${itmNameErr ? 'border-error focus:ring-error' : ''
                                            }`}
                                        />
                                      </td>

                                      {/* Work Category */}
                                      <td className="py-2 px-2.5">
                                        <Select
                                          value={item.work_category_id}
                                          onChange={(val) =>
                                            handleItemChange(
                                              section.tempId,
                                              item.tempId,
                                              'work_category_id',
                                              val
                                            )
                                          }
                                          options={[
                                            { value: '', label: 'Select Category...' },
                                            ...workCategories.map((c) => ({
                                              value: String(c.id),
                                              label: c.category_name || c.name,
                                            })),
                                          ]}
                                          disabled={saving}
                                          className={`text-xs h-8 ${catErr ? 'border-error' : ''}`}
                                        />
                                      </td>

                                      {/* Unit of Measurement */}
                                      <td className="py-2 px-2.5">
                                        <Select
                                          value={item.uom_id}
                                          onChange={(val) =>
                                            handleItemChange(section.tempId, item.tempId, 'uom_id', val)
                                          }
                                          options={[
                                            { value: '', label: 'Select UOM...' },
                                            ...uoms.map((u) => ({
                                              value: String(u.id),
                                              label: `${u.unit_symbol || u.symbol || u.unit_code} (${u.unit_name || u.name})`,
                                            })),
                                          ]}
                                          disabled={saving}
                                          className={`text-xs h-8 ${uomErr ? 'border-error' : ''}`}
                                        />
                                      </td>

                                      {/* Quantity */}
                                      <td className="py-2 px-2.5 text-right">
                                        <Input
                                          type="number"
                                          min="0"
                                          step="any"
                                          value={item.quantity}
                                          onChange={(e) =>
                                            handleItemChange(
                                              section.tempId,
                                              item.tempId,
                                              'quantity',
                                              e.target.value
                                            )
                                          }
                                          placeholder="1.00"
                                          disabled={saving}
                                          className={`text-xs h-8 text-right px-2.5 font-mono ${qtyErr ? 'border-error' : ''
                                            }`}
                                        />
                                      </td>

                                      {/* Rate */}
                                      <td className="py-2 px-2.5 text-right">
                                        <Input
                                          type="number"
                                          min="0"
                                          step="any"
                                          value={item.rate}
                                          onChange={(e) =>
                                            handleItemChange(
                                              section.tempId,
                                              item.tempId,
                                              'rate',
                                              e.target.value
                                            )
                                          }
                                          placeholder="0.00"
                                          disabled={saving}
                                          className="text-xs h-8 text-right px-2.5 font-mono"
                                        />
                                      </td>

                                      {/* Calculated Amount */}
                                      <td className="py-2 px-3 text-right font-mono font-bold text-text-primary text-xs">
                                        {formatCurrency(itmAmount)}
                                      </td>

                                      {/* Action (Delete item) */}
                                      <td className="py-2 px-2 text-center">
                                        <button
                                          type="button"
                                          onClick={() => handlePromptDeleteItem(section, item)}
                                          disabled={saving}
                                          className="text-text-muted hover:text-error p-1 rounded-xs transition-colors"
                                          title="Remove line item"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Bottom bar of section: Add item button and Section Total */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 mt-1 border-t border-border/70">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddItem(section.tempId)}
                            disabled={saving}
                            className="text-xs h-8 px-3 shadow-2xs font-medium self-start sm:self-auto bg-surface hover:bg-surface-muted"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1 text-primary" />
                            Add Item
                          </Button>

                          <div className="flex items-center gap-2 self-end sm:self-auto bg-surface-muted/60 border border-border px-3 py-1.5 rounded-md">
                            <span className="text-xs text-text-secondary font-medium">
                              Section {sIndex + 1} Total:
                            </span>
                            <span className="font-mono text-sm font-bold text-text-primary">
                              {formatCurrency(secAmount)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Another Section Button */}
          {sections.length > 0 && (
            <div className="flex items-center justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddSection}
                disabled={saving}
                className="text-xs h-8 px-4 border-dashed bg-surface hover:bg-surface-muted font-medium"
              >
                <Plus className="w-3.5 h-3.5 mr-1 text-primary" />
                Add Another Section
              </Button>
            </div>
          )}
        </div>

        {/* 3. Real-Time Dynamic BOQ Financial Summary Ribbon */}
        <div className="bg-surface border border-border rounded-lg p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-text-primary tracking-tight">
                3. BOQ Summary & Estimated Valuation
              </h3>
            </div>
            <span className="text-[11px] text-text-muted">Calculated dynamically from all section line items</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-surface-muted/50 rounded-md border border-border/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-text-muted uppercase font-bold tracking-wider block">
                  Total Sections
                </span>
                <span className="text-xl font-bold font-mono text-text-primary">
                  {summary.totalSections}
                </span>
              </div>
              <Badge variant={summary.totalSections >= 1 ? 'success' : 'neutral'} size="sm">
                {summary.totalSections >= 1 ? 'Satisfied' : 'Min 1 Required'}
              </Badge>
            </div>

            <div className="p-3 bg-surface-muted/50 rounded-md border border-border/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-text-muted uppercase font-bold tracking-wider block">
                  Total Line Items
                </span>
                <span className="text-xl font-bold font-mono text-text-primary">
                  {summary.totalItems}
                </span>
              </div>
              <Badge variant={summary.totalItems >= 1 ? 'success' : 'neutral'} size="sm">
                {summary.totalItems >= 1 ? 'Satisfied' : 'Min 1 Required'}
              </Badge>
            </div>

            <div className="p-3 bg-emerald-500/10 rounded-md border border-emerald-500/20 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-emerald-800 uppercase font-bold tracking-wider block">
                  Estimated Total Amount
                </span>
                <span className="text-xl font-bold font-mono text-emerald-700">
                  {formatCurrency(summary.grandTotal)}
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-500/20 px-2 py-0.5 rounded-xs">
                {boqForm.currency_code || 'INR'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Fixed Bottom Action Ribbon */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-surface border-t border-border px-4 py-3 shadow-lg flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate('/boq')}
            disabled={saving}
            className="text-xs text-text-secondary"
          >
            Cancel
          </Button>

          {saving && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-primary font-medium pl-3 border-l border-border">
              <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>{saveStepText || 'Processing...'}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {/* Save as Draft / Save Changes Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="text-xs h-8 shadow-2xs font-medium"
          >
            <Save className="w-3.5 h-3.5 mr-1" />
            {boqStatus === 'REJECTED' ? 'Save Changes' : 'Save as Draft'}
          </Button>

          {/* Submit / Re-submit BOQ Button (Requirements 8, 9, 10, 18) */}
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => handleSave(true)}
            disabled={saving}
            className={`text-xs h-8 shadow-xs font-semibold ${!summary.isValidToSubmit ? 'opacity-85' : ''
              }`}
            title={
              !summary.isValidToSubmit
                ? 'Requires at least 1 section and 1 line item to submit'
                : (boqStatus === 'REJECTED' ? 'Save and re-submit BOQ for approval' : 'Save and submit BOQ for review')
            }
          >
            <Send className="w-3.5 h-3.5 mr-1" />
            {boqStatus === 'REJECTED' ? 'Re-submit for Approval' : 'Submit BOQ'}
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog for Destructive Removal */}
      {confirmDeleteDialog && (
        <ConfirmDialog
          isOpen={Boolean(confirmDeleteDialog)}
          title={confirmDeleteDialog.title}
          message={confirmDeleteDialog.message}
          confirmLabel="Yes, Delete"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={() => {
            if (confirmDeleteDialog.type === 'section') {
              executeDeleteSection(confirmDeleteDialog.target.tempId);
            } else if (confirmDeleteDialog.type === 'item') {
              executeDeleteItem(
                confirmDeleteDialog.target.secTempId,
                confirmDeleteDialog.target.itmTempId
              );
            }
            setConfirmDeleteDialog(null);
          }}
          onCancel={() => setConfirmDeleteDialog(null)}
        />
      )}
    </PageContainer>
  );
}

export default BoqCreatePage;
