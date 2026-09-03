"use client";

import type { FormEventHandler } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { CheckCircle2, Clock3, Trash2 } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dateOnlyToDate, type DateOnly } from "@/lib/date-only";
import { MAX_RESPONSE_SLOTS, normalizeParticipantName } from "@/lib/scheduling";
import { cn } from "@/lib/utils";
import type { NoticeState, TimeSlotDraft, TimeSlotField } from "../types";

type ResponseFormProps = {
  eventStartDate: Date;
  eventEndDate: Date;
  selectedDates: Date[];
  selectedDateKeys: DateOnly[];
  timeSlots: TimeSlotDraft[];
  userName: string;
  notice: NoticeState;
  isSubmitting: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onSelectDates: (dates: Date[] | undefined) => void;
  onAddTimeSlot: (date: DateOnly) => void;
  onUpdateTimeSlot: (id: string, field: TimeSlotField, value: string) => void;
  onRemoveTimeSlot: (id: string) => void;
  onUserNameChange: (value: string) => void;
};

export function ResponseForm({
  eventStartDate,
  eventEndDate,
  selectedDates,
  selectedDateKeys,
  timeSlots,
  userName,
  notice,
  isSubmitting,
  onSubmit,
  onSelectDates,
  onAddTimeSlot,
  onUpdateTimeSlot,
  onRemoveTimeSlot,
  onUserNameChange,
}: ResponseFormProps) {
  return (
    <Card className="shadow-sm ring-2 ring-slate-200">
      <CardHeader className="border-b-2 border-slate-200 bg-slate-50/70 pb-4">
        <CardTitle className="text-xl font-bold text-slate-800">
          1. 空いている日を選ぶ
        </CardTitle>
        <CardDescription>
          対象期間の中で、参加できる日をカレンダーから選んでください。
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-8 pt-6">
          {notice ? (
            <div
              className={cn(
                "rounded-lg border px-4 py-3 text-sm",
                notice.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-800"
              )}
            >
              {notice.message}
            </div>
          ) : null}

          <div className="flex justify-center">
            <Calendar
              mode="multiple"
              selected={selectedDates}
              onSelect={onSelectDates}
              defaultMonth={eventStartDate}
              startMonth={eventStartDate}
              endMonth={eventEndDate}
              disabled={[
                { before: eventStartDate },
                { after: eventEndDate },
              ]}
              numberOfMonths={1}
              showOutsideDays={true}
              fixedWeeks={true}
              captionLayout="dropdown"
              locale={ja}
              className="border-0"
            />
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-base font-semibold text-slate-700">選択した日程</Label>
              <p className="text-xs text-slate-500">
                集計は1時間単位です。1時間にフルで参加できる時間帯だけがヒートマップに反映されます。
                終了時刻の00:00は日末として扱います。
              </p>
            </div>
            {selectedDates.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">
                左のカレンダーから日付を選んでください
              </div>
            ) : (
              <div className="space-y-4">
                {selectedDateKeys.map((dateKey) => {
                  const date = dateOnlyToDate(dateKey);
                  const slotsForDate = timeSlots.filter((slot) => slot.date === dateKey);

                  return (
                    <div
                      key={dateKey}
                      className="rounded-xl border-2 border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-center justify-between border-b-2 border-slate-200 px-4 py-3">
                        <div className="font-semibold text-slate-800">
                          {format(date, "M月d日(E)", { locale: ja })}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                          onClick={() => onAddTimeSlot(dateKey)}
                          disabled={timeSlots.length >= MAX_RESPONSE_SLOTS}
                        >
                          + 時間を追加
                        </Button>
                      </div>

                      <div className="space-y-3 px-4 py-4">
                        {slotsForDate.length === 0 ? (
                          <div className="text-sm text-slate-400">
                            時間が指定されていません。時間を追加してください。
                          </div>
                        ) : (
                          slotsForDate.map((slot) => (
                            <div key={slot.id} className="flex flex-wrap items-center gap-2">
                              <Clock3 className="h-4 w-4 shrink-0 text-slate-400" />
                              <Input
                                type="time"
                                value={slot.startTime}
                                onChange={(event) =>
                                  onUpdateTimeSlot(slot.id, "startTime", event.target.value)
                                }
                                className="h-9 w-28"
                              />
                              <span className="shrink-0 text-slate-500">〜</span>
                              <Input
                                type="time"
                                value={slot.endTime}
                                onChange={(event) =>
                                  onUpdateTimeSlot(slot.id, "endTime", event.target.value)
                                }
                                className="h-9 w-28"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                type="button"
                                className="ml-auto text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                                onClick={() => onRemoveTimeSlot(slot.id)}
                              >
                                <Trash2 className="h-4 w-4" />
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

          <div className="space-y-3 border-t-2 border-slate-200 pt-6">
            <div className="flex items-center justify-between max-w-sm">
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
              onChange={(event) => onUserNameChange(event.target.value)}
              className="h-12 max-w-sm"
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 border-t-2 border-slate-200 bg-slate-50/70 p-6">
          <p className="text-sm leading-6 text-slate-500">
            回答した名前と空き時間は、このイベント URL を知る人に表示されます。{" "}
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
            className="h-12 w-full px-8 text-base font-bold"
            disabled={!normalizeParticipantName(userName) || timeSlots.length === 0 || isSubmitting}
          >
            <CheckCircle2 className="mr-2 h-5 w-5" />
            {isSubmitting ? "保存中..." : "この内容で提出する"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
