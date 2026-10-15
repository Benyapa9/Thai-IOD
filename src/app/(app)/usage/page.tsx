"use client";

import { Activity, CalendarCheck, Gauge, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBlock, IconBadge, LoadingBlock, PageHeader } from "@/components/ui/misc";
import { PageGuide } from "@/components/ui/page-guide";
import { useUsage } from "@/hooks/queries";
import { SECTIONS, type SectionKey } from "@/lib/sections";
import { cn } from "@/lib/utils";

export default function UsagePage() {
  const { data, isLoading, error } = useUsage();
  if (isLoading) return <LoadingBlock />;
  if (error || !data) return <ErrorBlock error={error} />;

  const vsOthers = data.othersAverage ? ((data.thisWeek - data.othersAverage) / data.othersAverage) * 100 : null;
  const vsLast = data.lastWeek ? ((data.thisWeek - data.lastWeek) / data.lastWeek) * 100 : null;
  const max = Math.max(1, ...data.topPages.map((p) => p.count));
  const days = data.days.map((d) => ({ ...d, label: new Date(d.date).toLocaleDateString("th-TH", { day: "numeric", month: "short" }) }));

  return (
    <div className="space-y-5">
      <PageHeader icon={Gauge} tone="blue" title="My Usage Log" description="การใช้งานของคุณใน 4 สัปดาห์ล่าสุด เทียบกับผู้ใช้คนอื่น (ไม่แสดงข้อมูลรายบุคคลของผู้อื่น)" />
      <PageGuide
        id="usage"
        title="ดูว่าคุณใช้ระบบมากน้อยแค่ไหน"
        steps={["นับจำนวนครั้งที่เปิดหน้าต่าง ๆ ในระบบ", "เทียบกับค่าเฉลี่ยของผู้ใช้คนอื่นในสัปดาห์นี้", "ดูหน้าที่คุณเข้าบ่อยที่สุด", "หน้าที่ยังไม่เคยเข้า ลองคลิกสำรวจได้"]}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <IconBadge icon={Activity} tone="blue" size="sm" /> สัปดาห์นี้คุณเข้าใช้งาน
          </div>
          <div className="mt-1 text-3xl font-bold text-navy-900 tabular-nums">
            {data.thisWeek} <span className="text-sm font-normal text-muted-foreground">ครั้ง</span>
          </div>
          {vsLast !== null && (
            <div className={cn("text-xs font-medium", vsLast >= 0 ? "text-success" : "text-danger")}>
              {vsLast >= 0 ? "▲" : "▼"} {Math.abs(vsLast).toFixed(0)}% จากสัปดาห์ก่อน ({data.lastWeek} ครั้ง)
            </div>
          )}
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <IconBadge icon={Users} tone="teal" size="sm" /> ค่าเฉลี่ยผู้ใช้อื่น ({data.otherUsers} คน)
          </div>
          <div className="mt-1 text-3xl font-bold text-navy-900 tabular-nums">
            {data.othersAverage} <span className="text-sm font-normal text-muted-foreground">ครั้ง/สัปดาห์</span>
          </div>
          {vsOthers !== null && (
            <div className={cn("text-xs font-medium", vsOthers >= 0 ? "text-success" : "text-warning")}>
              คุณใช้งาน{vsOthers >= 0 ? "มากกว่า" : "น้อยกว่า"}ค่าเฉลี่ย {Math.abs(vsOthers).toFixed(0)}%
            </div>
          )}
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <IconBadge icon={CalendarCheck} tone="violet" size="sm" /> จำนวนวันที่ใช้งาน (7 วัน)
          </div>
          <div className="mt-1 text-3xl font-bold text-navy-900 tabular-nums">
            {data.activeDays} <span className="text-sm font-normal text-muted-foreground">/ 7 วัน</span>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle><IconBadge icon={CalendarCheck} tone="blue" size="sm" /> การใช้งานรายวัน (28 วัน)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days} margin={{ left: -20, right: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={3} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [`${v} ครั้ง`, "เข้าใช้งาน"]} />
                <Bar dataKey="count" fill="var(--color-navy-600)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle><IconBadge icon={Trophy} tone="amber" size="sm" /> หน้าที่คุณเข้าบ่อยที่สุด</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topPages.length === 0 ? (
              <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>
            ) : (
              <ul className="space-y-2">
                {data.topPages.map((p, i) => (
                  <li key={p.key}>
                    <Link href={SECTIONS[p.key as SectionKey]?.href ?? "/home"} className="group block">
                      <div className="flex justify-between text-sm">
                        <span className="text-navy-900 group-hover:underline">
                          {i + 1}. {p.label}
                        </span>
                        <span className="tabular-nums text-muted-foreground">{p.count}</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-navy-50">
                        <div className="h-2 rounded-full bg-navy-600" style={{ width: `${(p.count / max) * 100}%` }} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
