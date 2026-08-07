import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, FileSpreadsheet, Printer, Wallet, TrendingDown, PiggyBank, Search, Loader2 } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList,
} from "recharts";
import * as XLSX from "xlsx";
import { listUsers, listRequests } from "@/lib/db";
import { getStatusConfig } from "@/lib/statusUtils";

// ── สี (validated palette: น้ำเงินไล่เฉด — used เข้ม / remaining อ่อน) ─────────
const C_USED = "#2a78d6";
const C_REMAIN = "#cde2fb";
const C_BAR = "#2a78d6";
const C_GRID = "#e1e0d9";
const C_AXIS = "#898781";

const baht = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n || 0));
const bahtShort = (n: number) => {
  const v = Math.round(n || 0);
  if (v >= 1_000_000) return `฿${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `฿${(v / 1_000).toFixed(0)}K`;
  return `฿${v}`;
};
const num = (v: unknown) => Number(v) || 0;

type Row = Record<string, unknown>;

export default function Dashboard() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<Row[]>([]);
  const [requests, setRequests] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSearch, setUserSearch] = useState("");

  const canView = profile?.role === "admin";

  const fetchData = async () => {
    setLoading(true);
    const [u, r] = await Promise.all([listUsers(), listRequests()]);
    if (u.success && Array.isArray(u.data)) setUsers(u.data);
    if (r.success && Array.isArray(r.data)) setRequests(r.data);
    if (!u.success || !r.success) toast({ title: "โหลดข้อมูลไม่สำเร็จ", variant: "destructive" });
    setLoading(false);
  };
  useEffect(() => { if (canView) fetchData(); }, [canView]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── สรุปรวม ────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let budMF = 0, usedMF = 0, budES = 0, usedES = 0;
    users.forEach((u) => {
      budMF += num(u.budget_matching_fund); usedMF += num(u.used_matching_fund);
      budES += num(u.budget_everysite); usedES += num(u.used_everysite);
    });
    const budget = budMF + budES, used = usedMF + usedES;
    return { budget, used, remaining: Math.max(0, budget - used), budMF, usedMF, budES, usedES };
  }, [users]);
  const pctUsed = totals.budget > 0 ? Math.round((totals.used / totals.budget) * 100) : 0;

  // ── ราย zone ────────────────────────────────────────────────────────────────
  const byZone = useMemo(() => {
    const m: Record<string, { zone: string; users: number; budget: number; used: number }> = {};
    users.forEach((u) => {
      const z = (u.zone_id as string) || "ไม่ระบุ";
      if (!m[z]) m[z] = { zone: z, users: 0, budget: 0, used: 0 };
      m[z].users++;
      m[z].budget += num(u.budget_matching_fund) + num(u.budget_everysite);
      m[z].used += num(u.used_matching_fund) + num(u.used_everysite);
    });
    return Object.values(m)
      .map((z) => ({ ...z, remaining: Math.max(0, z.budget - z.used), label: z.zone === "ไม่ระบุ" ? z.zone : `โซน ${z.zone}` }))
      .sort((a, b) => (Number(a.zone) || 99) - (Number(b.zone) || 99));
  }, [users]);

  // ── ราย user ────────────────────────────────────────────────────────────────
  const byUser = useMemo(() => {
    return users
      .map((u) => {
        const budget = num(u.budget_matching_fund) + num(u.budget_everysite);
        const used = num(u.used_matching_fund) + num(u.used_everysite);
        return {
          name: (u.full_name as string) || "-",
          email: (u.email as string) || "",
          zone: (u.zone_id as string) || "-",
          role: (u.role as string) || "",
          budget, used, remaining: Math.max(0, budget - used),
        };
      })
      .filter((u) => u.budget > 0 || u.used > 0)
      .sort((a, b) => b.used - a.used);
  }, [users]);

  const filteredUsers = useMemo(
    () => byUser.filter((u) => u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase())),
    [byUser, userSearch]
  );

  // ── คำขอตามสถานะ ────────────────────────────────────────────────────────────
  const byStatus = useMemo(() => {
    const m: Record<string, number> = {};
    requests.forEach((r) => { const s = (r.status as string) || "-"; m[s] = (m[s] || 0) + 1; });
    return Object.entries(m)
      .map(([status, count]) => ({ status, label: getStatusConfig(status).label, count }))
      .sort((a, b) => b.count - a.count);
  }, [requests]);

  const paidTotal = useMemo(
    () => requests.filter((r) => r.status === "paid").reduce((s, r) => s + num(r.amount), 0),
    [requests]
  );

  // ── Export Excel ─────────────────────────────────────────────────────────────
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { รายการ: "งบทั้งหมด", จำนวนเงิน: totals.budget },
      { รายการ: "ใช้ไป", จำนวนเงิน: totals.used },
      { รายการ: "คงเหลือ", จำนวนเงิน: totals.remaining },
      { รายการ: "Matching Fund (งบ)", จำนวนเงิน: totals.budMF },
      { รายการ: "Matching Fund (ใช้ไป)", จำนวนเงิน: totals.usedMF },
      { รายการ: "Everysite (งบ)", จำนวนเงิน: totals.budES },
      { รายการ: "Everysite (ใช้ไป)", จำนวนเงิน: totals.usedES },
      { รายการ: "จ่ายจริงรวม (คำขอ paid)", จำนวนเงิน: paidTotal },
    ]), "สรุป");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      byZone.map((z) => ({ โซน: z.label, ผู้ใช้: z.users, งบ: z.budget, ใช้ไป: z.used, คงเหลือ: z.remaining, "%ใช้": z.budget ? Math.round((z.used / z.budget) * 100) : 0 }))
    ), "ราย Zone");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      byUser.map((u) => ({ ชื่อ: u.name, อีเมล: u.email, โซน: u.zone, งบ: u.budget, ใช้ไป: u.used, คงเหลือ: u.remaining }))
    ), "ราย User");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      byStatus.map((s) => ({ สถานะ: s.label, จำนวน: s.count }))
    ), "ตามสถานะ");
    XLSX.writeFile(wb, `everysite-budget-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (!canView) {
    return <AppLayout><div className="flex items-center justify-center h-64"><p className="text-muted-foreground">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6 print:space-y-4">
        {/* header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Dashboard สรุปงบประมาณ</h1>
            <p className="text-muted-foreground">ภาพรวมงบใช้ไป/คงเหลือ ราย Zone และราย User</p>
          </div>
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />รีเฟรช
            </Button>
            <Button variant="outline" onClick={exportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />Excel
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />พิมพ์ / PDF
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* summary cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">งบทั้งหมด</CardTitle>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{baht(totals.budget)}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">ใช้ไป</CardTitle>
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: C_USED }}>{baht(totals.used)}</div>
                  <p className="text-xs text-muted-foreground mt-1">{pctUsed}% ของงบทั้งหมด</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">คงเหลือ</CardTitle>
                  <PiggyBank className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold text-success">{baht(totals.remaining)}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">จ่ายจริงรวม</CardTitle>
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{baht(paidTotal)}</div>
                  <p className="text-xs text-muted-foreground mt-1">จากคำขอสถานะ "จ่ายแล้ว"</p>
                </CardContent>
              </Card>
            </div>

            {/* fund split + overall progress */}
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-1">
                <CardHeader className="pb-3"><CardTitle className="text-base">การใช้งบรวม</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1"><span>ใช้ไป {pctUsed}%</span><span className="text-muted-foreground">{baht(totals.used)} / {baht(totals.budget)}</span></div>
                    <Progress value={pctUsed} className="h-3" />
                  </div>
                  <FundRow label="Matching Fund" used={totals.usedMF} budget={totals.budMF} />
                  <FundRow label="Everysite" used={totals.usedES} budget={totals.budES} />
                </CardContent>
              </Card>

              {/* requests by status */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-base">คำขอตามสถานะ ({requests.length})</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={byStatus} margin={{ top: 16, right: 8, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C_GRID} vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: C_AXIS }} interval={0} angle={-20} textAnchor="end" height={60} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: C_AXIS }} />
                        <Tooltip cursor={{ fill: "rgba(42,120,214,0.08)" }} formatter={(v: number) => [`${v} คำขอ`, "จำนวน"]} />
                        <Bar dataKey="count" fill={C_BAR} radius={[4, 4, 0, 0]} maxBarSize={48}>
                          <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: C_AXIS }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* budget by zone chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">งบประมาณราย Zone (ใช้ไป vs คงเหลือ)</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ height: Math.max(280, byZone.length * 34) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={byZone} margin={{ top: 4, right: 24, left: 8, bottom: 4 }} barCategoryGap={6}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C_GRID} horizontal={false} />
                      <XAxis type="number" tickFormatter={bahtShort} tick={{ fontSize: 11, fill: C_AXIS }} />
                      <YAxis type="category" dataKey="label" width={64} tick={{ fontSize: 11, fill: C_AXIS }} />
                      <Tooltip cursor={{ fill: "rgba(42,120,214,0.06)" }} formatter={(v: number, n) => [baht(v), n === "used" ? "ใช้ไป" : "คงเหลือ"]} />
                      <Bar dataKey="used" stackId="a" fill={C_USED} radius={[4, 0, 0, 4]} name="used" />
                      <Bar dataKey="remaining" stackId="a" fill={C_REMAIN} radius={[0, 4, 4, 0]} name="remaining" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground justify-center">
                  <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: C_USED }} />ใช้ไป</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm border" style={{ background: C_REMAIN }} />คงเหลือ</span>
                </div>
              </CardContent>
            </Card>

            {/* per-zone table */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">สรุปราย Zone</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>โซน</TableHead>
                        <TableHead className="text-right">ผู้ใช้</TableHead>
                        <TableHead className="text-right">งบ</TableHead>
                        <TableHead className="text-right">ใช้ไป</TableHead>
                        <TableHead className="text-right">คงเหลือ</TableHead>
                        <TableHead className="text-right">% ใช้</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byZone.map((z) => {
                        const p = z.budget ? Math.round((z.used / z.budget) * 100) : 0;
                        return (
                          <TableRow key={z.zone}>
                            <TableCell className="font-medium">{z.label}</TableCell>
                            <TableCell className="text-right tabular-nums">{z.users}</TableCell>
                            <TableCell className="text-right tabular-nums">{baht(z.budget)}</TableCell>
                            <TableCell className="text-right tabular-nums" style={{ color: C_USED }}>{baht(z.used)}</TableCell>
                            <TableCell className="text-right tabular-nums text-success">{baht(z.remaining)}</TableCell>
                            <TableCell className="text-right tabular-nums">{p}%</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* per-user table */}
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-3 flex-wrap">
                <CardTitle className="text-base">สรุปราย User ({filteredUsers.length})</CardTitle>
                <div className="relative w-full sm:w-64 print:hidden">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="ค้นหาชื่อ / อีเมล..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="pl-10 h-9" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ชื่อ</TableHead>
                        <TableHead>โซน</TableHead>
                        <TableHead className="text-right">งบ</TableHead>
                        <TableHead className="text-right">ใช้ไป</TableHead>
                        <TableHead className="text-right">คงเหลือ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((u) => (
                        <TableRow key={u.email}>
                          <TableCell>
                            <p className="font-medium">{u.name}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </TableCell>
                          <TableCell>{u.zone === "-" ? "-" : `โซน ${u.zone}`}</TableCell>
                          <TableCell className="text-right tabular-nums">{baht(u.budget)}</TableCell>
                          <TableCell className="text-right tabular-nums" style={{ color: C_USED }}>{baht(u.used)}</TableCell>
                          <TableCell className="text-right tabular-nums text-success">{baht(u.remaining)}</TableCell>
                        </TableRow>
                      ))}
                      {filteredUsers.length === 0 && (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">ไม่พบผู้ใช้</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function FundRow({ label, used, budget }: { label: string; used: number; budget: number }) {
  const p = budget > 0 ? Math.round((used / budget) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">{baht(used)} / {baht(budget)}</span>
      </div>
      <Progress value={p} className="h-2" />
    </div>
  );
}
