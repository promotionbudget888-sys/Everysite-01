import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Search, FileText, RefreshCw, Eye, CheckCircle, XCircle, RotateCcw, Trophy, Banknote, SendHorizontal } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { apiPost } from "@/lib/api";
import { getStatusConfig } from "@/lib/statusUtils";

interface Request {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  status: string;
  requester_id: string;
  zone_id: string;
  size_code: string | null;
  request_type: string | null;
  size: string | null;
  admin_notes: string | null;
  zone_approver_notes: string | null;
  final_notes: string | null;
  rejected_reason: string | null;
  created_at: string;
  requester_name?: string;
  requester_email?: string;
  department?: string;
  branch?: string;
  affiliation?: string;
}

// ปุ่มที่แสดงตามสถานะ (admin flow)
//   submitted     → ตรวจผ่าน(→zone_review_1), ตีกลับ, ปฏิเสธ
//   admin_finalize→ อนุมัติแข่งขัน(→approved), แข่งขัน(→competing), จ่าย(→paid), ปฏิเสธ
//   approved      → แข่งขัน, จ่าย
//   competing     → จ่าย

const ACTION_LABELS: Record<string, string> = {
  review:        "ส่งให้ L1 ตรวจสอบ",
  finalize:      "อนุมัติแข่งขัน",
  reject:        "ปฏิเสธ",
  return:        "ตีกลับ",
  set_competing: "อยู่ระหว่างแข่งขัน",
  set_paid:      "อนุมัติจ่าย",
};

export default function AllRequests() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [actionType, setActionType] = useState<string>("");
  const [actionNotes, setActionNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const isAdmin = profile?.role === "admin";

  useEffect(() => { if (isAdmin) fetchRequests(); }, [isAdmin]);

  const fetchRequests = async () => {
    setLoading(true);
    const res = await apiPost({ mode: "list" });
    if (res.success && Array.isArray(res.data)) {
      const valid = res.data.filter((r: Request) => r.id && r.title);
      valid.sort((a: Request, b: Request) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setRequests(valid);
    } else {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
      setRequests([]);
    }
    setLoading(false);
  };

  // สถานะที่ต้อง admin ดำเนินการ
  const pendingAdminStatuses = ["submitted", "admin_finalize"];
  const allStatuses = [
    { value: "all",           label: "ทุกสถานะ" },
    { value: "submitted",     label: "รอตรวจสอบ" },
    { value: "zone_review_1", label: "รอ L1" },
    { value: "zone_review_2", label: "รอ L2" },
    { value: "admin_finalize",label: "รออนุมัติขั้นสุดท้าย" },
    { value: "approved",      label: "อนุมัติแข่งขัน" },
    { value: "competing",     label: "แข่งขัน" },
    { value: "paid",          label: "อนุมัติจ่าย" },
    { value: "rejected",      label: "ปฏิเสธ" },
    { value: "returned",      label: "ตีกลับ" },
  ];

  const filteredRequests = requests.filter((req) => {
    const matchSearch =
      req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.requester_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchStatus = filterStatus === "all" || req.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // stats
  const stats = {
    total:          requests.length,
    waiting_admin:  requests.filter(r => pendingAdminStatuses.includes(r.status)).length,
    in_progress:    requests.filter(r => ["zone_review_1","zone_review_2"].includes(r.status)).length,
    approved:       requests.filter(r => ["approved","competing","paid"].includes(r.status)).length,
    rejected:       requests.filter(r => r.status === "rejected").length,
  };

  const getStatusBadge = (status: string) => {
    const config = getStatusConfig(status);
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={config.color}>
        <Icon className="h-3 w-3 mr-1" />{config.label}
      </Badge>
    );
  };

  const openAction = (req: Request, action: string) => {
    setSelectedRequest(req);
    setActionType(action);
    setActionNotes("");
    setActionDialogOpen(true);
  };

  const getNewStatus = (action: string): string => {
    switch (action) {
      case "review":        return "zone_review_1";
      case "finalize":      return "approved";
      case "reject":        return "rejected";
      case "return":        return "returned";
      case "set_competing": return "competing";
      case "set_paid":      return "paid";
      default:              return "";
    }
  };

  const getApiMode = (action: string): string => {
    switch (action) {
      case "review":        return "update_status";
      case "finalize":      return "update_status";
      case "reject":        return "reject";
      case "return":        return "update_status";
      case "set_competing": return "update_status";
      case "set_paid":      return "update_status";
      default:              return action;
    }
  };

  const handleAction = async () => {
    if (!selectedRequest) return;
    setActionLoading(true);

    const newStatus    = getNewStatus(actionType);
    const mode         = getApiMode(actionType);
    const approverName = profile?.full_name || "ผู้ดูแลระบบ";

    const res = await apiPost({
      mode,
      id:            selectedRequest.id,
      status:        newStatus,
      notes:         actionNotes,
      approver_name: approverName,
      ...(actionType === "reject" && { rejected_reason: actionNotes }),
    });

    if (!res.success) {
      toast({ title: "เกิดข้อผิดพลาด", description: res.error, variant: "destructive" });
    } else {
      toast({ title: "สำเร็จ", description: `${ACTION_LABELS[actionType]} เรียบร้อย` });
      setActionDialogOpen(false);
      fetchRequests();
    }
    setActionLoading(false);
  };

  const fmt = (amount: number) =>
    new Intl.NumberFormat("th-TH", {
      style: "currency", currency: "THB",
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(Math.round(amount));

  const fmtDate = (d: string) => {
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return d || "-";
      return format(dt, "dd MMM yy HH:mm", { locale: th });
    } catch { return d || "-"; }
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6" />คำขอทั้งหมด
            </h1>
            <p className="text-muted-foreground text-sm">จัดการและติดตามคำขอทั้งหมดในระบบ</p>
          </div>
          <Button variant="outline" onClick={fetchRequests} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />รีเฟรช
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">ทั้งหมด</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
          </Card>
          <Card className="border-warning/40">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-warning">รอ Admin</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-warning">{stats.waiting_admin}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-primary">อยู่ระหว่าง L1/L2</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-primary">{stats.in_progress}</div></CardContent>
          </Card>
          <Card className="border-success/40">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-success">อนุมัติแล้ว</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-success">{stats.approved}</div></CardContent>
          </Card>
          <Card className="border-destructive/40">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-destructive">ปฏิเสธ</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-destructive">{stats.rejected}</div></CardContent>
          </Card>
        </div>

        {/* Filter */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาชื่อคำขอ, ผู้ขอ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allStatuses.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => { setSearchTerm(""); setFilterStatus("all"); }}>ล้าง</Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>รายการคำขอ ({filteredRequests.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">วันที่</TableHead>
                    <TableHead>ชื่อคำขอ</TableHead>
                    <TableHead>ผู้ขอ / โซน</TableHead>
                    <TableHead className="text-right">จำนวนเงิน</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right pr-4 min-w-[280px]">การดำเนินการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : filteredRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        ไม่พบข้อมูลคำขอ
                      </TableCell>
                    </TableRow>
                  ) : filteredRequests.map((req) => (
                    <TableRow key={req.id} className={pendingAdminStatuses.includes(req.status) ? "bg-warning/5" : ""}>
                      <TableCell className="pl-4 text-sm tabular-nums text-muted-foreground whitespace-nowrap">
                        {fmtDate(req.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{req.title}</div>
                        {req.request_type && (
                          <div className="text-xs text-muted-foreground">{req.request_type}{req.size ? ` / ${req.size}` : ""}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{req.requester_name || "-"}</div>
                        <div className="text-xs text-muted-foreground">
                          {req.zone_id ? `โซน ${req.zone_id}` : ""}{req.affiliation ? ` · ${req.affiliation}` : ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{fmt(req.amount)}</TableCell>
                      <TableCell>{getStatusBadge(req.status)}</TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex justify-end gap-1.5 flex-wrap">
                          {/* ปุ่มดู */}
                          <Button size="sm" variant="outline"
                            onClick={() => { setSelectedRequest(req); setViewDialogOpen(true); }}>
                            <Eye className="h-3.5 w-3.5 mr-1" />ดู
                          </Button>

                          {/* submitted → admin ตรวจก่อน */}
                          {req.status === "submitted" && (<>
                            <Button size="sm" variant="outline"
                              className="text-primary border-primary/40 hover:bg-primary/10"
                              onClick={() => openAction(req, "review")}>
                              <SendHorizontal className="h-3.5 w-3.5 mr-1" />ส่ง L1
                            </Button>
                            <Button size="sm" variant="outline"
                              className="text-warning border-warning/40 hover:bg-warning/10"
                              onClick={() => openAction(req, "return")}>
                              <RotateCcw className="h-3.5 w-3.5 mr-1" />ตีกลับ
                            </Button>
                            <Button size="sm" variant="outline"
                              className="text-destructive border-destructive/40 hover:bg-destructive/10"
                              onClick={() => openAction(req, "reject")}>
                              <XCircle className="h-3.5 w-3.5 mr-1" />ปฏิเสธ
                            </Button>
                          </>)}

                          {/* admin_finalize → อนุมัติขั้นสุดท้าย */}
                          {req.status === "admin_finalize" && (<>
                            <Button size="sm" variant="outline"
                              className="text-success border-success/40 hover:bg-success/10"
                              onClick={() => openAction(req, "finalize")}>
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />อนุมัติแข่งขัน
                            </Button>
                            <Button size="sm" variant="outline"
                              className="text-primary border-primary/40 hover:bg-primary/10"
                              onClick={() => openAction(req, "set_competing")}>
                              <Trophy className="h-3.5 w-3.5 mr-1" />แข่งขัน
                            </Button>
                            <Button size="sm" variant="outline"
                              className="text-success border-success/40 hover:bg-success/10"
                              onClick={() => openAction(req, "set_paid")}>
                              <Banknote className="h-3.5 w-3.5 mr-1" />จ่าย
                            </Button>
                            <Button size="sm" variant="outline"
                              className="text-destructive border-destructive/40 hover:bg-destructive/10"
                              onClick={() => openAction(req, "reject")}>
                              <XCircle className="h-3.5 w-3.5 mr-1" />ปฏิเสธ
                            </Button>
                          </>)}

                          {/* approved → แข่งขัน, จ่าย */}
                          {req.status === "approved" && (<>
                            <Button size="sm" variant="outline"
                              className="text-primary border-primary/40 hover:bg-primary/10"
                              onClick={() => openAction(req, "set_competing")}>
                              <Trophy className="h-3.5 w-3.5 mr-1" />แข่งขัน
                            </Button>
                            <Button size="sm" variant="outline"
                              className="text-success border-success/40 hover:bg-success/10"
                              onClick={() => openAction(req, "set_paid")}>
                              <Banknote className="h-3.5 w-3.5 mr-1" />จ่าย
                            </Button>
                          </>)}

                          {/* competing → จ่าย */}
                          {req.status === "competing" && (
                            <Button size="sm" variant="outline"
                              className="text-success border-success/40 hover:bg-success/10"
                              onClick={() => openAction(req, "set_paid")}>
                              <Banknote className="h-3.5 w-3.5 mr-1" />จ่าย
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog ดูรายละเอียด */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>รายละเอียดคำขอ</DialogTitle>
            <DialogDescription>{selectedRequest?.title}</DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted-foreground">ผู้ขอ</p><p className="font-medium">{selectedRequest.requester_name || "-"}</p></div>
                <div><p className="text-muted-foreground">จำนวนเงิน</p><p className="font-bold text-lg">{fmt(selectedRequest.amount)}</p></div>
                <div><p className="text-muted-foreground">โซน</p><p className="font-medium">{selectedRequest.zone_id ? `โซน ${selectedRequest.zone_id}` : "-"}</p></div>
                <div><p className="text-muted-foreground">สถานะ</p><div className="mt-1">{getStatusBadge(selectedRequest.status)}</div></div>
                <div><p className="text-muted-foreground">ประเภทงบ</p><p className="font-medium">{selectedRequest.request_type || "-"}{selectedRequest.size ? ` (${selectedRequest.size})` : ""}</p></div>
                <div><p className="text-muted-foreground">รหัส Size S</p><p className="font-medium font-mono">{selectedRequest.size_code || "-"}</p></div>
              </div>
              {selectedRequest.description && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">รายละเอียด</p>
                  <p className="bg-muted p-3 rounded-md text-sm whitespace-pre-wrap">{selectedRequest.description}</p>
                </div>
              )}
              {selectedRequest.admin_notes && (
                <div className="bg-muted p-3 rounded-md">
                  <p className="text-xs text-muted-foreground mb-1">หมายเหตุ Admin</p>
                  <p className="text-sm">{selectedRequest.admin_notes}</p>
                </div>
              )}
              {selectedRequest.zone_approver_notes && (
                <div className="bg-primary/5 border border-primary/20 p-3 rounded-md">
                  <p className="text-xs text-muted-foreground mb-1">หมายเหตุผู้อนุมัติ L1/L2</p>
                  <p className="text-sm">{selectedRequest.zone_approver_notes}</p>
                </div>
              )}
              {selectedRequest.final_notes && (
                <div className="bg-success/5 border border-success/20 p-3 rounded-md">
                  <p className="text-xs text-muted-foreground mb-1">หมายเหตุขั้นสุดท้าย</p>
                  <p className="text-sm">{selectedRequest.final_notes}</p>
                </div>
              )}
              {selectedRequest.rejected_reason && (
                <div className="bg-destructive/5 border border-destructive/20 p-3 rounded-md">
                  <p className="text-xs text-muted-foreground mb-1">เหตุผลที่ปฏิเสธ</p>
                  <p className="text-sm">{selectedRequest.rejected_reason}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog ดำเนินการ */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ACTION_LABELS[actionType] || "ดำเนินการ"}</DialogTitle>
            <DialogDescription>
              {selectedRequest?.title} — {fmt(selectedRequest?.amount || 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-sm bg-muted px-3 py-2 rounded-md">
              ผู้ดำเนินการ: <span className="font-medium">{profile?.full_name}</span>
            </div>
            <div>
              <label className="text-sm font-medium">
                {actionType === "reject" ? "เหตุผลในการปฏิเสธ *" : "หมายเหตุ (ถ้ามี)"}
              </label>
              <Textarea
                placeholder="ระบุหมายเหตุ..."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                rows={3}
                className="mt-1"
              />
              {actionType === "reject" && !actionNotes.trim() && (
                <p className="text-xs text-destructive mt-1">* กรุณาระบุเหตุผล</p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>ยกเลิก</Button>
            <Button
              onClick={handleAction}
              disabled={actionLoading || (actionType === "reject" && !actionNotes.trim())}
              className={
                actionType === "reject" || actionType === "return"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : actionType === "review"
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-success text-success-foreground hover:bg-success/90"
              }
            >
              {actionLoading
                ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />กำลังดำเนินการ...</>
                : <><CheckCircle className="h-4 w-4 mr-2" />{ACTION_LABELS[actionType]}</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}