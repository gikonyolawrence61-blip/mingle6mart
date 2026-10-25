import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "minglemart.installPromptDismissedAt";
const DISMISS_FOR_DAYS = 7;

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function PWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone()) return;

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_FOR_DAYS * 24 * 60 * 60 * 1000) return;

    setHidden(false);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setHidden(true);
      setInstallPrompt(null);
      setShowGuide(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setHidden(true);
    setShowGuide(false);
  };

  const install = async () => {
    if (!installPrompt) {
      setShowGuide((current) => !current);
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setHidden(true);
    }
    setInstallPrompt(null);
  };

  if (hidden || isStandalone()) return null;

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  return (
    <aside className="mm-install-card" aria-label="Install MingleMart">
      <div className="mm-install-icon" aria-hidden="true">M</div>
      <div className="mm-install-copy">
        <strong>Take MingleMart with you</strong>
        <span>Install it on your phone for quick access—it's free.</span>
      </div>
      <button className="mm-install-action" onClick={install}>
        {installPrompt ? "Install app" : "How to install"}
      </button>
      <button className="mm-install-close" onClick={dismiss} aria-label="Dismiss install message">×</button>

      {showGuide && (
        <div className="mm-install-guide">
          <strong>Install MingleMart in seconds</strong>
          {isIOS ? (
            <p>In Safari, tap the Share button, then choose <b>Add to Home Screen</b> and tap Add.</p>
          ) : (
            <p>In Chrome, tap the three dots <b>⋮</b>, choose <b>Install app</b> or <b>Add to Home screen</b>, then confirm.</p>
          )}
          <p>You can keep using MingleMart in your browser if you prefer.</p>
          <button onClick={() => setShowGuide(false)}>Got it</button>
        </div>
      )}
    </aside>
  );
}