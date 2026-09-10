import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing root element');

// The suspended Rapier/Canvas mount owns a WebGL context. Replaying its mount
// cleanup in development can dispose the replacement context mid-match.
createRoot(root).render(<App />);
