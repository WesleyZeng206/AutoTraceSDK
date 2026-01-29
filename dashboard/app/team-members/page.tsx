'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { TeamProvider } from '@/contexts/TeamContext';
import { TeamSwitcher } from '@/components/TeamSwitcher';
import { getTeamMembers, addTeamMember, removeMember, updateMemberRole, type TeamMember } from '@/lib/teams';

function TeamMembersContent() {
  const { user, logout } = useAuth();
  const { currentTeam } = useTeam();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'admin' | 'member'>('member');
  const [isAdding, setIsAdding] = useState(false);
  const [modalError, setModalError] = useState<string>('');

  const userRole = currentTeam?.role;
  const canManageMembers = userRole === 'owner' || userRole === 'admin';

  useEffect(() => {
    if (currentTeam) {
      loadMembers();
    }
  }, [currentTeam]);

  const loadMembers = async () => {
    if (!currentTeam) return;
    try {
      setIsLoading(true);
      setError('');
      const teamMembers = await getTeamMembers(currentTeam.id);
      setMembers(teamMembers);
    } catch (err: any) {
      setError(err.message || 'Failed to load team members');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!currentTeam || !newMemberEmail.trim()) return;
    try {
      setIsAdding(true);
      setModalError('');
      await addTeamMember(currentTeam.id, newMemberEmail.trim(), newMemberRole);
      setNewMemberEmail('');
      setShowAddModal(false);
      setModalError('');
      await loadMembers();
    } catch (err: any) {
      setModalError(err.message || 'Failed to add team member');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveMember = async (userId: string, username: string) => {
    if (!currentTeam) return;
    if (!confirm(`Are you sure you want to remove ${username} from the team?`)) return;
    try {
      setError('');
      await removeMember(currentTeam.id, userId);
      await loadMembers();
    } catch (err: any) {
      setError(err.message || 'Failed to remove member');
    }
  };

  const handleUpdateRole = async (userId: string, newRole: 'admin' | 'member') => {
    if (!currentTeam) return;
    try {
      setError('');
      await updateMemberRole(currentTeam.id, userId, newRole);
      await loadMembers();
    } catch (err: any) {
      setError(err.message || 'Failed to update member role');
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <nav className="bg-white border-b border-zinc-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-7 h-7 bg-zinc-900 rounded-md flex items-center justify-center">
                  <span className="text-white font-bold text-xs">AT</span>
                </div>
                <span className="text-base font-semibold text-zinc-900">AutoTrace</span>
              </Link>
              <div className="flex items-center gap-1">
                <Link href="/dashboard" className="px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-md transition-colors">
                  Dashboard
                </Link>
                <Link href="/api-keys" className="px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-md transition-colors">
                  API Keys
                </Link>
                <Link href="/team-members" className="px-3 py-1.5 text-sm font-medium text-zinc-900 bg-zinc-100 rounded-md">
                  Team
                </Link>
                <Link href="/docs" className="px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-md transition-colors">
                  Docs
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <TeamSwitcher />
              <div className="h-6 w-px bg-zinc-200" />
              <span className="text-sm text-zinc-600">{user?.username}</span>
              <button onClick={logout} className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900">Team Members</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage members of {currentTeam?.name}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {canManageMembers && (
          <div className="mb-6">
            <button
              onClick={() => { setShowAddModal(true); setModalError(''); }}
              className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Add Member
            </button>
          </div>
        )}

        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4">Add Team Member</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-700 mb-2">Email or Username</label>
                <input
                  type="text"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="email@example.com or username"
                  className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-700 mb-2">Role</label>
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as 'admin' | 'member')}
                  className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {modalError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{modalError}</p>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={handleAddMember}
                  disabled={isAdding || !newMemberEmail.trim()}
                  className="flex-1 px-4 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isAdding ? 'Adding...' : 'Add'}
                </button>
                <button
                  onClick={() => { setShowAddModal(false); setNewMemberEmail(''); setModalError(''); }}
                  className="flex-1 px-4 py-2.5 bg-zinc-100 text-zinc-900 text-sm font-medium rounded-lg hover:bg-zinc-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-zinc-500">Loading...</div>
          ) : members.length === 0 ? (
            <div className="p-12 text-center text-zinc-500">No team members found.</div>
          ) : (
            <table className="min-w-full">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Joined</th>
                  {canManageMembers && <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {members.map((member) => (
                  <tr key={member.user_id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4 text-sm font-medium text-zinc-900">
                      {member.username}
                      {member.user_id === user?.id && <span className="ml-2 text-xs text-zinc-500">(You)</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-500">{member.email}</td>
                    <td className="px-6 py-4">
                      {canManageMembers && member.role !== 'owner' ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleUpdateRole(member.user_id, e.target.value as 'admin' | 'member')}
                          className="text-sm border border-zinc-200 rounded-md px-2 py-1 bg-white"
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                        </select>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-md bg-zinc-100 text-zinc-700 capitalize">{member.role}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-500">{new Date(member.joined_at).toLocaleDateString()}</td>
                    {canManageMembers && (
                      <td className="px-6 py-4 text-sm">
                        {member.role !== 'owner' && member.user_id !== user?.id && (
                          <button onClick={() => handleRemoveMember(member.user_id, member.username)} className="text-red-600 hover:text-red-800 font-medium">
                            Remove
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TeamMembersPage() {
  return (
    <TeamProvider>
      <TeamMembersContent />
    </TeamProvider>
  );
}
