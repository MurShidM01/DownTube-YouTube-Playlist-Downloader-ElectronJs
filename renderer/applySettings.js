(function(){
	function ensureFontLink(href){
		if (!href) return null;
		let link = document.querySelector(`link[data-dynamic-font="true"][href="${href}"]`);
		if (!link){
			link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = href;
			link.setAttribute('data-dynamic-font', 'true');
			document.head.appendChild(link);
		}
		return link;
	}

	function setPrimaryStyles({ brand, accent, bgGradient }){
		// Background
		if (bgGradient) document.body.style.backgroundImage = bgGradient;
		// Progress bar (Home page)
		const barInner = document.getElementById('bar-inner');
		if (barInner) barInner.style.backgroundImage = `linear-gradient(90deg, ${brand}, ${accent})`;
		// Also set CSS variables for themed bars used on other pages
		document.documentElement.style.setProperty('--brand', brand);
		document.documentElement.style.setProperty('--accent', accent);
		// Primary buttons (basic)
		const primaryButtons = document.querySelectorAll('.bg-sky-600, .btn-primary');
		primaryButtons.forEach(btn => {
			btn.style.backgroundColor = brand;
			btn.style.borderColor = brand;
			btn.style.color = '#fff';
		});
	}

	const themes = {
		light: { brand: '#2563eb', accent: '#e11d48', bgGradient: 'linear-gradient(to bottom, rgba(241,245,249,0.6), rgba(255,255,255,0.8))' },
		dark: { brand: '#4f46e5', accent: '#06b6d4', bgGradient: 'linear-gradient(to bottom, #0b1220, #0b1220)' },
		sunset: { brand: '#fb7185', accent: '#f59e0b', bgGradient: 'linear-gradient(180deg, #fff3e0 0%, #ffe4e6 100%)' },
		desert: { brand: '#d97706', accent: '#f59e0b', bgGradient: 'linear-gradient(180deg, #faf3dd 0%, #fde68a 100%)' },
		ocean: { brand: '#0ea5e9', accent: '#22d3ee', bgGradient: 'linear-gradient(180deg, #e0fbff 0%, #e0f7fa 100%)' },
		lavender:{ brand: '#7c3aed', accent: '#f472b6', bgGradient: 'linear-gradient(180deg, #f3e8ff 0%, #fdf4ff 100%)' },
		solarized:{ brand: '#268bd2', accent: '#b58900', bgGradient: 'linear-gradient(180deg, #fdf6e3 0%, #eee8d5 100%)' }
	};

	async function applySettings(){
		try{
			const settings = await window.downTube.getSettings();
			// Font loading
			let fontFamily = 'Poppins';
			let fontHref = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap';
			switch ((settings.font || 'Poppins')){
				case 'Poppins': fontFamily = 'Poppins'; fontHref = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap'; break;
				case 'Ubuntu': fontFamily = 'Ubuntu'; fontHref = 'https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;700&display=swap'; break;
				case 'Geist Mono': fontFamily = 'Geist Mono, "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
					fontHref = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap';
					break;
				case 'Inter': fontFamily = 'Inter'; fontHref = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'; break;
				case 'System': fontFamily = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial'; fontHref = null; break;
				default: fontFamily = settings.font; fontHref = null; break;
			}
			if (fontHref) ensureFontLink(fontHref);
			document.body.style.fontFamily = fontFamily;

			// Theme colors
			const themeKey = (settings.theme || 'light').toLowerCase();
			document.documentElement.setAttribute('data-theme', themeKey);
			const t = themes[themeKey] || themes.light;
			setPrimaryStyles(t);
			// Header and nav surfaces
			const header = document.querySelector('header');
			if (header) header.style.backgroundColor = 'var(--panel)';
			const nav = document.querySelector('nav');
			if (nav) nav.style.backgroundColor = 'var(--panel)';
		}catch(e){ /* ignore */ }
	}

	window.applySettings = applySettings;
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', applySettings);
	} else {
		applySettings();
	}
})();


