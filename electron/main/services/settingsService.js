const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

let appSettings = { theme: 'light', font: 'Ubuntu', showCompleteDialog: true, openFolderOnComplete: false, cookiesPath: '' };

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

async function loadSettings() {
    try {
        const file = settingsFile();
        if (fs.existsSync(file)) {
            const data = fs.readFileSync(file, 'utf-8');
            appSettings = { ...appSettings, ...(JSON.parse(data || '{}')) };
        }
    } catch (error) {
        console.error('loadSettings error:', error);
        console.log('Using default settings due to corruption');
    }
}

function saveSettings() {
    try {
        fs.mkdirSync(app.getPath('userData'), { recursive: true });
        fs.writeFileSync(settingsFile(), JSON.stringify(appSettings, null, 2));
    } catch {
        // ignore
    }
}

function getSettings() {
    return appSettings;
}

function updateSettings(next) {
    appSettings = { ...appSettings, ...(next || {}) };
    saveSettings();
    return appSettings;
}

function getDefaultOutputDir() {
    const outDir = path.join(os.homedir(), 'Downloads', 'DownTube');
    try {
        fs.mkdirSync(outDir, { recursive: true });
    } catch {}
    return outDir;
}

function getCookiesArgs() {
    try {
        const cookiesPath = appSettings?.cookiesPath;
        if (!cookiesPath || typeof cookiesPath !== 'string') return [];
        if (!fs.existsSync(cookiesPath)) return [];
        return ['--cookies', cookiesPath];
    } catch {
        return [];
    }
}

module.exports = {
    loadSettings,
    getSettings,
    updateSettings,
    getDefaultOutputDir,
    getCookiesArgs,
    settingsFile
};
