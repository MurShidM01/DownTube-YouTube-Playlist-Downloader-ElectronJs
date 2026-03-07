import { useCallback, useEffect, useRef, useState } from 'react';
import { downTube } from '../services/downTube.js';

function cleanTitle(name) {
  if (!name) return name;
  return String(name).replace(/\.f\d+$/i, '').trim();
}

export function useDownloads() {
  const [active, setActive] = useState([]);
  const [history, setHistory] = useState([]);
  const titleCache = useRef(new Map());

  const upsertActive = useCallback((payload) => {
    if (!payload?.id) return;
    setActive((prev) => {
      const idx = prev.findIndex((item) => item.id === payload.id);
      const cachedTitle = titleCache.current.get(payload.id);
      const nextTitle = cleanTitle(payload.title || cachedTitle);
      if (nextTitle) titleCache.current.set(payload.id, nextTitle);
      const pathTitle = payload.path ? cleanTitle(payload.path.split(/[/\\\\]/).pop()) : '';
      if (idx === -1) {
        return [...prev, { ...payload, title: nextTitle || pathTitle || payload.title }];
      }
      const copy = prev.slice();
      const existing = copy[idx];
      copy[idx] = {
        ...existing,
        ...payload,
        title: nextTitle || existing.title || pathTitle
      };
      return copy;
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const items = await downTube.getActiveDownloads();
      const hist = await downTube.getHistory();
      const merged = (items || []).map((item) => {
        const cachedTitle = titleCache.current.get(item.id);
        const pathTitle = item.path ? cleanTitle(item.path.split(/[/\\\\]/).pop()) : '';
        const title = cleanTitle(item.title || cachedTitle || pathTitle);
        if (title) titleCache.current.set(item.id, title);
        return { ...item, title };
      });
      setActive(merged);
      setHistory(hist || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refresh();

    downTube.onProgress((payload) => {
      upsertActive(payload);
    });
    downTube.onItemComplete(() => refresh());
    downTube.onError(() => refresh());
  }, [refresh, upsertActive]);

  return { active, history, refresh };
}
