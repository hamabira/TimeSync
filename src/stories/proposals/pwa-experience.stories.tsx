import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PwaInstallPromptView,
  PwaUpdateNoticeView,
} from "@/components/pwa-install-prompt";
import "./proposal.css";

type Props = {
  state: "install" | "offline" | "update";
  platform: "ios" | "android";
  browser: "safari" | "other";
  standalone: boolean;
  guideOpen: boolean;
  updateDraft: "clean" | "dirty" | "saving";
};

function InstallPreview({ platform, browser, standalone, guideOpen }: Pick<Props, "platform" | "browser" | "standalone" | "guideOpen">) {
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

function PwaExperience({ state, platform, browser, standalone, guideOpen, updateDraft }: Props) {
  if (state === "install") {
    return <InstallPreview key={`${platform}-${browser}-${standalone}-${guideOpen}`} platform={platform} browser={browser} standalone={standalone} guideOpen={guideOpen} />;
  }

  return <PwaFollowUpProposal state={state} updateDraft={updateDraft} />;
}

function PwaFollowUpProposal({ state, updateDraft }: Pick<Props, "state" | "updateDraft">) {
  const [retry, setRetry] = useState(false);
  const [updatePreviewed, setUpdatePreviewed] = useState(false);
  const isDirty = updateDraft === "dirty";
  const isBusy = updateDraft === "saving";

  return (
    <div className="proposal-pwa-preview">
      <p className="proposal-review-label">
        {state === "offline"
          ? "オフライン画面の表示例 · 実際の通信切断はStorybookでは発生しません"
          : "本番の更新通知コンポーネント · StorybookではService Workerの登録や更新を行いません"}
      </p>
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
                <p>{updateDraft === "clean" ? "前回保存済み · さくら · 10/14 (水) 19:00〜21:00" : "さくら · 10/14 (水) 19:00〜21:00"}</p>
                {isDirty ? <p className="proposal-helper">保存していない変更があります。</p> : null}
                {isBusy ? <p className="proposal-helper" role="status">回答を保存しています。</p> : null}
              </section>
              <PwaUpdateNoticeView
                state="waiting"
                isDirty={isDirty}
                isBusy={isBusy}
                onApplyUpdate={() => setUpdatePreviewed(true)}
              />
              {updatePreviewed ? (
                <p className="proposal-helper" role="status">
                  更新ボタンの動作をプレビューしました。Storybookではページを再読み込みしません。
                </p>
              ) : null}
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
    updateDraft: "dirty",
  },
  argTypes: {
    state: { control: "select", options: ["install", "offline", "update"] },
    platform: { control: "select", options: ["ios", "android"] },
    browser: { control: "select", options: ["safari", "other"] },
    standalone: { control: "boolean" },
    guideOpen: { control: "boolean" },
    updateDraft: { control: "select", options: ["clean", "dirty", "saving"] },
  },
} satisfies Meta<typeof PwaExperience>;
export default meta;
type Story = StoryObj<typeof meta>;

export const HomeScreen: Story = { name: "iPhone Safari · 追加方法", args: { state: "install", platform: "ios", browser: "safari", guideOpen: true } };
export const AndroidInstallAvailable: Story = { name: "Android · インストール可能", args: { state: "install", platform: "android", guideOpen: false } };
export const IOSOtherBrowser: Story = { name: "iPhone · Safariで開く案内", args: { state: "install", platform: "ios", browser: "other", guideOpen: false } };
export const AlreadyInstalled: Story = { name: "インストール済み · 案内を非表示", args: { state: "install", platform: "android", standalone: true, guideOpen: false } };
export const Offline: Story = { name: "オフライン画面の表示例", args: { state: "offline" } };
export const UpdateWhileEditing: Story = { name: "未保存の入力がある", args: { state: "update", updateDraft: "dirty" } };
export const UpdateAvailable: Story = { name: "保存済み・更新可能", args: { state: "update", updateDraft: "clean" } };
export const UpdateWhileSaving: Story = { name: "回答を保存中", args: { state: "update", updateDraft: "saving" } };
