const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { URL } = require('url');

class DependencyManager {
    constructor() {
        // Define where executables should be stored
        // For installed app: C:\Users\{username}\AppData\Local\Programs\DownTube\bin
        // For dev: project directory
        
        // Determine the app installation directory
        let appDir;
        if (app.isPackaged) {
            // In production: use the directory where the .exe is located
            // This will be: C:\Users\{username}\AppData\Local\Programs\DownTube
            appDir = path.dirname(app.getPath('exe'));
        } else {
            // In development: use userData path
            appDir = app.getPath('userData');
        }
        
        this.binPath = path.join(appDir, 'bin');
        
        // Ensure bin directory exists
        if (!fs.existsSync(this.binPath)) {
            try {
                fs.mkdirSync(this.binPath, { recursive: true });
                console.log(`[DependencyManager] Created bin directory at: ${this.binPath}`);
            } catch (error) {
                console.error(`[DependencyManager] Failed to create bin directory: ${error.message}`);
                // Fallback to userData if we can't create in installation directory
                this.binPath = path.join(app.getPath('userData'), 'bin');
                if (!fs.existsSync(this.binPath)) {
                    fs.mkdirSync(this.binPath, { recursive: true });
                }
            }
        }

        this.ytdlpPath = path.join(this.binPath, 'yt-dlp.exe');
        this.ffmpegPath = path.join(this.binPath, 'ffmpeg.exe');

        // Download URLs
        this.ytdlpUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
        this.ffmpegUrl = 'https://github.com/MurShidM01/YouTube-Playlist-Downloader-Application/releases/download/v1.4.1/ffmpeg.exe';
        
        // Download state
        this.downloadProgress = new Map();
        this.isDownloading = new Map();
    }

    /**
     * Check if both dependencies are available
     */
    checkDependencies() {
        const ytdlpExists = fs.existsSync(this.ytdlpPath);
        const ffmpegExists = fs.existsSync(this.ffmpegPath);
        
        console.log('[DependencyManager] Checking dependencies:');
        console.log(`  yt-dlp: ${ytdlpExists ? 'Found' : 'Missing'} at ${this.ytdlpPath}`);
        console.log(`  ffmpeg: ${ffmpegExists ? 'Found' : 'Missing'} at ${this.ffmpegPath}`);

        return {
            ytdlp: ytdlpExists,
            ffmpeg: ffmpegExists,
            allAvailable: ytdlpExists && ffmpegExists,
            ytdlpPath: this.ytdlpPath,
            ffmpegPath: this.ffmpegPath
        };
    }

    /**
     * Download a file with progress reporting
     */
    async downloadFile(url, destPath, name, onProgress) {
        return new Promise((resolve, reject) => {
            if (this.isDownloading.get(name)) {
                reject(new Error(`${name} is already being downloaded`));
                return;
            }

            this.isDownloading.set(name, true);
            this.downloadProgress.set(name, 0);

            console.log(`[DependencyManager] Starting download: ${name}`);
            console.log(`  From: ${url}`);
            console.log(`  To: ${destPath}`);

            const parsedUrl = new URL(url);
            
            const makeRequest = (requestUrl) => {
                const options = {
                    hostname: requestUrl.hostname,
                    port: requestUrl.port || 443,
                    path: requestUrl.pathname + requestUrl.search,
                    method: 'GET',
                    headers: {
                        'User-Agent': 'DownTube-DependencyManager/1.0'
                    }
                };

                const req = https.request(options, (res) => {
                    // Handle redirects
                    if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303 || res.statusCode === 307 || res.statusCode === 308) {
                        const redirectUrl = new URL(res.headers.location, requestUrl);
                        console.log(`[DependencyManager] Following redirect to: ${redirectUrl.href}`);
                        makeRequest(redirectUrl);
                        return;
                    }

                    if (res.statusCode !== 200) {
                        this.isDownloading.delete(name);
                        reject(new Error(`Failed to download ${name}: HTTP ${res.statusCode}`));
                        return;
                    }

                    const totalBytes = parseInt(res.headers['content-length'], 10);
                    let downloadedBytes = 0;
                    let lastProgressUpdate = Date.now();

                    // Create temporary file
                    const tempPath = `${destPath}.tmp`;
                    const fileStream = fs.createWriteStream(tempPath);

                    // Set up activity timeout (reset on each data chunk)
                    let activityTimeout;
                    const resetActivityTimeout = () => {
                        if (activityTimeout) clearTimeout(activityTimeout);
                        activityTimeout = setTimeout(() => {
                            console.error(`[DependencyManager] No data received for 60 seconds, aborting ${name}`);
                            req.destroy();
                            try { fs.unlinkSync(tempPath); } catch {}
                            this.isDownloading.delete(name);
                            reject(new Error(`Download timeout: No data received for ${name}`));
                        }, 60000); // 60 second activity timeout
                    };
                    
                    resetActivityTimeout();

                    res.on('data', (chunk) => {
                        resetActivityTimeout(); // Reset timeout on each data chunk
                        downloadedBytes += chunk.length;
                        
                        // Throttle progress updates to every 500ms
                        const now = Date.now();
                        if (totalBytes && (now - lastProgressUpdate > 500 || downloadedBytes === totalBytes)) {
                            lastProgressUpdate = now;
                            const progress = Math.floor((downloadedBytes / totalBytes) * 100);
                            this.downloadProgress.set(name, progress);
                            if (onProgress) {
                                onProgress({
                                    name,
                                    progress,
                                    downloadedBytes,
                                    totalBytes,
                                    downloadedMB: (downloadedBytes / 1024 / 1024).toFixed(2),
                                    totalMB: (totalBytes / 1024 / 1024).toFixed(2)
                                });
                            }
                        }
                    });

                    res.pipe(fileStream);

                    fileStream.on('finish', () => {
                        if (activityTimeout) clearTimeout(activityTimeout);
                        fileStream.close(() => {
                            // Move temp file to final destination
                            try {
                                if (fs.existsSync(destPath)) {
                                    fs.unlinkSync(destPath);
                                }
                                fs.renameSync(tempPath, destPath);
                                
                                // Make executable on Unix-like systems
                                if (process.platform !== 'win32') {
                                    fs.chmodSync(destPath, 0o755);
                                }

                                console.log(`[DependencyManager] Successfully downloaded: ${name}`);
                                this.isDownloading.delete(name);
                                this.downloadProgress.delete(name);
                                resolve(destPath);
                            } catch (error) {
                                this.isDownloading.delete(name);
                                reject(new Error(`Failed to save ${name}: ${error.message}`));
                            }
                        });
                    });

                    fileStream.on('error', (error) => {
                        if (activityTimeout) clearTimeout(activityTimeout);
                        this.isDownloading.delete(name);
                        try {
                            fs.unlinkSync(tempPath);
                        } catch {}
                        reject(new Error(`File write error for ${name}: ${error.message}`));
                    });

                    res.on('error', (error) => {
                        if (activityTimeout) clearTimeout(activityTimeout);
                        this.isDownloading.delete(name);
                        try {
                            fs.unlinkSync(tempPath);
                        } catch {}
                        reject(new Error(`Stream error for ${name}: ${error.message}`));
                    });
                });

                req.on('error', (error) => {
                    this.isDownloading.delete(name);
                    reject(new Error(`Network error downloading ${name}: ${error.message}`));
                });

                req.end();
            };

            makeRequest(parsedUrl);
        });
    }

    /**
     * Download yt-dlp
     */
    async downloadYtDlp(onProgress) {
        return this.downloadFile(this.ytdlpUrl, this.ytdlpPath, 'yt-dlp', onProgress);
    }

    /**
     * Download ffmpeg
     */
    async downloadFfmpeg(onProgress) {
        return this.downloadFile(this.ffmpegUrl, this.ffmpegPath, 'ffmpeg', onProgress);
    }

    /**
     * Download all missing dependencies
     */
    async downloadMissingDependencies(onProgress) {
        const status = this.checkDependencies();
        const downloads = [];

        if (!status.ytdlp) {
            console.log('[DependencyManager] yt-dlp is missing, will download...');
            downloads.push(this.downloadYtDlp(onProgress));
        }

        if (!status.ffmpeg) {
            console.log('[DependencyManager] ffmpeg is missing, will download...');
            downloads.push(this.downloadFfmpeg(onProgress));
        }

        if (downloads.length === 0) {
            console.log('[DependencyManager] All dependencies are already present');
            return { success: true, downloaded: [] };
        }

        try {
            const results = await Promise.all(downloads);
            console.log('[DependencyManager] All missing dependencies downloaded successfully');
            return { success: true, downloaded: results };
        } catch (error) {
            console.error('[DependencyManager] Failed to download dependencies:', error);
            throw error;
        }
    }

    /**
     * Get the path to yt-dlp executable (only local, never system)
     */
    getYtDlpPath() {
        if (fs.existsSync(this.ytdlpPath)) {
            return this.ytdlpPath;
        }
        return null;
    }

    /**
     * Get the path to ffmpeg executable (only local, never system)
     */
    getFfmpegPath() {
        if (fs.existsSync(this.ffmpegPath)) {
            return this.ffmpegPath;
        }
        return null;
    }

    /**
     * Get download progress for a specific dependency
     */
    getProgress(name) {
        return this.downloadProgress.get(name) || 0;
    }

    /**
     * Check if a dependency is currently being downloaded
     */
    isDownloadInProgress(name) {
        return this.isDownloading.get(name) || false;
    }
}

module.exports = DependencyManager;

