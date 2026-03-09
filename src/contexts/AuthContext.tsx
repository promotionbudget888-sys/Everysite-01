import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { UserProfile, getSavedProfile, saveProfile, saveToken, clearAuth } from '@/lib/auth';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 นาที
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

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
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logout = useCallback(() => {
    clearAuth();
    setProfile(null);
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
  }, []);

  const resetInactivityTimer = useCallback((currentProfile: UserProfile | null) => {
    // เฉพาะ role ที่ไม่ใช่ admin เท่านั้นที่จะ timeout
    if (!currentProfile || currentProfile.role === 'admin') return;

    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      clearAuth();
      setProfile(null);
      // แจ้งเตือนผู้ใช้
      alert('ระบบออกจากบัญชีอัตโนมัติเนื่องจากไม่มีการใช้งานเกิน 30 นาที');
    }, INACTIVITY_TIMEOUT);
  }, []);

  // ติดตาม activity events
  useEffect(() => {
    if (!profile) return;

    const handleActivity = () => resetInactivityTimer(profile);

    ACTIVITY_EVENTS.forEach(event => window.addEventListener(event, handleActivity, { passive: true }));
    resetInactivityTimer(profile); // เริ่ม timer ทันทีที่ login

    return () => {
      ACTIVITY_EVENTS.forEach(event => window.removeEventListener(event, handleActivity));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [profile, resetInactivityTimer]);

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
