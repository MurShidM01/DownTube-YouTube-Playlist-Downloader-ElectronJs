const fs = require('fs');
const path = require('path');

function findFileRecursive(root, name) {
    try {
        const entries = fs.readdirSync(root, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(root, entry.name);
            if (entry.isDirectory()) {
                const found = findFileRecursive(full, name);
                if (found) return found;
            } else if (entry.isFile() && entry.name === name) {
                return full;
            }
        }
    } catch {}
    return null;
}

function canWriteDir(dir) {
    try {
        const testFile = path.join(dir, `.downtube_write_test_${Date.now()}`);
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        return true;
    } catch {
        return false;
    }
}

module.exports = {
    findFileRecursive,
    canWriteDir
};
