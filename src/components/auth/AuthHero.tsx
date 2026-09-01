import { useEffect, useState } from 'react';
import { getLoginBanner } from '@/lib/branding';
import { ShieldCheck, TrendingUp, Sparkles } from 'lucide-react';

// แบนเนอร์แบรนด์ครึ่งซ้ายของหน้า Login/Register (Split-screen)
// ถ้าแอดมินอัปโหลดรูปไว้ จะแสดงรูปนั้นเต็มพื้นที่ ไม่งั้นใช้ดีไซน์ไล่เฉดน้ำเงินเริ่มต้น
export function AuthHero() {
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getLoginBanner().then((url) => { if (active) setBanner(url); });
    return () => { active = false; };
  }, []);

  return (
    <div className="relative hidden md:flex flex-col justify-between overflow-hidden bg-[#0a3f86] text-white p-10">
      {/* รูปแบนเนอร์ที่แอดมินอัปโหลด (ถ้ามี) */}
      {banner && (
        <img
          src={banner}
          alt="Brand banner"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* เลเยอร์ไล่เฉด + ลวดลาย ให้ตัวอักษรอ่านง่ายเสมอ */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0C4DA2] via-[#0a3f86] to-[#08336d]" style={{ opacity: banner ? 0.72 : 1 }} />
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{ backgroundImage: 'repeating-linear-gradient(115deg, #ffffff 0 1px, transparent 1px 22px)' }}
      />
      <div className="absolute -right-16 -bottom-16 h-64 w-64 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(225,35,26,0.45), transparent 70%)' }} />

      {/* เนื้อหา */}
      <div className="relative">
        <div className="inline-flex items-center justify-center rounded-2xl bg-white p-2 shadow-lg">
          <img src="/logo.png" alt="ไทยประกันชีวิต" className="h-14 w-14 object-contain" />
        </div>
        <h2 className="mt-6 text-3xl font-bold leading-tight">งบส่งเสริม</h2>
        <p className="mt-1 text-white/80">ระบบขอและอนุมัติงบส่งเสริมการขาย · Everysite Funds</p>
      </div>

      <ul className="relative space-y-4">
        <li className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15"><ShieldCheck className="h-5 w-5" /></span>
          <span className="text-sm text-white/90">ปลอดภัย ตรวจสอบสิทธิ์ทุกขั้นตอน</span>
        </li>
        <li className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15"><TrendingUp className="h-5 w-5" /></span>
          <span className="text-sm text-white/90">ติดตามงบและสถานะคำขอแบบเรียลไทม์</span>
        </li>
        <li className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15"><Sparkles className="h-5 w-5" /></span>
          <span className="text-sm text-white/90">อนุมัติไว แจ้งเตือนผ่าน LINE ทันที</span>
        </li>
      </ul>

      <div className="relative flex gap-1.5">
        <span className="h-1 w-6 rounded-full bg-white" />
        <span className="h-1 w-3 rounded-full bg-white/40" />
        <span className="h-1 w-3 rounded-full bg-white/40" />
      </div>
    </div>
  );
}
