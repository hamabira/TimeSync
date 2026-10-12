// Capture the browser's one-shot install event before React hydration.
// The root provider takes ownership and removes these listeners when it mounts.
export const INSTALL_CAPTURE_SCRIPT = `(() => {
  if (window.__akimatchInstallCapture) return;
  const capture = {
    prompt: null,
    installed: false,
    onPrompt(event) {
      event.preventDefault();
      capture.prompt = event;
      capture.installed = false;
    },
    onInstalled() {
      capture.prompt = null;
      capture.installed = true;
    }
  };
  window.__akimatchInstallCapture = capture;
  window.addEventListener("beforeinstallprompt", capture.onPrompt);
  window.addEventListener("appinstalled", capture.onInstalled);
})();`;

export type EarlyInstallCapture = {
  prompt: Event | null;
  installed: boolean;
  onPrompt: EventListener;
  onInstalled: EventListener;
};
