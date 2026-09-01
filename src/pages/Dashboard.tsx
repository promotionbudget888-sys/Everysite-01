import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, FileSpreadsheet, Printer, Wallet, TrendingDown, PiggyBank, Search, Loader2, Filter } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from "recharts";
import * as XLSX from "xlsx";
import { listUsers, listRequests } from "@/lib/db";
import { getStatusConfig } from "@/lib/statusUtils";

// ── สี (validated palette) ───────────────────────────────────────────────────
const C_USED = "#2a78d6";     // blue
const C_REMAIN = "#cde2fb";   // blue-light
const C_ALT = "#eb6834";      // orange (categorical slot 2)
const C_GRID = "#e1e0d9";
const C_AXIS = "#898781";

const baht = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n || 0));
const bahtShort = (n: number) => {
  const v = Math.round(n || 0);
  if (Math.abs(v) >= 1_000_000) return `฿${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `฿${(v / 1_000).toFixed(0)}K`;
  return `฿${v}`;
};
const num = (v: unknown) => Number(v) || 0;
type Row = Record<string, unknown>;

const isMF = (t: unknown) => String(t || "").toLowerCase().includes("matching");

export default function Dashboard() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<Row[]>([]);
  const [requests, setRequests] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // ── ตัวกรอง ─────────────────────────────────────────────────────────────────
  const [dateRange, setDateRange] = useState("all");   // all | 30d | 90d | year | month
  const [zoneFilter, setZoneFilter] = useState("all");
  const [affFilter, setAffFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");  // all | matching_fund | everysite
  const [userSearch, setUserSearch] = useState("");
  const [trendMetric, setTrendMetric] = useState<"amount" | "count">("amount");

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

  const affiliations = useMemo(
    () => [...new Set(users.map((u) => (u.affiliation as string) || "").filter(Boolean))].sort(),
    [users]
  );

  const dateCutoff = useMemo(() => {
    const now = new Date();
    if (dateRange === "30d") return new Date(now.getTime() - 30 * 864e5);
    if (dateRange === "90d") return new Date(now.getTime() - 90 * 864e5);
    if (dateRange === "year") return new Date(now.getFullYear(), 0, 1);
    if (dateRange === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
    return null;
  }, [dateRange]);

  // profiles ตาม zone + affiliation (งบไม่มีวันที่/ประเภท)
  const fProfiles = useMemo(() => users.filter((u) => {
    if (zoneFilter !== "all" && String(u.zone_id || "") !== zoneFilter) return false;
    if (affFilter !== "all" && String(u.affiliation || "") !== affFilter) return false;
    return true;
  }), [users, zoneFilter, affFilter]);

  // requests ตาม วัน + zone + affiliation + ประเภท
  const fRequests = useMemo(() => requests.filter((r) => {
    if (dateCutoff && new Date(r.created_at as string) < dateCutoff) return false;
    if (zoneFilter !== "all" && String(r.zone_id || "") !== zoneFilter) return false;
    if (affFilter !== "all" && String(r.affiliation || "") !== affFilter) return false;
    if (typeFilter === "matching_fund" && !isMF(r.request_type)) return false;
    if (typeFilter === "everysite" && isMF(r.request_type)) return false;
    return true;
  }), [requests, dateCutoff, zoneFilter, affFilter, typeFilter]);

  const anyFilter = dateRange !== "all" || zoneFilter !== "all" || affFilter !== "all" || typeFilter !== "all";

  // ── สรุปงบ (จาก profiles) ─────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let budMF = 0, usedMF = 0, budES = 0, usedES = 0, penMF = 0, penES = 0;
    fProfiles.forEach((u) => {
      budMF += num(u.budget_matching_fund); usedMF += num(u.used_matching_fund);
      budES += num(u.budget_everysite); usedES += num(u.used_everysite);
      penMF += num(u.pending_matching_fund); penES += num(u.pending_everysite);
    });
    const budget = budMF + budES, used = usedMF + usedES;
    return { budget, used, remaining: Math.max(0, budget - used), pending: penMF + penES, budMF, usedMF, budES, usedES };
  }, [fProfiles]);
  const pctUsed = totals.budget > 0 ? Math.round((totals.used / totals.budget) * 100) : 0;

  const byZone = useMemo(() => {
    const m: Record<string, { zone: string; users: number; budget: number; used: number }> = {};
    fProfiles.forEach((u) => {
      const z = (u.zone_id as string) || "ไม่ระบุ";
      if (!m[z]) m[z] = { zone: z, users: 0, budget: 0, used: 0 };
      m[z].users++;
      m[z].budget += num(u.budget_matching_fund) + num(u.budget_everysite);
      m[z].used += num(u.used_matching_fund) + num(u.used_everysite);
    });
    return Object.values(m)
      .map((z) => ({ ...z, remaining: Math.max(0, z.budget - z.used), label: z.zone === "ไม่ระบุ" ? z.zone : `โซน ${z.zone}` }))
      .sort((a, b) => (Number(a.zone) || 99) - (Number(b.zone) || 99));
  }, [fProfiles]);

  const byUser = useMemo(() => fProfiles.map((u) => {
    const budget = num(u.budget_matching_fund) + num(u.budget_everysite);
    const used = num(u.used_matching_fund) + num(u.used_everysite);
    return {
      name: (u.full_name as string) || "-", email: (u.email as string) || "",
      zone: (u.zone_id as string) || "-", budget, used, remaining: Math.max(0, budget - used),
    };
  }).filter((u) => u.budget > 0 || u.used > 0).sort((a, b) => b.used - a.used), [fProfiles]);

  const filteredUsers = useMemo(
    () => byUser.filter((u) => u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase())),
    [byUser, userSearch]
  );
  const topUsers = useMemo(() => byUser.slice(0, 10).map((u) => ({ ...u, short: u.name.length > 16 ? u.name.slice(0, 15) + "…" : u.name })), [byUser]);

  // ── คำขอ (จาก requests) ──────────────────────────────────────────────────────
  const byStatus = useMemo(() => {
    const m: Record<string, { count: number; amount: number }> = {};
    fRequests.forEach((r) => {
      const s = (r.status as string) || "-";
      if (!m[s]) m[s] = { count: 0, amount: 0 };
      m[s].count++; m[s].amount += num(r.amount);
    });
    return Object.entries(m).map(([status, v]) => ({ status, label: getStatusConfig(status).label, ...v })).sort((a, b) => b.count - a.count);
  }, [fRequests]);

  const paidTotal = useMemo(() => fRequests.filter((r) => r.status === "paid").reduce((s, r) => s + num(r.amount), 0), [fRequests]);

  const monthly = useMemo(() => {
    const m: Record<string, { key: string; count: number; amount: number }> = {};
    fRequests.forEach((r) => {
      const d = new Date(r.created_at as string);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!m[key]) m[key] = { key, count: 0, amount: 0 };
      m[key].count++; m[key].amount += num(r.amount);
    });
    return Object.values(m).sort((a, b) => a.key.localeCompare(b.key)).map((x) => ({
      ...x, label: new Date(x.key + "-01").toLocaleDateString("th-TH", { month: "short", year: "2-digit" }),
    }));
  }, [fRequests]);

  const byAff = useMemo(() => {
    const m: Record<string, { aff: string; users: number; budget: number; used: number; count: number; amount: number }> = {};
    fProfiles.forEach((u) => {
      const a = (u.affiliation as string) || "ไม่ระบุ";
      if (!m[a]) m[a] = { aff: a, users: 0, budget: 0, used: 0, count: 0, amount: 0 };
      m[a].users++;
      m[a].budget += num(u.budget_matching_fund) + num(u.budget_everysite);
      m[a].used += num(u.used_matching_fund) + num(u.used_everysite);
    });
    fRequests.forEach((r) => {
      const a = (r.affiliation as string) || "ไม่ระบุ";
      if (!m[a]) m[a] = { aff: a, users: 0, budget: 0, used: 0, count: 0, amount: 0 };
      m[a].count++; m[a].amount += num(r.amount);
    });
    return Object.values(m).sort((a, b) => b.used - a.used);
  }, [fProfiles, fRequests]);

  const byType = useMemo(() => {
    let mfC = 0, mfA = 0, esC = 0, esA = 0;
    fRequests.forEach((r) => { if (isMF(r.request_type)) { mfC++; mfA += num(r.amount); } else { esC++; esA += num(r.amount); } });
    return [
      { type: "Matching Fund", count: mfC, amount: mfA },
      { type: "Everysite", count: esC, amount: esA },
    ];
  }, [fRequests]);

  const resetFilters = () => { setDateRange("all"); setZoneFilter("all"); setAffFilter("all"); setTypeFilter("all"); };

  // ── Export Excel ─────────────────────────────────────────────────────────────
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { รายการ: "งบทั้งหมด", จำนวนเงิน: totals.budget }, { รายการ: "ใช้ไป", จำนวนเงิน: totals.used },
      { รายการ: "คงเหลือ", จำนวนเงิน: totals.remaining }, { รายการ: "กันไว้(pending)", จำนวนเงิน: totals.pending },
      { รายการ: "จ่ายจริงรวม", จำนวนเงิน: paidTotal },
    ]), "สรุป");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(byZone.map((z) => ({ โซน: z.label, ผู้ใช้: z.users, งบ: z.budget, ใช้ไป: z.used, คงเหลือ: z.remaining }))), "ราย Zone");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(byAff.map((a) => ({ สังกัด: a.aff, ผู้ใช้: a.users, งบ: a.budget, ใช้ไป: a.used, คำขอ: a.count, ยอดคำขอ: a.amount }))), "ราย สังกัด");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(byStatus.map((s) => ({ สถานะ: s.label, จำนวน: s.count, ยอดเงิน: s.amount }))), "ตามสถานะ");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monthly.map((m) => ({ เดือน: m.label, คำขอ: m.count, ยอดเงิน: m.amount }))), "รายเดือน");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(byUser.map((u) => ({ ชื่อ: u.name, อีเมล: u.email, โซน: u.zone, งบ: u.budget, ใช้ไป: u.used, คงเหลือ: u.remaining }))), "ราย User");
    XLSX.writeFile(wb, `everysite-budget-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (!canView) {
    return <AppLayout><div className="flex items-center justify-center h-64"><p className="text-muted-foreground">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-5 print:space-y-3">
        {/* header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Dashboard สรุปงบประมาณ</h1>
            <p className="text-muted-foreground">ภาพรวมงบใช้ไป/คงเหลือ · แนวโน้ม · ราย Zone/สังกัด/User</p>
          </div>
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" onClick={fetchData} disabled={loading}><RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />รีเฟรช</Button>
            <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
            <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />พิมพ์ / PDF</Button>
          </div>
        </div>

        {/* ── FILTER BAR ── */}
        <Card className="print:hidden">
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground mr-1"><Filter className="h-4 w-4" />ตัวกรอง</span>
              <FSelect value={dateRange} onChange={setDateRange} w="w-[130px]" items={[["all", "ทุกช่วงเวลา"], ["month", "เดือนนี้"], ["30d", "30 วัน"], ["90d", "90 วัน"], ["year", "ปีนี้"]]} />
              <FSelect value={zoneFilter} onChange={setZoneFilter} w="w-[120px]" items={[["all", "ทุกโซน"], ...Array.from({ length: 16 }, (_, i) => [String(i + 1), `โซน ${i + 1}`] as [string, string])]} />
              <FSelect value={affFilter} onChange={setAffFilter} w="w-[140px]" items={[["all", "ทุกสังกัด"], ...affiliations.map((a) => [a, a] as [string, string])]} />
              <FSelect value={typeFilter} onChange={setTypeFilter} w="w-[150px]" items={[["all", "ทุกประเภทงบ"], ["matching_fund", "Matching Fund"], ["everysite", "Everysite"]]} />
              {anyFilter && <Button variant="ghost" size="sm" onClick={resetFilters}>ล้างตัวกรอง</Button>}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">* ช่วงเวลา/ประเภทงบ มีผลกับส่วน "คำขอ" (สถานะ/แนวโน้ม/ยอดเงิน) · โซน/สังกัด มีผลทั้งงบและคำขอ</p>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* summary cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="งบทั้งหมด" icon={<Wallet className="h-4 w-4 text-muted-foreground" />} value={baht(totals.budget)} />
              <StatCard title="ใช้ไป" icon={<TrendingDown className="h-4 w-4 text-muted-foreground" />} value={baht(totals.used)} valueColor={C_USED} sub={`${pctUsed}% ของงบทั้งหมด`} />
              <StatCard title="คงเหลือ" icon={<PiggyBank className="h-4 w-4 text-muted-foreground" />} value={baht(totals.remaining)} valueClass="text-success" />
              <StatCard title="จ่ายจริงรวม" icon={<FileSpreadsheet className="h-4 w-4 text-muted-foreground" />} value={baht(paidTotal)} sub={`คำขอ "จ่ายแล้ว" (${fRequests.filter((r) => r.status === "paid").length})`} />
            </div>

            {/* usage + monthly trend */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-1">
                <CardHeader className="pb-3"><CardTitle className="text-base">การใช้งบรวม</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1"><span>ใช้ไป {pctUsed}%</span><span className="text-muted-foreground">{baht(totals.used)} / {baht(totals.budget)}</span></div>
                    <Progress value={pctUsed} className="h-3" />
                  </div>
                  <FundRow label="Matching Fund" used={totals.usedMF} budget={totals.budMF} />
                  <FundRow label="Everysite" used={totals.usedES} budget={totals.budES} />
                  {totals.pending > 0 && <p className="text-xs text-muted-foreground">กันไว้รออนุมัติ (pending): {baht(totals.pending)}</p>}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">แนวโน้มคำขอรายเดือน</CardTitle>
                  <div className="flex gap-1 print:hidden">
                    <Button size="sm" variant={trendMetric === "amount" ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={() => setTrendMetric("amount")}>ยอดเงิน</Button>
                    <Button size="sm" variant={trendMetric === "count" ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={() => setTrendMetric("count")}>จำนวน</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthly} margin={{ top: 10, right: 12, left: 4, bottom: 4 }}>
                        <defs><linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C_USED} stopOpacity={0.35} /><stop offset="100%" stopColor={C_USED} stopOpacity={0.03} /></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={C_GRID} vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: C_AXIS }} />
                        <YAxis tickFormatter={(v) => trendMetric === "amount" ? bahtShort(v) : String(v)} tick={{ fontSize: 11, fill: C_AXIS }} width={48} />
                        <Tooltip formatter={(v: number) => [trendMetric === "amount" ? baht(v) : `${v} คำขอ`, trendMetric === "amount" ? "ยอดเงิน" : "จำนวน"]} />
                        <Area type="monotone" dataKey={trendMetric} stroke={C_USED} strokeWidth={2} fill="url(#gArea)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* status: chart + amounts */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-base">คำขอตามสถานะ ({fRequests.length})</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={byStatus} margin={{ top: 16, right: 8, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C_GRID} vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: C_AXIS }} interval={0} angle={-20} textAnchor="end" height={60} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: C_AXIS }} />
                        <Tooltip cursor={{ fill: "rgba(42,120,214,0.08)" }} formatter={(v: number, _n, p) => [`${v} คำขอ · ${baht((p?.payload as { amount: number })?.amount || 0)}`, "จำนวน · ยอดเงิน"]} />
                        <Bar dataKey="count" fill={C_USED} radius={[4, 4, 0, 0]} maxBarSize={48}><LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: C_AXIS }} /></Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <Card className="lg:col-span-1">
                <CardHeader className="pb-2"><CardTitle className="text-base">ยอดเงินตามสถานะ</CardTitle></CardHeader>
                <CardContent className="pt-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>สถานะ</TableHead><TableHead className="text-right">จำนวน</TableHead><TableHead className="text-right">ยอดเงิน</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {byStatus.map((s) => (
                          <TableRow key={s.status}><TableCell className="py-1.5">{s.label}</TableCell><TableCell className="text-right py-1.5 tabular-nums">{s.count}</TableCell><TableCell className="text-right py-1.5 tabular-nums">{baht(s.amount)}</TableCell></TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* budget by zone */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">งบประมาณราย Zone (ใช้ไป vs คงเหลือ)</CardTitle></CardHeader>
              <CardContent>
                <div style={{ height: Math.max(240, byZone.length * 34) }}>
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
                <Legend />
              </CardContent>
            </Card>

            {/* affiliation + type + top users */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">สรุปตามสังกัด</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>สังกัด</TableHead><TableHead className="text-right">งบ</TableHead><TableHead className="text-right">ใช้ไป</TableHead><TableHead className="text-right">คำขอ</TableHead><TableHead className="text-right">ยอดคำขอ</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {byAff.map((a) => (
                          <TableRow key={a.aff}>
                            <TableCell className="font-medium">{a.aff}</TableCell>
                            <TableCell className="text-right tabular-nums">{baht(a.budget)}</TableCell>
                            <TableCell className="text-right tabular-nums" style={{ color: C_USED }}>{baht(a.used)}</TableCell>
                            <TableCell className="text-right tabular-nums">{a.count}</TableCell>
                            <TableCell className="text-right tabular-nums">{baht(a.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {/* fund type */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {byType.map((t, i) => (
                      <div key={t.type} className="rounded-lg border p-3">
                        <div className="flex items-center gap-2 text-sm font-medium"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: i === 0 ? C_USED : C_ALT }} />{t.type}</div>
                        <p className="text-lg font-bold mt-1">{baht(t.amount)}</p>
                        <p className="text-xs text-muted-foreground">{t.count} คำขอ</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Top 10 ผู้ใช้งบสูงสุด</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={topUsers} margin={{ top: 4, right: 24, left: 8, bottom: 4 }} barCategoryGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C_GRID} horizontal={false} />
                        <XAxis type="number" tickFormatter={bahtShort} tick={{ fontSize: 11, fill: C_AXIS }} />
                        <YAxis type="category" dataKey="short" width={110} tick={{ fontSize: 11, fill: C_AXIS }} />
                        <Tooltip cursor={{ fill: "rgba(42,120,214,0.06)" }} formatter={(v: number) => [baht(v), "ใช้ไป"]} />
                        <Bar dataKey="used" fill={C_USED} radius={[0, 4, 4, 0]} maxBarSize={22} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* per-zone table */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">สรุปราย Zone</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>โซน</TableHead><TableHead className="text-right">ผู้ใช้</TableHead><TableHead className="text-right">งบ</TableHead><TableHead className="text-right">ใช้ไป</TableHead><TableHead className="text-right">คงเหลือ</TableHead><TableHead className="text-right">% ใช้</TableHead></TableRow></TableHeader>
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
                    <TableHeader><TableRow><TableHead>ชื่อ</TableHead><TableHead>โซน</TableHead><TableHead className="text-right">งบ</TableHead><TableHead className="text-right">ใช้ไป</TableHead><TableHead className="text-right">คงเหลือ</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {filteredUsers.map((u) => (
                        <TableRow key={u.email}>
                          <TableCell><p className="font-medium">{u.name}</p><p className="text-xs text-muted-foreground">{u.email}</p></TableCell>
                          <TableCell>{u.zone === "-" ? "-" : `โซน ${u.zone}`}</TableCell>
                          <TableCell className="text-right tabular-nums">{baht(u.budget)}</TableCell>
                          <TableCell className="text-right tabular-nums" style={{ color: C_USED }}>{baht(u.used)}</TableCell>
                          <TableCell className="text-right tabular-nums text-success">{baht(u.remaining)}</TableCell>
                        </TableRow>
                      ))}
                      {filteredUsers.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">ไม่พบผู้ใช้</TableCell></TableRow>}
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

// ── ชิ้นส่วนย่อย ──────────────────────────────────────────────────────────────
function FSelect({ value, onChange, items, w }: { value: string; onChange: (v: string) => void; items: [string, string][]; w: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-9 ${w}`}><SelectValue /></SelectTrigger>
      <SelectContent className="max-h-72">{items.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function StatCard({ title, icon, value, sub, valueColor, valueClass }: { title: string; icon: React.ReactNode; value: string; sub?: string; valueColor?: string; valueClass?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>{icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueClass || ""}`} style={valueColor ? { color: valueColor } : undefined}>{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function FundRow({ label, used, budget }: { label: string; used: number; budget: number }) {
  const p = budget > 0 ? Math.round((used / budget) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1"><span className="text-muted-foreground">{label}</span><span className="tabular-nums">{baht(used)} / {baht(budget)}</span></div>
      <Progress value={p} className="h-2" />
    </div>
  );
}

function Legend() {
  return (
    <div className="flex gap-4 mt-2 text-xs text-muted-foreground justify-center">
      <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: C_USED }} />ใช้ไป</span>
      <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm border" style={{ background: C_REMAIN }} />คงเหลือ</span>
    </div>
  );
}
