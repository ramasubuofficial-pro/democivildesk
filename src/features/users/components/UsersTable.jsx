import { useState, useEffect, useRef } from 'react';
import { 
  Eye, 
  Edit, 
  MoreVertical, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShieldCheck, 
  Trash2, 
  Crown,
  Lock,
  User
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { DataTableContainer } from '../../../components/composite/DataTableContainer';
import { Pagination } from '../../../components/composite/Pagination';
import { usersApi } from '../../../api/apiservice';
import { UserDetailModal } from './UserDetailModal';
import { UserFormModal } from './UserFormModal';
import { toast } from '../../../components/composite/Toast';

function extractUsersList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.users)) return response.users;
  if (Array.isArray(response.data?.users)) return response.data.users;
  if (Array.isArray(response.data?.data)) return response.data.data;
  if (response.data && typeof response.data === 'object' && (response.data.id || response.data.username || response.data.email)) {
    return [response.data];
  }
  if (response && typeof response === 'object' && (response.id || response.username || response.email)) {
    return [response];
  }
  return [];
}

export function UsersTable({ 
  searchQuery = '', 
  statusFilter = 'all', 
  roleFilter = 'all',
  isAddOpen = false,
  setIsAddOpen = () => {}
}) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [page, setPage] = useState(1);
  const perPage = 10;

  const menuRef = useRef(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await usersApi.list();
      const list = extractUsersList(response);
      setUsers(list);
    } catch (error) {
      console.error("[UsersTable] Failed to fetch users:", error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDeleteUser = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete user "${name}"?`)) return;
    try {
      await usersApi.remove(id);
      toast.success('User deleted successfully');
      fetchUsers();
    } catch (err) {
      toast.error(err?.message || 'Failed to delete user');
    }
    setOpenMenuId(null);
  };

  const handleToggleStatus = async (userObj) => {
    const nextStatus = userObj.is_active === 1 || userObj.is_active === '1' || userObj.is_active === true ? 0 : 1;
    try {
      await usersApi.update(userObj.id, { is_active: nextStatus, active: nextStatus });
      toast.success(`User marked as ${nextStatus ? 'Active' : 'Inactive'}`);
      fetchUsers();
    } catch (err) {
      toast.error(err?.message || 'Failed to update status');
    }
    setOpenMenuId(null);
  };

  const filteredUsers = users.filter((u) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
      const username = (u.username || '').toLowerCase();
      const empCode = (u.employee_code || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const phone = (u.phone || '').toLowerCase();
      const desig = (u.designation || '').toLowerCase();
      const match = fullName.includes(q) || username.includes(q) || empCode.includes(q) || email.includes(q) || phone.includes(q) || desig.includes(q);
      if (!match) return false;
    }

    const isActive = u.is_active === 1 || u.is_active === '1' || u.active === 1 || u.active === '1' || u.status === 'Active' || u.is_active === true;
    if (statusFilter === 'active' && !isActive) return false;
    if (statusFilter === 'inactive' && isActive) return false;

    const isSuper = u.is_super_admin === 1 || u.is_super_admin === '1' || u.is_super_admin === true;
    if (roleFilter === 'admin' && !isSuper) return false;
    if (roleFilter === 'staff' && isSuper) return false;

    return true;
  });

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / perPage));
  const pagedUsers = filteredUsers.slice((page - 1) * perPage, page * perPage);

  const renderPagination = () => (
    <Pagination 
      currentPage={page}
      totalPages={totalPages}
      totalItems={filteredUsers.length}
      itemsPerPage={perPage}
      onPageChange={setPage}
      onItemsPerPageChange={() => {}}
    />
  );

  return (
    <>
      {/* Desktop & Tablet Table */}
      <div className="hidden sm:block">
        <DataTableContainer pagination={renderPagination()}>
          <table className="w-full text-left text-[12px] whitespace-nowrap table-fixed">
            <thead className="bg-surface-muted text-text-secondary text-[11px] uppercase font-semibold border-b border-border tracking-wider">
              <tr>
                <th className="px-2 py-1.5 w-10 text-center">#</th>
                <th className="px-2 py-1.5 w-24">Employee Code</th>
                <th className="px-2 py-1.5 w-40">Name</th>
                <th className="px-2 py-1.5 w-32">Username</th>
                <th className="px-2 py-1.5 w-32">Designation</th>
                <th className="px-2 py-1.5 w-44">Email</th>
                <th className="px-2 py-1.5 w-28">Phone</th>
                <th className="px-2 py-1.5 w-28">Last Login</th>
                <th className="px-2 py-1.5 w-20 text-center">Status</th>
                <th className="px-2 py-1.5 text-center w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan="10" className="text-center py-6 text-text-muted text-[12px]">
                    Loading users from database...
                  </td>
                </tr>
              ) : pagedUsers.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center py-6 text-text-muted text-[12px]">
                    No users found in database.
                  </td>
                </tr>
              ) : (
                pagedUsers.map((userObj, index) => {
                  const empCode = userObj.employee_code || '—';
                  const fullName = [userObj.first_name, userObj.last_name].filter(Boolean).join(' ') || userObj.username || '—';
                  const username = userObj.username || '—';
                  const designation = userObj.designation || '—';
                  const email = userObj.email;
                  const phone = userObj.phone;
                  const lastLogin = userObj.last_login_at ? userObj.last_login_at.split(' ')[0] : (userObj.last_active ? userObj.last_active.split(' ')[0] : '—');
                  const isSuper = userObj.is_super_admin === 1 || userObj.is_super_admin === '1' || userObj.is_super_admin === true;
                  const isActive = userObj.is_active === 1 || userObj.is_active === '1' || userObj.active === 1 || userObj.active === '1' || userObj.status === 'Active' || userObj.is_active === true;
                  const isMenuOpen = openMenuId === userObj.id;

                  return (
                    <tr key={userObj.id || index} className="hover:bg-surface-muted/30 transition-colors group relative">
                      <td className="px-2 py-1 text-center font-medium text-text-primary text-[11px]">{(page - 1) * perPage + index + 1}</td>
                      <td className="px-2 py-1 font-mono font-semibold text-text-primary text-[11px]">{empCode}</td>
                      <td className="px-2 py-1 font-medium text-text-primary truncate" title={fullName}>
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{fullName}</span>
                          {isSuper && <Crown className="w-2.5 h-2.5 text-amber-500 shrink-0" title="Super Admin" />}
                        </div>
                      </td>
                      <td className="px-2 py-1 text-text-secondary truncate text-[11px] font-mono">
                        {username !== '—' ? `@${username}` : '—'}
                      </td>
                      <td className="px-2 py-1 text-text-secondary truncate text-[11px]" title={designation}>
                        {designation}
                      </td>
                      <td className="px-2 py-1 text-text-secondary truncate text-[11px]" title={email}>
                        {email || '—'}
                      </td>
                      <td className="px-2 py-1 text-text-secondary truncate text-[11px]">
                        {phone || '—'}
                      </td>
                      <td className="px-2 py-1 text-text-secondary truncate text-[11px]">
                        <span className="font-medium text-text-primary">{lastLogin}</span>
                      </td>
                      <td className="px-2 py-1 text-center">
                        <Badge 
                          variant={isActive ? 'success' : 'neutral'}
                          className="text-[8px] font-bold uppercase tracking-wider h-4 px-1.5 inline-flex items-center gap-0.5"
                        >
                          {isActive ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                          {isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-2 py-1">
                        <div className="flex items-center justify-center gap-0.5">
                          {/* View Eye Button */}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setSelectedUser(userObj)}
                            className="h-6 w-6 p-0" 
                            title="View User Details"
                          >
                            <Eye className="w-3.5 h-3.5 text-text-secondary hover:text-primary" />
                          </Button>

                          {/* Edit Button */}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setEditingUser(userObj)}
                            className="h-6 w-6 p-0" 
                            title="Edit User"
                          >
                            <Edit className="w-3.5 h-3.5 text-text-secondary hover:text-primary" />
                          </Button>

                          {/* Three Dots More Actions Menu */}
                          <div className="relative">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(isMenuOpen ? null : userObj.id);
                              }}
                              className={`h-6 w-6 p-0 ${isMenuOpen ? 'text-primary bg-surface-muted' : 'text-text-secondary'}`}
                              title="More Options"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </Button>

                            {/* Dropdown Menu Popup */}
                            {isMenuOpen && (
                              <div 
                                ref={menuRef}
                                className="absolute right-0 top-7 z-50 w-40 bg-surface border border-border rounded-sm shadow-xl p-1 text-[11px] animate-in fade-in zoom-in-95 duration-100"
                              >
                                <button
                                  onClick={() => {
                                    setSelectedUser(userObj);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-xs hover:bg-surface-muted flex items-center gap-2 text-text-primary"
                                >
                                  <Eye className="w-3.5 h-3.5 text-primary" />
                                  <span>View Details</span>
                                </button>
                                
                                <button
                                  onClick={() => {
                                    setEditingUser(userObj);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-xs hover:bg-surface-muted flex items-center gap-2 text-text-primary"
                                >
                                  <Edit className="w-3.5 h-3.5 text-text-secondary" />
                                  <span>Edit User</span>
                                </button>

                                <button
                                  onClick={() => handleToggleStatus(userObj)}
                                  className="w-full text-left px-2.5 py-1.5 rounded-xs hover:bg-surface-muted flex items-center gap-2 text-text-primary"
                                >
                                  {isActive ? <XCircle className="w-3.5 h-3.5 text-amber-500" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                                  <span>{isActive ? 'Mark Inactive' : 'Mark Active'}</span>
                                </button>

                                <div className="border-t border-border my-1"></div>

                                <button
                                  onClick={() => handleDeleteUser(userObj.id, fullName)}
                                  className="w-full text-left px-2.5 py-1.5 rounded-xs hover:bg-error/10 flex items-center gap-2 text-error"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete User</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </DataTableContainer>
      </div>

      {/* Mobile View - Cards List for Phones (< sm) */}
      <div className="block sm:hidden space-y-3">
        {loading ? (
          <div className="bg-surface border border-border rounded-lg p-6 text-center text-text-muted text-[13px]">
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Loading users...</span>
            </div>
          </div>
        ) : pagedUsers.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg p-6 text-center text-text-muted text-[13px]">
            <User className="w-8 h-8 text-text-muted/60 mx-auto mb-2" />
            <p className="font-medium text-text-secondary">No Users Found</p>
            <p className="text-xs text-text-muted mt-1">No records match the current status, role, or search query.</p>
          </div>
        ) : (
          pagedUsers.map((userObj, index) => {
            const empCode = userObj.employee_code || '—';
            const fullName = [userObj.first_name, userObj.last_name].filter(Boolean).join(' ') || userObj.username || '—';
            const username = userObj.username || '—';
            const designation = userObj.designation || '—';
            const email = userObj.email;
            const phone = userObj.phone;
            const lastLogin = userObj.last_login_at ? userObj.last_login_at.split(' ')[0] : (userObj.last_active ? userObj.last_active.split(' ')[0] : '—');
            const isSuper = userObj.is_super_admin === 1 || userObj.is_super_admin === '1' || userObj.is_super_admin === true;
            const isActive = userObj.is_active === 1 || userObj.is_active === '1' || userObj.active === 1 || userObj.active === '1' || userObj.status === 'Active' || userObj.is_active === true;

            return (
              <div key={userObj.id || index} className="bg-surface border border-border rounded-lg p-3.5 shadow-xs space-y-2.5">
                {/* Card Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[10px] font-bold text-primary block">
                        {empCode}
                      </span>
                      {isSuper && (
                        <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 inline-flex items-center gap-1">
                          <Crown className="w-2.5 h-2.5" /> Super Admin
                        </span>
                      )}
                    </div>
                    <h4 className="font-semibold text-text-primary text-[13px] leading-snug truncate mt-0.5" title={fullName}>
                      {fullName}
                    </h4>
                    {username !== '—' && (
                      <span className="text-[11px] text-text-muted truncate block font-mono">
                        @{username}
                      </span>
                    )}
                  </div>
                  <Badge 
                    variant={isActive ? 'success' : 'neutral'}
                    className="text-[8px] font-bold uppercase tracking-wider h-4 px-1.5 inline-flex items-center gap-0.5 shrink-0"
                  >
                    {isActive ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                    {isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                {/* Card Details Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/60">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-text-muted block">Role / Designation</span>
                    <span className="text-[11px] text-text-primary font-medium truncate block" title={designation}>
                      {designation}
                    </span>
                    {lastLogin !== '—' && (
                      <span className="text-[10px] text-text-muted block truncate mt-0.5">
                        Last seen: {lastLogin}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-text-muted block">Contact</span>
                    <span className="text-[11px] text-text-primary truncate block" title={email}>
                      {email || '—'}
                    </span>
                    <span className="text-[10px] text-text-muted block font-mono">
                      {phone || '—'}
                    </span>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                  <span className="text-[10px] text-text-muted font-mono">
                    #{(page - 1) * perPage + index + 1}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-[11px] px-2.5"
                      onClick={() => setSelectedUser(userObj)}
                    >
                      <Eye className="w-3 h-3 mr-1" /> View
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-[11px] px-2.5"
                      onClick={() => setEditingUser(userObj)}
                    >
                      <Edit className="w-3 h-3 mr-1" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`h-7 text-[11px] px-2 ${isActive ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'}`}
                      onClick={() => handleToggleStatus(userObj)}
                      title={isActive ? 'Mark Inactive' : 'Mark Active'}
                    >
                      {isActive ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] px-2 text-red-600 hover:text-red-700"
                      onClick={() => handleDeleteUser(userObj.id, fullName)}
                      title="Delete User"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Mobile Pagination */}
        <div className="pt-2">
          {renderPagination()}
        </div>
      </div>

      {/* Full Detail Modal */}
      {selectedUser && (
        <UserDetailModal 
          user={selectedUser} 
          onClose={() => setSelectedUser(null)} 
        />
      )}

      {/* Edit / Add User Modal */}
      {(editingUser || isAddOpen) && (
        <UserFormModal
          isOpen={Boolean(editingUser || isAddOpen)}
          user={editingUser}
          onClose={() => {
            setEditingUser(null);
            setIsAddOpen(false);
          }}
          onSaveSuccess={fetchUsers}
        />
      )}
    </>
  );
}
