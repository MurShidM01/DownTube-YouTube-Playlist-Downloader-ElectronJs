const fs = require('fs');
const { spawn } = require('child_process');
const ErrorHandler = require('./errorHandler');
const RetryManager = require('./retryManager');
const { findExecutable } = require('./dependencyService');
const { getCookiesArgs } = require('./settingsService');

const jsRuntimeArgs = ['--js-runtimes', 'node'];

async function probeFormats(url) {
    return new Promise((resolve) => {
        try {
            const ytdlpPath = findExecutable(process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
            const cookiesArgs = getCookiesArgs();
            const proc = spawn(ytdlpPath, [...cookiesArgs, ...jsRuntimeArgs, '-F', url], { stdio: ['ignore', 'pipe', 'pipe'] });
            let out = '';
            let err = '';
            proc.stdout.on('data', d => { out += d.toString(); });
            proc.stderr.on('data', d => { err += d.toString(); });
            proc.on('close', () => {
                const lines = out.split(/\r?\n/);
                const videoFormats = [];
                const audioFormats = [];
                for (const line of lines) {
                    const mVideo = line.match(/^(\s*\d+)\s+\S+\s+mp4\s+(\d+)x(\d+)/i);
                    if (mVideo) {
                        const itag = mVideo[1].trim();
                        const height = parseInt(mVideo[3], 10);
                        videoFormats.push({ itag, height });
                        continue;
                    }
                    const audioOnly = /audio only/i.test(line);
                    if (audioOnly) {
                        const idMatch = line.match(/^(\s*\d+)/);
                        const kbMatch = line.match(/(\d+)\s*k(?!i)/i);
                        if (idMatch && kbMatch) {
                            const itag = idMatch[1].trim();
                            const kbps = parseInt(kbMatch[1], 10);
                            if (!Number.isNaN(kbps)) audioFormats.push({ itag, kbps });
                        }
                        continue;
                    }
                }
                const heights = Array.from(new Set(videoFormats.map(v => v.height))).sort((a, b) => a - b);
                const kbpsList = Array.from(new Set(audioFormats.map(a => a.kbps))).sort((a, b) => a - b);
                resolve({ ok: true, videoHeights: heights, audioKbps: kbpsList });
            });
            proc.on('error', () => resolve({ ok: false, message: 'yt-dlp not found or failed' }));
        } catch (e) {
            resolve({ ok: false, message: e?.message || String(e) });
        }
    });
}

async function handleProbeFormats(url) {
    try {
        await ErrorHandler.validateUrl(url);
        return await RetryManager.withRetry(async () => {
            return await probeFormats(url);
        }, 2, 1000);
    } catch (error) {
        await ErrorHandler.handleError(error, 'probe-formats');
        return {
            ok: false,
            message: ErrorHandler.getErrorMessage(error),
            errorType: error.type || ErrorHandler.errorTypes.UNKNOWN
        };
    }
}

function pickThumbnail(json) {
    if (json?.thumbnail) return json.thumbnail;
    if (Array.isArray(json?.thumbnails) && json.thumbnails.length) {
        const last = json.thumbnails[json.thumbnails.length - 1];
        return last?.url || json.thumbnails[0]?.url;
    }
    return '';
}

function pickPlaylistThumbnail(json) {
    const thumb = pickThumbnail(json);
    if (thumb) return thumb;
    if (Array.isArray(json?.entries) && json.entries.length) {
        const first = json.entries.find(e => e && (e.id || e.url)) || json.entries[0];
        const id = first?.id || '';
        if (id) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    }
    return '';
}

async function fetchJson(ytdlpPath, args) {
    return new Promise((resolve, reject) => {
        const proc = spawn(ytdlpPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '';
        let err = '';

        let activityTimeout;
        const resetActivityTimeout = () => {
            if (activityTimeout) clearTimeout(activityTimeout);
            activityTimeout = setTimeout(() => {
                console.error('[fetch-info] No data received for 60 seconds, aborting');
                try { proc.kill(); } catch {}
                reject(new Error('Request timeout - the URL may be invalid or unavailable'));
            }, 60000);
        };

        resetActivityTimeout();

        proc.stdout.on('data', d => {
            out += d.toString();
            resetActivityTimeout();
        });
        proc.stderr.on('data', d => {
            err += d.toString();
            resetActivityTimeout();
        });

        proc.on('close', (code) => {
            if (activityTimeout) clearTimeout(activityTimeout);
            if (code !== 0) {
                console.error(`[fetch-info] yt-dlp failed with code ${code}: ${err || 'Unknown error'}`);
                reject(new Error(err || 'yt-dlp failed'));
                return;
            }
            try {
                const json = JSON.parse(out || '{}');
                resolve(json);
            } catch {
                reject(new Error('Failed to parse video information. The URL may be invalid or the video may be unavailable.'));
            }
        });

        proc.on('error', (error) => {
            if (activityTimeout) clearTimeout(activityTimeout);
            reject(new Error(`yt-dlp failed to run: ${error.message}`));
        });
    });
}

async function handleFetchInfo(url) {
    try {
        await ErrorHandler.validateUrl(url);

        return await RetryManager.withRetry(async () => {
            const ytdlpPath = findExecutable(process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
            const cookiesArgs = getCookiesArgs();
            const hasCookies = cookiesArgs.length > 0;

            if (!fs.existsSync(ytdlpPath)) {
                throw ErrorHandler.createError(
                    ErrorHandler.errorTypes.PROCESS,
                    'yt-dlp not found. Please ensure the application is properly installed.',
                    { ytdlpPath },
                    false
                );
            }

            try {
                const flat = await fetchJson(ytdlpPath, [...cookiesArgs, ...jsRuntimeArgs, '-J', '--flat-playlist', url]);
                if (Array.isArray(flat.entries)) {
                    return {
                        ok: true,
                        type: 'playlist',
                        count: flat.entries.length,
                        title: flat.title || '',
                        uploader: flat.uploader || flat.channel || '',
                        thumbnail: pickPlaylistThumbnail(flat)
                    };
                }

                const full = await fetchJson(ytdlpPath, [...cookiesArgs, ...jsRuntimeArgs, '-J', url]);
                return {
                    ok: true,
                    type: 'video',
                    count: 1,
                    title: full.title || '',
                    uploader: full.uploader || full.channel || '',
                    duration: full.duration || 0,
                    viewCount: full.view_count || 0,
                    thumbnail: pickThumbnail(full)
                };
            } catch (err) {
                const errMsg = err?.message || String(err);
                if (/sign in/i.test(errMsg)) {
                    throw new Error(hasCookies
                        ? 'This video requires signing in to YouTube. Your cookies may be expired.'
                        : 'This video requires signing in to YouTube. Add cookies in Settings to continue.');
                }
                throw err;
            }
        }, 2, 1000);
    } catch (error) {
        await ErrorHandler.handleError(error, 'fetch-info');
        return {
            ok: false,
            message: ErrorHandler.getErrorMessage(error),
            errorType: error.type || ErrorHandler.errorTypes.UNKNOWN
        };
    }
}

module.exports = {
    handleProbeFormats,
    handleFetchInfo
};
