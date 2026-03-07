import { useEffect, useState } from 'react';
import { downTube } from '../services/downTube.js';

const defaultSettings = {
  theme: 'dark',
  font: 'Inter',
  defaultOutputDir: '',
  maxConcurrent: 3,
  cookiesPath: ''
};

export function useSettings() {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await downTube.getSettings();
        if (mounted && data) setSettings({ ...defaultSettings, ...data });
      } catch {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const saveSettings = async (next) => {
    const updated = await downTube.saveSettings(next);
    if (updated) setSettings({ ...defaultSettings, ...updated });
    return updated;
  };

  return { settings, setSettings, saveSettings, loading };
}
