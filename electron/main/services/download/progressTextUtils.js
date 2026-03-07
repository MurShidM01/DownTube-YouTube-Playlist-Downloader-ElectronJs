function stripAnsi(input) {
    return String(input || '').replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
}

function cleanTitle(name) {
    if (!name) return name;
    return String(name).replace(/\.f\d+$/i, '').trim();
}

function parsePercent(value) {
    if (!value) return null;
    const cleaned = String(value).replace('%', '').trim();
    const num = parseFloat(cleaned);
    if (Number.isNaN(num)) return null;
    return num;
}

module.exports = {
    stripAnsi,
    cleanTitle,
    parsePercent
};
