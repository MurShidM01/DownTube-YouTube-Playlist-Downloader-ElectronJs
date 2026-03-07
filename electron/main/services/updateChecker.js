const { app, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');
const { getMainWindow } = require('../state');
const ErrorHandler = require('./errorHandler');

class UpdateChecker {
    static GITHUB_API_URL = 'https://api.github.com/repos/MurShidM01/DownTube-YouTube-Playlist-Downloader-ElectronJs/releases/latest';
    static GITHUB_RELEASE_URL = 'https://github.com/MurShidM01/DownTube-YouTube-Playlist-Downloader-ElectronJs/releases/latest';
    static CHECK_INTERVAL = 24 * 60 * 60 * 1000;
    static lastCheckFile = () => path.join(app.getPath('userData'), 'last-update-check.json');

    static async checkForUpdates() {
        try {
            if (!await this.shouldCheckForUpdates()) {
                return null;
            }

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
            console.error('UpdateChecker.checkForUpdates error:', error);
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
                timeout: 10000
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

            return false;
        } catch (error) {
            console.error('Error comparing versions:', error);
            return false;
        }
    }

    static async showUpdateDialog(updateInfo) {
        const mainWindow = getMainWindow();
        if (!mainWindow) {
            return;
        }

        try {
            const result = await dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'New Version Available!',
                message: 'A new version of DownTube is available!',
                detail: `Current Version: ${updateInfo.currentVersion}\nLatest Version: ${updateInfo.latestVersion}\n\n${updateInfo.releaseNotes}`,
                buttons: ['Download Update', 'Remind Me Later', 'Skip This Version'],
                defaultId: 0,
                cancelId: 1,
                checkboxLabel: 'Don\'t show this again for this version',
                checkboxChecked: false
            });

            if (result.response === 0) {
                await shell.openExternal(updateInfo.downloadUrl).catch(() => {});
            } else if (result.response === 2) {
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

            if (data.dontShowAgain && data.dontShowAgain.includes(updateInfo.latestVersion)) {
                return false;
            }

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

module.exports = UpdateChecker;
