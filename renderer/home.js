const urlInput = document.getElementById('url');
const downloadBtn = document.getElementById('download');
const fetchBtn = document.getElementById('fetch');
const fetchResult = document.getElementById('fetch-result');
const rangeWrap = document.getElementById('playlist-range');
const rangeStart = document.getElementById('range-start');
const rangeEnd = document.getElementById('range-end');
const rangeLabelStart = document.getElementById('range-label-start');
const rangeLabelEnd = document.getElementById('range-label-end');
const qualitySel = document.getElementById('quality');
const qualityHint = document.getElementById('quality-hint');
const updateIndicator = document.getElementById('update-indicator');
const updateNotification = document.getElementById('update-notification');
const concurrentInfo = document.getElementById('concurrent-info');
const concurrentCount = document.getElementById('concurrent-count');
let lastProbeUrl = '';
let lastProbeRes = null;
let updateInfo = null;
let currentMaxConcurrent = 3;

// Helper function to validate YouTube URL
function isValidYouTubeUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    // Check if it's a valid URL format
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        const pathname = urlObj.pathname;
        const searchParams = urlObj.searchParams;
        
        // Valid YouTube domains
        const validDomains = [
            'youtube.com',
            'www.youtube.com',
            'm.youtube.com',
            'youtu.be',
            'music.youtube.com'
        ];
        
        // Check if domain is valid
        const isValidDomain = validDomains.some(domain => hostname === domain || hostname.endsWith('.' + domain));
        if (!isValidDomain) return false;
        
        // For youtu.be short links, path should not be empty or just "/"
        if (hostname === 'youtu.be') {
            return pathname && pathname.length > 1 && pathname !== '/';
        }
        
        // For youtube.com domains, check for valid video/playlist patterns
        // Valid patterns:
        // - /watch?v=VIDEO_ID (regular videos)
        // - /playlist?list=PLAYLIST_ID (playlists)
        // - /shorts/VIDEO_ID (shorts)
        // - /live/VIDEO_ID (live streams)
        // - /embed/VIDEO_ID (embedded videos)
        
        if (pathname.includes('/watch') && searchParams.has('v')) {
            return true; // Video URL
        }
        
        if (pathname.includes('/playlist') && searchParams.has('list')) {
            return true; // Playlist URL
        }
        
        if (pathname.startsWith('/shorts/') && pathname.length > 8) {
            return true; // Shorts URL
        }
        
        if (pathname.startsWith('/live/') && pathname.length > 6) {
            return true; // Live stream URL
        }
        
        if (pathname.startsWith('/embed/') && pathname.length > 7) {
            return true; // Embedded video URL
        }
        
        // Check for "list" parameter (playlists can be in various formats)
        if (searchParams.has('list')) {
            return true;
        }
        
        return false; // Not a valid video/playlist URL
    } catch (e) {
        return false;
    }
}

// Reusable dialog modal functions
function showAlertDialog(title, message, buttonText = 'OK') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm';
        overlay.style.animation = 'fadeIn 0.2s ease';
        
        const dialog = document.createElement('div');
        dialog.className = 'bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 transform';
        dialog.style.animation = 'slideUp 0.3s ease';
        
        dialog.innerHTML = `
            <div class="flex items-start gap-4 mb-4">
                <div class="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
                <div class="flex-1">
                    <h3 class="text-lg font-bold text-slate-900 mb-1">${title}</h3>
                    <p class="text-sm text-slate-600">${message}</p>
                </div>
            </div>
            <div class="flex justify-end mt-6">
                <button id="dialog-ok" class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-200 transition-all transform hover:scale-105 active:scale-95">
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

// Error dialog for invalid URLs
function showErrorDialog(title, message, buttonText = 'OK') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm';
        overlay.style.animation = 'fadeIn 0.2s ease';
        
        const dialog = document.createElement('div');
        dialog.className = 'bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 transform';
        dialog.style.animation = 'slideUp 0.3s ease';
        
        dialog.innerHTML = `
            <div class="flex items-start gap-4 mb-4">
                <div class="p-3 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-lg">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                </div>
                <div class="flex-1">
                    <h3 class="text-lg font-bold text-slate-900 mb-1">${title}</h3>
                    <p class="text-sm text-slate-600">${message}</p>
                </div>
            </div>
            <div class="flex justify-end mt-6">
                <button id="dialog-ok" class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold hover:from-red-700 hover:to-rose-700 shadow-lg shadow-red-200 transition-all transform hover:scale-105 active:scale-95">
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

async function init() {
    setupQuality();
    setDownloadEnabled(false);
    
    // Load current settings
    await loadCurrentSettings();
    
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
    if (concurrentCount) {
        concurrentCount.textContent = currentMaxConcurrent;
    }
    if (concurrentInfo) {
        if (currentMaxConcurrent === 1) {
            concurrentInfo.textContent = 'Downloads will be processed sequentially (one at a time)';
        } else {
            concurrentInfo.textContent = `Downloads will be processed in batches of ${currentMaxConcurrent} items simultaneously`;
        }
    }
}

// Helper functions for quality management
const addQualityOption = (label, selected=false) => {
    if (!qualitySel) return;
    const opt = document.createElement('option');
    opt.value = label;
    opt.textContent = label;
    if (selected) opt.selected = true;
    qualitySel.appendChild(opt);
};

const getProbe = async (url) => {
    if (lastProbeUrl === url && lastProbeRes) return lastProbeRes;
    const res = await window.downTube.probeFormats(url);
    lastProbeUrl = url;
    lastProbeRes = res;
    return res;
};

const populateQuality = (fmt, res) => {
    if (!qualitySel) return;
    qualitySel.innerHTML = '';
    addQualityOption('Auto', true);
    if (fmt === 'mp4') {
        const heights = Array.isArray(res?.videoHeights) && res.videoHeights.length ? [...res.videoHeights].sort((a,b)=>b-a) : [2160,1440,1080,720,480,360,240,144];
        heights.forEach(h => addQualityOption(`${h}p`));
        if (qualityHint) {
            const hintSpan = qualityHint.querySelector('span');
            if (hintSpan) hintSpan.textContent = 'Available video qualities detected for this content.';
        }
    } else {
        const list = Array.isArray(res?.audioKbps) && res.audioKbps.length ? [...res.audioKbps].sort((a,b)=>b-a) : [320,256,192,160,128,96];
        list.forEach(k => addQualityOption(`${k} kbps`));
        if (qualityHint) {
            const hintSpan = qualityHint.querySelector('span');
            if (hintSpan) hintSpan.textContent = 'Available audio bitrates detected for this content.';
        }
    }
};

function setupQuality(){
    if (!qualitySel) return;
    const applyDefault = () => {
        const fmt = document.querySelector('input[name="format"]:checked')?.value || 'mp4';
        qualitySel.innerHTML = '';
        if (fmt === 'mp4') {
            ['Auto','2160p','1440p','1080p','720p','480p','360p','240p','144p'].forEach(q => addQualityOption(q, q === 'Auto'));
            if (qualityHint) {
                const hintSpan = qualityHint.querySelector('span');
                if (hintSpan) hintSpan.textContent = 'Auto selects the best available MP4 quality for this video.';
            }
        } else {
            ['Auto','320 kbps','256 kbps','192 kbps','160 kbps','128 kbps','96 kbps'].forEach(q => addQualityOption(q, q === 'Auto'));
            if (qualityHint) {
                const hintSpan = qualityHint.querySelector('span');
                if (hintSpan) hintSpan.textContent = 'Auto selects the best available audio bitrate for this content.';
            }
        }
    };

    const repopulateFromProbe = async () => {
        const url = urlInput.value.trim();
        if (!/^https?:\/\//i.test(url)) { applyDefault(); return; }
        const currentFmt = document.querySelector('input[name="format"]:checked')?.value || 'mp4';

        // Check if download was previously enabled
        const wasDownloadEnabled = downloadBtn && !downloadBtn.classList.contains('disabled-btn');

        // Disable quality and download button while loading
        if (qualitySel) qualitySel.disabled = true;
        if (downloadBtn) downloadBtn.classList.add('disabled-btn');

        await new Promise(r => setTimeout(r, 0));
        try {
            const res = await getProbe(url);
            populateQuality(currentFmt, res?.ok ? res : null);
        } catch { 
            applyDefault(); 
        } finally {
            // Re-enable quality dropdown
            if (qualitySel) qualitySel.disabled = false;
            // Re-enable download button if it was previously enabled
            if (wasDownloadEnabled && downloadBtn) {
                downloadBtn.classList.remove('disabled-btn');
            }
        }
    };
    // events
    urlInput.addEventListener('change', repopulateFromProbe);
    urlInput.addEventListener('blur', repopulateFromProbe);
    urlInput.addEventListener('input', () => {
        // Disable download when URL changes - user must fetch again
        setDownloadEnabled(false);
        // Clear fetch result when URL changes
        if (fetchResult) fetchResult.textContent = '';
        if (rangeWrap) rangeWrap.classList.add('hidden');
        if (concurrentInfo) concurrentInfo.classList.add('hidden');
    });
    const formatRadios = Array.from(document.querySelectorAll('input[name="format"]'));
    formatRadios.forEach(r => {
        r.addEventListener('change', repopulateFromProbe);
        r.addEventListener('input', repopulateFromProbe);
    });
    // Also listen on labels to be extra-safe across browsers
    const mp4Label = document.querySelector('label[for="fmt-mp4"]');
    const mp3Label = document.querySelector('label[for="fmt-mp3"]');
    if (mp4Label) mp4Label.addEventListener('click', () => setTimeout(repopulateFromProbe, 0));
    if (mp3Label) mp3Label.addEventListener('click', () => setTimeout(repopulateFromProbe, 0));
    applyDefault();
}

// Helper function to check and enable download button
function checkAndEnableDownload() {
    const url = urlInput.value.trim();
    if (url && isValidYouTubeUrl(url)) {
        setDownloadEnabled(true);
    } else {
        setDownloadEnabled(false);
    }
}

downloadBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
        await showAlertDialog('URL Required', 'Please paste a YouTube video or playlist URL.', 'OK');
        return;
    }
    // Validate YouTube URL
    if (!isValidYouTubeUrl(url)) {
        await showErrorDialog('Invalid URL', 'Please enter a valid YouTube URL. Make sure it\'s from youtube.com or youtu.be', 'OK');
        return;
    }
    const fmt = document.querySelector('input[name="format"]:checked').value;
    const q = qualitySel ? (qualitySel.value || 'Auto') : 'Auto';
    const quality = fmt === 'mp4' ? (q === 'Auto' ? undefined : q) : undefined;
    const abrKbps = fmt === 'mp3' ? (q === 'Auto' ? undefined : parseInt(q, 10)) : undefined;
    // Pull ordered values, ensuring start <= end before sending
    let playlistStart = rangeWrap && !rangeWrap.classList.contains('hidden') ? Math.max(1, parseInt(rangeStart.value || '1', 10)) : undefined;
    let playlistEnd = rangeWrap && !rangeWrap.classList.contains('hidden') ? Math.max(1, parseInt(rangeEnd.value || '1', 10)) : undefined;
    if (playlistStart !== undefined && playlistEnd !== undefined && playlistStart > playlistEnd) {
        const tmp = playlistStart; playlistStart = playlistEnd; playlistEnd = tmp;
    }
	// Fire-and-forget so the toast renders immediately
    try { window.downTube.startDownload({ url, format: fmt, quality, abrKbps, playlistStart, playlistEnd }).catch(() => {}); } catch {}
	showToast('Downloading Started');
});

if (fetchBtn) fetchBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) { await showAlertDialog('URL Required', 'Please enter a YouTube URL first.', 'OK'); return; }
    
    // Validate YouTube URL
    if (!isValidYouTubeUrl(url)) {
        await showErrorDialog('Invalid URL', 'Please enter a valid YouTube URL. Make sure it\'s from youtube.com or youtu.be', 'OK');
        return;
    }
    
    // Disable button to prevent double-clicks
    if (fetchBtn.disabled) return;
    
    // Store original button content before any changes
    const originalHTML = fetchBtn.innerHTML;
    
    // Helper to restore button state
    const restoreButton = () => {
        fetchBtn.disabled = false;
        fetchBtn.innerHTML = originalHTML;
    };
    
    try {
        fetchBtn.disabled = true;
        // Add loading spinner
        fetchBtn.innerHTML = `
            <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            <span>Fetching...</span>
        `;
        
        const info = await window.downTube.fetchInfo(url);
        
        if (info?.ok) {
            if (info.type === 'playlist') {
                fetchResult.textContent = `${info.count} videos found in playlist${info.title ? `: ${info.title}` : ''}`;
                if (rangeWrap && rangeStart && rangeEnd) {
                    rangeWrap.classList.remove('hidden');
                    rangeStart.min = '1';
                    rangeEnd.min = '1';
                    rangeStart.max = String(info.count);
                    rangeEnd.max = String(info.count);
                    rangeStart.value = '1';
                    rangeEnd.value = String(info.count);
                    updateRangeFill();
                    
                    // Show concurrent download info
                    if (concurrentInfo) {
                        concurrentInfo.classList.remove('hidden');
                        // Update the display with current setting
                        updateConcurrentDisplay();
                    }
                }
                setDownloadEnabled(true);
            } else {
                fetchResult.textContent = `Single video${info.title ? `: ${info.title}` : ''}`;
                if (rangeWrap) rangeWrap.classList.add('hidden');
                if (concurrentInfo) concurrentInfo.classList.add('hidden');
                setDownloadEnabled(true);
            }
        } else {
            fetchResult.textContent = info?.message || 'Could not fetch info';
            if (rangeWrap) rangeWrap.classList.add('hidden');
            if (concurrentInfo) concurrentInfo.classList.add('hidden');
            setDownloadEnabled(false);
        }
        
        // Restore button immediately after main fetch completes
        restoreButton();
        
        // Refresh quality options in background (don't block button restoration)
        (async () => {
            try {
                const res = await getProbe(url);
                const fmt = document.querySelector('input[name="format"]:checked')?.value || 'mp4';
                populateQuality(fmt, res?.ok ? res : null);
            } catch (error) {
                console.error('Error probing formats:', error);
            }
        })();
        
    } catch (error) {
        console.error('Fetch error:', error);
        fetchResult.textContent = 'Failed to fetch video information';
        if (rangeWrap) rangeWrap.classList.add('hidden');
        if (concurrentInfo) concurrentInfo.classList.add('hidden');
        setDownloadEnabled(false);
        restoreButton();
    }
});

function setDownloadEnabled(enabled){
    const btn = downloadBtn;
    if (!btn) return;
    if (enabled) btn.classList.remove('disabled-btn');
    else btn.classList.add('disabled-btn');
}

function updateRangeFill(){
    if (!rangeWrap || rangeWrap.classList.contains('hidden')) return;
    const min = parseInt(rangeStart.min || '1', 10);
    const max = parseInt(rangeStart.max || '1', 10);
    let a = Math.min(Math.max(parseInt(rangeStart.value || '1', 10), min), max);
    let b = Math.min(Math.max(parseInt(rangeEnd.value || '1', 10), min), max);
    if (a > b) { a = b; }
    // Clamp inputs so start never exceeds end, and end never goes below start
    if (parseInt(rangeStart.value || '1', 10) !== a) rangeStart.value = String(a);
    if (parseInt(rangeEnd.value || '1', 10) < a) rangeEnd.value = String(a);
    b = Math.min(Math.max(parseInt(rangeEnd.value || String(a), 10), a), max);
    if (parseInt(rangeEnd.value, 10) !== b) rangeEnd.value = String(b);
    const leftPct = ((a - min) / (max - min)) * 100;
    const rightPct = 100 - ((b - min) / (max - min)) * 100;
    const fill = document.getElementById('range-fill');
    if (fill){
        fill.style.left = `${leftPct}%`;
        fill.style.right = `${rightPct}%`;
    }
    if (rangeLabelStart) rangeLabelStart.textContent = String(a);
    if (rangeLabelEnd) rangeLabelEnd.textContent = String(b);
}

if (rangeStart && rangeEnd) {
    rangeStart.addEventListener('pointerdown', () => { rangeStart.style.zIndex = '30'; rangeEnd.style.zIndex = '10'; });
    rangeEnd.addEventListener('pointerdown', () => { rangeEnd.style.zIndex = '30'; rangeStart.style.zIndex = '10'; });
    rangeStart.addEventListener('input', () => {
        const s = parseInt(rangeStart.value || '1', 10);
        const e = parseInt(rangeEnd.value || '1', 10);
        if (s > e) rangeEnd.value = String(s);
        updateRangeFill();
    });
    rangeEnd.addEventListener('input', () => {
        const s = parseInt(rangeStart.value || '1', 10);
        const e = parseInt(rangeEnd.value || '1', 10);
        if (e < s) rangeStart.value = String(e);
        updateRangeFill();
    });
}
init();

function showToast(msg){
	let host = document.getElementById('toast-host');
	if (!host){
		host = document.createElement('div');
		host.id = 'toast-host';
		host.style.position = 'fixed';
		host.style.bottom = '20px';
		host.style.right = '20px';
		host.style.zIndex = '9999';
		document.body.appendChild(host);
	}
	const el = document.createElement('div');
	el.textContent = msg;
	el.style.background = 'rgba(17,24,39,0.9)';
	el.style.color = '#fff';
	el.style.padding = '10px 12px';
	el.style.borderRadius = '10px';
	el.style.marginTop = '8px';
	el.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)';
	host.appendChild(el);
	setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 300ms'; setTimeout(() => el.remove(), 320); }, 1500);
}

// Close button for frameless window
const closeBtn = document.getElementById('app-close');
if (closeBtn) closeBtn.addEventListener('click', () => { try { window.downTube.windowClose(); } catch {} });
const minBtn = document.getElementById('app-min');
if (minBtn) minBtn.addEventListener('click', () => { try { window.downTube.windowMinimize(); } catch {} });
const maxBtn = document.getElementById('app-max');
if (maxBtn) maxBtn.addEventListener('click', () => { try { window.downTube.windowMaximizeToggle(); } catch {} });

// Update notification functionality
async function checkForUpdatesOnStartup() {
    try {
        const result = await window.downTube.checkForUpdates();
        if (result?.ok && result?.hasUpdate && result?.updateInfo) {
            updateInfo = result.updateInfo;
            showUpdateNotification();
        }
    } catch (error) {
        console.error('Error checking for updates:', error);
    }
}

function showUpdateNotification() {
    if (updateIndicator && updateNotification) {
        updateIndicator.classList.remove('hidden');
    }
}

// Wire up update notification click
if (updateNotification) {
    updateNotification.addEventListener('click', async () => {
        if (updateInfo) {
            await window.downTube.showUpdateDialog(updateInfo);
        }
    });
}

// Listen for settings changes to update concurrent display
window.addEventListener('storage', async (event) => {
    if (event.key === 'downtube-settings') {
        try {
            const newSettings = JSON.parse(event.newValue);
            if (newSettings && newSettings.maxConcurrent !== currentMaxConcurrent) {
                currentMaxConcurrent = newSettings.maxConcurrent || 3;
                updateConcurrentDisplay();
            }
        } catch (error) {
            console.error('Error parsing settings update:', error);
        }
    }
});

// Also check for settings updates periodically (fallback)
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