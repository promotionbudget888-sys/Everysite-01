import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { LogIn, Mail, Lock } from 'lucide-react';
import { AuthHero } from '@/components/auth/AuthHero';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, loading: authLoading, signIn } = useAuth();

  useEffect(() => {
    if (!authLoading && profile) {
      const target =
        profile.role === 'admin'
          ? '/all-requests'
          : profile.role === 'zone_approver_1' || profile.role === 'zone_approver_2'
          ? '/pending-approvals'
          : '/my-requests';

      navigate(target, { replace: true });
    }
  }, [authLoading, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบ', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      const res = await signIn(email, password);

      if (!res.ok) {
        if (res.status === 'pending') {
          toast({
            title: 'บัญชีรออนุมัติ',
            description: 'บัญชีของคุณยังรอการอนุมัติจากผู้ดูแลระบบ',
            variant: 'destructive',
          });
        } else if (res.status === 'rejected') {
          toast({
            title: 'บัญชีถูกปฏิเสธ',
            description: 'บัญชีของคุณถูกปฏิเสธ กรุณาติดต่อผู้ดูแลระบบ',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'เข้าสู่ระบบไม่สำเร็จ',
            description: res.error || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
            variant: 'destructive',
          });
        }
        return;
      }

      // สำเร็จ — useEffect ด้านบนจะพาไปหน้าตาม role เมื่อ profile พร้อม
      toast({
        title: 'เข้าสู่ระบบสำเร็จ',
        description: 'ยินดีต้อนรับเข้าสู่ระบบงบส่งเสริม',
      });
    } catch {
      toast({
        title: 'เกิดข้อผิดพลาด',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-muted/40 md:grid md:grid-cols-2 lg:grid-cols-[1.05fr_1fr]">
      {/* ครึ่งซ้าย: แบนเนอร์แบรนด์ (ตั้งรูปได้จากหน้าตั้งค่า) */}
      <AuthHero />

      {/* ครึ่งขวา: ฟอร์มเข้าสู่ระบบ */}
      <div className="flex min-h-screen items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm animate-fade-in">
          {/* โลโก้ย่อ สำหรับจอมือถือที่ไม่มีแบนเนอร์ */}
          <div className="mb-8 flex flex-col items-center text-center md:hidden">
            <img src="/logo.png" alt="Logo" className="mb-3 h-16 w-16 object-contain drop-shadow" />
            <h1 className="text-xl font-bold">งบส่งเสริม</h1>
            <p className="text-sm text-muted-foreground">Everysite Funds</p>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight">เข้าสู่ระบบ</h2>
            <p className="mt-1 text-sm text-muted-foreground">กรอกอีเมลและรหัสผ่านเพื่อเข้าใช้งาน</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">อีเมล</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">รหัสผ่าน</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 pl-10"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="h-11 w-full gradient-primary text-base"
              disabled={loading}
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  เข้าสู่ระบบ
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">ยังไม่มีบัญชี? </span>
            <Link to="/register" className="font-medium text-primary hover:underline">
              สมัครสมาชิก
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}