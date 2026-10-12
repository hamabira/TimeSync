import {
  buildTimeBandRows,
  buildTopSegments,
  type EventRecord,
  type ParticipantRecord,
} from "@/lib/scheduling";

export const fixtureEvent = {
  id: "a6d2c760-b421-4f69-9e39-bd8b93890370",
  name: "ゼミの打ち合わせ",
  description: "研究テーマの共有と今後の進め方を相談します。",
  startDate: "2026-10-12",
  endDate: "2026-10-18",
  createdAt: new Date("2026-09-30T03:00:00.000Z"),
} satisfies EventRecord;

export const fixtureParticipants = [
  {
    id: "participant-sakura",
    name: "さくら",
    timeSlots: [
      { date: "2026-10-12", startTime: "18:00", endTime: "20:00" },
      { date: "2026-10-13", startTime: "18:00", endTime: "20:00" },
      { date: "2026-10-14", startTime: "19:00", endTime: "21:00" },
      { date: "2026-10-15", startTime: "18:00", endTime: "20:00" },
      { date: "2026-10-16", startTime: "19:00", endTime: "22:00" },
      { date: "2026-10-17", startTime: "10:00", endTime: "13:00" },
      { date: "2026-10-18", startTime: "15:00", endTime: "18:00" },
    ],
  },
  {
    id: "participant-haru",
    name: "はる",
    timeSlots: [
      { date: "2026-10-12", startTime: "18:00", endTime: "21:00" },
      { date: "2026-10-13", startTime: "20:00", endTime: "22:00" },
      { date: "2026-10-14", startTime: "19:00", endTime: "21:00" },
      { date: "2026-10-15", startTime: "19:00", endTime: "22:00" },
      { date: "2026-10-16", startTime: "17:00", endTime: "19:00" },
      { date: "2026-10-17", startTime: "10:00", endTime: "12:00" },
      { date: "2026-10-18", startTime: "16:00", endTime: "19:00" },
    ],
  },
  {
    id: "participant-yu",
    name: "ゆう",
    timeSlots: [
      { date: "2026-10-12", startTime: "19:00", endTime: "21:00" },
      { date: "2026-10-13", startTime: "19:00", endTime: "21:00" },
      { date: "2026-10-14", startTime: "19:00", endTime: "21:00" },
      { date: "2026-10-15", startTime: "18:00", endTime: "20:00" },
      { date: "2026-10-16", startTime: "19:00", endTime: "21:00" },
      { date: "2026-10-17", startTime: "11:00", endTime: "14:00" },
      { date: "2026-10-18", startTime: "15:00", endTime: "18:00" },
    ],
  },
  {
    id: "participant-rin",
    name: "りん",
    timeSlots: [
      { date: "2026-10-12", startTime: "18:00", endTime: "20:00" },
      { date: "2026-10-13", startTime: "20:00", endTime: "22:00" },
      { date: "2026-10-14", startTime: "19:00", endTime: "21:00" },
      { date: "2026-10-15", startTime: "20:00", endTime: "22:00" },
      { date: "2026-10-16", startTime: "19:00", endTime: "21:00" },
      { date: "2026-10-17", startTime: "12:00", endTime: "14:00" },
      { date: "2026-10-18", startTime: "14:00", endTime: "16:00" },
    ],
  },
] satisfies ParticipantRecord[];

export const fixtureRows = buildTimeBandRows(fixtureParticipants);
export const fixtureCandidates = buildTopSegments(fixtureRows).slice(0, 3);
