import React, { useEffect, useMemo, useState } from 'react';
import TitleBar from '../components/TitleBar.jsx';
import MobileNav from '../components/MobileNav.jsx';
import ToastStack from '../components/ToastStack.jsx';
import Home from '../pages/Home.jsx';
import Downloads from '../pages/Downloads.jsx';
import Converter from '../pages/Converter.jsx';
import Settings from '../pages/Settings.jsx';
import { useSettings } from '../hooks/useSettings.js';
import { useToasts } from '../hooks/useToasts.js';
import { downTube } from '../services/downTube.js';

const pages = {
  home: Home,
  downloads: Downloads,
  converter: Converter,
  settings: Settings
};

function loadFont(font) {
  if (!font || font === 'System') return;
  const fontId = `font-${font.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(fontId)) return;
  const link = document.createElement('link');
  link.id = fontId;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/\s+/g, '+')}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

export default function App() {
  const [page, setPage] = useState('home');
  const [updateInfo, setUpdateInfo] = useState(null);
  const [appMode, setAppMode] = useState({ offline: false, converterOnly: false, ffmpegAvailable: false });
  const { settings, saveSettings } = useSettings();
  const { toasts, push } = useToasts();

  const ActivePage = useMemo(() => pages[page] || Home, [page]);

  useEffect(() => {
    if (!settings) return;
    document.documentElement.dataset.theme = settings.theme || 'light';
    loadFont(settings.font || 'Ubuntu');
    document.body.style.fontFamily = settings.font === 'System'
      ? 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial'
      : settings.font || 'Ubuntu';
  }, [settings]);

  useEffect(() => {
    (async () => {
      try {
        const result = await downTube.checkForUpdates();
        if (result?.ok && result?.hasUpdate) {
          setUpdateInfo(result.updateInfo);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const mode = await downTube.getAppMode();
        if (mode) setAppMode(mode);
      } catch {
        // ignore
      }
    })();
    downTube.onAppMode((mode) => {
      if (mode) setAppMode(mode);
    });
  }, []);

  const converterOnly = !!appMode?.converterOnly;
  const offline = !!appMode?.offline;
  const disabledPages = converterOnly ? ['home', 'downloads', 'settings'] : [];
  const isLocked = converterOnly && page !== 'converter';

  return (
    <div className="app-shell">
      <TitleBar
        title="DownTube"
        subtitle="Youtube Toolkit"
        updateInfo={updateInfo}
        onUpdateClick={() => updateInfo && downTube.showUpdateDialog(updateInfo)}
      />
      <div className="app-content">
        <div className="max-w-5xl mx-auto px-6 pb-28 pt-6">
          {converterOnly ? (
            <div className="dt-card-soft p-4 mb-4">
              <div className="text-sm font-semibold">Offline mode</div>
              <div className="text-xs dt-muted">
                {offline
                  ? 'Only the Converter is available while you are offline.'
                  : 'Limited mode is active.'}
              </div>
            </div>
          ) : null}
          <div className="relative">
            <div className={isLocked ? 'pointer-events-none blur-sm' : ''}>
              <ActivePage
                settings={settings}
                saveSettings={saveSettings}
                notify={push}
                updateInfo={updateInfo}
                onNavigate={setPage}
              />
            </div>
            {isLocked ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="dt-card-soft p-4 text-center">
                  <div className="text-sm font-semibold">Converter only</div>
                  <div className="text-xs dt-muted mt-1">
                    Offline mode is active. Open the Converter tab to continue.
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <MobileNav active={page} onChange={setPage} disabledIds={disabledPages} />
      <ToastStack toasts={toasts} />
    </div>
  );
}
