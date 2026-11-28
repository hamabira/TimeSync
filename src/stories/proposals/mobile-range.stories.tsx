import { useEffect, useRef, useState, type ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { addMonths, format, isAfter, isBefore, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Root, type DateRange } from "react-day-picker";

import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { DateRangePicker } from "@/components/date-range-picker";
import { getMaxEndDate } from "@/lib/date-range";

const initialMonth = new Date(2026, 10, 1);

const firstMonth = new Date(2026, 0, 1);
const lastMonth = new Date(2031, 11, 1);

function shiftMonth(month: Date, step: number) {
  const next = addMonths(month, step);
  return isBefore(next, firstMonth) || isAfter(next, lastMonth) ? month : next;
}

function ProposalDayButton(props: ComponentProps<typeof CalendarDayButton>) {
  return <CalendarDayButton {...props} locale={ja} />;
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
    const slop = 8;
    const holdMs = 240;
    let gesture: {
      identifier: number;
      source: Element;
      anchor: Date;
      x: number;
      y: number;
      mode: "pending" | "range" | "scroll";
    } | undefined;
    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    let navTarget: Element | null = null;

    function stopTimer() {
      clearTimeout(holdTimer);
      holdTimer = undefined;
    }

    function dateAt(target: Element | null) {
      const day = target?.closest<HTMLElement>("td[data-day]:not([data-hidden])");
      return day && root?.contains(day) && day.dataset.day ? parseISO(day.dataset.day) : undefined;
    }

    function rangeAt(anchor: Date, target: Element | null) {
      const day = dateAt(target);
      if (!day) return undefined;
      const [from, to] = isBefore(day, anchor) ? [day, anchor] : [anchor, day];
      return isAfter(to, getMaxEndDate(from)) ? undefined : { from, to };
    }

    function clearGesture() {
      stopTimer();
      gesture?.source.removeEventListener("touchmove", move as EventListener);
      gesture?.source.removeEventListener("touchend", finish as EventListener);
      gesture?.source.removeEventListener("touchcancel", finish as EventListener);
      gesture = undefined;
      navTarget = null;
      setPreview(undefined);
    }

    function start(event: TouchEvent) {
      if (event.touches.length !== 1) {
        clearGesture();
        return;
      }
      const source = event.target;
      if (!(source instanceof Element)) return;
      const anchor = dateAt(source);
      const touch = event.changedTouches.item(0);
      if (!anchor || !touch) return;
      gesture = {
        identifier: touch.identifier, source, anchor,
        x: touch.clientX, y: touch.clientY, mode: "pending",
      };
      // The original date element can leave the DOM during month navigation.
      source.addEventListener("touchmove", move as EventListener, { passive: false });
      source.addEventListener("touchend", finish as EventListener, { passive: false });
      source.addEventListener("touchcancel", finish as EventListener);
      holdTimer = setTimeout(() => {
        if (gesture?.mode === "pending") {
          gesture.mode = "range";
          setPreview({ from: gesture.anchor, to: gesture.anchor });
        }
      }, holdMs);
    }

    function move(event: TouchEvent) {
      if (!gesture || gesture.mode === "scroll") return;
      if (event.touches.length !== 1) {
        clearGesture();
        return;
      }
      const touch = Array.from(event.changedTouches).find(t => t.identifier === gesture?.identifier);
      if (!touch) return;
      if (gesture.mode === "pending") {
        const dx = Math.abs(touch.clientX - gesture.x);
        const dy = Math.abs(touch.clientY - gesture.y);
        if (Math.max(dx, dy) < slop) return;
        stopTimer();
        // A mostly vertical immediate swipe remains a native page scroll.
        if (dy > 2 * dx) {
          gesture.mode = "scroll";
          return;
        }
        gesture.mode = "range";
      }
      // Use touchmove rather than changing touch-action after the gesture starts.
      // A non-cancelable move means the browser has already claimed the scroll.
      if (!event.cancelable) {
        clearGesture();
        return;
      }
      event.preventDefault();
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      const nav = target?.closest("[data-slide-month]:not(:disabled)") ?? null;
      if (nav && nav !== navTarget && root?.contains(nav)) {
        const step = Number(nav.getAttribute("data-slide-month"));
        setMonth(current => shiftMonth(current, step));
      }
      navTarget = nav;
      setPreview(rangeAt(gesture.anchor, target));
    }

    function finish(event: TouchEvent) {
      if (!gesture) return;
      const touch = Array.from(event.changedTouches).find(t => t.identifier === gesture?.identifier);
      if (!touch) return;
      if (gesture.mode === "range" && event.type === "touchend") {
        if (event.cancelable) event.preventDefault();
        const selected = rangeAt(gesture.anchor, document.elementFromPoint(touch.clientX, touch.clientY));
        if (selected) {
          setSaved(selected);
          setFirstTap(undefined);
        }
      }
      clearGesture();
    }

    function contextMenu(event: MouseEvent) {
      if (gesture && gesture.mode !== "scroll") event.preventDefault();
    }

    root.addEventListener("touchstart", start, { passive: true });
    root.addEventListener("contextmenu", contextMenu);
    return () => {
      clearGesture();
      root.removeEventListener("touchstart", start);
      root.removeEventListener("contextmenu", contextMenu);
    };
  }, []);

  return (
    <div ref={calendar} className="w-fit select-none">
      <p className="text-sm text-muted-foreground">横や斜めにスライドで期間を選択。真上・真下へ選ぶときは日付を長押し。</p>
      <div className="flex justify-between">
        <button data-slide-month="-1" disabled={month <= firstMonth} onClick={() => setMonth(shiftMonth(month, -1))}>前の月</button>
        <button data-slide-month="1" disabled={month >= lastMonth} onClick={() => setMonth(shiftMonth(month, 1))}>次の月</button>
      </div>
      <Calendar className="[--cell-size:min(2.75rem,calc((100vw-2.5rem)/7))]" mode="range" month={month} hideNavigation fixedWeeks locale={ja}
        components={{ Root, DayButton: ProposalDayButton }}
        disabled={firstTap && !preview ? { after: getMaxEndDate(firstTap) } : undefined}
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
