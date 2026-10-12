import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CurrentEventScreen } from "../baseline/current-event-screen";
import { EventExperienceProposal } from "./event-experience";

function Comparison() {
  const [variant, setVariant] = useState<"current" | "same-page" | "separate-views">("current");
  return <><nav className="proposal-review-controls" aria-label="実装と提案の比較">{([ ["current", "A · 実装"], ["same-page", "提案A · 1ページ内"], ["separate-views", "提案B · 表示を切替"] ] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={variant === value} onClick={() => setVariant(value)}>{label}</button>)}</nav><p className="proposal-review-label">Aは本番で使うコンポーネントのプレビュー、提案A/Bは比較に使ったモックです。A案は承認済みです。サンプルデータを使用し、送信操作はStorybook内の表示に反映されます。</p>{variant === "current" ? <CurrentEventScreen /> : <EventExperienceProposal key={variant} layout={variant} />}</>;
}
const meta = { title: "Review/Compare", component: Comparison, parameters: { layout: "fullscreen" } } satisfies Meta<typeof Comparison>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { name: "実装Aと提案A/Bを比較する" };
