const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

let downloadsHistory = [];

const historyFile = () => path.join(app.getPath('userData'), 'history.json');

async function loadHistory() {
    try {
        const file = historyFile();
        if (fs.existsSync(file)) {
            const data = fs.readFileSync(file, 'utf-8');
            downloadsHistory = JSON.parse(data || '[]');
        }
    } catch (error) {
        console.error('loadHistory error:', error);
        downloadsHistory = [];
    }
}

async function saveHistory() {
    try {
        fs.mkdirSync(app.getPath('userData'), { recursive: true });
        fs.writeFileSync(historyFile(), JSON.stringify(downloadsHistory.slice(-500), null, 2));
    } catch (error) {
        console.error('saveHistory error:', error);
        try {
            const backupFile = path.join(os.tmpdir(), `downtube-history-backup-${Date.now()}.json`);
            fs.writeFileSync(backupFile, JSON.stringify(downloadsHistory.slice(-500), null, 2));
        } catch (backupError) {
            console.error('Failed to create backup history file:', backupError);
        }
    }
}

function getHistory() {
    return downloadsHistory;
}

function clearHistory() {
    downloadsHistory = [];
    saveHistory();
}

function addHistoryEntry(entry) {
    downloadsHistory.push(entry);
}

module.exports = {
    loadHistory,
    saveHistory,
    getHistory,
    clearHistory,
    addHistoryEntry
};
