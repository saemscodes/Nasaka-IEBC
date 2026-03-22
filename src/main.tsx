import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n'

// REQUEST PERSISTENT STORAGE - Mitigates QuotaExceededError and prevents data eviction
if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then(persistent => {
        if (persistent) {
            console.log("Storage will not be cleared except by explicit user action");
        } else {
            console.log("Storage may be cleared under storage pressure");
        }
    });
}

// TOTAL QUOTA FIX: One-time proactive cleanup of large tile caches
const QUOTA_FIX_VERSION = 'v2-micro-limits';
if (localStorage.getItem('nasaka_quota_fix') !== QUOTA_FIX_VERSION) {
    if ('caches' in window) {
        const tileCaches = ['osm-tiles-cache', 'satellite-tiles-cache', 'images-cache'];
        Promise.all(tileCaches.map(name => caches.delete(name))).then(() => {
            localStorage.setItem('nasaka_quota_fix', QUOTA_FIX_VERSION);
            console.log('[Nasaka] Proactive cache cleanup completed.');
        });
    }
}

createRoot(document.getElementById("root")!).render(<App />);
