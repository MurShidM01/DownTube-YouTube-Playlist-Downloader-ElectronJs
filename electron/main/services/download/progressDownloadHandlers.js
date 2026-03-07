const { parsePercent } = require('./progressTextUtils');

function logProgressPayload(payload) {
    if (process.env.DT_LOG_PROGRESS === '1') {
        console.log('[progress-payload]', payload);
    }
}

function applyProgressUpdate({ isMp3, state, ctx, percent, size, speed, eta }) {
    const { id, url, format, activeDownloads, notifyProgress, emitItemComplete, setPhase } = ctx;
    notifyProgress({
        type: isMp3 ? 'audio' : 'video',
        id,
        itemIndex: state.totalItems ? state.currentIndex : undefined,
        totalItems: state.totalItems || undefined,
        percent,
        size,
        speed,
        eta,
        phase: 'downloading',
        indeterminate: false,
        title: undefined
    });
    logProgressPayload({ id, percent, size, speed, eta });

    state.lastSize = size;
    state.lastDownloadPercent = percent;

    const obj = activeDownloads.get(id) || {};
    activeDownloads.set(id, {
        ...obj,
        id,
        url,
        format,
        percent,
        size,
        speed,
        eta,
        title: state.currentTitle || obj.title,
        path: state.currentDest || obj.path,
        startedAt: state.startedAt,
        indeterminate: false,
        phase: 'downloading'
    });

    if (!isMp3 && percent >= 100 && state.currentDest && !state.completedDests.has(state.currentDest)) {
        state.completedDests.add(state.currentDest);
        emitItemComplete(state.currentIndex, state.totalItems || undefined, state.currentDest);
    } else if (isMp3 && percent >= 100) {
        setPhase('converting', undefined, true);
    }
}

function handleDownloadLine({ trimmed, isMp3, state, ctx }) {
    const { notifyProgress, updateActive } = ctx;

    if (trimmed.startsWith('download:')) {
        const parts = trimmed.replace('download:', '').trim().split('|');
        const percent = parsePercent(parts[0]);
        const size = String(parts[1] || '').trim();
        const speed = String(parts[2] || '').trim();
        const eta = String(parts[3] || '').trim();
        if (percent != null) {
            applyProgressUpdate({ isMp3, state, ctx, percent, size, speed, eta });
            return true;
        }
        if (size || speed || eta) {
            notifyProgress({
                type: isMp3 ? 'audio' : 'video',
                id: ctx.id,
                itemIndex: state.totalItems ? state.currentIndex : undefined,
                totalItems: state.totalItems || undefined,
                size,
                speed,
                eta,
                phase: 'downloading',
                indeterminate: true,
                title: undefined
            });
            logProgressPayload({ id: ctx.id, size, speed, eta, indeterminate: true });
            updateActive({
                id: ctx.id,
                url: ctx.url,
                format: ctx.format,
                size,
                speed,
                eta,
                startedAt: state.startedAt,
                indeterminate: true,
                phase: 'downloading'
            });
            return true;
        }
    }

    const progressMatch = trimmed.match(/\[download\]\s+(\d+\.?\d*)%\s+of\s+([\d\.]+\w+i?B)\s+at\s+([\d\.]+\w+i?B\/s)\s+ETA\s+([\d:]+)/i);
    const progressMatchLoose = !progressMatch ? trimmed.match(/\[download\]\s+(\d+\.?\d*)%\s+of\s+(.+?)\s+at\s+(.+?)\s+ETA\s+([\d:]+)/i) : null;
    const progressMatchGeneric = !progressMatch && !progressMatchLoose
        ? trimmed.match(/(\d+\.?\d*)%\s+of\s+(.+?)\s+at\s+(.+?)\s+ETA\s+([\d:]+)/i)
        : null;
    if (progressMatch || progressMatchLoose || progressMatchGeneric) {
        const m = progressMatch || progressMatchLoose || progressMatchGeneric;
        const percent = parseFloat(m[1]);
        const size = String(m[2] || '').trim();
        const speed = String(m[3] || '').trim();
        const eta = String(m[4] || '').trim();
        applyProgressUpdate({ isMp3, state, ctx, percent, size, speed, eta });
        return true;
    }

    const pipeMatch = trimmed.match(/^(\d+(?:\.\d+)?)%\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\s*$/);
    if (pipeMatch) {
        const percent = parseFloat(pipeMatch[1]);
        const size = String(pipeMatch[2] || '').trim();
        const speed = String(pipeMatch[3] || '').trim();
        const eta = String(pipeMatch[4] || '').trim();
        applyProgressUpdate({ isMp3, state, ctx, percent, size, speed, eta });
        return true;
    }

    const percentMatch = trimmed.match(/\[download\]\s+(\d+\.?\d*)%/i);
    if (percentMatch) {
        const percent = parseFloat(percentMatch[1]);
        notifyProgress({
            type: isMp3 ? 'audio' : 'video',
            id: ctx.id,
            itemIndex: state.totalItems ? state.currentIndex : undefined,
            totalItems: state.totalItems || undefined,
            percent,
            title: undefined
        });
        state.lastDownloadPercent = percent;
        const obj = ctx.activeDownloads.get(ctx.id) || {};
        ctx.activeDownloads.set(ctx.id, {
            ...obj,
            id: ctx.id,
            url: ctx.url,
            format: ctx.format,
            percent,
            title: obj.title,
            path: obj.path,
            startedAt: state.startedAt,
            size: obj.size,
            speed: obj.speed,
            eta: obj.eta,
            indeterminate: false,
            phase: 'downloading'
        });
        if (!isMp3 && percent >= 100 && state.currentDest && !state.completedDests.has(state.currentDest)) {
            state.completedDests.add(state.currentDest);
            ctx.emitItemComplete(state.currentIndex, state.totalItems || undefined, state.currentDest);
        } else if (isMp3 && percent >= 100) {
            ctx.setPhase('converting', undefined, true);
        }
        return true;
    }

    return false;
}

module.exports = {
    handleDownloadLine
};
