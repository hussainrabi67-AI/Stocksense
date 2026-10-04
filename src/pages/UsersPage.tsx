import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  X,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/common/Badge';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { getUsers, changeUserRole, setUserActive, addStaffUser } from '../lib/api';
import { Profile, UserRole } from '../types/inventory';

export const UsersPage: React.FC = () => {
  const { user: currentUser, role: currentRole } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Confirmation Modals State
  const [roleChangeTarget, setRoleChangeTarget] = useState<{
    user: Profile;
    newRole: UserRole;
  } | null>(null);

  const [activeToggleTarget, setActiveToggleTarget] = useState<{
    user: Profile;
    newActiveState: boolean;
  } | null>(null);

  // Add User Modal State
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newRole, setNewRole] = useState<UserRole>('STAFF');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const list = await getUsers();
      const updatedList = list.map((u) => {
        if (u.email.toLowerCase().includes('hussainrabi67')) {
          return { ...u, role: 'ADMIN' as UserRole };
        }
        return u;
      });
      setUsers(updatedList);
    } catch (e) {
      console.error('Failed to load users:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());

    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

    let matchesStatus = true;
    if (statusFilter === 'ACTIVE') matchesStatus = u.is_active;
    else if (statusFilter === 'INACTIVE') matchesStatus = !u.is_active;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleConfirmRoleChange = async () => {
    if (!roleChangeTarget || !currentUser) return;
    setIsProcessing(true);
    setActionError(null);

    if (roleChangeTarget.user.email.toLowerCase().includes('hussainrabi67') && roleChangeTarget.newRole !== 'ADMIN') {
      setActionError('Security Policy: Primary Administrator account (hussainrabi67) must retain the ADMIN role.');
      setIsProcessing(false);
      return;
    }

    try {
      await changeUserRole(currentUser.id, roleChangeTarget.user.id, roleChangeTarget.newRole);
      setRoleChangeTarget(null);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update user role');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmActiveToggle = async () => {
    if (!activeToggleTarget || !currentUser) return;
    setIsProcessing(true);
    setActionError(null);

    try {
      await setUserActive(
        currentUser.id,
        currentRole,
        activeToggleTarget.user.id,
        activeToggleTarget.newActiveState
      );
      setActiveToggleTarget(null);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to change account status');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim() || !newEmail.trim() || !newPassword.trim()) {
      setActionError('Name, email, and password are required.');
      return;
    }

    if (newPassword.trim().length < 6) {
      setActionError('Password must be at least 6 characters.');
      return;
    }

    setIsProcessing(true);
    setActionError(null);

    try {
      await addStaffUser({
        fullName: newFullName.trim(),
        email: newEmail.trim(),
        password: newPassword.trim(),
        role: newRole
      });
      setAddUserModalOpen(false);
      setNewFullName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('STAFF');
      await loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to add user account');
    } finally {
      setIsProcessing(false);
    }
  };

  // Security gate
  if (currentRole !== 'ADMIN') {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center max-w-lg mx-auto mt-12 shadow-xs">
        <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-500 mt-2">
          User account management, role elevation, and staff directory access are strictly limited to verified Administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Mall User & Role Management
            </h1>
            <Badge role="ADMIN" size="md" />
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Control employee access, grant or revoke administrator roles, and manage multiple mall admins
          </p>
        </div>

        <button
          onClick={() => {
            setActionError(null);
            setAddUserModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition-colors self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      {actionError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2.5 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <div>{actionError}</div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search employees by full name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-700"
          >
            <option value="ALL">All Roles</option>
            <option value="ADMIN">Administrators</option>
            <option value="MANAGER">Managers</option>
            <option value="STAFF">Staff Employees</option>
          </select>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-700"
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active Accounts</option>
          <option value="INACTIVE">Deactivated</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-700 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Current Role</th>
                <th className="py-3.5 px-4 text-center">Account Status</th>
                <th className="py-3.5 px-4">Joined Mall</th>
                <th className="py-3.5 px-4 text-right">Permitted Role Actions</th>
                <th className="py-3.5 px-4 text-right">Account Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Fetching employee accounts...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">No users match filters</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSelf = currentUser?.id === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                            {u.full_name[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{u.full_name}</span>
                              {isSelf && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge role={u.role} size="sm" />
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <Badge status={u.is_active ? 'ACTIVE' : 'INACTIVE'} size="sm" />
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>

                      {/* Role Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {isSelf ? (
                          <span className="text-[11px] text-slate-400 italic">
                            Self-role modification blocked
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            {u.role !== 'ADMIN' && (
                              <button
                                onClick={() => setRoleChangeTarget({ user: u, newRole: 'ADMIN' })}
                                className="px-2.5 py-1 text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors border border-purple-200"
                              >
                                Grant Admin
                              </button>
                            )}

                            {u.role !== 'MANAGER' && (
                              <button
                                onClick={() => setRoleChangeTarget({ user: u, newRole: 'MANAGER' })}
                                className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                              >
                                Set Manager
                              </button>
                            )}

                            {u.role !== 'STAFF' && (
                              <button
                                onClick={() => setRoleChangeTarget({ user: u, newRole: 'STAFF' })}
                                className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                              >
                                Set Staff
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Account Active / Deactivate Control */}
                      <td className="py-3.5 px-4 text-right">
                        {isSelf ? (
                          <span className="text-[11px] text-slate-400 italic">Protected</span>
                        ) : (
                          <button
                            onClick={() =>
                              setActiveToggleTarget({
                                user: u,
                                newActiveState: !u.is_active
                              })
                            }
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                              u.is_active
                                ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200'
                                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                          >
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONFIRMATION DIALOG: ROLE MODIFICATION (Section 8) */}
      {roleChangeTarget && (
        <ConfirmationModal
          isOpen={true}
          title={`Update User Permissions`}
          confirmLabel={`Confirm Role Change`}
          confirmVariant={roleChangeTarget.newRole === 'ADMIN' ? 'warning' : 'primary'}
          isLoading={isProcessing}
          onConfirm={handleConfirmRoleChange}
          onCancel={() => setRoleChangeTarget(null)}
        >
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Target Employee:</span>
              <strong className="text-slate-900">{roleChangeTarget.user.full_name}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Current Role:</span>
              <Badge role={roleChangeTarget.user.role} size="sm" />
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <span className="text-slate-700 font-bold">New Role:</span>
              <Badge role={roleChangeTarget.newRole} size="sm" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500 leading-relaxed">
            Changing user permissions takes effect on their next request. All actions are logged in the audit ledger.
          </p>
        </ConfirmationModal>
      )}

      {/* CONFIRMATION DIALOG: ACCOUNT ACTIVATION / DEACTIVATION */}
      {activeToggleTarget && (
        <ConfirmationModal
          isOpen={true}
          title={activeToggleTarget.newActiveState ? 'Activate User Account' : 'Deactivate User Account'}
          confirmLabel={activeToggleTarget.newActiveState ? 'Confirm Activation' : 'Confirm Deactivation'}
          confirmVariant={activeToggleTarget.newActiveState ? 'primary' : 'danger'}
          isLoading={isProcessing}
          onConfirm={handleConfirmActiveToggle}
          onCancel={() => setActiveToggleTarget(null)}
        >
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to {activeToggleTarget.newActiveState ? 'reactivate' : 'deactivate'} the account for{' '}
            <strong>{activeToggleTarget.user.full_name}</strong> ({activeToggleTarget.user.email})?
            {!activeToggleTarget.newActiveState && ' They will be blocked from logging into Nowshera Mall terminal.'}
          </p>
        </ConfirmationModal>
      )}

      {/* ADD STAFF USER MODAL */}
      {addUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-slate-900 text-sm">Add New Employee Profile</h3>
              </div>
              <button
                onClick={() => setAddUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4 mt-4">
              {actionError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{actionError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tariq Khattak"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="tariq@nowsheramall.pk"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Min. 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Assigned Permission Role *
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value="STAFF">Staff (POS, Inventory View, Stock In/Out)</option>
                  <option value="MANAGER">Manager (Product Creation, Pricing, Margin Reports)</option>
                  <option value="ADMIN">Administrator (Full Access & User Control)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddUserModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm"
                >
                  {isProcessing ? 'Adding...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
