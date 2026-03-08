import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, Eye, CheckCircle, XCircle, Loader2, FileText, Download, Paperclip, FolderOpen, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import { getStatusConfig } from "@/lib/statusUtils";

interface Attachment {
  id?: string;
  file_name: string;
  file_url: string;
  file_size?: number;
}

interface Request {
  id: string;
  title: string;
  amount: number;
  status: string;
  created_at: string;
  description: string | null;
  admin_notes: string | null;
  request_type: string | null;
  size: string | null;
  size_code: string | null;
  requester_name: string;
  requester_email: string;
  requester_affiliation: string | null;
  requester_branch: string | null;
  zone_name: string;
  zone_approver_notes: string | null;
  attachments?: Attachment[];
}

// ✅ Component ดึง Drive URL จาก GAS แล้วเปิด
function DriveButton({ requestId }: { requestId: string }) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const handleOpen = async () => {
    if (url) { window.open(url, "_blank"); return; }
    setLoading(true);
    setError(false);
    try {
      const res = await apiPost({ mode: "get_drive_url", id: requestId });
      if (res.success && res.data?.drive_url) {
        setUrl(res.data.drive_url);
        window.open(res.data.drive_url, "_blank");
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button variant="outline" className="w-full gap-2" onClick={handleOpen} disabled={loading}>
        {loading
          ? <><Loader2 className="h-4 w-4 animate-spin" />กำลังโหลด...</>
          : <><FolderOpen className="h-4 w-4" />ดูเอกสารใน Google Drive<ExternalLink className="h-3.5 w-3.5 ml-auto" /></>
        }
      </Button>
      {error && <p className="text-xs text-destructive mt-1.5 text-center">ไม่พบโฟลเดอร์เอกสาร</p>}
    </div>
  );
}

export default function PendingApprovals() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [notes, setNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  const isAdmin = profile?.role === "admin";
  const isZoneApprover1 = profile?.role === "zone_approver_1";
  const isZoneApprover2 = profile?.role === "zone_approver_2";

  useEffect(() => {
    if (profile) fetchPendingRequests();
  }, [profile?.zone_id, profile?.role]);

  const fetchPendingRequests = async () => {
    setLoading(true);
    try {
      const targetStatus = isZoneApprover1
        ? "zone_review_1"
        : isZoneApprover2
        ? "zone_review_2"
        : "";

      const res = await apiPost({
        mode: "pending",
        zone_id: profile?.zone_id || "",
        role: profile?.role || "",
        status: targetStatus,
      });
      if (res.success && Array.isArray(res.data)) {
        const filtered = res.data.filter((r: Request) => {
          if (isAdmin) return r.status === "submitted" || r.status === "admin_finalize";
          if (isZoneApprover1) return r.status === "zone_review_1";
          if (isZoneApprover2) return r.status === "zone_review_2";
          return false;
        });
        setRequests(filtered);
      } else {
        setRequests([]);
      }
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const openActionDialog = (request: Request, type: "approve" | "reject") => {
    setSelectedRequest(request);
    setActionType(type);
    setNotes("");
    setActionDialogOpen(true);
  };

  const getNextStatus = (currentStatus: string, action: "approve" | "reject"): string => {
    if (action === "reject") return "rejected";
    switch (currentStatus) {
      case "submitted":      return "zone_review_1";
      case "zone_review_1":  return "zone_review_2";
      case "zone_review_2":  return "admin_finalize";
      case "admin_finalize": return "approved";
      default:               return currentStatus;
    }
  };

  const handleAction = async () => {
    if (!selectedRequest || !actionType) return;
    setProcessing(true);
    try {
      const newStatus = getNextStatus(selectedRequest.status, actionType);
      const res = await apiPost({
        mode: actionType === "approve" ? "update_status" : "reject",
        id: selectedRequest.id,
        status: newStatus,
        notes,
        approver_name: profile?.full_name || "-",
        rejected_reason: actionType === "reject" ? notes : undefined,
      });
      if (!res.success) throw new Error(res.error);
      toast.success(actionType === "approve" ? "อนุมัติคำขอเรียบร้อย" : "ปฏิเสธคำขอเรียบร้อย");
      setActionDialogOpen(false);
      fetchPendingRequests();
    } catch {
      toast.error("เกิดข้อผิดพลาดในการดำเนินการ");
    } finally {
      setProcessing(false);
    }
  };

  const getPageTitle = () => {
    if (isZoneApprover1) return "คำขอรออนุมัติ (Level 1)";
    if (isZoneApprover2) return "คำขอรออนุมัติ (Level 2)";
    return "คำขอรออนุมัติ";
  };

  const getActionLabel = (request: Request) => {
    if (isAdmin && request.status === "submitted")      return "ตรวจสอบผ่าน";
    if (isAdmin && request.status === "admin_finalize") return "อนุมัติขั้นสุดท้าย";
    return "อนุมัติ";
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("th-TH", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 0 }).format(amount);

  const getStatusBadge = (status: string) => {
    const config = getStatusConfig(status);
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={config.color}>
        <Icon className="h-3 w-3 mr-1" />{config.label}
      </Badge>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{getPageTitle()}</h1>
          <p className="text-muted-foreground">
            {isZoneApprover1 ? "คำขอที่รอการอนุมัติจากคุณ (Level 1)" : "คำขอที่รอการอนุมัติจากคุณ (Level 2)"}
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">รออนุมัติ</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{requests.length}</div>
            <p className="text-xs text-muted-foreground">คำขอ</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>รายการคำขอ</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : requests.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">ไม่มีคำขอรออนุมัติ</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>รหัส</TableHead>
                      <TableHead>ชื่อคำขอ</TableHead>
                      <TableHead>ผู้ขอ</TableHead>
                      <TableHead>จำนวนเงิน</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead>วันที่สร้าง</TableHead>
                      <TableHead className="text-right">การดำเนินการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-mono text-sm">{request.size_code || request.id.slice(0, 8)}</TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">{request.title}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{request.requester_name}</p>
                            <p className="text-xs text-muted-foreground">{request.requester_affiliation}</p>
                          </div>
                        </TableCell>
                        <TableCell>{formatCurrency(request.amount)}</TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell>{formatDate(request.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm"
                              onClick={() => { setSelectedRequest(request); setViewDialogOpen(true); }}>
                              <Eye className="h-4 w-4 mr-1" />ดู
                            </Button>
                            <Button size="sm"
                              className="bg-success hover:bg-success/90 text-success-foreground"
                              onClick={() => openActionDialog(request, "approve")}>
                              <CheckCircle className="h-4 w-4 mr-1" />{getActionLabel(request)}
                            </Button>
                            <Button size="sm" variant="destructive"
                              onClick={() => openActionDialog(request, "reject")}>
                              <XCircle className="h-4 w-4 mr-1" />ปฏิเสธ
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>รายละเอียดคำขอ</DialogTitle></DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-sm text-muted-foreground">รหัสคำขอ</p><p className="font-mono">{selectedRequest.size_code || selectedRequest.id.slice(0, 8)}</p></div>
                <div><p className="text-sm text-muted-foreground">สถานะ</p>{getStatusBadge(selectedRequest.status)}</div>
                <div><p className="text-sm text-muted-foreground">ชื่อคำขอ</p><p className="font-medium">{selectedRequest.title}</p></div>
                <div><p className="text-sm text-muted-foreground">จำนวนเงิน</p><p className="font-bold text-lg">{formatCurrency(selectedRequest.amount)}</p></div>
              </div>

              <div><p className="text-sm text-muted-foreground">ผู้ขอ</p><p className="font-medium">{selectedRequest.requester_name}</p></div>

              {selectedRequest.description && (
                <div><p className="text-sm text-muted-foreground">รายละเอียด</p><p className="whitespace-pre-wrap bg-muted p-3 rounded-md text-sm">{selectedRequest.description}</p></div>
              )}
              {selectedRequest.admin_notes && (
                <div className="bg-muted p-3 rounded-lg"><p className="text-sm text-muted-foreground">หมายเหตุจาก Admin</p><p className="whitespace-pre-wrap text-sm">{selectedRequest.admin_notes}</p></div>
              )}
              {selectedRequest.zone_approver_notes && (
                <div className="bg-primary/5 p-3 rounded-lg border border-primary/20"><p className="text-sm text-muted-foreground">หมายเหตุจากผู้อนุมัติ</p><p className="whitespace-pre-wrap text-sm">{selectedRequest.zone_approver_notes}</p></div>
              )}

              {/* ✅ ปุ่มดูเอกสาร Drive */}
              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground mb-2">เอกสารแนบ</p>
                <DriveButton requestId={selectedRequest.id} />
              </div>

              <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                <Button variant="outline" onClick={() => setViewDialogOpen(false)}>ปิด</Button>
                <Button
                  className="bg-success hover:bg-success/90 text-success-foreground"
                  onClick={() => { setViewDialogOpen(false); openActionDialog(selectedRequest, "approve"); }}>
                  <CheckCircle className="h-4 w-4 mr-1" />{getActionLabel(selectedRequest)}
                </Button>
                <Button variant="destructive"
                  onClick={() => { setViewDialogOpen(false); openActionDialog(selectedRequest, "reject"); }}>
                  <XCircle className="h-4 w-4 mr-1" />ปฏิเสธ
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve"
                ? (selectedRequest ? getActionLabel(selectedRequest) : "อนุมัติคำขอ")
                : "ปฏิเสธคำขอ"}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest?.title} — {formatCurrency(selectedRequest?.amount || 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-sm bg-muted px-3 py-2 rounded-md">
              ผู้ดำเนินการ: <span className="font-medium">{profile?.full_name}</span>
            </div>
            <Textarea
              placeholder={actionType === "reject" ? "กรุณาระบุเหตุผลในการปฏิเสธ..." : "หมายเหตุ (ถ้ามี)..."}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
            {actionType === "reject" && !notes.trim() && (
              <p className="text-sm text-destructive">* กรุณาระบุเหตุผลในการปฏิเสธ</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)} disabled={processing}>ยกเลิก</Button>
            <Button
              onClick={handleAction}
              disabled={processing || (actionType === "reject" && !notes.trim())}
              className={actionType === "approve"
                ? "bg-success hover:bg-success/90 text-success-foreground"
                : "bg-destructive hover:bg-destructive/90"}
            >
              {processing
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : actionType === "approve"
                ? <CheckCircle className="h-4 w-4 mr-2" />
                : <XCircle className="h-4 w-4 mr-2" />}
              {actionType === "approve" ? "ยืนยัน" : "ยืนยันปฏิเสธ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
