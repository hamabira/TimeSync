import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { addDays, format, startOfMonth } from "date-fns";
import type { DateRange } from "react-day-picker";

import { DateRangePicker } from "@/components/date-range-picker";
import { getPresetDateRange, getTodayDate } from "@/lib/date-range";

function rangeText(range: DateRange | undefined) {
  return range?.from && range.to
    ? `${format(range.from, "yyyy-MM-dd")} / ${format(range.to, "yyyy-MM-dd")}`
    : "未選択";
}

function DateRangeExample({ empty = false }: { empty?: boolean }) {
  const [value, setValue] = useState<DateRange | undefined>(() => empty ? undefined : getPresetDateRange("week"));
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <label htmlFor="event-date-range" className="block font-semibold">対象期間</label>
      <DateRangePicker value={value} onChange={setValue} />
      <output data-testid="committed-range" className="block text-sm text-slate-600">{rangeText(value)}</output>
    </div>
  );
}

const meta = {
  title: "Review/Calendar UX",
  component: DateRangeExample,
  parameters: { layout: "fullscreen", nextjs: { appDirectory: false } },
} satisfies Meta<typeof DateRangeExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Compare: Story = { name: "承認済みの期間選択" };
export const Empty: Story = { name: "未選択", args: { empty: true } };

// Regression: draft selection must not leak into the event form before commit.
export const SelectionAndCancel: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /^対象期間を選択/ });
    const output = canvas.getByTestId("committed-range");
    const today = getTodayDate();
    // Stay in the initial month even on the last day of that month.
    const start = addDays(startOfMonth(today), 10);
    const end = addDays(startOfMonth(today), 13);
    const day = (date: Date) => screen.getByRole("button", {
      name: new RegExp(`^${format(date, "yyyy年M月d日")}`),
    });
    const initial = rangeText(getPresetDateRange("week", today));

    await userEvent.click(trigger);
    await expect(screen.getByRole("dialog", { name: "対象期間を選択" })).toBeVisible();
    await userEvent.click(day(start));
    await expect(within(screen.getByRole("dialog", { name: "対象期間を選択" })).getByText(/終了日を選ぶと期間が確定します。/)).toHaveAttribute("role", "status");
    await expect(output).toHaveTextContent(initial);
    await userEvent.click(day(end));
    await expect(output).toHaveTextContent(rangeText({ from: start, to: end }));
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));

    await userEvent.click(trigger);
    await userEvent.click(day(start));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    await expect(output).toHaveTextContent(rangeText({ from: start, to: end }));
  },
};
