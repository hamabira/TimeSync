import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CurrentEventScreen } from "./current-event-screen";
import { fixtureCandidates, fixtureEvent, fixtureParticipants } from "../fixtures";

const meta = {
  title: "Review/Current event",
  component: CurrentEventScreen,
  args: {
    event: fixtureEvent,
    participants: fixtureParticipants,
  },
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
    },
  },
} satisfies Meta<typeof CurrentEventScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "A · 実装画面",
  parameters: {
    docs: { description: { story: "本番のイベント画面で使うコンポーネントを組み合わせた、承認済みA案の実装プレビューです。送信操作はStorybook内の表示にだけ反映されます。" } },
  },
};

export const Empty: Story = {
  name: "実装画面 · 回答なし",
  args: {
    participants: [],
  },
};

export const ReturningParticipant: Story = {
  name: "実装画面 · 同じ名前で回答",
  args: {
    initialName: "さくら",
    initialDraftSlots: [
      { id: "story-current-draft", date: "2026-10-13", startTime: "09:00", endTime: "10:00" },
    ],
  },
};

export const InvalidTime: Story = {
  name: "実装画面 · 時間帯の入力エラー",
  args: {
    initialName: "さくら",
    initialDraftSlots: [
      { id: "story-invalid-slot", date: "2026-10-14", startTime: "21:00", endTime: "19:00" },
    ],
    initialNotice: { type: "error", message: "赤く表示した時間帯を確認してください。入力内容は残っています。" },
  },
};

export const SelectedCandidate: Story = {
  name: "実装画面 · 選択した候補の詳細",
  args: { initialSelectedBand: fixtureCandidates[0] },
};

const submitDraft = [
  { id: "story-submit-slot", date: "2026-10-14", startTime: "19:00", endTime: "21:00" },
];

export const Saving: Story = {
  name: "実装画面 · 保存中",
  args: {
    initialName: "のぞみ",
    initialDraftSlots: submitDraft,
    initialIsSubmitting: true,
  },
  parameters: {
    docs: { description: { story: "送信中の固定プレビューです。入力欄、日付選択、前回回答の読み込みが無効になります。" } },
  },
};

export const SaveError: Story = {
  name: "実装画面 · 保存エラー",
  args: {
    initialName: "のぞみ",
    initialDraftSlots: submitDraft,
    submitBehavior: "error",
  },
  parameters: {
    docs: { description: { story: "送信すると短い保存中状態のあと、日本語の保存エラーをフォーム下部に表示します。入力内容は残ります。" } },
  },
};

export const RefreshFailed: Story = {
  name: "実装画面 · 保存成功・再読込失敗",
  args: {
    initialName: "のぞみ",
    initialDraftSlots: submitDraft,
    submitBehavior: "refresh-failure",
  },
  parameters: {
    docs: { description: { story: "送信内容の保存が確定したあと、結果の再読込だけ失敗した状態を再現します。保存済みの案内と結果へのリンクを表示します。" } },
  },
};
