import { useEffect, useState } from 'react';
import { Package, Plus, Edit, Trash2, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageContainer } from '../../../components/layout/PageContainer';
import { KpiCard } from '../../../components/composite/KpiCard';
import { SearchField } from '../../../components/composite/SearchField';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { EntityEditModal } from '../../../components/composite/EntityEditModal';
import { FormField } from '../../../components/composite/FormField';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { DataTableContainer } from '../../../components/composite/DataTableContainer';
import { ConfirmDialog } from '../../../components/composite/ConfirmDialog';
import { toast } from '../../../components/composite/Toast';

export function EquipmentMasterPage() {
  const [equipments, setEquipments] = useState([]);
  const [search, setSearch] = useState('');
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);

  const [form, setForm] = useState({
    name: '',
    equipment_type: 'Rental',
    description: '',
    is_active: true
  });

  // Load from local storage
  useEffect(() => {
    const stored = localStorage.getItem('mock_equipment_master');
    if (stored) {
      try {
        setEquipments(JSON.parse(stored));
      } catch (e) {
        setEquipments([]);
      }
    } else {
      // Default mock data
      const defaultData = [
        { id: 1, name: 'Concrete Mixer', equipment_type: 'Rental', description: '200L Mixer', is_active: true },
        { id: 2, name: 'Scaffolding Pipe Set', equipment_type: 'Own', description: 'Standard Set', is_active: true },
        { id: 3, name: 'JCB', equipment_type: 'Rental', description: 'Earthmover', is_active: true },
      ];
      setEquipments(defaultData);
      localStorage.setItem('mock_equipment_master', JSON.stringify(defaultData));
    }
  }, []);

  const handleFormChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleOpenAdd = () => {
    setForm({
      name: '',
      equipment_type: 'Rental',
      description: '',
      is_active: true
    });
    setEditingItem(null);
    setIsAddOpen(true);
  };

  const handleOpenEdit = (item) => {
    setForm({ ...item });
    setEditingItem(item);
    setIsAddOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Equipment Name is required');
      return;
    }

    let updatedList;
    if (editingItem) {
      updatedList = equipments.map(e => e.id === editingItem.id ? { ...form, id: editingItem.id } : e);
      toast.success('Equipment updated successfully');
    } else {
      const newId = equipments.length > 0 ? Math.max(...equipments.map(e => e.id)) + 1 : 1;
      updatedList = [...equipments, { ...form, id: newId }];
      toast.success('Equipment added successfully');
    }

    setEquipments(updatedList);
    localStorage.setItem('mock_equipment_master', JSON.stringify(updatedList));
    setIsAddOpen(false);
    setEditingItem(null);
  };

  const confirmDelete = () => {
    if (!deletingItem) return;
    const updatedList = equipments.filter(e => e.id !== deletingItem.id);
    setEquipments(updatedList);
    localStorage.setItem('mock_equipment_master', JSON.stringify(updatedList));
    toast.success('Equipment deleted successfully');
    setDeletingItem(null);
  };

  const filteredEquipments = equipments.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageContainer>
      <PageHeader
        title="Equipment Master"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Masters' },
          { label: 'Equipment Master' },
        ]}
      />

      <div className="flex w-full flex-col gap-3 sm:gap-4">
        {/* KPI Ribbons */}
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 sm:gap-3">
          <KpiCard label="Total Equipment" value={equipments.length} icon={<Package />} status="info" />
          <KpiCard label="Active Equipment" value={equipments.filter(e => e.is_active).length} icon={<ShieldCheck className="text-emerald-500" />} status="success" />
        </div>

        {/* Controls */}
        <div className="flex flex-col items-stretch justify-between gap-2.5 rounded-lg border border-border bg-surface p-2.5 shadow-xs sm:flex-row sm:items-center sm:p-3">
          <div className="w-full sm:w-64">
            <SearchField
              placeholder="Search equipment..."
              value={search}
              onChange={setSearch}
            />
          </div>
          <Button
            variant="primary"
            onClick={handleOpenAdd}
            className="w-full sm:w-auto"
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Add Equipment
          </Button>
        </div>

        <DataTableContainer>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-muted border-y border-border">
                <th className="px-4 py-3 text-[11px] font-semibold text-text-secondary uppercase tracking-wider w-1/3">
                  Equipment Name
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold text-text-secondary uppercase tracking-wider w-1/5">
                  Type
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold text-text-secondary uppercase tracking-wider hidden md:table-cell">
                  Description
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold text-text-secondary uppercase tracking-wider text-center w-24">
                  Status
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold text-text-secondary uppercase tracking-wider text-right w-24">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredEquipments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-text-muted text-[13px]">
                    No equipment found.
                  </td>
                </tr>
              ) : (
                filteredEquipments.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-muted/30 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-text-primary text-[13px]">{item.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="neutral" className="text-[10px] font-bold uppercase tracking-wider">
                        {item.equipment_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-[12px] hidden md:table-cell">
                      {item.description || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge 
                        variant={item.is_active ? 'success' : 'neutral'}
                        className="text-[9px] font-bold uppercase tracking-wider h-5 px-2 inline-flex items-center"
                      >
                        {item.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Edit"
                          onClick={() => handleOpenEdit(item)}
                        >
                          <Edit className="h-4 w-4 text-text-secondary hover:text-primary" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Delete"
                          onClick={() => setDeletingItem(item)}
                        >
                          <Trash2 className="h-4 w-4 text-text-secondary hover:text-error" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </DataTableContainer>
      </div>

      <EntityEditModal
        isOpen={isAddOpen || Boolean(editingItem)}
        onClose={() => {
          setIsAddOpen(false);
          setEditingItem(null);
        }}
      >
        <EntityEditModal.Header
          icon={Package}
          title={editingItem ? 'Edit Equipment' : 'Add New Equipment'}
          subtitle="Configure equipment details."
          onClose={() => {
            setIsAddOpen(false);
            setEditingItem(null);
          }}
        />
        <form id="equipment-form" onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <EntityEditModal.Body>
            <EntityEditModal.Section title="Equipment Details">
              <EntityEditModal.Grid>
                <FormField label="Equipment Name" required className="md:col-span-2">
                  <Input
                    placeholder="e.g. Concrete Mixer"
                    value={form.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                  />
                </FormField>

                <FormField label="Equipment Type" required>
                  <Select
                    options={[
                      { value: 'Rental', label: 'Rental' },
                      { value: 'Own', label: 'Own' },
                    ]}
                    value={form.equipment_type}
                    onChange={(val) => handleFormChange('equipment_type', val)}
                  />
                </FormField>

                <FormField label="Description" className="md:col-span-2">
                  <Input
                    placeholder="e.g. 200L Diesel"
                    value={form.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                  />
                </FormField>

                <div className="md:col-span-2 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      checked={form.is_active}
                      onChange={(e) => handleFormChange('is_active', e.target.checked)}
                    />
                    <span className="text-sm text-text-primary font-medium group-hover:text-primary transition-colors">
                      Active
                    </span>
                  </label>
                </div>
              </EntityEditModal.Grid>
            </EntityEditModal.Section>
          </EntityEditModal.Body>
          <EntityEditModal.Footer
            formId="equipment-form"
            submitLabel={editingItem ? 'Update' : 'Create'}
            onCancel={() => {
              setIsAddOpen(false);
              setEditingItem(null);
            }}
          />
        </form>
      </EntityEditModal>

      <ConfirmDialog
        isOpen={Boolean(deletingItem)}
        title="Delete Equipment"
        message="Are you sure you want to delete this equipment?"
        variant="danger"
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingItem(null)}
      />
    </PageContainer>
  );
}
