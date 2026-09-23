import Link from "next/link";
import { Users, CalendarDays, MessageSquareText, Coins, Check, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const STEPS = [
  {
    icon: Users,
    title: "นำเข้านักเรียน",
    description: "เพิ่มนักเรียนใน CRM หรือนำเข้าจากไฟล์ Excel",
    href: "/students",
    cta: "ไปที่ Students",
  },
  {
    icon: CalendarDays,
    title: "ตั้งคาบเรียนและตารางสอน",
    description: "กำหนดชั่วโมงสอน คอร์ส และตารางว่างของสตูดิโอ",
    href: "/settings",
    cta: "ไปที่ Settings",
  },
  {
    icon: MessageSquareText,
    title: "เชื่อม LINE ให้ AI ตอบลูกค้า",
    description: "ลูกค้าทัก LINE มาแล้ว AI ตอบอัตโนมัติ แจ้งเตือนคุณเฉพาะเรื่องสำคัญ",
    href: "/settings",
    cta: "ตั้งค่า LINE",
  },
  {
    icon: Coins,
    title: "ตั้งวงเงิน AI รายวัน",
    description: "กันค่าใช้จ่าย AI ไม่ให้เกินงบ — AI จะหยุดตอบเองเมื่อถึงวงเงิน",
    href: "/settings",
    cta: "ตั้งวงเงิน",
  },
];

export function OnboardingCard() {
  return (
    <Card className="overflow-hidden border-primary/20">
      <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🚀 เริ่มต้นใช้งานสตูดิโอของคุณ
        </CardTitle>
        <CardDescription>
          ยังไม่มีข้อมูลนักเรียนในระบบ — ทำ 4 ขั้นตอนนี้ให้ครบ ระบบจะทำงานแทนคุณได้เกือบทั้งหมด
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <Link
                href={step.href}
                className="group flex items-start gap-3 rounded-xl border border-line/10 bg-line/5 p-4 transition-all hover:border-primary/30 hover:bg-line/10"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <step.icon className="h-4 w-4 text-primary-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-secondary">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">{i + 1}</span>
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-xs text-secondary/50">{step.description}</p>
                  <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-primary-accent">
                    {step.cta}
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </p>
                </div>
                <Check className="h-4 w-4 shrink-0 text-secondary/20" />
              </Link>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
