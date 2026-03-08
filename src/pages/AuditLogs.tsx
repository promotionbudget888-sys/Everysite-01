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
import { Search, History, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { apiPost } from "@/lib/api";

interface AuditLog {
  id: string;
  action: string;
  actor_name: string;
  actor_role: string;
  target_type: string;
  target_id: string | null;
  detail: string | null;
  created_at: string;
}

type RawAuditLog = Partial<AuditLog> & {
  log_id?: string;
  timestamp?: string;
};

export default function AuditLogs() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");

  const canView = profile?.role === "admin";

  const fetchLogs = async () => {
    setLoading(true);
    const res = await apiPost({ mode: "audit_logs" });
    if (res.success && Array.isArray(res.data)) {
      const normalized = (res.data as RawAuditLog[]).map((item, index) => {
        const createdAt = item.created_at || item.timestamp || new Date().toISOString();
        return {
          id: item.id || item.log_id || `${createdAt}-${index}`,
          action: item.action || "-",
          actor_name: item.actor_name || "-",
          actor_role: item.actor_role || "requester",
          target_type: item.target_type || "",
          target_id: item.target_id ? String(item.target_id) : null,
          detail: item.detail ? String(item.detail) : null,
          created_at: createdAt,
        };
      });
      setLogs(normalized);
    } else {
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถโหลด Audit Logs ได้", variant: "destructive" });
      setLogs([]);
    }
    setLoading(false);
  };

  useEffect(() => { if (canView) fetchLogs(); }, [canView]);

  const uniqueActions = [...new Set(logs.map((l) => l.action))].sort();

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = log.actor_name.toLowerCase().includes(searchTerm.toLowerCase()) || log.action.toLowerCase().includes(searchTerm.toLowerCase()) || (log.detail?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesAction = filterAction === "all" || log.action === filterAction;
    return matchesSearch && matchesAction;
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin": return <Badge className="bg-primary">ผู้ดูแลระบบ</Badge>;
      case "zone_approver": return <Badge variant="secondary">ผู้อนุมัติโซน</Badge>;
      default: return <Badge variant="outline">ผู้ขอใช้งบ</Badge>;
    }
  };

  const formatDateTime = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return format(parsed, "dd MMM yyyy HH:mm:ss", { locale: th });
  };

  if (!canView) {
    return <AppLayout><div className="flex items-center justify-center h-64"><p className="text-muted-foreground">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p></div></AppLayout>;
  }

  return (
    <AppLayout>
      <section className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><History className="h-6 w-6" />ประวัติการใช้งาน</h1>
            <p className="text-muted-foreground">Audit Logs - บันทึกทุก action ในระบบ (ดึงจาก Google Sheets)</p>
          </div>
          <Button variant="outline" onClick={fetchLogs} disabled={loading}><RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />รีเฟรช</Button>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Logs ทั้งหมด</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{logs.length}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">วันนี้</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{logs.filter((l) => new Date(l.created_at).toDateString() === new Date().toDateString()).length}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Actions ที่พบ</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{uniqueActions.length}</div></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>ค้นหาและกรอง</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="ค้นหา..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger><SelectValue placeholder="Action" /></SelectTrigger>
                <SelectContent><SelectItem value="all">ทุก Action</SelectItem>{uniqueActions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="outline" onClick={() => { setSearchTerm(""); setFilterAction("all"); }}>ล้างตัวกรอง</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>รายการ Audit Logs ({filteredLogs.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[160px]">วันที่/เวลา</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>ผู้ดำเนินการ</TableHead>
                    <TableHead>บทบาท</TableHead>
                    <TableHead className="min-w-[200px]">รายละเอียด</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mx-auto" /></TableCell></TableRow>
                  ) : filteredLogs.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">ไม่พบข้อมูล</TableCell></TableRow>
                  ) : filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm tabular-nums">{formatDateTime(log.created_at)}</TableCell>
                      <TableCell><Badge variant="outline">{log.action}</Badge></TableCell>
                      <TableCell className="font-medium">{log.actor_name}</TableCell>
                      <TableCell>{getRoleBadge(log.actor_role)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{log.detail || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>
    </AppLayout>
  );
}
