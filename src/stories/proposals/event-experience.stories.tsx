import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { EventExperienceProposal } from "./event-experience";

const meta = {
  title: "Review/Proposed event",
  component: EventExperienceProposal,
  parameters: { layout: "fullscreen" },
  args: { layout: "same-page", tone: "blue", scenario: "populated" },
  argTypes: {
    layout: { control: "select", options: ["same-page", "separate-views"] },
    tone: { control: "select", options: ["blue", "sage"] },
    scenario: { control: "select", options: ["populated", "empty", "returning", "error"] },
  },
} satisfies Meta<typeof EventExperienceProposal>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SamePage: Story = { name: "A · 既存を活かす", args: { layout: "same-page" } };
export const SeparateViews: Story = { name: "B · 回答と結果を切り替える", args: { layout: "separate-views" } };
export const ReturningParticipant: Story = { name: "再回答 · 前回を読み込む", args: { layout: "separate-views", scenario: "returning" } };
export const InvalidTime: Story = { name: "入力エラー · 行と提出ボタン付近", args: { layout: "separate-views", scenario: "error" } };
export const EmptyEvent: Story = { name: "まだ回答がないイベント", args: { layout: "separate-views", scenario: "empty" } };
export const DesignSystemTheme: Story = { name: "デザインシステムのテーマ", args: { layout: "separate-views", tone: "sage" } };
