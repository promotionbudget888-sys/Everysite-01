import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { useToast } from "@/hooks/use-toast";
import { apiPost } from "@/lib/api";
import { FileUp, X, Loader2, ArrowLeft, Send, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type RequestType = "matching_fund" | "everysite";

const formSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(2000),
  request_type: z.enum(["matching_fund", "everysite"], { required_error: "กรุณาเลือกประเภทงบ" }),
  size: z.enum(["S", "M", "L"]).optional(),
  amount: z.string().min(1).refine((val) => !isNaN(Number(val)) && Number(val) > 0, "จำนวนเงินต้องมากกว่า 0"),
}).refine((data) => !(data.request_type === "everysite" && !data.size), { message: "กรุณาเลือกไซส์", path: ["size"] });

type FormData = z.infer<typeof formSchema>;

interface FileWithPreview {
  file: File;
  id: string;
  preview?: string;
}

interface ExistingFile {
  id: string;
  file_name: string;
  file_url: string;
  file_size?: number;
}

function formatMoney(val: number) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(val);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
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

export default function EditRequest() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [originalRequest, setOriginalRequest] = useState<any>(null);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [existingFiles, setExistingFiles] = useState<ExistingFile[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", description: "", request_type: undefined, size: undefined, amount: "" },
  });

  const selectedType = form.watch("request_type");
  const enteredAmount = Number(form.watch("amount")) || 0;

  const budget = profile ? {
    matching_fund: { remaining: (profile.budget_matching_fund ?? 0) - (profile.used_matching_fund ?? 0) - (profile.pending_matching_fund ?? 0) },
    everysite: { remaining: (profile.budget_everysite ?? 0) - (profile.used_everysite ?? 0) - (profile.pending_everysite ?? 0) },
  } : null;

  const currentBudget = selectedType && budget ? budget[selectedType] : null;
  const isOverBudget = currentBudget ? enteredAmount > currentBudget.remaining : false;

  useEffect(() => {
    if (!id || !profile) return;
    const fetchRequest = async () => {
      setLoadingRequest(true);
      const res = await apiPost({ mode: "get", id });
      if (!res.success || !res.data) {
        toast({ title: "ไม่พบคำขอ", variant: "destructive" });
        navigate("/my-requests");
        return;
      }
      const request = res.data;
      setOriginalRequest(request);
      form.reset({
        title: request.title,
        description: request.description || "",
        request_type: request.request_type as RequestType | undefined,
        size: request.size || undefined,
        amount: String(request.amount),
      });

      // Load existing attachments
      if (request.attachments && Array.isArray(request.attachments)) {
        setExistingFiles(request.attachments.map((a: any) => ({
          id: a.id || a.fileId || crypto.randomUUID(),
          file_name: a.file_name || a.fileName || "ไฟล์แนบ",
          file_url: a.file_url || a.fileUrl || "",
          file_size: a.file_size || a.fileSize || 0,
        })));
      }

      setLoadingRequest(false);
    };
    fetchRequest();
  }, [id, profile]);

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

  const removeFile = (fileId: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === fileId);
      if (file?.preview) URL.revokeObjectURL(file.preview);
      return prev.filter((f) => f.id !== fileId);
    });
  };

  const removeExistingFile = (fileId: string) => {
    setExistingFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const onSubmit = async (data: FormData) => {
    if (!profile || !originalRequest) return;

    if (files.length === 0 && existingFiles.length === 0) {
      toast({ title: "กรุณาแนบไฟล์", description: "ต้องแนบไฟล์อย่างน้อย 1 ไฟล์", variant: "destructive" });
      return;
    }

    const amount = Number(data.amount);
    setIsSubmitting(true);
    try {
      const res = await apiPost({
        mode: "update",
        id: originalRequest.id,
        title: data.title.trim(),
        description: data.description.trim(),
        amount: Math.round(amount),
        request_type: data.request_type,
        size: data.request_type === "everysite" ? data.size : null,
        status: "submitted",
      });
      if (!res.success) throw new Error(res.error);

      // กันงบส่วนต่าง — อัปเดต pending ถ้าจำนวนเงินเปลี่ยน
      const oldAmount = Number(originalRequest.amount) || 0;
      const amountDiff = Math.round(amount) - Math.round(oldAmount);
      if (amountDiff !== 0) {
        try {
          const reqType = data.request_type || originalRequest.request_type;
          const pendingField = reqType === "matching_fund" ? "pending_matching_fund" : "pending_everysite";
          const currentPending = reqType === "matching_fund"
            ? (profile.pending_matching_fund ?? 0)
            : (profile.pending_everysite ?? 0);
          await supabase
            .from("profiles")
            .update({ [pendingField]: Math.max(0, currentPending + amountDiff) })
            .eq("id", profile.id);
        } catch (e) {
          console.warn("Failed to update pending budget:", e);
        }
      }

      // Upload new files to Google Drive
      if (files.length > 0) {
        const zoneName = profile.zone_id ? `Zone-${profile.zone_id}` : "Unknown";
        for (const f of files) {
          try {
            const base64 = await fileToBase64(f.file);
            await apiPost({
              mode: "upload_attachment",
              action: "upload_attachment",
              fileName: f.file.name,
              fileContent: base64,
              mimeType: f.file.type || "application/octet-stream",
              fileSize: f.file.size,
              zoneName,
              requestId: originalRequest.id,
            });
          } catch (uploadErr) {
            console.error("File upload error:", uploadErr);
            toast({
              title: "อัปโหลดไฟล์ไม่สำเร็จ",
              description: `ไม่สามารถอัปโหลด ${f.file.name} ได้`,
              variant: "destructive",
            });
          }
        }
      }

      toast({ title: "แก้ไขและส่งคำขอสำเร็จ" });
      navigate("/my-requests");
    } catch (error) {
      toast({ title: "เกิดข้อผิดพลาด", description: error instanceof Error ? error.message : "ไม่สามารถแก้ไขคำขอได้", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || loadingRequest) {
    return <AppLayout><div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/my-requests")}><ArrowLeft className="h-5 w-5" /></Button>
          <div><h1 className="text-2xl font-bold">แก้ไขคำขอ</h1><p className="text-muted-foreground">แก้ไขข้อมูลและส่งคำขอใหม่อีกครั้ง</p></div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ข้อมูลคำขอ</CardTitle>
            <CardDescription>กรอกข้อมูลให้ครบถ้วนเพื่อส่งคำขอใช้งบประมาณ</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField control={form.control} name="request_type" render={({ field }) => (
                  <FormItem><FormLabel>ประเภทงบประมาณ *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="เลือกประเภทงบ" /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="matching_fund">Matching Fund</SelectItem><SelectItem value="everysite">Everysite</SelectItem></SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                {selectedType === "everysite" && (
                  <FormField control={form.control} name="size" render={({ field }) => (
                    <FormItem><FormLabel>ไซส์ *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="เลือกไซส์" /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="S">Size S</SelectItem><SelectItem value="M">Size M</SelectItem><SelectItem value="L">Size L</SelectItem></SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                )}
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem><FormLabel>ชื่อโครงการ *</FormLabel><FormControl><Input placeholder="ระบุชื่อโครงการ" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>รายละเอียด *</FormLabel><FormControl><Textarea placeholder="อธิบายรายละเอียด" className="min-h-[120px]" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem><FormLabel>จำนวนเงิน (บาท) *</FormLabel><FormControl><Input type="number" min="1" placeholder="ระบุจำนวนเงิน" {...field} /></FormControl>
                    {isOverBudget && <div className="flex items-center gap-2 text-destructive text-sm"><AlertTriangle className="h-4 w-4" /><span>จำนวนเงินเกินงบคงเหลือ</span></div>}
                    <FormMessage />
                  </FormItem>
                )} />

                {/* File attachment section */}
                <Card className="border-primary/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">แนบไฟล์ <Badge variant="outline" className="text-xs">บังคับ</Badge></CardTitle>
                    <CardDescription>เพิ่มหรือเปลี่ยนไฟล์แนบ - รองรับไฟล์ขนาดไม่เกิน 10MB</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Existing files */}
                    {existingFiles.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">ไฟล์เดิม ({existingFiles.length})</Label>
                        {existingFiles.map((ef) => (
                          <div key={ef.id} className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                            <div className="w-10 h-10 flex items-center justify-center bg-muted rounded"><FileUp className="w-5 h-5 text-muted-foreground" /></div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{ef.file_name}</p>
                              {ef.file_size ? <p className="text-xs text-muted-foreground">{formatFileSize(ef.file_size)}</p> : null}
                            </div>
                            {ef.file_url && (
                              <Button type="button" variant="ghost" size="sm" onClick={() => window.open(ef.file_url, "_blank")}>ดู</Button>
                            )}
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeExistingFile(ef.id)}><X className="h-4 w-4" /></Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Upload new files */}
                    <div className="flex items-center justify-center w-full">
                      <label htmlFor="edit-file-upload" className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted transition-colors">
                        <div className="flex flex-col items-center justify-center py-4">
                          <FileUp className="w-7 h-7 mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground"><span className="font-semibold">คลิกเพื่อเลือกไฟล์</span> หรือลากไฟล์มาวาง</p>
                          <p className="text-xs text-muted-foreground">PDF, รูปภาพ, หรือเอกสาร (สูงสุด 10MB)</p>
                        </div>
                        <input id="edit-file-upload" type="file" className="hidden" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={handleFileChange} />
                      </label>
                    </div>

                    {/* New files list */}
                    {files.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm">ไฟล์ใหม่ ({files.length})</Label>
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
                    )}
                  </CardContent>
                </Card>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => navigate("/my-requests")} disabled={isSubmitting}>ยกเลิก</Button>
                  <Button type="submit" disabled={isSubmitting || isOverBudget} className="flex-1">
                    {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />กำลังบันทึก...</>) : (<><Send className="mr-2 h-4 w-4" />บันทึกและส่งคำขอ</>)}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
