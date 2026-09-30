import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Briefcase,
  ChevronDown,
  ChevronRight,
  FolderCog,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  HardHat,
} from 'lucide-react';
import { clsx } from 'clsx';
import { navigationApi } from '../../api/apiservice';
import { useAuth } from '../../features/auth/context/AuthContext';

const ICONS = Object.freeze({
  'layout-dashboard': LayoutDashboard,
  briefcase: Briefcase,
  'folder-cog': FolderCog,
  settings: Settings,
  menu: Menu,
  'hard-hat': HardHat,
});

const HIDDEN_MODULE_CODES = new Set([
  'PROJECT_PLANNING',
  'CLIENT_BILLING',
  'FINANCE_COST_CONTROL',
  'COMMUNICATION',
  'CLIENT_PORTAL',
  'ADD_NEW_PROJECT',
  'PROJECT_OVERVIEW',
  'PROJECT_VIEW',
  'FINANCIAL_DASHBOARD',
  'TIMESHEETS',
  'OVERTIME',
  'LEAVE_MANAGEMENT',
]);

const HIDDEN_MODULE_NAMES = new Set([
  'project planning',
  'client billing & receivables',
  'client billing and receivables',
  'finance & cost control',
  'finance and cost control',
  'communication',
  'client portal',
  'communication and client portal',
  'communication & client portal',
  'add new project',
  'project overview',
  'project view',
  'financial dashboard',
  'financial',
  'timesheets',
  'overtime',
  'leave management',
  'leaves',
  'weekly timesheets',
  'labour overtime',
]);

const HIDDEN_ROUTES = new Set([
  '/projects/new',
  '/projects/overview',
  '/dashboards/finance',
  '/dashboard/financial',
  '/dashboard/finance',
  '/labour/timesheets',
  '/labour/overtime',
  '/labour/leave',
  '/labour/leaves',
  '/labour/leave-management',
]);

function isHiddenMenuItem(item) {
  if (!item) return false;
  const code = (item.item_code || '').trim().toUpperCase();
  const name = (item.item_name || '').trim().toLowerCase();
  const path = (item.route_path || '').trim();
  return (
    HIDDEN_MODULE_CODES.has(code) ||
    HIDDEN_MODULE_NAMES.has(name) ||
    HIDDEN_ROUTES.has(path)
  );
}

function filterHiddenNavigation(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => !isHiddenMenuItem(item))
    .map((item) => ({
      ...item,
      children: item.children ? filterHiddenNavigation(item.children) : item.children,
    }));
}

function NavigationItem({
  item,
  activeRoute,
  openByDepth,
  onToggle,
  onNavigate,
  dismissedBadges = [],
  onDismissBadge,
  depth = 0
}) {
  const Icon = ICONS[item.icon_key] ?? Menu;
  const children = item.children ?? [];
  const expanded = openByDepth[depth] === item.item_code;

  const hasNewChild = (node) => {
    if (['/subcontracts/weekly-payments', '/masters/subcontractor-types', '/masters/equipment-master'].includes(node.route_path) && !dismissedBadges.includes(node.route_path)) {
      return true;
    }
    return (node.children || []).some(hasNewChild);
  };
  const showNewBadge = hasNewChild(item);
  const isNewLeaf = ['/subcontracts/weekly-payments', '/masters/subcontractor-types', '/masters/equipment-master'].includes(item.route_path) && !dismissedBadges.includes(item.route_path);

  if (item.item_type === 'DIVIDER') return <div className="my-2 h-px bg-white/10" />;
  if (item.item_type === 'SECTION') {
    return <div className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-[#C8D1DC]/50">{item.item_name}</div>;
  }

  if (children.length === 0 && item.route_path) {
    const normalize = (p) => (p ? p.trim().replace(/\/+$/, '') : '');
    const isActive = activeRoute ? normalize(item.route_path) === activeRoute : false;

    return (
      <NavLink
        to={item.route_path}
        end
        onClick={(e) => {
          if (isNewLeaf && onDismissBadge) onDismissBadge(item.route_path);
          if (onNavigate) onNavigate(e);
        }}
        style={{ paddingLeft: `${8 + (depth * 16)}px` }}
        className={clsx(
          'flex h-10 items-center gap-3 rounded-sm px-2 text-[13px] font-medium transition-colors',
          isActive ? 'bg-primary text-white' : 'text-[#C8D1DC] hover:bg-white/5 hover:text-white',
        )}
      >
        {depth === 0 ? <Icon className="h-5 w-5 shrink-0" /> : <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />}
        <span className="truncate">{item.item_name}</span>
        {showNewBadge && <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">New</span>}
      </NavLink>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(item.item_code, depth)}
        style={{ paddingLeft: `${8 + (depth * 16)}px` }}
        className="flex h-10 w-full items-center justify-between rounded-sm px-2 text-[13px] font-medium text-[#C8D1DC] hover:bg-white/5 hover:text-white"
        aria-expanded={expanded}
      >
        <span className="flex min-w-0 items-center gap-3">
          {depth === 0 ? <Icon className="h-5 w-5 shrink-0" /> : <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />}
          <span className="truncate">{item.item_name}</span>
          {showNewBadge && <span className="ml-2 rounded-full bg-primary/20 text-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">New</span>}
        </span>
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {expanded && (
        <div className="flex flex-col gap-0.5">
          {children.map((child) => (
            <NavigationItem
              key={child.item_code}
              item={child}
              activeRoute={activeRoute}
              openByDepth={openByDepth}
              onToggle={onToggle}
              onNavigate={onNavigate}
              dismissedBadges={dismissedBadges}
              onDismissBadge={onDismissBadge}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ isMobileOpen, onCloseMobile }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [navigation, setNavigation] = useState([]);
  const [error, setError] = useState('');
  const [openByDepth, setOpenByDepth] = useState({});
  const [dismissedBadges, setDismissedBadges] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dismissed_new_badges') || '[]');
    } catch {
      return [];
    }
  });

  const handleDismissBadge = (path) => {
    setDismissedBadges(prev => {
      if (prev.includes(path)) return prev;
      const next = [...prev, path];
      localStorage.setItem('dismissed_new_badges', JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    let active = true;
    navigationApi.list()
      .then((items) => {
        if (active) {
          const processedItems = [...items];
          // Find the "Procurement" section/menu
          const procNode = processedItems.find(i => i.item_name === 'Procurement' || i.item_code === 'PROCUREMENT');
          if (procNode && procNode.children) {
            const hasAppr = procNode.children.some(c => c.route_path === '/procurement/material-request-approval');
            if (!hasAppr) {
              const reqIdx = procNode.children.findIndex(c => c.route_path === '/procurement/requisitions' || c.item_code === 'PURCHASE_REQUISITIONS');
              const newItem = {
                item_code: 'MATERIAL_REQUEST_APPROVAL',
                item_name: 'Material Request Approval',
                route_path: '/procurement/material-request-approval'
              };
              if (reqIdx !== -1) {
                procNode.children.splice(reqIdx + 1, 0, newItem);
              } else {
                procNode.children.unshift(newItem);
              }
            }
          }

          // Find the "Masters" section/menu
          const mastersNode = processedItems.find(i => i.item_name === 'Masters' || i.item_code === 'MASTERS');
          if (mastersNode) {
            mastersNode.children = mastersNode.children || [];
            mastersNode.children.push({
              item_code: 'SUBCONTRACTOR_MASTER',
              item_name: 'Subcontractor Master',
              item_type: null,
              icon_key: 'briefcase',
              children: [
                { item_code: 'SUB_TYPE', item_name: 'Subcontractor Type', route_path: '/masters/subcontractor-types' },
                { item_code: 'SUB_LIST', item_name: 'Subcontractors', route_path: '/masters/subcontractors' }
              ]
            });
            mastersNode.children.push({
              item_code: 'EQUIPMENT_MASTER',
              item_name: 'Equipment Master',
              item_type: null,
              icon_key: 'briefcase',
              route_path: '/masters/equipment-master'
            });
          }

          // Find the "Subcontract Management" section/menu
          const subNode = processedItems.find(i =>
            i.item_name === 'Subcontract Management' ||
            i.item_code === 'SUBCONTRACT_MANAGEMENT' ||
            i.item_code === 'SUBCONTRACTS' ||
            i.item_name === 'Subcontracts'
          );

          if (subNode && subNode.children) {
            const hasWeekly = subNode.children.some(c => c.route_path === '/subcontracts/weekly-payments');
            if (!hasWeekly) {
              const payIdx = subNode.children.findIndex(c =>
                c.route_path === '/subcontracts/payments' ||
                c.item_code === 'SUBCONTRACTOR_PAYMENTS'
              );
              const weeklyItem = {
                item_code: 'SUBCONTRACTOR_WEEKLY_PAYMENTS',
                item_name: 'Weekly Payments',
                route_path: '/subcontracts/weekly-payments'
              };
              if (payIdx !== -1) {
                subNode.children.splice(payIdx + 1, 0, weeklyItem);
              } else {
                subNode.children.push(weeklyItem);
              }
            }
          }
          setNavigation(filterHiddenNavigation(processedItems));
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Navigation could not be loaded.');
      });
    return () => { active = false; };
  }, []);

  const normalize = (p) => (p ? p.trim().replace(/\/+$/, '') : '');

  // Collect all leaf route paths from navigation
  const allRoutes = useMemo(() => {
    const routes = [];
    const collect = (items) => {
      for (const item of items) {
        if (item.children && item.children.length > 0) {
          collect(item.children);
        } else if (item.route_path) {
          routes.push(normalize(item.route_path));
        }
      }
    };
    collect(navigation);
    return routes;
  }, [navigation]);

  // Determine the single active leaf route based on current location
  const activeRoute = useMemo(() => {
    const current = normalize(location.pathname);

    // 1. Exact match first
    const exactMatch = allRoutes.find((r) => r === current);
    if (exactMatch) return exactMatch;

    // 2. Longest matching prefix with path segment boundary
    const matching = allRoutes.filter((r) => {
      if (!r || r === '/') return current === '/';
      return current.startsWith(r + '/');
    });

    if (matching.length > 0) {
      matching.sort((a, b) => b.length - a.length);
      return matching[0];
    }

    return null;
  }, [location.pathname, allRoutes]);

  // Automatically expand all ancestor groups of the active route
  useEffect(() => {
    if (!activeRoute || navigation.length === 0) return;

    const findAncestors = (items, target, currentDepth = 0) => {
      for (const item of items) {
        if (item.children && item.children.length > 0) {
          const directChild = item.children.some((c) => normalize(c.route_path) === target);
          if (directChild) {
            return { [currentDepth]: item.item_code };
          }
          const nested = findAncestors(item.children, target, currentDepth + 1);
          if (nested) {
            return { [currentDepth]: item.item_code, ...nested };
          }
        }
      }
      return null;
    };

    const ancestors = findAncestors(navigation, activeRoute);
    if (ancestors) {
      setOpenByDepth((current) => ({ ...current, ...ancestors }));
    }
  }, [activeRoute, navigation]);

  return (
    <>
      {isMobileOpen && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onCloseMobile} />}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 flex h-full w-[230px] shrink-0 flex-col border-r border-white/10 bg-secondary transition-transform lg:static lg:translate-x-0',
        isMobileOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="flex h-16 items-center border-b border-white/10 px-5 text-[18px] font-bold tracking-tight text-white">CIVIL DESK</div>
        <nav className="flex-1 overflow-y-auto sidebar-scrollbar px-2 py-3" aria-label="Primary navigation">
          {error && <div className="m-2 rounded-sm bg-red-500/10 p-2 text-xs text-red-200">{error}</div>}
          {navigation.map((item) => (
            <NavigationItem
              key={item.item_code}
              item={item}
              activeRoute={activeRoute}
              openByDepth={openByDepth}
              onToggle={(code, depth) => setOpenByDepth((current) => {
                const next = { ...current };
                const isClosing = next[depth] === code;

                Object.keys(next).forEach((key) => {
                  if (Number(key) >= depth) delete next[key];
                });

                if (!isClosing) next[depth] = code;
                return next;
              })}
              onNavigate={onCloseMobile}
              dismissedBadges={dismissedBadges}
              onDismissBadge={handleDismissBadge}
            />
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className="mb-2 truncate text-xs text-[#C8D1DC]">{user?.first_name} {user?.last_name}</div>
          <button type="button" onClick={logout} className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm text-[#C8D1DC] hover:bg-white/5 hover:text-white">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>
    </>
  );
}
