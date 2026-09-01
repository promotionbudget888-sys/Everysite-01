import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserCheck, UserX, Search, Users, Clock, CheckCircle, XCircle, Edit, RefreshCw, KeyRound, Trash2 } from 'lucide-react';
import { UserRole, UserStatus, getRoleLabel, getDisplayTitle, isSpecialUser } from '@/lib/auth';
import { listUsers, updateUser, setUserStatus } from '@/lib/db';
import { supabase } from '@/integrations/supabase/client';
import { ZoneFilter } from '@/components/ZoneFilter';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  zone_id: string | null;
  status: UserStatus;
  affiliation: string | null;
  department: string | null;
  branch: string | null;
  budget_matching_fund: number;
  budget_everysite: number;
  used_matching_fund?: number;
  used_everysite?: number;
  line_id?: string;
}

export default function UserManagement() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [filterZone, setFilterZone] = useState('all');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('requester');
  const [editZone, setEditZone] = useState('');
  const [editBudgetMF, setEditBudgetMF] = useState(0);
  const [editBudgetES, setEditBudgetES] = useState(0);
  const [editUsedMF, setEditUsedMF] = useState(0);
  const [editUsedES, setEditUsedES] = useState(0);
  const [editLineId, setEditLineId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [settingPw, setSettingPw] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [deleteReqCount, setDeleteReqCount] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const res = await listUsers();
    if (res.success && Array.isArray(res.data)) setUsers(res.data);
    else setUsers([]);
    setLoading(false);
  };

  const updateUserStatus = async (userId: string, newStatus: UserStatus) => {
    if (actionLoading) return;
    setActionLoading(userId);
    try {
      const res = await setUserStatus(userId, newStatus);
      if (res.success) {
        toast({ title: 'สำเร็จ', description: newStatus === 'approved' ? 'อนุมัติเรียบร้อย' : 'ปฏิเสธเรียบร้อย' });
        fetchUsers();
      } else {
        toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
      }
    } finally {
      setActionLoading(null);
    }
  };

  const openEdit = (user: UserProfile) => {
    setEditingUser(user);
    setEditRole(user.role);
    setEditZone(user.zone_id ?? '');
    setEditBudgetMF(user.budget_matching_fund ?? 0);
    setEditBudgetES(user.budget_everysite ?? 0);
    setEditUsedMF(user.used_matching_fund ?? 0);
    setEditUsedES(user.used_everysite ?? 0);
    setEditLineId(user.line_id ?? '');
    setNewPassword('');
    setDialogOpen(true);
  };

  const saveEdit = async () => {
    if (!editingUser || actionLoading) return;
    setActionLoading(editingUser.id);
    try {
      const res = await updateUser(editingUser.id, {
        role: editRole,
        zone_id: editZone,
        budget_matching_fund: editBudgetMF,
        budget_everysite: editBudgetES,
        used_matching_fund: editUsedMF,
        used_everysite: editUsedES,
        line_id: editLineId,
      });
      if (res.success) {
        toast({ title: 'บันทึกสำเร็จ' });
        setDialogOpen(false);
        fetchUsers();
      } else {
        toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
      }
    } finally {
      setActionLoading(null);
    }
  };

  // ตั้งรหัสผ่านใหม่ให้ user (ผ่าน edge function ที่ verify admin ฝั่ง server)
  const setPassword = async () => {
    if (!editingUser || newPassword.length < 6) {
      toast({ title: 'รหัสผ่านต้องอย่างน้อย 6 ตัว', variant: 'destructive' });
      return;
    }
    setSettingPw(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'set_password', email: editingUser.email, password: newPassword },
      });
      if (error || (data && data.error)) {
        toast({ title: 'ตั้งรหัสผ่านไม่สำเร็จ', description: (data?.error || error?.message || ''), variant: 'destructive' });
      } else {
        toast({ title: 'ตั้งรหัสผ่านใหม่สำเร็จ', description: `${editingUser.email} ใช้รหัสใหม่ได้เลย` });
        setNewPassword('');
      }
    } catch (e) {
      toast({ title: 'ตั้งรหัสผ่านไม่สำเร็จ', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    } finally {
      setSettingPw(false);
    }
  };

  // เปิด dialog ยืนยันลบ + ดึงจำนวนคำขอของผู้ใช้ (เพื่อเตือน)
  const openDelete = async (user: UserProfile) => {
    setDeleteTarget(user);
    setDeleteReqCount(null);
    const { count } = await supabase.from('requests').select('id', { count: 'exact', head: true }).eq('requester_id', user.id);
    setDeleteReqCount(count ?? 0);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'delete_user', email: deleteTarget.email },
      });
      if (error || (data && data.error)) {
        toast({ title: 'ลบไม่สำเร็จ', description: (data?.error || error?.message || ''), variant: 'destructive' });
      } else {
        toast({ title: 'ลบผู้ใช้แล้ว', description: deleteTarget.email });
        setDeleteTarget(null);
        fetchUsers();
      }
    } catch (e) {
      toast({ title: 'ลบไม่สำเร็จ', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  // แท็บเดียวใช้ได้ทั้งกรองสถานะ และกรองบทบาท
  const STATUS_TABS = ['all', 'pending', 'approved', 'rejected'];
  const filtered = users.filter((u) => {
    const s = searchTerm.toLowerCase();
    const matchSearch = u.full_name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
    const matchTab =
      filterStatus === 'all'
        ? true
        : STATUS_TABS.includes(filterStatus)
          ? u.status === filterStatus
          : u.role === filterStatus;
    const matchZone = filterZone === 'all' || String(u.zone_id ?? '') === filterZone;
    return matchSearch && matchTab && matchZone;
  });

  const fmt  = (n: number) => (n ?? 0).toLocaleString('th-TH');
  const fmtB = (n: number) => `฿${(n ?? 0).toLocaleString('th-TH')}`;

  const statusBadge = (s: UserStatus) => {
    if (s === 'pending')  return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 whitespace-nowrap">รออนุมัติ</Badge>;
    if (s === 'approved') return <Badge variant="outline" className="bg-success/10 text-success border-success/30 whitespace-nowrap">อนุมัติแล้ว</Badge>;
    if (s === 'rejected') return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 whitespace-nowrap">ปฏิเสธ</Badge>;
  };

  const pending  = users.filter(u => u.status === 'pending').length;
  const approved = users.filter(u => u.status === 'approved').length;
  const rejected = users.filter(u => u.status === 'rejected').length;
  const cAdmin = users.filter(u => u.role === 'admin').length;
  const cL1    = users.filter(u => u.role === 'zone_approver_1').length;
  const cL2    = users.filter(u => u.role === 'zone_approver_2').length;
  const totalMF   = users.reduce((s, u) => s + (u.budget_matching_fund ?? 0), 0);
  const totalES   = users.reduce((s, u) => s + (u.budget_everysite ?? 0), 0);
  const totalUsed = users.reduce((s, u) => s + (u.used_matching_fund ?? 0) + (u.used_everysite ?? 0), 0);

  if (profile?.role !== 'admin') {
    return <AppLayout><div className="flex items-center justify-center h-64"><p className="text-muted-foreground">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">จัดการผู้ใช้งาน</h1>
            <p className="text-muted-foreground">จัดการงบและสถานะผู้ใช้งานทั้งหมด</p>
          </div>
          <Button variant="outline" onClick={fetchUsers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />รีเฟรช
          </Button>
        </div>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Users className="h-4 w-4" />ทั้งหมด</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{users.length}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">งบ MF รวม</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmtB(totalMF)}</div><p className="text-xs text-muted-foreground">คงเหลือ {fmtB(totalMF)}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">งบ ES รวม</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmtB(totalES)}</div><p className="text-xs text-muted-foreground">คงเหลือ {fmtB(totalES)}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">ใช้ไปรวม</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmtB(totalUsed)}</div></CardContent></Card>
        </div>

        {/* แท็บแยกสถานะ */}
        <Tabs value={filterStatus} onValueChange={setFilterStatus}>
          <TabsList className="w-full h-auto flex flex-wrap justify-start gap-1">
            <TabsTrigger value="pending">รออนุมัติ ({pending})</TabsTrigger>
            <TabsTrigger value="approved">อนุมัติแล้ว ({approved})</TabsTrigger>
            <TabsTrigger value="rejected">ปฏิเสธ ({rejected})</TabsTrigger>
            <TabsTrigger value="all">ทั้งหมด ({users.length})</TabsTrigger>
            <span className="mx-1 self-center text-muted-foreground/40">|</span>
            <TabsTrigger value="admin">ผู้ดูแลระบบ ({cAdmin})</TabsTrigger>
            <TabsTrigger value="zone_approver_1">ผู้อนุมัติ L1 ({cL1})</TabsTrigger>
            <TabsTrigger value="zone_approver_2">ผู้อนุมัติ L2 ({cL2})</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="ค้นหาชื่อหรืออีเมล..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          <ZoneFilter value={filterZone} onChange={setFilterZone} />
        </div>

        <Card>
          <CardHeader><CardTitle>รายชื่อผู้ใช้งาน ({filtered.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">ชื่อ-สกุล</TableHead>
                    <TableHead className="min-w-[180px]">Email</TableHead>
                    <TableHead className="min-w-[80px]">โซน</TableHead>
                    <TableHead className="min-w-[100px]">ฝ่าย</TableHead>
                    <TableHead className="min-w-[100px]">สังกัด</TableHead>
                    <TableHead className="text-right min-w-[80px]">งบ MF</TableHead>
                    <TableHead className="text-right min-w-[80px]">งบ ES</TableHead>
                    <TableHead className="text-right min-w-[80px]">ใช้ไป</TableHead>
                    <TableHead className="min-w-[110px]">สถานะ</TableHead>
                    <TableHead className="text-right min-w-[180px]">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mx-auto" /></TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">ไม่พบข้อมูลผู้ใช้</TableCell></TableRow>
                  ) : filtered.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="font-medium text-sm flex items-center gap-1">
                          {isSpecialUser(user.email) && <span>👑</span>}
                          {user.full_name}
                        </div>
                        <div className="mt-0.5">
                          <Badge variant="outline" className={`text-xs px-1 py-0 ${isSpecialUser(user.email) ? 'border-amber-400/60 text-amber-600 bg-amber-50' : ''}`}>
                            {getDisplayTitle(user.email, user.role)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                      <TableCell className="text-sm">{user.zone_id ? `โซน ${user.zone_id}` : <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell className="text-sm">{user.department || <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell className="text-sm">{user.affiliation || <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums font-medium">{fmt(user.budget_matching_fund)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums font-medium">{fmt(user.budget_everysite)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{fmt((user.used_matching_fund ?? 0) + (user.used_everysite ?? 0))}</TableCell>
                      <TableCell>{statusBadge(user.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          {user.status === 'pending' && <>
                            <Button size="sm" variant="outline" className="text-success hover:bg-success/10" disabled={actionLoading === user.id} onClick={() => updateUserStatus(user.id, 'approved')}>
                              <UserCheck className="h-3 w-3 mr-1" />{actionLoading === user.id ? '...' : 'อนุมัติ'}
                            </Button>
                            <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10" disabled={actionLoading === user.id} onClick={() => updateUserStatus(user.id, 'rejected')}>
                              <UserX className="h-3 w-3 mr-1" />{actionLoading === user.id ? '...' : 'ปฏิเสธ'}
                            </Button>
                          </>}
                          <Button size="sm" variant="outline" onClick={() => openEdit(user)}>
                            <Edit className="h-3 w-3 mr-1" />แก้ไข
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => openDelete(user)}>
                            <Trash2 className="h-3 w-3 mr-1" />ลบ
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>แก้ไขผู้ใช้</DialogTitle>
              <DialogDescription>{editingUser?.full_name} — {editingUser?.email}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">บทบาท</label>
                <Select value={editRole} onValueChange={v => setEditRole(v as UserRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="requester">ผู้ขอใช้งบ</SelectItem>
                    <SelectItem value="zone_approver_1">ผู้อนุมัติ Level 1</SelectItem>
                    <SelectItem value="zone_approver_2">ผู้อนุมัติ Level 2</SelectItem>
                    <SelectItem value="admin">ผู้ดูแลระบบ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">โซน</label>
                <Select value={editZone || 'none'} onValueChange={v => setEditZone(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="เลือกโซน" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ไม่ระบุ</SelectItem>
                    {Array.from({ length: 16 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>โซน {i + 1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">งบ MF (บาท)</label>
                  <Input type="number" min={0} value={editBudgetMF} onChange={e => setEditBudgetMF(Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">งบ ES (บาท)</label>
                  <Input type="number" min={0} value={editBudgetES} onChange={e => setEditBudgetES(Number(e.target.value))} />
                </div>
              </div>
              {/* ใช้ไป — แยก MF/ES (ยอด "ใช้ไป" ที่แสดง = MF + ES รวมกัน) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">ใช้ไป MF (บาท)</label>
                  <Input type="number" min={0} value={editUsedMF} onChange={e => setEditUsedMF(Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">ใช้ไป ES (บาท)</label>
                  <Input type="number" min={0} value={editUsedES} onChange={e => setEditUsedES(Number(e.target.value))} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">ใช้ไปรวม: {fmtB(editUsedMF + editUsedES)}</p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">LINE ID</label>
                <Input placeholder="เช่น @mylineid หรือ Uxxx..." value={editLineId} onChange={e => setEditLineId(e.target.value)} />
              </div>

              {/* ตั้งรหัสผ่านใหม่ */}
              <div className="space-y-1.5 border-t pt-3">
                <label className="text-sm font-medium flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" />ตั้งรหัสผ่านใหม่</label>
                <div className="flex gap-2">
                  <Input type="text" placeholder="รหัสผ่านใหม่ (≥6 ตัว)" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                  <Button variant="outline" onClick={setPassword} disabled={settingPw || newPassword.length < 6}>
                    {settingPw ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'ตั้งรหัส'}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">ตั้งแล้วผู้ใช้ login ด้วยรหัสใหม่ได้ทันที (ไม่ต้องกดบันทึก)</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={!!actionLoading}>ยกเลิก</Button>
              <Button onClick={saveEdit} disabled={!!actionLoading}>
                {actionLoading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />กำลังบันทึก...</> : 'บันทึก'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ยืนยันลบผู้ใช้ */}
        <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2"><Trash2 className="h-5 w-5" />ยืนยันลบผู้ใช้</DialogTitle>
              <DialogDescription>ลบบัญชีนี้ถาวร กู้คืนไม่ได้</DialogDescription>
            </DialogHeader>
            {deleteTarget && (
              <div className="space-y-3">
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <p className="font-medium">{deleteTarget.full_name}</p>
                  <p className="text-muted-foreground">{deleteTarget.email} · {getRoleLabel(deleteTarget.role)}</p>
                </div>
                {deleteReqCount === null ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5"><RefreshCw className="h-3 w-3 animate-spin" />กำลังตรวจสอบคำขอ...</p>
                ) : deleteReqCount > 0 ? (
                  <p className="text-sm text-destructive bg-destructive/10 rounded-md p-2.5">
                    ⚠️ ผู้ใช้นี้มี <b>{deleteReqCount}</b> คำขอ — ลบแล้ว<b>คำขอทั้งหมดจะถูกลบตามไปด้วย</b>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">ผู้ใช้นี้ไม่มีคำขอ</p>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>ยกเลิก</Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={deleting || deleteReqCount === null}>
                {deleting ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />กำลังลบ...</> : <><Trash2 className="h-4 w-4 mr-2" />ลบถาวร</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
