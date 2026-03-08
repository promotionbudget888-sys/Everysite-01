import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiPost } from "@/lib/api";
import { FileUp, X, Loader2, ArrowLeft, Send, Wallet, AlertTriangle, Download, Lock, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BudgetTransferDialog } from "@/components/BudgetTransferDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type RequestType = "matching_fund" | "everysite";

const REQUEST_FORM_VIEW_URL = "https://drive.google.com/file/d/1z2HPMUC_0fs1-dbwXTDcwGUOZygQYbqm/view?usp=sharing";

const formSchema = z.object({
  title: z.string().min(5, "ชื่อโครงการต้องมีอย่างน้อย 5 ตัวอักษร").max(200),
  description: z.string().min(10, "รายละเอียดต้องมีอย่างน้อย 10 ตัวอักษร").max(2000),
  request_type: z.enum(["matching_fund", "everysite"], { required_error: "กรุณาเลือกประเภทงบ" }),
  size: z.enum(["S", "M", "L"]).optional(),
  size_code: z.string().optional(),
  amount: z.string().min(1, "กรุณาระบุจำนวนเงิน").refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    "จำนวนเงินต้องมากกว่า 0"
  ),
}).refine((data) => {
  if (data.request_type === "everysite" && !data.size) return false;
  return true;
}, { message: "กรุณาเลือกไซส์สำหรับ Everysite", path: ["size"] })
.refine((data) => {
  if (data.request_type === "everysite" && data.size === "S") {
    // กรอกกี่ตัวก็ได้ แค่ต้องมีค่า
    const raw = (data.size_code || "").replace(/,/g, "");
    return raw.length > 0;
  }
  return true;
}, {
  message: "กรุณากรอกรหัสอย่างน้อย 1 ตัว",
  path: ["size_code"],
});

type FormData = z.infer<typeof formSchema>;

interface FileWithPreview {
  file: File;
  id: string;
  preview?: string;
}

interface BudgetInfo {
  matching_fund: { total: number; used: number; pending: number; remaining: number };
  everysite: { total: number; used: number; pending: number; remaining: number };
}

function formatMoney(val: number) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(val);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const CreateRequest = () => {
  const navigate = useNavigate();
  const { profile, updateProfile } = useAuth();
  const { toast } = useToast();

  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMFInfo, setShowMFInfo] = useState(false);
  const [pendingMFChange, setPendingMFChange] = useState<((val: string) => void) | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", description: "", request_type: undefined, size: undefined, size_code: "", amount: "" },
  });

  const selectedType = form.watch("request_type");
  const selectedSize = form.watch("size");
  const enteredAmount = Number(form.watch("amount")) || 0;

  const budget: BudgetInfo | null = profile ? {
    matching_fund: {
      total: profile.budget_matching_fund ?? 0,
      used: profile.used_matching_fund ?? 0,
      pending: profile.pending_matching_fund ?? 0,
      remaining: (profile.budget_matching_fund ?? 0) - (profile.used_matching_fund ?? 0) - (profile.pending_matching_fund ?? 0),
    },
    everysite: {
      total: profile.budget_everysite ?? 0,
      used: profile.used_everysite ?? 0,
      pending: profile.pending_everysite ?? 0,
      remaining: (profile.budget_everysite ?? 0) - (profile.used_everysite ?? 0) - (profile.pending_everysite ?? 0),
    },
  } : null;

  const currentBudget = selectedType && budget ? budget[selectedType] : null;
  const isOverBudget = currentBudget ? enteredAmount > currentBudget.remaining : false;
  const isBudgetDepleted = currentBudget ? currentBudget.remaining <= 0 : false;
  const allBudgetsDepleted = budget ? budget.matching_fund.remaining <= 0 && budget.everysite.remaining <= 0 : false;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;
    const newFiles: FileWithPreview[] = [];
    Array.from(selectedFiles).forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "ไฟล์ใหญ่เกินไป", description: `${file.name} มีขนาดเกิน 10MB`, variant: "destructive" });
        return;
      }
      const f: FileWithPreview = { file, id: crypto.randomUUID() };
      if (file.type.startsWith("image/")) f.preview = URL.createObjectURL(file);
      newFiles.push(f);
    });
    setFiles((prev) => [...prev, ...newFiles]);
    e.target.value = "";
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.preview) URL.revokeObjectURL(file.preview);
      return prev.filter((f) => f.id !== id);
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const onSubmit = async (data: FormData) => {
    if (!profile) {
      toast({ title: "ไม่พบข้อมูลผู้ใช้", variant: "destructive" });
      return;
    }

    if (files.length === 0) {
      toast({ title: "กรุณาแนบไฟล์", description: "ต้องแนบแบบฟอร์มที่กรอกแล้วเพื่อส่งคำขอ", variant: "destructive" });
      return;
    }

    const amount = Number(data.amount);
    if (currentBudget && amount > currentBudget.remaining) {
      toast({ title: "งบประมาณไม่เพียงพอ", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      let sizeCode: string | null = null;
      if (data.request_type === "everysite" && data.size === "S") {
        sizeCode = data.size_code?.trim().toUpperCase() || null;
      }

      const res = await apiPost({
        mode: "create",
        title: data.title.trim(),
        description: data.description.trim(),
        amount: Math.round(amount),
        request_type: data.request_type,
        size: data.request_type === "everysite" ? data.size : null,
        size_code: sizeCode,
        requester_id: Number(profile.id) || profile.id,
        requester_name: profile.full_name,
        requester_email: profile.email,
        department: profile.department,
        branch: profile.branch,
        affiliation: profile.affiliation,
        zone_id: profile.zone_id,
        status: "submitted",
      });

      if (!res.success) throw new Error(res.error || "ไม่สามารถสร้างคำขอได้");

      // กันงบทันที
      try {
        const pendingField = data.request_type === "matching_fund" ? "pending_matching_fund" : "pending_everysite";
        const currentPending = data.request_type === "matching_fund"
          ? (profile.pending_matching_fund ?? 0)
          : (profile.pending_everysite ?? 0);
        await supabase
          .from("profiles")
          .update({ [pendingField]: currentPending + Math.round(amount) })
          .eq("id", profile.id);
      } catch (e) {
        console.warn("Failed to update pending budget:", e);
      }

      const requestId = res.data?.id;
      let uploadedDriveUrl = "";

      // ✅ Upload files to Google Drive และเก็บ URL แรกที่ได้
      if (requestId && files.length > 0) {
        const zoneName = profile.zone_id ? `Zone-${profile.zone_id}` : "Unknown";
        for (const f of files) {
          try {
            const base64 = await fileToBase64(f.file);
            const uploadRes = await apiPost({
              mode: "upload_attachment",
              action: "upload_attachment",
              fileName: f.file.name,
              fileContent: base64,
              mimeType: f.file.type || "application/octet-stream",
              fileSize: f.file.size,
              zoneName,
              requestId,
            });
            // ✅ เก็บ folderUrl จาก response แรก
            if (!uploadedDriveUrl && uploadRes?.data?.folderUrl) {
              uploadedDriveUrl = uploadRes.data.folderUrl;
            }
          } catch (uploadErr) {
            console.error("File upload error:", uploadErr);
            toast({
              title: "อัปโหลดไฟล์ไม่สำเร็จ",
              description: `ไม่สามารถอัปโหลด ${f.file.name} ได้`,
              variant: "destructive",
            });
          }
        }

        // ✅ ส่ง LINE แจ้งเตือนครั้งเดียว หลังอัปโหลดเสร็จ (มี drive_url ถ้าอัปโหลดสำเร็จ)
        await apiPost({
          mode: "notify_line",
          type: "request_created",
          title: data.title.trim(),
          amount: Math.round(amount).toLocaleString(),
          requester_name: profile.full_name,
          zone_id: profile.zone_id || "-",
          department: profile.department || "-",
          affiliation: profile.affiliation || "-",
          drive_url: uploadedDriveUrl || "",
        });
      }

      toast({ title: "สร้างคำขอสำเร็จ", description: "คำขอของคุณถูกส่งเพื่อรอการตรวจสอบแล้ว" });
      navigate("/my-requests");
    } catch (error) {
      console.error("Error creating request:", error);
      toast({ title: "เกิดข้อผิดพลาด", description: error instanceof Error ? error.message : "ไม่สามารถสร้างคำขอได้", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/my-requests")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">สร้างคำขอใหม่</h1>
            <p className="text-muted-foreground">กรอกข้อมูลเพื่อขอใช้งบประมาณ</p>
          </div>
        </div>

        {allBudgetsDepleted && (
          <Alert variant="destructive">
            <Lock className="h-4 w-4" />
            <AlertTitle>งบประมาณหมดแล้ว</AlertTitle>
            <AlertDescription>งบประมาณทั้ง Matching Fund และ Everysite ของคุณหมดแล้ว ไม่สามารถสร้างคำขอใหม่ได้</AlertDescription>
          </Alert>
        )}

        {budget && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">งบประมาณ</h2>
              {budget.matching_fund.remaining > 0 && (
                <BudgetTransferDialog
                  profileId={Number(profile!.id) || profile!.id}
                  matchingFundRemaining={budget.matching_fund.remaining}
                  matchingFundTotal={budget.matching_fund.total}
                  everysiteTotal={budget.everysite.total}
                  onTransferComplete={(newMF, newES) => {
                    updateProfile({ budget_matching_fund: newMF, budget_everysite: newES });
                  }}
                />
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className={`${selectedType === "matching_fund" ? "ring-2 ring-primary" : ""} ${budget.matching_fund.remaining <= 0 ? "opacity-60" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Matching Fund</CardTitle>
                    {budget.matching_fund.remaining <= 0 ? <Lock className="h-4 w-4 text-destructive" /> : <Wallet className="h-4 w-4 text-primary" />}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">฿{formatMoney(budget.matching_fund.remaining)}</div>
                  <p className="text-xs text-muted-foreground">เบิกได้จาก ฿{formatMoney(budget.matching_fund.total)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs">ใช้แล้ว ฿{formatMoney(budget.matching_fund.used)}</Badge>
                    {budget.matching_fund.pending > 0 && (
                      <Badge variant="outline" className="text-xs text-warning border-warning/50">รอดำเนินการ ฿{formatMoney(budget.matching_fund.pending)}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className={`${selectedType === "everysite" ? "ring-2 ring-primary" : ""} ${budget.everysite.remaining <= 0 ? "opacity-60" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Everysite</CardTitle>
                    {budget.everysite.remaining <= 0 ? <Lock className="h-4 w-4 text-destructive" /> : <Wallet className="h-4 w-4 text-secondary" />}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">฿{formatMoney(budget.everysite.remaining)}</div>
                  <p className="text-xs text-muted-foreground">เบิกได้จาก ฿{formatMoney(budget.everysite.total)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs">ใช้แล้ว ฿{formatMoney(budget.everysite.used)}</Badge>
                    {budget.everysite.pending > 0 && (
                      <Badge variant="outline" className="text-xs text-warning border-warning/50">รอดำเนินการ ฿{formatMoney(budget.everysite.pending)}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>รายละเอียดคำขอ</CardTitle>
                <CardDescription>กรอกข้อมูลคำขอใช้งบประมาณของคุณ</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem><FormLabel>ชื่อโครงการ *</FormLabel><FormControl><Input placeholder="ใส่ชื่อโครงการ" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>รายละเอียดการแข่งขัน *</FormLabel><FormControl><Textarea placeholder="อธิบายรายละเอียดการแข่งขัน..." className="min-h-[120px]" {...field} /></FormControl><FormDescription>อธิบายรายละเอียดเกี่ยวกับการแข่งขัน</FormDescription><FormMessage /></FormItem>
                )} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField control={form.control} name="request_type" render={({ field }) => (
                    <FormItem><FormLabel>ประเภทงบ *</FormLabel>
                      <Select onValueChange={(val) => {
                        if (val === "matching_fund") {
                          setPendingMFChange(() => field.onChange);
                          setShowMFInfo(true);
                        } else {
                          field.onChange(val);
                        }
                      }} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="เลือกประเภทงบ" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="matching_fund" disabled={budget?.matching_fund.remaining! <= 0}>Matching Fund {budget?.matching_fund.remaining! <= 0 ? "(หมดงบ)" : ""}</SelectItem>
                          <SelectItem value="everysite" disabled={budget?.everysite.remaining! <= 0}>Everysite {budget?.everysite.remaining! <= 0 ? "(หมดงบ)" : ""}</SelectItem>
                        </SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                  {selectedType === "everysite" && (
                    <FormField control={form.control} name="size" render={({ field }) => (
                      <FormItem><FormLabel>ไซส์ *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="เลือกไซส์" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="S">S</SelectItem>
                            <SelectItem value="M">M</SelectItem>
                            <SelectItem value="L">L</SelectItem>
                          </SelectContent>
                        </Select><FormMessage />
                      </FormItem>
                    )} />
                  )}
                </div>
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem><FormLabel>จำนวนเงิน (บาท) *</FormLabel><FormControl><Input type="number" min="1" step="0.01" placeholder="0.00" {...field} /></FormControl>
                    {currentBudget && (
                      <FormDescription className={isOverBudget ? "text-destructive" : ""}>
                        {isOverBudget ? (
                          <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" />จำนวนเกินงบคงเหลือ ฿{formatMoney(currentBudget.remaining)}</span>
                        ) : `งบคงเหลือ: ฿${formatMoney(currentBudget.remaining)}`}
                      </FormDescription>
                    )}<FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            {/* ✅ ช่องกรอกรหัสไซส์ S */}
            {selectedType === "everysite" && selectedSize === "S" && (
              <Card className="border-primary/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    รหัสไซส์ S
                    <Badge variant="outline" className="text-xs">บังคับ</Badge>
                  </CardTitle>
                  <CardDescription>
                    กรอกรหัสตัวอักษรและตัวเลข ระบบจะใส่ , ให้อัตโนมัติทุก 6 ตัว เช่น A12121,121221,212121
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="size_code"
                    render={({ field }) => {
                      // แสดงจำนวนรหัสที่กรอกแล้ว
                      return (
                        <FormItem>
                          <FormLabel>รหัส *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="เช่น A12121,121221,212121"
                              value={field.value || ""}
                              onChange={(e) => {
                                let value = e.target.value;
                                value = value.replace(/[^A-Za-z0-9]/g, "");
                                value = value.toUpperCase();
                                // ✅ ใส่ , ทุก 6 ตัวอัตโนมัติ กรอกกี่ตัวก็ได้
                                const chunks = value.match(/.{1,6}/g);
                                const formatted = chunks ? chunks.join(",") : "";
                                field.onChange(formatted);
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            กรอกตัวอักษรหรือตัวเลขได้ไม่จำกัด ระบบจะใส่ , ให้อัตโนมัติทุก 6 ตัว
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                </CardContent>
              </Card>
            )}

            <Card className="border-primary/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">แนบไฟล์ <Badge variant="outline" className="text-xs">บังคับ</Badge></CardTitle>
                <CardDescription>ดาวน์โหลดแบบฟอร์ม กรอกข้อมูล แล้วแนบไฟล์ที่กรอกแล้ว - รองรับไฟล์ขนาดไม่เกิน 10MB</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Download className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">แบบฟอร์มเพื่อกรอกข้อมูล</p>
                    <p className="text-xs text-muted-foreground">กรอกข้อมูลให้ครบแล้วแนบไฟล์ด้านล่าง</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => window.open(REQUEST_FORM_VIEW_URL, "_blank")}>ดูเอกสาร</Button>
                </div>
                <div className="flex items-center justify-center w-full">
                  <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <FileUp className="w-8 h-8 mb-2 text-muted-foreground" />
                      <p className="mb-1 text-sm text-muted-foreground"><span className="font-semibold">คลิกเพื่อเลือกไฟล์</span> หรือลากไฟล์มาวาง</p>
                      <p className="text-xs text-muted-foreground">PDF, รูปภาพ, หรือเอกสาร (สูงสุด 10MB)</p>
                    </div>
                    <input id="file-upload" type="file" className="hidden" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={handleFileChange} />
                  </label>
                </div>
                {files.length > 0 && (
                  <div className="space-y-2">
                    <Label>ไฟล์ที่เลือก ({files.length})</Label>
                    <div className="space-y-2">
                      {files.map((fileItem) => (
                        <div key={fileItem.id} className="flex items-center gap-3 p-3 border rounded-lg bg-background">
                          {fileItem.preview ? (
                            <img src={fileItem.preview} alt={fileItem.file.name} className="w-10 h-10 object-cover rounded" />
                          ) : (
                            <div className="w-10 h-10 flex items-center justify-center bg-muted rounded"><FileUp className="w-5 h-5 text-muted-foreground" /></div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{fileItem.file.name}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(fileItem.file.size)}</p>
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeFile(fileItem.id)}><X className="h-4 w-4" /></Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => navigate("/my-requests")} disabled={isSubmitting}>ยกเลิก</Button>
              <Button type="submit" disabled={isSubmitting || isOverBudget || isBudgetDepleted || allBudgetsDepleted}>
                {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />กำลังส่ง...</>) : (<><Send className="mr-2 h-4 w-4" />ส่งคำขอ</>)}
              </Button>
            </div>
          </form>
        </Form>

        {/* Matching Fund Info Dialog */}
        <Dialog open={showMFInfo} onOpenChange={(open) => {
          if (!open) { setShowMFInfo(false); setPendingMFChange(null); }
        }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                ชี้แจงการเบิกงบ Matching Fund
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                งบประมาณในระบบนี้จะแสดง เฉพาะงบส่งเสริมของบริษัทเท่านั้นโดยผู้จัดการฝ่าย ต้องสมทบงบในจำนวนเท่ากัน (50%)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-primary">50%</p>
                    <p className="text-sm text-muted-foreground mt-1">งบส่งเสริม</p>
                  </CardContent>
                </Card>
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-primary">50%</p>
                    <p className="text-sm text-muted-foreground mt-1">งบของผู้จัดการฝ่าย</p>
                  </CardContent>
                </Card>
              </div>
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <p className="text-sm font-medium">ตัวอย่าง:</p>
                <p className="text-sm text-muted-foreground">หากต้องการใช้งบรวม <span className="font-semibold text-foreground">5,000 บาท</span></p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                  <li><span className="font-semibold text-foreground">2,500 บาท</span> (กรอกในระบบ)</li>
                  <li><span className="font-semibold text-foreground">2,500 บาท</span> เงินสมทบจากผู้จัดการฝ่าย</li>
                </ul>
              </div>
              <p className="text-sm text-muted-foreground">
                หมายเหตุ: ตัวเลขที่กรอกในหน้าคำขอเปิดโครงการ คือ เฉพาะงบส่งเสริมเท่านั้น ระบบจะไม่รวมงบสมทบของผู้จัดการฝ่าย
              </p>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => { setShowMFInfo(false); setPendingMFChange(null); }}>ย้อนกลับ</Button>
              <Button onClick={() => {
                if (pendingMFChange) pendingMFChange("matching_fund");
                setShowMFInfo(false);
                setPendingMFChange(null);
              }}>ยอมรับ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default CreateRequest;