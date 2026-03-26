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
import { getStatusConfig } from "@/lib/statusUtils";

interface Request {
  id: string;
  title: string;
  description?: string | null;
  amount: number;
  status: string;
  zone_id: string;
  requester_id: string;           // ← สำคัญมาก
  request_type?: string | null;
  size?: string | null;
  size_code?: string | null;
  department?: string | null;
  branch?: string | null;
  affiliation?: string | null;
  admin_notes?: string | null;
  zone_approver_notes?: string | null;
  final_notes?: string | null;
  rejected_reason?: string | null;
  created_at: string;
}

function DriveButton({ requestId }: { requestId: string }) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const handleOpen = async () => {
    if (url) {
      window.open(url, "_blank");
      return;
    }

    setLoading(true);
    setError(false);

    try {
      const res = await apiPost({ mode: "get_drive_url", id: requestId });
      if (res.success && res.data?.drive_url) {
        const driveUrl = res.data.drive_url;
        setUrl(driveUrl);
        window.open(driveUrl, "_blank");
      } else {
        setError(true);
      }
    } catch (err) {
      console.error("Drive URL error:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button 
        variant="outline" 
        className="w-full gap-2" 
        onClick={handleOpen} 
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            กำลังโหลด...
          </>
        ) : (
          <>
            <FolderOpen className="h-4 w-4" />
            ดูเอกสารใน Google Drive
            <ExternalLink className="h-3.5 w-3.5 ml-auto" />
          </>
        )}
      </Button>
      {error && (
        <p className="text-xs text-destructive mt-1.5 text-center">
          ไม่พบโฟลเดอร์เอกสาร
        </p>
      )}
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

  // ดึงข้อมูลเมื่อ profile พร้อม
  useEffect(() => {
    if (profile?.id) {
      console.log("🔄 โหลดคำขอของผู้ใช้ ID:", profile.id);
      fetchRequests();
    }
  }, [profile?.id]);

  const fetchRequests = async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log("📤 กำลังเรียก list requests ด้วย requester_id =", String(profile.id));

    try {
      const res = await apiPost({
        mode: "list",                    // หรือ "list_requests" ถ้าคุณเปลี่ยนแล้ว
        requester_id: String(profile.id),   // ต้องเป็น String
      });

      console.log("📥 Response จาก Apps Script:", res);

      if (res.success && Array.isArray(res.data)) {
        const sorted = [...res.data].sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setRequests(sorted);
        console.log(`✅ โหลดสำเร็จ ${sorted.length} รายการ`);
      } else {
        console.warn("⚠️ Server ตอบไม่สำเร็จ:", res);
        toast({
          title: "ไม่พบรายการคำขอ",
          description: res.error || "คุณยังไม่มีคำขอใดๆ",
          variant: "default",
        });
        setRequests([]);
      }
    } catch (error: any) {
      console.error("❌ Error โหลดคำขอ:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถโหลดรายการคำขอได้ กรุณาลองใหม่อีกครั้ง",
        variant: "destructive",
      });
      setRequests([]);
    } finally {
      setLoading(false);
    }
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
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
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
    pending: requests.filter((r) => ["submitted", "zone_review_1", "zone_review_2", "admin_finalize"].includes(r.status)).length,
    approved: requests.filter((r) => ["approved", "competing", "paid"].includes(r.status)).length,
    rejected: requests.filter((r) => r.status === "rejected").length,
    returned: requests.filter((r) => r.status === "returned").length,
  };

  const EDIT_WINDOW_MS = 30 * 60 * 1000; // 30 นาที

  const canEditOrDelete = (status: string, createdAt: string) => {
    if (!["draft", "returned", "submitted"].includes(status)) return false;
    return Date.now() - new Date(createdAt).getTime() <= EDIT_WINDOW_MS;
  };

  const handleDelete = async () => {
    if (!requestToDelete) return;
    setIsDeleting(true);

    try {
      const res = await apiPost({ mode: "delete", id: requestToDelete.id });
      if (!res.success) throw new Error(res.error || "ลบไม่สำเร็จ");

      toast({ title: "ลบคำขอสำเร็จแล้ว" });
      setDeleteDialogOpen(false);
      setRequestToDelete(null);
      fetchRequests(); // รีเฟรชข้อมูล
    } catch (error) {
      toast({
        title: "ลบไม่สำเร็จ",
        description: "เกิดข้อผิดพลาดในการลบคำขอ",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const fmt = (amount: number) =>
    new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 0,
    }).format(Math.round(amount));

  const fmtDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr || "-";
      return format(d, "d MMM yyyy HH:mm", { locale: th });
    } catch {
      return dateStr || "-";
    }
  };

  return (
    <AppLayout>
      <section className="space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6" /> คำขอของฉัน
            </h1>
            <p className="text-muted-foreground">ดูและติดตามสถานะคำขอใช้งบประมาณของคุณ</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchRequests} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              รีเฟรช
            </Button>
            <Button asChild>
              <Link to="/create-request">
                <Plus className="h-4 w-4 mr-2" /> สร้างคำขอใหม่
              </Link>
            </Button>
          </div>
        </header>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "ทั้งหมด", value: stats.total },
            { label: "รอดำเนินการ", value: stats.pending, color: "text-amber-600" },
            { label: "อนุมัติแล้ว", value: stats.approved, color: "text-emerald-600" },
            { label: "ปฏิเสธ", value: stats.rejected, color: "text-red-600" },
            { label: "ตีกลับ", value: stats.returned, color: "text-orange-600" },
          ].map((s) => (
            <Card key={s.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${s.color || ""}`}>{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter */}
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
                <SelectTrigger className="w-full sm:w-52">
                  <SelectValue placeholder="ทุกสถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะ</SelectItem>
                  <SelectItem value="submitted">รอตรวจสอบ</SelectItem>
                  <SelectItem value="zone_review_1">รอผู้อนุมัติ Level 1</SelectItem>
                  <SelectItem value="zone_review_2">รอผู้อนุมัติ Level 2</SelectItem>
                  <SelectItem value="admin_finalize">รออนุมัติขั้นสุดท้าย</SelectItem>
                  <SelectItem value="approved">อนุมัติแข่งขัน</SelectItem>
                  <SelectItem value="competing">อยู่ระหว่างแข่งขัน</SelectItem>
                  <SelectItem value="paid">อนุมัติจ่ายแล้ว</SelectItem>
                  <SelectItem value="rejected">ปฏิเสธ</SelectItem>
                  <SelectItem value="returned">ตีกลับ</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => { setSearchTerm(""); setFilterStatus("all"); }}>
                ล้างตัวกรอง
              </Button>
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
                      <TableCell colSpan={6} className="text-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                        <p className="mt-2">กำลังโหลดข้อมูล...</p>
                      </TableCell>
                    </TableRow>
                  ) : filteredRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        ไม่พบรายการคำขอ
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRequests.map((req) => (
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
                            <Button size="sm" variant="outline" onClick={() => openViewDialog(req)}>
                              <Eye className="h-4 w-4" />
                            </Button>

                            {canEditOrDelete(req.status, req.created_at) && (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => navigate(`/edit-request/${req.id}`)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setRequestToDelete(req);
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Dialog ดูรายละเอียด */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRequest?.title}</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">สถานะ:</span>
                {getStatusBadge(selectedRequest.status)}
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3 bg-muted/40 p-4 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">จำนวนเงิน</p>
                  <p className="font-bold text-base">{fmt(selectedRequest.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">ประเภท</p>
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
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground mb-0.5">วันที่สร้าง</p>
                  <p className="font-medium">{fmtDate(selectedRequest.created_at)}</p>
                </div>
              </div>

              {selectedRequest.description && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">รายละเอียด</p>
                  <p className="bg-muted p-3 rounded-md whitespace-pre-wrap">
                    {selectedRequest.description}
                  </p>
                </div>
              )}

              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground mb-2">เอกสารแนบ</p>
                <DriveButton requestId={selectedRequest.id} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              ปิด
            </Button>
            {selectedRequest && canEditOrDelete(selectedRequest.status, selectedRequest.created_at) && (
              <Button onClick={() => navigate(`/edit-request/${selectedRequest.id}`)}>
                <Pencil className="h-4 w-4 mr-2" /> แก้ไขคำขอ
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog ลบ */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบคำขอ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบคำขอ "<strong>{requestToDelete?.title}</strong>" จริงหรือไม่?<br />
              การกระทำนี้ไม่สามารถยกเลิกได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? "กำลังลบ..." : "ยืนยันการลบ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default MyRequests;
