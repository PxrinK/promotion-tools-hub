"use client";

import React, { useState, useMemo, useCallback, memo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Download, ArrowLeft, Search, Filter, Check, Layers, FileUp, RefreshCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface RowData {
  'Primary Offering': string | number;
  'PO': string;
  'PO STATUS': string;
  'Attached Offering': string | number;
  'SO': string;
  'SO STATUS'?: string;
  [key: string]: any;
}

interface FilterState {
  [key: string]: string[];
}

const COLUMNS = [
  { key: 'Primary Offering', label: 'Primary ID', width: '140px' },
  { key: 'PO', label: 'Primary Name', width: '260px' },
  { key: 'PO STATUS', label: 'PO Status', width: '160px' },
  { key: 'Attached Offering', label: 'Attached ID', width: '140px' },
  { key: 'SO', label: 'Attached Name', width: '260px' },
  { key: 'SO STATUS', label: 'SO Status', width: '160px' },
];

const DataRow = memo(({ row }: { row: RowData }) => {
  const isApproved = useMemo(() => {
    const s = String(row['PO STATUS']).toLowerCase();
    return s.includes('อนุมัติ') || s.includes('approved');
  }, [row]);

  return (
    <tr className="group border-b border-white/[0.04] transition-colors hover:bg-white/[0.025]">
      <td className="px-6 py-3.5 font-mono-custom text-[11px] text-white/40">{row['Primary Offering']}</td>
      <td className="px-6 py-3.5 font-mono-custom text-xs text-white/60 truncate max-w-[250px]" title={row['PO']}>{row['PO']}</td>
      <td className="px-6 py-3.5">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <div className={`h-1.5 w-1.5 rounded-full ${isApproved ? 'bg-emerald-400' : 'bg-white/20'}`} />
          <span className={`font-mono-custom text-[11px] font-bold uppercase tracking-tight ${isApproved ? 'text-emerald-400' : 'text-white/30'}`}>
            {row['PO STATUS'] || '—'}
          </span>
        </div>
      </td>
      <td className="px-6 py-3.5 font-mono-custom text-[11px] font-bold text-emerald-400/80">{row['Attached Offering']}</td>
      <td className="px-6 py-3.5 font-mono-custom text-xs text-white/60 truncate max-w-[250px]" title={row['SO']}>{row['SO']}</td>
      <td className="px-6 py-3.5">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
          <span className="font-mono-custom text-[11px] font-bold text-white/30 uppercase tracking-tight">
            {row['SO STATUS'] || '—'}
          </span>
        </div>
      </td>
    </tr>
  );
});
DataRow.displayName = 'DataRow';

export default function RelationshipManager() {
  const [rawData, setRawData] = useState<RowData[]>([]);
  const [filters, setFilters] = useState<FilterState>({});
  const [activeFilterDropdown, setActiveFilterDropdown] = useState<string | null>(null);
  const [localSearch, setLocalSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
        ctx.fillStyle = `rgba(52,211,153,${0.04 + p * 0.06})`; ctx.fill();
      }
      frame++; requestAnimationFrame(draw);
    };
    draw(); return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setActiveFilterDropdown(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary', cellDates: true });
        const data = XLSX.utils.sheet_to_json<RowData>(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        setRawData(data); setFilters({});
      } catch { alert('เกิดข้อผิดพลาดในการอ่านไฟล์'); }
    };
    reader.readAsBinaryString(file);
  }, []);

  const handleReset = useCallback(() => {
    setFilters({}); setRawData([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const filteredData = useMemo(() =>
    Object.keys(filters).length === 0 ? rawData :
      rawData.filter(row => Object.entries(filters).every(([key, vals]) =>
        vals.length === 0 || vals.includes(String(row[key]))
      )), [rawData, filters]);

  const columnUniqueValues = useMemo(() => {
    if (!rawData.length) return {} as Record<string, string[]>;
    const setMap = new Map<string, Set<string>>(COLUMNS.map(c => [c.key, new Set()]));
    for (const row of rawData)
      COLUMNS.forEach(col => { const v = row[col.key]; if (v !== undefined && v !== null && v !== '') setMap.get(col.key)?.add(String(v)); });
    return Object.fromEntries(COLUMNS.map(col => [col.key, Array.from(setMap.get(col.key) || []).sort()]));
  }, [rawData]);

  const toggleFilterValue = useCallback((columnKey: string, value: string) => {
    setFilters(prev => {
      const cur = prev[columnKey] || [];
      return { ...prev, [columnKey]: cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value] };
    });
  }, []);

  const applyExcelStyles = (ws: any) => {
    for (const ref in ws) {
      if (['!ref', '!cols', '!rows'].includes(ref)) continue;
      ws[ref].s = { font: { name: 'Calibri', size: 11 }, alignment: { horizontal: 'left', vertical: 'center' } };
    }
  };

  const handleExport = useCallback(() => {
    if (!filteredData.length) return;
    const wb = XLSX.utils.book_new();
    const primaryId = filters['Primary Offering']?.[0] || filteredData[0]['Primary Offering'] || 'Data';

    const wsDependent = XLSX.utils.aoa_to_sheet([['Master Id', 'Master Name', 'Slave Id', 'Slave Name', 'Relation Type', 'Control Flag']]);
    applyExcelStyles(wsDependent);
    XLSX.utils.book_append_sheet(wb, wsDependent, 'Dependent');

    const wsAttached = XLSX.utils.json_to_sheet(filteredData.map(row => ({
      'Depended By ID': String(row['Primary Offering']),
      'Depended By Name': row['PO'],
      'Depend Id': String(row['Attached Offering']),
      'Depend Name': row['SO'],
      'Relation Type': 'O',
    })));
    applyExcelStyles(wsAttached);
    XLSX.utils.book_append_sheet(wb, wsAttached, 'Attached');

    const wsReplacement = XLSX.utils.aoa_to_sheet([['Offering Id', 'Offering Name', 'Replace Offering Id', 'Replace Offering Name', 'Replace Type', 'Replace Rule', 'Effect Mode', 'Contract Continue', 'Plan']]);
    applyExcelStyles(wsReplacement);
    XLSX.utils.book_append_sheet(wb, wsReplacement, 'Replacement');

    XLSX.writeFile(wb, `ALLRelations_${primaryId}.xlsx`);
  }, [filteredData, filters]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0a0c0f]">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap');
        .font-display     { font-family: 'Syne', sans-serif; }
        .font-mono-custom { font-family: 'Space Mono', monospace; }
        @keyframes fade-up { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { opacity:0; animation: fade-up 0.5s cubic-bezier(0.16,1,0.3,1) forwards; }
        @keyframes scan { 0%{transform:translateY(-100%);opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{transform:translateY(100vh);opacity:0} }
        .scan-line { animation: scan 8s ease-in-out infinite; }
        @keyframes scale-in { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
        .scale-in { animation: scale-in 0.18s cubic-bezier(0.16,1,0.3,1) forwards; }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(52,211,153,0.2); border-radius:10px; }
        ::-webkit-scrollbar-thumb:hover { background:rgba(52,211,153,0.4); }
      `}</style>

      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0" />
      <div className="scan-line pointer-events-none fixed left-0 top-0 z-10 h-[2px] w-full bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(16,185,129,0.06),transparent)]" />

      <div className="relative z-10 mx-auto max-w-[1600px] px-6 py-10">

        {/* HEADER */}
        <header className="fade-up mb-10" style={{ animationDelay: '0ms' }}>
          <div className="mb-8 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.06]" />
            <span className="font-mono-custom text-[10px] tracking-[0.3em] text-white/25">BILLONE · OCS TOOLS</span>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <Link href="/mainocs" className="group mb-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-mono-custom text-[11px] tracking-widest text-white/40 transition-all hover:border-white/20 hover:text-white/70">
                <ArrowLeft size={12} className="transition-transform group-hover:-translate-x-0.5" /> BACK TO HUB
              </Link>
              <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-white">
                Relationship{' '}
                <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">Manager</span>
              </h1>
              <p className="mt-2 font-mono-custom text-[11px] text-white/30">
                Import Excel · Filter · Export 3-Sheet OCS config
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={handleReset} className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-mono-custom text-[11px] tracking-widest text-white/35 transition-all hover:border-white/20 hover:text-white/60">
                <RefreshCcw size={12} /> RESET
              </button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".xlsx,.xls" />
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-mono-custom text-[11px] tracking-widest text-white/50 transition-all hover:border-white/25 hover:text-white/80">
                <FileUp size={12} /> IMPORT
              </button>
              <button
                onClick={handleExport}
                disabled={filteredData.length === 0}
                className="relative flex items-center gap-1.5 overflow-hidden rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-2.5 font-mono-custom text-[11px] tracking-widest text-emerald-400 transition-all hover:bg-emerald-500/20 disabled:pointer-events-none disabled:opacity-20"
              >
                <Download size={12} /> EXPORT
                <div className="absolute bottom-0 left-0 h-[1px] w-full bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
              </button>
            </div>
          </div>
        </header>

        {/* STATUS BAR */}
        <div className="fade-up mb-6 flex gap-4" style={{ animationDelay: '80ms' }}>
          <div className={`flex flex-1 items-center gap-4 rounded-2xl border p-5 transition-all duration-300 ${rawData.length > 0 ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-white/[0.06] bg-white/[0.03]'}`}>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${rawData.length > 0 ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-amber-500/20 bg-amber-500/10 text-amber-400'}`}>
              {rawData.length > 0 ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            </div>
            <div>
              <p className="font-mono-custom text-[10px] tracking-[0.2em] text-white/25">PROMOTION LOGIC STATUS</p>
              <p className={`mt-0.5 font-mono-custom text-sm font-bold ${rawData.length > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {rawData.length > 0 ? 'Imported and verified successfully' : 'Waiting for file import...'}
              </p>
            </div>
          </div>
          <div className="flex w-56 flex-col justify-center rounded-2xl border border-white/[0.06] bg-[#0d0f12] px-6 py-4 text-right">
            <p className="font-mono-custom text-[10px] tracking-[0.2em] text-white/25">FILTERED ITEMS</p>
            <p className="font-display text-3xl font-extrabold text-emerald-400 tracking-tighter mt-0.5">
              {filteredData.length.toLocaleString()}
            </p>
          </div>
        </div>

        {/* TABLE */}
        <div className="fade-up overflow-hidden rounded-2xl border border-white/10" style={{ animationDelay: '140ms' }}>
          <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
            <table className="w-full border-collapse table-fixed text-left" style={{ minWidth: '1100px' }}>
              <thead className="sticky top-0 z-20 bg-[#0d0f12]">
                <tr className="border-b border-white/[0.06]">
                  {COLUMNS.map(col => (
                    <th key={col.key} style={{ width: col.width }} className="relative px-6 py-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono-custom text-[10px] tracking-[0.2em] text-white/30">{col.label}</span>
                        <button
                          onClick={() => { setActiveFilterDropdown(activeFilterDropdown === col.key ? null : col.key); setLocalSearch(''); }}
                          className={`rounded-lg p-1.5 transition-all ${filters[col.key]?.length > 0 ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30' : 'text-white/20 hover:bg-white/5 hover:text-white/50'}`}
                        >
                          <Filter size={10} />
                        </button>
                      </div>

                      {activeFilterDropdown === col.key && (
                        <div ref={dropdownRef} className="scale-in absolute right-4 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-white/10 bg-[#0d0f12] shadow-2xl shadow-black/50">
                          <div className="p-3 border-b border-white/[0.06]">
                            <div className="relative">
                              <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
                              <input
                                autoFocus
                                type="text"
                                placeholder="Search..."
                                className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 font-mono-custom text-[11px] text-white/50 outline-none placeholder:text-white/20 focus:border-emerald-500/30"
                                value={localSearch}
                                onChange={e => setLocalSearch(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="max-h-48 overflow-y-auto p-2 space-y-0.5">
                            {(columnUniqueValues[col.key] || [])
                              .filter(opt => opt.toLowerCase().includes(localSearch.toLowerCase()))
                              .map(val => (
                                <div key={val} onClick={() => toggleFilterValue(col.key, val)} className="flex cursor-pointer items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-white/5">
                                  <div className={`flex h-3.5 w-3.5 items-center justify-center rounded border transition-all ${filters[col.key]?.includes(val) ? 'border-emerald-500 bg-emerald-500' : 'border-white/20'}`}>
                                    {filters[col.key]?.includes(val) && <Check size={9} className="text-white" strokeWidth={3} />}
                                  </div>
                                  <span className="font-mono-custom text-[11px] text-white/50 truncate">{val}</span>
                                </div>
                              ))}
                            {!(columnUniqueValues[col.key] || []).filter(opt => opt.toLowerCase().includes(localSearch.toLowerCase())).length && (
                              <p className="py-3 text-center font-mono-custom text-[11px] text-white/20 italic">No options found</p>
                            )}
                          </div>
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-[#0a0c0f]">
                {filteredData.length > 0 ? (
                  filteredData.slice(0, 200).map((row, idx) => <DataRow key={idx} row={row} />)
                ) : (
                  <tr>
                    <td colSpan={6} className="py-28 text-center">
                      <div className="flex flex-col items-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/20">
                          <Layers size={24} strokeWidth={1.5} />
                        </div>
                        <p className="font-display text-base font-bold text-white/25">No Records Available</p>
                        <p className="mt-1 font-mono-custom text-[11px] text-white/15 max-w-xs text-center">
                          Import an Excel file to start managing promotion relationships
                        </p>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-2.5 font-mono-custom text-[11px] tracking-widest text-emerald-400 transition-all hover:bg-emerald-500/20"
                        >
                          <FileUp size={12} /> IMPORT FILE
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="mt-16 border-t border-white/[0.05] pt-8 text-center">
          <p className="font-mono-custom text-[10px] tracking-[0.3em] text-white/15">
            ARM@MOS · BILLONE INTERNAL ANALYTICS SYSTEMS · © {new Date().getFullYear()}
          </p>
        </footer>
      </div>
    </div>
  );
}