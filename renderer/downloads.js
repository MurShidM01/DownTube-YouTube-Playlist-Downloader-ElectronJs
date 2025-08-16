async function refreshDownloads() {
	const list = document.getElementById('downloads-list');
	if (!list) return;
	const items = await window.downTube.getActiveDownloads();
	list.innerHTML = '';
    for (const d of items) {
		const li = document.createElement('li');
		li.className = 'mb-3';
		const pct = Math.max(0, Math.min(100, Math.round(d.percent || 0)));
		const title = String(d.title || d.url || '').replace(/[&<>]/g, s => ({'&': '&amp;','<': '&lt;','>': '&gt;'}[s]));
        li.innerHTML = `
			<div class="flex items-center justify-between text-sm">
                <span class="font-medium text-slate-800">${title}</span>
                <div class="flex items-center gap-2">
                    <button class="dt-cancel text-slate-600 hover:text-rose-600" title="Cancel" data-id="${d.id}">✖</button>
                    <span class="text-slate-600">${d.indeterminate ? '...' : pct + '%'}</span>
                </div>
			</div>
            <div class="h-2 bg-slate-100 rounded-full overflow-hidden mt-1">
                <div class="h-full download-bar" style="width:${d.indeterminate ? '100%' : pct + '%'}"></div>
			</div>
            <div class="text-xs text-slate-600 mt-1">${d.indeterminate ? 'Converting…' : `Size: ${d.size || '—'} • Speed: ${d.speed || '—'} • ETA: ${d.eta || '—'}`}</div>
		`;
		list.appendChild(li);
	}

    // wire cancel
    list.querySelectorAll('.dt-cancel').forEach(btn => {
        btn.onclick = async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            await window.downTube.cancel(id);
            await refreshDownloads();
        };
    });
}

async function refreshHistory() {
	const list = document.getElementById('history-list');
	if (!list) return;
	const items = await window.downTube.getHistory();
	list.innerHTML = '';
	for (const h of [...items].reverse().slice(0, 100)) {
		const li = document.createElement('li');
		const when = new Date(h.completedAt).toLocaleString();
		li.textContent = `${h.title} • ${h.format?.toUpperCase?.() || ''} • ${h.size || ''} • ${when}`;
		list.appendChild(li);
	}
}

async function init() {
	await refreshDownloads();
	await refreshHistory();
	await loadCurrentSettings();
	
	const clearBtn = document.getElementById('clear-history');
	if (clearBtn) clearBtn.onclick = async () => { await window.downTube.clearHistory(); await refreshHistory(); };

	// Single subscriptions; refresh efficiently
	window.downTube.onProgress(async () => { await refreshDownloads(); });
	window.downTube.onItemComplete(async () => { await refreshDownloads(); await refreshHistory(); });
	window.downTube.onDone(async () => { await refreshDownloads(); await refreshHistory(); });
	window.downTube.onError(async () => { await refreshDownloads(); });

	// Check for updates and show notification if available
	await checkForUpdatesOnStartup();
}

async function loadCurrentSettings() {
	try {
		const settings = await window.downTube.getSettings();
		currentMaxConcurrent = settings.maxConcurrent || 3;
		updateConcurrentDisplay();
	} catch (error) {
		console.error('Error loading settings:', error);
	}
}

function updateConcurrentDisplay() {
	const currentSettingEl = document.getElementById('current-concurrent-setting');
	const concurrentDescEl = document.getElementById('concurrent-description');
	
	if (currentSettingEl) {
		currentSettingEl.textContent = currentMaxConcurrent;
	}
	
	if (concurrentDescEl) {
		if (currentMaxConcurrent === 1) {
			concurrentDescEl.textContent = ' (Downloads will be processed sequentially)';
		} else {
			concurrentDescEl.textContent = ` (Downloads will be processed in batches of ${currentMaxConcurrent} items simultaneously)`;
		}
	}
}

init();

// Update notification functionality
let updateInfo = null;
let currentMaxConcurrent = 3;

async function checkForUpdatesOnStartup() {
    try {
        // Check if we have stored update info
        const preferences = await window.downTube.getUpdatePreferences();
        if (preferences.ok && preferences.preferences.lastCheck) {
            const lastCheck = preferences.preferences.lastCheck;
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;
            
            // Only check if it's been more than a day since last check
            if (now - lastCheck > oneDay) {
                await checkForUpdates();
            }
        }
    } catch (error) {
        console.error('Error checking for updates on startup:', error);
    }
}

async function checkForUpdates() {
    try {
        const result = await window.downTube.checkForUpdates();
        if (result.ok && result.hasUpdate) {
            updateInfo = result.updateInfo;
            showUpdateNotification();
        }
    } catch (error) {
        console.error('Error checking for updates:', error);
    }
}

function showUpdateNotification() {
    const updateIndicator = document.getElementById('update-indicator');
    if (updateIndicator) {
        updateIndicator.classList.remove('hidden');
    }
}

// Wire up update notification click
const updateNotification = document.getElementById('update-notification');
if (updateNotification) {
    updateNotification.addEventListener('click', async () => {
        if (updateInfo) {
            await window.downTube.showUpdateDialog(updateInfo);
        }
    });
}

// Periodic settings check to update concurrent display
setInterval(async () => {
    try {
        const settings = await window.downTube.getSettings();
        if (settings.maxConcurrent !== currentMaxConcurrent) {
            currentMaxConcurrent = settings.maxConcurrent || 3;
            updateConcurrentDisplay();
        }
    } catch (error) {
        // Ignore errors in periodic check
    }
}, 5000); // Check every 5 seconds

// Wire close button on this page too
const closeBtn2 = document.getElementById('app-close');
if (closeBtn2) closeBtn2.addEventListener('click', () => { try { window.downTube.windowClose(); } catch {} });
const minBtn2 = document.getElementById('app-min');
if (minBtn2) minBtn2.addEventListener('click', () => { try { window.downTube.windowMinimize(); } catch {} });
const maxBtn2 = document.getElementById('app-max');
if (maxBtn2) maxBtn2.addEventListener('click', () => { try { window.downTube.windowMaximizeToggle(); } catch {} });


