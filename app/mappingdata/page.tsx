"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  CheckCircle2, Shuffle, X, Database,
  Filter, Download, RefreshCw, BarChart3,
  Search, ArrowLeft, Layers, FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import Link from 'next/link';
import Swal from 'sweetalert2';

// UTILS
const normalizeMSISDN = (val: any): string => {
  const str = String(val ?? '').trim().replace(/\D/g, '');
  if (!str) return '';
  if (str.startsWith('66') && str.length > 9) return str.slice(2);
  if (str.startsWith('0') && str.length > 8) return str.slice(1);
  return str;
};

const isValidColumn = (col: string) =>
  col && !col.startsWith('__EMPTY') && col.trim() !== '';

const readFile = (file: File): Promise<any[]> =>
  new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') {
      file.arrayBuffer().then(buf => {
        try {
          const wb = XLSX.read(buf, { type: 'array' });
          resolve(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' }));
        } catch (e) { reject(e); }
      });
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (r: { data: any[] }) => resolve(r.data),
        error: reject,
      });
    }
  });

// COMPONENT
export default function DataMapper() {
  const [file1Data, setFile1Data] = useState<any[]>([]);
  const [file2Data, setFile2Data] = useState<any[]>([]);
  const [fileName1, setFileName1] = useState('');
  const [fileName2, setFileName2] = useState('');
  const [availableCols, setAvailableCols] = useState<string[]>([]);
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultData, setResultData] = useState<any[] | null>(null);
  const [stats, setStats] = useState({ total: 0, matched: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Dot grid
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize(); window.addEventListener('resize', resize);
    let frame = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const sp = 40, cols = Math.ceil(canvas.width / sp), rows = Math.ceil(canvas.height / sp);
      for (let x = 0; x <= cols; x++) for (let y = 0; y <= rows; y++) {
        const p = Math.sin(frame * 0.008 + x * 0.3 + y * 0.2) * 0.5 + 0.5;
        ctx.beginPath(); ctx.arc(x * sp, y * sp, 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99,102,241,${0.04 + p * 0.05})`; ctx.fill();
      }
      frame++; requestAnimationFrame(draw);
    };
    draw(); return () => window.removeEventListener('resize', resize);
  }, []);

  const handleFileUpload = useCallback(async (file: File, isPrimary: boolean) => {
    try {
      const data = await readFile(file);
      if (data.length === 0) { Swal.fire('Error', 'ไฟล์ไม่มีข้อมูล', 'error'); return; }

      if (isPrimary) {
        setFile1Data(data); setFileName1(file.name); setResultData(null);
      } else {
        setFile2Data(data); setFileName2(file.name); setResultData(null);
        const cols = Object.keys(data[0]).filter(k => k.toUpperCase() !== 'MSISDN' && isValidColumn(k));
        setAvailableCols(cols); setSelectedCols([]);
      }
    } catch {
      Swal.fire('Error', 'ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบรูปแบบไฟล์', 'error');
    }
  }, []);

  const clearFile = useCallback((isPrimary: boolean) => {
    if (isPrimary) { setFile1Data([]); setFileName1(''); setResultData(null); }
    else { setFile2Data([]); setFileName2(''); setAvailableCols([]); setSelectedCols([]); setResultData(null); }
  }, []);

  const toggleCol = useCallback((col: string) => {
    setSelectedCols(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  }, []);

  const selectAllCols = useCallback(() => {
    setSelectedCols(prev => prev.length === availableCols.length ? [] : [...availableCols]);
  }, [availableCols]);

  const handleProcess = useCallback(() => {
    if (!file1Data.length || !file2Data.length || !selectedCols.length) return;
    setIsProcessing(true);

    // Use setTimeout to avoid blocking UI
    setTimeout(() => {
      try {
        // Build reference map — O(n)
        const refMap = new Map<string, any>();
        for (const row of file2Data) {
          const msisdnKey = Object.keys(row).find(k => k.toUpperCase() === 'MSISDN');
          const key = normalizeMSISDN(msisdnKey ? row[msisdnKey] : '');
          if (key) refMap.set(key, row);
        }

        let matchCount = 0;
        const merged = file1Data.map(row1 => {
          const msisdnKey = Object.keys(row1).find(k => k.toUpperCase() === 'MSISDN');
          const key = normalizeMSISDN(msisdnKey ? row1[msisdnKey] : '');
          const match = refMap.get(key);
          if (match) matchCount++;
          return {
            ...row1,
            ...Object.fromEntries(selectedCols.map(col => [col, match ? (match[col] ?? '') : 'N/A'])),
          };
        });

        setStats({ total: merged.length, matched: matchCount });
        setResultData(merged);
        Swal.fire({ icon: 'success', title: 'Mapping Complete', text: `Match ${matchCount.toLocaleString()} / ${merged.length.toLocaleString()} rows`, timer: 2000, showConfirmButton: false });
      } catch {
        Swal.fire('Error', 'เกิดข้อผิดพลาดในการรวมข้อมูล', 'error');
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  }, [file1Data, file2Data, selectedCols]);

  const downloadResult = useCallback(() => {
    if (!resultData) return;
    const ws = XLSX.utils.json_to_sheet(resultData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mapped_Data');
    XLSX.writeFile(wb, `Mapped_${fileName1.replace(/\.[^.]+$/, '')}.xlsx`);
  }, [resultData, fileName1]);

  const matchPct = stats.total > 0 ? Math.round((stats.matched / stats.total) * 100) : 0;
  const canProcess = file1Data.length > 0 && file2Data.length > 0 && selectedCols.length > 0;

  
  // RENDER
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0a0c0f] pb-24">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap');
        .font-display     { font-family: 'Syne', sans-serif; }
        .font-mono-custom { font-family: 'Space Mono', monospace; }
        @keyframes fade-up { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { opacity:0; animation: fade-up 0.55s cubic-bezier(0.16,1,0.3,1) forwards; }
        @keyframes scan { 0%{transform:translateY(-100%);opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{transform:translateY(100vh);opacity:0} }
        .scan-line { animation: scan 8s ease-in-out infinite; }
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        .spin-slow { animation: spin-slow 1s linear infinite; }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(99,102,241,0.25); border-radius:10px; }
        ::-webkit-scrollbar-thumb:hover { background:rgba(99,102,241,0.45); }
      `}</style>

      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0" />
      <div className="scan-line pointer-events-none fixed left-0 top-0 z-10 h-[2px] w-full bg-gradient-to-r from-transparent via-indigo-400/20 to-transparent" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(99,102,241,0.07),transparent)]" />

      <div className="relative z-10 mx-auto max-w-[1500px] px-6 py-10">

        {/* ── HEADER ── */}
        <header className="fade-up mb-12" style={{ animationDelay: '0ms' }}>
          <div className="mb-8 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.06]" />
            <span className="font-mono-custom text-[10px] tracking-[0.3em] text-white/25">BILLONE · OCS TOOLS</span>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <Link href="/mainocs" className="group mb-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-mono-custom text-[11px] tracking-widest text-white/40 transition-all hover:border-white/20 hover:text-white/70">
                <ArrowLeft size={12} className="transition-transform group-hover:-translate-x-0.5" /> BACK TO HUB
              </Link>
              <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-white">
                Data Mapper{' '}
                <span className="bg-gradient-to-r from-indigo-400 via-violet-300 to-indigo-400 bg-clip-text text-transparent">
                  Automation
                </span>
              </h1>
              <p className="mt-2 font-mono-custom text-[11px] text-white/30">
                Smart VLookup · MSISDN normalization · O(n) Hash Map
              </p>
            </div>
          </div>
        </header>

        {/* ── MAIN GRID ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

          {/* LEFT — Config */}
          <div className="fade-up lg:col-span-4 space-y-4" style={{ animationDelay: '80ms' }}>

            {/* Step 1: Files */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              <div className="flex items-center gap-3 border-b border-white/[0.06] px-6 py-4">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/20 font-mono-custom text-[10px] font-bold text-indigo-400 ring-1 ring-indigo-500/30">1</div>
                <span className="font-mono-custom text-[11px] tracking-[0.2em] text-white/40">FILE CONFIGURATION</span>
              </div>
              <div className="space-y-3 p-5">

                {/* Main File */}
                <FileSlot
                  label="MAIN BASE FILE"
                  accent="indigo"
                  fileName={fileName1}
                  hasData={file1Data.length > 0}
                  rowCount={file1Data.length}
                  onUpload={f => handleFileUpload(f, true)}
                  onClear={() => clearFile(true)}
                  icon={<Database size={14} />}
                />

                {/* Ref File */}
                <FileSlot
                  label="REFERENCE FILE"
                  accent="violet"
                  fileName={fileName2}
                  hasData={file2Data.length > 0}
                  rowCount={file2Data.length}
                  onUpload={f => handleFileUpload(f, false)}
                  onClear={() => clearFile(false)}
                  icon={<Filter size={14} />}
                />
              </div>
            </div>

            {/* Step 2: Columns */}
            <div className={`overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition-opacity ${availableCols.length === 0 ? 'opacity-30 pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/20 font-mono-custom text-[10px] font-bold text-indigo-400 ring-1 ring-indigo-500/30">2</div>
                  <span className="font-mono-custom text-[11px] tracking-[0.2em] text-white/40">MAP COLUMNS</span>
                </div>
                <button
                  onClick={selectAllCols}
                  className="font-mono-custom text-[10px] text-indigo-400/60 hover:text-indigo-400 transition-colors"
                >
                  {selectedCols.length === availableCols.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="max-h-[280px] overflow-y-auto p-4">
                <div className="grid grid-cols-2 gap-1.5">
                  {availableCols.map(col => {
                    const active = selectedCols.includes(col);
                    return (
                      <button
                        key={col}
                        onClick={() => toggleCol(col)}
                        className={`flex items-center justify-between gap-1.5 rounded-xl border px-3 py-2 font-mono-custom text-[10px] transition-all truncate
                          ${active ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300' : 'border-white/[0.06] bg-white/[0.03] text-white/30 hover:border-white/15 hover:text-white/50'}`}
                      >
                        <span className="truncate">{col}</span>
                        {active && <CheckCircle2 size={11} className="shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              {selectedCols.length > 0 && (
                <div className="border-t border-white/[0.06] px-5 py-3">
                  <p className="font-mono-custom text-[10px] text-white/25">
                    {selectedCols.length} column{selectedCols.length > 1 ? 's' : ''} selected
                  </p>
                </div>
              )}
            </div>

            {/* Process button */}
            <button
              disabled={!canProcess || isProcessing}
              onClick={handleProcess}
              className="relative w-full overflow-hidden rounded-xl border border-indigo-500/20 bg-indigo-500/10 py-3.5 font-mono-custom text-xs font-bold tracking-[0.2em] text-indigo-400 transition-all hover:bg-indigo-500/20 hover:border-indigo-500/40 disabled:pointer-events-none disabled:opacity-20 flex items-center justify-center gap-2"
            >
              {isProcessing
                ? <><RefreshCw size={13} className="spin-slow" /> PROCESSING...</>
                : <><Shuffle size={13} /> START MAPPING</>}
              <div className="absolute bottom-0 left-0 h-[1px] w-full bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent" />
            </button>

            {/* Info cards */}
            <div className="space-y-2">
              {[
                { icon: Database, color: 'text-indigo-400', border: 'border-indigo-500/15', bg: 'bg-indigo-500/5', title: 'MSISDN Normalize', desc: 'ตัดเลข 0 และ 66 อัตโนมัติเพื่อ match แม่นยำ' },
                { icon: Search, color: 'text-emerald-400', border: 'border-emerald-500/15', bg: 'bg-emerald-500/5', title: 'Multi-Format', desc: 'รองรับ .xlsx, .xls และ .csv ทุกรูปแบบ' },
                { icon: BarChart3, color: 'text-sky-400', border: 'border-sky-500/15', bg: 'bg-sky-500/5', title: 'O(n) Hash Map', desc: 'ประมวลผลหลักแสนแถวในเสี้ยววินาที' },
              ].map((item, i) => (
                <div key={i} className={`flex items-start gap-3 rounded-xl border ${item.border} ${item.bg} p-3.5`}>
                  <item.icon size={13} className={`${item.color} mt-0.5 shrink-0`} />
                  <div>
                    <p className={`font-mono-custom text-[10px] font-bold tracking-widest ${item.color}`}>{item.title}</p>
                    <p className="mt-0.5 font-mono-custom text-[10px] text-white/25 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — Result */}
          <div className="fade-up lg:col-span-8" style={{ animationDelay: '140ms' }}>
            {!resultData ? (
              <div className="flex h-[680px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.06] text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/20">
                  <FileSpreadsheet size={24} strokeWidth={1.5} />
                </div>
                <p className="font-display text-lg font-bold text-white/25">Waiting for Configuration</p>
                <p className="mt-1 font-mono-custom text-[11px] text-white/15">อัปโหลดไฟล์และเลือกคอลัมน์ที่ต้องการ</p>
              </div>
            ) : (
              <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 h-[680px]">
                {/* Topbar */}
                <div className="flex items-center justify-between bg-[#0d0f12] px-6 py-4 border-b border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-indigo-400">
                      <Layers size={14} />
                    </div>
                    <div>
                      <p className="font-mono-custom text-[11px] tracking-widest text-white/60">MAPPING PREVIEW</p>
                      <p className="font-mono-custom text-[10px] text-white/25">
                        {stats.total.toLocaleString()} rows · {stats.matched.toLocaleString()} matched · showing first 50
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={downloadResult}
                    className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 font-mono-custom text-[11px] tracking-widest text-emerald-400 transition-all hover:bg-emerald-500/20"
                  >
                    <Download size={12} /> EXPORT
                  </button>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto bg-[#0a0c0f]">
                  <table className="w-full border-collapse text-left">
                    <thead className="sticky top-0 z-10 bg-[#0d0f12]">
                      <tr className="border-b border-white/[0.06]">
                        {Object.keys(resultData[0]).map(col => (
                          <th key={col} className={`px-5 py-3 font-mono-custom text-[10px] tracking-[0.12em] whitespace-nowrap border-r border-white/[0.04] ${selectedCols.includes(col) ? 'text-indigo-400/70' : 'text-white/25'}`}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resultData.slice(0, 50).map((item, idx) => (
                        <tr key={idx} className="group border-b border-white/[0.04] transition-colors hover:bg-white/[0.025]">
                          {Object.entries(item).map(([col, val]: [string, any], i) => (
                            <td key={i} className={`px-5 py-2.5 font-mono-custom text-[11px] whitespace-nowrap border-r border-white/[0.03]
                              ${val === 'N/A' ? 'text-red-400/70' : selectedCols.includes(col) ? 'text-indigo-300/70' : 'text-white/40'}`}>
                              {String(val) || <span className="text-white/15">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {resultData.length > 50 && (
                    <div className="py-4 text-center font-mono-custom text-[10px] tracking-widest text-white/20 border-t border-white/[0.04]">
                      + {(resultData.length - 50).toLocaleString()} more rows · Export to view all
                    </div>
                  )}
                </div>

                {/* Footer bar */}
                <div className="flex items-center justify-between bg-[#0d0f12] px-6 py-3 border-t border-white/[0.06]">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-mono-custom text-[10px] tracking-[0.2em] text-white/25">MATCH ACCURACY</p>
                      <p className="font-display text-xl font-extrabold text-indigo-400 leading-none">{matchPct}%</p>
                    </div>
                    <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700" style={{ width: `${matchPct}%` }} />
                    </div>
                    <span className="font-mono-custom text-[10px] text-white/20">
                      {stats.matched.toLocaleString()} / {stats.total.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                    <span className="font-mono-custom text-[10px] tracking-widest text-white/20">PROCESSOR ACTIVE</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-20 border-t border-white/[0.05] pt-8 text-center">
          <p className="font-mono-custom text-[10px] tracking-[0.3em] text-white/15">
            ARM@MOS · BILLONE INTERNAL ANALYTICS SYSTEMS · © {new Date().getFullYear()}
          </p>
        </footer>
      </div>
    </div>
  );
}

// SUB-COMPONENT: FileSlot
type FileSlotProps = {
  label: string;
  accent: 'indigo' | 'violet';
  fileName: string;
  hasData: boolean;
  rowCount: number;
  onUpload: (f: File) => void;
  onClear: () => void;
  icon: React.ReactNode;
};

function FileSlot({ label, accent, fileName, hasData, rowCount, onUpload, onClear, icon }: FileSlotProps) {
  const borderActive = accent === 'indigo' ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-violet-500/30 bg-violet-500/5';
  const tagColor = accent === 'indigo' ? 'text-indigo-400 border-indigo-500/20 bg-indigo-500/10' : 'text-violet-400 border-violet-500/20 bg-violet-500/10';
  const iconColor = accent === 'indigo' ? 'text-indigo-400' : 'text-violet-400';

  return (
    <div className={`rounded-xl border-2 border-dashed p-4 transition-all duration-300 ${hasData ? borderActive : 'border-white/[0.08] bg-white/[0.02]'}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className={`rounded-md border px-2.5 py-1 font-mono-custom text-[10px] font-bold tracking-[0.15em] ${tagColor}`}>{label}</span>
        {hasData && (
          <button onClick={onClear} className="rounded-lg p-1 text-white/20 transition-all hover:bg-red-500/10 hover:text-red-400">
            <X size={12} />
          </button>
        )}
      </div>

      {hasData ? (
        <div className="flex items-center gap-2">
          <div className={`${iconColor} opacity-60`}>{icon}</div>
          <div className="min-w-0">
            <p className="truncate font-mono-custom text-[11px] text-white/60">{fileName}</p>
            <p className="font-mono-custom text-[10px] text-white/25">{rowCount.toLocaleString()} rows</p>
          </div>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center py-3 group">
          <div className={`mb-2 opacity-20 group-hover:opacity-60 transition-opacity ${iconColor}`}>{icon}</div>
          <span className="font-mono-custom text-[11px] text-white/25 group-hover:text-white/50 transition-colors">Click to select file</span>
          <span className="mt-0.5 font-mono-custom text-[10px] text-white/15">.xlsx · .xls · .csv</span>
          <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])} />
        </label>
      )}
    </div>
  );
}