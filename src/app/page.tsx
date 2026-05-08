"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { createEvent } from "@/app/actions";
import { ja } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { normalizeDateOnly } from "@/lib/scheduling";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export default function Home() {
  const router = useRouter();
  const [eventName, setEventName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [date, setDate] = useState<DateRange | undefined>({
    from: normalizeDateOnly(new Date()),
    to: normalizeDateOnly(new Date(new Date().setDate(new Date().getDate() + 7))),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName || !date?.from || !date?.to || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const eventId = await createEvent({
        name: eventName,
        description,
        startDate: normalizeDateOnly(date.from),
        endDate: normalizeDateOnly(date.to),
      });
      router.push(`/e/${eventId}`);
    } catch (error) {
      console.error(error);
      alert("イベントの作成に失敗しました。");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8">
      <section className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
          <CalendarIcon className="h-4 w-4" />
          空き時間の重なりが見える日程調整
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
          みんなの空き時間、重なるところだけすぐ見える。
        </h1>
        <p className="max-w-2xl text-base leading-7 text-slate-600">
          AkiMatch は、授業・バイト・サークルで予定がバラバラなグループ向けの日程調整ツールです。
          幹事は対象期間を決めるだけで、参加者は空いている日と時間を送れます。
        </p>
      </section>

      <Card className="overflow-hidden border-0 shadow-lg ring-2 ring-slate-200">
        <CardHeader className="bg-slate-50/50 border-b-2 border-slate-200 pb-6">
          <CardTitle className="text-2xl font-bold text-slate-800">新しくイベントを作る</CardTitle>
          <CardDescription className="text-base text-slate-500">
            イベント名と対象期間を入力して、共有URLを作成してください。
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="eventName" className="text-base font-semibold text-slate-700">
                  イベント名 <span className="text-red-500">*</span>
                </Label>
                <span className="text-xs text-slate-400">{eventName.length}/50</span>
              </div>
              <Input
                id="eventName"
                placeholder="例: プロジェクトキックオフ、週末の飲み会"
                value={eventName}
                maxLength={50}
                onChange={(e) => setEventName(e.target.value)}
                required
                className="h-12 text-base transition-shadow focus-visible:ring-blue-500"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="description" className="text-base font-semibold text-slate-700">
                  メモ・詳細（任意）
                </Label>
                <span className="text-xs text-slate-400">{description.length}/200</span>
              </div>
              <Textarea
                id="description"
                placeholder="例: 場所は新宿周辺を予定しています。&#10;この期間の中で都合の良い日と時間を教えてください！"
                value={description}
                maxLength={200}
                onChange={(e) => setDescription(e.target.value)}
                className="resize-none h-24 transition-shadow focus-visible:ring-blue-500"
              />
            </div>

            <div className="space-y-2 flex flex-col">
              <Label className="text-base font-semibold text-slate-700">
                対象期間 <span className="text-red-500">*</span>
              </Label>
              <span className="text-sm text-slate-500 mb-2">
                参加者が空き日程を提案できる範囲を指定します。
              </span>
              <Popover>
                <PopoverTrigger
                  id="date"
                  className={cn(
                    "inline-flex min-w-0 items-center justify-start gap-2 whitespace-nowrap rounded-lg border-2 border-input bg-background px-4 text-left text-base font-normal shadow-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50",
                    "h-12 w-full max-w-sm",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="h-5 w-5 shrink-0" />
                  <span className="min-w-0 truncate">
                    {date?.from ? (
                      date.to ? (
                        <>
                          {format(date.from, "yyyy年MM月dd日")} -{" "}
                          {format(date.to, "yyyy年MM月dd日")}
                        </>
                      ) : (
                        format(date.from, "yyyy年MM月dd日")
                      )
                    ) : (
                      "期間を選択"
                    )}
                  </span>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto max-w-[calc(100vw-2rem)] overflow-x-auto p-0"
                  align="start"
                >
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={1}
                    locale={ja}
                    showOutsideDays={true}
                    fixedWeeks={true}
                    captionLayout="dropdown"
                    fromYear={new Date().getFullYear()}
                    toYear={new Date().getFullYear() + 5}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 border-t-2 border-slate-200 bg-slate-50/50 p-6 sm:p-8">
          <p className="text-sm leading-6 text-slate-500">
            作成すると、共有 URL を知る人がイベント内容を閲覧できます。{" "}
            <Link className="font-semibold text-blue-700 underline-offset-4 hover:underline" href="/terms">
              利用規約
            </Link>
            と{" "}
            <Link className="font-semibold text-blue-700 underline-offset-4 hover:underline" href="/privacy">
              プライバシーポリシー
            </Link>
            を確認してください。
          </p>
          <Button
            className="h-14 w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-lg font-bold shadow-md transition-all hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98]"
            onClick={handleSubmit}
            disabled={!eventName || !date?.from || !date?.to || isSubmitting}
          >
            {isSubmitting ? "作成中..." : "イベントを作成する"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
