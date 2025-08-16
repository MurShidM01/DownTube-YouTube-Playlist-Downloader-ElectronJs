const urlInput = document.getElementById('url');
const outputInput = document.getElementById('output');
const chooseBtn = document.getElementById('choose');
const downloadBtn = document.getElementById('download');
const barInner = document.getElementById('bar-inner');
const progressTitle = document.getElementById('progress-title');
const progressCount = document.getElementById('progress-count');
const logEl = document.getElementById('log');
const sizeEl = document.getElementById('progress-size');
const speedEl = document.getElementById('progress-speed');
const etaEl = document.getElementById('progress-eta');
const percentEl = document.getElementById('progress-percent');

function setBar(percent) {
	const v = Math.max(0, Math.min(100, Number(percent) || 0));
	barInner.style.width = `${v}%`;
}

function addLog(text) {
	const li = document.createElement('li');
	li.textContent = text;
	logEl.prepend(li);
}

async function init() {
	const defaultDir = await window.downTube.getDefaultOutputDir();
	outputInput.value = defaultDir;
	// Initialize tabs
	setupTabs();
	await refreshDownloads();
	await refreshHistory();
}

chooseBtn.addEventListener('click', async () => {
	const dir = await window.downTube.chooseOutputDir();
	if (dir) outputInput.value = dir;
});


downloadBtn.addEventListener('click', async () => {
	const url = urlInput.value.trim();
	if (!url) {
		alert('Please paste a YouTube video or playlist URL.');
		return;
	}
	const fmt = document.querySelector('input[name="format"]:checked').value;
	setBar(0);
	progressTitle.textContent = 'Starting…';
	progressCount.textContent = '';
	addLog(`Queued: ${url}`);

	try {
		await window.downTube.startDownload({ url, format: fmt, outputDir: outputInput.value });
	} catch (e) {
		// Error will also be emitted via onError
	}
});

window.downTube.onProgress(({ type, percent, itemIndex, totalItems, title, indeterminate, size, speed, eta }) => {
	const current = (itemIndex ?? 0) + 1;
	progressTitle.textContent = `${title || 'Processing'} (${type})`;
	progressCount.textContent = totalItems > 1 ? `${current}/${totalItems}` : '';
	if (indeterminate) {
		barInner.style.width = '100%';
		barInner.classList.add('animate-pulse');
	} else {
		barInner.classList.remove('animate-pulse');
		setBar(percent || 0);
	}
	if (sizeEl) sizeEl.textContent = size || '—';
	if (speedEl) speedEl.textContent = speed || '—';
	if (etaEl) etaEl.textContent = eta || '—';
	if (percentEl) percentEl.textContent = `${Math.round(percent || 0)}%`;
});

window.downTube.onItemComplete(({ title, path, itemIndex, totalItems }) => {
	setBar(100);
	addLog(`Done: ${title} → ${path}`);
	const current = (itemIndex ?? 0) + 1;
	progressTitle.textContent = 'Completed';
	progressCount.textContent = totalItems > 1 ? `${current}/${totalItems}` : '';
});

window.downTube.onDone(() => {
	progressTitle.textContent = 'All tasks complete';
	progressCount.textContent = '';
	setBar(100);
});

window.downTube.onError(({ message }) => {
	progressTitle.textContent = 'Error';
	progressCount.textContent = '';
	addLog(`Error: ${message}`);
});

init();

// Simple tab navigation
function setupTabs() {
	const tabs = document.querySelectorAll('[data-tab]');
	const panels = document.querySelectorAll('[data-panel]');
	tabs.forEach(tab => {
		tab.addEventListener('click', () => {
			const target = tab.getAttribute('data-tab');
			tabs.forEach(t => t.classList.remove('text-sky-600', 'border-sky-600'));
			tab.classList.add('text-sky-600', 'border-sky-600');
			panels.forEach(panel => {
				panel.classList.toggle('hidden', panel.getAttribute('data-panel') !== target);
			});
		});
	});
}

async function refreshDownloads() {
	const list = document.getElementById('downloads-list');
	if (!list) return;
	const items = await window.downTube.getActiveDownloads();
	list.innerHTML = '';
	for (const d of items) {
		const li = document.createElement('li');
		li.textContent = `${Math.round(d.percent || 0)}% • ${d.title || d.url}`;
		list.appendChild(li);
	}
}

async function refreshHistory() {
	const list = document.getElementById('history-list');
	if (!list) return;
	const items = await window.downTube.getHistory();
	list.innerHTML = '';
	for (const h of [...items].reverse().slice(0, 50)) {
		const li = document.createElement('li');
		const when = new Date(h.completedAt).toLocaleString();
		li.textContent = `${h.title} • ${h.format.toUpperCase()} • ${h.size || ''} • ${when}`;
		list.appendChild(li);
	}
	const clearBtn = document.getElementById('clear-history');
	if (clearBtn) {
		clearBtn.onclick = async () => {
			await window.downTube.clearHistory();
			await refreshHistory();
		};
	}
}


