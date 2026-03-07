const path = require('path');
const fs = require('fs');
const { app } = require('electron');

function getAppIconPath() {
    try {
        const devIco = path.join(app.getAppPath(), 'public', 'assets', 'icon.ico');
        if (fs.existsSync(devIco)) return devIco;
        const devPng = path.join(app.getAppPath(), 'public', 'assets', 'icon.png');
        if (fs.existsSync(devPng)) return devPng;
    } catch {}

    try {
        const prodIco = path.join(app.getAppPath(), 'dist', 'renderer', 'assets', 'icon.ico');
        if (fs.existsSync(prodIco)) return prodIco;
        const prodPng = path.join(app.getAppPath(), 'dist', 'renderer', 'assets', 'icon.png');
        if (fs.existsSync(prodPng)) return prodPng;
    } catch {}

    return undefined;
}

module.exports = { getAppIconPath };
