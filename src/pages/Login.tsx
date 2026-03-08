import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { LogIn } from 'lucide-react';
import { apiPost } from '@/lib/api';
import { UserProfile } from '@/lib/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, loading: authLoading, login } = useAuth();

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
      const res = await apiPost<{
        token?: string;
        user?: UserProfile;
        error?: string;
      }>({
        mode: 'login',
        email: email.trim(),
        password: password.trim(),
      });

      if (!res.success || !res.data?.user || !res.data?.token) {
        toast({
          title: 'เข้าสู่ระบบไม่สำเร็จ',
          description:
            res.error || res.data?.error || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
          variant: 'destructive',
        });
        return;
      }

      const userProfile = res.data.user;

      if (userProfile.status === 'pending') {
        toast({
          title: 'บัญชีรออนุมัติ',
          description:
            'บัญชีของคุณยังรอการอนุมัติจากผู้ดูแลระบบ',
          variant: 'destructive',
        });
        return;
      }

      if (userProfile.status === 'rejected') {
        toast({
          title: 'บัญชีถูกปฏิเสธ',
          description:
            'บัญชีของคุณถูกปฏิเสธ กรุณาติดต่อผู้ดูแลระบบ',
          variant: 'destructive',
        });
        return;
      }

      login(userProfile, res.data.token);

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          {/* ✅ โลโก้จาก public */}
          <img
            src="/logo.png"
            alt="Logo"
            className="w-24 h-24 object-contain mx-auto mb-4 drop-shadow-lg"
          />

          <h1 className="text-2xl font-bold text-foreground">
            งบส่งเสริม
          </h1>
          <p className="text-muted-foreground mt-1">
            Everysite Funds
          </p>
        </div>

        <Card className="shadow-elegant border-0">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">
              เข้าสู่ระบบ
            </CardTitle>
            <CardDescription>
              กรอกอีเมลและรหัสผ่านเพื่อเข้าใช้งาน
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">อีเมล</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">รหัสผ่าน</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 gradient-primary"
                disabled={loading}
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    เข้าสู่ระบบ
                  </>
                )}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm">
              <span className="text-muted-foreground">
                ยังไม่มีบัญชี?{' '}
              </span>
              <Link
                to="/register"
                className="text-primary hover:underline font-medium"
              >
                สมัครสมาชิก
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}