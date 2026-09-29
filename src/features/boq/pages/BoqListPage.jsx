import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileSpreadsheet, CheckCircle2, Clock, IndianRupee } from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageContainer } from '../../../components/layout/PageContainer';
import { KpiCard } from '../../../components/composite/KpiCard';
import { BoqFilterBar } from '../components/BoqFilterBar';
import { BoqTable } from '../components/BoqTable';
import { BoqDetailModal } from '../components/BoqDetailModal';
import { boqApi, projectsApi } from '../../../api/apiservice';
import { useAuth } from '../../auth/context/AuthContext';

export function BoqListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission, user } = useAuth();
  const isAdmin = Boolean(user?.is_super_admin) || String(user?.role_name || user?.role || '').toLowerCase().includes('admin');
  const canCreate = isAdmin || hasPermission('boq.create');

  const [searchQuery, setSearchQuery] = useState('');
  const [viewingBoq, setViewingBoq] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState({ project_id: 'all', status: 'all' });
  const [projects, setProjects] = useState([]);
  const [kpis, setKpis] = useState({ total: 0, draft: 0, submitted: 0, approved: 0, totalAmount: 0 });

  const viewParam = searchParams.get('view') || searchParams.get('id');

  // Handle shared URL parameter to automatically open the shared BOQ
  useEffect(() => {
    if (viewParam) {
      boqApi.get(viewParam)
        .then((res) => {
          const boq = res?.data?.project_boq ?? res?.data?.data ?? res?.data ?? res;
          if (boq && (boq.id || boq.boq_code)) {
            setViewingBoq(boq);
          }
        })
        .catch(() => {});
    }
  }, [viewParam]);

  useEffect(() => {
    projectsApi.list()
      .then((res) => {
        const list = res?.data?.projects ?? res?.projects ?? (Array.isArray(res?.data) ? res.data : []);
        setProjects(Array.isArray(list) ? list : []);
      })
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    boqApi.list()
      .then((res) => {
        const list = res?.data?.project_boqs ?? res?.project_boqs ?? res?.data?.data ?? (Array.isArray(res) ? res : []);
        if (Array.isArray(list)) {
          let draft = 0, submitted = 0, approved = 0, totalAmount = 0;
          list.forEach((b) => {
            const s = String(b.status_code || b.status_name || b.status || '').toUpperCase();
            const amt = Number(b.total_amount || b.grand_total || 0);
            totalAmount += amt;
            if (s.includes('DRAFT')) draft++;
            else if (s.includes('REVIEW') || s.includes('SUBMITTED') || s.includes('PENDING')) submitted++;
            else if (s.includes('APPROVED')) approved++;
          });
          setKpis({ total: list.length, draft, submitted, approved, totalAmount });
        }
      })
      .catch(() => {});
  }, [refreshKey]);

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'BOQ & Project Budget', href: '/boq' },
    { label: 'BOQ Register' },
  ];

  const refresh = () => setRefreshKey((v) => v + 1);

  const handleResetFilters = () => {
    setFilters({ project_id: 'all', status: 'all' });
    setSearchQuery('');
  };

  const formatTotalKpi = (amount) => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2)} Cr`;
    }
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)} L`;
    }
    return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
  };

  return (
    <PageContainer>
      <PageHeader
        title="BOQ Register"
        breadcrumbs={breadcrumbs}
        description="Master register of Bill of Quantities (BOQs) across projects with revision controls and approval workflows."
      />

      <div className="flex flex-col gap-3 sm:gap-4 w-full">
        {/* Top-aligned KPI Summary Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <KpiCard
            label="Total BOQs"
            value={kpis.total}
            status="primary"
            icon={<FileSpreadsheet className="w-4 h-4" />}
          />
          <KpiCard
            label="Approved BOQs"
            value={kpis.approved}
            status="success"
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          />
          <KpiCard
            label="Under Review / Submitted"
            value={kpis.submitted}
            status="warning"
            icon={<Clock className="w-4 h-4 text-amber-500" />}
          />
          <KpiCard
            label="Total BOQ Value"
            value={formatTotalKpi(kpis.totalAmount)}
            status="neutral"
            icon={<IndianRupee className="w-4 h-4 text-sky-500" />}
          />
        </div>

        {/* Filter and Search Bar */}
        <BoqFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onAdd={() => navigate('/boq/create')}
          canCreate={canCreate}
          filters={filters}
          onFilterChange={(name, value) => setFilters((c) => ({ ...c, [name]: value }))}
          projects={projects}
          onReset={handleResetFilters}
        />

        {/* Fluid Zero-Scroll BOQ Table */}
        <BoqTable
          searchQuery={searchQuery}
          refreshKey={refreshKey}
          onEdit={(boq) => navigate(`/boq/${boq.id}/edit`)}
          onView={setViewingBoq}
          filters={filters}
          onAction={refresh}
        />
      </div>

      <BoqDetailModal
        isOpen={Boolean(viewingBoq)}
        boq={viewingBoq}
        onClose={() => {
          setViewingBoq(null);
          if (searchParams.get('view') || searchParams.get('id')) {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete('view');
            nextParams.delete('id');
            setSearchParams(nextParams, { replace: true });
          }
        }}
        onRefresh={refresh}
        onEdit={(boq) => navigate(`/boq/${boq.id}/edit`)}
      />
    </PageContainer>
  );
}

export default BoqListPage;
