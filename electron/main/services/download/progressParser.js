const path = require('path');
const { stripAnsi, cleanTitle, parsePercent } = require('./progressTextUtils');
const { handleDownloadLine } = require('./progressDownloadHandlers');

function createProgressParser({ id, url, format, webContents, activeDownloads, broadcast }) {
    const isMp3 = String(format || 'mp4').toLowerCase() === 'mp3';
    const state = {
        currentIndex: 0,
        totalItems: 0,
        currentDest: null,
        currentTitle: null,
        finalDest: null,
        completedDests: new Set(),
        inPostProcess: false,
        lastSize: null,
        lastDownloadPercent: 0,
        startedAt: Date.now()
    };

    const notifyProgress = (payload) => {
        const obj = activeDownloads.get(id) || {};
        const title = state.currentTitle || obj.title;
        const path = state.currentDest || obj.path;
        broadcast('download-progress', {
            id,
            url,
            format,
            title,
            path,
            ...payload
        });
    };

    const updateActive = (patch) => {
        const obj = activeDownloads.get(id) || {};
        activeDownloads.set(id, { ...obj, ...patch });
    };

    const emitItemComplete = (itemIndex, totalItems, destPath) => {
        const parsed = path.parse(destPath);
        const title = parsed?.name || 'download';
        broadcast('download-item-complete', { itemIndex, totalItems, path: destPath, title });
    };

    const setPhase = (phase, percent, indeterminate) => {
        const obj = activeDownloads.get(id) || {};
        activeDownloads.set(id, {
            ...obj,
            id,
            url,
            format,
            title: obj.title,
            path: obj.path,
            startedAt: state.startedAt,
            indeterminate: !!indeterminate,
            convertPercent: percent ?? obj.convertPercent,
            phase
        });
    };

    const parseLine = (line) => {
        const trimmed = stripAnsi(line).trim();
        if (!trimmed) return;
        if (process.env.DT_LOG_PROGRESS === '1') {
            console.log('[yt-dlp]', trimmed);
        }

        const itemMatch = trimmed.match(/Downloading item (\d+) of (\d+)/i);
        if (itemMatch) {
            state.currentIndex = parseInt(itemMatch[1], 10) - 1;
            state.totalItems = parseInt(itemMatch[2], 10);
        }

        const destMatch = trimmed.match(/Destination:\s(.+)/i);
        if (destMatch) {
            state.currentDest = destMatch[1].trim();
            const parsed = path.parse(state.currentDest);
            const title = cleanTitle(parsed?.name || 'download');
            state.currentTitle = title;
            updateActive({ id, url, format, title, path: state.currentDest, startedAt: state.startedAt });
        }

        const alreadyMatch = trimmed.match(/\[download\]\s+(.+?)\s+has already been downloaded/i);
        if (alreadyMatch) {
            state.currentDest = alreadyMatch[1].trim();
            state.finalDest = state.currentDest;
            const parsed = path.parse(state.currentDest);
            const title = cleanTitle(parsed?.name || 'download');
            state.currentTitle = title;
            updateActive({ id, url, format, title, path: state.currentDest, startedAt: state.startedAt });
            state.completedDests.add(state.currentDest);
            emitItemComplete(state.currentIndex, state.totalItems || undefined, state.currentDest);
        }

        if (trimmed.startsWith('postprocess:')) {
            const parts = trimmed.replace('postprocess:', '').trim();
            const pct = parsePercent(parts);
            state.inPostProcess = true;
            notifyProgress({
                type: 'postprocess',
                id,
                itemIndex: state.totalItems ? state.currentIndex : undefined,
                totalItems: state.totalItems || undefined,
                percent: pct ?? undefined,
                indeterminate: pct == null,
                title: undefined
            });
            if (state.lastDownloadPercent >= 100) {
                setPhase(isMp3 ? 'converting' : 'merging', pct ?? undefined, pct == null);
            }
            return;
        }

        if (/[[(](ExtractAudio|ffmpeg)[)\]]/i.test(trimmed)) {
            state.inPostProcess = true;
            notifyProgress({
                type: 'postprocess',
                id,
                itemIndex: state.totalItems ? state.currentIndex : undefined,
                totalItems: state.totalItems || undefined,
                indeterminate: true,
                title: undefined
            });
            setPhase(isMp3 ? 'converting' : 'merging', undefined, true);
        }

        const extractDestMatch = trimmed.match(/\[ExtractAudio\]\s+Destination:\s(.+)/i);
        if (extractDestMatch) {
            state.currentDest = extractDestMatch[1].trim();
            state.finalDest = state.currentDest;
            const parsed = path.parse(state.currentDest);
            state.currentTitle = cleanTitle(parsed?.name || state.currentTitle);
            updateActive({ id, url, format, title: state.currentTitle, path: state.currentDest });
            setPhase('converting', undefined, true);
        }

        if (handleDownloadLine({
            trimmed,
            isMp3,
            state,
            ctx: { id, url, format, activeDownloads, notifyProgress, updateActive, emitItemComplete, setPhase }
        })) {
            return;
        }

        if (/Deleting original file|has already been downloaded/i.test(trimmed) && state.currentDest && !state.completedDests.has(state.currentDest)) {
            state.completedDests.add(state.currentDest);
            emitItemComplete(state.currentIndex, state.totalItems || undefined, state.currentDest);
        }

        if (/\[Merger\]/i.test(trimmed)) {
            const mergeMatch = trimmed.match(/Merging formats into \"(.+?)\"/i);
            if (mergeMatch) {
                state.finalDest = mergeMatch[1];
                const parsed = path.parse(state.finalDest);
                state.currentTitle = cleanTitle(parsed?.name || state.currentTitle);
                updateActive({ id, url, format, title: state.currentTitle, path: state.finalDest });
            }
            setPhase('merging', undefined, true);
        }
    };

    const parse = (data) => {
        const text = data?.toString?.() || '';
        text.replace(/\r/g, '\n').split(/\n/).forEach(parseLine);
    };

    return { parse, getState: () => state };
}

module.exports = { createProgressParser };
