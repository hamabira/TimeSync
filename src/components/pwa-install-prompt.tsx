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
import { Download, X } from "lucide-react";
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

type PwaInstallContextValue = {
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

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
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
  const [isStandalone, setIsStandalone] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [wasInstalled, setWasInstalled] = useState(false);
  const [isInstallAvailable, setIsInstallAvailable] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [notice, setNotice] = useState<PwaInstallPromptNotice | null>(null);

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
  const value: PwaInstallContextValue = {
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
