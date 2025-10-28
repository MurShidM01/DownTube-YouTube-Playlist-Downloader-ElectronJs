const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('downTube', {
	getDefaultOutputDir: () => ipcRenderer.invoke('get-default-output-dir'),
	chooseOutputDir: () => ipcRenderer.invoke('choose-output-dir'),
	startDownload: (args) => ipcRenderer.invoke('start-download', args),
	probeFormats: (url) => ipcRenderer.invoke('probe-formats', url),
	fetchInfo: (url) => ipcRenderer.invoke('fetch-info', url),
	cancel: (id) => ipcRenderer.invoke('cancel-download', id),
	getActiveDownloads: () => ipcRenderer.invoke('get-active-downloads'),
	getHistory: () => ipcRenderer.invoke('get-history'),
	clearHistory: () => ipcRenderer.invoke('clear-history'),
	showItemInFolder: (path) => ipcRenderer.invoke('show-item-in-folder', path),
	openPath: (path) => ipcRenderer.invoke('open-path', path),
	getSettings: () => ipcRenderer.invoke('get-settings'),
	saveSettings: (s) => ipcRenderer.invoke('save-settings', s),
	getAppInfo: () => ipcRenderer.invoke('get-app-info'),
	windowClose: () => ipcRenderer.invoke('window-close'),
	windowMinimize: () => ipcRenderer.invoke('window-minimize'),
	windowMaximizeToggle: () => ipcRenderer.invoke('window-maximize-toggle'),
	// Update-related functions
	checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
	showUpdateDialog: (updateInfo) => ipcRenderer.invoke('show-update-dialog', updateInfo),
	getUpdatePreferences: () => ipcRenderer.invoke('get-update-preferences'),
	// Dependency management functions
	checkDependencies: () => ipcRenderer.invoke('check-dependencies'),
	downloadDependencies: () => ipcRenderer.invoke('download-dependencies'),
	getDependencyPaths: () => ipcRenderer.invoke('get-dependency-paths'),
	onDependencyProgress: (listener) => {
		ipcRenderer.removeAllListeners('dependency-download-progress');
		ipcRenderer.on('dependency-download-progress', (_e, payload) => listener(payload));
	},
	onDependencyComplete: (listener) => {
		ipcRenderer.removeAllListeners('dependency-download-complete');
		ipcRenderer.on('dependency-download-complete', (_e, payload) => listener(payload));
	},
	onProgress: (listener) => {
		ipcRenderer.removeAllListeners('download-progress');
		ipcRenderer.on('download-progress', (_e, payload) => listener(payload));
	},
	onItemComplete: (listener) => {
		ipcRenderer.removeAllListeners('download-item-complete');
		ipcRenderer.on('download-item-complete', (_e, payload) => listener(payload));
	},
	onDone: (listener) => {
		ipcRenderer.removeAllListeners('download-complete');
		ipcRenderer.on('download-complete', (_e, payload) => listener(payload));
	},
	onError: (listener) => {
		ipcRenderer.removeAllListeners('download-error');
		ipcRenderer.on('download-error', (_e, payload) => listener(payload));
	}
});


