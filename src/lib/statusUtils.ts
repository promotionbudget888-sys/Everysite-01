import { FileText, Send, CheckCircle, XCircle, Clock, FileCheck, Ban, RotateCcw, Trophy, Banknote } from "lucide-react";

export const REQUEST_STATUSES = {
  draft: { label: "แบบร่าง", icon: FileText, color: "bg-muted text-muted-foreground" },
  submitted: { label: "รอแอดมินตรวจสอบ", icon: Send, color: "bg-info/10 text-info border-info/30" },
  zone_review_1: { label: "อยู่ระหว่างอนุมัติ (Level 1)", icon: Clock, color: "bg-primary/10 text-primary border-primary/30" },
  zone_review_2: { label: "อยู่ระหว่างอนุมัติ (Level 2)", icon: Clock, color: "bg-accent/10 text-accent-foreground border-accent/30" },
  admin_finalize: { label: "รอแอดมินอนุมัติขั้นสุดท้าย", icon: FileCheck, color: "bg-warning/10 text-warning border-warning/30" },
  approved: { label: "อนุมัติแข่งขัน", icon: CheckCircle, color: "bg-success/10 text-success border-success/30" },
  competing: { label: "อยู่ระหว่างแข่งขัน", icon: Trophy, color: "bg-primary/10 text-primary border-primary/30" },
  paid: { label: "อนุมัติจ่าย", icon: Banknote, color: "bg-success/10 text-success border-success/30" },
  rejected: { label: "ถูกปฏิเสธ", icon: Ban, color: "bg-destructive/10 text-destructive border-destructive/30" },
  returned: { label: "ตีกลับ", icon: RotateCcw, color: "bg-warning/10 text-warning border-warning/30" },
} as const;

export type RequestStatus = keyof typeof REQUEST_STATUSES;

export function getStatusLabel(status: string): string {
  return REQUEST_STATUSES[status as RequestStatus]?.label || status;
}

export function getStatusConfig(status: string) {
  return REQUEST_STATUSES[status as RequestStatus] || REQUEST_STATUSES.draft;
}

/** Valid status transitions */
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted"],
  submitted: ["zone_review_1", "returned", "rejected"],
  zone_review_1: ["zone_review_2", "rejected"],
  zone_review_2: ["admin_finalize", "rejected"],
  admin_finalize: ["approved", "competing", "paid", "rejected"],
  approved: ["competing", "paid"],
  competing: ["paid"],
  returned: ["submitted"],
};

export function canTransitionTo(currentStatus: string, newStatus: string): boolean {
  return VALID_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

export const STATUS_FILTER_OPTIONS = Object.entries(REQUEST_STATUSES).map(([value, config]) => ({
  value,
  label: config.label,
}));
