import { useEffect, useState } from 'react';

type InstallChoice = 'accepted' | 'dismissed';
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: InstallChoice; platform: string }>;
}

function isInstalled(): boolean {
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches === true || iosNavigator.standalone === true;
}

function installationSteps(): { title: string; instructions: string } {
  const ua = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  if (iOS) return { title: 'Add RINGFALL to your Home Screen', instructions: 'Open this page in your browser, tap Share, choose “Add to Home Screen”, then tap Add. On iPad, the Share button may be in the browser toolbar.' };
  if (/Safari/i.test(ua) && !/(Chrome|Chromium|CriOS|Edg|OPR|Firefox)/i.test(ua)) return { title: 'Install RINGFALL on your Mac', instructions: 'In Safari, choose File → Add to Dock. The game then opens from your Dock as its own app window.' };
  return { title: 'Install RINGFALL from your browser', instructions: 'Open the browser menu or address-bar install icon and choose “Install app”, “Install RINGFALL”, or “Add to Home screen”. The exact wording depends on your browser and device.' };
}

export function InstallGame() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isInstalled);
  const [showHelp, setShowHelp] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setPromptEvent(null); setShowHelp(false); setNotice('RINGFALL is installed on this device.'); };
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return <p className="install-game__notice" role="status">{notice || 'RINGFALL is installed on this device.'}</p>;

  const install = async () => {
    setNotice('');
    if (!promptEvent) { setShowHelp(value => !value); return; }
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setPromptEvent(null);
    if (choice.outcome === 'accepted') setNotice('RINGFALL is installing.');
    else setNotice('Install dismissed. You can install later from this button or your browser menu.');
  };

  const steps = installationSteps();
  const helpAnnouncement = showHelp ? `Installation instructions expanded: ${steps.title}. ${steps.instructions}` : '';

  return <div className="install-game">
    <p className="sr-only" role="status" aria-live="polite">{notice || helpAnnouncement}</p>
    <button
      className="button button--quiet install-game__button"
      type="button"
      onClick={() => { void install(); }}
      aria-expanded={showHelp}
      aria-label={promptEvent ? 'INSTALL RINGFALL: install app to your device' : 'INSTALL / ADD TO HOME SCREEN: view device installation instructions'}
    >
      {promptEvent ? 'INSTALL RINGFALL' : 'INSTALL / ADD TO HOME SCREEN'}
    </button>
    {showHelp && <aside className="install-game__help">
      <strong>{steps.title}</strong>
      <p>{steps.instructions}</p>
      <small>Install requires a secure HTTPS page. Offline play is limited to game resources your browser cached during an earlier online visit; multiplayer always needs an internet connection.</small>
    </aside>}
    {notice && <p className="install-game__notice">{notice}</p>}
  </div>;
}
