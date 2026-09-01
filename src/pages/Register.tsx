import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { UserPlus } from 'lucide-react';
import { AuthHero } from '@/components/auth/AuthHero';
import { apiPost } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';

interface ZoneOption {
  id: string;
  name: string;
}

const FALLBACK_ZONES: ZoneOption[] = Array.from({ length: 16 }, (_, i) => ({
  id: String(i + 1),
  name: `โซน ${i + 1}`,
}));

// ── ตัวกรองอินพุต ──────────────────────────────────────────────
// อีเมล: อังกฤษ/ตัวเลข/สัญลักษณ์เท่านั้น (ตัดภาษาไทย/ช่องว่าง/อักขระนอก ASCII)
const sanitizeEmail = (v: string) => v.replace(/[^\x21-\x7E]/g, '');
// เบอร์โทร: ตัวเลขล้วน สูงสุด 10 หลัก
const sanitizePhone = (v: string) => v.replace(/\D/g, '').slice(0, 10);
// ฝ่ายที่: ตัวเลขล้วน
const sanitizeDigits = (v: string) => v.replace(/\D/g, '');
// สาขา: ภาษาไทย + ช่องว่างเท่านั้น
const sanitizeThai = (v: string) => v.replace(/[^฀-๿\s]/g, '');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [department, setDepartment] = useState('');
  const [branch, setBranch] = useState('');
  const [phone, setPhone] = useState('');
  const [lineId, setLineId] = useState('');
  const [loading, setLoading] = useState(false);
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [zonesLoading, setZonesLoading] = useState(true);

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const normalizeZones = (raw: unknown): ZoneOption[] => {
      if (!Array.isArray(raw)) return [];
      return raw
        .map((item, index) => {
          const zone = item as Record<string, unknown>;
          const id = String(zone.id ?? zone.zone_id ?? index + 1);
          const name = String(zone.name ?? zone.zone_name ?? zone.label ?? `โซน ${id}`);
          return { id, name };
        })
        .filter((zone) => zone.id && zone.name);
    };

    const fetchZones = async () => {
      setZonesLoading(true);
      try {
        const { data } = await supabase
          .from('zones_public')
          .select('id, name, sort_order')
          .order('sort_order', { ascending: true });
        const zoneList = normalizeZones(data);
        setZones(zoneList.length > 0 ? zoneList : FALLBACK_ZONES);
      } catch {
        setZones(FALLBACK_ZONES);
      } finally {
        setZonesLoading(false);
      }
    };

    fetchZones();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim()) { toast({ title: 'กรุณากรอกชื่อ', variant: 'destructive' }); return; }
    if (!lastName.trim())  { toast({ title: 'กรุณากรอกนามสกุล', variant: 'destructive' }); return; }
    if (!email.trim())     { toast({ title: 'กรุณากรอกอีเมล', variant: 'destructive' }); return; }
    if (!EMAIL_RE.test(email.trim())) { toast({ title: 'อีเมลไม่ถูกต้อง', description: 'กรอกเป็นภาษาอังกฤษ ตัวเลข และสัญลักษณ์ เช่น name@email.com', variant: 'destructive' }); return; }
    if (!password.trim())  { toast({ title: 'กรุณากรอกรหัสผ่าน', variant: 'destructive' }); return; }
    if (!/^\d{10}$/.test(phone)) { toast({ title: 'เบอร์โทรไม่ถูกต้อง', description: 'ต้องเป็นตัวเลข 10 หลัก', variant: 'destructive' }); return; }
    if (!affiliation)      { toast({ title: 'กรุณาเลือกสายการตลาด', variant: 'destructive' }); return; }
    if (!zoneId)           { toast({ title: 'กรุณาเลือกโซน', variant: 'destructive' }); return; }
    if (!/^\d+$/.test(department.trim())) { toast({ title: 'ฝ่ายที่ต้องเป็นตัวเลข', variant: 'destructive' }); return; }
    if (!branch.trim())    { toast({ title: 'กรุณากรอกสาขา (ภาษาไทย)', variant: 'destructive' }); return; }

    if (password !== confirmPassword) {
      toast({ title: 'รหัสผ่านไม่ตรงกัน', variant: 'destructive' });
      return;
    }

    if (password.length < 6) {
      toast({ title: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;

      // 1) สร้าง user ใน Supabase Auth (trigger handle_new_user จะสร้าง profile รออนุมัติ)
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: {
            full_name: fullName,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            zone_id: zoneId || null,
            affiliation: affiliation || null,
            department: department.trim() || null,
            branch: branch.trim() || null,
            phone: phone.trim() || null,
            line_id: lineId.trim() || null,
          },
        },
      });
      if (signUpError) {
        const dup = /already registered|already been registered|exists/i.test(signUpError.message);
        toast({
          title: 'สมัครสมาชิกไม่สำเร็จ',
          description: dup ? 'อีเมลนี้ถูกใช้แล้ว' : signUpError.message,
          variant: 'destructive',
        });
        return;
      }
      // 2) mirror ไป Google Sheet + ส่ง LINE (ผ่าน GAS proxy) — ต้องยิงก่อน signOut
      //    เพราะ proxy ต้องมี session ที่ล็อกอินอยู่ (best-effort: ล้มก็ยังสมัครสำเร็จ)
      const res = await apiPost({
        mode: 'user_registered',
        user_name: fullName,
        user_email: email.trim(),
        full_name: fullName,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        password: password.trim(),
        zone_id: zoneId || null,
        zone: zoneId || null,
        affiliation: affiliation || null,
        department: department.trim() || null,
        branch: branch.trim() || null,
        phone: phone.trim() || null,
        line_id: lineId.trim() || null,
      });
      if (!res.success) console.warn('Sheet mirror (user_registered) failed:', res.error);

      // pending อยู่แล้ว — ออกจาก session ที่ signUp สร้างไว้
      await supabase.auth.signOut();

      toast({
        title: 'สมัครสมาชิกสำเร็จ',
        description: 'บัญชีของคุณรอการอนุมัติจากผู้ดูแลระบบ',
      });

      navigate('/login');
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-muted/40 md:grid md:grid-cols-2 lg:grid-cols-[1fr_1.05fr]">
      {/* ครึ่งซ้าย: แบนเนอร์แบรนด์ */}
      <AuthHero />

      {/* ครึ่งขวา: ฟอร์มสมัครสมาชิก */}
      <div className="flex min-h-screen items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md animate-fade-in py-8">
          <div className="mb-6 flex flex-col items-center text-center md:hidden">
            <img src="/logo.png" alt="Logo" className="mb-3 h-16 w-16 object-contain drop-shadow" />
            <h1 className="text-xl font-bold">งบส่งเสริม</h1>
            <p className="text-sm text-muted-foreground">Everysite Funds</p>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight">สมัครสมาชิก</h2>
            <p className="mt-1 text-sm text-muted-foreground">กรอกข้อมูลเพื่อสร้างบัญชีผู้ใช้งาน</p>
          </div>

            <form onSubmit={handleSubmit} className="space-y-4">

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">ชื่อ *</Label>
                  <Input id="firstName" placeholder="ชื่อ" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">นามสกุล *</Label>
                  <Input id="lastName" placeholder="นามสกุล" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="h-11" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">อีเมล *</Label>
                <Input id="email" type="email" inputMode="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(sanitizeEmail(e.target.value))} required className="h-11" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">รหัสผ่าน *</Label>
                  <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">ยืนยันรหัสผ่าน *</Label>
                  <Input id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="h-11" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">เบอร์โทรศัพท์ *</Label>
                <Input id="phone" type="tel" inputMode="numeric" maxLength={10} placeholder="0812345678" value={phone} onChange={(e) => setPhone(sanitizePhone(e.target.value))} className="h-11" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="line_id">LINE ID (ถ้ามี)</Label>
                <Input id="line_id" type="text" placeholder="เช่น @mylineid" value={lineId} onChange={(e) => setLineId(e.target.value)} className="h-11" />
              </div>

              <div className="space-y-2">
                <Label>สายการตลาด *</Label>
                <Select value={affiliation} onValueChange={setAffiliation}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="เลือกสายการตลาด" />
                  </SelectTrigger>
                  <SelectContent className="z-[9999] bg-popover" position="popper" sideOffset={4}>
                    <SelectItem value="นครหลวง">นครหลวง</SelectItem>
                    <SelectItem value="ภูมิภาค">ภูมิภาค</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>โซน *</Label>
                <Select value={zoneId} onValueChange={setZoneId}>
                  <SelectTrigger className="h-11" disabled={zonesLoading}>
                    <SelectValue placeholder={zonesLoading ? "กำลังโหลดโซน..." : "เลือกโซน (1-16)"} />
                  </SelectTrigger>
                  <SelectContent className="z-[9999] bg-popover" position="popper" sideOffset={4}>
                    {zonesLoading ? (
                      <div className="flex items-center justify-center py-4 gap-2 text-sm text-muted-foreground">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                        กำลังโหลดโซน...
                      </div>
                    ) : zones.filter((z) => z.id !== "6").map((z) => (
                      <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">ฝ่ายที่ *</Label>
                <Input id="department" inputMode="numeric" placeholder="ฝ่ายที่ (ตัวเลข)" value={department} onChange={(e) => setDepartment(sanitizeDigits(e.target.value))} className="h-11" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="branch">สาขา *</Label>
                <Input id="branch" lang="th" placeholder="สาขา (ภาษาไทย)" value={branch} onChange={(e) => setBranch(sanitizeThai(e.target.value))} className="h-11" />
              </div>

              <Button type="submit" className="w-full h-11 gradient-primary" disabled={loading}>
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    สมัครสมาชิก
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">มีบัญชีแล้ว? </span>
              <Link to="/login" className="text-primary hover:underline font-medium">
                เข้าสู่ระบบ
              </Link>
            </div>
        </div>
      </div>
    </div>
  );
}
