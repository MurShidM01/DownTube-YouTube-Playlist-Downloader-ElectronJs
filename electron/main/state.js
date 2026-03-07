let mainWindow = null;
let splashWindow = null;
let appMode = { offline: false, converterOnly: false, ffmpegAvailable: false };

module.exports = {
    getMainWindow: () => mainWindow,
    setMainWindow: (win) => { mainWindow = win; },
    getSplashWindow: () => splashWindow,
    setSplashWindow: (win) => { splashWindow = win; },
    getAppMode: () => appMode,
    setAppMode: (next) => { appMode = { ...appMode, ...next }; }
};
