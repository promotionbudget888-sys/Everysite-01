import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { UserProfile, getSavedProfile, saveProfile, saveToken, clearAuth } from '@/lib/auth';

interface AuthContextType {
  profile: UserProfile | null;
  loading: boolean;
  login: (profile: UserProfile, token: string) => void;
  logout: () => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  refreshProfile: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = getSavedProfile();
    setProfile(saved);
    setLoading(false);
  }, []);

  const login = (p: UserProfile, token: string) => {
    saveProfile(p);
    saveToken(token);
    setProfile(p);
  };

  const logout = () => {
    clearAuth();
    setProfile(null);
  };

  const refreshProfile = useCallback(() => {
    const saved = getSavedProfile();
    setProfile(saved);
  }, []);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setProfile(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      saveProfile(updated);
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ profile, loading, login, logout, updateProfile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
