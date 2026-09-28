import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing root element');

// The suspended Rapier/Canvas mount owns a WebGL context. Replaying its mount
// cleanup in development can dispose the replacement context mid-match.
createRoot(root).render(<App />);

// Register after mounting so a slow or unavailable service worker never delays play.
if ('serviceWorker' in navigator && window.isSecureContext) {
  void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
    // Installation can still use the manifest/browser shortcut without offline caching.
  });
}
