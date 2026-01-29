'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { TeamProvider } from '@/contexts/TeamContext';
import { TeamSwitcher } from '@/components/TeamSwitcher';
import { getUserApiKeys, createApiKey, revokeApiKey, type ApiKey,} from '@/lib/apiKeys';

function ApiKeysContent() {
  const { user, logout } = useAuth();
  const { currentTeam } = useTeam();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string>('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (currentTeam) {
      loadApiKeys();
    }
  }, [currentTeam]);

  const loadApiKeys = async () => {
    if (!currentTeam) return;

    try {
      setLoading(true);
      setError('');
      const data = await getUserApiKeys(currentTeam.id);
      setKeys(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!currentTeam || !keyName.trim()) return;

    try {
      setCreating(true);
      setError('');
      const result = await createApiKey({
        teamId: currentTeam.id,
        name: keyName.trim(),
        environment: 'live',
      });

      setCreatedKey(result.key);
      setKeyName('');
      await loadApiKeys();
    } catch (err: any) {
      setError(err.message || 'Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    try {
      setError('');
      await revokeApiKey(keyId);
      await loadApiKeys();
    } catch (err: any) {
      setError(err.message || 'Failed to revoke API key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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
                <Link href="/api-keys" className="px-3 py-1.5 text-sm font-medium text-zinc-900 bg-zinc-100 rounded-md">
                  API Keys
                </Link>
                <Link href="/team-members" className="px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-md transition-colors">
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
          <h1 className="text-2xl font-bold text-zinc-900">API Keys</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage API keys for {currentTeam?.name}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="mb-6">
          <button
            onClick={() => {
              setShowModal(true);
              setCreatedKey('');
            }}
            className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors"
          >
            Create API Key
          </button>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4">
                {createdKey ? 'API Key Created' : 'Create New API Key'}
              </h3>

              {createdKey ? (
                <div>
                  <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800 font-medium mb-2">
                      Save this key now because you won't be able to see it again!
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 bg-white border border-amber-200 rounded text-sm font-mono break-all">
                        {createdKey}
                      </code>
                      <button
                        onClick={() => copyToClipboard(createdKey)}
                        className="px-3 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 text-sm transition-colors">
                        Copy
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setCreatedKey('');
                    }}
                    className="w-full px-4 py-2.5 bg-zinc-100 text-zinc-900 text-sm font-medium rounded-lg hover:bg-zinc-200 transition-colors">
                    Done
                  </button>
                </div>
              ) : (<div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-zinc-700 mb-2">Key Name</label>
                    <input
                      type="text"
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      placeholder="e.g., Production Server"
                      className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"/>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCreateKey}
                      disabled={creating || !keyName.trim()}
                      className="flex-1 px-4 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                      {creating ? 'Creating...' : 'Create'}
                    </button>
                    <button
                      onClick={() => {
                        setShowModal(false);
                        setKeyName('');
                      }}
                      className="flex-1 px-4 py-2.5 bg-zinc-100 text-zinc-900 text-sm font-medium rounded-lg hover:bg-zinc-200 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-zinc-500">Loading...</div>
          ) : keys.length === 0 ? (
            <div className="p-12 text-center text-zinc-500">
              No API keys yet. Create one to get started.
            </div>) : (
            <table className="min-w-full">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Prefix</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Last Used</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {keys.map((key) => (
                  <tr key={key.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4 text-sm font-medium text-zinc-900">
                      {key.name || 'Unnamed'}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-500 font-mono">
                      {key.prefix}...
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-500">
                      {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-md ${key.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {key.is_active ? 'Active' : 'Revoked'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {key.is_active && (
                        <button
                          onClick={() => handleRevokeKey(key.id)}
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
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

export default function ApiKeysPage() {
  return (
    <TeamProvider>
      <ApiKeysContent />
    </TeamProvider>
  );
}
