import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
  useCallback,
} from 'react';
import { supabase } from '@/integrations/supabase/client';
import { setCurrentActor } from '@/lib/db';
import { UserProfile, UserRole, UserStatus } from '@/lib/auth';

const TIMEOUT_USER  = 30 * 60 * 1000;      // 30 นาที (user ทั่วไป)
const TIMEOUT_ADMIN = 9 * 60 * 60 * 1000;  // 9 ชั่วโมง (admin)

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

export interface SignInResult {
  ok: boolean;
  status?: UserStatus;
  error?: string;
}

interface AuthContextType {
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// map แถว profiles (Supabase) -> UserProfile
function rowToProfile(row: Record<string, unknown>): UserProfile {
  return {
    id:                    String(row.id),
    email:                 String(row.email ?? ''),
    full_name:             String(row.full_name ?? ''),
    first_name:            (row.first_name as string) ?? null,
    last_name:             (row.last_name as string) ?? null,
    role:                  (row.role as UserRole) ?? 'requester',
    zone_id:               (row.zone_id as string) ?? null,
    status:                (row.status as UserStatus) ?? 'pending',
    phone:                 (row.phone as string) ?? null,
    affiliation:           (row.affiliation as string) ?? null,
    department:            (row.department as string) ?? null,
    branch:                (row.branch as string) ?? null,
    budget_matching_fund:  Number(row.budget_matching_fund ?? 0),
    budget_everysite:      Number(row.budget_everysite ?? 0),
    used_matching_fund:    Number(row.used_matching_fund ?? 0),
    used_everysite:        Number(row.used_everysite ?? 0),
    pending_matching_fund: Number(row.pending_matching_fund ?? 0),
    pending_everysite:     Number(row.pending_everysite ?? 0),
    created_at:            String(row.created_at ?? ''),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── โหลด profile ของ user จาก Supabase ──────────────────────────────────
  const loadProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) {
      setProfile(null);
      return null;
    }
    const p = rowToProfile(data as Record<string, unknown>);
    setProfile(p);
    return p;
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    setProfile(null);
    await supabase.auth.signOut();
  }, []);

  // ── Inactivity timer ─────────────────────────────────────────────────────
  const resetInactivityTimer = useCallback((current: UserProfile | null) => {
    if (!current) return;
    const timeout = current.role === 'admin' ? TIMEOUT_ADMIN : TIMEOUT_USER;
    const msg =
      current.role === 'admin'
        ? 'ระบบออกจากบัญชีอัตโนมัติเนื่องจากไม่มีการใช้งานเกิน 9 ชั่วโมง'
        : 'ระบบออกจากบัญชีอัตโนมัติเนื่องจากไม่มีการใช้งานเกิน 30 นาที';
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      setProfile(null);
      supabase.auth.signOut();
      alert(msg);
    }, timeout);
  }, []);

  // sync actor สำหรับ audit log
  useEffect(() => { setCurrentActor(profile); }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const handleActivity = () => resetInactivityTimer(profile);
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));
    resetInactivityTimer(profile);
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, handleActivity));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [profile, resetInactivityTimer]);

  // ── โหลด session ตอนเปิดแอป + subscribe การเปลี่ยนแปลง auth ───────────────
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) await loadProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // เลี่ยง deadlock: อย่า await supabase ภายใน callback โดยตรง
      setTimeout(() => {
        if (!mounted) return;
        if (session?.user) loadProfile(session.user.id);
        else setProfile(null);
      }, 0);
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [loadProfile]);

  // ── Sign in ด้วย Supabase Auth ───────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });
    if (error || !data.user) {
      return { ok: false, error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
    }
    const p = await loadProfile(data.user.id);
    if (!p) {
      await supabase.auth.signOut();
      return { ok: false, error: 'ไม่พบข้อมูลผู้ใช้ในระบบ' };
    }
    if (p.status === 'pending' || p.status === 'rejected') {
      await supabase.auth.signOut();
      setProfile(null);
      return { ok: false, status: p.status };
    }
    return { ok: true };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) await loadProfile(session.user.id);
  }, [loadProfile]);

  // ── updateProfile — อัปเดต state + บันทึกลง Supabase ─────────────────────
  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setProfile((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      // persist (fire-and-forget) — ตัด field ที่ไม่ควรเขียน
      const { id, email, created_at, ...writable } = updates as Record<string, unknown> & { id?: string };
      supabase.from('profiles').update(writable).eq('id', prev.id).then(({ error }) => {
        if (error) console.warn('updateProfile persist failed:', error.message);
      });
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ profile, loading, signIn, logout, updateProfile, refreshProfile }}>
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
