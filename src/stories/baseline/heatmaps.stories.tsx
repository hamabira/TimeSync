import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CalendarAvailabilityHeatmap } from "@/components/calendar-availability-heatmap";
import { TimeBandHeatmap } from "@/components/time-band-heatmap";
import { fixtureEvent, fixtureParticipants, fixtureRows } from "../fixtures";
import type { TimeBandSegment, TimeBandRow } from "@/lib/scheduling";

type HeatmapReviewProps = {
  rows: TimeBandRow[];
  participantCount: number;
};

function HeatmapReview({ rows, participantCount }: HeatmapReviewProps) {
  const [selectedBand, setSelectedBand] = useState<TimeBandSegment | null>(null);
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);

  const selectBand = (band: TimeBandSegment | null) => {
    setSelectedBand(band);
    setHighlightedKey(band ? `${band.date}-${band.startHour}` : null);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <section className="mx-auto max-w-6xl rounded-xl bg-white shadow-sm ring-2 ring-slate-200">
        <div className="grid gap-1 border-b-2 border-slate-200 bg-slate-50/70 px-6 py-4">
          <h2 className="text-xl font-bold text-slate-800">みんなの回答状況</h2>
          <p className="text-sm text-slate-600">
            時間帯のヒートマップと、日付ごとの参加人数を表示します。
          </p>
        </div>
        <div className="p-6">
          <TimeBandHeatmap
            rows={rows}
            participantCount={participantCount}
            highlightedKey={highlightedKey}
            selectedBand={selectedBand}
            onSelectBand={selectBand}
          />
          <div className="mt-8 border-t-2 border-slate-200 pt-6">
            <CalendarAvailabilityHeatmap
              startDate={fixtureEvent.startDate}
              endDate={fixtureEvent.endDate}
              rows={rows}
              participantCount={participantCount}
              selectedBand={selectedBand}
              onSelectBand={selectBand}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

const meta = {
  title: "Review/Heatmaps",
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  render: () => (
    <HeatmapReview rows={fixtureRows} participantCount={fixtureParticipants.length} />
  ),
};

export const Empty: Story = {
  render: () => <HeatmapReview rows={[]} participantCount={0} />,
};
