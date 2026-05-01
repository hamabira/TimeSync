"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { createEvent } from "@/app/actions";
import { ja } from "date-fns/locale";
import { Calendar as CalendarIcon, CalendarDays, Clock, Users } from "lucide-react";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export default function Home() {
  const router = useRouter();
  const [eventName, setEventName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(new Date().setDate(new Date().getDate() + 7)),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName || !date?.from || !date?.to || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const eventId = await createEvent({
        name: eventName,
        description,
        startDate: date.from,
        endDate: date.to,
      });
      router.push(`/e/${eventId}`);
    } catch (error) {
      console.error(error);
      alert("イベントの作成に失敗しました。");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-12 py-8">
      {/* Hero Section */}
      <section className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
          みんなの予定を、もっと<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">スマートに</span>
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          TimeSyncは、次世代の日程調整アプリです。
          幹事は「対象の期間」を選ぶだけ。参加者全員で空いている日を持ち寄る新しいスタイルで、スケジュール調整の負担をゼロにします。
        </p>
      </section>

      {/* Features */}
      <section className="grid sm:grid-cols-3 gap-6 text-center">
        <div className="p-4 rounded-2xl bg-white shadow-sm border border-slate-100 flex flex-col items-center hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-3">
            <CalendarDays size={24} />
          </div>
          <h3 className="font-semibold text-slate-900">幹事の負担ゼロ</h3>
          <p className="text-sm text-slate-500 mt-1">候補日を1つずつ入力する手間は不要。対象となる「期間」だけを選んでURLを共有するだけ。</p>
        </div>
        <div className="p-4 rounded-2xl bg-white shadow-sm border border-slate-100 flex flex-col items-center hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mb-3">
            <Clock size={24} />
          </div>
          <h3 className="font-semibold text-slate-900">細やかな時間指定</h3>
          <p className="text-sm text-slate-500 mt-1">参加者は自分の空いている日付と「時間帯」を直感的に選んで提案できます。</p>
        </div>
        <div className="p-4 rounded-2xl bg-white shadow-sm border border-slate-100 flex flex-col items-center hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 mb-3">
            <Users size={24} />
          </div>
          <h3 className="font-semibold text-slate-900">最適な日がすぐ分かる</h3>
          <p className="text-sm text-slate-500 mt-1">みんなの予定が重なっている日時が自動でハイライトされ、一目で決まります。</p>
        </div>
      </section>

      {/* Creation Form */}
      <Card className="shadow-lg border-0 ring-1 ring-slate-200 overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-6">
          <CardTitle className="text-2xl font-bold text-slate-800">新しくイベントを作る</CardTitle>
          <CardDescription className="text-base text-slate-500">
            イベント名と対象期間を入力して、「作成する」ボタンを押してください。
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
                    "inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
                    "w-[300px] h-12 px-4 justify-start text-left font-normal text-base",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-5 w-5" />
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
                    <span>期間を選択</span>
                  )}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
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
        <CardFooter className="bg-slate-50/50 border-t border-slate-100 p-6 sm:p-8">
          <Button 
            className="w-full h-14 text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md transition-all active:scale-[0.98]"
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
