const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const ErrorHandler = require('../errorHandler');
const { getSettings, getDefaultOutputDir, getCookiesArgs } = require('../settingsService');
const { findExecutable } = require('../dependencyService');
const { addHistoryEntry, saveHistory } = require('../historyService');
const { broadcast } = require('../../utils/broadcast');
const { buildYtDlpArgs } = require('./argsBuilder');
const { createProgressParser } = require('./progressParser');
const { cleanupPartialFiles, cleanupResidualFiles } = require('./cleanup');

const activeDownloads = new Map();
const downloadProcesses = new Map();
const terminationReasons = new Map();

function getActiveDownloads() {
    return Array.from(activeDownloads.values());
}

async function startDownload(args, webContents) {
    try {
        const { url, format, quality, abrKbps, playlistStart, playlistEnd, title: requestedTitle } = args || {};

        await ErrorHandler.validateUrl(url);

        const settings = getSettings();
        const outDir = args.outputDir || settings.defaultOutputDir || getDefaultOutputDir();
        await ErrorHandler.validateOutputDirectory(outDir);

        const hasRange = Number(playlistStart) > 0 && Number(playlistEnd) > 0 && Number(playlistEnd) >= Number(playlistStart);
        if (hasRange) {
            const start = Number(playlistStart);
            const end = Number(playlistEnd);
            const indices = [];
            for (let i = start; i <= end; i++) indices.push(i);
            let completed = 0;
            let failed = 0;
            const total = indices.length;

            const maxConcurrent = Math.min(Math.max(1, settings.maxConcurrent || 3), 5);
            const concurrency = Math.min(maxConcurrent, total);

            let cursor = 0;
            const launchNext = async () => {
                if (cursor >= total) return;
                const itemIndex = indices[cursor++];
                const childId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                activeDownloads.set(childId, { id: childId, url, format, title: requestedTitle, percent: 0, startedAt: Date.now() });
                downloadWithYtDlp({ id: childId, url, format, outDir, webContents, quality, abrKbps, playlistStart: itemIndex, playlistEnd: itemIndex })
                    .then(() => { completed++; })
                    .catch(() => { failed++; })
                    .finally(async () => {
                        if (cursor < total) await launchNext();
                        if (completed + failed === total) {
                            broadcast('download-complete', { ok: true, totalItems: total, completed, outDir });
                        }
                    });
            };

            const starters = [];
            for (let k = 0; k < concurrency; k++) starters.push(launchNext());
            await Promise.all(starters);
            return { ok: true, concurrent: true, total, concurrency };
        }

        const downloadId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        activeDownloads.set(downloadId, { id: downloadId, url, format, title: requestedTitle, percent: 0, startedAt: Date.now() });

        try {
            const stats = await downloadWithYtDlp({ id: downloadId, url, format, outDir, webContents, quality, abrKbps, playlistStart, playlistEnd });
            if (stats && stats.cancelled) {
                return { ok: true, cancelled: true };
            }
            const totalItems = stats?.finalDest ? 1 : (stats?.completed || 1);
            const completed = stats?.finalDest ? 1 : (stats?.completed || 1);
            broadcast('download-complete', { ok: true, ...stats, totalItems, completed, outDir });
            return { ok: true, ...stats };
        } catch (err) {
            broadcast('download-error', { message: err?.message || String(err) });
            throw err;
        }
    } catch (error) {
        await ErrorHandler.handleError(error, 'start-download');
        broadcast('download-error', {
            message: ErrorHandler.getErrorMessage(error),
            errorType: error.type || ErrorHandler.errorTypes.UNKNOWN
        });
        throw error;
    }
}

async function cancelDownload(id) {
    try {
        const child = downloadProcesses.get(id);
        if (child) {
            terminationReasons.set(id, 'cancelled');
            try {
                if (process.platform === 'win32') {
                    try { spawn('taskkill', ['/pid', String(child.pid), '/T', '/F']); } catch {}
                } else {
                    try { child.kill('SIGKILL'); } catch {}
                }
            } catch {}
        }
        const obj = activeDownloads.get(id);
        try {
            if (obj?.path) {
                cleanupPartialFiles(obj.path);
            }
        } catch {}
        if (activeDownloads.has(id)) activeDownloads.delete(id);
        try {
            const dir = obj?.path ? path.dirname(obj.path) : null;
            const base = obj?.title || null;
            if (dir && base) {
                const files = fs.readdirSync(dir);
                const pattern = new RegExp(`^${base}\.`, 'i');
                for (const f of files) {
                    if (pattern.test(f) && /\.part$|\.temp\.|\.f\d+\.mp4$/i.test(f)) {
                        try { fs.unlinkSync(path.join(dir, f)); } catch {}
                    }
                }
            }
        } catch {}
        broadcast('download-cancelled', { id });
        return { ok: true };
    } catch (e) {
        return { ok: false, message: e?.message || String(e) };
    }
}

async function downloadWithYtDlp({ id, url, format, outDir, webContents, quality, abrKbps, playlistStart, playlistEnd }) {
    return new Promise((resolve, reject) => {
        const outputPattern = path.join(outDir, '%(title)s.%(ext)s').replace(/\\/g, '/');
        const ytdlpPath = findExecutable(process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
        const ffmpegLoc = findExecutable(process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
        const cookiesArgs = getCookiesArgs();
        const hasCookies = cookiesArgs.length > 0;

        const { isMp3, args } = buildYtDlpArgs({ url, format, outputPattern, ffmpegLoc, quality, abrKbps, playlistStart, playlistEnd, cookiesArgs });

        const parser = createProgressParser({ id, url, format, webContents, activeDownloads, broadcast });
        let stderrOutput = '';

        const child = spawn(ytdlpPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        downloadProcesses.set(id, child);
        child.stdout.on('data', (data) => {
            if (process.env.DT_LOG_PROGRESS === '1') {
                const out = data?.toString?.() || '';
                if (out.trim()) console.log('[yt-dlp-stdout]', out.replace(/\r/g, '\\r'));
            }
            parser.parse(data);
        });
        child.stderr.on('data', (data) => {
            const text = data?.toString?.() || '';
            if (process.env.DT_LOG_PROGRESS === '1') {
                if (text.trim()) console.log('[yt-dlp-stderr]', text.replace(/\r/g, '\\r'));
            }
            stderrOutput += text;
            parser.parse(data);
        });
        child.on('error', (err) => {
            reject(new Error(`Failed to start yt-dlp: ${err.message}`));
        });
        child.on('close', (code) => {
            downloadProcesses.delete(id);
            const obj = activeDownloads.get(id);
            if (obj) activeDownloads.delete(id);
            const reason = terminationReasons.get(id);
            if (reason === 'cancelled') {
                terminationReasons.delete(id);
                try { if (obj?.path) cleanupPartialFiles(obj.path); } catch {}
                return resolve({ cancelled: true });
            }
            if (code === 0) {
                const state = parser.getState();
                const entries = state.finalDest
                    ? [state.finalDest]
                    : (state.completedDests.size ? Array.from(state.completedDests) : (obj?.path ? [obj.path] : []));
                const when = Date.now();
                for (const dest of entries) {
                    const parsed = path.parse(dest);
                    addHistoryEntry({
                        title: parsed?.name || obj?.title || 'download',
                        path: dest,
                        format,
                        size: state.lastSize,
                        completedAt: when,
                        url
                    });
                    try { cleanupResidualFiles(parsed.name, path.dirname(dest)); } catch {}
                }
                saveHistory();
                const completed = state.finalDest ? 1 : (state.completedDests.size || 1);
                const totalItems = state.finalDest ? 1 : (state.totalItems || completed);
                resolve({ totalItems, completed, finalDest: state.finalDest });
            } else {
                let errorMsg = 'Download failed';
                if (stderrOutput) {
                    if (/unable to download/i.test(stderrOutput)) {
                        errorMsg = 'Unable to download video. It may be unavailable or restricted.';
                    } else if (/private video/i.test(stderrOutput)) {
                        errorMsg = 'This is a private video and cannot be downloaded.';
                    } else if (/video unavailable/i.test(stderrOutput)) {
                        errorMsg = 'Video is unavailable.';
                    } else if (/copyright/i.test(stderrOutput)) {
                        errorMsg = 'Video cannot be downloaded due to copyright restrictions.';
                    } else if (/network|connection|timeout/i.test(stderrOutput)) {
                        errorMsg = 'Network error. Please check your internet connection.';
                    } else if (/sign in/i.test(stderrOutput)) {
                        errorMsg = hasCookies
                            ? 'This video requires signing in to YouTube. Your cookies may be expired.'
                            : 'This video requires signing in to YouTube. Add cookies in Settings to continue.';
                    } else if (/age.restricted/i.test(stderrOutput)) {
                        errorMsg = 'This video is age-restricted and cannot be downloaded.';
                    } else {
                        const errorLines = stderrOutput.split('\n').filter(l => /error/i.test(l) && l.trim().length > 0);
                        if (errorLines.length > 0) {
                            errorMsg = errorLines[0].trim().substring(0, 200);
                        } else {
                            errorMsg = `yt-dlp exited with code ${code}`;
                        }
                    }
                }
                reject(new Error(errorMsg));
            }
        });
    });
}

module.exports = {
    startDownload,
    cancelDownload,
    getActiveDownloads
};
