"use client";

import { useId, type FormEventHandler } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { CheckCircle2, RotateCcw, Trash2 } from "lucide-react";

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
import { MAX_RESPONSE_SLOTS, type ParticipantRecord } from "@/lib/scheduling";
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
  nameError?: string | null;
  slotErrors: Record<string, string>;
  existingParticipant: ParticipantRecord | null;
  hasSavedResponse: boolean;
  isSubmitting: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onSelectDates: (dates: Date[] | undefined) => void;
  onAddTimeSlot: (date: DateOnly) => void;
  onUpdateTimeSlot: (id: string, field: TimeSlotField, value: string) => void;
  onRemoveTimeSlot: (id: string) => void;
  onUserNameChange: (value: string) => void;
  onLoadPreviousResponse: () => void;
};

function formatDateLabel(date: Date) {
  return format(date, "M月d日(E)", { locale: ja });
}

export function ResponseForm({
  eventStartDate,
  eventEndDate,
  selectedDates,
  selectedDateKeys,
  timeSlots,
  userName,
  notice,
  nameError = null,
  slotErrors,
  existingParticipant,
  hasSavedResponse,
  isSubmitting,
  onSubmit,
  onSelectDates,
  onAddTimeSlot,
  onUpdateTimeSlot,
  onRemoveTimeSlot,
  onUserNameChange,
  onLoadPreviousResponse,
}: ResponseFormProps) {
  const id = useId();
  const hasNameError = Boolean(nameError);

  return (
    <Card id="answer-section" className="scroll-mt-24 shadow-sm ring-1 ring-slate-200">
      <CardHeader className="border-b border-slate-200 bg-slate-50/70 pb-4">
        <CardTitle className="text-xl font-bold text-slate-900">あなたの回答</CardTitle>
        <CardDescription>
          参加できる日と時間を選んでください。回答後も入力内容は画面に残ります。
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-7 pt-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={id + "-user-name"} className="text-base font-semibold text-slate-800">
                お名前 <span className="text-rose-600">必須</span>
              </Label>
              <span className="text-xs tabular-nums text-slate-500">{userName.length}/20</span>
            </div>
            <Input
              id={id + "-user-name"}
              placeholder="例: 山田太郎"
              value={userName}
              maxLength={20}
              onChange={(event) => onUserNameChange(event.target.value)}
              className="h-12 max-w-md text-base"
              disabled={isSubmitting}
              aria-invalid={hasNameError}
              aria-describedby={id + "-name-help" + (nameError ? " " + id + "-name-error" : "")}
              autoComplete="name"
              required
            />
            <p id={id + "-name-help"} className="text-xs leading-5 text-slate-500">
              同じイベントで同じ名前を使うと、前回の回答を更新します。
            </p>
            {nameError ? (
              <p id={id + "-name-error"} role="alert" className="text-sm text-rose-700">{nameError}</p>
            ) : null}
            {existingParticipant && !(hasSavedResponse && notice?.type === "success") ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4" role="region" aria-label="同じ名前の前回回答">
                <p className="text-sm font-semibold text-slate-900">
                  {existingParticipant.name}さんの回答があります
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  同じ名前で提出すると前回の回答を上書きします。前回の時間帯を読み込むと、現在の入力内容が置き換わります。
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 h-11 bg-white"
                  onClick={onLoadPreviousResponse}
                  disabled={isSubmitting}
                >
                  <RotateCcw aria-hidden="true" />
                  前回の回答を読み込む
                </Button>
              </div>
            ) : null}
          </div>

          <section aria-labelledby={id + "-date-heading"} className="space-y-4">
            <div className="space-y-1">
              <h3 id={id + "-date-heading"} className="text-base font-semibold text-slate-800">
                空いている日
              </h3>
              <p className="text-xs leading-5 text-slate-500">
                対象期間内の日付を選びます。時間帯は1時間単位で集計し、終了の00:00はその日の24:00として扱います。
              </p>
            </div>

            <fieldset disabled={isSubmitting} aria-busy={isSubmitting} className="flex min-w-0 justify-center rounded-xl border border-slate-200 bg-white p-2 disabled:opacity-70 sm:p-4">
              <legend className="sr-only">空いている日を選ぶ</legend>
              <Calendar
                mode="multiple"
                selected={selectedDates}
                onSelect={onSelectDates}
                defaultMonth={eventStartDate}
                startMonth={eventStartDate}
                endMonth={eventEndDate}
                disabled={[{ before: eventStartDate }, { after: eventEndDate }]}
                numberOfMonths={1}
                showOutsideDays={true}
                fixedWeeks={true}
                captionLayout="dropdown"
                locale={ja}
                className="border-0"
              />
            </fieldset>

            <div className="space-y-3">
              {selectedDateKeys.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  カレンダーで日付を選ぶと、時間帯を入力できます。
                </div>
              ) : (
                selectedDateKeys.map((dateKey) => {
                  const date = dateOnlyToDate(dateKey);
                  const slotsForDate = timeSlots.filter((slot) => slot.date === dateKey);

                  return (
                    <section
                      key={dateKey}
                      aria-labelledby={id + "-date-" + dateKey}
                      className="rounded-xl border border-slate-200 bg-white"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
                        <h4 id={id + "-date-" + dateKey} className="font-semibold text-slate-900">
                          {formatDateLabel(date)}
                        </h4>
                        <Button
                          variant="ghost"
                          type="button"
                          className="h-10 text-blue-700 hover:bg-blue-50"
                          onClick={() => onAddTimeSlot(dateKey)}
                          disabled={timeSlots.length >= MAX_RESPONSE_SLOTS || isSubmitting}
                        >
                          + 時間帯を追加
                        </Button>
                      </div>

                      <div className="space-y-3 p-4">
                        {slotsForDate.length === 0 ? (
                          <p className="text-sm text-slate-500">時間帯がありません。追加してください。</p>
                        ) : (
                          slotsForDate.map((slot, index) => {
                            const slotError = slotErrors[slot.id];
                            const errorId = id + "-slot-error-" + slot.id;
                            const startId = id + "-slot-start-" + slot.id;
                            const endId = id + "-slot-end-" + slot.id;

                            return (
                              <fieldset key={slot.id} className="min-w-0 rounded-lg bg-slate-50 p-3">
                                <legend className="px-1 text-xs font-semibold text-slate-700">
                                  {formatDateLabel(date)}・時間帯 {index + 1}
                                </legend>
                                <div className="grid grid-cols-[minmax(0,1fr)_44px] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_44px]">
                                  <div className="col-span-2 min-w-0 space-y-1 sm:col-span-1">
                                    <Label htmlFor={startId} className="text-xs text-slate-600">開始時刻</Label>
                                    <Input
                                      id={startId}
                                      type="time"
                                      value={slot.startTime}
                                      onChange={(event) => onUpdateTimeSlot(slot.id, "startTime", event.target.value)}
                                      className="h-11 min-w-0 w-full px-2 text-base"
                                      disabled={isSubmitting}
                                      aria-invalid={Boolean(slotError)}
                                      aria-describedby={slotError ? errorId : undefined}
                                      aria-label={formatDateLabel(date) + " 時間帯 " + (index + 1) + " 開始時刻"}
                                    />
                                  </div>
                                  <span aria-hidden="true" className="hidden pb-3 text-slate-500 sm:block">〜</span>
                                  <div className="min-w-0 space-y-1">
                                    <Label htmlFor={endId} className="text-xs text-slate-600">終了時刻</Label>
                                    <Input
                                      id={endId}
                                      type="time"
                                      value={slot.endTime}
                                      onChange={(event) => onUpdateTimeSlot(slot.id, "endTime", event.target.value)}
                                      className="h-11 min-w-0 w-full px-2 text-base"
                                      disabled={isSubmitting}
                                      aria-invalid={Boolean(slotError)}
                                      aria-describedby={slotError ? errorId : undefined}
                                      aria-label={formatDateLabel(date) + " 時間帯 " + (index + 1) + " 終了時刻"}
                                    />
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    type="button"
                                    className="h-11 w-11 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                                    onClick={() => onRemoveTimeSlot(slot.id)}
                                    disabled={isSubmitting}
                                    aria-label={formatDateLabel(date) + " 時間帯 " + (index + 1) + "、" + slot.startTime + "〜" + slot.endTime + "を削除"}
                                  >
                                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                                  </Button>
                                </div>
                                {slotError ? (
                                  <p id={errorId} role="alert" className="mt-2 text-sm font-medium text-rose-700">
                                    {slotError}
                                  </p>
                                ) : null}
                              </fieldset>
                            );
                          })
                        )}
                      </div>
                    </section>
                  );
                })
              )}
            </div>
          </section>
        </CardContent>

        <CardFooter className="flex flex-col items-stretch gap-4 border-t border-slate-200 bg-slate-50/70 p-5 sm:p-6">
          <div aria-live="polite" className="min-h-0">
            {notice ? (
              <div
                role={notice.type === "error" ? "alert" : "status"}
                className={cn(
                  "rounded-lg border px-4 py-3 text-sm leading-6",
                  notice.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                )}
              >
                {notice.message}
              </div>
            ) : null}
          </div>
          <Button
            type="submit"
            className="h-12 w-full bg-blue-700 px-6 text-base font-bold hover:bg-blue-800"
            disabled={isSubmitting}
          >
            <CheckCircle2 aria-hidden="true" className="mr-2 h-5 w-5" />
            {isSubmitting ? "保存中..." : existingParticipant ? "回答を更新する" : "この内容で回答する"}
          </Button>
          {hasSavedResponse ? (
            <a
              href="#results-section"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-blue-800 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              保存した回答を反映した結果を見る
            </a>
          ) : null}
          <p className="text-xs leading-5 text-slate-500">
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
        </CardFooter>
      </form>
    </Card>
  );
}
