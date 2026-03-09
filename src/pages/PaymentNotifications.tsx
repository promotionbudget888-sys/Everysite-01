import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Bell, Search, RefreshCw, Send, CheckCircle, Loader2, BanknoteIcon } from "lucide-react";
import { apiPost } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Request {
  id: string;
  title: string;
  amount: number;
  status: string;
  created_at: string;
  updated_at: string;
  requester_name: string;
  requester_email: string;
  request_type: string | null;
  size: string | null;
  size_code: string | null;
  zone_id: string | null;
  department: string | null;
  affiliation: string | null;
  branch: string | null;
  line_id?: string | null;
  requester_id?: string;
  requester_email?: string;
}

export default function PaymentNotifications() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  useEffect(() => { fetchPaidRequests(); }, []);

  const fetchPaidRequests = async () => {
    setLoading(true);
    try {
      // ดึง requests และ users พร้อมกัน
      const [reqRes, usersRes] = await Promise.all([
        apiPost({ mode: "list" }),
        apiPost({ mode: "users" }),
      ]);

      if (reqRes.success && Array.isArray(reqRes.data)) {
        // สร้าง map ทั้ง email และ id → line_id จาก users
        const lineIdByEmail: Record<string, string> = {};
        const lineIdById: Record<string, string> = {};
        if (usersRes.success && Array.isArray(usersRes.data)) {
          usersRes.data.forEach((u: { id: string; email?: string; line_id?: string }) => {
            if (u.line_id) {
              if (u.email) lineIdByEmail[u.email.toLowerCase()] = u.line_id;
              lineIdById[String(u.id)] = u.line_id;
            }
          });
        }

        const paid = reqRes.data
          .filter((r: Request) => r.status === "paid")
          .map((r: Request) => ({
            ...r,
            line_id:
              lineIdByEmail[String(r.requester_email || "").toLowerCase()] ||
              lineIdById[String(r.requester_id)] ||
              null,
            updated_at: r.updated_at || r.created_at,
          }));

        paid.sort((a: Request, b: Request) =>
          new Date(b.updated_at || b.created_at).getTime() -
          new Date(a.updated_at || a.created_at).getTime()
        );
        setRequests(paid);
      }
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const openSendDialog = (req: Request) => {
    setSelectedRequest(req);
    setCustomMessage(
      `✅ แจ้งเตือนการจ่ายงบส่งเสริม\n\n📋 โครงการ: ${req.title}\n👤 ผู้จัดการฝ่าย: ${req.requester_name}\n💰 จำนวน: ${Number(req.amount).toLocaleString()} บาท\n📁 ประเภท: ${req.request_type === "everysite" ? "Everysite" : "Matching Fund"}${req.size ? ` (${req.size})` : ""}\n📅 อนุมัติจ่ายวันที่ (เปลี่ยนได้ตามใจชอบ)\n\nกรุณาตรวจสอบการโอนเงินด้วยครับ`
    );
    setDialogOpen(true);
  };

  const sendNotification = async () => {
    if (!selectedRequest) return;
    setSending(selectedRequest.id);
    try {
      const res = await apiPost({
        mode: "notify_line",
        type: "payment_notify",
        message: customMessage,
        title: selectedRequest.title,
        amount: Number(selectedRequest.amount).toLocaleString(),
        requester_name: selectedRequest.requester_name,
        zone_id: selectedRequest.zone_id || "-",
        request_type: selectedRequest.request_type || "-",
        size: selectedRequest.size || "",
        approver_name: profile?.full_name || "ผู้ดูแลระบบ",
        line_user_id: selectedRequest.line_id || "",
      });

      if (res.success) {
        setSentIds(prev => new Set([...prev, selectedRequest.id]));
        toast({ title: "ส่งแจ้งเตือนสำเร็จ", description: `ส่ง LINE แจ้งเตือนสำหรับ "${selectedRequest.title}" แล้ว` });
        setDialogOpen(false);
      } else {
        toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถส่ง LINE ได้", variant: "destructive" });
      }
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    } finally {
      setSending(null);
    }
  };

  const filtered = requests.filter(r =>
    r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.requester_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const fmt = (n: number) => `฿${Number(n).toLocaleString("th-TH")}`;
  const fmtDate = (s: string) => new Date(s).toLocaleDateString("th-TH", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });

  if (profile?.role !== "admin") {
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="h-6 w-6 text-primary" />
              แจ้งเตือนการจ่าย
            </h1>
            <p className="text-muted-foreground">ส่ง LINE แจ้งเตือนสำหรับคำขอที่อนุมัติจ่ายแล้ว</p>
          </div>
          <Button variant="outline" onClick={fetchPaidRequests} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            รีเฟรช
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BanknoteIcon className="h-4 w-4 text-success" />อนุมัติจ่ายแล้ว
              </CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-success">{requests.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Send className="h-4 w-4 text-primary" />ส่งแจ้งเตือนแล้ว
              </CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-primary">{sentIds.size}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">ยังไม่ได้ส่ง</CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-warning">{requests.length - sentIds.size}</div></CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาชื่อโครงการ หรือผู้ขอ..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>รายการอนุมัติจ่าย ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center py-12 text-muted-foreground">ไม่พบรายการ</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>โครงการ</TableHead>
                      <TableHead>ผู้ขอ</TableHead>
                      <TableHead>ประเภท</TableHead>
                      <TableHead className="text-right">จำนวนเงิน</TableHead>
                      <TableHead>วันที่จ่าย</TableHead>
                      <TableHead className="text-center">สถานะ</TableHead>
                      <TableHead className="text-right">ส่งแจ้งเตือน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(req => (
                      <TableRow key={req.id} className={sentIds.has(req.id) ? "opacity-60" : ""}>
                        <TableCell>
                          <p className="font-medium max-w-[200px] truncate">{req.title}</p>
                          <p className="text-xs text-muted-foreground font-mono">{req.size_code || req.id.slice(0, 8)}</p>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{req.requester_name}</p>
                          <p className="text-xs text-muted-foreground">{req.affiliation || req.department || "-"}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {req.request_type === "everysite" ? "Everysite" : "Matching Fund"}
                            {req.size ? ` ${req.size}` : ""}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold tabular-nums">{fmt(req.amount)}</TableCell>
                        <TableCell className="text-sm">{fmtDate(req.updated_at)}</TableCell>
                        <TableCell className="text-center">
                          {sentIds.has(req.id) ? (
                            <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                              <CheckCircle className="h-3 w-3 mr-1" />ส่งแล้ว
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                              รอส่ง
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={sentIds.has(req.id) ? "outline" : "default"}
                            onClick={() => openSendDialog(req)}
                            disabled={sending === req.id}
                          >
                            {sending === req.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <><Send className="h-3.5 w-3.5 mr-1" />{sentIds.has(req.id) ? "ส่งอีกครั้ง" : "ส่ง LINE"}</>
                            }
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Send Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              ส่ง LINE แจ้งเตือนการจ่าย
            </DialogTitle>
            <DialogDescription>
              {selectedRequest?.title} — {fmt(selectedRequest?.amount || 0)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ผู้รับ</span>
                <span className="font-medium">{selectedRequest?.requester_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">จำนวนเงิน</span>
                <span className="font-bold text-success">{fmt(selectedRequest?.amount || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ประเภท</span>
                <span>{selectedRequest?.request_type === "everysite" ? "Everysite" : "Matching Fund"}{selectedRequest?.size ? ` (${selectedRequest.size})` : ""}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ส่งถึง</span>
                <span className={selectedRequest?.line_id ? "text-success font-medium" : "text-warning"}>
                  {selectedRequest?.line_id ? `LINE: ${selectedRequest.line_id}` : "ไม่มี LINE ID → ส่งกลุ่ม"}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">ข้อความที่จะส่ง LINE</label>
              <Textarea
                value={customMessage}
                onChange={e => setCustomMessage(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">แก้ไขข้อความก่อนส่งได้ครับ</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={!!sending}>ยกเลิก</Button>
            <Button onClick={sendNotification} disabled={!!sending || !customMessage.trim()}>
              {sending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />กำลังส่ง...</>
                : <><Send className="h-4 w-4 mr-2" />ส่ง LINE</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
