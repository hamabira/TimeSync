"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { EarlyInstallCapture } from "@/lib/pwa-install-capture";
import {
  getPwaDraftProtectionStatus,
  usePwaDraftProtectionStatus,
} from "@/lib/pwa-draft-protection";
import {
  PwaUpdateController,
  type PwaUpdateServiceWorkerContainer,
  type PwaUpdateState,
} from "@/lib/pwa-updates";
import { Download, RefreshCw, Wifi, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type InstallablePlatform = "ios" | "installable";

export type PwaInstallPromptNotice = {
  tone: "info" | "error";
  message: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type PwaEnvironment = {
  platform: InstallablePlatform;
  isSafari: boolean;
};

type PwaEnvironmentSnapshot = "ios-safari" | "ios-other" | "installable";

export type PwaInstallPromptViewProps = {
  platform: InstallablePlatform;
  isSafari?: boolean;
  isInstallAvailable?: boolean;
  isStandalone?: boolean;
  isInstalling?: boolean;
  guideOpen?: boolean;
  notice?: PwaInstallPromptNotice | null;
  onInstall?: () => void;
  onToggleGuide?: () => void;
  onDismiss?: () => void;
};

export type PwaUpdateNoticeViewProps = {
  state: PwaUpdateState;
  isDirty: boolean;
  isBusy: boolean;
  onApplyUpdate?: () => void;
};

export type PwaConnectionNoticeViewProps = {
  state: "offline" | "reconnected" | null;
  isOnline: boolean;
  isDirty: boolean;
  isBusy: boolean;
  onRetry?: () => void;
  onDismiss?: () => void;
};

type PwaInstallContextValue = {
  runtimeNotice: ReactNode;
  environment: PwaEnvironment | null;
  isStandalone: boolean | null;
  wasInstalled: boolean;
  isInstallAvailable: boolean;
  isInstalling: boolean;
  guideOpen: boolean;
  notice: PwaInstallPromptNotice | null;
  handleInstall: () => Promise<void>;
  toggleGuide: () => void;
  dismissed: boolean;
  dismiss: () => void;
};

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

function subscribeToOnlineStatus(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

function getOnlineSnapshot() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function getServerOnlineSnapshot() {
  return true;
}

function detectEnvironment(): PwaEnvironment {
  const userAgent = navigator.userAgent;
  const isIOS =
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari =
    /Safari/i.test(userAgent) &&
    !/(CriOS|FxiOS|EdgiOS|OPiOS|Ddg|DuckDuckGo|FBAN|FBAV|Instagram|Line\/|Twitter|MicroMessenger|GSA|Slack|LinkedInApp|Pinterest|TikTok)/i.test(
      userAgent
    );

  return { platform: isIOS ? "ios" : "installable", isSafari };
}

function subscribeToEnvironment() {
  return () => {};
}

function getEnvironmentSnapshot(): PwaEnvironmentSnapshot | null {
  if (typeof navigator === "undefined") return null;
  const environment = detectEnvironment();
  if (environment.platform === "installable") return "installable";
  return environment.isSafari ? "ios-safari" : "ios-other";
}

function getServerEnvironmentSnapshot(): null {
  return null;
}

export function PwaInstallPromptView({
  platform,
  isSafari = true,
  isInstallAvailable = false,
  isStandalone = false,
  isInstalling = false,
  guideOpen = false,
  notice = null,
  onInstall,
  onToggleGuide,
  onDismiss,
}: PwaInstallPromptViewProps) {
  if (isStandalone || (platform === "installable" && !isInstallAvailable && !notice)) {
    return null;
  }

  return (
    <section
      aria-labelledby="pwa-install-title"
      className="relative rounded-2xl border border-blue-200 bg-blue-50/70 p-4 shadow-sm sm:flex sm:flex-wrap sm:items-start sm:justify-between sm:gap-5"
    >
      {onDismiss ? (
        <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 size-11" aria-label="追加案内を閉じる" onClick={onDismiss}><X aria-hidden="true" className="size-4" /></Button>
      ) : null}
      <div className="flex min-w-0 items-start gap-3 sm:basis-72 sm:flex-1">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
          <Download aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id="pwa-install-title" className="pr-8 font-semibold text-slate-900">
            ホーム画面に追加
          </h2>
          {platform === "ios" ? (
            isSafari ? (
              <>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  ホーム画面からはAkiMatchのトップページが開きます。イベントに戻るには共有URLを使ってください。
                </p>
                <div
                  id="pwa-install-guide"
                  hidden={!guideOpen}
                  className="mt-3 rounded-xl border border-blue-200 bg-white p-3 text-sm leading-6 text-slate-700"
                  role="region"
                  aria-label="Safariでホーム画面に追加する手順"
                >
                  <p className="font-medium text-slate-900">iPhone・iPadのSafariで追加する</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5">
                    <li>Safariの共有ボタン、またはページメニューの「共有」を開きます。</li>
                    <li>メニューから「ホーム画面に追加」を選びます。</li>
                    <li>「ウェブアプリとして開く」が表示されたらオンにして、「追加」をタップします。</li>
                  </ol>
                    <p className="mt-2 text-xs text-slate-500">項目が見つからない場合は、Safariでこのページを開き直してください。</p>
                </div>
              </>
            ) : (
              <p className="mt-1 text-sm leading-6 text-slate-600">
                このブラウザの共有メニューで「ホーム画面に追加」を探してください。見つからない場合はSafariでこのページを開き、追加方法を確認してください。
              </p>
            )
          ) : (
            <p className="mt-1 text-sm leading-6 text-slate-600">
              ホーム画面からはAkiMatchのトップページが開きます。イベントに戻るには共有URLを使ってください。
            </p>
          )}
          {notice ? (
            <p
              className={`mt-2 text-sm ${notice.tone === "error" ? "text-red-700" : "text-blue-800"}`}
              role={notice.tone === "error" ? "alert" : "status"}
            >
              {notice.message}
            </p>
          ) : null}
        </div>
      </div>

      {platform === "ios" && isSafari ? (
        <Button
          type="button"
          variant="outline"
          aria-expanded={guideOpen}
          aria-controls="pwa-install-guide"
          className="mt-3 min-h-11 w-full shrink-0 border-blue-300 bg-white text-blue-800 hover:bg-blue-100 sm:mr-8 sm:mt-0 sm:w-auto"
          onClick={onToggleGuide}
        >
          {guideOpen ? "追加方法を閉じる" : "追加方法を見る"}
        </Button>
      ) : null}

      {platform === "installable" && isInstallAvailable ? (
        <Button
          type="button"
          className="mt-3 min-h-11 w-full shrink-0 bg-blue-700 text-white hover:bg-blue-800 sm:mr-8 sm:mt-0 sm:w-auto"
          onClick={onInstall}
          disabled={isInstalling}
        >
          {isInstalling ? "準備しています…" : "インストール"}
        </Button>
      ) : null}
    </section>
  );
}

export function PwaUpdateNoticeView({
  state,
  isDirty,
  isBusy,
  onApplyUpdate,
}: PwaUpdateNoticeViewProps) {
  if (state === "hidden") return null;
  const actionBlocked = isDirty || isBusy;
  const isReloadNeeded = state === "reload-needed";

  return (
    <section
      aria-labelledby="pwa-update-title"
      className="rounded-2xl border border-blue-200 bg-white p-4 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
          <RefreshCw aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="pwa-update-title" className="font-semibold text-slate-900">
            {state === "activating" ? "更新を適用しています" : isReloadNeeded ? "更新を適用しました" : "新しいバージョンを利用できます"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {state === "activating"
              ? "準備ができるとページが更新されます。"
              : isReloadNeeded
                ? actionBlocked
                  ? "入力中の内容を保存してから再読み込みしてください。"
                  : "再読み込みすると新しいバージョンを利用できます。"
                : isBusy
                  ? "回答を保存中です。保存が終わってから更新してください。"
                  : isDirty
                    ? "入力中の内容があります。保存してから更新してください。"
                    : "更新を適用して、最新の状態を利用できます。"}
          </p>
          {state !== "activating" ? (
            <Button
              type="button"
              variant="outline"
              className="mt-3 min-h-11 border-blue-300 text-blue-800 hover:bg-blue-50"
              disabled={actionBlocked}
              onClick={onApplyUpdate}
            >
              {isReloadNeeded ? "再読み込み" : "更新する"}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function PwaConnectionNoticeView({
  state,
  isOnline,
  isDirty,
  isBusy,
  onRetry,
  onDismiss,
}: PwaConnectionNoticeViewProps) {
  if (!state) return null;
  const actionBlocked = !isOnline || isDirty || isBusy;

  return (
    <section
      className={`rounded-2xl border p-4 shadow-lg ${state === "offline" ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-white"}`}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl ${state === "offline" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
          {state === "offline" ? <WifiOff aria-hidden="true" className="size-5" /> : <Wifi aria-hidden="true" className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-slate-900">
            {state === "offline" ? "インターネットに接続できません" : "接続が戻りました"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {state === "offline"
              ? "回答の保存には接続が必要です。入力内容はこの画面に残っています。"
              : actionBlocked
                ? "入力中の内容を保存してから再読み込みできます。"
                : "最新の状態を確認するには、手動で再読み込みしてください。"}
          </p>
          {state === "reconnected" ? (
            <Button
              type="button"
              variant="outline"
              className="mt-3 min-h-11 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
              disabled={actionBlocked}
              onClick={onRetry}
            >
              再読み込み
            </Button>
          ) : null}
          {state === "reconnected" && onDismiss ? (
            <Button type="button" variant="ghost" className="mt-3 ml-2 min-h-11" onClick={onDismiss}>
              閉じる
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const updateControllerRef = useRef<PwaUpdateController | null>(null);
  const environmentSnapshot = useSyncExternalStore(
    subscribeToEnvironment,
    getEnvironmentSnapshot,
    getServerEnvironmentSnapshot
  );
  const environment: PwaEnvironment | null = environmentSnapshot
    ? {
        platform: environmentSnapshot === "installable" ? "installable" : "ios",
        isSafari: environmentSnapshot === "ios-safari",
      }
    : null;
  const isOnline = useSyncExternalStore(
    subscribeToOnlineStatus,
    getOnlineSnapshot,
    getServerOnlineSnapshot
  );
  const draftProtection = usePwaDraftProtectionStatus();
  const [isStandalone, setIsStandalone] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [wasInstalled, setWasInstalled] = useState(false);
  const [isInstallAvailable, setIsInstallAvailable] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [notice, setNotice] = useState<PwaInstallPromptNotice | null>(null);
  const [connectionNotice, setConnectionNotice] = useState<"offline" | "reconnected" | null>(null);
  const [updateState, setUpdateState] = useState<PwaUpdateState>("hidden");

  useEffect(() => {
    const handleOffline = () => setConnectionNotice("offline");
    const handleOnline = () => setConnectionNotice("reconnected");
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !window.isSecureContext || !("serviceWorker" in navigator)) {
      return;
    }

    const controller = new PwaUpdateController({
      serviceWorker: navigator.serviceWorker as unknown as PwaUpdateServiceWorkerContainer,
      canReload: () => {
        const currentDrafts = getPwaDraftProtectionStatus();
        return !currentDrafts.hasDirtyDraft && !currentDrafts.hasBusyForm;
      },
      reload: () => window.location.reload(),
      onStateChange: setUpdateState,
    });
    updateControllerRef.current = controller;
    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") void controller.checkForUpdate();
    };
    const checkWhenOnline = () => void controller.checkForUpdate();

    document.addEventListener("visibilitychange", checkWhenVisible);
    window.addEventListener("online", checkWhenOnline);
    void controller.start();

    return () => {
      document.removeEventListener("visibilitychange", checkWhenVisible);
      window.removeEventListener("online", checkWhenOnline);
      controller.stop();
      if (updateControllerRef.current === controller) updateControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const displayModes = [
      window.matchMedia("(display-mode: standalone)"),
      window.matchMedia("(display-mode: fullscreen)"),
    ];
    const updateStandalone = () => {
      const isIOSStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
      setIsStandalone(isIOSStandalone || displayModes.some((mode) => mode.matches));
    };
    const handleBeforeInstallPrompt: EventListener = (event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      deferredPromptRef.current = installEvent;
      setIsInstallAvailable(true);
      setWasInstalled(false);
      setDismissed(false);
      setNotice(null);
    };
    const handleAppInstalled = () => {
      deferredPromptRef.current = null;
      setIsInstallAvailable(false);
      setWasInstalled(true);
      setNotice(null);
    };

    const earlyWindow = window as Window & { __akimatchInstallCapture?: EarlyInstallCapture };
    const early = earlyWindow.__akimatchInstallCapture;
    if (early) {
      window.removeEventListener("beforeinstallprompt", early.onPrompt);
      window.removeEventListener("appinstalled", early.onInstalled);
      delete earlyWindow.__akimatchInstallCapture;
      if (early.prompt) handleBeforeInstallPrompt(early.prompt);
      if (early.installed) handleAppInstalled();
    }
    updateStandalone();
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    displayModes.forEach((mode) => mode.addEventListener("change", updateStandalone));

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      displayModes.forEach((mode) => mode.removeEventListener("change", updateStandalone));
    };
  }, []);

  const handleInstall = useCallback(async () => {
    const deferredPrompt = deferredPromptRef.current;
    if (!deferredPrompt || isInstalling) return;

    deferredPromptRef.current = null;
    setIsInstalling(true);
    setNotice(null);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (deferredPromptRef.current === null) setNotice({
        tone: "info",
        message:
          choice.outcome === "accepted"
            ? "インストールを開始しました。完了するとこの案内は閉じます。"
            : "今回はインストールを見送りました。必要になったらブラウザのメニューから追加できます。",
      });
    } catch {
      if (deferredPromptRef.current === null) setNotice({
        tone: "error",
        message: "インストール案内を開けませんでした。ブラウザのメニューから追加できるかご確認ください。",
      });
    } finally {
      setIsInstallAvailable(deferredPromptRef.current !== null);
      setIsInstalling(false);
    }
  }, [isInstalling]);

  const toggleGuide = useCallback(() => setGuideOpen((open) => !open), []);


  const connectionState = isOnline ? connectionNotice : "offline";
  const runtimeNoticeVisible = connectionState !== null || updateState !== "hidden";
  const applyUpdate = () => updateControllerRef.current?.activateOrReload();
  const retryConnection = () => {
    const currentDrafts = getPwaDraftProtectionStatus();
    if (!isOnline || currentDrafts.hasDirtyDraft || currentDrafts.hasBusyForm) return;
    window.location.reload();
  };

  const runtimeNotice = runtimeNoticeVisible ? (
    <div className="mx-auto mb-6 w-full max-w-3xl space-y-3">
      <PwaConnectionNoticeView
        state={connectionState}
        isOnline={isOnline}
        isDirty={draftProtection.hasDirtyDraft}
        isBusy={draftProtection.hasBusyForm}
        onRetry={retryConnection}
        onDismiss={() => setConnectionNotice(null)}
      />
      <PwaUpdateNoticeView
        state={updateState}
        isDirty={draftProtection.hasDirtyDraft}
        isBusy={draftProtection.hasBusyForm}
        onApplyUpdate={applyUpdate}
      />
    </div>
  ) : null;
  const value: PwaInstallContextValue = {
    runtimeNotice,
    environment,
    isStandalone,
    wasInstalled,
    isInstallAvailable,
    isInstalling,
    guideOpen,
    notice,
    handleInstall,
    toggleGuide,
    dismissed,
    dismiss: () => setDismissed(true),
  };

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>;
}

export function PwaRuntimeNotices() {
  const runtimeNotice = useContext(PwaInstallContext)?.runtimeNotice ?? null;
  return <div aria-live="polite">{runtimeNotice}</div>;
}

export function PwaInstallPrompt() {
  const installContext = useContext(PwaInstallContext);
  if (
    !installContext ||
    !installContext.environment ||
    installContext.isStandalone !== false ||
    installContext.wasInstalled ||
    installContext.dismissed
  ) {
    return null;
  }

  return (
    <PwaInstallPromptView
      platform={installContext.environment.platform}
      isSafari={installContext.environment.isSafari}
      isInstallAvailable={installContext.isInstallAvailable}
      isStandalone={false}
      isInstalling={installContext.isInstalling}
      guideOpen={installContext.guideOpen}
      notice={installContext.notice}
      onInstall={installContext.handleInstall}
      onToggleGuide={installContext.toggleGuide}
      onDismiss={installContext.dismiss}
    />
  );
}
