const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { findFileRecursive } = require('./dependencyFsUtils');

async function extractFfmpegTar({ archivePath, extractDir, ffmpegPath }) {
    if (!fs.existsSync(extractDir)) {
        fs.mkdirSync(extractDir, { recursive: true });
    }

    await new Promise((resolve, reject) => {
        const tar = spawn('tar', ['-xJf', archivePath, '-C', extractDir], { stdio: 'ignore' });
        tar.on('error', (err) => reject(new Error(`Failed to run tar: ${err.message}`)));
        tar.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`tar exited with code ${code}`));
        });
    });

    const ffmpegBinary = findFileRecursive(extractDir, 'ffmpeg');
    if (!ffmpegBinary) {
        throw new Error('Failed to locate ffmpeg binary inside the downloaded archive.');
    }

    try {
        if (fs.existsSync(ffmpegPath)) fs.unlinkSync(ffmpegPath);
        fs.copyFileSync(ffmpegBinary, ffmpegPath);
        fs.chmodSync(ffmpegPath, 0o755);
    } catch (error) {
        throw new Error(`Failed to install ffmpeg binary: ${error.message}`);
    }
}

module.exports = {
    extractFfmpegTar
};
