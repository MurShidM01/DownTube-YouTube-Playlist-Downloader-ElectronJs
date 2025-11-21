const themeEl = document.getElementById('theme');
const fontEl = document.getElementById('font');
const saveBtn = document.getElementById('save-settings');
const savedNote = document.getElementById('saved-note');
const aboutEl = document.getElementById('about');
const defaultDirEl = document.getElementById('default-dir');
const chooseDefaultBtn = document.getElementById('choose-default');
const maxConcurrentEl = document.getElementById('max-concurrent');

// Reusable dialog modal function for release notes
function showInfoDialog(title, message, buttonText = 'OK') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm';
        overlay.style.animation = 'fadeIn 0.2s ease';
        
        const dialog = document.createElement('div');
        dialog.className = 'bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-full mx-4 transform max-h-[80vh] overflow-auto';
        dialog.style.animation = 'slideUp 0.3s ease';
        
        // Convert newlines to <br> tags for proper formatting
        const formattedMessage = message.replace(/\n/g, '<br>');
        
        dialog.innerHTML = `
            <div class="flex items-start gap-4 mb-4">
                <div class="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                </div>
                <div class="flex-1">
                    <h3 class="text-lg font-bold text-slate-900 mb-1">${title}</h3>
                    <div class="text-sm text-slate-600 mt-2 space-y-2" style="white-space: pre-wrap;">${formattedMessage}</div>
                </div>
            </div>
            <div class="flex justify-end mt-6">
                <button id="dialog-ok" class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-200 transition-all transform hover:scale-105 active:scale-95">
                    ${buttonText}
                </button>
            </div>
        `;
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        `;
        document.head.appendChild(style);
        
        const okBtn = dialog.querySelector('#dialog-ok');
        
        const cleanup = () => {
            overlay.style.animation = 'fadeOut 0.2s ease';
            setTimeout(() => {
                overlay.remove();
                style.remove();
            }, 200);
        };
        
        okBtn.onclick = () => {
            cleanup();
            resolve();
        };
        
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                cleanup();
                resolve();
            }
        };
    });
}

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

	document.getElementById('view-release-notes').addEventListener('click', async () => {
		// Show release notes in a beautiful dialog
		const notes = updateInfo.releaseNotes || 'No release notes available';
		await showInfoDialog(`Release Notes for v${updateInfo.latestVersion}`, notes, 'Close');
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


