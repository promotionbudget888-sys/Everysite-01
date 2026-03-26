export type UserRole = 'requester' | 'zone_approver_1' | 'zone_approver_2' | 'admin';
export type UserStatus = 'pending' | 'approved' | 'rejected';
export type Affiliation = 'นครหลวง' | 'ภูมิภาค';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  zone_id: string | null;
  status: UserStatus;
  phone: string | null;
  affiliation: string | null;
  department: string | null;
  branch: string | null;
  budget_matching_fund: number;
  budget_everysite: number;
  used_matching_fund: number;
  used_everysite: number;
  pending_matching_fund: number;
  pending_everysite: number;
  created_at: string;
}

const TOKEN_KEY        = "auth_token";
const CURRENT_USER_KEY = "current_user_id";

// ✅ key ผูกกับ user id — ป้องกัน profile ทับกันข้ามคน
function profileKey(userId: string): string {
  return `user_profile_${userId}`;
}

export function getSavedProfile(): UserProfile | null {
  try {
    const userId = localStorage.getItem(CURRENT_USER_KEY);
    if (!userId) return null;
    const raw = localStorage.getItem(profileKey(userId));
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile: UserProfile): void {
  localStorage.setItem(CURRENT_USER_KEY, profile.id);
  localStorage.setItem(profileKey(profile.id), JSON.stringify(profile));
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuth(): void {
  const userId = localStorage.getItem(CURRENT_USER_KEY);
  if (userId) localStorage.removeItem(profileKey(userId));
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case 'requester':       return 'ผู้ขอใช้งบ';
    case 'zone_approver_1': return 'ผู้อนุมัติ Level 1';
    case 'zone_approver_2': return 'ผู้อนุมัติ Level 2';
    case 'admin':           return 'ผู้ดูแลระบบ';
    default:                return role;
  }
}

export function getStatusLabel(status: UserStatus): string {
  switch (status) {
    case 'pending':  return 'รออนุมัติ';
    case 'approved': return 'อนุมัติแล้ว';
    case 'rejected': return 'ปฏิเสธ';
    default:         return status;
  }
}
