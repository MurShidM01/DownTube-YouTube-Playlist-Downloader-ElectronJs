import React, { useEffect, useState } from 'react';
import { IconPlay } from '../components/icons/Feather.jsx';
import Modal from '../components/Modal.jsx';
import { downTube } from '../services/downTube.js';
import { useDownloads } from '../hooks/useDownloads.js';

function getVideoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.replace('/', '');
    if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || '';
    return u.searchParams.get('v') || '';
  } catch {
    return '';
  }
}

function getThumbnail(url) {
  const id = getVideoId(url);
  if (!id) return '';
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export default function Downloads({ notify, settings }) {
  const { active, history, refresh } = useDownloads();
  const [confirmClear, setConfirmClear] = useState(false);
  const [completeInfo, setCompleteInfo] = useState(null);

  function displayTitle(item) {
    if (item?.title) return item.title;
    if (item?.path) {
      const name = item.path.split(/[/\\\\]/).pop();
      return name || item.url;
    }
    return item?.url || 'download';
  }

  useEffect(() => {
    downTube.onDone((data) => {
      refresh();
      if (!data?.outDir) return;

      if (settings?.openFolderOnComplete) {
        downTube.openPath(data.outDir);
      }

      if (settings?.showCompleteDialog) {
        setCompleteInfo({
          completed: data.completed || data.totalItems || 1,
          total: data.totalItems || 1,
          outDir: data.outDir
        });
      }
    });
  }, [refresh, settings?.openFolderOnComplete, settings?.showCompleteDialog]);

  const recent = [...history].reverse().slice(0, 100);

  async function handleOpen(item) {
    if (item?.path) {
      const res = await downTube.showItemInFolder(item.path);
      if (!res?.ok) {
        const dir = item.path?.slice(0, item.path.lastIndexOf('\\')) || '';
        if (dir) await downTube.openPath(dir);
      }
    }
  }

  return (
    <div className="space-y-6">
      <section className="dt-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="dt-label">Downloads</p>
            <h2 className="text-2xl font-semibold">Active downloads</h2>
            <p className="text-sm dt-muted">Monitor progress, speed, and remaining time.</p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {active.length === 0 ? (
            <div className="dt-card-soft p-6 text-center dt-muted">No active downloads.</div>
          ) : (
            active.map((item) => {
              const downloadPct = Math.round(item.percent || 0);
              const convertPct = Math.round(item.convertPercent || 0);
              const phase = item.phase || 'downloading';
              const isConverting = phase === 'converting';
              const isMerging = phase === 'merging';
              const isPreparing = phase === 'downloading' && downloadPct >= 100;
              const showIndeterminate = ((isConverting || isMerging) && !convertPct)
                || (phase === 'downloading' && item.indeterminate)
                || isPreparing;
              const displayPct = (isConverting || isMerging) ? convertPct : downloadPct;
              const percentText = showIndeterminate ? '—' : `${displayPct}%`;
              return (
                <div key={item.id} className="dt-card-soft p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold truncate max-w-[420px]">{displayTitle(item)}</div>
                      <div className="mt-1 text-xs dt-muted flex flex-wrap gap-3">
                        {isConverting || isMerging || isPreparing ? (
                          <span>
                            {isConverting
                              ? 'Converting to MP3…'
                              : isMerging
                              ? 'Merging audio + video…'
                              : 'Preparing conversion…'}
                          </span>
                        ) : (
                          <>
                            <span>{item.size || '—'}</span>
                            <span>{item.speed || '—'}</span>
                            <span>{item.eta && item.eta !== 'NA' && item.eta !== 'Unknown' ? item.eta : '—'}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">{percentText}</div>
                  </div>
                  <div className="mt-3 h-2 rounded-full dt-progress-track">
                    {showIndeterminate ? (
                      <div className="h-2 rounded-full dt-progress-indeterminate" />
                    ) : (
                      <div className="h-2 rounded-full dt-progress-bar" style={{ width: `${displayPct}%` }} />
                    )}
                  </div>
                  {/* Cancel button removed per request */}
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="dt-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="dt-label">History</p>
            <h2 className="text-2xl font-semibold">Recent downloads</h2>
            <p className="text-sm dt-muted">Quick access to finished files.</p>
          </div>
          <button
            onClick={() => setConfirmClear(true)}
            className="dt-button dt-button-muted"
          >
            Clear history
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {recent.length === 0 ? (
            <div className="dt-card-soft p-6 text-center dt-muted">No downloads yet.</div>
          ) : (
            recent.map((item) => {
              const thumb = getThumbnail(item.url);
              return (
                <button
                  key={`${item.path}-${item.completedAt}`}
                  className="dt-card-soft p-3 w-full text-left hover:bg-black/5 flex items-center gap-3"
                  onClick={() => handleOpen(item)}
                >
                  <div className="relative w-16 h-12 rounded-xl overflow-hidden bg-[var(--bg-strong)] flex-shrink-0">
                    {thumb ? <img src={thumb} alt="thumb" className="w-full h-full object-cover" /> : null}
                    <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center">
                      <IconPlay size={12} className="text-slate-700" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{item.title}</div>
                    <div className="mt-1 text-xs dt-muted">{new Date(item.completedAt).toLocaleString()}</div>
                  </div>
                  <span className="dt-badge">{(item.format || 'file').toUpperCase()}</span>
                </button>
              );
            })
          )}
        </div>
      </section>

      <Modal
        open={confirmClear}
        title="Clear download history"
        description="This will remove all stored download history."
        onClose={() => setConfirmClear(false)}
      >
        <div className="flex gap-3 justify-end">
          <button
            className="dt-button dt-button-muted"
            onClick={() => setConfirmClear(false)}
          >
            Cancel
          </button>
          <button
            className="dt-button bg-rose-500 text-white"
            onClick={async () => {
              await downTube.clearHistory();
              setConfirmClear(false);
              refresh();
              notify('History cleared');
            }}
          >
            Clear
          </button>
        </div>
      </Modal>

      <Modal
        open={!!completeInfo}
        title="Downloads complete"
        description={completeInfo ? `${completeInfo.completed} of ${completeInfo.total} item(s) finished` : ''}
        onClose={() => setCompleteInfo(null)}
      >
        {completeInfo ? (
          <div className="space-y-3">
            <div className="text-xs dt-muted break-all">{completeInfo.outDir}</div>
            <div className="flex gap-3 justify-end">
              <button
                className="dt-button dt-button-muted"
                onClick={() => setCompleteInfo(null)}
              >
                Close
              </button>
              <button
                className="dt-button dt-button-primary"
                onClick={() => {
                  downTube.openPath(completeInfo.outDir);
                  setCompleteInfo(null);
                }}
              >
                Open folder
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

