import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { downTube } from '../services/downTube.js';
import Select from '../components/Select.jsx';
import Toggle from '../components/Toggle.jsx';

export default function Settings({ settings, saveSettings, notify }) {
  const [appInfo, setAppInfo] = useState(null);
  const [local, setLocal] = useState(settings);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [releaseNotes, setReleaseNotes] = useState(null);

  useEffect(() => {
    setLocal(settings);
  }, [settings]);

  useEffect(() => {
    (async () => {
      const info = await downTube.getAppInfo();
      setAppInfo(info);
      const prefs = await downTube.getUpdatePreferences();
      if (prefs?.preferences?.lastCheck) {
        setUpdateInfo({ lastCheck: prefs.preferences.lastCheck });
      }
    })();
  }, []);

  const handleSave = async () => {
    const next = {
      theme: local.theme,
      font: local.font,
      defaultOutputDir: local.defaultOutputDir,
      maxConcurrent: Number(local.maxConcurrent || 3),
      cookiesPath: local.cookiesPath || '',
      showCompleteDialog: !!local.showCompleteDialog,
      openFolderOnComplete: !!local.openFolderOnComplete
    };
    await saveSettings(next);
    notify('Settings saved');
  };

  const checkUpdates = async () => {
    const result = await downTube.checkForUpdates();
    if (result?.ok && result?.hasUpdate) {
      setUpdateInfo(result.updateInfo);
    } else {
      notify('You are on the latest version');
    }
  };

  const fontOptions = ['Ubuntu', 'Poppins', 'Inter', 'Geist Mono', 'System'].map((f) => ({
    value: f,
    label: f
  }));

  const concurrencyOptions = [1, 2, 3, 4, 5].map((n) => ({
    value: n,
    label: String(n)
  }));

  return (
    <div className="space-y-6">
      <section className="dt-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="dt-label">Settings</p>
            <h2 className="text-2xl font-semibold">App preferences</h2>
            <p className="text-sm dt-muted">Customize the app to match your workflow.</p>
          </div>
          <button onClick={handleSave} className="dt-button dt-button-primary">
            Save settings
          </button>
        </div>

        <div className="mt-6 grid md:grid-cols-2 gap-4">
          <div className="dt-card-soft p-4">
            <label className="dt-label">Theme</label>
            <div className="dt-segment mt-2">
              {['light', 'dark'].map((t) => (
                <button
                  key={t}
                  onClick={() => setLocal({ ...local, theme: t })}
                  className={`dt-segment-btn ${local?.theme === t ? 'active' : ''}`}
                >
                  {t === 'light' ? 'Light' : 'Dark'}
                </button>
              ))}
            </div>
          </div>
          <div className="dt-card-soft p-4">
            <Select
              label="Font"
              value={local.font || 'Ubuntu'}
              options={fontOptions}
              onChange={(val) => setLocal({ ...local, font: val })}
            />
            <div className="mt-2 text-xs dt-muted">Preview: The UI updates after saving.</div>
          </div>
          <div className="dt-card-soft p-4 md:col-span-2">
            <label className="dt-label">Default download folder</label>
            <div className="mt-2 flex flex-col md:flex-row gap-3">
              <input
                value={local.defaultOutputDir || ''}
                onChange={(e) => setLocal({ ...local, defaultOutputDir: e.target.value })}
                className="dt-input flex-1"
              />
              <button
                className="dt-button dt-button-muted"
                onClick={async () => {
                  const dir = await downTube.chooseOutputDir();
                  if (dir) setLocal({ ...local, defaultOutputDir: dir });
                }}
              >
                Browse
              </button>
            </div>
          </div>
          <div className="dt-card-soft p-4 md:col-span-2">
            <label className="dt-label">YouTube cookies file (optional)</label>
            <div className="mt-2 flex flex-col md:flex-row gap-3">
              <input
                value={local.cookiesPath || ''}
                onChange={(e) => setLocal({ ...local, cookiesPath: e.target.value })}
                className="dt-input flex-1"
              />
              <button
                className="dt-button dt-button-muted"
                onClick={async () => {
                  const file = await downTube.chooseCookiesFile();
                  if (file) setLocal({ ...local, cookiesPath: file });
                }}
              >
                Browse
              </button>
              <button
                className="dt-button dt-button-muted"
                onClick={() => setLocal({ ...local, cookiesPath: '' })}
              >
                Clear
              </button>
            </div>
            <p className="mt-2 text-xs dt-muted">Use cookies to access age-restricted or private videos.</p>
          </div>
          <div className="dt-card-soft p-4">
            <Select
              label="Concurrent downloads"
              value={local.maxConcurrent || 3}
              options={concurrencyOptions}
              onChange={(val) => setLocal({ ...local, maxConcurrent: val })}
            />
          </div>
          <div className="dt-card-soft p-4 space-y-4">
            <div className="dt-label">Download behavior</div>
            <Toggle
              label="Show completion dialog"
              hint="Display a summary when downloads finish."
              checked={!!local.showCompleteDialog}
              onChange={(val) => setLocal({ ...local, showCompleteDialog: val })}
            />
            <Toggle
              label="Auto-open folder"
              hint="Open the output folder automatically."
              checked={!!local.openFolderOnComplete}
              onChange={(val) => setLocal({ ...local, openFolderOnComplete: val })}
            />
          </div>
        </div>
      </section>

      <section className="dt-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="dt-label">Updates</p>
            <h3 className="text-lg font-semibold">Stay current</h3>
            <p className="text-sm dt-muted">Current version: {appInfo?.version || '—'}</p>
          </div>
          <button onClick={checkUpdates} className="dt-button dt-button-muted">Check updates</button>
        </div>
        {updateInfo?.latestVersion ? (
          <div className="mt-4 dt-card-soft p-4">
            <div className="text-sm">New version available: {updateInfo.latestVersion}</div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => downTube.showUpdateDialog(updateInfo)}
                className="dt-button dt-button-primary"
              >
                Download update
              </button>
              <button
                onClick={() => setReleaseNotes(updateInfo.releaseNotes || 'No release notes')}
                className="dt-button dt-button-muted"
              >
                Release notes
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="dt-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="dt-label">About</p>
            <h3 className="text-lg font-semibold">DownTube details</h3>
            <p className="text-sm dt-muted">Versioned and optimized for desktop.</p>
          </div>
          <span className="dt-pill">Electron + React</span>
        </div>
        <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm dt-muted">
          <div>Author: <span className="text-[color:var(--text)]">{appInfo?.author || '—'}</span></div>
          <div>License: MIT</div>
          <div>Engine: yt-dlp + FFmpeg</div>
          <div>Build: Desktop</div>
        </div>
      </section>

      <Modal
        open={!!releaseNotes}
        title="Release notes"
        description="Latest version details"
        onClose={() => setReleaseNotes(null)}
      >
        <div className="text-sm dt-muted whitespace-pre-wrap">{releaseNotes}</div>
      </Modal>
    </div>
  );
}
