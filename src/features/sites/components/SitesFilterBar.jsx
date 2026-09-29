import { Plus, Filter, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { SearchField } from '../../../components/composite/SearchField';

export function SitesFilterBar({
  searchQuery = '',
  onSearchChange,
  onAdd,
  canCreate = false,
  filters,
  onFilterChange,
  masters = {},
  projects = []
}) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-surface border border-border rounded-lg p-2.5 sm:p-3 shadow-xs">
      <div className="flex flex-wrap items-center gap-2 flex-1">
        <div className="w-full sm:w-52">
          <Select
            options={[
              { value: 'all', label: 'All Projects' },
              ...projects.map(p => ({ value: String(p.id), label: p.project_name || p.name }))
            ]}
            value={filters.project_id || 'all'}
            onChange={(val) => onFilterChange('project_id', val)}
            className="text-xs h-8"
          />
        </div>

        <div className="w-full sm:w-48">
          <SearchField
            placeholder="Search site name, code, city..."
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>

        <div className="w-full sm:w-36">
          <Select
            options={[
              { value: 'all', label: 'All Statuses' },
              ...(masters.site_statuses ?? []).map((item) => ({
                value: String(item.id),
                label: item.status_name || item.name
              }))
            ]}
            value={filters.status_id}
            onChange={(value) => onFilterChange('status_id', value)}
            className="text-xs h-8"
          />
        </div>

        <div className="w-full sm:w-36">
          <Select
            options={[
              { value: 'all', label: 'All Site Types' },
              ...(masters.site_types ?? []).map((item) => ({
                value: String(item.id),
                label: item.type_name || item.name
              }))
            ]}
            value={filters.site_type_id}
            onChange={(value) => onFilterChange('site_type_id', value)}
            className="text-xs h-8"
          />
        </div>

        {(searchQuery || filters.project_id !== 'all' || filters.status_id !== 'all' || filters.site_type_id !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-8 text-text-secondary"
            onClick={() => {
              onSearchChange('');
              onFilterChange('project_id', 'all');
              onFilterChange('status_id', 'all');
              onFilterChange('site_type_id', 'all');
            }}
          >
            Reset
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 justify-end">
        {canCreate && (
          <Button
            variant="primary"
            size="sm"
            className="text-xs h-8 shadow-xs"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={onAdd}
          >
            Add Site
          </Button>
        )}
      </div>
    </div>
  );
}
