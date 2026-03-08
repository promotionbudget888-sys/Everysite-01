import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Wallet, Edit, Save, Loader2 } from "lucide-react";
import { UserStatus, getStatusLabel } from "@/lib/auth";
import { apiPost } from "@/lib/api";

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  zone_id: string | null;
  zone_name?: string;
  department: string | null;
  affiliation: string | null;
  branch: string | null;
  budget_matching_fund: number;
  budget_everysite: number;
  used_matching_fund: number;
  used_everysite: number;
  status: UserStatus;
}

function formatMoney(val: number) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(val);
}

export default function Zones() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAffiliation, setFilterAffiliation] = useState<string>("all");
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [budgetMF, setBudgetMF] = useState("");
  const [budgetES, setBudgetES] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const canManage = profile?.role === "admin";

  const fetchUsers = async () => {
    setLoading(true);
    const res = await apiPost({ mode: "users" });
    if (res.success && Array.isArray(res.data)) {
      setUsers(res.data);
    } else {
      setUsers([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const affiliations = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => { if (u.affiliation) set.add(u.affiliation); });
    return Array.from(set).sort();
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch = u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchAff = filterAffiliation === "all" || u.affiliation === filterAffiliation;
      return matchSearch && matchAff;
    });
  }, [users, searchTerm, filterAffiliation]);

  const summary = useMemo(() => {
    let totalMF = 0, totalES = 0, usedMF = 0, usedES = 0;
    users.forEach((u) => { totalMF += u.budget_matching_fund ?? 0; totalES += u.budget_everysite ?? 0; usedMF += u.used_matching_fund ?? 0; usedES += u.used_everysite ?? 0; });
    return { totalMF, totalES, usedMF, usedES, remainMF: totalMF - usedMF, remainES: totalES - usedES };
  }, [users]);

  const openEdit = (u: UserRow) => {
    setEditingUser(u);
    setBudgetMF(String(u.budget_matching_fund ?? 0));
    setBudgetES(String(u.budget_everysite ?? 0));
    setDialogOpen(true);
  };

  const saveUserBudget = async () => {
    if (!editingUser) return;
    const mf = Number(budgetMF);
    const es = Number(budgetES);
    if (!Number.isFinite(mf) || mf < 0 || !Number.isFinite(es) || es < 0) {
      toast({ title: "ข้อมูลไม่ถูกต้อง", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    const res = await apiPost({ mode: "update_user", id: editingUser.id, budget_matching_fund: mf, budget_everysite: es });
    if (res.success) {
      toast({ title: "สำเร็จ", description: "อัปเดตงบสำเร็จ" });
      setDialogOpen(false);
      fetchUsers();
    } else {
      toast({ title: "ไม่สามารถบันทึกได้", variant: "destructive" });
    }
    setIsSaving(false);
  };

  const getStatusBadge = (status: UserStatus) => {
    switch (status) {
      case "pending": return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">{getStatusLabel(status)}</Badge>;
      case "approved": return <Badge variant="outline" className="bg-success/10 text-success border-success/30">{getStatusLabel(status)}</Badge>;
      case "rejected": return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">{getStatusLabel(status)}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!canManage) {
    return <AppLayout><div className="flex items-center justify-center h-64"><p className="text-muted-foreground">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p></div></AppLayout>;
  }

  return (
    <AppLayout>
      <section className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-foreground">จัดการงบประมาณ</h1>
          <p className="text-muted-foreground">จัดการงบและสถานะผู้ใช้งานทั้งหมด</p>
        </header>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card><CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-sm font-medium">ผู้ใช้ทั้งหมด</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{users.length}</div></CardContent></Card>
          <Card><CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-sm font-medium">งบ MF รวม</CardTitle><Wallet className="h-4 w-4 text-primary" /></CardHeader><CardContent><div className="text-2xl font-bold">฿{formatMoney(summary.totalMF)}</div><p className="text-xs text-muted-foreground">คงเหลือ ฿{formatMoney(summary.remainMF)}</p></CardContent></Card>
          <Card><CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-sm font-medium">งบ ES รวม</CardTitle><Wallet className="h-4 w-4 text-secondary" /></CardHeader><CardContent><div className="text-2xl font-bold">฿{formatMoney(summary.totalES)}</div><p className="text-xs text-muted-foreground">คงเหลือ ฿{formatMoney(summary.remainES)}</p></CardContent></Card>
          <Card><CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-sm font-medium">ใช้ไปรวม</CardTitle><Wallet className="h-4 w-4 text-warning" /></CardHeader><CardContent><div className="text-2xl font-bold">฿{formatMoney(summary.usedMF + summary.usedES)}</div></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>ค้นหาผู้ใช้</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="ชื่อหรืออีเมล" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" /></div>
              <Select value={filterAffiliation} onValueChange={setFilterAffiliation}>
                <SelectTrigger><SelectValue placeholder="สังกัด" /></SelectTrigger>
                <SelectContent><SelectItem value="all">ทุกสังกัด</SelectItem>{affiliations.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="outline" onClick={() => { setSearchTerm(""); setFilterAffiliation("all"); }}>ล้างตัวกรอง</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>รายชื่อผู้ใช้งาน ({filteredUsers.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อ-สกุล</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>สังกัด</TableHead>
                    <TableHead className="text-right">งบ MF</TableHead>
                    <TableHead className="text-right">งบ ES</TableHead>
                    <TableHead className="text-right">ใช้ไป</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mx-auto" /></TableCell></TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">ไม่พบข้อมูล</TableCell></TableRow>
                  ) : filteredUsers.map((u) => {
                    const totalUsed = (u.used_matching_fund ?? 0) + (u.used_everysite ?? 0);
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.full_name}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>{u.affiliation ?? "-"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(u.budget_matching_fund ?? 0)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(u.budget_everysite ?? 0)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(totalUsed)}</TableCell>
                        <TableCell>{getStatusBadge(u.status)}</TableCell>
                        <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => openEdit(u)}><Edit className="h-4 w-4 mr-1" />แก้ไขงบ</Button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>แก้ไขงบประมาณ</DialogTitle><DialogDescription>{editingUser?.full_name} ({editingUser?.email})</DialogDescription></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2"><label className="text-sm font-medium">งบ Matching Fund (บาท)</label><Input inputMode="numeric" value={budgetMF} onChange={(e) => setBudgetMF(e.target.value)} placeholder="0" /></div>
              <div className="space-y-2"><label className="text-sm font-medium">งบ Everysite (บาท)</label><Input inputMode="numeric" value={budgetES} onChange={(e) => setBudgetES(e.target.value)} placeholder="0" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>ยกเลิก</Button>
              <Button onClick={saveUserBudget} className="gradient-primary" disabled={isSaving}>
                {isSaving ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />กำลังบันทึก...</>) : (<><Save className="h-4 w-4 mr-2" />บันทึก</>)}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    </AppLayout>
  );
}
