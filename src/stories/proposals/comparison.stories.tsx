import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CurrentEventScreen } from "../baseline/current-event-screen";
import { EventExperienceProposal } from "./event-experience";

function Comparison() {
  const [variant, setVariant] = useState<"current" | "same-page" | "separate-views">("same-page");
  return <><nav className="proposal-review-controls" aria-label="UI案の比較">{([ ["current", "既存の画面"], ["same-page", "A · 既存を活かす"], ["separate-views", "B · 回答と結果を分ける"] ] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={variant === value} onClick={() => setVariant(value)}>{label}</button>)}</nav><p className="proposal-review-label">承認前の比較プレビュー · 同じサンプルデータを使用 · 操作はこの画面内だけに反映されます</p>{variant === "current" ? <CurrentEventScreen /> : <EventExperienceProposal key={variant} layout={variant} />}</>;
}
const meta = { title: "Review/Compare", component: Comparison, parameters: { layout: "fullscreen" } } satisfies Meta<typeof Comparison>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { name: "既存と改善案を比較する" };
