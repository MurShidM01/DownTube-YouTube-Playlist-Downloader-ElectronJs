const DependencyManager = require('./dependencyManager');

let dependencyManager = null;

function initDependencyManager() {
    if (!dependencyManager) {
        dependencyManager = new DependencyManager();
    }
    return dependencyManager;
}

function getDependencyManager() {
    return dependencyManager;
}

function checkDependencies() {
    if (!dependencyManager) return null;
    return dependencyManager.checkDependencies();
}

async function downloadMissingDependencies(progressCallback) {
    if (!dependencyManager) return null;
    return await dependencyManager.downloadMissingDependencies(progressCallback);
}

function getDependencyPaths() {
    if (!dependencyManager) return null;
    return {
        ytdlpPath: dependencyManager.getYtDlpPath(),
        ffmpegPath: dependencyManager.getFfmpegPath(),
        binPath: dependencyManager.getBinPath()
    };
}

function findExecutable(execName) {
    if (!dependencyManager) {
        console.error('[findExecutable] DependencyManager not initialized!');
        return null;
    }

    if (execName.includes('yt-dlp')) {
        const ytdlpPath = dependencyManager.getYtDlpPath();
        if (ytdlpPath) {
            console.log(`[findExecutable] Found yt-dlp at: ${ytdlpPath}`);
            return ytdlpPath;
        }
        console.error('[findExecutable] yt-dlp not found in local directory');
        return null;
    }

    if (execName.includes('ffmpeg')) {
        const ffmpegPath = dependencyManager.getFfmpegPath();
        if (ffmpegPath) {
            console.log(`[findExecutable] Found ffmpeg at: ${ffmpegPath}`);
            return ffmpegPath;
        }
        console.error('[findExecutable] ffmpeg not found in local directory');
        return null;
    }

    console.error(`[findExecutable] Unknown executable: ${execName}`);
    return null;
}

module.exports = {
    initDependencyManager,
    getDependencyManager,
    checkDependencies,
    downloadMissingDependencies,
    getDependencyPaths,
    findExecutable
};
