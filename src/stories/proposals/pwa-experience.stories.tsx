import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Check, Download, RefreshCw, Share2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import "./proposal.css";

type Props = { state: "install" | "offline" | "update"; platform: "ios" | "android" };

function PwaExperience({ state, platform }: Props) {
  const [showGuide, setShowGuide] = useState(false);
  const [retry, setRetry] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [saved, setSaved] = useState(false);
  return <div className="proposal-pwa-preview"><p className="proposal-review-label">承認前のPWAモック · インストールや回答送信は行いません</p><div className="proposal proposal-pwa-window">
    <header className="proposal-app-bar"><span className="proposal-logo">AkiMatch</span></header>
    <main className="proposal-main">
      {state === "offline" ? <section className="proposal-panel proposal-pwa-message"><WifiOff size={28} aria-hidden="true" /><h1>いまは接続できません</h1><p>通信環境を確認して、もう一度読み込んでください。回答の保存にはインターネット接続が必要です。</p><Button className="proposal-primary h-12" type="button" onClick={() => setRetry(true)}><RefreshCw aria-hidden="true" />再読み込み</Button>{retry ? <p role="status" className="proposal-helper">再読み込みの操作をプレビューしました。</p> : null}</section> : <>
        <div className="proposal-event-heading"><div><span className="proposal-kicker">日程調整</span><h1>ゼミの打ち合わせ</h1><p className="proposal-meta">10/12 (月) 〜 10/18 (日)</p></div></div>
        <section className="proposal-panel"><span className="proposal-kicker">いちばん集まりやすい時間</span><h2>10/14 (水) 19:00〜21:00</h2><p>4/4人が参加可能</p></section>
        {state === "update" ? <><section className="proposal-panel"><h2>入力中の回答</h2><p>さくら · 10/14 (水) 19:00〜21:00</p><Button className="proposal-primary h-12 mt-4 w-full" type="button" onClick={() => setSaved(true)}>{saved ? <Check aria-hidden="true" /> : null}{saved ? "保存済み" : "回答を保存する"}</Button></section>{!dismissed ? <section className="proposal-returning" role="status"><strong>新しいバージョンを利用できます</strong><p>{saved ? "回答を保存しました。更新できます。" : "入力中の回答があります。保存してから更新してください。"}</p><div className="proposal-inline-actions"><Button className="h-11" type="button" variant="outline" disabled={!saved} onClick={() => setDismissed(true)}><RefreshCw aria-hidden="true" />更新する</Button><Button className="h-11" type="button" variant="ghost" onClick={() => setDismissed(true)}>後で</Button></div></section> : <p className="proposal-helper" role="status">更新案内を閉じました。</p>}</> : <section className="proposal-panel proposal-install"><div><Download size={22} aria-hidden="true" /><h2>ホーム画面から開けます</h2></div><p className="proposal-helper">AkiMatchをホーム画面に追加すると、次回からすぐに開けます。</p><Button className="proposal-primary h-12 w-full" type="button" onClick={() => setShowGuide((value) => !value)}>{showGuide ? "追加の案内を閉じる" : "ホーム画面に追加"}</Button>{showGuide ? <div className="proposal-install-guide" role="status">{platform === "ios" ? <><strong>iPhoneのSafariで追加する</strong><ol><li>Safariの共有ボタン <Share2 size={15} aria-hidden="true" /> を開く。</li><li>「ホーム画面に追加」を選ぶ。</li><li>名前を確認して「追加」を押す。</li></ol></> : <><strong>Androidで追加する</strong><p>Chromeのメニューから「ホーム画面に追加」または「アプリをインストール」を選びます。</p></>}</div> : null}</section>}
      </>}
    </main>
  </div></div>;
}
const meta = { title: "Review/PWA proposal", component: PwaExperience, parameters: { layout: "centered" }, args: { state: "install", platform: "ios" }, argTypes: { state: { control: "select", options: ["install", "offline", "update"] }, platform: { control: "select", options: ["ios", "android"] } } } satisfies Meta<typeof PwaExperience>;
export default meta;
type Story = StoryObj<typeof meta>;
export const HomeScreen: Story = { name: "ホーム画面への追加" };
export const Offline: Story = { name: "オフライン時の案内", args: { state: "offline" } };
export const UpdateWhileEditing: Story = { name: "入力中の更新案内", args: { state: "update" } };
