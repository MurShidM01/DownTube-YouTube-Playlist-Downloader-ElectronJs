import React from 'react';
import { IconMinus, IconSquare, IconX } from './icons/Feather.jsx';
import { downTube } from '../services/downTube.js';

export default function TitleBar({ title, subtitle, updateInfo, onUpdateClick }) {
  return (
    <div className="titlebar flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center border border-black/5">
          <img src="/assets/logo.svg" alt="DownTube" className="w-7 h-7" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.35em] dt-muted">{subtitle}</div>
          <div className="text-xl font-semibold">{title}</div>
        </div>
        {updateInfo ? (
          <button onClick={onUpdateClick} className="ml-4 no-drag dt-pill">
            Update {updateInfo.latestVersion} available
          </button>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => downTube.windowMinimize()}
          className="no-drag w-9 h-9 rounded-xl hover:bg-black/5 text-slate-500 flex items-center justify-center"
          title="Minimize"
        >
          <IconMinus size={16} />
        </button>
        <button
          onClick={() => downTube.windowMaximizeToggle()}
          className="no-drag w-9 h-9 rounded-xl hover:bg-black/5 text-slate-500 flex items-center justify-center"
          title="Maximize"
        >
          <IconSquare size={16} />
        </button>
        <button
          onClick={() => downTube.windowClose()}
          className="no-drag w-9 h-9 rounded-xl hover:bg-rose-500/20 text-rose-500 flex items-center justify-center"
          title="Close"
        >
          <IconX size={16} />
        </button>
      </div>
    </div>
  );
}
