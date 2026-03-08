import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { UserPlus } from 'lucide-react';
import { apiPost } from '@/lib/api';

interface ZoneOption {
  id: string;
  name: string;
}

const FALLBACK_ZONES: ZoneOption[] = Array.from({ length: 16 }, (_, i) => ({
  id: String(i + 1),
  name: `โซน ${i + 1}`,
}));

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
  const [loading, setLoading] = useState(false);
  const [zones, setZones] = useState<ZoneOption[]>([]);

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
      try {
        const res = await apiPost<unknown>({ mode: 'zones' });
        const zoneList = normalizeZones(res.data);
        setZones(zoneList.length > 0 ? zoneList : FALLBACK_ZONES);
      } catch {
        setZones(FALLBACK_ZONES);
      }
    };

    fetchZones();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      toast({ title: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบ', variant: 'destructive' });
      return;
    }

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
      });

      if (!res.success || res.data?.error) {
        toast({
          title: 'สมัครสมาชิกไม่สำเร็จ',
          description: res.error || res.data?.error || 'กรุณาลองใหม่อีกครั้ง',
          variant: 'destructive',
        });
        return;
      }

      const zoneName = zones.find(z => z.id === zoneId)?.name || '-';

      apiPost({
        mode: 'notify_line',
        type: 'new_registration',
        title: '📋 สมัครสมาชิกใหม่',
        user_name: fullName,
        user_email: email.trim(),
        affiliation: affiliation || '-',
        zone: zoneName,
        department: department.trim() || '-',
        branch: branch.trim() || '-',
        phone: phone.trim() || '-',
      }).catch(() => {});

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">

          {/* ✅ เพิ่มโลโก้จาก public/logo.png เท่านั้น */}
          <img
            src="/logo.png"
            alt="Logo"
            className="w-24 h-24 object-contain mx-auto mb-4 drop-shadow-lg"
          />

          <h1 className="text-2xl font-bold text-foreground">งบส่งเสริม</h1>
          <p className="text-muted-foreground mt-1">Everysite Funds</p>
        </div>

        <Card className="shadow-elegant border-0">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">สมัครสมาชิก</CardTitle>
            <CardDescription>กรอกข้อมูลเพื่อสร้างบัญชีผู้ใช้งาน</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* ฟอร์มทั้งหมดเหมือนเดิม ไม่แตะ */}

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
                <Input id="email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11" />
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
                <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
                <Input id="phone" type="tel" placeholder="0812345678" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11" />
              </div>

              <div className="space-y-2">
                <Label>สังกัดฝ่าย</Label>
                <Select value={affiliation} onValueChange={setAffiliation}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="เลือกสังกัดฝ่าย" />
                  </SelectTrigger>
                  <SelectContent className="z-[200] bg-popover">
                    <SelectItem value="นครหลวง">นครหลวง</SelectItem>
                    <SelectItem value="ภูมิภาค">ภูมิภาค</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>โซน</Label>
                <Select value={zoneId} onValueChange={setZoneId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="เลือกโซน (1-16)" />
                  </SelectTrigger>
                  <SelectContent className="z-[200] bg-popover">
                    {zones.map((z) => (
                      <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">ฝ่ายที่</Label>
                <Input id="department" placeholder="ฝ่ายที่" value={department} onChange={(e) => setDepartment(e.target.value)} className="h-11" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="branch">สาขา</Label>
                <Input id="branch" placeholder="สาขา" value={branch} onChange={(e) => setBranch(e.target.value)} className="h-11" />
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

            <div className="mt-4 text-center text-sm">
              <span className="text-muted-foreground">มีบัญชีแล้ว? </span>
              <Link to="/login" className="text-primary hover:underline font-medium">
                เข้าสู่ระบบ
              </Link>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}