const fs = require('fs');
const path = require('path');

function cleanupResidualFiles(baseName, dirPath) {
    if (!baseName || !dirPath) return;
    const files = fs.readdirSync(dirPath);
    const pattern = new RegExp(`^${baseName}\.f\\d+\.mp4$|^${baseName}\.temp\..+`, 'i');
    for (const f of files) {
        if (pattern.test(f)) {
            try { fs.unlinkSync(path.join(dirPath, f)); } catch {}
        }
    }
}

function cleanupPartialFiles(destPath) {
    try {
        if (!destPath) return;
        const parsed = path.parse(destPath);
        if (fs.existsSync(destPath)) {
            try { fs.unlinkSync(destPath); } catch {}
        }
        const part = `${destPath}.part`;
        if (fs.existsSync(part)) {
            try { fs.unlinkSync(part); } catch {}
        }
        cleanupResidualFiles(parsed.name, parsed.dir);
    } catch {}
}

module.exports = { cleanupResidualFiles, cleanupPartialFiles };
