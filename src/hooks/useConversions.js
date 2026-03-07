import { useCallback, useEffect, useState } from 'react';
import { downTube } from '../services/downTube.js';

function displayNameFromPath(filePath) {
  if (!filePath) return '';
  return filePath.split(/[/\\\\]/).pop() || '';
}

export function useConversions() {
  const [active, setActive] = useState([]);
  const [recent, setRecent] = useState([]);

  const upsertActive = useCallback((payload) => {
    if (!payload?.id) return;
    setActive((prev) => {
      const idx = prev.findIndex((item) => item.id === payload.id);
      const next = {
        ...payload,
        title: payload.title || displayNameFromPath(payload.inputPath || payload.outputPath)
      };
      if (idx === -1) return [...prev, next];
      const copy = prev.slice();
      copy[idx] = { ...copy[idx], ...next };
      return copy;
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const items = await downTube.getActiveConversions();
      const normalized = (items || []).map((item) => ({
        ...item,
        title: item.title || displayNameFromPath(item.inputPath || item.outputPath)
      }));
      setActive(normalized);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refresh();

    downTube.onConvertProgress((payload) => {
      upsertActive(payload);
    });

    downTube.onConvertComplete((payload) => {
      setActive((prev) => prev.filter((item) => item.id !== payload?.id));
      if (payload?.outputPath) {
        setRecent((prev) => [
          { ...payload, title: displayNameFromPath(payload.outputPath) },
          ...prev
        ].slice(0, 25));
      }
    });

    downTube.onConvertError((payload) => {
      setActive((prev) => prev.filter((item) => item.id !== payload?.id));
    });
  }, [refresh, upsertActive]);

  return { active, recent, refresh };
}
