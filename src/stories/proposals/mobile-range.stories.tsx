import { useEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { addMonths, format, isAfter, isBefore, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

import { Calendar } from "@/components/ui/calendar";
import { DateRangePicker } from "@/components/date-range-picker";
import { getMaxEndDate } from "@/lib/date-range";

const initialMonth = new Date(2026, 10, 1);

const firstMonth = new Date(2026, 0, 1);
const lastMonth = new Date(2031, 11, 1);

function shiftMonth(month: Date, step: number) {
  const next = addMonths(month, step);
  return isBefore(next, firstMonth) || isAfter(next, lastMonth) ? month : next;
}

function MobileRangeProposal() {
  const [month, setMonth] = useState(initialMonth);
  const [saved, setSaved] = useState<DateRange>();
  const [firstTap, setFirstTap] = useState<Date>();
  const [preview, setPreview] = useState<DateRange>();
  const calendar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = calendar.current;
    if (!root) return;
    let gesture: { start: Date; x: number; y: number; dragging: boolean } | undefined;
    let range: DateRange | undefined;
    let navTarget: Element | null = null;
    let suppressClickUntil = 0;

    function dateAt(target: Element | null) {
      const day = target?.closest<HTMLElement>("td[data-day]:not([data-hidden])");
      return day && root?.contains(day) && day.dataset.day ? parseISO(day.dataset.day) : undefined;
    }
    let pointerId: number | undefined;
    let scrolled = false;

    function start(event: PointerEvent) {
      suppressClickUntil = 0;
      scrolled = false;
      if (!event.isPrimary || event.pointerType !== "touch") return;
      const day = dateAt(event.target as Element);
      if (!day) return;
      range = undefined;
      navTarget = null;
      pointerId = event.pointerId;
      gesture = { start: day, x: event.clientX, y: event.clientY, dragging: false };
    }
    function move(event: PointerEvent) {
      if (!gesture || event.pointerId !== pointerId) return;
      const dx = Math.abs(event.clientX - gesture.x);
      const dy = Math.abs(event.clientY - gesture.y);
      if (!gesture.dragging) {
        if (Math.max(dx, dy) < 8) return;
        if (dy >= dx) {
          scrolled = true;
          gesture = undefined;
          return;
        }
        gesture.dragging = true;
        root?.setPointerCapture(event.pointerId);
      }
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const nav = target?.closest("[data-slide-month]") ?? null;
      if (nav && nav !== navTarget && root?.contains(nav)) {
        const step = Number(nav.getAttribute("data-slide-month"));
        setMonth(current => shiftMonth(current, step));
      }
      navTarget = nav;
      const day = dateAt(target);
      if (!day || range?.to?.getTime() === day.getTime()) return;
      if (isBefore(day, gesture.start) || isAfter(day, getMaxEndDate(gesture.start))) return;
      range = { from: gesture.start, to: day };
      setPreview(range);
    }
    function finish(event: PointerEvent) {
      if (event.pointerId !== pointerId) return;
      pointerId = undefined;
      if (gesture?.dragging || scrolled) {
        suppressClickUntil = performance.now() + 400;
        if (event.cancelable) event.preventDefault();
        if (range && event.type === "pointerup") {
          setSaved(range);
          setFirstTap(undefined);
        }
      }
      gesture = undefined;
      range = undefined;
      setPreview(undefined);
    }
    function click(event: MouseEvent) {
      if (performance.now() < suppressClickUntil && event.detail) {
        event.preventDefault();
        event.stopPropagation();
        suppressClickUntil = 0;
      }
    }
    root.addEventListener("pointerdown", start);
    root.addEventListener("pointermove", move);
    root.addEventListener("pointerup", finish);
    root.addEventListener("pointercancel", finish);
    root.addEventListener("click", click, true);
    return () => {
      root.removeEventListener("pointerdown", start);
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerup", finish);
      root.removeEventListener("pointercancel", finish);
      root.removeEventListener("click", click, true);
    };
  }, []);

  const anchor = preview?.from ?? firstTap;
  return (
    <div ref={calendar} className="w-fit">
      <div className="flex justify-between">
        <button data-slide-month="-1" disabled={month <= firstMonth} onClick={() => setMonth(shiftMonth(month, -1))}>前の月</button>
        <button data-slide-month="1" disabled={month >= lastMonth} onClick={() => setMonth(shiftMonth(month, 1))}>次の月</button>
      </div>
      <Calendar className="touch-pan-y [--cell-size:min(2.75rem,calc((100vw-2.5rem)/7))]" mode="range" month={month} hideNavigation fixedWeeks locale={ja}
        disabled={anchor ? { after: getMaxEndDate(anchor) } : undefined}
        showOutsideDays={false} selected={preview ?? (firstTap ? { from: firstTap } : saved)}
        onSelect={(_, day) => {
          if (!firstTap || isBefore(day, firstTap)) setFirstTap(day);
          else if (!isAfter(day, getMaxEndDate(firstTap))) {
            setSaved({ from: firstTap, to: day });
            setFirstTap(undefined);
          }
        }} />
      <output>{saved?.from && saved.to
        ? [saved.from, saved.to].map(d => format(d, "yyyy/M/d")).join(" – ")
        : "未選択"}</output>
    </div>
  );
}

function Compare() {
  const [value, setValue] = useState<DateRange>({ from: initialMonth, to: initialMonth });
  return <main className="grid gap-6 p-4 md:grid-cols-2">
    <section><h2>現在のタップ選択</h2><DateRangePicker value={value} onChange={range => range && setValue(range)} /></section>
    <section><h2>スライド選択案</h2><MobileRangeProposal /></section>
  </main>;
}

export default { title: "Review/Mobile range", component: Compare, parameters: { layout: "fullscreen", nextjs: { appDirectory: false } } } satisfies Meta<typeof Compare>;
export const Comparison: StoryObj<typeof Compare> = {};
