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
        try {
            const { app } = require('electron');
            const fs = require('fs');
            const path = require('path');
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
                        rejectUnauthorized: false
                    };

                    const req = https.request(options, () => {
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

                tryEndpoint(endpoints[0]);
                setTimeout(() => { if (!resolved) tryEndpoint(endpoints[1]); }, 1000);
                setTimeout(() => { if (!resolved) tryEndpoint(endpoints[2]); }, 2000);
                setTimeout(() => { if (!resolved) { resolved = true; resolve(false); } }, 5000);
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
        const fs = require('fs');
        const path = require('path');
        try {
            if (!dir || typeof dir !== 'string') {
                throw this.createError(
                    this.errorTypes.VALIDATION,
                    'Invalid output directory',
                    { dir },
                    true
                );
            }

            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

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

module.exports = ErrorHandler;
