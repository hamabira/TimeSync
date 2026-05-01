"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";

import { startOfDay, addDays } from "date-fns";

const today = startOfDay(new Date());

// モックデータ（実際はURLのidを使ってDBから取得する）
const mockEvent = {
  name: "週末の飲み会（モック）",
  description: "新宿周辺で予定しています。参加できる日と時間帯を教えてください！",
  startDate: addDays(today, 1), // 明日
  endDate: addDays(today, 14), // 2週間後
};

type TimeSlot = {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
};

export default function EventPage() {
  const [userName, setUserName] = useState("");
  const [selectedDates, setSelectedDates] = useState<Date[] | undefined>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);

  // カレンダーで日付が選択・解除されたときの処理
  const handleSelectDates = (dates: Date[] | undefined) => {
    setSelectedDates(dates);

    // 選択解除された日付のスロットを削除
    if (dates) {
      setTimeSlots((prev) => prev.filter((slot) => dates.some((d) => d.getTime() === slot.date.getTime())));

      // 新しく選択された日付のデフォルトスロット（19:00〜21:00）を追加
      dates.forEach((date) => {
        if (!timeSlots.some((slot) => slot.date.getTime() === date.getTime())) {
          setTimeSlots((prev) => [
            ...prev,
            {
              id: Math.random().toString(36).substring(7),
              date: date,
              startTime: "19:00",
              endTime: "21:00",
            },
          ]);
        }
      });
    } else {
      setTimeSlots([]);
    }
  };

  const updateTimeSlot = (id: string, field: "startTime" | "endTime", value: string) => {
    setTimeSlots((prev) =>
      prev.map((slot) => (slot.id === id ? { ...slot, [field]: value } : slot))
    );
  };

  const removeTimeSlot = (id: string) => {
    setTimeSlots((prev) => prev.filter((slot) => slot.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName || timeSlots.length === 0) return;

    // TODO: DB保存処理 (Cloudflare D1)
    console.log({ userName, timeSlots });
    alert(`${userName}さんの希望日程を保存しました！（モック）\n選択数: ${timeSlots.length}件`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-4">
      {/* Event Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-extrabold text-slate-900">{mockEvent.name}</h1>
        <p className="text-slate-600 whitespace-pre-wrap">{mockEvent.description}</p>
        <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium">
          <CalendarIcon className="w-4 h-4 mr-2" />
          対象期間: {format(mockEvent.startDate, "yyyy/MM/dd")} 〜 {format(mockEvent.endDate, "yyyy/MM/dd")}
        </div>
      </div>

      <div className="grid lg:grid-cols-[auto_1fr] gap-8 items-start">
        {/* Left Column: Calendar */}
        <Card className="shadow-sm border-slate-200 sticky top-24">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
            <CardTitle className="text-lg font-bold">1. 空いている日を選ぶ</CardTitle>
            <CardDescription>対象期間の中で、参加できる日をすべてタップしてください。</CardDescription>
          </CardHeader>
          <CardContent className="p-4 flex justify-center">
            <Calendar
              mode="multiple"
              selected={selectedDates}
              onSelect={handleSelectDates}
              defaultMonth={mockEvent.startDate}
              fromDate={mockEvent.startDate}
              toDate={mockEvent.endDate}
              disabled={[{ before: mockEvent.startDate, after: mockEvent.endDate }]}
              numberOfMonths={1}
              showOutsideDays={true}
              fixedWeeks={true}
              captionLayout="dropdown"
              locale={ja}
              className="border-0"
            />
          </CardContent>
        </Card>

        {/* Right Column: Time Slots & Submission */}
        <div className="space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
              <CardTitle className="text-lg font-bold">2. 時間帯と名前を入力</CardTitle>
              <CardDescription>選んだ日付ごとに、参加できる時間帯を調整できます。</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-8">

              {/* Selected Dates List */}
              <div className="space-y-4">
                <Label className="text-base font-semibold text-slate-700">選択した日程</Label>
                {!selectedDates || selectedDates.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    左のカレンダーから日付を選んでください
                  </div>
                ) : (
                  <div className="space-y-4">
                    {[...selectedDates].sort((a, b) => a.getTime() - b.getTime()).map((date) => {
                      const slotsForDate = timeSlots.filter((slot) => slot.date.getTime() === date.getTime());

                      return (
                        <div key={date.toISOString()} className="p-4 rounded-lg border border-slate-200 bg-white shadow-sm transition-all hover:border-blue-200">
                          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                            <div className="font-semibold text-slate-800 text-lg">
                              {format(date, "M月d日(E)", { locale: ja })}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 text-sm"
                              onClick={() => {
                                setTimeSlots((prev) => [
                                  ...prev,
                                  {
                                    id: Math.random().toString(36).substring(7),
                                    date: date,
                                    startTime: "19:00",
                                    endTime: "21:00",
                                  },
                                ]);
                              }}
                            >
                              + 時間を追加
                            </Button>
                          </div>

                          <div className="space-y-2">
                            {slotsForDate.length === 0 ? (
                              <div className="text-sm text-slate-400 py-2">時間が指定されていません（「＋時間を追加」を押してください）</div>
                            ) : (
                              slotsForDate.map((slot) => (
                                <div key={slot.id} className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                                  <Input
                                    type="time"
                                    value={slot.startTime}
                                    onChange={(e) => updateTimeSlot(slot.id, "startTime", e.target.value)}
                                    className="w-28 h-9 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:p-1 [&::-webkit-calendar-picker-indicator]:rounded-md hover:[&::-webkit-calendar-picker-indicator]:bg-slate-200 transition-colors"
                                  />
                                  <span className="text-slate-500 shrink-0">〜</span>
                                  <Input
                                    type="time"
                                    value={slot.endTime}
                                    onChange={(e) => updateTimeSlot(slot.id, "endTime", e.target.value)}
                                    className="w-28 h-9 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:p-1 [&::-webkit-calendar-picker-indicator]:rounded-md hover:[&::-webkit-calendar-picker-indicator]:bg-slate-200 transition-colors"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-slate-400 hover:text-red-500 hover:bg-red-50 ml-auto"
                                    onClick={() => removeTimeSlot(slot.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* User Name Input */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center max-w-sm">
                  <Label htmlFor="userName" className="text-base font-semibold text-slate-700">
                    お名前 <span className="text-red-500">*</span>
                  </Label>
                  <span className="text-xs text-slate-400">{userName.length}/20</span>
                </div>
                <Input
                  id="userName"
                  placeholder="例: 山田太郎"
                  value={userName}
                  maxLength={20}
                  onChange={(e) => setUserName(e.target.value)}
                  className="h-12 max-w-sm"
                  required
                />
              </div>

            </CardContent>
            <CardFooter className="bg-slate-50/50 border-t border-slate-100 p-6">
              <Button
                className="w-full sm:w-auto h-12 px-8 text-base font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md"
                onClick={handleSubmit}
                disabled={!userName || timeSlots.length === 0}
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                この内容で提出する
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
