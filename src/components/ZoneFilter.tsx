import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ตัวกรองโซน (โซน 1-16) ใช้ร่วมทุกหน้า — value = "all" หรือ "1".."16"
export function ZoneFilter({
  value,
  onChange,
  className = "w-full sm:w-36",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}><SelectValue placeholder="ทุกโซน" /></SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value="all">ทุกโซน</SelectItem>
        {Array.from({ length: 16 }, (_, i) => (
          <SelectItem key={i + 1} value={String(i + 1)}>โซน {i + 1}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
