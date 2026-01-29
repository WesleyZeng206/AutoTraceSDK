'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';

export function TeamSwitcher() {
  const { teams } = useAuth();
  const { currentTeam, setCurrentTeam } = useTeam();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!teams || teams.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors">
        <span className="w-5 h-5 bg-zinc-900 rounded flex items-center justify-center text-white text-xs font-medium">
          {currentTeam?.name?.charAt(0)?.toUpperCase() || 'T'}
        </span>
        <span className="font-medium text-zinc-900 max-w-32 truncate">
          {currentTeam?.name || 'Select Team'}
        </span>
        <svg
          className={`w-4 h-4 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-zinc-200 py-1 z-50">
          <div className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Teams
          </div>
          {teams.map((team) => (
            <button
              key={team.id}
              onClick={() => {
                setCurrentTeam(team);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-zinc-50 transition-colors ${
                currentTeam?.id === team.id ? 'bg-zinc-50' : ''}`}>
              <span className="w-6 h-6 bg-zinc-900 rounded flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                {team.name.charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-zinc-900 truncate">{team.name}</div>
                <div className="text-xs text-zinc-500 capitalize">{team.role}</div>
              </div>
              {currentTeam?.id === team.id && (
                <svg className="w-4 h-4 text-zinc-900 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
