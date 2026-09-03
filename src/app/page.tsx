"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createEvent } from "@/app/actions";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateRangePicker } from "@/components/date-range-picker";
import { getPresetDateRange } from "@/lib/date-range";
import { normalizeDateOnly } from "@/lib/scheduling";

export default function Home() {
  const router = useRouter();
  const [eventName, setEventName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [date, setDate] = useState<DateRange | undefined>(() => getPresetDateRange("week"));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName || !date?.from || !date?.to || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
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
      setErrorMessage(error instanceof Error ? error.message : "イベントの作成に失敗しました。");
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

      <Card className="-mx-4 overflow-hidden rounded-none border-0 shadow-lg ring-2 ring-slate-200 sm:mx-0 sm:rounded-xl">
        <CardHeader className="bg-slate-50/50 border-b-2 border-slate-200 pb-6">
          <CardTitle className="text-2xl font-bold text-slate-800">新しくイベントを作る</CardTitle>
          <CardDescription className="text-base text-slate-500">
            イベント名と対象期間を入力して、共有URLを作成してください。
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="pt-8">
            <div className="space-y-6">
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
                placeholder={
                  "例: 場所は新宿周辺を予定しています。\nこの期間の中で都合の良い日と時間を教えてください！"
                }
                value={description}
                maxLength={200}
                onChange={(e) => setDescription(e.target.value)}
                className="resize-none h-24 transition-shadow focus-visible:ring-blue-500"
              />
            </div>

            <div className="flex flex-col space-y-2">
              <Label className="text-base font-semibold text-slate-700">
                対象期間 <span className="text-red-500">*</span>
              </Label>
              <span className="text-sm text-slate-500 mb-2">
                参加者が空き日程を提案できる範囲を指定します。
              </span>
              <DateRangePicker value={date} onChange={setDate} />
            </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 border-t-2 border-slate-200 bg-slate-50/50 p-6 sm:p-8">
            {errorMessage ? (
              <div
                role="alert"
                className="w-full rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
              >
                {errorMessage}
              </div>
            ) : null}
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
              type="submit"
              className="h-14 w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-lg font-bold shadow-md transition-all hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98]"
              disabled={!eventName || !date?.from || !date?.to || isSubmitting}
            >
              {isSubmitting ? "作成中..." : "イベントを作成する"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
