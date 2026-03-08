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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, FileText, RefreshCw, Eye, Plus, Pencil, Trash2 } from "lucide-react";
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
  request_type: string | null;
  size: string | null;
  size_code: string | null;
  created_at: string;
  updated_at: string;
  zone_name?: string;
}

export default function MyRequests() {
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
    const res = await apiPost({ mode: "list", requester_id: Number(profile.id) || profile.id });
    if (res.success && Array.isArray(res.data)) {
      setRequests(res.data);
    } else {
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถโหลดข้อมูลคำขอได้", variant: "destructive" });
      setRequests([]);
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const config = getStatusConfig(status);
    const Icon = config.icon;
    return <Badge variant="outline" className={config.color}><Icon className="h-3 w-3 mr-1" />{config.label}</Badge>;
  };

  const filteredRequests = requests.filter((req) => {
    const matchesSearch = req.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || req.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: requests.length,
    draft: requests.filter((r) => r.status === "draft").length,
    pending: requests.filter((r) => ["submitted", "zone_review_1", "zone_review_2", "admin_finalize"].includes(r.status)).length,
    approved: requests.filter((r) => ["approved", "competing", "paid"].includes(r.status)).length,
    rejected: requests.filter((r) => r.status === "rejected").length,
    returned: requests.filter((r) => r.status === "returned").length,
  };

  const EDIT_WINDOW_MS = 30 * 60 * 1000;

  const canEditOrDelete = (status: string, createdAt: string) => {
    if (status !== "draft" && status !== "returned" && status !== "submitted") return false;
    const elapsed = Date.now() - new Date(createdAt).getTime();
    return elapsed <= EDIT_WINDOW_MS;
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

  const formatCurrency = (amount: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(amount));

  const safeFormatDate = (dateStr: string) => {
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
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><FileText className="h-6 w-6" />คำขอของฉัน</h1>
            <p className="text-muted-foreground">ดูและติดตามสถานะคำขอใช้งบประมาณของคุณ</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchRequests} disabled={loading}><RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />รีเฟรช</Button>
            <Button asChild><Link to="/create-request"><Plus className="h-4 w-4 mr-2" />สร้างคำขอใหม่</Link></Button>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">ทั้งหมด</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">แบบร่าง</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-muted-foreground">{stats.draft}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-info">อยู่ระหว่างดำเนินการ</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-info">{stats.pending}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-success">อนุมัติแล้ว</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-success">{stats.approved}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-destructive">ปฏิเสธ/ตีกลับ</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{stats.rejected + stats.returned}</div></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>ค้นหาและกรอง</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="ค้นหาชื่อคำขอ..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue placeholder="สถานะ" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะ</SelectItem>
                  {STATUS_FILTER_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => { setSearchTerm(""); setFilterStatus("all"); }}>ล้างตัวกรอง</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>รายการคำขอ ({filteredRequests.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">วันที่สร้าง</TableHead>
                    <TableHead className="min-w-[200px]">ชื่อคำขอ</TableHead>
                    <TableHead className="text-right">จำนวนเงิน</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">การดำเนินการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mx-auto" /></TableCell></TableRow>
                  ) : filteredRequests.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {requests.length === 0 ? <div className="flex flex-col items-center gap-2"><FileText className="h-8 w-8" /><p>ยังไม่มีคำขอ</p><Button asChild size="sm"><Link to="/create-request"><Plus className="h-4 w-4 mr-1" />สร้างคำขอใหม่</Link></Button></div> : "ไม่พบคำขอที่ตรงกับเงื่อนไข"}
                    </TableCell></TableRow>
                  ) : filteredRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>{safeFormatDate(request.created_at)}</TableCell>
                      <TableCell className="font-medium">{request.title}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(request.amount)}</TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => { setSelectedRequest(request); setViewDialogOpen(true); }}><Eye className="h-4 w-4" /></Button>
                          {canEditOrDelete(request.status, request.created_at) && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => navigate(`/edit-request/${request.id}`)}><Pencil className="h-4 w-4" /></Button>
                              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => { setRequestToDelete(request); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
                            </>
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

        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>รายละเอียดคำขอ</DialogTitle><DialogDescription>{selectedRequest?.title}</DialogDescription></DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><p className="text-muted-foreground">จำนวนเงิน</p><p className="font-medium text-lg">{formatCurrency(selectedRequest.amount)}</p></div>
                  <div><p className="text-muted-foreground">สถานะ</p>{getStatusBadge(selectedRequest.status)}</div>
                </div>
                {selectedRequest.description && <div><p className="text-muted-foreground text-sm mb-1">รายละเอียด</p><p className="bg-muted p-3 rounded-md text-sm">{selectedRequest.description}</p></div>}
                {selectedRequest.admin_notes && <div><p className="text-muted-foreground text-sm mb-1">หมายเหตุ Admin</p><p className="bg-primary/5 p-3 rounded-md text-sm border border-primary/20">{selectedRequest.admin_notes}</p></div>}
                {selectedRequest.zone_approver_notes && <div><p className="text-muted-foreground text-sm mb-1">หมายเหตุผู้อนุมัติโซน</p><p className="bg-accent/5 p-3 rounded-md text-sm border border-accent/20">{selectedRequest.zone_approver_notes}</p></div>}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>ยืนยันการลบคำขอ</AlertDialogTitle><AlertDialogDescription>คุณต้องการลบคำขอ "{requestToDelete?.title}" หรือไม่?</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isDeleting ? "กำลังลบ..." : "ลบคำขอ"}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </AppLayout>
