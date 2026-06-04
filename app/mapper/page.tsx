'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import ExcelJS from 'exceljs';

type Mode = 'single' | 'dual';

interface ColMapping {
  id: number;
  from: string;
  to: string;
}

interface ClearCol {
  id: number;
  name: string;
}

interface HeaderGroup {
  cols: string;
  color: string;
}

interface PreviewRow {
  cells: { val: string; type: 'normal' | 'mapped' | 'cleared' }[];
}

interface Stats {
  totalRows: number;
  refSize: number;
  mappingCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loadWorkbook(file: File): Promise<ExcelJS.Workbook> {
  const ab = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(ab);
  return wb;
}

function getHeaders(sheet: ExcelJS.Worksheet): string[] {
  const h: string[] = [];
  sheet.getRow(1).eachCell((cell, i) => {
    h[i] = cell.value ? String(cell.value).trim() : '';
  });
  return h;
}

function buildRefMap(sheet: ExcelJS.Worksheet, keyCol: string): Map<string, Record<string, any>> {
  const map = new Map<string, Record<string, any>>();
  const headers = getHeaders(sheet);
  sheet.eachRow((row, rn) => {
    if (rn === 1) return;
    const rd: Record<string, any> = {};
    row.eachCell((cell, i) => { if (headers[i]) rd[headers[i]] = cell.value; });
    if (rd[keyCol]) map.set(String(rd[keyCol]).trim(), rd);
  });
  return map;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function UploadZone({ label, icon, fileName, onChange, disabled }: {
  label: string; icon: string; fileName: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; disabled?: boolean;
}) {
  return (
    <div className="ocs-upload-zone">
      <div className="ocs-upload-icon">{icon}</div>
      <div className="ocs-upload-label">{label}</div>
      {fileName && <div className="ocs-upload-filename">{fileName}</div>}
      <input type="file" accept=".xlsx" onChange={onChange} disabled={disabled} />
    </div>
  );
}

function ColMappingRow({ row, onChange, onRemove }: {
  row: ColMapping;
  onChange: (id: number, field: 'from' | 'to', val: string) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <div className="ocs-map-row">
      <input
        type="text"
        className="ocs-input"
        placeholder="คอลัมน์ใน Ref"
        value={row.from}
        onChange={e => onChange(row.id, 'from', e.target.value)}
      />
      <span className="ocs-arrow">→</span>
      <input
        type="text"
        className="ocs-input"
        placeholder="คอลัมน์ใน Main"
        value={row.to}
        onChange={e => onChange(row.id, 'to', e.target.value)}
      />
      <button className="ocs-btn-remove" onClick={() => onRemove(row.id)} aria-label="ลบ">✕</button>
    </div>
  );
}

function ClearColRow({ row, onChange, onRemove }: {
  row: ClearCol;
  onChange: (id: number, val: string) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <div className="ocs-map-row">
      <input
        type="text"
        className="ocs-input"
        placeholder="ชื่อคอลัมน์ที่ต้องล้างค่า"
        value={row.name}
        onChange={e => onChange(row.id, e.target.value)}
        style={{ gridColumn: 'span 3' }}
      />
      <button className="ocs-btn-remove" onClick={() => onRemove(row.id)} aria-label="ลบ">✕</button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ExcelMapperPro() {
  const [mode, setMode] = useState<Mode>('single');

  const [wbSingle, setWbSingle] = useState<ExcelJS.Workbook | null>(null);
  const [wbMain, setWbMain] = useState<ExcelJS.Workbook | null>(null);
  const [wbRef, setWbRef] = useState<ExcelJS.Workbook | null>(null);

  const [fnameSingle, setFnameSingle] = useState('');
  const [fnameMain, setFnameMain] = useState('');
  const [fnameRef, setFnameRef] = useState('');

  const [sheetsSingle, setSheetsSingle] = useState<string[]>([]);
  const [sheetsMain, setSheetsMain] = useState<string[]>([]);
  const [sheetsRef, setSheetsRef] = useState<string[]>([]);
  const [selSrc, setSelSrc] = useState('');
  const [selRef, setSelRef] = useState('');
  const [selMainSheet, setSelMainSheet] = useState('');
  const [selRefSheet, setSelRefSheet] = useState('');

  const [keyMain, setKeyMain] = useState('MSISDN');
  const [keyRef, setKeyRef] = useState('MSISDN');

  const [colMappings, setColMappings] = useState<ColMapping[]>([
    { id: 1, from: 'Service type', to: 'Service type' },
    { id: 2, from: 'Status', to: 'Status' },
    { id: 3, from: 'PO', to: 'PO' },
  ]);

  const [clearCols, setClearCols] = useState<ClearCol[]>([
    { id: 1, name: 'SERVICE_INACTIVE_DT' },
  ]);

  const [doStyle, setDoStyle] = useState(true);
  const [group1, setGroup1] = useState<HeaderGroup>({ cols: 'BA,MSISDN,SERVICE_ACTIVE_DT,SERVICE_INACTIVE_DT', color: '#D9E1F2' });
  const [group2, setGroup2] = useState<HeaderGroup>({ cols: 'Service type,Status,PO', color: '#FFFF00' });

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ msg: string; type: 'ok' | 'err' | 'info' } | null>(null);
  const [preview, setPreview] = useState<{ headers: string[]; rows: PreviewRow[]; stats: Stats } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nextId = useRef(100);
  const newId = () => ++nextId.current;

  // ─── Dot grid canvas (matching OCS Hub) ──────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    let frame = 0;
    let raf: number;
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
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(raf); };
  }, []);

  // ─── File handlers ───────────────────────────────────────────────────────

  const handleFileSingle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setFnameSingle(file.name);
    const wb = await loadWorkbook(file);
    const names = wb.worksheets.map(ws => ws.name);
    setSheetsSingle(names);
    setSelSrc(names[0] ?? '');
    setSelRef(names[1] ?? names[0] ?? '');
    setWbSingle(wb);
  };

  const handleFileMain = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setFnameMain(file.name);
    const wb = await loadWorkbook(file);
    const names = wb.worksheets.map(ws => ws.name);
    setSheetsMain(names);
    setSelMainSheet(names[0] ?? '');
    setWbMain(wb);
  };

  const handleFileRef = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setFnameRef(file.name);
    const wb = await loadWorkbook(file);
    const names = wb.worksheets.map(ws => ws.name);
    setSheetsRef(names);
    setSelRefSheet(names[0] ?? '');
    setWbRef(wb);
  };

  // ─── Col mapping handlers ─────────────────────────────────────────────────

  const addMapRow = () => setColMappings(prev => [...prev, { id: newId(), from: '', to: '' }]);
  const removeMapRow = (id: number) => setColMappings(prev => prev.filter(r => r.id !== id));
  const updateMapRow = (id: number, field: 'from' | 'to', val: string) =>
    setColMappings(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));

  const addClearRow = () => setClearCols(prev => [...prev, { id: newId(), name: '' }]);
  const removeClearRow = (id: number) => setClearCols(prev => prev.filter(r => r.id !== id));
  const updateClearRow = (id: number, val: string) =>
    setClearCols(prev => prev.map(r => r.id === id ? { ...r, name: val } : r));

  // ─── Active sheets ────────────────────────────────────────────────────────

  const getSheets = useCallback(() => {
    if (mode === 'single') {
      if (!wbSingle) return null;
      const src = wbSingle.getWorksheet(selSrc);
      const ref = wbSingle.getWorksheet(selRef);
      if (!src || !ref) return null;
      return { srcSheet: src, refSheet: ref, wb: wbSingle };
    } else {
      if (!wbMain || !wbRef) return null;
      const src = wbMain.getWorksheet(selMainSheet);
      const ref = wbRef.getWorksheet(selRefSheet);
      if (!src || !ref) return null;
      return { srcSheet: src, refSheet: ref, wb: wbMain };
    }
  }, [mode, wbSingle, wbMain, wbRef, selSrc, selRef, selMainSheet, selRefSheet]);

  const isReady = mode === 'single' ? !!wbSingle : (!!wbMain && !!wbRef);

  // ─── Preview ──────────────────────────────────────────────────────────────

  const buildPreview = useCallback(() => {
    const sheets = getSheets();
    if (!sheets) return;
    const { srcSheet, refSheet } = sheets;

    const validMappings = colMappings.filter(m => m.from && m.to);
    const validClear = clearCols.map(c => c.name).filter(Boolean);
    const srcHeaders = getHeaders(srcSheet);
    const refMap = buildRefMap(refSheet, keyRef.trim());
    const keyMainIdx = srcHeaders.indexOf(keyMain.trim());
    const clearIdxs = validClear.map(c => srcHeaders.indexOf(c)).filter(x => x !== -1);
    const mapIdxs = validMappings.map(m => ({ from: m.from, toIdx: srcHeaders.indexOf(m.to) })).filter(x => x.toIdx !== -1);

    const previewRows: PreviewRow[] = [];
    let totalRows = 0;
    srcSheet.eachRow((row, rn) => {
      if (rn === 1) return;
      totalRows++;
      if (previewRows.length >= 5) return;
      const keyVal = row.getCell(keyMainIdx).value;
      const match = refMap.get(String(keyVal ?? '').trim());
      const cells = srcHeaders.slice(1).map((_, i) => {
        const ci = i + 1;
        if (clearIdxs.includes(ci)) return { val: '(ล้าง)', type: 'cleared' as const };
        const mapInfo = mapIdxs.find(m => m.toIdx === ci);
        if (mapInfo && match) return { val: String(match[mapInfo.from] ?? ''), type: 'mapped' as const };
        const v = row.getCell(ci).value;
        return { val: v != null ? String(v) : '', type: 'normal' as const };
      });
      previewRows.push({ cells });
    });

    setPreview({
      headers: srcHeaders.slice(1),
      rows: previewRows,
      stats: { totalRows, refSize: refMap.size, mappingCount: validMappings.length },
    });
  }, [getSheets, colMappings, clearCols, keyMain, keyRef]);

  // ─── Process & Export ─────────────────────────────────────────────────────

  const runProcess = async () => {
    const sheets = getSheets();
    if (!sheets) return;
    setLoading(true);
    setStatus({ msg: 'กำลังประมวลผล...', type: 'info' });

    try {
      const { srcSheet, refSheet, wb } = sheets;
      const validMappings = colMappings.filter(m => m.from && m.to);
      const validClear = clearCols.map(c => c.name).filter(Boolean);
      const srcHeaders = getHeaders(srcSheet);
      const refMap = buildRefMap(refSheet, keyRef.trim());
      const keyMainIdx = srcHeaders.indexOf(keyMain.trim());
      const clearIdxs = validClear.map(c => srcHeaders.indexOf(c)).filter(x => x !== -1);
      const mapIdxs = validMappings.map(m => ({ from: m.from, toIdx: srcHeaders.indexOf(m.to) })).filter(x => x.toIdx !== -1);

      let mapped = 0;
      srcSheet.eachRow((row, rn) => {
        if (rn === 1) return;
        const keyVal = row.getCell(keyMainIdx).value;
        const match = refMap.get(String(keyVal ?? '').trim());
        clearIdxs.forEach(ci => { row.getCell(ci).value = ''; });
        if (match) {
          mapped++;
          mapIdxs.forEach(m => { row.getCell(m.toIdx).value = match[m.from] ?? ''; });
        }
      });

      if (doStyle) {
        const hrow = srcSheet.getRow(1);
        hrow.height = 26;
        const g1cols = group1.cols.split(',').map(x => x.trim());
        const g2cols = group2.cols.split(',').map(x => x.trim());
        const g1argb = 'FF' + group1.color.replace('#', '');
        const g2argb = 'FF' + group2.color.replace('#', '');
        srcHeaders.forEach((h, i) => {
          if (!i) return;
          const cell = hrow.getCell(i);
          cell.font = { name: 'Cordia New', size: 14, bold: true, color: { argb: 'FF000000' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          if (g1cols.includes(h)) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: g1argb } };
          else if (g2cols.includes(h)) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: g2argb } };
        });
      }

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Mapped_${Date.now()}.xlsx`; a.click();
      URL.revokeObjectURL(url);
      setStatus({ msg: `สำเร็จ! Map ข้อมูล ${mapped} แถว`, type: 'ok' });
    } catch (e: any) {
      setStatus({ msg: 'เกิดข้อผิดพลาด: ' + e.message, type: 'err' });
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="ocs-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap');

        /* ── Reset & Root ── */
        .ocs-root {
          font-family: 'Space Mono', 'Sarabun', monospace;
          background: #0a0c0f;
          color: #e2e8f0;
          min-height: 100vh;
          position: relative;
          overflow: hidden;
        }

        /* ── Canvas bg ── */
        .ocs-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 0;
        }

        /* ── Scan line ── */
        @keyframes ocs-scan {
          0%   { transform: translateY(-100%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        .ocs-scan {
          position: fixed;
          left: 0; top: 0;
          height: 2px; width: 100%;
          background: linear-gradient(90deg, transparent, rgba(52,211,153,0.18), transparent);
          animation: ocs-scan 8s ease-in-out infinite;
          pointer-events: none;
          z-index: 1;
        }

        /* ── Vignette ── */
        .ocs-vignette {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(16,185,129,0.06), transparent);
        }

        /* ── Page wrapper ── */
        .ocs-page {
          position: relative; z-index: 2;
          max-width: 720px;
          margin: 0 auto;
          padding: 2.5rem 1.25rem 4rem;
        }

        /* ── Page header ── */
        @keyframes ocs-fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ocs-page-header {
          margin-bottom: 2.5rem;
          text-align: center;
          animation: ocs-fade-up 0.6s cubic-bezier(0.16,1,0.3,1) forwards;
        }
        .ocs-module-tag {
          display: inline-block;
          border: 1px solid rgba(52,211,153,0.3);
          background: rgba(52,211,153,0.08);
          color: #34d399;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.25em;
          padding: 5px 14px;
          border-radius: 99px;
          margin-bottom: 1rem;
        }
        .ocs-page-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(1.8rem, 5vw, 2.8rem);
          font-weight: 800;
          line-height: 1;
          color: #fff;
          margin: 0 0 .5rem;
        }
        .ocs-page-title span {
          background: linear-gradient(90deg, #34d399, #2dd4bf);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .ocs-page-sub {
          font-size: 12px;
          color: rgba(255,255,255,0.35);
          letter-spacing: 0.03em;
        }

        /* ── Top divider ── */
        .ocs-divider-top {
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 2rem;
        }
        .ocs-divider-top span {
          font-size: 10px; letter-spacing: 0.3em;
          color: rgba(255,255,255,0.2);
          white-space: nowrap;
        }
        .ocs-divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.08); }

        /* ── Card ── */
        .ocs-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 1.25rem 1.5rem;
          margin-bottom: 1rem;
          backdrop-filter: blur(4px);
          position: relative;
          overflow: hidden;
          transition: border-color 0.3s;
        }
        .ocs-card::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0;
          height: 2px; width: 0;
          background: linear-gradient(90deg, #34d399, #2dd4bf);
          transition: width 0.4s ease;
        }
        .ocs-card:hover { border-color: rgba(255,255,255,0.18); }
        .ocs-card:hover::after { width: 100%; }

        /* Card title */
        .ocs-card-title {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.25em;
          color: rgba(255,255,255,0.35);
          text-transform: uppercase;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Emerald tag inside title */
        .ocs-tag {
          border: 1px solid rgba(52,211,153,0.3);
          background: rgba(52,211,153,0.1);
          color: #34d399;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.2em;
          padding: 2px 8px;
          border-radius: 4px;
          text-transform: uppercase;
        }

        /* ── Mode tabs ── */
        .ocs-tabs { display: flex; gap: 8px; margin-bottom: 1.25rem; }
        .ocs-tab {
          flex: 1;
          padding: 9px 14px;
          font-size: 11px;
          font-family: 'Space Mono', monospace;
          font-weight: 700;
          letter-spacing: 0.08em;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          cursor: pointer;
          background: transparent;
          color: rgba(255,255,255,0.35);
          transition: all 0.2s;
        }
        .ocs-tab:hover { border-color: rgba(52,211,153,0.3); color: rgba(255,255,255,0.6); }
        .ocs-tab.active {
          border-color: rgba(52,211,153,0.5);
          background: rgba(52,211,153,0.1);
          color: #34d399;
        }

        /* ── Upload zone ── */
        .ocs-upload-zone {
          border: 1.5px dashed rgba(255,255,255,0.12);
          border-radius: 10px;
          padding: 1.25rem;
          text-align: center;
          cursor: pointer;
          position: relative;
          transition: all 0.2s;
          background: rgba(255,255,255,0.02);
        }
        .ocs-upload-zone:hover {
          border-color: rgba(52,211,153,0.4);
          background: rgba(52,211,153,0.04);
        }
        .ocs-upload-zone input[type=file] {
          position: absolute; inset: 0;
          opacity: 0; cursor: pointer; width: 100%; height: 100%;
        }
        .ocs-upload-icon { font-size: 24px; margin-bottom: 6px; }
        .ocs-upload-label { font-size: 11px; color: rgba(255,255,255,0.3); letter-spacing: 0.05em; }
        .ocs-upload-filename {
          font-size: 11px; font-weight: 700;
          color: #34d399; margin-top: 5px;
          letter-spacing: 0.05em;
        }

        /* ── Grid ── */
        .ocs-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

        /* ── Field label ── */
        .ocs-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.2em;
          color: rgba(255,255,255,0.3);
          text-transform: uppercase;
          margin-bottom: 5px;
        }

        /* ── Inputs ── */
        .ocs-input, .ocs-select {
          width: 100%;
          padding: 8px 11px;
          font-size: 12px;
          font-family: 'Space Mono', monospace;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          background: rgba(255,255,255,0.04);
          color: #e2e8f0;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
          box-sizing: border-box;
        }
        .ocs-input::placeholder { color: rgba(255,255,255,0.2); }
        .ocs-input:focus, .ocs-select:focus {
          border-color: rgba(52,211,153,0.5);
          background: rgba(52,211,153,0.04);
        }
        .ocs-select option { background: #0f1117; color: #e2e8f0; }

        /* ── Map rows ── */
        .ocs-map-row {
          display: grid;
          grid-template-columns: 1fr auto 1fr auto;
          gap: 8px;
          align-items: center;
          margin-bottom: 6px;
        }
        .ocs-arrow { font-size: 13px; color: rgba(52,211,153,0.5); }
        .ocs-btn-remove {
          background: transparent;
          border: 1px solid transparent;
          cursor: pointer;
          color: rgba(255,255,255,0.2);
          font-size: 12px;
          padding: 5px 7px;
          border-radius: 6px;
          transition: all 0.15s;
          line-height: 1;
        }
        .ocs-btn-remove:hover {
          color: #f87171;
          border-color: rgba(248,113,113,0.3);
          background: rgba(248,113,113,0.08);
        }

        /* ── Add button ── */
        .ocs-btn-add {
          width: 100%;
          padding: 8px;
          font-size: 10px;
          font-family: 'Space Mono', monospace;
          font-weight: 700;
          letter-spacing: 0.15em;
          border: 1px dashed rgba(255,255,255,0.12);
          border-radius: 8px;
          background: transparent;
          color: rgba(255,255,255,0.25);
          cursor: pointer;
          margin-top: 6px;
          transition: all 0.2s;
        }
        .ocs-btn-add:hover {
          border-color: rgba(52,211,153,0.4);
          color: #34d399;
          background: rgba(52,211,153,0.04);
        }

        /* ── Color input ── */
        .ocs-color-row { display: grid; grid-template-columns: 1fr 44px; gap: 8px; align-items: end; }
        input[type=color].ocs-color-picker {
          width: 44px; height: 36px;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 2px;
          cursor: pointer;
          background: rgba(255,255,255,0.04);
        }

        /* ── Checkbox ── */
        .ocs-check-row {
          display: flex; align-items: center; gap: 10px;
          font-size: 12px;
          color: rgba(255,255,255,0.5);
          cursor: pointer;
          margin-bottom: 1rem;
          letter-spacing: 0.04em;
        }
        input[type=checkbox] { accent-color: #34d399; width: 14px; height: 14px; cursor: pointer; }

        /* ── Stats ── */
        .ocs-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 1rem; }
        .ocs-stat {
          background: rgba(52,211,153,0.06);
          border: 1px solid rgba(52,211,153,0.15);
          border-radius: 10px;
          padding: .875rem 1rem;
          text-align: center;
        }
        .ocs-stat-val {
          font-family: 'Syne', sans-serif;
          font-size: 24px;
          font-weight: 800;
          color: #34d399;
          line-height: 1;
        }
        .ocs-stat-lbl {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.2em;
          color: rgba(255,255,255,0.25);
          text-transform: uppercase;
          margin-top: 4px;
        }

        /* ── Preview table ── */
        .ocs-preview-scroll { overflow-x: auto; }
        .ocs-preview-scroll table {
          width: 100%; border-collapse: collapse; font-size: 11px;
        }
        .ocs-preview-scroll th {
          background: rgba(255,255,255,0.04);
          padding: 7px 10px;
          text-align: left;
          font-weight: 700;
          font-size: 9px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.3);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          white-space: nowrap;
        }
        .ocs-preview-scroll td {
          padding: 6px 10px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.6);
          white-space: nowrap;
          font-size: 11px;
        }
        .ocs-cell-mapped {
          background: rgba(52,211,153,0.08);
          color: #34d399;
          font-weight: 700;
        }
        .ocs-cell-cleared {
          background: rgba(251,191,36,0.07);
          color: #fbbf24;
          font-style: italic;
        }

        /* ── Run button ── */
        .ocs-btn-run {
          width: 100%;
          padding: 14px;
          font-size: 12px;
          font-family: 'Space Mono', monospace;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          background: transparent;
          color: #34d399;
          border: 1px solid rgba(52,211,153,0.4);
          border-radius: 10px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: all 0.3s;
          margin-top: .5rem;
        }
        .ocs-btn-run::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(52,211,153,0.12), rgba(45,212,191,0.08));
          opacity: 0;
          transition: opacity 0.3s;
        }
        .ocs-btn-run:hover:not(:disabled)::before { opacity: 1; }
        .ocs-btn-run:hover:not(:disabled) {
          border-color: rgba(52,211,153,0.7);
          box-shadow: 0 0 24px rgba(52,211,153,0.15);
        }
        .ocs-btn-run:disabled { opacity: 0.3; cursor: not-allowed; }
        .ocs-btn-run-inner { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; gap: 8px; }

        /* ── Status bar ── */
        .ocs-status {
          margin-top: .75rem;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .ocs-status-ok   { background: rgba(52,211,153,0.1);  color: #34d399; border: 1px solid rgba(52,211,153,0.3); }
        .ocs-status-err  { background: rgba(248,113,113,0.1); color: #f87171; border: 1px solid rgba(248,113,113,0.3); }
        .ocs-status-info { background: rgba(96,165,250,0.1);  color: #60a5fa; border: 1px solid rgba(96,165,250,0.3); }

        /* ── Footer ── */
        .ocs-footer {
          margin-top: 3rem;
          border-top: 1px solid rgba(255,255,255,0.06);
          padding-top: 1.5rem;
          text-align: center;
        }
        .ocs-footer p {
          font-size: 9px;
          letter-spacing: 0.25em;
          color: rgba(255,255,255,0.12);
          text-transform: uppercase;
        }
        .ocs-dot {
          display: inline-block;
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #34d399;
          margin: 0 6px;
          vertical-align: middle;
        }

        /* ── Section sub-label ── */
        .ocs-sub-label {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.2);
          margin: .875rem 0 .5rem;
        }
      `}</style>

      {/* Animated dot grid */}
      <canvas ref={canvasRef} className="ocs-canvas" />

      {/* Scan line */}
      <div className="ocs-scan" />

      {/* Vignette */}
      <div className="ocs-vignette" />

      <div className="ocs-page">

        {/* ── Page header ── */}
        <div className="ocs-page-header">
          <div className="ocs-module-tag">MAP · MODULE 05</div>
          <h1 className="ocs-page-title">
            Data <span>Mapper</span> Pro
          </h1>
          <p className="ocs-page-sub">Map คอลัมน์ข้ามชีทหรือข้ามไฟล์ได้อิสระ · กำหนดทุกอย่างได้เอง</p>
        </div>

        {/* top divider */}
        <div className="ocs-divider-top">
          <div className="ocs-divider-line" />
          <span>CONFIG</span>
          <div className="ocs-divider-line" />
        </div>

        {/* ── Mode card ── */}
        <div className="ocs-card">
          <div className="ocs-card-title">
            FILE MODE
            <span className="ocs-tag">REQUIRED</span>
          </div>
          <div className="ocs-tabs">
            <button className={`ocs-tab ${mode === 'single' ? 'active' : ''}`} onClick={() => setMode('single')}>
              📄 ไฟล์เดียว · 2 sheet
            </button>
            <button className={`ocs-tab ${mode === 'dual' ? 'active' : ''}`} onClick={() => setMode('dual')}>
              📂 2 ไฟล์แยกกัน
            </button>
          </div>

          {mode === 'single' ? (
            <>
              <UploadZone label="คลิกหรือลากไฟล์ .xlsx มาวางที่นี่" icon="📊" fileName={fnameSingle} onChange={handleFileSingle} />
              {sheetsSingle.length > 0 && (
                <div className="ocs-grid2" style={{ marginTop: '10px' }}>
                  <div>
                    <div className="ocs-label">Sheet ต้นทาง</div>
                    <select className="ocs-select" value={selSrc} onChange={e => setSelSrc(e.target.value)}>
                      {sheetsSingle.map(n => <option key={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="ocs-label">Sheet อ้างอิง</div>
                    <select className="ocs-select" value={selRef} onChange={e => setSelRef(e.target.value)}>
                      {sheetsSingle.map(n => <option key={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="ocs-grid2">
              <div>
                <div className="ocs-label">ไฟล์หลัก (ปลายทาง)</div>
                <UploadZone label="ไฟล์หลัก .xlsx" icon="📋" fileName={fnameMain} onChange={handleFileMain} />
                {sheetsMain.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <div className="ocs-label">Sheet</div>
                    <select className="ocs-select" value={selMainSheet} onChange={e => setSelMainSheet(e.target.value)}>
                      {sheetsMain.map(n => <option key={n}>{n}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <div className="ocs-label">ไฟล์อ้างอิง (ต้นทาง)</div>
                <UploadZone label="ไฟล์อ้างอิง .xlsx" icon="🗂️" fileName={fnameRef} onChange={handleFileRef} />
                {sheetsRef.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <div className="ocs-label">Sheet</div>
                    <select className="ocs-select" value={selRefSheet} onChange={e => setSelRefSheet(e.target.value)}>
                      {sheetsRef.map(n => <option key={n}>{n}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Key columns ── */}
        <div className="ocs-card">
          <div className="ocs-card-title">KEY COLUMN <span className="ocs-tag">MATCH</span></div>
          <div className="ocs-grid2">
            <div>
              <div className="ocs-label">Key ในไฟล์หลัก</div>
              <input className="ocs-input" type="text" value={keyMain} onChange={e => setKeyMain(e.target.value)} placeholder="เช่น MSISDN" />
            </div>
            <div>
              <div className="ocs-label">Key ในไฟล์อ้างอิง</div>
              <input className="ocs-input" type="text" value={keyRef} onChange={e => setKeyRef(e.target.value)} placeholder="เช่น MSISDN" />
            </div>
          </div>
        </div>

        {/* ── Column mappings ── */}
        <div className="ocs-card">
          <div className="ocs-card-title">COLUMN MAPPING <span className="ocs-tag">UNLIMITED</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', gap: '8px', marginBottom: '8px' }}>
            <div className="ocs-label">Ref column</div>
            <div />
            <div className="ocs-label">Main column (เขียนทับ)</div>
            <div />
          </div>
          {colMappings.map(row => (
            <ColMappingRow key={row.id} row={row} onChange={updateMapRow} onRemove={removeMapRow} />
          ))}
          <button className="ocs-btn-add" onClick={addMapRow}>+ ADD COLUMN</button>
        </div>

        {/* ── Clear columns ── */}
        <div className="ocs-card">
          <div className="ocs-card-title">CLEAR COLUMNS <span className="ocs-tag">OPTIONAL</span></div>
          {clearCols.map(row => (
            <ClearColRow key={row.id} row={row} onChange={updateClearRow} onRemove={removeClearRow} />
          ))}
          <button className="ocs-btn-add" onClick={addClearRow}>+ ADD COLUMN</button>
        </div>

        {/* ── Header styling ── */}
        <div className="ocs-card">
          <div className="ocs-card-title">HEADER STYLE <span className="ocs-tag">OPTIONAL</span></div>
          <label className="ocs-check-row">
            <input type="checkbox" checked={doStyle} onChange={e => setDoStyle(e.target.checked)} />
            ตกแต่งสีหัวตาราง
          </label>
          {doStyle && (
            <>
              <div className="ocs-sub-label">กลุ่มที่ 1</div>
              <div className="ocs-color-row" style={{ marginBottom: '10px' }}>
                <div>
                  <div className="ocs-label">ชื่อคอลัมน์ (คั่นด้วยจุลภาค)</div>
                  <input className="ocs-input" type="text" value={group1.cols} onChange={e => setGroup1(p => ({ ...p, cols: e.target.value }))} placeholder="col1,col2,..." />
                </div>
                <div>
                  <div className="ocs-label">สี</div>
                  <input type="color" className="ocs-color-picker" value={group1.color} onChange={e => setGroup1(p => ({ ...p, color: e.target.value }))} />
                </div>
              </div>
              <div className="ocs-sub-label">กลุ่มที่ 2</div>
              <div className="ocs-color-row">
                <div>
                  <div className="ocs-label">ชื่อคอลัมน์ (คั่นด้วยจุลภาค)</div>
                  <input className="ocs-input" type="text" value={group2.cols} onChange={e => setGroup2(p => ({ ...p, cols: e.target.value }))} placeholder="col1,col2,..." />
                </div>
                <div>
                  <div className="ocs-label">สี</div>
                  <input type="color" className="ocs-color-picker" value={group2.color} onChange={e => setGroup2(p => ({ ...p, color: e.target.value }))} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Preview ── */}
        {isReady && (
          <div className="ocs-card">
            <div className="ocs-card-title">DATA PREVIEW <span className="ocs-tag">5 ROWS</span></div>
            <button className="ocs-btn-add" style={{ marginBottom: '12px' }} onClick={buildPreview}>
              ↻ LOAD PREVIEW
            </button>
            {preview && (
              <>
                <div className="ocs-stats">
                  <div className="ocs-stat">
                    <div className="ocs-stat-val">{preview.stats.totalRows}</div>
                    <div className="ocs-stat-lbl">Total Rows</div>
                  </div>
                  <div className="ocs-stat">
                    <div className="ocs-stat-val">{preview.stats.refSize}</div>
                    <div className="ocs-stat-lbl">Ref Records</div>
                  </div>
                  <div className="ocs-stat">
                    <div className="ocs-stat-val">{preview.stats.mappingCount}</div>
                    <div className="ocs-stat-lbl">Mappings</div>
                  </div>
                </div>
                <div className="ocs-preview-scroll">
                  <table>
                    <thead>
                      <tr>{preview.headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, ri) => (
                        <tr key={ri}>
                          {row.cells.map((cell, ci) => (
                            <td key={ci} className={
                              cell.type === 'mapped' ? 'ocs-cell-mapped' :
                                cell.type === 'cleared' ? 'ocs-cell-cleared' : ''
                            }>
                              {cell.val}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Run ── */}
        <button className="ocs-btn-run" onClick={runProcess} disabled={!isReady || loading}>
          <div className="ocs-btn-run-inner">
            <span>{loading ? '⏳ PROCESSING...' : '⬇ PROCESS & DOWNLOAD'}</span>
          </div>
        </button>

        {status && (
          <div className={`ocs-status ocs-status-${status.type}`}>
            {status.type === 'ok' ? '✓' : status.type === 'err' ? '✕' : '○'} {status.msg}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="ocs-footer">
          <p>
            <span className="ocs-dot" />
            SYSTEM ONLINE · DATA MAPPER · OCS TEAM
            <span className="ocs-dot" />
          </p>
        </div>
      </div>
    </div>
  );
}