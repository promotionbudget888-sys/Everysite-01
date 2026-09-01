import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, Cloud, Shield, CheckCircle, FileSpreadsheet, MessageCircle, Image as ImageIcon, Upload, Trash2, Crown } from "lucide-react";
import { getLoginBanner, setLoginBanner, clearLoginBanner } from "@/lib/branding";

export default function Settings() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const canView = profile?.role === "admin";

  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getLoginBanner().then(setBanner);
  }, []);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "ไฟล์ไม่ถูกต้อง", description: "กรุณาเลือกไฟล์รูปภาพ", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "ไฟล์ใหญ่เกินไป", description: "ขนาดต้องไม่เกิน 5MB", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { url } = await setLoginBanner(file);
      setBanner(url);
      toast({ title: "อัปโหลดแบนเนอร์สำเร็จ", description: "หน้าล็อกอินจะใช้รูปนี้ทันที" });
    } catch (err) {
      toast({ title: "อัปโหลดไม่สำเร็จ", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const onClear = async () => {
    setBusy(true);
    try {
      await clearLoginBanner();
      setBanner(null);
      toast({ title: "ลบแบนเนอร์แล้ว", description: "กลับไปใช้ดีไซน์เริ่มต้น" });
    } catch (err) {
      toast({ title: "ลบไม่สำเร็จ", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (!canView) {
    return <AppLayout><div className="flex items-center justify-center h-64"><p className="text-muted-foreground">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p></div></AppLayout>;
  }

  return (
    <AppLayout>
      <section className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><SettingsIcon className="h-6 w-6" />ตั้งค่าระบบ</h1>
          <p className="text-muted-foreground">จัดการการเชื่อมต่อและการตั้งค่าต่างๆ ของระบบ</p>
        </header>

        <Tabs defaultValue="branding" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="branding" className="gap-2"><ImageIcon className="h-4 w-4" />แบรนด์</TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2"><Cloud className="h-4 w-4" />การเชื่อมต่อ</TabsTrigger>
            <TabsTrigger value="security" className="gap-2"><Shield className="h-4 w-4" />ความปลอดภัย</TabsTrigger>
          </TabsList>

          {/* แบรนด์: อัปโหลดแบนเนอร์หน้าล็อกอิน */}
          <TabsContent value="branding" className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 text-amber-600"><Crown className="h-5 w-5" /></div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">แบนเนอร์หน้าล็อกอิน / สมัครสมาชิก</CardTitle>
                    <CardDescription>อัปโหลดรูปที่จะแสดงบนแถบแบรนด์ (ครึ่งซ้าย) ของหน้าเข้าสู่ระบบ</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* ตัวอย่างแบนเนอร์ปัจจุบัน */}
                <div className="relative aspect-[16/9] w-full max-w-md overflow-hidden rounded-xl border bg-[#0a3f86]">
                  {banner ? (
                    <img src={banner} alt="แบนเนอร์ปัจจุบัน" className="h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white"
                      style={{ background: 'linear-gradient(135deg,#0C4DA2,#08336d)' }}>
                      <ImageIcon className="h-8 w-8 opacity-70" />
                      <p className="mt-2 text-sm opacity-80">ยังไม่มีรูป — ใช้ดีไซน์เริ่มต้น</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
                  <Button onClick={() => fileRef.current?.click()} disabled={busy} className="gap-2">
                    <Upload className="h-4 w-4" />{banner ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
                  </Button>
                  {banner && (
                    <Button variant="outline" onClick={onClear} disabled={busy} className="gap-2 text-destructive border-destructive/40 hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />ลบรูป
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">รองรับ JPG / PNG / WEBP ขนาดไม่เกิน 5MB · แนะนำแนวตั้งหรือสี่เหลี่ยม ระบบจะครอบให้พอดีอัตโนมัติ (มีเลเยอร์ไล่สีทับให้ตัวอักษรอ่านง่ายเสมอ)</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted"><FileSpreadsheet className="h-5 w-5 text-muted-foreground" /></div>
                    <div>
                      <CardTitle className="text-base">Google Apps Script + Sheets</CardTitle>
                      <CardDescription>Backend ทั้งหมดใช้ Google Apps Script + Google Sheets + Google Drive</CardDescription>
                    </div>
                  </div>
                  <Badge className="bg-success/10 text-success border-success/30"><CheckCircle className="h-3 w-3 mr-1" />เชื่อมต่อแล้ว</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  ระบบใช้ Google Apps Script เป็น backend สำหรับจัดเก็บข้อมูลทั้งหมดใน Google Sheets และไฟล์ใน Google Drive
                  <br />
                  ตั้งค่า URL ผ่าน environment variable: <code className="bg-muted px-1 py-0.5 rounded">VITE_GOOGLE_SCRIPT_URL</code>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted"><MessageCircle className="h-5 w-5 text-muted-foreground" /></div>
                    <div>
                      <CardTitle className="text-base">LINE Notification</CardTitle>
                      <CardDescription>แจ้งเตือนผ่าน LINE เมื่อมีการสร้าง/อนุมัติ/ปฏิเสธคำขอ</CardDescription>
                    </div>
                  </div>
                  <Badge className="bg-success/10 text-success border-success/30"><CheckCircle className="h-3 w-3 mr-1" />เชื่อมต่อแล้ว</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  การแจ้งเตือน LINE จัดการผ่าน Google Apps Script โดยใช้ LINE Notify API
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />การตั้งค่าความปลอดภัย</CardTitle>
                <CardDescription>ข้อมูลความปลอดภัยของระบบ</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 border rounded-lg space-y-2">
                    <h4 className="font-medium flex items-center gap-2"><CheckCircle className="h-4 w-4 text-success" />Token-Based Authentication</h4>
                    <p className="text-sm text-muted-foreground">ระบบใช้ Token Authentication ที่ตรวจสอบผ่าน Google Apps Script</p>
                  </div>
                  <div className="p-4 border rounded-lg space-y-2">
                    <h4 className="font-medium flex items-center gap-2"><CheckCircle className="h-4 w-4 text-success" />Google Sheets + Drive Backend</h4>
                    <p className="text-sm text-muted-foreground">ข้อมูลจัดเก็บใน Google Sheets, ไฟล์ใน Google Drive</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>
    </AppLayout>
  );
}
