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

const PROFILE_KEY = "user_profile";
const TOKEN_KEY = "auth_token";

export function getSavedProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile: UserProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuth() {
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case 'requester': return 'ผู้ขอใช้งบ';
    case 'zone_approver_1': return 'ผู้อนุมัติ Level 1';
    case 'zone_approver_2': return 'ผู้อนุมัติ Level 2';
    case 'admin': return 'ผู้ดูแลระบบ';
    default: return role;
  }
}

export function getStatusLabel(status: UserStatus): string {
  switch (status) {
    case 'pending': return 'รออนุมัติ';
    case 'approved': return 'อนุมัติแล้ว';
    case 'rejected': return 'ปฏิเสธ';
    default: return status;
  }
}
