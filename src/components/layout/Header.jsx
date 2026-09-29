import { useState } from 'react';
import { Menu, Search, Bell, Building, ChevronDown, X } from 'lucide-react';
import { Select } from '../ui/Select';
import { useAuth } from '../../features/auth/context/AuthContext';

const SITE_OPTIONS = [
  { label: 'All Sites (Acme Builders)', value: 'all' },
  { label: 'Metro Station Construction', value: 'site-1' },
  { label: 'Commercial Complex', value: 'site-2' },
  { label: 'Residential Tower', value: 'site-3' },
  { label: 'Highway Project Phase 1', value: 'site-4' },
];

export function Header({ selectedSite, onSiteChange, onMenuClick }) {
  const { user, logout } = useAuth();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileSiteOpen, setMobileSiteOpen] = useState(false);
  
  return (
    <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="p-2 -ml-2 text-text-secondary hover:text-text-primary hover:bg-surface-muted rounded-sm transition-colors lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumb / Context Placeholder */}
        <div className="hidden md:flex items-center gap-2 text-sm">
          <span className="text-text-secondary">Civil Desk</span>
          <span className="text-text-muted">/</span>
          <span className="text-text-primary font-medium">Dashboard</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Search Desktop */}
        <div className="relative hidden md:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-placeholder" />
          <input
            type="text"
            placeholder="Search..."
            className="h-9 w-48 lg:w-64 pl-9 pr-3 rounded-sm border border-border bg-background text-sm focus:outline-none focus:border-focus focus:ring-1 focus:ring-focus transition-all"
          />
        </div>

        {/* Site Selector Desktop */}
        <div className="hidden sm:block w-[200px] lg:w-[260px]">
          <Select 
            options={SITE_OPTIONS}
            value={selectedSite}
            onChange={onSiteChange}
            leftIcon={<Building />}
            dropdownWidth="w-[280px]"
          />
        </div>

        {/* Mobile Icons */}
        <div className="flex sm:hidden">
          <button 
            onClick={() => { setMobileSiteOpen(!mobileSiteOpen); setMobileSearchOpen(false); }}
            className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-muted rounded-sm transition-colors relative"
          >
            <Building className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex md:hidden">
          <button 
            onClick={() => { setMobileSearchOpen(!mobileSearchOpen); setMobileSiteOpen(false); }}
            className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-muted rounded-sm transition-colors relative"
          >
            <Search className="w-5 h-5" />
          </button>
        </div>

        {/* Notifications */}
        <button className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-muted rounded-sm transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error border border-surface"></span>
        </button>
      </div>

      {/* Mobile Search Overlay */}
      {mobileSearchOpen && (
        <div className="absolute top-16 left-0 right-0 p-4 bg-surface border-b border-border z-40 shadow-sm animate-in slide-in-from-top-2 md:hidden">
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-placeholder" />
              <input
                type="text"
                placeholder="Search Civil Desk..."
                className="h-10 w-full pl-9 pr-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:border-focus focus:ring-1 focus:ring-focus"
                autoFocus
              />
            </div>
            <button onClick={() => setMobileSearchOpen(false)} className="p-2 text-text-secondary hover:bg-surface-muted rounded-md">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Site Selector Overlay */}
      {mobileSiteOpen && (
        <div className="absolute top-16 left-0 right-0 p-4 bg-surface border-b border-border z-40 shadow-sm animate-in slide-in-from-top-2 sm:hidden">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-text-secondary uppercase">Select Site</span>
              <button onClick={() => setMobileSiteOpen(false)} className="p-1 text-text-secondary hover:bg-surface-muted rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <Select 
              options={SITE_OPTIONS}
              value={selectedSite}
              onChange={(v) => { onSiteChange(v); setMobileSiteOpen(false); }}
              leftIcon={<Building />}
            />
          </div>
        </div>
      )}
    </header>
  );
}
