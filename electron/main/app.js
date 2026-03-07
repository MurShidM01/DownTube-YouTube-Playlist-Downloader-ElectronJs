const { app, BrowserWindow } = require('electron');
const path = require('path');
const { loadHistory } = require('./services/historyService');
const { loadSettings } = require('./services/settingsService');
const { initDependencyManager } = require('./services/dependencyService');
const { createMainWindow } = require('./windows/mainWindow');
const { createSplash } = require('./windows/splashWindow');
const { initializeDependencies } = require('./services/dependencyInitService');
const UpdateChecker = require('./services/updateChecker');
const { registerIpc } = require('./ipc/registerIpc');
const { getMainWindow, getSplashWindow, setAppMode } = require('./state');
const { broadcast } = require('./utils/broadcast');

app.setPath('userData', path.join(app.getPath('appData'), 'DownTube-Dev'));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-features', 'MojoIpcz');

async function startApp() {
    await loadHistory();
    await loadSettings();

    initDependencyManager();

    console.log('[Startup] Current working directory:', process.cwd());
    console.log('[Startup] App resources path:', process.resourcesPath);
    console.log('[Startup] App path:', app.getAppPath());

    createSplash();
    createMainWindow(false);

    registerIpc();

    const depStatus = await initializeDependencies();
    const offline = !!depStatus.offline;
    const ffmpegAvailable = !!depStatus.ffmpegAvailable;
    const converterOnly = offline && ffmpegAvailable;

    setAppMode({ offline, converterOnly, ffmpegAvailable });
    broadcast('app-mode', { offline, converterOnly, ffmpegAvailable });

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

    if (!offline) {
        setTimeout(async () => {
            try {
                const updateInfo = await UpdateChecker.checkForUpdates();
                if (updateInfo && await UpdateChecker.shouldShowUpdate(updateInfo)) {
                    setTimeout(async () => {
                        await UpdateChecker.showUpdateDialog(updateInfo);
                    }, 3000);
                }
            } catch (error) {
                console.error('Error during update check:', error);
            }
        }, 5000);
    }

    const splashDelay = !depStatus.allAvailable ? 2500 : 1800;
    setTimeout(() => {
        try { getSplashWindow()?.close(); } catch {}
        getMainWindow()?.show();
    }, splashDelay);
}

app.whenReady().then(async () => {
    await startApp();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createSplash();
            createMainWindow(false);
            setTimeout(() => {
                try { getSplashWindow()?.close(); } catch {}
                getMainWindow()?.show();
            }, 2200);
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

module.exports = { startApp };

