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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserCheck, UserX, Search, Users, Clock, CheckCircle, XCircle, Edit, RefreshCw } from 'lucide-react';
import { UserRole, UserStatus, getRoleLabel } from '@/lib/auth';
import { apiPost } from '@/lib/api';

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
}

export default function UserManagement() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('requester');
  const [editZone, setEditZone] = useState('');
  const [editBudgetMF, setEditBudgetMF] = useState(0);
  const [editBudgetES, setEditBudgetES] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const res = await apiPost({ mode: 'users' });
    if (res.success && Array.isArray(res.data)) setUsers(res.data);
    else setUsers([]);
    setLoading(false);
  };

  const updateUserStatus = async (userId: string, newStatus: UserStatus) => {
    if (actionLoading) return;
    setActionLoading(userId);
    try {
      // ✅ ส่งชื่อผู้อนุมัติไปด้วย
      const res = await apiPost({
        mode: 'update_user',
        id: userId,
        status: newStatus,
        approver_name: profile?.full_name || 'ผู้ดูแลระบบ',
      });
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
    setDialogOpen(true);
  };

  const saveEdit = async () => {
    if (!editingUser || actionLoading) return;
    setActionLoading(editingUser.id);
    try {
      const res = await apiPost({
        mode: 'update_user',
        id: editingUser.id,
        role: editRole,
        zone_id: editZone,
        budget_matching_fund: editBudgetMF,
        budget_everysite: editBudgetES,
        approver_name: profile?.full_name || 'ผู้ดูแลระบบ',
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

  const filtered = users.filter((u) => {
    const s = searchTerm.toLowerCase();
    const matchSearch = u.full_name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
    const matchStatus = filterStatus === 'all' || u.status === filterStatus;
    return matchSearch && matchStatus;
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

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="ค้นหาชื่อหรืออีเมล..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานะ ({users.length})</SelectItem>
              <SelectItem value="pending">รออนุมัติ ({pending})</SelectItem>
              <SelectItem value="approved">อนุมัติแล้ว ({approved})</SelectItem>
              <SelectItem value="rejected">ปฏิเสธ ({rejected})</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => { setSearchTerm(''); setFilterStatus('all'); }}>ล้าง</Button>
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
                        <div className="font-medium text-sm">{user.full_name}</div>
                        <div className="mt-0.5"><Badge variant="outline" className="text-xs px-1 py-0">{getRoleLabel(user.role)}</Badge></div>
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={!!actionLoading}>ยกเลิก</Button>
              <Button onClick={saveEdit} disabled={!!actionLoading}>
                {actionLoading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />กำลังบันทึก...</> : 'บันทึก'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}