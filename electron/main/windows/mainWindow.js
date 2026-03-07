const { BrowserWindow, shell, app, screen } = require('electron');
const path = require('path');
const { setMainWindow } = require('../state');
const { getAppIconPath } = require('../utils/appPaths');

function createMainWindow(show = false) {
    const { width: workWidth, height: workHeight } = screen.getPrimaryDisplay().workAreaSize;
    const targetWidth = Math.round(workWidth * 0.9);
    const targetHeight = Math.round(workHeight * 0.9);

    const mainWindow = new BrowserWindow({
        width: targetWidth,
        height: targetHeight,
        minWidth: 980,
        minHeight: 640,
        backgroundColor: '#00000000',
        title: 'DownTube - YouTube Downloader',
        frame: false,
        titleBarStyle: 'hidden',
        transparent: true,
        roundedCorners: true,
        icon: getAppIconPath(),
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, '..', '..', 'preload.js'),
            sandbox: false,
            nodeIntegration: false
        },
        show
    });

    mainWindow.removeMenu();
    mainWindow.center();

    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    if (devServerUrl) {
        mainWindow.loadURL(devServerUrl);
    } else {
        mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'renderer', 'index.html'));
    }

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:\/\//i.test(url)) {
            shell.openExternal(url).catch((err) => {
                console.error('[shell.openExternal] Failed to open URL:', url, err?.message || err);
            });
        }
        return { action: 'deny' };
    });

    setMainWindow(mainWindow);
    return mainWindow;
}

module.exports = { createMainWindow };
