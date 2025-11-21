async function refreshDownloads() {
	const list = document.getElementById('downloads-list');
	if (!list) return;
	const items = await window.downTube.getActiveDownloads();
	list.innerHTML = '';
	
	if (items.length === 0) {
		list.innerHTML = `
			<div class="text-center py-8" style="color: var(--muted)">
				<svg class="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
				</svg>
				<p class="text-sm font-semibold">No active downloads</p>
				<p class="text-xs mt-1">Start a download from the Home page</p>
			</div>
		`;
		return;
	}
	
    for (const d of items) {
		const card = document.createElement('div');
		card.className = 'bg-white border-2 border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all theme-card';
		const pct = Math.max(0, Math.min(100, Math.round(d.percent || 0)));
		const title = String(d.title || d.url || '').replace(/[&<>]/g, s => ({'&': '&amp;','<': '&lt;','>': '&gt;'}[s]));
        card.innerHTML = `
			<div class="flex items-start justify-between gap-3 mb-3">
                <div class="flex-1 min-w-0">
					<h3 class="font-bold text-slate-800 text-sm line-clamp-1 mb-1" title="${title}">${title}</h3>
					<div class="flex items-center gap-3 text-xs" style="color: var(--muted)">
						${d.indeterminate ? '<span class="flex items-center gap-1"><svg class="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>Converting...</span>' : `
						<span class="flex items-center gap-1">
							<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"></path>
							</svg>
							${d.size || '—'}
						</span>
						<span class="flex items-center gap-1">
							<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
							</svg>
							${d.speed || '—'}
						</span>
						<span class="flex items-center gap-1">
							<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
							</svg>
							${d.eta || '—'}
						</span>
						`}
					</div>
				</div>
                <div class="flex items-center gap-3">
                    <button class="dt-cancel p-2 rounded-lg hover:bg-red-50 transition-all" style="color: var(--muted)" title="Cancel Download" data-id="${d.id}">
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
						</svg>
					</button>
                    <span class="text-sm font-bold ${d.indeterminate ? 'text-slate-800' : 'text-slate-800'} min-w-[3rem] text-right" style="color: ${d.indeterminate ? 'var(--brand)' : 'var(--text)'}">${d.indeterminate ? '...' : pct + '%'}</span>
                </div>
			</div>
            <div class="h-3 rounded-full overflow-hidden border border-slate-200" style="background-color: var(--border)">
                <div class="h-full download-bar ${d.indeterminate ? 'animate-pulse' : ''}" style="width:${d.indeterminate ? '100%' : pct + '%'}"></div>
			</div>
		`;
		list.appendChild(card);
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
	
	if (items.length === 0) {
		list.innerHTML = `
			<div class="text-center py-12" style="color: var(--muted)">
				<svg class="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
				</svg>
				<p class="text-sm font-medium">No downloads yet</p>
				<p class="text-xs mt-1">Downloaded files will appear here</p>
			</div>
		`;
		return;
	}
	
	for (const h of [...items].reverse().slice(0, 100)) {
		const card = document.createElement('div');
		card.className = 'group bg-white border border-slate-200 rounded-lg p-3 hover:shadow-md transition-all duration-200 cursor-default theme-card';
		
		const when = new Date(h.completedAt).toLocaleString();
		const formatUpper = h.format?.toUpperCase?.() || 'FILE';
		const formatColor = formatUpper === 'MP4' ? 'bg-blue-100 text-blue-700 border-blue-200' : 
		                   formatUpper === 'MP3' ? 'bg-purple-100 text-purple-700 border-purple-200' : 
		                   'bg-slate-100 text-slate-700 border-slate-200';
		
		const icon = formatUpper === 'MP4' ? 
			`<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M4 6.47L5.76 10H20v8H4V6.47M22 4h-4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4z"/></svg>` :
			`<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
		
		card.innerHTML = `
			<div class="flex items-start gap-3">
				<div class="${formatColor} border rounded-lg p-2 flex-shrink-0 group-hover:scale-110 transition-transform">
					${icon}
				</div>
				<div class="flex-1 min-w-0">
					<div class="flex items-start justify-between gap-2">
						<h3 class="font-semibold text-slate-800 text-sm line-clamp-1 group-hover:text-sky-600 transition-colors" title="${escapeHtml(h.title)}" style="color: var(--text)">
							${escapeHtml(h.title)}
						</h3>
						<span class="text-xs font-medium ${formatColor} px-2 py-0.5 rounded-full border flex-shrink-0">
							${formatUpper}
						</span>
					</div>
					<div class="flex items-center gap-3 mt-1.5 text-xs" style="color: var(--muted)">
						<span class="flex items-center gap-1">
							<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
							</svg>
							${formatTime(when)}
						</span>
						${h.size ? `
						<span class="flex items-center gap-1">
							<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
							</svg>
							${h.size}
						</span>
						` : ''}
					</div>
				</div>
			</div>
		`;
		
		// Add click to open folder - use inline onclick for better reliability
		if (h.path) {
			card.style.cursor = 'pointer';
			card.title = 'Click to show in folder';
			card.onclick = async () => {
				try {
					await window.downTube.showItemInFolder(h.path);
				} catch (err) {
					console.error('Failed to open folder:', err);
					// Show error notification
					const toast = document.createElement('div');
					toast.textContent = 'Failed to open folder';
					toast.className = 'fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50';
					document.body.appendChild(toast);
					setTimeout(() => toast.remove(), 2000);
				}
			};
		} else {
			card.style.cursor = 'default';
		}
		
		list.appendChild(card);
	}
}

// Helper function to escape HTML
function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

// Professional confirmation dialog
function showConfirmDialog(title, message, confirmText, cancelText) {
    return new Promise((resolve) => {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm';
        overlay.style.animation = 'fadeIn 0.2s ease';
        
        // Create dialog
        const dialog = document.createElement('div');
        dialog.className = 'bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 transform theme-card';
        dialog.style.animation = 'slideUp 0.3s ease';
        
        dialog.innerHTML = `
            <div class="flex items-start gap-4 mb-4">
                <div class="p-3 rounded-xl shadow-lg" style="background: linear-gradient(to bottom right, var(--accent), var(--brand))">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                </div>
                <div class="flex-1">
                    <h3 class="text-lg font-bold text-slate-900 mb-1" style="color: var(--text)">${title}</h3>
                    <p class="text-sm text-slate-600" style="color: var(--muted)">${message}</p>
                </div>
            </div>
            <div class="flex gap-3 mt-6">
                <button id="dialog-cancel" class="flex-1 px-4 py-2.5 rounded-xl border-2 border-slate-200 font-semibold hover:bg-slate-50 transition-all" style="color: var(--text); border-color: var(--border)">
                    ${cancelText}
                </button>
                <button id="dialog-confirm" class="flex-1 px-4 py-2.5 rounded-xl text-white font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95" style="background: linear-gradient(to right, var(--accent), var(--accent)); box-shadow: 0 8px 20px color-mix(in srgb, var(--accent), transparent 70%)">
                    ${confirmText}
                </button>
            </div>
        `;
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        // Add animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        `;
        document.head.appendChild(style);
        
        // Handle buttons
        const confirmBtn = dialog.querySelector('#dialog-confirm');
        const cancelBtn = dialog.querySelector('#dialog-cancel');
        
        const cleanup = () => {
            overlay.style.animation = 'fadeOut 0.2s ease';
            setTimeout(() => {
                overlay.remove();
                style.remove();
            }, 200);
        };
        
        confirmBtn.onclick = () => {
            cleanup();
            resolve(true);
        };
        
        cancelBtn.onclick = () => {
            cleanup();
            resolve(false);
        };
        
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                cleanup();
                resolve(false);
            }
        };
    });
}

// Show download complete dialog
function showDownloadCompleteDialog(data) {
    return new Promise((resolve) => {
        const { completed, total, outDir } = data;
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm';
        overlay.style.animation = 'fadeIn 0.2s ease';
        
        // Create dialog
        const dialog = document.createElement('div');
        dialog.className = 'bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 transform theme-card';
        dialog.style.animation = 'slideUp 0.3s ease';
        
        const successIcon = `
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
        `;
        
        dialog.innerHTML = `
            <div class="flex items-start gap-4 mb-4">
                <div class="p-3 rounded-xl shadow-lg" style="background: linear-gradient(to bottom right, var(--brand), var(--accent)); box-shadow: 0 8px 20px color-mix(in srgb, var(--brand), transparent 70%)">
                    ${successIcon}
                </div>
                <div class="flex-1">
                    <h3 class="text-lg font-bold text-slate-900 mb-1" style="color: var(--text)">Downloads Complete!</h3>
                    <p class="text-sm text-slate-600 mb-3" style="color: var(--muted)">Your downloads have finished successfully.</p>
                    <div class="bg-white border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
                        <div class="flex items-center gap-2">
                            <svg class="w-4 h-4 flex-shrink-0" style="color: var(--brand)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <span style="color: var(--text)"><strong>${completed}</strong> of <strong>${total}</strong> item(s) completed</span>
                        </div>
                        <div class="flex items-start gap-2">
                            <svg class="w-4 h-4 flex-shrink-0 mt-0.5" style="color: var(--brand)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
                            </svg>
                            <span class="break-all" style="color: var(--muted)" title="${outDir}">${outDir}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="flex gap-3 mt-6">
                <button id="dialog-ok" class="flex-1 px-4 py-2.5 rounded-xl border-2 border-slate-200 font-semibold hover:bg-slate-50 transition-all" style="color: var(--text); border-color: var(--border)">
                    Close
                </button>
                <button id="dialog-open-folder" class="flex-1 px-4 py-2.5 rounded-xl text-white font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2" style="background: linear-gradient(to right, var(--brand), var(--accent)); box-shadow: 0 8px 20px color-mix(in srgb, var(--brand), transparent 70%)">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"></path>
                    </svg>
                    Open Folder
                </button>
            </div>
        `;
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        // Add animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        `;
        document.head.appendChild(style);
        
        // Handle buttons
        const okBtn = dialog.querySelector('#dialog-ok');
        const openFolderBtn = dialog.querySelector('#dialog-open-folder');
        
        const cleanup = () => {
            overlay.style.animation = 'fadeOut 0.2s ease';
            setTimeout(() => {
                overlay.remove();
                style.remove();
            }, 200);
        };
        
        okBtn.onclick = () => {
            cleanup();
            resolve('ok');
        };
        
        openFolderBtn.onclick = () => {
            cleanup();
            resolve('open-folder');
        };
        
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                cleanup();
                resolve('ok');
            }
        };
    });
}

// Helper function to format time in a friendly way
function formatTime(dateString) {
	try {
		const date = new Date(dateString);
		
		// Check if date is valid
		if (isNaN(date.getTime())) {
			return 'Recently';
		}
		
		const now = new Date();
		const diffMs = now - date;
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);
		
		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins} min ago`;
		if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
		if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
		
		// Return formatted date with time
		return date.toLocaleDateString(undefined, { 
			month: 'short', 
			day: 'numeric', 
			year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
		});
	} catch (error) {
		console.error('Error formatting time:', error);
		return 'Recently';
	}
}

async function init() {
	await refreshDownloads();
	await refreshHistory();
	await loadCurrentSettings();
	
	const clearBtn = document.getElementById('clear-history');
	if (clearBtn) {
		clearBtn.onclick = async () => {
			// Show confirmation dialog
			const confirmed = await showConfirmDialog(
				'Clear Download History',
				'Are you sure you want to clear all download history? This action cannot be undone.',
				'Clear',
				'Cancel'
			);
			
			if (confirmed) {
				await window.downTube.clearHistory();
				await refreshHistory();
			}
		};
	}

	// Single subscriptions; refresh efficiently
	window.downTube.onProgress(async () => { await refreshDownloads(); });
	window.downTube.onItemComplete(async () => { await refreshDownloads(); await refreshHistory(); });
	window.downTube.onDone(async (data) => { 
		await refreshDownloads(); 
		await refreshHistory(); 
		
		// Show download complete dialog if data includes completion info
		if (data && data.completed !== undefined && data.totalItems !== undefined && data.outDir) {
			const action = await showDownloadCompleteDialog({
				completed: data.completed,
				total: data.totalItems,
				outDir: data.outDir
			});
			
			if (action === 'open-folder' && data.outDir) {
				try {
					await window.downTube.openPath(data.outDir);
				} catch (error) {
					console.error('Error opening folder:', error);
				}
			}
		}
	});
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


