const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ErrorHandler = require('../errorHandler');
const { getSettings, getDefaultOutputDir } = require('../settingsService');
const { findExecutable } = require('../dependencyService');
const { broadcast } = require('../../utils/broadcast');

const activeConversions = new Map();
const conversionProcesses = new Map();

const audioPresets = {
    mp3: ['-codec:a', 'libmp3lame'],
    m4a: ['-codec:a', 'aac'],
    wav: ['-codec:a', 'pcm_s16le']
};

function buildBitrateArgs(format, bitrateKbps) {
    if (!bitrateKbps || Number.isNaN(bitrateKbps)) return [];
    if (format === 'wav') return [];
    const target = `${Math.max(32, Math.min(512, Number(bitrateKbps)))}k`;
    return ['-b:a', target];
}

function getActiveConversions() {
    return Array.from(activeConversions.values());
}

function parseDuration(text) {
    if (!text) return null;
    const match = text.match(/Duration:\s(\d+):(\d+):(\d+(?:\.\d+)?)/i);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) return null;
    return (hours * 3600) + (minutes * 60) + seconds;
}

function parseProgressTime(text) {
    if (!text) return null;
    const match = text.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/i);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) return null;
    return (hours * 3600) + (minutes * 60) + seconds;
}

async function probeDuration(ffmpegPath, inputPath) {
    return new Promise((resolve) => {
        const child = spawn(ffmpegPath, ['-hide_banner', '-i', inputPath], { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        child.stderr.on('data', (data) => {
            stderr += data?.toString?.() || '';
        });
        child.on('close', () => {
            resolve(parseDuration(stderr));
        });
        child.on('error', () => resolve(null));
    });
}

function buildOutputPath(outputDir, inputPath, format) {
    const parsed = path.parse(inputPath);
    const base = parsed.name || 'audio';
    let target = path.join(outputDir, `${base}.${format}`);
    if (!fs.existsSync(target)) return target;
    let idx = 1;
    while (idx < 9999) {
        const candidate = path.join(outputDir, `${base} (${idx}).${format}`);
        if (!fs.existsSync(candidate)) return candidate;
        idx += 1;
    }
    return path.join(outputDir, `${base}-${Date.now()}.${format}`);
}

function updateConversion(id, patch) {
    if (!activeConversions.has(id)) return;
    const current = activeConversions.get(id);
    const next = { ...current, ...patch };
    activeConversions.set(id, next);
    broadcast('convert-progress', next);
}

async function convertOne({ id, inputPath, outputDir, format, bitrateKbps }) {
    return new Promise(async (resolve, reject) => {
        const ffmpegPath = findExecutable(process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
        if (!ffmpegPath) {
            return reject(new Error('FFmpeg is not available.'));
        }

        const outputPath = buildOutputPath(outputDir, inputPath, format);
        const duration = await probeDuration(ffmpegPath, inputPath);
        const audioArgs = audioPresets[format] || audioPresets.mp3;
        const bitrateArgs = buildBitrateArgs(format, bitrateKbps);
        const args = ['-y', '-i', inputPath, '-vn', ...audioArgs, ...bitrateArgs, outputPath];

        updateConversion(id, { outputPath, phase: 'converting', indeterminate: !duration });

        const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
        conversionProcesses.set(id, child);

        child.stderr.on('data', (data) => {
            const text = data?.toString?.() || '';
            const seconds = parseProgressTime(text);
            if (duration && seconds != null) {
                const pct = Math.min(100, Math.max(0, Math.round((seconds / duration) * 100)));
                updateConversion(id, { percent: pct });
            }
        });

        child.on('error', (err) => {
            conversionProcesses.delete(id);
            reject(new Error(`Failed to start ffmpeg: ${err.message}`));
        });

        child.on('close', (code) => {
            conversionProcesses.delete(id);
            if (code === 0) {
                resolve({ outputPath });
            } else {
                reject(new Error('Conversion failed.'));
            }
        });
    });
}

async function startConversion(args) {
    try {
        const files = Array.isArray(args?.files) ? args.files.filter(Boolean) : [];
        if (!files.length) {
            throw ErrorHandler.createError(
                ErrorHandler.errorTypes.VALIDATION,
                'Please select at least one video file.',
                { files },
                true
            );
        }

        const settings = getSettings();
        const outDir = args.outputDir || settings.defaultOutputDir || getDefaultOutputDir();
        await ErrorHandler.validateOutputDirectory(outDir);

        const format = (args.format || 'mp3').toLowerCase();
        const bitrateKbps = Number(args.bitrateKbps) || null;
        const total = files.length;

        // Run conversions asynchronously so IPC returns immediately.
        setImmediate(async () => {
            for (const inputPath of files) {
                if (!fs.existsSync(inputPath)) {
                    broadcast('convert-error', { inputPath, message: 'File not found.' });
                    continue;
                }

                const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                const entry = {
                    id,
                    inputPath,
                    outputDir: outDir,
                    format,
                    percent: 0,
                    phase: 'queued',
                    startedAt: Date.now()
                };
                activeConversions.set(id, entry);
                broadcast('convert-progress', entry);

                try {
                    const result = await convertOne({ id, inputPath, outputDir: outDir, format, bitrateKbps });
                    activeConversions.delete(id);
                    broadcast('convert-complete', {
                        id,
                        inputPath,
                        outputPath: result.outputPath,
                        format,
                        outputDir: outDir
                    });
                } catch (err) {
                    activeConversions.delete(id);
                    broadcast('convert-error', {
                        id,
                        inputPath,
                        message: err?.message || 'Conversion failed.'
                    });
                }
            }
        });

        return { ok: true, total, outputDir: outDir };
    } catch (error) {
        await ErrorHandler.handleError(error, 'start-conversion');
        return { ok: false, message: ErrorHandler.getErrorMessage(error) };
    }
}

module.exports = {
    startConversion,
    getActiveConversions
};
