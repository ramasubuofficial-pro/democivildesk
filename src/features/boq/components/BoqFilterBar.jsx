import { Plus, RotateCcw } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { SearchField } from '../../../components/composite/SearchField';

export function BoqFilterBar({
  searchQuery = '',
  onSearchChange,
  onAdd,
  canCreate = false,
  filters,
  onFilterChange,
  projects = [],
  onReset,
}) {
  const hasActiveFilters = Boolean(
    (filters.project_id && filters.project_id !== 'all') ||
    (filters.status && filters.status !== 'all') ||
    searchQuery
  );

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-surface border border-border rounded-lg p-2.5 sm:p-3 shadow-xs">
      <div className="flex flex-wrap items-center gap-2 flex-1">
        {/* Project Selector */}
        <div className="w-full sm:w-48">
          <Select
            className="text-xs h-8"
            options={[
              { value: 'all', label: 'All Projects' },
              ...projects.map((p) => ({
                value: String(p.id),
                label: p.project_name || p.name,
              })),
            ]}
            value={filters.project_id || 'all'}
            onChange={(value) => onFilterChange('project_id', value)}
          />
        </div>

        {/* Status Selector */}
        <div className="w-full sm:w-36">
          <Select
            className="text-xs h-8"
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'draft', label: 'Draft' },
              { value: 'under_review', label: 'Under Review' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
            ]}
            value={filters.status || 'all'}
            onChange={(value) => onFilterChange('status', value)}
          />
        </div>

        {/* Search */}
        <div className="w-full sm:w-60">
          <SearchField
            placeholder="Search code, name, project..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {/* Reset Filter Button */}
        {hasActiveFilters && onReset && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-8 px-2 text-text-muted hover:text-text-primary"
            onClick={onReset}
            title="Reset all filters"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
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
            Add BOQ
          </Button>
        )}
      </div>
    </div>
  );
}

export default BoqFilterBar;
