const themeEl = document.getElementById('theme');
const fontEl = document.getElementById('font');
const saveBtn = document.getElementById('save-settings');
const savedNote = document.getElementById('saved-note');
const aboutEl = document.getElementById('about');
const defaultDirEl = document.getElementById('default-dir');
const chooseDefaultBtn = document.getElementById('choose-default');
const maxConcurrentEl = document.getElementById('max-concurrent');

// Update-related elements
const currentVersionEl = document.getElementById('current-version');
const checkUpdatesBtn = document.getElementById('check-updates');
const updateStatusEl = document.getElementById('update-status');
const updateMessageEl = document.getElementById('update-message');
const updateActionsEl = document.getElementById('update-actions');
const lastCheckEl = document.getElementById('last-check');
const lastCheckTimeEl = document.getElementById('last-check-time');

async function applyTheme(theme) {
	await window.applySettings();
}

async function applyFont(font) {
	await window.applySettings();
}

async function load() {
	const settings = await window.downTube.getSettings();
	themeEl.value = settings.theme || 'light';
	fontEl.value = settings.font || 'Poppins';
	defaultDirEl.value = settings.defaultOutputDir || (await window.downTube.getDefaultOutputDir());
	maxConcurrentEl.value = settings.maxConcurrent || '3';
	await applyTheme(themeEl.value);
	await applyFont(fontEl.value);

	const info = await window.downTube.getAppInfo();
	aboutEl.innerHTML = `
		<div>Name: <strong>${info.name}</strong></div>
		<div>Version: <strong>${info.version}</strong></div>
		<div>Author: <strong>${info.author || '—'}</strong></div>
		<div class="text-slate-600">${info.description || ''}</div>
	`;

	// Load update information
	await loadUpdateInfo();
}

async function loadUpdateInfo() {
	try {
		const info = await window.downTube.getAppInfo();
		currentVersionEl.textContent = info.version;

		// Load last check time
		const preferences = await window.downTube.getUpdatePreferences();
		if (preferences.ok && preferences.preferences.lastCheck) {
			const lastCheck = new Date(preferences.preferences.lastCheck);
			lastCheckTimeEl.textContent = lastCheck.toLocaleString();
			lastCheckEl.classList.remove('hidden');
		}
	} catch (error) {
		console.error('Error loading update info:', error);
		currentVersionEl.textContent = 'Error loading version';
	}
}

async function checkForUpdates() {
	try {
		checkUpdatesBtn.disabled = true;
		checkUpdatesBtn.textContent = 'Checking...';
		updateStatusEl.classList.add('hidden');

		const result = await window.downTube.checkForUpdates();
		
		if (result.ok && result.hasUpdate) {
			showUpdateAvailable(result.updateInfo);
		} else if (result.ok) {
			showNoUpdateAvailable();
		} else {
			showUpdateError(result.message || 'Failed to check for updates');
		}

		// Refresh last check time
		await loadUpdateInfo();
	} catch (error) {
		console.error('Error checking for updates:', error);
		showUpdateError('An unexpected error occurred');
	} finally {
		checkUpdatesBtn.disabled = false;
		checkUpdatesBtn.textContent = 'Check for Updates';
	}
}

function showUpdateAvailable(updateInfo) {
	updateMessageEl.textContent = `A new version (${updateInfo.latestVersion}) is available!`;
	updateMessageEl.className = 'text-sm text-green-600 font-medium';
	
	updateActionsEl.innerHTML = `
		<button id="download-update" class="px-4 py-2 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700">
			Download Update
		</button>
		<button id="view-release-notes" class="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50">
			View Release Notes
		</button>
	`;

	// Wire up action buttons
	document.getElementById('download-update').addEventListener('click', () => {
		window.downTube.showUpdateDialog(updateInfo);
	});

	document.getElementById('view-release-notes').addEventListener('click', () => {
		// Show release notes in a simple dialog
		const notes = updateInfo.releaseNotes || 'No release notes available';
		alert(`Release Notes for v${updateInfo.latestVersion}:\n\n${notes}`);
	});

	updateStatusEl.classList.remove('hidden');
}

function showNoUpdateAvailable() {
	updateMessageEl.textContent = 'You are using the latest version!';
	updateMessageEl.className = 'text-sm text-slate-600';
	updateActionsEl.innerHTML = '';
	updateStatusEl.classList.remove('hidden');
}

function showUpdateError(message) {
	updateMessageEl.textContent = message;
	updateMessageEl.className = 'text-sm text-red-600';
	updateActionsEl.innerHTML = '';
	updateStatusEl.classList.remove('hidden');
}

saveBtn.addEventListener('click', async () => {
	const next = { 
		theme: themeEl.value, 
		font: fontEl.value, 
		defaultOutputDir: defaultDirEl.value,
		maxConcurrent: parseInt(maxConcurrentEl.value) || 3
	};
	await window.downTube.saveSettings(next);
	await applyTheme(next.theme);
	await applyFont(next.font);
	savedNote.classList.remove('hidden');
	setTimeout(() => savedNote.classList.add('hidden'), 1500);
});

chooseDefaultBtn.addEventListener('click', async () => {
	const dir = await window.downTube.chooseOutputDir();
	if (dir) defaultDirEl.value = dir;
});

// Wire up update check button
checkUpdatesBtn.addEventListener('click', checkForUpdates);

load();

// Close button on settings page
const closeBtn3 = document.getElementById('app-close');
if (closeBtn3) closeBtn3.addEventListener('click', () => { try { window.downTube.windowClose(); } catch {} });
const minBtn3 = document.getElementById('app-min');
if (minBtn3) minBtn3.addEventListener('click', () => { try { window.downTube.windowMinimize(); } catch {} });
const maxBtn3 = document.getElementById('app-max');
if (maxBtn3) maxBtn3.addEventListener('click', () => { try { window.downTube.windowMaximizeToggle(); } catch {} });


