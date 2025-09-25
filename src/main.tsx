import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Load QR debug helper in development mode
if (import.meta.env.DEV) {
  import('./utils/qrDebugHelper').catch(console.error);
}

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);