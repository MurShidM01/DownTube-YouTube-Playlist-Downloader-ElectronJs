const { BrowserWindow } = require('electron');
const path = require('path');
const { setSplashWindow } = require('../state');
const { getSettings } = require('../services/settingsService');

function createSplash() {
    const splashWindow = new BrowserWindow({
        width: 550,
        height: 500,
        frame: false,
        transparent: true,
        resizable: false,
        alwaysOnTop: true,
        backgroundColor: '#00000000',
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true
        }
    });

    splashWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'splash.html'));

    splashWindow.webContents.once('did-finish-load', () => {
        const settings = getSettings();
        if (settings && settings.font) {
            splashWindow.webContents.send('apply-font', settings.font);
        }
    });

    setSplashWindow(splashWindow);
    return splashWindow;
}

module.exports = { createSplash };
