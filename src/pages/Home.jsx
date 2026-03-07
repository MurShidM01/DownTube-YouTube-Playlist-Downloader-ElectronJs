import React, { useEffect, useMemo, useRef, useState } from 'react';
import { downTube } from '../services/downTube.js';
import { isValidYouTubeUrl } from '../utils/youtube.js';
import Select from '../components/Select.jsx';

function buildFallbackQualities(format) {
  return format === 'mp4'
    ? ['Auto', '2160p', '1440p', '1080p', '720p', '480p', '360p', '240p', '144p']
    : ['Auto', '320 kbps', '256 kbps', '192 kbps', '160 kbps', '128 kbps', '96 kbps'];
}

function formatDuration(seconds) {
  if (!seconds || Number.isNaN(seconds)) return '—';
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  const m = Math.floor((seconds / 60) % 60).toString().padStart(2, '0');
  const h = Math.floor(seconds / 3600);
  return h ? `${h}:${m}:${s}` : `${m}:${s}`;
}

function formatViews(count) {
  if (!count) return '—';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M views`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K views`;
  return `${count} views`;
}

export default function Home({ settings, notify, onNavigate }) {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState('mp4');
  const [qualities, setQualities] = useState(buildFallbackQualities('mp4'));
  const [quality, setQuality] = useState('Auto');
  const [fetchStatus, setFetchStatus] = useState('');
  const [isPlaylist, setIsPlaylist] = useState(false);
  const [playlistCount, setPlaylistCount] = useState(0);
  const [videoInfo, setVideoInfo] = useState(null);
  const [playlistInfo, setPlaylistInfo] = useState(null);
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(1);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const fetchSeq = useRef(0);

  useEffect(() => {
    setQualities(buildFallbackQualities(format));
    setQuality('Auto');
  }, [format]);

  const canDownload = useMemo(() => isValidYouTubeUrl(url), [url]);

  async function probe(urlToProbe) {
    try {
      const res = await downTube.probeFormats(urlToProbe);
      if (!res?.ok) return;
      if (format === 'mp4') {
        const list = res.videoHeights?.length
          ? ['Auto', ...res.videoHeights.sort((a, b) => b - a).map((h) => `${h}p`)]
          : buildFallbackQualities('mp4');
        setQualities(list);
      } else {
        const list = res.audioKbps?.length
          ? ['Auto', ...res.audioKbps.sort((a, b) => b - a).map((k) => `${k} kbps`)]
          : buildFallbackQualities('mp3');
        setQualities(list);
      }
    } catch {
      // ignore
    }
  }

  async function handleFetch() {
    if (!url) {
      setFetchStatus('Please enter a YouTube URL.');
      return;
    }
    if (!isValidYouTubeUrl(url)) {
      setFetchStatus('Invalid YouTube URL.');
      return;
    }

    if (loading) return;
    const seq = ++fetchSeq.current;
    setLoading(true);
    setVideoInfo(null);
    setPlaylistInfo(null);
    try {
      const info = await Promise.race([
        downTube.fetchInfo(url),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 60000))
      ]);
      if (info?.ok) {
        if (info.type === 'playlist') {
          setIsPlaylist(true);
          setPlaylistCount(info.count);
          setRangeStart(1);
          setRangeEnd(info.count);
          setFetchStatus(`${info.count} videos found${info.title ? `: ${info.title}` : ''}`);
          setPlaylistInfo({
            title: info.title,
            uploader: info.uploader,
            count: info.count,
            thumbnail: info.thumbnail
          });
          setVideoInfo(null);
        } else {
          setIsPlaylist(false);
          setFetchStatus(info.title ? `Single video: ${info.title}` : 'Single video');
          setVideoInfo({
            title: info.title,
            uploader: info.uploader,
            duration: info.duration,
            viewCount: info.viewCount,
            thumbnail: info.thumbnail
          });
          setPlaylistInfo(null);
        }
        await probe(url);
      } else {
        setFetchStatus(info?.message || 'Could not fetch info');
      }
    } catch (error) {
      setFetchStatus(error?.message === 'timeout'
        ? 'Fetch timed out after 60 seconds. Please try again.'
        : 'Failed to fetch video information');
    } finally {
      if (fetchSeq.current === seq) setLoading(false);
    }
  }

  function handleDownload() {
    if (!canDownload) {
      setFetchStatus('Please provide a valid YouTube URL.');
      return;
    }

    const qualityVal = format === 'mp4' ? (quality === 'Auto' ? undefined : quality) : undefined;
    const abrKbps = format === 'mp3' ? (quality === 'Auto' ? undefined : parseInt(quality, 10)) : undefined;

    let playlistStart = isPlaylist ? Math.max(1, Number(rangeStart)) : undefined;
    let playlistEnd = isPlaylist ? Math.max(1, Number(rangeEnd)) : undefined;
    if (playlistStart && playlistEnd && playlistStart > playlistEnd) {
      const tmp = playlistStart; playlistStart = playlistEnd; playlistEnd = tmp;
    }

    setStarting(true);
    if (onNavigate) onNavigate('downloads');
    const finishStart = () => {
      setStarting(false);
      notify('Download started');
    };

    setTimeout(finishStart, 500);

    downTube.startDownload({
      url,
      format,
      quality: qualityVal,
      abrKbps,
      playlistStart,
      playlistEnd,
      title: videoInfo?.title || playlistInfo?.title || ''
    }).catch(() => {
      setStarting(false);
      notify('Download failed', 'error');
    });
  }

  const qualityOptions = qualities.map((q) => ({ value: q, label: q }));

  return (
    <div className="space-y-6">
      <section className="dt-card p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <p className="dt-label">Downloader</p>
            <h1 className="text-2xl font-semibold">Grab videos and playlists in one flow</h1>
            <p className="mt-1 text-sm dt-muted">Fast MP4/MP3 extraction with playlist batching and quality control.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="dt-pill">MP4 / MP3</span>
              <span className="dt-pill">Playlist range</span>
              <span className="dt-pill">Smart qualities</span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          <div>
            <label className="dt-label">YouTube URL</label>
            <div className="mt-2 flex flex-col md:flex-row gap-3">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="dt-input flex-1"
              />
              <button
                onClick={handleFetch}
                disabled={loading}
                className="dt-button dt-button-primary min-w-[140px]"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Fetching...
                  </span>
                ) : (
                  'Fetch'
                )}
              </button>
            </div>
            {fetchStatus ? <p className="mt-2 text-xs dt-muted">{fetchStatus}</p> : null}
          </div>

          {videoInfo ? (
            <div className="dt-card-soft p-4 flex flex-col md:flex-row gap-4">
              <div className="w-full md:w-48 h-28 rounded-2xl overflow-hidden bg-[var(--bg-strong)]">
                {videoInfo.thumbnail ? (
                  <img src={videoInfo.thumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
                ) : null}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{videoInfo.title || 'Untitled video'}</div>
                <div className="mt-1 text-xs dt-muted flex flex-wrap gap-3">
                  <span>{videoInfo.uploader || 'Unknown channel'}</span>
                  <span>{formatDuration(videoInfo.duration)}</span>
                  <span>{formatViews(videoInfo.viewCount)}</span>
                </div>
              </div>
            </div>
          ) : null}

          {playlistInfo ? (
            <div className="dt-card-soft p-4 flex flex-col md:flex-row gap-4">
              <div className="w-full md:w-48 h-28 rounded-2xl overflow-hidden bg-[var(--bg-strong)]">
                {playlistInfo.thumbnail ? (
                  <img src={playlistInfo.thumbnail} alt="Playlist thumbnail" className="w-full h-full object-cover" />
                ) : null}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{playlistInfo.title || 'Untitled playlist'}</div>
                <div className="mt-1 text-xs dt-muted flex flex-wrap gap-3">
                  <span>{playlistInfo.uploader || 'Unknown channel'}</span>
                  <span>{playlistInfo.count || 0} videos</span>
                </div>
              </div>
            </div>
          ) : null}

          {isPlaylist ? (
            <div className="dt-card-soft p-4">
              <div className="flex items-center justify-between text-xs dt-muted">
                <span>Playlist range</span>
                <span>{rangeStart} – {rangeEnd}</span>
              </div>
              <div className="mt-3 grid gap-3">
                <input
                  type="range"
                  min={1}
                  max={playlistCount}
                  value={rangeStart}
                  onChange={(e) => setRangeStart(Number(e.target.value))}
                />
                <input
                  type="range"
                  min={1}
                  max={playlistCount}
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(Number(e.target.value))}
                />
              </div>
            </div>
          ) : null}

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="dt-label">Format</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {['mp4', 'mp3'].map((f) => {
                  const active = format === f;
                  return (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={`dt-button w-full ${active ? 'dt-button-primary' : 'dt-button-muted'}`}
                    >
                      {f.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Select
                label="Quality"
                value={quality}
                options={qualityOptions}
                onChange={setQuality}
              />
              <div className="mt-2 text-xs dt-muted">Auto chooses the best format for your selection.</div>
            </div>
          </div>

          <button
            onClick={handleDownload}
            disabled={!canDownload || starting}
            className="dt-button dt-button-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {starting ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Starting...
              </span>
            ) : (
              'Start Download'
            )}
          </button>
        </div>
      </section>
    </div>
  );
}


