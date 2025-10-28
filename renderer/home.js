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
    urlInput.addEventListener('input', () => setDownloadEnabled(false));
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

downloadBtn.addEventListener('click', async () => {
	const url = urlInput.value.trim();
	if (!url) {
		alert('Please paste a YouTube video or playlist URL.');
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
    if (!url) { alert('Enter a URL first.'); return; }
    
    // Store original button content
    const originalHTML = fetchBtn.innerHTML;
    
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
        // Also refresh quality options based on this URL
        try {
            const res = await (async () => {
                try { return await getProbe(url); } catch { return null; }
            })();
            const fmt = document.querySelector('input[name="format"]:checked')?.value || 'mp4';
            populateQuality(fmt, res?.ok ? res : null);
        } catch (error) {
            console.error('Error during fetch:', error);
        }
    } catch (error) {
        console.error('Fetch error:', error);
        fetchResult.textContent = 'Failed to fetch video information';
        if (rangeWrap) rangeWrap.classList.add('hidden');
        if (concurrentInfo) concurrentInfo.classList.add('hidden');
        setDownloadEnabled(false);
    } finally {
        fetchBtn.disabled = false;
        // Restore original button content
        fetchBtn.innerHTML = originalHTML;
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