"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { format, startOfDay } from "date-fns";
import { ja } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { getEventWithParticipants, submitResponse } from "@/app/actions";

const today = startOfDay(new Date());

type TimeSlot = {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
};

type Participant = {
  id: string;
  name: string;
  timeSlots: {
    date: Date;
    startTime: string;
    endTime: string;
  }[];
};

type EventData = {
  id: string;
  name: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
};

export default function EventPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [eventData, setEventData] = useState<EventData | null>(null);
  const [participantsData, setParticipantsData] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [userName, setUserName] = useState("");
  const [selectedDates, setSelectedDates] = useState<Date[] | undefined>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [highlightedRow, setHighlightedRow] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    getEventWithParticipants(eventId).then((data) => {
      if (data) {
        setEventData({
          ...data.event,
          startDate: new Date(data.event.startDate),
          endDate: new Date(data.event.endDate)
        });
        setParticipantsData(data.participants.map((p: any) => ({
          ...p,
          timeSlots: p.timeSlots.map((s: any) => ({ ...s, date: new Date(s.date) }))
        })));
      }
      setIsLoading(false);
    }).catch(err => {
      console.error(err);
      setIsLoading(false);
    });
  }, [eventId]);

  const tableRows = Array.from(new Set(participantsData.flatMap(p => p.timeSlots.map(s => s.date.getTime()))))
    .sort((a, b) => a - b)
    .map(t => new Date(t))
    .flatMap((date) => {
      const allHours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
      
      const rows = allHours.map(hour => {
        const attendees = participantsData.filter(p => {
          const slot = p.timeSlots.find(s => s.date.getTime() === date.getTime());
          if (!slot) return false;
          const start = parseInt(slot.startTime.split(":")[0]);
          const end = parseInt(slot.endTime.split(":")[0]);
          return hour >= start && hour < end;
        });
        return {
          hour,
          attendees,
          attendeesKey: attendees.map(a => a.name).sort().join(',')
        };
      }).filter(row => row.attendees.length > 0);

      const grouped: any[] = [];
      if (rows.length === 0) return [];
      
      let currentGroup = {
        date,
        startHour: rows[0].hour,
        endHour: rows[0].hour + 1,
        attendees: rows[0].attendees,
        attendeesKey: rows[0].attendeesKey
      };

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.attendeesKey === currentGroup.attendeesKey && row.hour === currentGroup.endHour) {
          currentGroup.endHour = row.hour + 1;
        } else {
          grouped.push(currentGroup);
          currentGroup = {
            date,
            startHour: row.hour,
            endHour: row.hour + 1,
            attendees: row.attendees,
            attendeesKey: row.attendeesKey
          };
        }
      }
      grouped.push(currentGroup);
      return grouped;
    });

  const candidates = [...tableRows]
    .sort((a, b) => b.attendees.length - a.attendees.length)
    .slice(0, 3);

  const scrollToRow = (date: Date, hour: number) => {
    const rowId = `row-${date.getTime()}-${hour}`;
    const element = document.getElementById(rowId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedRow(rowId);
      setTimeout(() => setHighlightedRow(null), 2000);
    }
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName || timeSlots.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await submitResponse(eventId, userName, timeSlots);
      alert(`${userName}さんの希望日程を保存しました！\n選択数: ${timeSlots.length}件`);
      
      const data = await getEventWithParticipants(eventId);
      if (data) {
        setParticipantsData(data.participants.map((p: any) => ({
          ...p,
          timeSlots: p.timeSlots.map((s: any) => ({ ...s, date: new Date(s.date) }))
        })));
      }
      
      setUserName("");
      setSelectedDates([]);
      setTimeSlots([]);
    } catch (err) {
      console.error(err);
      alert("エラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><p className="text-slate-500 animate-pulse font-medium">イベントを読み込み中...</p></div>;
  }
  if (!eventData) {
    return <div className="flex justify-center items-center h-screen"><p className="text-slate-500">イベントが見つかりません。</p></div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-4">
      {/* Event Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-extrabold text-slate-900">{eventData.name}</h1>
        {eventData.description && <p className="text-slate-600 whitespace-pre-wrap">{eventData.description}</p>}
        <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium">
          <CalendarIcon className="w-4 h-4 mr-2" />
          対象期間: {format(eventData.startDate, "yyyy/MM/dd")} 〜 {format(eventData.endDate, "yyyy/MM/dd")}
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
              defaultMonth={eventData.startDate}
              fromDate={eventData.startDate}
              toDate={eventData.endDate}
              disabled={[{ before: eventData.startDate, after: eventData.endDate }]}
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

      {/* Results Section */}
      <div className="pt-12 space-y-8 border-t border-slate-200 mt-12">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-slate-800">みんなの回答状況</h2>
          <p className="text-slate-500">現在 {participantsData.length} 人が回答しています</p>
        </div>

        {participantsData.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="text-slate-500 font-medium">まだ回答がありません。<br/>最初の回答を入力して日程を合わせましょう！</p>
          </div>
        ) : (
          <>
            {/* Best Matches */}
            <div className="grid sm:grid-cols-3 gap-4">
              {candidates.map((match, i) => (
                <Card 
                  key={i} 
                  onClick={() => scrollToRow(match.date, match.startHour)}
                  className={`border-2 cursor-pointer transition-all hover:scale-105 active:scale-95 ${i === 0 ? "border-blue-500 bg-blue-50/30" : "border-slate-200 hover:border-blue-300"}`}
                >
                  <CardContent className="p-4 text-center space-y-2">
                    <div className={`text-sm font-bold ${i === 0 ? "text-blue-600" : "text-slate-500"}`}>
                      第{i + 1}候補
                    </div>
                    <div className="text-lg font-bold text-slate-800">
                      {format(match.date, "M/d (E)", { locale: ja })}
                    </div>
                    <div className="text-slate-600 font-medium">{match.startHour}:00 〜 {match.endHour}:00</div>
                    <div className="inline-block px-3 py-1 bg-slate-100 rounded-full text-sm font-semibold text-slate-700">
                      {match.attendees.length} 人参加可能
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Heatmap Table */}
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 min-w-[120px] sticky left-0 bg-slate-50 z-10 border-r border-slate-200 shadow-[1px_0_0_0_#e2e8f0]">日程</th>
                      <th className="px-4 py-3 min-w-[100px] text-center border-r border-slate-200">参加率</th>
                      {participantsData.map((p, i) => (
                        <th key={i} className="px-4 py-3 min-w-[100px] text-center">{p.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tableRows.map((group) => {
                      const ratio = group.attendees.length / participantsData.length;
                      const isPerfect = ratio === 1;
                      const isGood = ratio >= 0.6 && !isPerfect;

                      return (
                        <tr 
                          key={`${group.date.toISOString()}-${group.startHour}`} 
                          id={`row-${group.date.getTime()}-${group.startHour}`}
                          className={`transition-colors duration-500 ${highlightedRow === `row-${group.date.getTime()}-${group.startHour}` ? "bg-yellow-100/80" : "hover:bg-slate-50/50"}`}
                        >
                          <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r border-slate-200 shadow-[1px_0_0_0_#e2e8f0]">
                            <div className="font-semibold text-slate-800">{format(group.date, "M/d (E)", { locale: ja })}</div>
                            <div className="text-slate-500">{group.startHour}:00 〜 {group.endHour}:00</div>
                          </td>
                          <td className="px-4 py-3 text-center border-r border-slate-200">
                            <div className={`w-full h-full flex items-center justify-center rounded py-2 font-bold ${
                              isPerfect ? "bg-blue-600 text-white" : 
                              isGood ? "bg-blue-300 text-blue-900" : 
                              ratio > 0 ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-400"
                            }`}>
                              {group.attendees.length} / {participantsData.length}
                            </div>
                          </td>
                          {participantsData.map((p, pIdx) => {
                            const canAttend = group.attendees.some((a: any) => a.name === p.name);
                            return (
                              <td key={pIdx} className="px-4 py-3 text-center">
                                {canAttend ? (
                                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 font-bold">〇</span>
                                ) : (
                                  <span className="inline-flex items-center justify-center w-8 h-8 text-slate-300">✕</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>

    </div>
  );
}
