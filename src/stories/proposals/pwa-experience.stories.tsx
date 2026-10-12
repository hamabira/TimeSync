import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Check, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PwaInstallPromptView } from "@/components/pwa-install-prompt";
import "./proposal.css";

type Props = {
  state: "install" | "offline" | "update";
  platform: "ios" | "android";
  browser: "safari" | "other";
  standalone: boolean;
  guideOpen: boolean;
};

function InstallPreview({ platform, browser, standalone, guideOpen }: Props) {
  const [guideOverride, setGuideOverride] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [notice, setNotice] = useState<{ tone: "info"; message: string } | null>(null);
  const showGuide = guideOverride ?? guideOpen;
  const installAvailable = platform === "android" && !installDismissed;

  return (
    <div className="proposal-pwa-preview">
      <p className="proposal-review-label">
        実装済みの本番コンポーネント · Storybookでは実際のインストールは行いません
      </p>
      <div className="proposal proposal-pwa-window">
        <header className="proposal-app-bar"><span className="proposal-logo">AkiMatch</span></header>
        <main className="proposal-main">
          {dismissed ? <p role="status" className="proposal-helper">追加案内を閉じました。</p> : standalone ? (
            <p className="proposal-helper" role="status">
              standalone / fullscreen 表示ではインストール案内を表示しません。
            </p>
          ) : (
            <PwaInstallPromptView
              platform={platform === "ios" ? "ios" : "installable"}
              isSafari={browser === "safari"}
              isInstallAvailable={installAvailable}
              isStandalone={standalone}
              guideOpen={showGuide}
              notice={notice}
              onDismiss={() => setDismissed(true)}
              onToggleGuide={() => setGuideOverride((open) => !(open ?? guideOpen))}
              onInstall={() => {
                setInstallDismissed(true);
                setNotice({
                  tone: "info",
                  message: "これはStorybookのプレビューです。端末へのインストールは行っていません。",
                });
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function PwaExperience({ state, platform, browser, standalone, guideOpen }: Props) {
  if (state === "install") {
    return <InstallPreview key={`${platform}-${browser}-${standalone}-${guideOpen}`} platform={platform} browser={browser} standalone={standalone} guideOpen={guideOpen} state={state} />;
  }

  return <PwaFollowUpProposal state={state} />;
}

function PwaFollowUpProposal({ state }: Pick<Props, "state">) {
  const [retry, setRetry] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <div className="proposal-pwa-preview">
      <p className="proposal-review-label">提案モック · オフライン/更新の実装はIssue 47の対象です</p>
      <div className="proposal proposal-pwa-window">
        <header className="proposal-app-bar"><span className="proposal-logo">AkiMatch</span></header>
        <main className="proposal-main">
          {state === "offline" ? (
            <section className="proposal-panel proposal-pwa-message">
              <WifiOff size={28} aria-hidden="true" />
              <h1>いまは接続できません</h1>
              <p>通信環境を確認して、もう一度読み込んでください。回答の保存にはインターネット接続が必要です。</p>
              <Button className="proposal-primary h-12" type="button" onClick={() => setRetry(true)}>
                <RefreshCw aria-hidden="true" />再読み込み
              </Button>
              {retry ? <p role="status" className="proposal-helper">再読み込みの操作をプレビューしました。</p> : null}
            </section>
          ) : (
            <>
              <div className="proposal-event-heading">
                <div><span className="proposal-kicker">日程調整</span><h1>ゼミの打ち合わせ</h1><p className="proposal-meta">10/12 (月) 〜 10/18 (日)</p></div>
              </div>
              <section className="proposal-panel">
                <h2>入力中の回答</h2>
                <p>さくら · 10/14 (水) 19:00〜21:00</p>
                <Button className="proposal-primary h-12 mt-4 w-full" type="button" onClick={() => setSaved(true)}>
                  {saved ? <Check aria-hidden="true" /> : null}{saved ? "保存済み" : "回答を保存する"}
                </Button>
              </section>
              {!dismissed ? (
                <section className="proposal-returning" role="status">
                  <strong>新しいバージョンを利用できます</strong>
                  <p>{saved ? "回答を保存しました。更新できます。" : "入力中の回答があります。保存してから更新してください。"}</p>
                  <div className="proposal-inline-actions">
                    <Button className="h-11" type="button" variant="outline" disabled={!saved} onClick={() => setDismissed(true)}>
                      <RefreshCw aria-hidden="true" />更新する
                    </Button>
                    <Button className="h-11" type="button" variant="ghost" onClick={() => setDismissed(true)}>後で</Button>
                  </div>
                </section>
              ) : <p className="proposal-helper" role="status">更新案内を閉じました。</p>}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

const meta = {
  title: "Review/PWA experience",
  component: PwaExperience,
  parameters: { layout: "centered" },
  args: {
    state: "install",
    platform: "ios",
    browser: "safari",
    standalone: false,
    guideOpen: true,
  },
  argTypes: {
    state: { control: "select", options: ["install", "offline", "update"] },
    platform: { control: "select", options: ["ios", "android"] },
    browser: { control: "select", options: ["safari", "other"] },
    standalone: { control: "boolean" },
    guideOpen: { control: "boolean" },
  },
} satisfies Meta<typeof PwaExperience>;
export default meta;
type Story = StoryObj<typeof meta>;

export const HomeScreen: Story = { name: "iPhone Safari · 追加方法", args: { state: "install", platform: "ios", browser: "safari", guideOpen: true } };
export const AndroidInstallAvailable: Story = { name: "Android · インストール可能", args: { state: "install", platform: "android", guideOpen: false } };
export const IOSOtherBrowser: Story = { name: "iPhone · Safariで開く案内", args: { state: "install", platform: "ios", browser: "other", guideOpen: false } };
export const AlreadyInstalled: Story = { name: "インストール済み · 案内を非表示", args: { state: "install", platform: "android", standalone: true, guideOpen: false } };
export const Offline: Story = { name: "オフライン時の提案モック", args: { state: "offline" } };
export const UpdateWhileEditing: Story = { name: "入力中の更新提案モック", args: { state: "update" } };
