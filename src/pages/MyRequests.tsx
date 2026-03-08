import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search, FileText, RefreshCw, Eye, Plus, Pencil, Trash2, FolderOpen, ExternalLink, Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Link, useNavigate } from "react-router-dom";
import { apiPost } from "@/lib/api";
import { getStatusConfig, STATUS_FILTER_OPTIONS } from "@/lib/statusUtils";

interface Request {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  status: string;
  zone_id: string;
  admin_notes: string | null;
  zone_approver_notes: string | null;
  final_notes: string | null;
  rejected_reason: string | null;
  request_type: string | null;
  size: string | null;
  size_code: string | null;
  department: string | null;
  branch: string | null;
  affiliation: string | null;
  created_at: string;
  updated_at?: string;
}

interface DriveFile {
  fileId: string;
  fileName: string;
  fileUrl: string;
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

const MyRequests = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<Request | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => { if (profile) fetchRequests(); }, [profile]);

  const fetchRequests = async () => {
    if (!profile) return;
    setLoading(true);
    const res = await apiPost({
      mode: "list",
      requester_id: Number(profile.id) || profile.id,
    });
    if (res.success && Array.isArray(res.data)) {
      const sorted = res.data.sort(
        (a: Request, b: Request) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setRequests(sorted);
    } else {
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถโหลดข้อมูลคำขอได้", variant: "destructive" });
      setRequests([]);
    }
    setLoading(false);
  };

  const openViewDialog = (req: Request) => {
    setSelectedRequest(req);
    setViewDialogOpen(true);
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

  const filteredRequests = requests.filter((req) => {
    const matchesSearch = req.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || req.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: requests.length,
    pending: requests.filter((r) =>
      ["submitted", "zone_review_1", "zone_review_2", "admin_finalize"].includes(r.status)
    ).length,
    approved: requests.filter((r) => ["approved", "competing", "paid"].includes(r.status)).length,
    rejected: requests.filter((r) => r.status === "rejected").length,
    returned: requests.filter((r) => r.status === "returned").length,
  };

  const EDIT_WINDOW_MS = 30 * 60 * 1000;
  const canEditOrDelete = (status: string, createdAt: string) => {
    if (!["draft", "returned", "submitted"].includes(status)) return false;
    return Date.now() - new Date(createdAt).getTime() <= EDIT_WINDOW_MS;
  };

  const handleDelete = async () => {
    if (!requestToDelete) return;
    setIsDeleting(true);
    try {
      const res = await apiPost({ mode: "delete", id: requestToDelete.id });
      if (!res.success) throw new Error(res.error);
      toast({ title: "ลบคำขอสำเร็จ" });
      setDeleteDialogOpen(false);
      setRequestToDelete(null);
      fetchRequests();
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const fmt = (amount: number) =>
    new Intl.NumberFormat("th-TH", {
      style: "currency", currency: "THB",
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(Math.round(amount));

  const fmtDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr || "-";
      return format(d, "d MMM yyyy HH:mm", { locale: th });
    } catch { return dateStr || "-"; }
  };

  // Drive folder URL สำหรับ request (เปิด folder ตรงๆ)
  const getDriveFolderUrl = (req: Request) => {
    const shortId = req.id.substring(0, 8);
    const zoneName = profile?.zone_id ? `โซน ${profile.zone_id}` : "general";
    // ลิงค์ไปที่ root drive folder ก่อน (user ค้นหาเองใน folder)
    return `https://drive.google.com/drive/folders/18Witb2KHeSI3BFNrrUKfEDsaP8XfMAas`;
  };

  return (
    <AppLayout>
      <section className="space-y-6">

        {/* HEADER */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6" />คำขอของฉัน
            </h1>
            <p className="text-muted-foreground">ดูและติดตามสถานะคำขอใช้งบประมาณของคุณ</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchRequests} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />รีเฟรช
            </Button>
            <Button asChild>
              <Link to="/create-request">
                <Plus className="h-4 w-4 mr-2" />สร้างคำขอใหม่
              </Link>
            </Button>
          </div>
        </header>

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "ทั้งหมด", value: stats.total, color: "" },
            { label: "รอดำเนินการ", value: stats.pending, color: "text-warning" },
            { label: "อนุมัติแล้ว", value: stats.approved, color: "text-success" },
            { label: "ปฏิเสธ", value: stats.rejected, color: "text-destructive" },
            { label: "ตีกลับ", value: stats.returned, color: "text-orange-500" },
          ].map((s) => (
            <Card key={s.label}>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{s.label}</CardTitle></CardHeader>
              <CardContent><div className={`text-2xl font-bold ${s.color}`}>{s.value}</div></CardContent>
            </Card>
          ))}
        </div>

        {/* FILTER */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาชื่อคำขอ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="ทุกสถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะ</SelectItem>
                  <SelectItem value="submitted">รอตรวจสอบ</SelectItem>
                  <SelectItem value="zone_review_1">รอ L1</SelectItem>
                  <SelectItem value="zone_review_2">รอ L2</SelectItem>
                  <SelectItem value="admin_finalize">รออนุมัติขั้นสุดท้าย</SelectItem>
                  <SelectItem value="approved">อนุมัติแข่งขัน</SelectItem>
                  <SelectItem value="competing">แข่งขัน</SelectItem>
                  <SelectItem value="paid">อนุมัติจ่าย</SelectItem>
                  <SelectItem value="rejected">ปฏิเสธ</SelectItem>
                  <SelectItem value="returned">ตีกลับ</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => { setSearchTerm(""); setFilterStatus("all"); }}>ล้าง</Button>
            </div>
          </CardContent>
        </Card>

        {/* TABLE */}
        <Card>
          <CardHeader><CardTitle>รายการคำขอ ({filteredRequests.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">วันที่สร้าง</TableHead>
                    <TableHead>ชื่อคำขอ</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead className="text-right">จำนวนเงิน</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right pr-4">การดำเนินการ</TableHead>
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
                        ไม่พบรายการคำขอ
                      </TableCell>
                    </TableRow>
                  ) : filteredRequests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="pl-4 text-sm text-muted-foreground whitespace-nowrap">
                        {fmtDate(req.created_at)}
                      </TableCell>
                      <TableCell className="font-medium">{req.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {req.request_type || "-"}{req.size ? ` / ${req.size}` : ""}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {fmt(req.amount)}
                      </TableCell>
                      <TableCell>{getStatusBadge(req.status)}</TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline"
                            onClick={() => openViewDialog(req)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canEditOrDelete(req.status, req.created_at) && (<>
                            <Button size="sm" variant="outline"
                              onClick={() => navigate(`/edit-request/${req.id}`)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline"
                              onClick={() => { setRequestToDelete(req); setDeleteDialogOpen(true); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ===== DIALOG ดูรายละเอียด ===== */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">{selectedRequest?.title}</DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 text-sm">

              {/* สถานะ */}
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">สถานะ:</span>
                {getStatusBadge(selectedRequest.status)}
              </div>

              {/* ข้อมูลทั่วไป */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 bg-muted/40 p-4 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">จำนวนเงิน</p>
                  <p className="font-bold text-base">{fmt(selectedRequest.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">ประเภทงบ</p>
                  <p className="font-medium">{selectedRequest.request_type || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">ไซส์</p>
                  <p className="font-medium">{selectedRequest.size || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">โซน</p>
                  <p className="font-medium">{selectedRequest.zone_id ? `โซน ${selectedRequest.zone_id}` : "-"}</p>
                </div>
                {selectedRequest.size_code && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground mb-0.5">รหัส Size S</p>
                    <p className="font-mono font-medium">{selectedRequest.size_code}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">ฝ่าย</p>
                  <p className="font-medium">{selectedRequest.department || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">สาขา</p>
                  <p className="font-medium">{selectedRequest.branch || "-"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground mb-0.5">สังกัด</p>
                  <p className="font-medium">{selectedRequest.affiliation || "-"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground mb-0.5">วันที่สร้าง</p>
                  <p className="font-medium">{fmtDate(selectedRequest.created_at)}</p>
                </div>
              </div>

              {/* รายละเอียด */}
              {selectedRequest.description && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">รายละเอียด</p>
                  <p className="bg-muted p-3 rounded-md whitespace-pre-wrap">{selectedRequest.description}</p>
                </div>
              )}

              {/* หมายเหตุต่างๆ */}
              {selectedRequest.admin_notes && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
                  <p className="text-xs text-blue-600 mb-1 font-medium">💬 หมายเหตุจาก Admin</p>
                  <p className="whitespace-pre-wrap">{selectedRequest.admin_notes}</p>
                </div>
              )}
              {selectedRequest.zone_approver_notes && (
                <div className="bg-purple-50 border border-purple-200 p-3 rounded-md">
                  <p className="text-xs text-purple-600 mb-1 font-medium">💬 หมายเหตุผู้อนุมัติ L1/L2</p>
                  <p className="whitespace-pre-wrap">{selectedRequest.zone_approver_notes}</p>
                </div>
              )}
              {selectedRequest.final_notes && (
                <div className="bg-green-50 border border-green-200 p-3 rounded-md">
                  <p className="text-xs text-green-600 mb-1 font-medium">✅ หมายเหตุขั้นสุดท้าย</p>
                  <p className="whitespace-pre-wrap">{selectedRequest.final_notes}</p>
                </div>
              )}
              {selectedRequest.rejected_reason && (
                <div className="bg-red-50 border border-red-200 p-3 rounded-md">
                  <p className="text-xs text-red-600 mb-1 font-medium">❌ เหตุผลที่ปฏิเสธ/ตีกลับ</p>
                  <p className="whitespace-pre-wrap">{selectedRequest.rejected_reason}</p>
                </div>
              )}

              {/* ปุ่มดูเอกสาร Drive */}
              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground mb-2">เอกสารแนบ</p>
                <DriveButton requestId={selectedRequest.id} />
              </div>

            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>ปิด</Button>
            {selectedRequest && canEditOrDelete(selectedRequest.status, selectedRequest.created_at) && (
              <Button onClick={() => { setViewDialogOpen(false); navigate(`/edit-request/${selectedRequest.id}`); }}>
                <Pencil className="h-4 w-4 mr-2" />แก้ไข
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG ยืนยันลบ ===== */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบคำขอ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบคำขอ "<strong>{requestToDelete?.title}</strong>" ใช่หรือไม่?
              การกระทำนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "กำลังลบ..." : "ลบคำขอ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default MyRequests;
