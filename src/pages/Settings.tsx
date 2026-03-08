import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, Cloud, Shield, CheckCircle, FileSpreadsheet, MessageCircle } from "lucide-react";

export default function Settings() {
  const { profile } = useAuth();

  const canView = profile?.role === "admin";

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

        <Tabs defaultValue="integrations" className="space-y-6">
          <TabsList>
            <TabsTrigger value="integrations" className="gap-2"><Cloud className="h-4 w-4" />การเชื่อมต่อ</TabsTrigger>
            <TabsTrigger value="security" className="gap-2"><Shield className="h-4 w-4" />ความปลอดภัย</TabsTrigger>
          </TabsList>

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
