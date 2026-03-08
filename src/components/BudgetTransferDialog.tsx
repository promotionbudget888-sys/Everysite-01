import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiPost } from "@/lib/api";
import { ArrowRight, Loader2, Repeat } from "lucide-react";

interface BudgetTransferDialogProps {
  profileId: string | number;
  matchingFundRemaining: number;
  matchingFundTotal: number;
  everysiteTotal: number;
  onTransferComplete: (newMF: number, newES: number) => void;
}

function formatMoney(val: number) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(val);
}

export function BudgetTransferDialog({ profileId, matchingFundRemaining, matchingFundTotal, everysiteTotal, onTransferComplete }: BudgetTransferDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);

  const transferAmount = Math.round(Number(amount) || 0);
  const isValid = transferAmount > 0 && transferAmount <= matchingFundRemaining;

  const handleTransfer = async () => {
    if (!isValid) return;
    setIsTransferring(true);
    try {
      // Use update_user to adjust both budget columns
      const newMF = matchingFundTotal - transferAmount;
      const newES = everysiteTotal + transferAmount;
      const res = await apiPost({
        mode: "update_user",
        id: profileId,
        budget_matching_fund: newMF,
        budget_everysite: newES,
      });
      if (!res.success) throw new Error(res.error || "ไม่สามารถโอนงบได้");

      toast({ title: "โอนงบสำเร็จ", description: `โอน ฿${formatMoney(transferAmount)} จาก Matching Fund ไป Everysite แล้ว` });
      setAmount("");
      setOpen(false);
      onTransferComplete(newMF, newES);
    } catch (error) {
      toast({ title: "เกิดข้อผิดพลาด", description: error instanceof Error ? error.message : "ไม่สามารถโอนงบได้", variant: "destructive" });
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 w-auto whitespace-nowrap">
          <Repeat className="h-4 w-4" />
          โอนงบจาก Matching Fund ไปยัง Everysite
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>โอนงบจาก Matching Fund ไปยัง Everysite</DialogTitle>
          <DialogDescription>โอนงบจาก Matching Fund ไปยัง Everysite</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 text-sm">
            <div className="flex-1 text-center">
              <p className="text-muted-foreground text-xs">Matching Fund</p>
              <p className="font-bold text-lg">฿{formatMoney(matchingFundRemaining)}</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1 text-center">
              <p className="text-muted-foreground text-xs">Everysite</p>
              <p className="font-bold text-lg text-primary">+ ฿{formatMoney(transferAmount)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>จำนวนเงินที่ต้องการโอน (บาท)</Label>
            <Input
              type="number"
              min="1"
              max={matchingFundRemaining}
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {matchingFundRemaining > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setAmount(String(matchingFundRemaining))}
              >
                โอนทั้งหมด ฿{formatMoney(matchingFundRemaining)}
              </Button>
            )}
            {transferAmount > matchingFundRemaining && (
              <p className="text-xs text-destructive">จำนวนเกินงบ Matching Fund คงเหลือ</p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isTransferring}>ยกเลิก</Button>
            <Button onClick={handleTransfer} disabled={!isValid || isTransferring}>
              {isTransferring ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />กำลังโอน...</> : "ยืนยันการโอน"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
