function buildYtDlpArgs({ url, format, outputPattern, ffmpegLoc, quality, abrKbps, playlistStart, playlistEnd, cookiesArgs }) {
    const isMp3 = String(format || 'mp4').toLowerCase() === 'mp3';
    const baseArgs = [
        '--newline',
        '--progress',
        '--ignore-errors',
        '--no-abort-on-unavailable-fragment',
        '--windows-filenames',
        '--no-part',
        '--no-keep-fragments',
        '--progress-template',
        'download:%(progress._percent_str)s|%(progress._total_bytes_str)s|%(progress._speed_str)s|%(progress._eta_str)s',
        '--progress-template',
        'postprocess:%(progress._percent_str)s',
        ...(cookiesArgs || []),
        '-o',
        outputPattern,
        '--ffmpeg-location',
        ffmpegLoc
    ];

    let videoSelector = 'bv*[ext=mp4]';
    if (quality && /^(144|240|360|480|720|1080|1440|2160)p?$/i.test(String(quality))) {
        const h = String(quality).replace(/[^0-9]/g, '');
        videoSelector = `bv*[ext=mp4][height<=${h}][height>=${h}]`;
    }

    const rangeArgs = [];
    if (playlistStart && Number(playlistStart) > 0) rangeArgs.push('--playlist-start', String(playlistStart));
    if (playlistEnd && Number(playlistEnd) > 0) rangeArgs.push('--playlist-end', String(playlistEnd));

    const mp4Args = [...baseArgs, ...rangeArgs, '-f', `${videoSelector}+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b`, '--merge-output-format', 'mp4', url];

    const targetAbr = abrKbps && /^\d+$/.test(String(abrKbps)) ? `${abrKbps}K` : '192K';
    const mp3Args = [...baseArgs, ...rangeArgs, '-x', '--audio-format', 'mp3', '--audio-quality', targetAbr, url];

    return { isMp3, args: isMp3 ? mp3Args : mp4Args };
}

module.exports = { buildYtDlpArgs };
