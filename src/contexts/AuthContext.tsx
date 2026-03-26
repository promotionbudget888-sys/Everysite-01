import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
  useCallback,
} from 'react';
import {
  UserProfile,
  getSavedProfile,
  saveProfile,
  saveToken,
  clearAuth,
} from '@/lib/auth';

const TIMEOUT_USER  = 30 * 60 * 1000;      // 30 นาที (user ทั่วไป)
const TIMEOUT_ADMIN = 9 * 60 * 60 * 1000;  // 9 ชั่วโมง (admin)

const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
];

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

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    clearAuth();
    setProfile(null);
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
  }, []);

  // ── Inactivity timer ─────────────────────────────────────────────────────
  const resetInactivityTimer = useCallback(
    (currentProfile: UserProfile | null) => {
      if (!currentProfile) return;
      const timeout =
        currentProfile.role === 'admin' ? TIMEOUT_ADMIN : TIMEOUT_USER;
      const msg =
        currentProfile.role === 'admin'
          ? 'ระบบออกจากบัญชีอัตโนมัติเนื่องจากไม่มีการใช้งานเกิน 9 ชั่วโมง'
          : 'ระบบออกจากบัญชีอัตโนมัติเนื่องจากไม่มีการใช้งานเกิน 30 นาที';

      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(() => {
        clearAuth();
        setProfile(null);
        alert(msg);
      }, timeout);
    },
    []
  );

  // ── ติดตาม activity events ───────────────────────────────────────────────
  useEffect(() => {
    if (!profile) return;
    const handleActivity = () => resetInactivityTimer(profile);
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, handleActivity, { passive: true })
    );
    resetInactivityTimer(profile);
    return () => {
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, handleActivity)
      );
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [profile, resetInactivityTimer]);

  // ── โหลด profile จาก localStorage ตอนเปิดแอป ────────────────────────────
  useEffect(() => {
    const saved = getSavedProfile();
    setProfile(saved);
    setLoading(false);
  }, []);

  // ── Login — บันทึก profile ของ user คนนี้ลง key เฉพาะของเขา ─────────────
  const login = useCallback((p: UserProfile, token: string) => {
    saveProfile(p);   // ✅ saveProfile จะใช้ key = user_profile_{id}
    saveToken(token);
    setProfile(p);
  }, []);

  // ── refreshProfile — โหลดใหม่จาก localStorage ของ user คนปัจจุบัน ───────
  const refreshProfile = useCallback(() => {
    const saved = getSavedProfile(); // ✅ จะโหลด key ของ current_user_id เท่านั้น
    setProfile(saved);
  }, []);

  // ── updateProfile — อัปเดต state + localStorage ─────────────────────────
  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setProfile((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      saveProfile(updated); // ✅ save ลง key ของ user คนนี้เท่านั้น
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{ profile, loading, login, logout, updateProfile, refreshProfile }}
    >
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
