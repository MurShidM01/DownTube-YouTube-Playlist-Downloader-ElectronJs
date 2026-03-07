const { ipcMain, dialog, shell, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const ErrorHandler = require('../services/errorHandler');
const UpdateChecker = require('../services/updateChecker');
const { getMainWindow, getSplashWindow, getAppMode, setAppMode } = require('../state');
const { getDefaultOutputDir, getSettings, updateSettings } = require('../services/settingsService');
const { getHistory, clearHistory } = require('../services/historyService');
const { handleProbeFormats, handleFetchInfo } = require('../services/ytdlpService');
const { startDownload, cancelDownload, getActiveDownloads } = require('../services/download/downloadManager');
const { startConversion, getActiveConversions } = require('../services/conversion/videoToAudioService');
const { checkDependencies, downloadMissingDependencies, getDependencyPaths } = require('../services/dependencyService');
const { initializeDependencies } = require('../services/dependencyInitService');
const { broadcast } = require('../utils/broadcast');

function registerIpc() {
    ipcMain.handle('get-default-output-dir', async () => {
        return getDefaultOutputDir();
    });

    ipcMain.handle('get-active-downloads', async () => {
        return getActiveDownloads();
    });

    ipcMain.handle('get-active-conversions', async () => {
        return getActiveConversions();
    });

    ipcMain.handle('get-history', async () => {
        return getHistory();
    });

    ipcMain.handle('clear-history', async () => {
        clearHistory();
        return { ok: true };
    });

    ipcMain.handle('show-item-in-folder', async (_event, filePath) => {
        try {
            shell.showItemInFolder(filePath);
            return { ok: true };
        } catch (error) {
            console.error('Error showing item in folder:', error);
            return { ok: false, error: error.message };
        }
    });

    ipcMain.handle('open-path', async (_event, folderPath) => {
        try {
            await shell.openPath(folderPath);
            return { ok: true };
        } catch (error) {
            console.error('Error opening path:', error);
            return { ok: false, error: error.message };
        }
    });

    ipcMain.handle('get-settings', async () => {
        return getSettings();
    });

    ipcMain.handle('get-app-mode', async () => {
        return getAppMode();
    });

    ipcMain.handle('save-settings', async (_event, next) => {
        return updateSettings(next);
    });

    ipcMain.handle('get-app-info', async () => {
        let author = '';
        let description = '';
        try {
            const { app } = require('electron');
            const pkgPath = path.join(app.getAppPath(), 'package.json');
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            author = typeof pkg.author === 'string' ? pkg.author : (pkg.author?.name || '');
            description = pkg.description || '';
        } catch {}
        const app = require('electron').app;
        return {
            name: app.getName(),
            version: app.getVersion(),
            author,
            description
        };
    });

    ipcMain.handle('window-close', async (event) => {
        try {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (win) win.close();
            return { ok: true };
        } catch (e) {
            return { ok: false, message: e?.message || String(e) };
        }
    });

    ipcMain.handle('window-minimize', async (event) => {
        try {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (win) win.minimize();
            return { ok: true };
        } catch (e) {
            return { ok: false, message: e?.message || String(e) };
        }
    });

    ipcMain.handle('window-maximize-toggle', async (event) => {
        try {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (!win) return { ok: false };
            if (win.isMaximized()) win.unmaximize(); else win.maximize();
            return { ok: true };
        } catch (e) {
            return { ok: false, message: e?.message || String(e) };
        }
    });

    ipcMain.handle('probe-formats', async (_event, url) => {
        return await handleProbeFormats(url);
    });

    ipcMain.handle('fetch-info', async (_event, url) => {
        return await handleFetchInfo(url);
    });

    ipcMain.handle('start-download', async (event, args) => {
        return await startDownload(args, event.sender);
    });

    ipcMain.handle('start-conversion', async (_event, args) => {
        return await startConversion(args);
    });

    ipcMain.handle('cancel-download', async (_event, id) => {
        return await cancelDownload(id);
    });

    ipcMain.handle('check-for-updates', async () => {
        try {
            const updateInfo = await UpdateChecker.checkForUpdates();
            if (updateInfo) {
                return { ok: true, hasUpdate: true, updateInfo };
            }
            return { ok: true, hasUpdate: false };
        } catch (error) {
            await ErrorHandler.handleError(error, 'check-for-updates');
            return { ok: false, message: ErrorHandler.getErrorMessage(error) };
        }
    });

    ipcMain.handle('show-update-dialog', async (_event, updateInfo) => {
        try {
            await UpdateChecker.showUpdateDialog(updateInfo);
            return { ok: true };
        } catch (error) {
            await ErrorHandler.handleError(error, 'show-update-dialog');
            return { ok: false, message: ErrorHandler.getErrorMessage(error) };
        }
    });

    ipcMain.handle('get-update-preferences', async () => {
        try {
            const file = UpdateChecker.lastCheckFile();
            if (!fs.existsSync(file)) {
                return { ok: true, preferences: {} };
            }

            const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
            return {
                ok: true,
                preferences: {
                    lastCheck: data.lastCheck || 0,
                    skippedVersions: data.skippedVersions || [],
                    dontShowAgain: data.dontShowAgain || []
                }
            };
        } catch (error) {
            await ErrorHandler.handleError(error, 'get-update-preferences');
            return { ok: false, message: ErrorHandler.getErrorMessage(error) };
        }
    });

    ipcMain.handle('choose-output-dir', async () => {
        const mainWindow = getMainWindow();
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory', 'createDirectory']
        });
        if (canceled || !filePaths?.length) return null;
        return filePaths[0];
    });

    ipcMain.handle('choose-cookies-file', async () => {
        const mainWindow = getMainWindow();
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: 'Cookies', extensions: ['txt', 'cookies'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        if (canceled || !filePaths?.length) return null;
        return filePaths[0];
    });

    ipcMain.handle('choose-video-files', async () => {
        const mainWindow = getMainWindow();
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile', 'multiSelections'],
            filters: [
                { name: 'Video Files', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'm4v', 'mpeg', 'mpg'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        if (canceled || !filePaths?.length) return [];
        return filePaths;
    });

    ipcMain.handle('check-dependencies', async () => {
        try {
            const status = checkDependencies();
            if (!status) {
                return { ok: false, message: 'Dependency manager not initialized' };
            }
            return { ok: true, ...status };
        } catch (error) {
            await ErrorHandler.handleError(error, 'check-dependencies');
            return { ok: false, message: ErrorHandler.getErrorMessage(error) };
        }
    });

    ipcMain.handle('download-dependencies', async () => {
        try {
            const progressCallback = (progress) => {
                broadcast('dependency-download-progress', progress);
            };

            const result = await downloadMissingDependencies(progressCallback);
            broadcast('dependency-download-complete', { success: true });
            return { ok: true, ...result };
        } catch (error) {
            await ErrorHandler.handleError(error, 'download-dependencies');
            broadcast('dependency-download-complete', { success: false, error: error.message });
            return { ok: false, message: ErrorHandler.getErrorMessage(error) };
        }
    });

    ipcMain.handle('get-dependency-paths', async () => {
        try {
            const paths = getDependencyPaths();
            if (!paths) {
                return { ok: false, message: 'Dependency manager not initialized' };
            }
            return { ok: true, ...paths };
        } catch (error) {
            await ErrorHandler.handleError(error, 'get-dependency-paths');
            return { ok: false, message: ErrorHandler.getErrorMessage(error) };
        }
    });

    ipcMain.on('retry-connection', async () => {
        console.log('[Startup] Retrying connection...');
        const depStatus = await initializeDependencies();
        const offline = !!depStatus.offline;
        const ffmpegAvailable = !!depStatus.ffmpegAvailable;
        const converterOnly = offline && ffmpegAvailable;
        setAppMode({ offline, converterOnly, ffmpegAvailable });
        broadcast('app-mode', { offline, converterOnly, ffmpegAvailable });
        const splashWindow = getSplashWindow();
        if (offline && !ffmpegAvailable) {
            const splashWindow = getSplashWindow();
            if (splashWindow && !splashWindow.isDestroyed()) {
                splashWindow.webContents.send('offline-block', {
                    title: 'Offline mode',
                    message: 'You are offline and FFmpeg is not available. Connect to the internet to download FFmpeg.'
                });
            }
            return;
        }
        if (depStatus.allAvailable || (depStatus.ytdlp && depStatus.ffmpeg) || converterOnly) {
            setTimeout(() => {
                try { splashWindow?.close(); } catch {}
                getMainWindow()?.show();
            }, 2000);
        }
    });
}

module.exports = { registerIpc };
