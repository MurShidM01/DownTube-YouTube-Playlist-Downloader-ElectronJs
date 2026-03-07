const { BrowserWindow } = require('electron');

function broadcast(channel, payload) {
    try {
        for (const win of BrowserWindow.getAllWindows()) {
            win.webContents.send(channel, payload);
        }
    } catch {}
}

module.exports = { broadcast };
