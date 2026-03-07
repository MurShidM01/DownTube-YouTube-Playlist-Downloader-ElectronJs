import React, { useEffect, useMemo, useState } from 'react';
import { downTube } from '../services/downTube.js';
import Select from '../components/Select.jsx';
import { useConversions } from '../hooks/useConversions.js';

const formatOptions = [
  { value: 'mp3', label: 'MP3 (Recommended)' },
  { value: 'm4a', label: 'M4A (AAC)' },
  { value: 'wav', label: 'WAV' }
];
const bitrateOptions = [64, 96, 128, 160, 192, 256, 320].map((rate) => ({
  value: rate,
  label: `${rate} kbps`
}));

function formatFileName(filePath) {
  if (!filePath) return '';
  return filePath.split(/[/\\\\]/).pop() || filePath;
}

export default function Converter({ settings, notify }) {
  const { active, recent } = useConversions();
  const [files, setFiles] = useState([]);
  const [outputDir, setOutputDir] = useState(settings?.defaultOutputDir || '');
  const [format, setFormat] = useState('mp3');
  const [bitrateKbps, setBitrateKbps] = useState(192);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    setOutputDir(settings?.defaultOutputDir || '');
  }, [settings?.defaultOutputDir]);

  const fileList = useMemo(() => files.map((file) => ({
    path: file,
    name: formatFileName(file)
  })), [files]);

  const canStart = files.length > 0 && !starting;

  async function handlePickFiles() {
    const picked = await downTube.chooseVideoFiles();
    if (Array.isArray(picked) && picked.length) {
      const uniq = Array.from(new Set([...files, ...picked]));
      setFiles(uniq);
    }
  }

  async function handleStart() {
    if (!files.length) {
      notify('Please select at least one video file.', 'error');
      return;
    }
    let targetDir = outputDir;
    if (!targetDir) {
      targetDir = await downTube.getDefaultOutputDir();
      setOutputDir(targetDir || '');
    }
    setStarting(true);
    const result = await downTube.startConversion({
      files,
      outputDir: targetDir,
      format,
      bitrateKbps: format === 'wav' ? null : bitrateKbps
    });
    setStarting(false);
    if (result?.ok) {
      notify('Converting started.');
      setFiles([]);
    } else {
      notify(result?.message || 'Failed to start conversion.', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <section className="dt-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="dt-label">Converter</p>
            <h2 className="text-2xl font-semibold">Video to audio</h2>
            <p className="text-sm dt-muted">Convert any local video to MP3, M4A, or WAV.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          <div>
            <label className="dt-label">Video files</label>
            <div className="mt-2 flex flex-col md:flex-row gap-3">
              <button className="dt-button dt-button-primary" onClick={handlePickFiles}>
                Choose files
              </button>
              <button
                className="dt-button dt-button-muted"
                onClick={() => setFiles([])}
                disabled={!files.length}
              >
                Clear list
              </button>
            </div>
            {files.length ? (
              <div className="mt-3 dt-card-soft p-3 space-y-2">
                {fileList.map((file) => (
                  <div key={file.path} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{file.name}</span>
                    <button
                      className="dt-button dt-button-muted"
                      onClick={() => setFiles((prev) => prev.filter((p) => p !== file.path))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs dt-muted">No files selected yet.</p>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Select
              label="Audio format"
              value={format}
              options={formatOptions}
              onChange={setFormat}
            />
            <Select
              label="Bitrate"
              value={bitrateKbps}
              options={bitrateOptions}
              onChange={setBitrateKbps}
              disabled={format === 'wav'}
            />
            <div>
              <label className="dt-label">Output folder</label>
              <div className="mt-2 flex gap-2">
                <input
                  value={outputDir}
                  onChange={(e) => setOutputDir(e.target.value)}
                  className="dt-input flex-1"
                  placeholder="Choose a folder..."
                />
                <button
                  className="dt-button dt-button-muted"
                  onClick={async () => {
                    const dir = await downTube.chooseOutputDir();
                    if (dir) setOutputDir(dir);
                  }}
                >
                  Browse
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={!canStart}
            className="dt-button dt-button-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {starting ? 'Starting...' : 'Convert to audio'}
          </button>
        </div>
      </section>

      <section className="dt-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="dt-label">Active</p>
            <h3 className="text-lg font-semibold">Conversions in progress</h3>
            <p className="text-sm dt-muted">Keep this tab open to track conversion progress.</p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {active.length === 0 ? (
            <div className="dt-card-soft p-6 text-center dt-muted">No active conversions.</div>
          ) : (
            active.map((item) => {
              const percent = Math.round(item.percent || 0);
              const showIndeterminate = item.indeterminate || !item.percent;
              const name = formatFileName(item.inputPath || item.outputPath);
              return (
                <div key={item.id} className="dt-card-soft p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="text-sm font-semibold truncate max-w-[420px]">{name}</div>
                    <div className="text-sm font-semibold">{showIndeterminate ? '—' : `${percent}%`}</div>
                  </div>
                  <div className="mt-3 h-2 rounded-full dt-progress-track">
                    {showIndeterminate ? (
                      <div className="h-2 rounded-full dt-progress-indeterminate" />
                    ) : (
                      <div className="h-2 rounded-full dt-progress-bar" style={{ width: `${percent}%` }} />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="dt-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="dt-label">Recent</p>
            <h3 className="text-lg font-semibold">Latest conversions</h3>
            <p className="text-sm dt-muted">Quick access to finished audio.</p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {recent.length === 0 ? (
            <div className="dt-card-soft p-6 text-center dt-muted">No conversions yet.</div>
          ) : (
            recent.map((item) => (
              <button
                key={item.outputPath}
                className="dt-card-soft p-3 w-full text-left hover:bg-black/5 flex items-center gap-3"
                onClick={() => downTube.showItemInFolder(item.outputPath)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{formatFileName(item.outputPath)}</div>
                  <div className="mt-1 text-xs dt-muted">{item.outputDir || ''}</div>
                </div>
                <span className="dt-badge">{(item.format || 'audio').toUpperCase()}</span>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
