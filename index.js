const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const sanitizeFilename = require('sanitize-filename');
const { spawn } = require('child_process');
const https = require('https');
const { URL } = require('url');
const DependencyManager = require('./dependencyManager');

// Error handling utilities
class ErrorHandler {
    static errorTypes = {
        NETWORK: 'NETWORK_ERROR',
        DOWNLOAD: 'DOWNLOAD_ERROR',
        FILE_SYSTEM: 'FILE_SYSTEM_ERROR',
        PROCESS: 'PROCESS_ERROR',
        VALIDATION: 'VALIDATION_ERROR',
        UNKNOWN: 'UNKNOWN_ERROR'
    };

    static createError(type, message, details = null, recoverable = false) {
        return {
            type,
            message,
            details,
            recoverable,
            timestamp: Date.now(),
            id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
    }

    static async handleError(error, context = '') {
        console.error(`[${context}] Error:`, error);
        
        // Log error to file for debugging
        try {
            const logDir = path.join(app.getPath('userData'), 'logs');
            fs.mkdirSync(logDir, { recursive: true });
            const logFile = path.join(logDir, `error-${new Date().toISOString().split('T')[0]}.log`);
            const logEntry = `[${new Date().toISOString()}] ${context}: ${error.message}\n${error.stack || ''}\n\n`;
            fs.appendFileSync(logFile, logEntry);
        } catch (logError) {
            console.error('Failed to log error:', logError);
        }

        return error;
    }

    static isNetworkError(error) {
        const networkErrors = [
            'ENOTFOUND', 'ENETUNREACH', 'ECONNREFUSED', 'ETIMEDOUT',
            'ECONNRESET', 'ENETDOWN', 'EHOSTUNREACH'
        ];
        return networkErrors.some(code => error.code === code || error.message.includes(code));
    }

    static isFileSystemError(error) {
        const fsErrors = [
            'ENOENT', 'EACCES', 'EPERM', 'ENOSPC', 'EROFS',
            'EEXIST', 'ENOTDIR', 'EISDIR'
        ];
        return fsErrors.some(code => error.code === code || error.message.includes(code));
    }

    static getErrorMessage(error) {
        if (this.isNetworkError(error)) {
            return 'Network connection failed. Please check your internet connection and try again.';
        }
        if (this.isFileSystemError(error)) {
            if (error.code === 'ENOSPC') {
                return 'Disk space is full. Please free up some space and try again.';
            }
            if (error.code === 'EACCES' || error.code === 'EPERM') {
                return 'Permission denied. Please check folder permissions and try again.';
            }
            return 'File system error. Please check folder permissions and try again.';
        }
        return error.message || 'An unexpected error occurred. Please try again.';
    }

    static async checkInternetConnection() {
        try {
            const https = require('https');
            return new Promise((resolve) => {
                // Try multiple endpoints for better reliability
                const endpoints = [
                    { hostname: 'www.google.com', path: '/' },
                    { hostname: 'www.youtube.com', path: '/' },
                    { hostname: '8.8.8.8', path: '/' }
                ];
                
                let resolved = false;
                let attempts = 0;
                
                const tryEndpoint = (endpoint) => {
                    if (resolved) return;
                    
                    const options = {
                        hostname: endpoint.hostname,
                        port: 443,
                        path: endpoint.path,
                        method: 'HEAD',
                        timeout: 3000,
                        rejectUnauthorized: false // Allow self-signed certs
                    };
                    
                    const req = https.request(options, (res) => {
                        if (!resolved) {
                            resolved = true;
                            resolve(true);
                        }
                    });
                    
                    req.on('error', () => {
                        attempts++;
                        if (attempts >= endpoints.length && !resolved) {
                            resolved = true;
                            resolve(false);
                        }
                    });
                    
                    req.on('timeout', () => {
                        req.destroy();
                        attempts++;
                        if (attempts >= endpoints.length && !resolved) {
                            resolved = true;
                            resolve(false);
                        }
                    });
                    
                    req.end();
                };
                
                // Try first endpoint
                tryEndpoint(endpoints[0]);
                
                // If first fails, try others after a short delay
                setTimeout(() => {
                    if (!resolved) tryEndpoint(endpoints[1]);
                }, 1000);
                
                setTimeout(() => {
                    if (!resolved) tryEndpoint(endpoints[2]);
                }, 2000);
                
                // Overall timeout
                setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        resolve(false);
                    }
                }, 5000);
            });
        } catch {
            return false;
        }
    }

    static async validateUrl(url) {
        if (!url || typeof url !== 'string') {
            throw this.createError(
                this.errorTypes.VALIDATION,
                'Invalid URL provided',
                { url },
                true
            );
        }

        const urlPattern = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\/.+/i;
        if (!urlPattern.test(url)) {
            throw this.createError(
                this.errorTypes.VALIDATION,
                'Please provide a valid YouTube URL',
                { url },
                true
            );
        }

        return true;
    }

    static async validateOutputDirectory(dir) {
        try {
            if (!dir || typeof dir !== 'string') {
                throw this.createError(
                    this.errorTypes.VALIDATION,
                    'Invalid output directory',
                    { dir },
                    true
                );
            }

            // Check if directory exists or can be created
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Check write permissions
            const testFile = path.join(dir, '.test-write');
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);

            return true;
        } catch (error) {
            throw this.createError(
                this.errorTypes.FILE_SYSTEM,
                'Cannot write to output directory. Please check permissions.',
                { dir, originalError: error.message },
                true
            );
        }
    }
}

// Retry mechanism for network operations
class RetryManager {
    static async withRetry(operation, maxRetries = 3, delay = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                
                // Don't retry on validation errors
                if (error.type === ErrorHandler.errorTypes.VALIDATION) {
                    throw error;
                }

                // Don't retry on file system errors (except network-related ones)
                if (error.type === ErrorHandler.errorTypes.FILE_SYSTEM && !ErrorHandler.isNetworkError(error)) {
                    throw error;
                }

                if (attempt < maxRetries) {
                    console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2; // Exponential backoff
                }
            }
        }
        
        throw lastError;
    }
}

// Version checking and update management
class UpdateChecker {
    static GITHUB_API_URL = 'https://api.github.com/repos/MurShidM01/DownTube-YouTube-Playlist-Downloader-ElectronJs/releases/latest';
    static GITHUB_RELEASE_URL = 'https://github.com/MurShidM01/DownTube-YouTube-Playlist-Downloader-ElectronJs/releases/latest';
    static CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
    static lastCheckFile = () => path.join(app.getPath('userData'), 'last-update-check.json');

    static async checkForUpdates() {
        try {
            // Check if we should check for updates
            if (!await this.shouldCheckForUpdates()) {
                return null;
            }

            // Check internet connectivity first
            if (!await ErrorHandler.checkInternetConnection()) {
                console.log('No internet connection, skipping update check');
                return null;
            }

            const latestRelease = await this.fetchLatestRelease();
            if (!latestRelease) {
                return null;
            }

            const currentVersion = app.getVersion();
            const latestVersion = latestRelease.tag_name.replace(/^v/, '');

            if (this.isNewerVersion(currentVersion, latestVersion)) {
                await this.saveLastCheck();
                return {
                    currentVersion,
                    latestVersion,
                    releaseNotes: latestRelease.body || 'No release notes available',
                    downloadUrl: latestRelease.html_url,
                    assets: latestRelease.assets || []
                };
            }

            await this.saveLastCheck();
            return null;
        } catch (error) {
            await ErrorHandler.handleError(error, 'UpdateChecker.checkForUpdates');
            return null;
        }
    }

    static async shouldCheckForUpdates() {
        try {
            const file = this.lastCheckFile();
            if (!fs.existsSync(file)) {
                return true;
            }

            const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
            const lastCheck = data.lastCheck || 0;
            const now = Date.now();

            return (now - lastCheck) >= this.CHECK_INTERVAL;
        } catch (error) {
            console.error('Error checking update interval:', error);
            return true;
        }
    }

    static async saveLastCheck() {
        try {
            const data = { lastCheck: Date.now() };
            fs.writeFileSync(this.lastCheckFile(), JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error saving last update check:', error);
        }
    }

    static async fetchLatestRelease() {
        return new Promise((resolve, reject) => {
            const url = new URL(this.GITHUB_API_URL);
            
            const options = {
                hostname: url.hostname,
                port: url.port || 443,
                path: url.pathname + url.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'DownTube-UpdateChecker/1.0',
                    'Accept': 'application/vnd.github.v3+json'
                },
                timeout: 10000 // 10 second timeout
            };

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        if (res.statusCode === 200) {
                            const release = JSON.parse(data);
                            resolve(release);
                        } else if (res.statusCode === 403) {
                            // Rate limited, try again later
                            console.log('GitHub API rate limited, will retry later');
                            resolve(null);
                        } else {
                            console.log(`GitHub API returned status ${res.statusCode}`);
                            resolve(null);
                        }
                    } catch (error) {
                        reject(new Error('Invalid JSON response from GitHub API'));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    static isNewerVersion(current, latest) {
        try {
            const currentParts = current.split('.').map(Number);
            const latestParts = latest.split('.').map(Number);

            for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
                const currentPart = currentParts[i] || 0;
                const latestPart = latestParts[i] || 0;

                if (latestPart > currentPart) {
                    return true;
                } else if (latestPart < currentPart) {
                    return false;
                }
            }

            return false; // Versions are equal
        } catch (error) {
            console.error('Error comparing versions:', error);
            return false;
        }
    }

    static async showUpdateDialog(updateInfo) {
        if (!mainWindow) {
            return;
        }

        try {
            const result = await dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'New Version Available! 🎉',
                message: `A new version of DownTube is available!`,
                detail: `Current Version: ${updateInfo.currentVersion}\nLatest Version: ${updateInfo.latestVersion}\n\n${updateInfo.releaseNotes}`,
                buttons: ['Download Update', 'Remind Me Later', 'Skip This Version'],
                defaultId: 0,
                cancelId: 1,
                checkboxLabel: 'Don\'t show this again for this version',
                checkboxChecked: false
            });

            if (result.response === 0) {
                // Download Update
                await shell.openExternal(updateInfo.downloadUrl);
            } else if (result.response === 2) {
                // Skip This Version
                await this.markVersionAsSkipped(updateInfo.latestVersion);
            }

            if (result.checkboxChecked) {
                await this.dontShowAgainForVersion(updateInfo.latestVersion);
            }
        } catch (error) {
            console.error('Error showing update dialog:', error);
        }
    }

    static async markVersionAsSkipped(version) {
        try {
            const file = this.lastCheckFile();
            const data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : {};
            data.skippedVersions = data.skippedVersions || [];
            data.skippedVersions.push(version);
            fs.writeFileSync(file, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error marking version as skipped:', error);
        }
    }

    static async dontShowAgainForVersion(version) {
        try {
            const file = this.lastCheckFile();
            const data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : {};
            data.dontShowAgain = data.dontShowAgain || [];
            data.dontShowAgain.push(version);
            fs.writeFileSync(file, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error setting dont show again for version:', error);
        }
    }

    static async shouldShowUpdate(updateInfo) {
        try {
            const file = this.lastCheckFile();
            if (!fs.existsSync(file)) {
                return true;
            }

            const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
            
            // Check if this version should not be shown again
            if (data.dontShowAgain && data.dontShowAgain.includes(updateInfo.latestVersion)) {
                return false;
            }

            // Check if this version was skipped
            if (data.skippedVersions && data.skippedVersions.includes(updateInfo.latestVersion)) {
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error checking if update should be shown:', error);
            return true;
        }
    }
}

let mainWindow;
let splashWindow;
const activeDownloads = new Map();
let downloadsHistory = [];
const downloadProcesses = new Map(); // id -> ChildProcess
const terminationReasons = new Map(); // id -> 'cancelled'
const historyFile = () => path.join(app.getPath('userData'), 'history.json');
let appSettings = { theme: 'light', font: 'Poppins', showCompleteDialog: true, openFolderOnComplete: false };
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

// Initialize dependency manager
let dependencyManager;

async function loadHistory() {
	try {
		const file = historyFile();
		if (fs.existsSync(file)) {
			const data = fs.readFileSync(file, 'utf-8');
			downloadsHistory = JSON.parse(data || '[]');
		}
	} catch (error) {
		await ErrorHandler.handleError(error, 'loadHistory');
		// Reset to empty array if corrupted
		downloadsHistory = [];
	}
}

async function saveHistory() {
	try {
		fs.mkdirSync(app.getPath('userData'), { recursive: true });
		fs.writeFileSync(historyFile(), JSON.stringify(downloadsHistory.slice(-500), null, 2));
	} catch (error) {
		await ErrorHandler.handleError(error, 'saveHistory');
		// Try to save to a backup location
		try {
			const backupFile = path.join(os.tmpdir(), `downtube-history-backup-${Date.now()}.json`);
			fs.writeFileSync(backupFile, JSON.stringify(downloadsHistory.slice(-500), null, 2));
		} catch (backupError) {
			console.error('Failed to create backup history file:', backupError);
		}
	}
}

async function loadSettings() {
	try {
		const file = settingsFile();
		if (fs.existsSync(file)) {
			const data = fs.readFileSync(file, 'utf-8');
			appSettings = { ...appSettings, ...(JSON.parse(data || '{}')) };
		}
	} catch (error) {
		await ErrorHandler.handleError(error, 'loadSettings');
		// Keep default settings if corrupted
		console.log('Using default settings due to corruption');
	}
}

function saveSettings() {
	try {
		fs.mkdirSync(app.getPath('userData'), { recursive: true });
		fs.writeFileSync(settingsFile(), JSON.stringify(appSettings, null, 2));
	} catch {}
}

function getDefaultOutputDir() {
	const outDir = path.join(os.homedir(), 'Downloads', 'DownTube');
	try {
		fs.mkdirSync(outDir, { recursive: true });
	} catch (err) {
		// no-op; handled on write
	}
	return outDir;
}

function getAppIconPath() {
    try {
        const ico = path.join(__dirname, 'assets', 'icon.ico');
        if (fs.existsSync(ico)) return ico;
        const png = path.join(__dirname, 'assets', 'icon.png');
        if (fs.existsSync(png)) return png;
    } catch {}
    return undefined;
}

function createMainWindow(show = false) {
    mainWindow = new BrowserWindow({
        width: 980,
        height: 640,
        minWidth: 980,
        minHeight: 640,
        backgroundColor: '#00000000',
		title: 'DownTube - YouTube Downloader',
		frame: false,
		// Optional on macOS; ignored on Windows
		titleBarStyle: 'hidden',
        transparent: true,
		icon: getAppIconPath(),
		webPreferences: {
			contextIsolation: true,
			preload: path.join(__dirname, 'preload.js'),
			sandbox: false,
			nodeIntegration: false,
		},
		show
	});

    mainWindow.removeMenu();
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'home.html'));

	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		shell.openExternal(url);
		return { action: 'deny' };
	});
}

// Check internet connectivity
async function checkInternetConnection() {
	return new Promise((resolve) => {
		const https = require('https');
		const options = {
			hostname: 'www.google.com',
			port: 443,
			path: '/',
			method: 'HEAD',
			timeout: 5000
		};
		
		const req = https.request(options, (res) => {
			resolve(true);
		});
		
		req.on('error', () => {
			resolve(false);
		});
		
		req.on('timeout', () => {
			req.destroy();
			resolve(false);
		});
		
		req.end();
	});
}

function createSplash() {
	splashWindow = new BrowserWindow({
		width: 550,
		height: 500,
		frame: false,
		transparent: true,
		resizable: false,
		alwaysOnTop: true,
		backgroundColor: '#00000000',
		webPreferences: { 
			contextIsolation: false,
			nodeIntegration: true
		}
	});
	splashWindow.loadFile(path.join(__dirname, 'renderer', 'splash.html'));
	
	// Send font setting to splash screen once it's loaded
	splashWindow.webContents.once('did-finish-load', () => {
		if (appSettings && appSettings.font) {
			splashWindow.webContents.send('apply-font', appSettings.font);
		}
	});
}

// Function to initialize dependencies
async function initializeDependencies() {
	let depStatus = { allAvailable: true };
	try {
		console.log('[Startup] Checking dependencies...');
		
		// Send status to splash screen
		if (splashWindow && !splashWindow.isDestroyed()) {
			splashWindow.webContents.send('splash-status', 'Checking dependencies...');
		}
		
		depStatus = dependencyManager.checkDependencies();
		
		if (!depStatus.allAvailable) {
			console.log('[Startup] Some dependencies are missing, checking internet...');
			
			// Check internet connection before downloading
			const hasInternet = await checkInternetConnection();
			
			if (!hasInternet) {
				console.log('[Startup] No internet connection detected');
				if (splashWindow && !splashWindow.isDestroyed()) {
					splashWindow.webContents.send('no-internet');
				}
				return depStatus;
			}
			
			console.log('[Startup] Internet connected, downloading dependencies...');
			
			// Show progress via splash or main window
			const progressCallback = (progress) => {
				broadcast('dependency-download-progress', progress);
			};
			
			await dependencyManager.downloadMissingDependencies(progressCallback);
			console.log('[Startup] All dependencies downloaded successfully');
			broadcast('dependency-download-complete', { success: true });
			
			// Give time for the user to see the completion message
			await new Promise(resolve => setTimeout(resolve, 1000));
		} else {
			console.log('[Startup] All dependencies are available');
			
			// Send status to splash screen
			if (splashWindow && !splashWindow.isDestroyed()) {
				splashWindow.webContents.send('splash-status', 'Loading application...');
			}
		}
		
		// Test executable finding
		const ytdlpPath = findExecutable(process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
		const ffmpegPath = findExecutable(process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
		console.log('[Startup] yt-dlp path:', ytdlpPath);
		console.log('[Startup] ffmpeg path:', ffmpegPath);
		
		if (!ytdlpPath || !ffmpegPath) {
			console.error('[Startup] ERROR: Failed to locate required dependencies!');
			// Don't show error dialog if we already showed no internet modal
			if (depStatus.allAvailable) {
				dialog.showErrorBox(
					'Missing Dependencies',
					'Failed to download required dependencies (yt-dlp and ffmpeg). Please check your internet connection and try again.'
				);
			}
		}
	} catch (error) {
		console.error('[Startup] Error setting up dependencies:', error);
		dialog.showErrorBox(
			'Dependency Error',
			`Failed to setup required dependencies: ${error.message}\n\nPlease check your internet connection and try again.`
		);
	}
	
	return depStatus;
}

app.whenReady().then(async () => {
	await loadHistory();
	await loadSettings();
	
	// Initialize dependency manager
	dependencyManager = new DependencyManager();
	
	// Debug: Log executable locations at startup
	console.log('[Startup] Current working directory:', process.cwd());
	console.log('[Startup] App resources path:', process.resourcesPath);
	console.log('[Startup] App path:', app.getAppPath());
	
	createSplash();
	createMainWindow(false);
	
	// Initialize dependencies
	const depStatus = await initializeDependencies();
	
	// Check for updates after a delay to not interfere with startup
	setTimeout(async () => {
		try {
			// Check for updates in the background
			const updateInfo = await UpdateChecker.checkForUpdates();
			if (updateInfo && await UpdateChecker.shouldShowUpdate(updateInfo)) {
				// Wait a bit more for the main window to be fully ready
				setTimeout(async () => {
					await UpdateChecker.showUpdateDialog(updateInfo);
				}, 3000);
			}
		} catch (error) {
			console.error('Error during update check:', error);
		}
	}, 5000);

	// Close splash and show main window
	// Use longer delay to show completion message if dependencies were downloaded
	const splashDelay = !depStatus.allAvailable ? 2500 : 1800;
	setTimeout(() => {
		try { splashWindow?.close(); } catch {}
		mainWindow?.show();
	}, splashDelay);

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createSplash();
			createMainWindow(false);
			setTimeout(() => { try { splashWindow?.close(); } catch {}; mainWindow?.show(); }, 2200);
		}
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('get-default-output-dir', async () => {
	return getDefaultOutputDir();
});
ipcMain.handle('get-active-downloads', async () => {
	return Array.from(activeDownloads.values());
});

ipcMain.handle('get-history', async () => {
	return downloadsHistory;
});

ipcMain.handle('clear-history', async () => {
	downloadsHistory = [];
	saveHistory();
	return { ok: true };
});

ipcMain.handle('show-item-in-folder', async (event, filePath) => {
	try {
		const { shell } = require('electron');
		shell.showItemInFolder(filePath);
		return { ok: true };
	} catch (error) {
		console.error('Error showing item in folder:', error);
		return { ok: false, error: error.message };
	}
});

ipcMain.handle('open-path', async (event, folderPath) => {
	try {
		await shell.openPath(folderPath);
		return { ok: true };
	} catch (error) {
		console.error('Error opening path:', error);
		return { ok: false, error: error.message };
	}
});

ipcMain.handle('get-settings', async () => {
	return appSettings;
});

ipcMain.handle('save-settings', async (_event, next) => {
	appSettings = { ...appSettings, ...(next || {}) };
	saveSettings();
	return appSettings;
});

ipcMain.handle('get-app-info', async () => {
	let author = '';
	let description = '';
	try {
		const pkg = JSON.parse(fs.readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf-8'));
		author = typeof pkg.author === 'string' ? pkg.author : (pkg.author?.name || '');
		description = pkg.description || '';
	} catch {}
	return {
		name: app.getName(),
		version: app.getVersion(),
		author,
		description
	};
});

// Manual update check
ipcMain.handle('check-for-updates', async () => {
	try {
		const updateInfo = await UpdateChecker.checkForUpdates();
		if (updateInfo) {
			return { ok: true, hasUpdate: true, updateInfo };
		}
		return { ok: true, hasUpdate: false };
	} catch (error) {
		await ErrorHandler.handleError(error, 'check-for-updates');
		return { ok: false, message: ErrorHandler.getErrorMessage(error) };
	}
});

// Show update dialog manually
ipcMain.handle('show-update-dialog', async (_event, updateInfo) => {
	try {
		await UpdateChecker.showUpdateDialog(updateInfo);
		return { ok: true };
	} catch (error) {
		await ErrorHandler.handleError(error, 'show-update-dialog');
		return { ok: false, message: ErrorHandler.getErrorMessage(error) };
	}
});

// Get update preferences
ipcMain.handle('get-update-preferences', async () => {
	try {
		const file = UpdateChecker.lastCheckFile();
		if (!fs.existsSync(file)) {
			return { ok: true, preferences: {} };
		}
		
		const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
		return { 
			ok: true, 
			preferences: {
				lastCheck: data.lastCheck || 0,
				skippedVersions: data.skippedVersions || [],
				dontShowAgain: data.dontShowAgain || []
			}
		};
	} catch (error) {
		await ErrorHandler.handleError(error, 'get-update-preferences');
		return { ok: false, message: ErrorHandler.getErrorMessage(error) };
	}
});

ipcMain.handle('choose-output-dir', async () => {
	const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
		properties: ['openDirectory', 'createDirectory']
	});
	if (canceled || !filePaths?.length) return null;
	return filePaths[0];
});

// Dependency management handlers
ipcMain.handle('check-dependencies', async () => {
	try {
		if (!dependencyManager) {
			return { ok: false, message: 'Dependency manager not initialized' };
		}
		const status = dependencyManager.checkDependencies();
		return { ok: true, ...status };
	} catch (error) {
		await ErrorHandler.handleError(error, 'check-dependencies');
		return { ok: false, message: ErrorHandler.getErrorMessage(error) };
	}
});

ipcMain.handle('download-dependencies', async () => {
	try {
		if (!dependencyManager) {
			return { ok: false, message: 'Dependency manager not initialized' };
		}
		
		const progressCallback = (progress) => {
			broadcast('dependency-download-progress', progress);
		};
		
		const result = await dependencyManager.downloadMissingDependencies(progressCallback);
		broadcast('dependency-download-complete', { success: true });
		return { ok: true, ...result };
	} catch (error) {
		await ErrorHandler.handleError(error, 'download-dependencies');
		broadcast('dependency-download-complete', { success: false, error: error.message });
		return { ok: false, message: ErrorHandler.getErrorMessage(error) };
	}
});

ipcMain.handle('get-dependency-paths', async () => {
	try {
		if (!dependencyManager) {
			return { ok: false, message: 'Dependency manager not initialized' };
		}
		return { 
			ok: true, 
			ytdlpPath: dependencyManager.getYtDlpPath(),
			ffmpegPath: dependencyManager.getFfmpegPath()
		};
	} catch (error) {
		await ErrorHandler.handleError(error, 'get-dependency-paths');
		return { ok: false, message: ErrorHandler.getErrorMessage(error) };
	}
});

// Handle retry connection from splash screen
ipcMain.on('retry-connection', async () => {
	console.log('[Startup] Retrying connection...');
	
	// Re-initialize dependencies
	const depStatus = await initializeDependencies();
	
	// If still no internet, the modal will show again
	// If successful, continue with normal startup
	if (depStatus.allAvailable || (depStatus.ytdlp && depStatus.ffmpeg)) {
		// Close splash and show main window
		setTimeout(() => {
			try { splashWindow?.close(); } catch {}
			mainWindow?.show();
		}, 2000);
	}
});

ipcMain.handle('window-close', async (event) => {
    try {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) win.close();
        return { ok: true };
    } catch (e) {
        return { ok: false, message: e?.message || String(e) };
    }
});

ipcMain.handle('window-minimize', async (event) => {
    try {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) win.minimize();
        return { ok: true };
    } catch (e) {
        return { ok: false, message: e?.message || String(e) };
    }
});

ipcMain.handle('window-maximize-toggle', async (event) => {
    try {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return { ok: false };
        if (win.isMaximized()) win.unmaximize(); else win.maximize();
        return { ok: true };
    } catch (e) {
        return { ok: false, message: e?.message || String(e) };
    }
});

// Probe available formats for a URL using yt-dlp -F
ipcMain.handle('probe-formats', async (_event, url) => {
    try {
        // Validate URL
        await ErrorHandler.validateUrl(url);
        
        // Note: Removed strict internet check - let yt-dlp handle network errors naturally
        // This prevents false negatives and reduces latency

        return await RetryManager.withRetry(async () => {
            return await probeFormats(url);
        }, 2, 1000);
    } catch (error) {
        await ErrorHandler.handleError(error, 'probe-formats');
        return { 
            ok: false, 
            message: ErrorHandler.getErrorMessage(error),
            errorType: error.type || ErrorHandler.errorTypes.UNKNOWN
        };
    }
});

// Fetch info: single vs playlist and count using yt-dlp -J
ipcMain.handle('fetch-info', async (_event, url) => {
    try {
        // Validate URL
        await ErrorHandler.validateUrl(url);
        
        // Note: Removed strict internet check - let yt-dlp handle network errors naturally
        // This prevents false negatives and reduces latency

        return await RetryManager.withRetry(async () => {
            const ytdlpPath = findExecutable(process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
            
            // Check if yt-dlp exists
            if (!fs.existsSync(ytdlpPath)) {
                throw ErrorHandler.createError(
                    ErrorHandler.errorTypes.PROCESS,
                    'yt-dlp not found. Please ensure the application is properly installed.',
                    { ytdlpPath },
                    false
                );
            }

            const proc = spawn(ytdlpPath, ['-J', '--flat-playlist', url], { stdio: ['ignore', 'pipe', 'pipe'] });
            let out = '';
            let err = '';
            
            return await new Promise((resolve, reject) => {
                // Activity-based timeout: resets when data is received
                let activityTimeout;
                const resetActivityTimeout = () => {
                    if (activityTimeout) clearTimeout(activityTimeout);
                    activityTimeout = setTimeout(() => {
                        console.error('[fetch-info] No data received for 60 seconds, aborting');
                        try { proc.kill(); } catch {}
                        reject(new Error('Request timeout - the URL may be invalid or unavailable'));
                    }, 60000); // 60 second activity timeout
                };
                
                resetActivityTimeout(); // Start timeout

                proc.stdout.on('data', d => { 
                    out += d.toString();
                    resetActivityTimeout(); // Reset on data
                });
                proc.stderr.on('data', d => { 
                    err += d.toString();
                    resetActivityTimeout(); // Reset on data
                });
                
                proc.on('close', (code) => {
                    if (activityTimeout) clearTimeout(activityTimeout);
                    if (code !== 0) {
                        console.error(`[fetch-info] yt-dlp failed with code ${code}: ${err || 'Unknown error'}`);
                        
                        // Parse stderr for better error messages
                        let errorMsg = 'Failed to fetch video information';
                        if (err) {
                            if (/video unavailable|not available/i.test(err)) {
                                errorMsg = 'Video is unavailable or does not exist.';
                            } else if (/private video/i.test(err)) {
                                errorMsg = 'This is a private video.';
                            } else if (/invalid url|unsupported url/i.test(err)) {
                                errorMsg = 'Invalid or unsupported URL.';
                            } else if (/network|connection|timeout/i.test(err)) {
                                errorMsg = 'Network error. Please check your internet connection.';
                            } else if (/sign in/i.test(err)) {
                                errorMsg = 'This video requires signing in to YouTube.';
                            } else if (/age.restricted/i.test(err)) {
                                errorMsg = 'This video is age-restricted.';
                            } else {
                                // Use first line of error if meaningful
                                const firstErrorLine = err.split('\n').find(l => /error/i.test(l) && l.trim().length > 0);
                                if (firstErrorLine) {
                                    errorMsg = firstErrorLine.trim().substring(0, 150);
                                }
                            }
                        }
                        
                        reject(new Error(errorMsg));
                        return;
                    }
                    
                    try {
                        const json = JSON.parse(out || '{}');
                        if (Array.isArray(json.entries)) {
                            resolve({ ok: true, type: 'playlist', count: json.entries.length, title: json.title || '' });
                        } else {
                            // Single video fallback: ask yt-dlp for title
                            resolve({ ok: true, type: 'video', count: 1, title: json.title || '' });
                        }
                    } catch (parseError) {
                        reject(new Error('Failed to parse video information. The URL may be invalid or the video may be unavailable.'));
                    }
                });
                
                proc.on('error', (error) => {
                    if (activityTimeout) clearTimeout(activityTimeout);
                    reject(new Error(`yt-dlp failed to run: ${error.message}`));
                });
            });
        }, 2, 1000);
    } catch (error) {
        await ErrorHandler.handleError(error, 'fetch-info');
        return { 
            ok: false, 
            message: ErrorHandler.getErrorMessage(error),
            errorType: error.type || ErrorHandler.errorTypes.UNKNOWN
        };
    }
});

// Removed browse/set binary handlers; app uses executables from working directory or PATH

ipcMain.handle('start-download', async (event, args) => {
	try {
		const webContents = event.sender;
		const { url, format, outputDir, quality, abrKbps, playlistStart, playlistEnd } = args || {};
		
		// Validate URL
		await ErrorHandler.validateUrl(url);
		
		// Note: Removed strict internet check - let yt-dlp handle network errors naturally
		// This prevents false negatives and reduces latency

		// Validate and prepare output directory
		const outDir = outputDir || appSettings.defaultOutputDir || getDefaultOutputDir();
		await ErrorHandler.validateOutputDirectory(outDir);

		const hasRange = Number(playlistStart) > 0 && Number(playlistEnd) > 0 && Number(playlistEnd) >= Number(playlistStart);
		if (hasRange) {
			const start = Number(playlistStart);
			const end = Number(playlistEnd);
			const indices = [];
			for (let i = start; i <= end; i++) indices.push(i);
			let completed = 0;
			let failed = 0;
			const total = indices.length;
			
			// Use the user's max concurrent setting, default to 3 if not set
			const maxConcurrent = Math.min(Math.max(1, appSettings.maxConcurrent || 3), 5); // Clamp between 1-5
			const CONCURRENCY = Math.min(maxConcurrent, total);
			
			let cursor = 0;
			const launchNext = async () => {
				if (cursor >= total) return;
				const itemIndex = indices[cursor++];
				const childId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
				activeDownloads.set(childId, { id: childId, url, format, percent: 0, startedAt: Date.now() });
			downloadWithYtDlp({ id: childId, url, format, outDir, webContents, quality, abrKbps, playlistStart: itemIndex, playlistEnd: itemIndex })
				.then(() => { completed++; })
				.catch(() => { failed++; })
				.finally(async () => {
					if (cursor < total) await launchNext();
					if (completed + failed === total) {
						// Send data to renderer for professional dialog
						broadcast('download-complete', { 
							ok: true, 
							totalItems: total, 
							completed, 
							outDir 
						});
					}
				});
		};
			const starters = [];
			for (let k = 0; k < CONCURRENCY; k++) starters.push(launchNext());
			await Promise.all(starters);
			return { ok: true, concurrent: true, total, concurrency: CONCURRENCY };
		}

		const downloadId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		activeDownloads.set(downloadId, { id: downloadId, url, format, percent: 0, startedAt: Date.now() });
		
		try {
			const stats = await downloadWithYtDlp({ id: downloadId, url, format, outDir, webContents, quality, abrKbps, playlistStart, playlistEnd });
			if (stats && stats.cancelled) {
				return { ok: true, cancelled: true };
			}
		// Send data to renderer for professional dialog
		broadcast('download-complete', { 
			ok: true, 
			...stats,
			totalItems: stats.completed || 1,
			outDir 
		});
			return { ok: true, ...stats };
		} catch (err) {
			broadcast('download-error', { message: err?.message || String(err) });
			throw err;
		}
	} catch (error) {
		await ErrorHandler.handleError(error, 'start-download');
		broadcast('download-error', { 
			message: ErrorHandler.getErrorMessage(error),
			errorType: error.type || ErrorHandler.errorTypes.UNKNOWN
		});
		throw error;
	}
});

// Cancel a running download
ipcMain.handle('cancel-download', async (_event, id) => {
    try {
        const child = downloadProcesses.get(id);
        if (child) {
            terminationReasons.set(id, 'cancelled');
            try {
                if (process.platform === 'win32') {
                    // Force-kill the process tree on Windows
                    const { spawn } = require('child_process');
                    try { spawn('taskkill', ['/pid', String(child.pid), '/T', '/F']); } catch {}
                } else {
                    try { child.kill('SIGKILL'); } catch {}
                }
            } catch {}
        }
        const obj = activeDownloads.get(id);
        // Best-effort cleanup of incomplete file(s)
        try {
            if (obj?.path) {
                cleanupPartialFiles(obj.path);
            }
        } catch {}
        if (activeDownloads.has(id)) activeDownloads.delete(id);
        // Some yt-dlp runs may produce .part or partial files with unknown names until 'Destination' is seen.
        // Attempt a broader cleanup within output directory based on available title/path.
        try {
            const dir = obj?.path ? path.dirname(obj.path) : null;
            const base = obj?.title || null;
            if (dir && base) {
                const files = fs.readdirSync(dir);
                const pattern = new RegExp(`^${base}\.`, 'i');
                for (const f of files) {
                    if (pattern.test(f) && /\.part$|\.temp\.|\.f\d+\.mp4$/i.test(f)) {
                        try { fs.unlinkSync(path.join(dir, f)); } catch {}
                    }
                }
            }
        } catch {}
        broadcast('download-cancelled', { id });
        return { ok: true };
    } catch (e) {
        return { ok: false, message: e?.message || String(e) };
    }
});

function broadcast(channel, payload) {
	try {
		for (const win of BrowserWindow.getAllWindows()) {
			win.webContents.send(channel, payload);
		}
	} catch {}
}

function notifyProgress(_webContents, payload) {
	broadcast('download-progress', payload);
}

async function downloadWithYtDlp({ id, url, format, outDir, webContents, quality, abrKbps, playlistStart, playlistEnd }) {
	return new Promise((resolve, reject) => {
		const isMp3 = String(format || 'mp4').toLowerCase() === 'mp3';
		const outputPattern = path.join(outDir, '%(title)s.%(ext)s').replace(/\\/g, '/');
		const ytdlpPath = findExecutable(process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
		const ffmpegLoc = findExecutable(process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');

		const baseArgs = ['--newline', '--ignore-errors', '--no-abort-on-unavailable-fragment', '--windows-filenames', '--no-part', '--no-keep-fragments', '-o', outputPattern, '--ffmpeg-location', ffmpegLoc];
		// Build MP4 format selector honoring a desired height if provided
		let videoSelector = 'bv*[ext=mp4]';
		if (quality && /^(144|240|360|480|720|1080|1440|2160)p?$/i.test(String(quality))) {
			const h = String(quality).replace(/[^0-9]/g, '');
			videoSelector = `bv*[ext=mp4][height<=${h}][height>=${h}]`;
		}
		const rangeArgs = [];
		if (playlistStart && Number(playlistStart) > 0) rangeArgs.push('--playlist-start', String(playlistStart));
		if (playlistEnd && Number(playlistEnd) > 0) rangeArgs.push('--playlist-end', String(playlistEnd));
		const mp4Args = [...baseArgs, ...rangeArgs, '-f', `${videoSelector}+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b`, '--merge-output-format', 'mp4', url];
		// Build MP3 extraction honoring requested audio bitrate
		const targetAbr = abrKbps && /^\d+$/.test(String(abrKbps)) ? `${abrKbps}K` : '192K';
		const mp3Args = [...baseArgs, ...rangeArgs, '-x', '--audio-format', 'mp3', '--audio-quality', targetAbr, url];

		let currentIndex = 0;
		let totalItems = 0;
		let currentDest = null;
		const completedDests = new Set();
		let inPostProcess = false;
		let lastSize = null;
		let startedAt = Date.now();

		const parseAndEmit = (data) => {
			const text = data?.toString?.() || '';
			text.split(/\r?\n/).forEach(line => {
				if (!line.trim()) return;
				const itemMatch = line.match(/Downloading item (\d+) of (\d+)/i);
				if (itemMatch) {
					currentIndex = parseInt(itemMatch[1], 10) - 1;
					totalItems = parseInt(itemMatch[2], 10);
				}
				const destMatch = line.match(/Destination:\s(.+)/i);
				if (destMatch) {
					currentDest = destMatch[1].trim();
					const parsed = path.parse(currentDest);
					const title = parsed?.name || 'download';
					const obj = activeDownloads.get(id);
					if (obj) { obj.title = title; obj.path = currentDest; activeDownloads.set(id, obj); }
				}
				if (/\[(ExtractAudio|ffmpeg)\]/i.test(line)) {
					inPostProcess = true;
					notifyProgress(webContents, {
						type: 'postprocess', id,
						itemIndex: totalItems ? currentIndex : undefined,
						totalItems: totalItems || undefined,
						indeterminate: true,
						title: undefined
					});
					// Update active map so UI polling reflects converting stage
					const obj = activeDownloads.get(id) || {};
					activeDownloads.set(id, { ...obj, id, url, format, title: obj.title, path: obj.path, startedAt, indeterminate: true });
				}
				// Parse lines like: [download]   5.6% of 12.34MiB at 1.23MiB/s ETA 00:12
				const progressMatch = line.match(/\[download\]\s+(\d+\.?\d*)%\s+of\s+([\d\.]+\w+i?B)\s+at\s+([\d\.]+\w+i?B\/s)\s+ETA\s+([\d:]+)/i);
                // Fallback for variants like Unknown size/Unknown speed
                const progressMatchLoose = !progressMatch ? line.match(/\[download\]\s+(\d+\.?\d*)%\s+of\s+(.+?)\s+at\s+(.+?)\s+ETA\s+([\d:]+)/i) : null;
                if (progressMatch || progressMatchLoose) {
                    const m = progressMatch || progressMatchLoose;
                    const percent = parseFloat(m[1]);
                    const size = String(m[2] || '').trim();
                    const speed = String(m[3] || '').trim();
                    const eta = String(m[4] || '').trim();
					notifyProgress(webContents, {
						type: isMp3 ? 'audio' : 'video', id,
						itemIndex: totalItems ? currentIndex : undefined,
						totalItems: totalItems || undefined,
						percent,
						size,
						speed,
						eta,
						title: undefined
					});
					lastSize = size;
					const obj = activeDownloads.get(id) || {};
					activeDownloads.set(id, { ...obj, id, url, format, percent, size, speed, eta, title: obj.title, path: obj.path, startedAt, indeterminate: false });
					if (!isMp3 && percent >= 100 && currentDest && !completedDests.has(currentDest)) {
						completedDests.add(currentDest);
						const parsed = path.parse(currentDest);
						const title = parsed?.name || 'download';
						broadcast('download-item-complete', { itemIndex: currentIndex, totalItems: totalItems || undefined, path: currentDest, title });
					}
					return; // avoid double handling by the simpler percent regex
				}
				const percentMatch = line.match(/\[download\]\s+(\d+\.?\d*)%/i);
				if (percentMatch) {
					const percent = parseFloat(percentMatch[1]);
					notifyProgress(webContents, {
						type: isMp3 ? 'audio' : 'video', id,
						itemIndex: totalItems ? currentIndex : undefined,
						totalItems: totalItems || undefined,
						percent,
						title: undefined
					});
					// Make sure the map reflects latest percentage for UI polling
					const obj = activeDownloads.get(id) || {};
					activeDownloads.set(id, { ...obj, id, url, format, percent, title: obj.title, path: obj.path, startedAt, size: obj.size, speed: obj.speed, eta: obj.eta, indeterminate: false });
					if (!isMp3 && percent >= 100 && currentDest && !completedDests.has(currentDest)) {
						completedDests.add(currentDest);
						const parsed = path.parse(currentDest);
						const title = parsed?.name || 'download';
						broadcast('download-item-complete', { itemIndex: currentIndex, totalItems: totalItems || undefined, path: currentDest, title });
					}
				}
				if (/Deleting original file|has already been downloaded/i.test(line) && currentDest && !completedDests.has(currentDest)) {
					completedDests.add(currentDest);
					const parsed = path.parse(currentDest);
					const title = parsed?.name || 'download';
					webContents.send('download-item-complete', { itemIndex: currentIndex, totalItems: totalItems || undefined, path: currentDest, title });
				}
			});
		};

	let stderrOutput = '';
	const child = spawn(ytdlpPath, isMp3 ? mp3Args : mp4Args, { stdio: ['ignore', 'pipe', 'pipe'] });
	downloadProcesses.set(id, child);
	child.stdout.on('data', parseAndEmit);
	child.stderr.on('data', (data) => {
		const text = data?.toString?.() || '';
		stderrOutput += text;
		parseAndEmit(data);
	});
	child.on('error', (err) => {
		reject(new Error(`Failed to start yt-dlp: ${err.message}`));
	});
        child.on('close', (code) => {
		downloadProcesses.delete(id);
		const obj = activeDownloads.get(id);
		if (obj) activeDownloads.delete(id);
            const reason = terminationReasons.get(id);
            if (reason === 'cancelled') {
                terminationReasons.delete(id);
                // Ensure any known partials are removed
                try { if (obj?.path) cleanupPartialFiles(obj.path); } catch {}
                return resolve({ cancelled: true });
            }
            if (code === 0) {
			// Save history entries for each destination completed (or single)
			const entries = completedDests.size ? Array.from(completedDests) : (obj?.path ? [obj.path] : []);
			const when = Date.now();
			for (const dest of entries) {
				const parsed = path.parse(dest);
				downloadsHistory.push({
					title: parsed?.name || obj?.title || 'download',
					path: dest,
					format,
					size: lastSize,
					completedAt: when
				});
				// Cleanup residual intermediate files on Windows if any (e.g., .f234.mp4, .temp.mp4)
				try {
					cleanupResidualFiles(parsed.name, path.dirname(dest));
				} catch {}
			}
			saveHistory();
			resolve({ totalItems: totalItems || (completedDests.size || 1), completed: completedDests.size || 1 });
            } else {
                // Parse stderr for better error messages
                let errorMsg = 'Download failed';
                if (stderrOutput) {
                    if (/unable to download/i.test(stderrOutput)) {
                        errorMsg = 'Unable to download video. It may be unavailable or restricted.';
                    } else if (/private video/i.test(stderrOutput)) {
                        errorMsg = 'This is a private video and cannot be downloaded.';
                    } else if (/video unavailable/i.test(stderrOutput)) {
                        errorMsg = 'Video is unavailable.';
                    } else if (/copyright/i.test(stderrOutput)) {
                        errorMsg = 'Video cannot be downloaded due to copyright restrictions.';
                    } else if (/network|connection|timeout/i.test(stderrOutput)) {
                        errorMsg = 'Network error. Please check your internet connection.';
                    } else if (/sign in/i.test(stderrOutput)) {
                        errorMsg = 'This video requires signing in to YouTube.';
                    } else if (/age.restricted/i.test(stderrOutput)) {
                        errorMsg = 'This video is age-restricted and cannot be downloaded.';
                    } else {
                        // Extract first meaningful error line
                        const errorLines = stderrOutput.split('\n').filter(l => /error/i.test(l) && l.trim().length > 0);
                        if (errorLines.length > 0) {
                            errorMsg = errorLines[0].trim().substring(0, 200);
                        } else {
                            errorMsg = `yt-dlp exited with code ${code}`;
                        }
                    }
                }
                reject(new Error(errorMsg));
            }
	});
});
}

function cleanupResidualFiles(baseName, dirPath) {
	if (!baseName || !dirPath) return;
	const files = fs.readdirSync(dirPath);
	const pattern = new RegExp(`^${baseName}\.f\\d+\\.mp4$|^${baseName}\\.temp\\..+`, 'i');
	for (const f of files) {
		if (pattern.test(f)) {
			try { fs.unlinkSync(path.join(dirPath, f)); } catch {}
		}
	}
}

// Remove partial/incomplete files for a cancelled download
function cleanupPartialFiles(destPath) {
    try {
        if (!destPath) return;
        const parsed = path.parse(destPath);
        // Delete final file if it exists (may be incomplete when using --no-part)
        if (fs.existsSync(destPath)) {
            try { fs.unlinkSync(destPath); } catch {}
        }
        // Delete potential .part file if created (in case flags change)
        const part = `${destPath}.part`;
        if (fs.existsSync(part)) {
            try { fs.unlinkSync(part); } catch {}
        }
        // Delete residual muxing/temp tracks
        cleanupResidualFiles(parsed.name, parsed.dir);
    } catch {}
}

// Parse `yt-dlp -F` to available human-friendly selections
async function probeFormats(url) {
    return new Promise((resolve) => {
        try {
            const ytdlpPath = findExecutable(process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
            const proc = spawn(ytdlpPath, ['-F', url], { stdio: ['ignore', 'pipe', 'pipe'] });
            let out = '';
            let err = '';
            proc.stdout.on('data', d => { out += d.toString(); });
            proc.stderr.on('data', d => { err += d.toString(); });
            proc.on('close', () => {
                const lines = out.split(/\r?\n/);
                const videoFormats = [];
                const audioFormats = [];
                for (const line of lines) {
                    // Example row:  137          mp4        1920x1080  1080p  ...
                    const mVideo = line.match(/^(\s*\d+)\s+\S+\s+mp4\s+(\d+)x(\d+)/i);
                    if (mVideo) {
                        const itag = mVideo[1].trim();
                        const height = parseInt(mVideo[3], 10);
                        videoFormats.push({ itag, height });
                        continue;
                    }
                    // Audio-only rows often contain "audio only" and a bitrate like 128k anywhere later
                    const audioOnly = /audio only/i.test(line);
                    if (audioOnly) {
                        const idMatch = line.match(/^(\s*\d+)/);
                        const kbMatch = line.match(/(\d+)\s*k(?!i)/i);
                        if (idMatch && kbMatch) {
                            const itag = idMatch[1].trim();
                            const kbps = parseInt(kbMatch[1], 10);
                            if (!Number.isNaN(kbps)) audioFormats.push({ itag, kbps });
                        }
                        continue;
                    }
                }
                // Deduplicate by height/kbps, prefer higher itag numbers arbitrarily
                const heights = Array.from(new Set(videoFormats.map(v => v.height))).sort((a,b)=>a-b);
                const kbpsList = Array.from(new Set(audioFormats.map(a => a.kbps))).sort((a,b)=>a-b);
                resolve({ ok: true, videoHeights: heights, audioKbps: kbpsList });
            });
            proc.on('error', () => resolve({ ok: false, message: 'yt-dlp not found or failed' }));
        } catch (e) {
            resolve({ ok: false, message: e?.message || String(e) });
        }
    });
}

// Helper function to find executables - ONLY local, never system PATH
function findExecutable(execName) {
    if (!dependencyManager) {
        console.error('[findExecutable] DependencyManager not initialized!');
        return null;
    }

    // Get path from dependency manager
    if (execName.includes('yt-dlp')) {
        const ytdlpPath = dependencyManager.getYtDlpPath();
        if (ytdlpPath) {
            console.log(`[findExecutable] Found yt-dlp at: ${ytdlpPath}`);
            return ytdlpPath;
        }
        console.error('[findExecutable] yt-dlp not found in local directory');
        return null;
    }
    
    if (execName.includes('ffmpeg')) {
        const ffmpegPath = dependencyManager.getFfmpegPath();
        if (ffmpegPath) {
            console.log(`[findExecutable] Found ffmpeg at: ${ffmpegPath}`);
            return ffmpegPath;
        }
        console.error('[findExecutable] ffmpeg not found in local directory');
        return null;
    }

    console.error(`[findExecutable] Unknown executable: ${execName}`);
    return null;
}


