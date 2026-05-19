"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  FileText, GitCompare, Download, ArrowLeft,
  Table as TableIcon, Settings2, Search
} from 'lucide-react';
import Link from 'next/link';
import * as XLSX from 'xlsx';

// --- TYPES ---
interface DiffLine {
  lineNum: number;
  file1Content: string;
  file2Content: string;
}
interface CompareResult {
  maxLines: number;
  diffCount: number;
  diffLines: DiffLine[];
  isTruncated: boolean;
}
interface FileState {
  file: File | null;
  content: any[][];
  headers: string[];
  isExcel: boolean;
}

const INITIAL_FILE_STATE: FileState = { file: null, content: [], headers: [], isExcel: false };
const MAX_DISPLAY_DIFFS = 1000;

export default function ComparatorPage() {
  const [fileA, setFileA] = useState<FileState>(INITIAL_FILE_STATE);
  const [fileB, setFileB] = useState<FileState>(INITIAL_FILE_STATE);
  const [selectedColA, setSelectedColA] = useState('');
  const [selectedColB, setSelectedColB] = useState('');
  const [result, setResult] = useState<CompareResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('Awaiting input');
  const [settings, setSettings] = useState({ caseSensitive: false, trimWhitespace: true });
  const [searchTerm, setSearchTerm] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isReady = useMemo(() => fileA.file !== null && fileB.file !== null, [fileA.file, fileB.file]);

  const filteredDiffs = useMemo(() => {
    if (!result) return [];
    if (!searchTerm) return result.diffLines;
    return result.diffLines.filter(d =>
      d.file1Content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.file2Content.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [result, searchTerm]);

  // Animated dot grid (same as hub page)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    let frame = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const spacing = 40;
      const cols = Math.ceil(canvas.width / spacing);
      const rows = Math.ceil(canvas.height / spacing);
      for (let x = 0; x <= cols; x++) {
        for (let y = 0; y <= rows; y++) {
          const pulse = Math.sin(frame * 0.008 + x * 0.3 + y * 0.2) * 0.5 + 0.5;
          ctx.beginPath();
          ctx.arc(x * spacing, y * spacing, 0.8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(52,211,153,${0.04 + pulse * 0.06})`;
          ctx.fill();
        }
      }
      frame++;
      requestAnimationFrame(draw);
    };
    draw();
    return () => window.removeEventListener('resize', resize);
  }, []);

  const handleCompare = () => {
    if (!isReady) return;
    setIsProcessing(true);
    setStatus('Processing...');
    setTimeout(() => {
      const dataA = fileA.content;
      const dataB = fileB.content;
      const maxLines = Math.max(dataA.length, dataB.length);
      const idxA = fileA.isExcel && selectedColA ? fileA.headers.indexOf(selectedColA) : -1;
      const idxB = fileB.isExcel && selectedColB ? fileB.headers.indexOf(selectedColB) : -1;
      const allDiffs: DiffLine[] = [];
      let count = 0;
      for (let i = 0; i < maxLines; i++) {
        let valA = i < dataA.length ? (idxA !== -1 ? String(dataA[i][idxA] ?? '') : dataA[i].join('|')) : '[Missing]';
        let valB = i < dataB.length ? (idxB !== -1 ? String(dataB[i][idxB] ?? '') : dataB[i].join('|')) : '[Missing]';
        let cA = settings.trimWhitespace ? valA.trim() : valA;
        let cB = settings.trimWhitespace ? valB.trim() : valB;
        if (!settings.caseSensitive) { cA = cA.toLowerCase(); cB = cB.toLowerCase(); }
        if (cA !== cB) {
          count++;
          if (allDiffs.length < MAX_DISPLAY_DIFFS) allDiffs.push({ lineNum: i + 1, file1Content: valA, file2Content: valB });
        }
      }
      setResult({ maxLines, diffCount: count, diffLines: allDiffs, isTruncated: count > MAX_DISPLAY_DIFFS });
      setStatus(count === 0 ? '✓ Perfect match' : `Found ${count.toLocaleString()} differences`);
      setIsProcessing(false);
    }, 100);
  };

  const exportDifferences = () => {
    if (!result) return;
    const ws = XLSX.utils.json_to_sheet(result.diffLines);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Differences');
    XLSX.writeFile(wb, 'comparison_report.xlsx');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, side: 'A' | 'B') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isExcel = /\.(xlsx|xls|csv)$/.test(file.name);
    const reader = new FileReader();
    setStatus(`Loading ${file.name}...`);
    reader.onload = (ev) => {
      let content: any[][] = [];
      let headers: string[] = [];
      if (isExcel) {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        content = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        headers = (content[0] || []).map(h => String(h));
      } else {
        content = (ev.target?.result as string).split(/\r?\n/).map(line => [line]);
      }
      const state = { file, content, headers, isExcel };
      if (side === 'A') { setFileA(state); setSelectedColA(''); }
      else { setFileB(state); setSelectedColB(''); }
      setResult(null);
      setStatus('File loaded — ready to compare');
    };
    if (isExcel) reader.readAsArrayBuffer(file); else reader.readAsText(file);
  };

  const matchPct = result
    ? (((result.maxLines - result.diffCount) / Math.max(result.maxLines, 1)) * 100).toFixed(1)
    : null;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0a0c0f] pb-24">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap');
        .font-display { font-family: 'Syne', sans-serif; }
        .font-mono-custom { font-family: 'Space Mono', monospace; }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { opacity: 0; animation: fade-up 0.55s cubic-bezier(0.16,1,0.3,1) forwards; }

        @keyframes scan {
          0%   { transform: translateY(-100%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        .scan-line { animation: scan 8s ease-in-out infinite; }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.7); }
        }
        .pulse-dot { animation: pulse-dot 1.5s ease-in-out infinite; }

        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(52,211,153,0.2); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(52,211,153,0.4); }
      `}</style>

      {/* Dot grid canvas */}
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 opacity-100" />
      {/* Scan line */}
      <div className="scan-line pointer-events-none fixed left-0 top-0 z-10 h-[2px] w-full bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />
      {/* Radial glow */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(16,185,129,0.06),transparent)]" />

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-10">

        {/* ── HEADER ── */}
        <header className="fade-up mb-12" style={{ animationDelay: '0ms' }}>
          <div className="mb-8 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.06]" />
            <span className="font-mono-custom text-[10px] tracking-[0.3em] text-white/25">BILLONE · OCS TOOLS</span>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <Link
                href="/mainocs"
                className="group mb-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-mono-custom text-[11px] tracking-widest text-white/40 transition-all hover:border-white/20 hover:text-white/70"
              >
                <ArrowLeft size={12} className="transition-transform group-hover:-translate-x-0.5" />
                BACK TO HUB
              </Link>
              <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-white">
                File <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-transparent">Comparator</span>
              </h1>
              <p className="mt-2 font-mono-custom text-[11px] text-white/30">
                เปรียบเทียบข้อมูลสองชุด · หาจุดที่แตกต่างได้ทันที
              </p>
            </div>

            {/* Status pill */}
            <div className="mt-1 flex shrink-0 items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 backdrop-blur-sm">
              <div className={`pulse-dot h-2 w-2 rounded-full ${status.startsWith('✓') ? 'bg-emerald-400' : isProcessing ? 'bg-amber-400' : 'bg-white/20'}`} />
              <span className="font-mono-custom text-[11px] text-white/50">{status}</span>
            </div>
          </div>
        </header>

        {/* ── CONFIG CARD ── */}
        <div className="fade-up mb-6 rounded-2xl border border-white/10 bg-white/5 p-7 backdrop-blur-sm" style={{ animationDelay: '80ms' }}>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

            {/* File slots */}
            <div className="lg:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2">
              {([fileA, fileB] as FileState[]).map((f, i) => {
                const side = i === 0 ? 'A' : 'B';
                const tag = side === 'A' ? 'SOURCE A' : 'SOURCE B';
                const accentA = 'border-amber-500/30 bg-amber-500/5';
                const accentB = 'border-sky-500/30 bg-sky-500/5';
                const accent = f.file ? (i === 0 ? accentA : accentB) : 'border-white/10 bg-white/[0.03]';
                return (
                  <div key={i} className={`rounded-xl border-2 border-dashed p-5 transition-all duration-300 ${accent}`}>
                    <div className="mb-4 flex items-center justify-between">
                      <span className={`rounded-md border px-2.5 py-1 font-mono-custom text-[10px] font-bold tracking-[0.2em] ${i === 0 ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-sky-500/30 bg-sky-500/10 text-sky-400'}`}>
                        {tag}
                      </span>
                      <div className="flex items-center gap-2">
                        {f.file && (f.isExcel ? <TableIcon size={13} className="text-white/30" /> : <FileText size={13} className="text-white/30" />)}
                        <input type="file" id={`f-${i}`} className="hidden" onChange={(e) => handleFileChange(e, side)} />
                        <button
                          onClick={() => document.getElementById(`f-${i}`)?.click()}
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-mono-custom text-[10px] tracking-widest text-white/50 transition-all hover:border-white/25 hover:text-white/80"
                        >
                          {f.file ? 'CHANGE' : 'UPLOAD'}
                        </button>
                      </div>
                    </div>

                    <p className="mb-3 truncate font-mono-custom text-xs text-white/60">
                      {f.file ? f.file.name : <span className="text-white/20">No file selected</span>}
                    </p>

                    {f.isExcel && (
                      <select
                        className="w-full rounded-lg border border-white/10 bg-[#0a0c0f] p-2 font-mono-custom text-[11px] text-white/50 outline-none focus:border-emerald-500/40 focus:ring-0"
                        onChange={e => i === 0 ? setSelectedColA(e.target.value) : setSelectedColB(e.target.value)}
                        value={i === 0 ? selectedColA : selectedColB}
                      >
                        <option value="">— Full Row —</option>
                        {f.headers.map((h, idx) => <option key={idx} value={h}>{h}</option>)}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Settings + Run */}
            <div className="flex flex-col justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
              <div>
                <div className="mb-5 flex items-center gap-2">
                  <Settings2 size={13} className="text-white/30" />
                  <span className="font-mono-custom text-[10px] tracking-[0.25em] text-white/30">SETTINGS</span>
                </div>
                <div className="space-y-4">
                  {[
                    { key: 'trimWhitespace', label: 'Auto-trim spaces' },
                    { key: 'caseSensitive', label: 'Case sensitive' },
                  ].map(opt => (
                    <label key={opt.key} className="flex cursor-pointer items-center gap-3 group">
                      <div
                        onClick={() => setSettings(s => ({ ...s, [opt.key]: !s[opt.key as keyof typeof s] }))}
                        className={`relative h-5 w-9 rounded-full border transition-all ${settings[opt.key as keyof typeof settings] ? 'border-emerald-500/40 bg-emerald-500/20' : 'border-white/10 bg-white/5'}`}
                      >
                        <div className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${settings[opt.key as keyof typeof settings] ? 'left-4 bg-emerald-400' : 'left-0.5 bg-white/20'}`} />
                      </div>
                      <span className="font-mono-custom text-[11px] text-white/40 group-hover:text-white/70 transition-colors">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCompare}
                disabled={!isReady || isProcessing}
                className="relative mt-6 w-full overflow-hidden rounded-xl border border-emerald-500/20 bg-emerald-500/10 py-3.5 font-mono-custom text-xs font-bold tracking-[0.2em] text-emerald-400 transition-all hover:bg-emerald-500/20 hover:border-emerald-500/40 disabled:pointer-events-none disabled:opacity-20"
              >
                {isProcessing ? 'COMPUTING...' : 'RUN COMPARE'}
                {/* Bottom accent */}
                <div className="absolute bottom-0 left-0 h-[1px] w-full bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
              </button>
            </div>
          </div>
        </div>

        {/* ── RESULTS ── */}
        {result && (
          <div className="fade-up space-y-4" style={{ animationDelay: '0ms' }}>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'TOTAL ROWS', val: result.maxLines.toLocaleString() },
                { label: 'DIFFERENCES', val: result.diffCount.toLocaleString(), highlight: result.diffCount > 0 },
                { label: 'MATCH RATE', val: `${matchPct}%`, green: true },
              ].map(s => (
                <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 text-center">
                  <p className="font-mono-custom text-[10px] tracking-[0.25em] text-white/25">{s.label}</p>
                  <p className={`mt-1 font-display text-3xl font-extrabold ${s.highlight ? 'text-red-400' : s.green ? 'text-emerald-400' : 'text-white'}`}>
                    {s.val}
                  </p>
                </div>
              ))}
            </div>

            {/* Search + Export bar */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" size={13} />
                <input
                  type="text"
                  placeholder="Search differences..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 font-mono-custom text-xs text-white/60 outline-none placeholder:text-white/20 focus:border-emerald-500/30 focus:bg-white/[0.07] transition-all"
                />
              </div>
              <button
                onClick={exportDifferences}
                className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-2.5 font-mono-custom text-[11px] tracking-widest text-emerald-400 transition-all hover:bg-emerald-500/20"
              >
                <Download size={13} /> EXPORT
              </button>
            </div>

            {/* Diff table */}
            <div className="overflow-hidden rounded-2xl border border-white/10">
              {/* Table header bar */}
              <div className="flex items-center justify-between bg-[#0d0f12] px-6 py-4">
                <div>
                  <h2 className="font-display text-base font-bold text-white">Discrepancy Log</h2>
                  <p className="mt-0.5 font-mono-custom text-[10px] text-white/25">
                    Showing {filteredDiffs.length.toLocaleString()} of {result.diffCount.toLocaleString()} differences
                  </p>
                </div>
                <div className={`rounded-full px-4 py-1.5 font-mono-custom text-[11px] font-bold tracking-widest ${result.diffCount === 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                  {result.diffCount === 0 ? '✓ CLEAN' : '⚠ ACTION REQUIRED'}
                </div>
              </div>

              <div className="max-h-[560px] overflow-y-auto">
                <table className="w-full border-collapse text-left">
                  <thead className="sticky top-0 z-10 bg-[#0a0c0f]">
                    <tr className="border-b border-white/[0.06]">
                      <th className="px-5 py-3 font-mono-custom text-[10px] tracking-[0.2em] text-white/25 w-20">ROW</th>
                      <th className="px-5 py-3 font-mono-custom text-[10px] tracking-[0.2em] text-amber-400/60">SOURCE A</th>
                      <th className="px-5 py-3 font-mono-custom text-[10px] tracking-[0.2em] text-sky-400/60">SOURCE B</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDiffs.map((diff, i) => (
                      <tr
                        key={i}
                        className="group border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]"
                      >
                        <td className="px-5 py-3 font-mono-custom text-xs text-white/20 group-hover:text-amber-400/60 transition-colors">
                          #{diff.lineNum}
                        </td>
                        <td className="px-5 py-3">
                          <div className="rounded-lg border border-amber-500/10 bg-amber-500/5 px-3 py-2 font-mono-custom text-[11px] text-amber-300/80 break-all line-clamp-2">
                            {diff.file1Content || <span className="text-white/20 italic">empty</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="rounded-lg border border-sky-500/10 bg-sky-500/5 px-3 py-2 font-mono-custom text-[11px] text-sky-300/80 break-all line-clamp-2">
                            {diff.file2Content || <span className="text-white/20 italic">empty</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredDiffs.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-20 text-center font-mono-custom text-xs text-white/20">
                          No matching differences found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── EMPTY STATE ── */}
        {!result && !isProcessing && (
          <div className="fade-up mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.06] py-28 text-center" style={{ animationDelay: '160ms' }}>
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/20">
              <GitCompare size={24} strokeWidth={1.5} />
            </div>
            <p className="font-display text-lg font-bold text-white/30">No Results Yet</p>
            <p className="mt-1 font-mono-custom text-[11px] text-white/15">Upload two files and run compare</p>
          </div>
        )}

        {/* ── FOOTER ── */}
        <footer className="mt-20 border-t border-white/[0.05] pt-8 text-center">
          <p className="font-mono-custom text-[10px] tracking-[0.3em] text-white/15">
            ARM@MOS · BILLONE INTERNAL ANALYTICS SYSTEMS
          </p>
        </footer>
      </div>
    </div>
  );
}