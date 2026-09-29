import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Package, Save, ArrowLeft, Tag, Layers, CheckCircle2, DollarSign, ShieldAlert, Archive } from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageContainer } from '../../../components/layout/PageContainer';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { FormField } from '../../../components/composite/FormField';
import { toast } from '../../../components/composite/Toast';
import { materialsApi } from '../../../api/apiservice';

const EMPTY_FORM = {
  material_category_id: '',
  base_uom_id: '',
  material_code: '',
  material_name: '',
  specification: '',
  brand_preference: '',
  hsn_code: '',
  gst_rate: '18',
  standard_rate: '0',
  minimum_stock_qty: '0',
  reorder_qty: '0',
  storage_location_hint: '',
  quality_check_required: '0',
  batch_tracking_required: '0',
  is_active: '1',
  notes: '',
};

export function MaterialCatalogueFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isMasterSection = location.pathname.startsWith('/masters');
  const returnPath = isMasterSection ? '/masters/materials' : '/materials/catalogue';

  const [form, setForm] = useState(EMPTY_FORM);
  const [categories, setCategories] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [brands, setBrands] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load masters & brands & edit item if id exists
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [resCategories, resMasters, resBrands] = await Promise.all([
        materialsApi.categories.list().catch(() => ({ data: [] })),
        materialsApi.masters().catch(() => ({ data: {} })),
        materialsApi.brands.list().catch(() => null),
      ]);

      const catList = resCategories?.data?.material_categories ?? resCategories?.material_categories ?? [];
      setCategories(Array.isArray(catList) ? catList : []);

      const uomList = resMasters?.data?.masters?.units ?? resMasters?.masters?.units ?? [];
      setUoms(Array.isArray(uomList) ? uomList : []);

      const apiBrands = resBrands?.data?.material_brands ?? resBrands?.material_brands ?? (Array.isArray(resBrands?.data) ? resBrands.data : (Array.isArray(resBrands) ? resBrands : []));
      setBrands(Array.isArray(apiBrands) ? apiBrands : []);

      if (id) {
        const itemRes = await materialsApi.catalogue.get(id);
        const item = itemRes?.data?.material ?? itemRes?.material ?? itemRes;
        if (item) {
          setForm({
            material_category_id: String(item.material_category_id || ''),
            base_uom_id: String(item.base_uom_id || item.uom_id || ''),
            material_code: item.material_code || '',
            material_name: item.material_name || '',
            specification: item.specification || '',
            brand_preference: item.brand_preference || '',
            hsn_code: item.hsn_code || '',
            gst_rate: String(item.gst_rate ?? '18'),
            standard_rate: String(item.standard_rate ?? '0'),
            minimum_stock_qty: String(item.minimum_stock_qty ?? '0'),
            reorder_qty: String(item.reorder_qty ?? '0'),
            storage_location_hint: item.storage_location_hint || '',
            quality_check_required: String(item.quality_check_required ? 1 : 0),
            batch_tracking_required: String(item.batch_tracking_required ? 1 : 0),
            is_active: String(item.is_active ? 1 : 0),
            notes: item.notes || item.specification || '',
          });
        }
      } else {
        if (catList.length > 0) {
          setForm((prev) => ({ ...prev, material_category_id: String(catList[0].id) }));
        }
        if (uomList.length > 0) {
          setForm((prev) => ({ ...prev, base_uom_id: String(uomList[0].id) }));
        }
      }
    } catch {
      toast.error('Failed to load material form dependencies.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrs = {};

    if (!form.material_name.trim()) validationErrs.material_name = 'Material name is required.';
    if (!form.material_category_id) validationErrs.material_category_id = 'Category is required.';
    if (!form.base_uom_id) validationErrs.base_uom_id = 'Base UOM is required.';

    if (Object.keys(validationErrs).length > 0) {
      setErrors(validationErrs);
      toast.error('Please fill in all mandatory fields.');
      return;
    }

    setSaving(true);
    try {
      const autoCode = form.material_code.trim() || `MAT-${Date.now().toString().slice(-6)}`;
      const payload = {
        ...form,
        material_code: autoCode,
        material_category_id: Number(form.material_category_id),
        base_uom_id: Number(form.base_uom_id),
        standard_rate: Number(form.standard_rate || 0),
        gst_rate: Number(form.gst_rate || 0),
        minimum_stock_qty: Number(form.minimum_stock_qty || 0),
        reorder_qty: Number(form.reorder_qty || 0),
        quality_check_required: Number(form.quality_check_required) === 1,
        batch_tracking_required: Number(form.batch_tracking_required) === 1,
        is_active: Number(form.is_active) === 1,
      };

      if (id) {
        await materialsApi.catalogue.update(id, payload);
        toast.success('Material catalogue item updated successfully.');
      } else {
        await materialsApi.catalogue.create(payload);
        toast.success('Material catalogue item created successfully.');
      }
      navigate(returnPath);
    } catch (err) {
      toast.error(err?.message || 'Failed to save material item.');
    } finally {
      setSaving(false);
    }
  };

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: isMasterSection ? 'Masters' : 'Materials & Inventory', href: returnPath },
    { label: 'Material Catalogue', href: returnPath },
    { label: id ? 'Edit Material Item' : 'Add Material Item' },
  ];

  if (loading) {
    return (
      <PageContainer>
        <PageHeader title={id ? 'Edit Material Item' : 'Add Material Item'} breadcrumbs={breadcrumbs} />
        <div className="flex items-center justify-center h-64 text-text-muted text-sm">
          Loading material details...
        </div>
      </PageContainer>
    );
  }

  // Ensure current brand is included in brand options if already set on existing item
  const brandOptions = [
    { value: '', label: 'Select Brand Preference (Optional)' },
    ...brands.map((b) => ({
      value: b.brand_name,
      label: b.brand_name || b.name,
    })),
  ];

  if (form.brand_preference && !brands.some((b) => b.brand_name.toLowerCase() === form.brand_preference.toLowerCase())) {
    brandOptions.push({
      value: form.brand_preference,
      label: `${form.brand_preference} (Custom)`,
    });
  }

  return (
    <PageContainer>
      <PageHeader
        title={id ? 'Edit Material Catalogue Item' : 'Add Material Catalogue Item'}
        subtitle="Configure stock limits, standard purchase rates, categories, and brand specifications."
        breadcrumbs={breadcrumbs}
      />

      <div className="bg-surface border border-border rounded-lg shadow-xs overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="p-4 sm:p-6 space-y-6">

            {/* Section 1: General Information */}
            <div>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/80">
                <Package className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-text-primary">General Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Material Name" required className="md:col-span-2" error={errors.material_name}>
                  <Input
                    placeholder="e.g. Portland Pozzolana Cement"
                    value={form.material_name}
                    onChange={(e) => handleFormChange('material_name', e.target.value)}
                  />
                </FormField>

                <FormField label="Category" required error={errors.material_category_id}>
                  <Select
                    value={form.material_category_id}
                    onChange={(val) => handleFormChange('material_category_id', val)}
                    options={[
                      { value: '', label: 'Select a category' },
                      ...categories.map((c) => ({
                        value: String(c.id),
                        label: c.category_name || c.name,
                      })),
                    ]}
                  />
                </FormField>

                <FormField label="Base Unit of Measurement" required error={errors.base_uom_id}>
                  <Select
                    value={form.base_uom_id}
                    onChange={(val) => handleFormChange('base_uom_id', val)}
                    options={[
                      { value: '', label: 'Select a unit' },
                      ...uoms.map((u) => ({
                        value: String(u.id),
                        label: u.unit_name || u.name || u.unit_code,
                      })),
                    ]}
                  />
                </FormField>
              </div>
            </div>

            {/* Section 2: Pricing & Taxation */}
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/80">
                <DollarSign className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-text-primary">Pricing & Taxation</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField label="Standard Purchase Rate (₹)" error={errors.standard_rate}>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.standard_rate}
                    onChange={(e) => handleFormChange('standard_rate', e.target.value)}
                  />
                </FormField>

                <FormField label="GST Rate (%)" error={errors.gst_rate}>
                  <Select
                    value={form.gst_rate}
                    onChange={(val) => handleFormChange('gst_rate', val)}
                    options={[
                      { value: '0', label: '0%' },
                      { value: '5', label: '5%' },
                      { value: '12', label: '12%' },
                      { value: '18', label: '18%' },
                      { value: '28', label: '28%' },
                    ]}
                  />
                </FormField>

                <FormField label="HSN Code" error={errors.hsn_code}>
                  <Input
                    placeholder="e.g. 2523"
                    value={form.hsn_code}
                    onChange={(e) => handleFormChange('hsn_code', e.target.value)}
                  />
                </FormField>
              </div>
            </div>

            {/* Section 3: Brand & Specification */}
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/80">
                <Tag className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-text-primary">Brand & Specification</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Brand Preferences Dropdown from Registry */}
                <FormField
                  label="Brand Preferences"
                  error={errors.brand_preference}
                  caption="Select from registered brands configured in Material Master Brands Registry."
                >
                  <Select
                    value={form.brand_preference}
                    onChange={(val) => handleFormChange('brand_preference', val)}
                    options={brandOptions}
                    placeholder="Select Brand Preference..."
                  />
                </FormField>

                <FormField label="Storage Hint (Location)" error={errors.storage_location_hint}>
                  <Input
                    placeholder="e.g. Rack A-12, Yard North Bay"
                    value={form.storage_location_hint}
                    onChange={(e) => handleFormChange('storage_location_hint', e.target.value)}
                  />
                </FormField>

                <FormField label="Specifications / Notes" className="md:col-span-2" error={errors.notes}>
                  <Textarea
                    placeholder="Material technical specs, weight info, packaging details, or handling instructions..."
                    value={form.notes}
                    onChange={(e) => handleFormChange('notes', e.target.value)}
                    rows={3}
                  />
                </FormField>
              </div>
            </div>

            {/* Section 4: Inventory Thresholds & Controls */}
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/80">
                <Archive className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-text-primary">Inventory & Tracking Controls</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField label="Min Stock Alert Qty" error={errors.minimum_stock_qty}>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.minimum_stock_qty}
                    onChange={(e) => handleFormChange('minimum_stock_qty', e.target.value)}
                  />
                </FormField>

                <FormField label="Reorder Qty" error={errors.reorder_qty}>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.reorder_qty}
                    onChange={(e) => handleFormChange('reorder_qty', e.target.value)}
                  />
                </FormField>

                <FormField label="Active Status" error={errors.is_active}>
                  <Select
                    value={form.is_active}
                    onChange={(val) => handleFormChange('is_active', val)}
                    options={[
                      { value: '1', label: 'Active' },
                      { value: '0', label: 'Inactive' },
                    ]}
                  />
                </FormField>

                <FormField label="Quality Check Intake" error={errors.quality_check_required}>
                  <Select
                    value={form.quality_check_required}
                    onChange={(val) => handleFormChange('quality_check_required', val)}
                    options={[
                      { value: '0', label: 'Not Required' },
                      { value: '1', label: 'Inspection Required' },
                    ]}
                  />
                </FormField>

                <FormField label="Batch Tracking" error={errors.batch_tracking_required}>
                  <Select
                    value={form.batch_tracking_required}
                    onChange={(val) => handleFormChange('batch_tracking_required', val)}
                    options={[
                      { value: '0', label: 'Disabled' },
                      { value: '1', label: 'Enabled' },
                    ]}
                  />
                </FormField>
              </div>
            </div>

          </div>

          {/* Form Actions Footer */}
          <div className="bg-surface-muted/50 border-t border-border px-4 py-3 sm:px-6 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => navigate(returnPath)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              leftIcon={<Save className="w-4 h-4" />}
              disabled={saving}
            >
              {saving ? 'Saving...' : id ? 'Update Material' : 'Create Material'}
            </Button>
          </div>
        </form>
      </div>
    </PageContainer>
  );
}
