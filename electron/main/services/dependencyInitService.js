const https = require('https');
const { dialog } = require('electron');
const { broadcast } = require('../utils/broadcast');
const { getSplashWindow, getMainWindow } = require('../state');
const { checkDependencies, downloadMissingDependencies, findExecutable, getDependencyPaths } = require('./dependencyService');

async function checkInternetConnection() {
    return new Promise((resolve) => {
        const options = {
            hostname: 'www.google.com',
            port: 443,
            path: '/',
            method: 'HEAD',
            timeout: 5000
        };

        const req = https.request(options, () => {
            resolve(true);
        });

        req.on('error', () => {
            resolve(false);
        });

        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });

        req.end();
    });
}

async function initializeDependencies() {
    let depStatus = { allAvailable: true };
    try {
        console.log('[Startup] Checking dependencies...');

        const splashWindow = getSplashWindow();
        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.webContents.send('splash-status', 'Checking dependencies...');
        }

        depStatus = checkDependencies();
        const depPaths = getDependencyPaths();
        if (splashWindow && !splashWindow.isDestroyed() && depPaths?.binPath) {
            splashWindow.webContents.send('deps-path', depPaths.binPath);
        }

        const hasInternet = await checkInternetConnection();
        depStatus.offline = !hasInternet;
        if (!hasInternet) {
            console.log('[Startup] No internet connection detected');
            if (splashWindow && !splashWindow.isDestroyed()) {
                splashWindow.webContents.send('no-internet');
            }
        }

        if (!depStatus.allAvailable) {
            console.log('[Startup] Some dependencies are missing, checking internet...');

            if (!hasInternet) {
                return depStatus;
            }

            console.log('[Startup] Internet connected, downloading dependencies...');

            const progressCallback = (progress) => {
                broadcast('dependency-download-progress', progress);
            };

            await downloadMissingDependencies(progressCallback);
            console.log('[Startup] All dependencies downloaded successfully');
            broadcast('dependency-download-complete', { success: true });

            await new Promise(resolve => setTimeout(resolve, 1000));
            depStatus = checkDependencies();
        } else {
            console.log('[Startup] All dependencies are available');
            if (splashWindow && !splashWindow.isDestroyed()) {
                splashWindow.webContents.send('splash-status', 'Loading application...');
            }
        }

        const ytdlpPath = findExecutable(process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
        const ffmpegPath = findExecutable(process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
        depStatus.ytdlpAvailable = !!ytdlpPath;
        depStatus.ffmpegAvailable = !!ffmpegPath;
        console.log('[Startup] yt-dlp path:', ytdlpPath);
        console.log('[Startup] ffmpeg path:', ffmpegPath);

        if (!ytdlpPath || !ffmpegPath) {
            console.error('[Startup] ERROR: Failed to locate required dependencies!');
            if (depStatus.allAvailable) {
                if (!ffmpegPath) {
                    dialog.showErrorBox(
                        'Missing FFmpeg',
                        'FFmpeg is required for audio conversion. Please check your internet connection and try again.'
                    );
                } else {
                    console.warn('[Startup] yt-dlp is missing; downloader features will be unavailable.');
                }
            }
        }
    } catch (error) {
        console.error('[Startup] Error setting up dependencies:', error);
        dialog.showErrorBox(
            'Dependency Error',
            `Failed to setup required dependencies: ${error.message}\n\nPlease check your internet connection and try again.`
        );
    }

    return depStatus;
}

module.exports = {
    initializeDependencies
};
