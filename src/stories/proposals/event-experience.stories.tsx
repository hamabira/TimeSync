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
export const SamePage: Story = { name: "提案A · 1ページ内のプレビュー", args: { layout: "same-page" } };
export const SeparateViews: Story = { name: "提案B · 回答と結果を切り替えるプレビュー", args: { layout: "separate-views" } };
export const ReturningParticipant: Story = { name: "提案モック · 再回答と前回読み込み", args: { layout: "separate-views", scenario: "returning" } };
export const InvalidTime: Story = { name: "提案モック · 時間帯の入力エラー", args: { layout: "separate-views", scenario: "error" } };
export const EmptyEvent: Story = { name: "提案モック · まだ回答がないイベント", args: { layout: "separate-views", scenario: "empty" } };
export const DesignSystemTheme: Story = { name: "提案モック · デザインシステムの配色", args: { layout: "separate-views", tone: "sage" } };
