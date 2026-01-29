'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import type { Team } from '@/lib/auth';

interface TeamContextType {
  currentTeam: Team | null;
  setCurrentTeam: (team: Team) => void;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export function TeamProvider({ children }: { children: ReactNode }) {
  const { teams } = useAuth();
  const [currentTeam, setCurrentTeamState] = useState<Team | null>(null);

  useEffect(() => {
    if (teams && teams.length > 0) {
      const savedTeamId = localStorage.getItem('current_team_id');

      if (savedTeamId) {
        const savedTeam = teams.find((t) => t.id === savedTeamId);
        if (savedTeam) {
          setCurrentTeamState(savedTeam);
          return;
        }
      }

      setCurrentTeamState(teams[0]);
      localStorage.setItem('current_team_id', teams[0].id);
      return;
    }
    setCurrentTeamState(null);
  }, [teams]);

  const setCurrentTeam = (team: Team) => {
    setCurrentTeamState(team);
    localStorage.setItem('current_team_id', team.id);
  };

  return (
    <TeamContext.Provider value={{ currentTeam, setCurrentTeam }}>
      {children}
    </TeamContext.Provider>);
}

export function useTeam() {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
}
