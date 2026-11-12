"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText, GitCompare, Download, ArrowLeft,
  Search, ArrowRightLeft, CheckCircle2, AlertTriangle,
  PlusCircle, MinusCircle, ClipboardPaste, Upload, Trash2,
  Copy, Check, Sparkles, ShieldAlert, Clock, Filter
} from 'lucide-react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import {
  compareScenarioReleases,
  ScenarioDiffStatus,
  CompositeKeyStrategy,
  DiffEngineOptions,
  AlignedScenarioRow,
  RELEASE_TYPE_LABELS,
} from '@/lib/scenarioDiffEngine';

const PAGE_SIZE = 200;

const SAMPLE_TB = `Counter|Scenario Name|Release Type(B: BE; R: Brand; P: Primary Offering; O: Supplementary Offering)|Release Object
SO_Speed_30M|SCE_SO_PPS_30M_63210012|O|C_SO_63210012
SFU_Speed_Max|SCE_SFU_4GMax|P|C_PO_51006670
PO_Speed_2|SCE_PO_POS_10M|P|C_PO_52100117
PO_Speed_2|SCE_PO_POS_20M|P|C_PO_52100118
O_Dr_AWN_20M_64k|SCE_SO_PPS_20M_63210084_2|O|C_SO_63210084
SO_Social_Unlim|SCE_SO_SOCIAL_99|O|C_SO_63210099`;

const SAMPLE_PROD = `Counter|Scenario Name|Release Type(B: BE; R: Brand; P: Primary Offering; O: Supplementary Offering)|Release Object
PO_Speed_2|SCE_PO_POS_10M|P|C_PO_52100117
SO_Speed_30M|SCE_SO_PPS_30M_63210012|O|C_SO_63210012
SFU_Speed_Max_LEGACY|SCE_SFU_4GMax|P|C_PO_51006670
PO_Speed_2|SCE_PO_POS_20M|O|C_PO_52100118
O_Dr_AWN_20M_128k|SCE_SO_PPS_20M_63210084_2|O|C_SO_63210084
PO_Legacy_Voice|SCE_PO_VOICE_199|P|C_PO_51001199`;

// Inline character/token diff highlighter
function FieldValueDiff({
  valTb,
  valProd,
  isDiff,
  side,
}: {
  valTb?: string;
  valProd?: string;
  isDiff: boolean;
  side: 'TB' | 'PROD';
}) {
  const myVal = side === 'TB' ? valTb : valProd;
  const otherVal = side === 'TB' ? valProd : valTb;

  if (!myVal) {
    return <span className="text-slate-600 italic">—</span>;
  }

  if (!isDiff || !otherVal) {
    return <span className="text-slate-200">{myVal}</span>;
  }

  // Highlight character-level difference
  let prefix = 0;
  const minLen = Math.min(myVal.length, otherVal.length);
  while (prefix < minLen && myVal[prefix] === otherVal[prefix]) {
    prefix++;
  }

  let suffix = 0;
  while (
    suffix < minLen - prefix &&
    myVal[myVal.length - 1 - suffix] === otherVal[otherVal.length - 1 - suffix]
  ) {
    suffix++;
  }

  const start = myVal.slice(0, prefix);
  const mid = myVal.slice(prefix, myVal.length - suffix);
  const end = suffix > 0 ? myVal.slice(myVal.length - suffix) : '';

  return (
    <span className="font-semibold">
      <span className="text-slate-300">{start}</span>
      {mid ? (
        <mark
          className={`rounded px-1 py-0.5 font-bold ${
            side === 'TB'
              ? 'bg-amber-500/35 text-amber-200 border border-amber-400/50'
              : 'bg-sky-500/35 text-sky-200 border border-sky-400/50'
          }`}
        >
          {mid}
        </mark>
      ) : (
        <span className="mx-0.5 inline-block h-3.5 w-1.5 rounded bg-rose-500 align-middle" />
      )}
      <span className="text-slate-300">{end}</span>
    </span>
  );
}

export default function ScenarioReleaseComparatorPage() {
  // Raw text state for Testbase (TB) and Production (Prod)
  const [tbText, setTbText] = useState<string>('');
  const [prodText, setProdText] = useState<string>('');
  const [tbFileName, setTbFileName] = useState<string>('');
  const [prodFileName, setProdFileName] = useState<string>('');
  const [tbMode, setTbMode] = useState<'paste' | 'file'>('paste');
  const [prodMode, setProdMode] = useState<'paste' | 'file'>('paste');
  const [dragSide, setDragSide] = useState<'TB' | 'PROD' | null>(null);

  // Engine Options
  const [options, setOptions] = useState<DiffEngineOptions>({
    caseSensitive: false,
    trimWhitespace: true,
    ignoreHeader: true,
    deduplicateExactLines: false,
    keyStrategy: 'SCENARIO_AND_OBJECT',
  });

  // UI Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DIFF_ONLY' | ScenarioDiffStatus>('DIFF_ONLY');
  const [releaseTypeFilter, setReleaseTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibleLimit, setVisibleLimit] = useState<number>(PAGE_SIZE);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleLimit(PAGE_SIZE);
  }, [statusFilter, releaseTypeFilter, searchQuery, options]);

  // Run Pure Diff Engine via useMemo (Instant O(N) calculation)
  const summary = useMemo(() => {
    if (!tbText.trim() && !prodText.trim()) return null;
    return compareScenarioReleases(tbText, prodText, options);
  }, [tbText, prodText, options]);

  // If 100% matched, auto-switch filter from DIFF_ONLY to ALL so user sees their matched rows
  useEffect(() => {
    if (!summary) return;
    const totalDiffs =
      summary.modifiedCount + summary.onlyTbCount + summary.onlyProdCount + summary.malformedCount;
    if (totalDiffs === 0 && summary.matchCount > 0 && statusFilter === 'DIFF_ONLY') {
      setStatusFilter('ALL');
    }
  }, [summary]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (!summary) return [];
    const q = searchQuery.trim().toLowerCase();

    return summary.rows.filter(row => {
      // 1. Status filter
      if (statusFilter === 'DIFF_ONLY' && row.status === 'MATCH') return false;
      if (statusFilter !== 'ALL' && statusFilter !== 'DIFF_ONLY' && row.status !== statusFilter) {
        return false;
      }

      // 2. Release Type filter (B / R / P / O)
      if (releaseTypeFilter !== 'ALL') {
        const rtTb = row.tbRecord?.releaseType?.toUpperCase() || '';
        const rtProd = row.prodRecord?.releaseType?.toUpperCase() || '';
        if (rtTb !== releaseTypeFilter && rtProd !== releaseTypeFilter) return false;
      }

      // 3. Search query across all 4 columns
      if (q !== '') {
        const hayTb = row.tbRecord?.rawLine.toLowerCase() || '';
        const hayProd = row.prodRecord?.rawLine.toLowerCase() || '';
        return hayTb.includes(q) || hayProd.includes(q);
      }

      return true;
    });
  }, [summary, statusFilter, releaseTypeFilter, searchQuery]);

  const displayedRows = useMemo(() => {
    return filteredRows.slice(0, visibleLimit);
  }, [filteredRows, visibleLimit]);

  // Load File (TXT / CSV / Excel)
  const handleFileUpload = (file: File, side: 'TB' | 'PROD') => {
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    const reader = new FileReader();

    reader.onload = ev => {
      let textContent = '';
      if (isExcel) {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
        textContent = rows
          .map(r => (r.length === 1 ? String(r[0]) : r.slice(0, 4).join('|')))
          .join('\n');
      } else {
        textContent = (ev.target?.result as string) || '';
      }

      if (side === 'TB') {
        setTbText(textContent);
        setTbFileName(file.name);
      } else {
        setProdText(textContent);
        setProdFileName(file.name);
      }
    };

    if (isExcel) reader.readAsArrayBuffer(file);
    else reader.readAsText(file, 'utf-8');
  };

  const handleSwap = () => {
    setTbText(prodText);
    setProdText(tbText);
    setTbFileName(prodFileName);
    setProdFileName(tbFileName);
  };

  const handleLoadSample = () => {
    setTbText(SAMPLE_TB);
    setProdText(SAMPLE_PROD);
    setTbFileName('TB_Scenario_Release.txt');
    setProdFileName('PRD_Scenario_Release.txt');
    setTbMode('paste');
    setProdMode('paste');
    setStatusFilter('DIFF_ONLY');
  };

  // Export Styled Multi-Sheet Excel Report using ExcelJS
  const handleExportExcel = async () => {
    if (!summary) return;
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BILLONE Scenario Release Comparator';
    workbook.created = new Date();

    const statusLabelMap: Record<ScenarioDiffStatus, string> = {
      MATCH: 'ตรงกัน (Match)',
      MODIFIED: 'ค่าไม่ตรงกัน (Modified)',
      ONLY_TB: 'มีเฉพาะ TB (Missing in PRD)',
      ONLY_PROD: 'มีเฉพาะ PRD (Extra in PRD)',
      MALFORMED: 'รูปแบบผิด (Malformed)',
    };

    const buildSheet = (sheetName: string, rows: AlignedScenarioRow[]) => {
      const sheet = workbook.addWorksheet(sheetName, {
        views: [{ state: 'frozen', ySplit: 1 }],
      });

      // No sequence number column ('ลำดับ') so it doesn't duplicate Excel's native row numbers!
      sheet.columns = [
        { header: 'สถานะ (Status)', key: 'status', width: 26 },
        { header: 'คอลัมน์ที่ต่าง (Diff Fields)', key: 'diffFields', width: 26 },
        { header: 'TB: Counter', key: 'tbCounter', width: 26 },
        { header: 'PRD: Counter', key: 'prodCounter', width: 26 },
        { header: 'TB: Scenario Name', key: 'tbScenario', width: 34 },
        { header: 'PRD: Scenario Name', key: 'prodScenario', width: 34 },
        { header: 'TB: Type', key: 'tbType', width: 12 },
        { header: 'PRD: Type', key: 'prodType', width: 12 },
        { header: 'TB: Release Object', key: 'tbObject', width: 22 },
        { header: 'PRD: Release Object', key: 'prodObject', width: 22 },
        { header: 'บรรทัดเดิม (TB / PRD)', key: 'origLines', width: 20 },
      ];

      // Style Header Row (Formal, muted corporate tone — color only on header)
      const headerRow = sheet.getRow(1);
      headerRow.height = 26;
      headerRow.eachCell((cell, colNumber) => {
        cell.font = {
          name: 'Segoe UI',
          size: 10,
          bold: true,
          color: { argb: 'FFFFFFFF' },
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF334155' }, // Formal Slate-700
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber >= 7 && colNumber <= 8 ? 'center' : 'left',
          wrapText: true,
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'medium', color: { argb: 'FF1E293B' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
      });

      // Enable AutoFilter on all columns
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: 11 },
      };

      // Populate Data Rows (Clean corporate look + subtle pastel tint ONLY on cells that differ)
      rows.forEach((r, rowIdx) => {
        const changedCols: string[] = [];
        if (r.status === 'MODIFIED') {
          if (r.diffFields.counter) changedCols.push('Counter');
          if (r.diffFields.scenarioName) changedCols.push('Scenario Name');
          if (r.diffFields.releaseType) changedCols.push('Release Type');
          if (r.diffFields.releaseObject) changedCols.push('Release Object');
        }

        const rowValues = {
          status: statusLabelMap[r.status],
          diffFields: changedCols.join(', ') || '-',
          tbCounter: r.tbRecord?.counter ?? '-',
          prodCounter: r.prodRecord?.counter ?? '-',
          tbScenario: r.tbRecord?.scenarioName ?? '-',
          prodScenario: r.prodRecord?.scenarioName ?? '-',
          tbType: r.tbRecord?.releaseType ?? '-',
          prodType: r.prodRecord?.releaseType ?? '-',
          tbObject: r.tbRecord?.releaseObject ?? '-',
          prodObject: r.prodRecord?.releaseObject ?? '-',
          origLines: `L${r.tbRecord?.lineNumber ?? '-'} / L${r.prodRecord?.lineNumber ?? '-'}`,
        };

        const excelRow = sheet.addRow(rowValues);
        excelRow.height = 21;

        // Subtle zebra stripe for readability (White / Very faint gray #F8FAFC)
        const baseBg = rowIdx % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';

        excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = {
            name: colNumber <= 2 ? 'Segoe UI' : 'Consolas',
            size: 10,
            color: { argb: 'FF1E293B' },
          };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: baseBg },
          };
          cell.alignment = {
            vertical: 'middle',
            horizontal: colNumber === 7 || colNumber === 8 || colNumber === 11 ? 'center' : 'left',
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
        });

        // Subtle muted text color on Status column (Col 1) without heavy background fill
        const statusCell = excelRow.getCell(1);
        const statusTextColor: Record<ScenarioDiffStatus, string> = {
          MATCH: 'FF15803D',    // Muted Green
          MODIFIED: 'FFB45309', // Muted Amber/Brown
          ONLY_TB: 'FFC2410C',  // Muted Orange
          ONLY_PROD: 'FF0369A1', // Muted Blue
          MALFORMED: 'FFB91C1C', // Muted Red
        };
        statusCell.font = {
          name: 'Segoe UI',
          size: 10,
          bold: r.status !== 'MATCH',
          color: { argb: statusTextColor[r.status] },
        };

        // Soft pastel cream highlight (#FEF9C3) ONLY on the exact cells that don't match
        if (r.status === 'MODIFIED') {
          const highlightDiffPair = (tbCol: number, prdCol: number) => {
            [tbCol, prdCol].forEach(cIdx => {
              const c = excelRow.getCell(cIdx);
              c.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFEF9C3' }, // Soft pastel cream (not gaudy)
              };
              c.font = {
                name: 'Consolas',
                size: 10,
                bold: true,
                color: { argb: 'FF713F12' },
              };
            });
          };

          if (r.diffFields.counter) highlightDiffPair(3, 4);
          if (r.diffFields.scenarioName) highlightDiffPair(5, 6);
          if (r.diffFields.releaseType) highlightDiffPair(7, 8);
          if (r.diffFields.releaseObject) highlightDiffPair(9, 10);
        }
      });
    };

    const diffsOnly = summary.rows.filter(r => r.status !== 'MATCH');
    if (diffsOnly.length > 0) {
      buildSheet('เฉพาะจุดต่าง (Discrepancies)', diffsOnly);
    }
    buildSheet('ข้อมูลทั้งหมด (All Aligned)', summary.rows);

    const onlyTbRows = summary.rows.filter(r => r.status === 'ONLY_TB');
    if (onlyTbRows.length > 0) {
      buildSheet('มีเฉพาะ TB (Missing in PRD)', onlyTbRows);
    }

    const onlyProdRows = summary.rows.filter(r => r.status === 'ONLY_PROD');
    if (onlyProdRows.length > 0) {
      buildSheet('มีเฉพาะ PRD (Extra in PRD)', onlyProdRows);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Scenario_Release_Diff_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy pipe-delimited lines of currently filtered view
  const handleCopyFilteredPipe = (targetSide: 'TB' | 'PROD' | 'BOTH') => {
    if (filteredRows.length === 0) return;
    const header =
      'Counter|Scenario Name|Release Type(B: BE; R: Brand; P: Primary Offering; O: Supplementary Offering)|Release Object';

    let text = '';
    if (targetSide === 'TB') {
      const lines = filteredRows
        .map(r => r.tbRecord?.rawLine)
        .filter((l): l is string => Boolean(l));
      text = [header, ...lines].join('\n');
    } else if (targetSide === 'PROD') {
      const lines = filteredRows
        .map(r => r.prodRecord?.rawLine)
        .filter((l): l is string => Boolean(l));
      text = [header, ...lines].join('\n');
    } else {
      const tsvHeader = [
        'Status',
        'TB_Line',
        'TB_Counter',
        'TB_ScenarioName',
        'TB_ReleaseType',
        'TB_ReleaseObject',
        'PRD_Line',
        'PRD_Counter',
        'PRD_ScenarioName',
        'PRD_ReleaseType',
        'PRD_ReleaseObject',
      ].join('\t');
      const lines = filteredRows.map(r =>
        [
          r.status,
          r.tbRecord?.lineNumber ?? '-',
          r.tbRecord?.counter ?? '-',
          r.tbRecord?.scenarioName ?? '-',
          r.tbRecord?.releaseType ?? '-',
          r.tbRecord?.releaseObject ?? '-',
          r.prodRecord?.lineNumber ?? '-',
          r.prodRecord?.counter ?? '-',
          r.prodRecord?.scenarioName ?? '-',
          r.prodRecord?.releaseType ?? '-',
          r.prodRecord?.releaseObject ?? '-',
        ].join('\t')
      );
      text = [tsvHeader, ...lines].join('\n');
    }

    navigator.clipboard.writeText(text);
    setCopiedId(targetSide);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#080c14] pb-24 text-slate-100 font-sans selection:bg-emerald-500/30">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-64 bg-gradient-to-b from-emerald-950/20 via-slate-900/5 to-transparent" />

      <div className="relative z-10 mx-auto max-w-[1500px] px-4 py-5 sm:px-6">
        {/* ── TOP HEADER ── */}
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/mainocs"
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft size={14} />
              กลับหน้าหลัก
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <GitCompare size={20} className="text-emerald-400" />
                <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">
                  Scenario Release Comparator — <span className="text-amber-300">Testbase (TB)</span> vs{' '}
                  <span className="text-sky-300">Production (PRD)</span>
                </h1>
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                Format: Counter | Scenario Name | Release Type (B/R/P/O) | Release Object
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadSample}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25"
            >
              <Sparkles size={14} />
              โหลดข้อมูลตัวอย่าง (TB vs PRD)
            </button>
            {(tbText || prodText) && (
              <button
                onClick={() => {
                  setTbText('');
                  setProdText('');
                  setTbFileName('');
                  setProdFileName('');
                }}
                className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20"
              >
                <Trash2 size={14} />
                ล้างข้อมูล
              </button>
            )}
          </div>
        </header>

        {/* ── INPUT PANELS: TESTBASE (TB) & PRODUCTION (PROD) ── */}
        <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-11 items-stretch">
          {(['TB', 'PROD'] as const).map((side, idx) => {
            const isTb = side === 'TB';
            const rawVal = isTb ? tbText : prodText;
            const setRawVal = isTb ? setTbText : setProdText;
            const fileName = isTb ? tbFileName : prodFileName;
            const mode = isTb ? tbMode : prodMode;
            const setMode = isTb ? setTbMode : setProdMode;
            const lineCount = isTb ? summary?.totalTbLines ?? 0 : summary?.totalProdLines ?? 0;
            const isDragging = dragSide === side;

            return (
              <React.Fragment key={side}>
                {idx === 1 && (
                  <div className="flex lg:flex-col items-center justify-center py-1">
                    <button
                      onClick={handleSwap}
                      title="สลับข้อมูลระหว่าง Testbase (TB) ⇄ Production (PRD)"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-slate-800 text-slate-300 shadow transition hover:scale-105 hover:border-emerald-400 hover:text-emerald-300"
                    >
                      <ArrowRightLeft size={15} />
                    </button>
                  </div>
                )}

                <div
                  onDragOver={e => {
                    e.preventDefault();
                    setDragSide(side);
                  }}
                  onDragLeave={() => setDragSide(null)}
                  onDrop={e => {
                    e.preventDefault();
                    setDragSide(null);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFileUpload(file, side);
                  }}
                  className={`lg:col-span-5 flex flex-col justify-between rounded-xl border p-3.5 transition ${
                    isDragging
                      ? 'border-emerald-400 bg-emerald-500/10'
                      : rawVal.trim()
                      ? isTb
                        ? 'border-amber-500/35 bg-amber-500/[0.03]'
                        : 'border-sky-500/35 bg-sky-500/[0.03]'
                      : 'border-white/10 bg-slate-900/60'
                  }`}
                >
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-md px-2.5 py-0.5 text-xs font-bold ${
                          isTb
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        }`}
                      >
                        {isTb ? 'TESTBASE (TB)' : 'PRODUCTION (PRD)'}
                      </span>
                      {rawVal.trim() && (
                        <span className="font-mono text-xs text-slate-400">
                          {lineCount.toLocaleString()} records
                          {fileName ? ` · ${fileName}` : ''}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/40 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setMode('paste')}
                        className={`flex items-center gap-1 rounded px-2 py-1 font-medium transition ${
                          mode === 'paste' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <ClipboardPaste size={12} /> วางข้อความ Pipe (|)
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode('file')}
                        className={`flex items-center gap-1 rounded px-2 py-1 font-medium transition ${
                          mode === 'file' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Upload size={12} /> อัปโหลดไฟล์
                      </button>
                    </div>
                  </div>

                  {mode === 'paste' ? (
                    <textarea
                      rows={5}
                      spellCheck={false}
                      placeholder={`วางข้อมูล ${isTb ? 'Testbase (TB)' : 'Production (PRD)'} ที่คั่นด้วย | ที่นี่...\nตัวอย่าง: SO_Speed_30M|SCE_SO_PPS_30M_63210012|O|C_SO_63210012`}
                      value={rawVal}
                      onChange={e => setRawVal(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/40 p-2.5 font-mono text-xs leading-relaxed text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none"
                    />
                  ) : (
                    <div>
                      <input
                        type="file"
                        id={`upload-${side}`}
                        accept=".txt,.csv,.log,.dat,.xlsx,.xls"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) handleFileUpload(f, side);
                        }}
                      />
                      <div
                        onClick={() => document.getElementById(`upload-${side}`)?.click()}
                        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-white/15 bg-black/30 py-6 text-center transition hover:border-white/30 hover:bg-white/[0.04]"
                      >
                        <FileText size={22} className={isTb ? 'text-amber-400 mb-1.5' : 'text-sky-400 mb-1.5'} />
                        <p className="text-xs font-semibold text-white">
                          {fileName ? fileName : `คลิกเลือกไฟล์ฝั่ง ${isTb ? 'TB' : 'PRD'} หรือลากไฟล์มาวาง`}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          รองรับไฟล์ .txt, .csv (Pipe-delimited) และ .xlsx
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* ── ENGINE CONTROL BAR ── */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/90 px-4 py-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-400">เกณฑ์การจับคู่ (Alignment Key):</span>
            {(
              [
                {
                  id: 'SCENARIO_AND_OBJECT',
                  label: '✨ Smart Align (Scenario + Object + Fallback)',
                },
                {
                  id: 'SCENARIO_ONLY',
                  label: 'ยึด Scenario Name เป็นหลัก',
                },
                {
                  id: 'COUNTER_AND_OBJECT',
                  label: 'ยึด Counter + Release Object',
                },
                {
                  id: 'FULL_ROW',
                  label: 'เทียบตรงทั้ง 4 คอลัมน์เท่านั้น (Exact 4-Tuple)',
                },
              ] as { id: CompositeKeyStrategy; label: string }[]
            ).map(st => (
              <button
                key={st.id}
                onClick={() => setOptions(o => ({ ...o, keyStrategy: st.id }))}
                className={`rounded-lg px-2.5 py-1.5 font-medium transition ${
                  options.keyStrategy === st.id
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-slate-300">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={options.trimWhitespace}
                onChange={e => setOptions(o => ({ ...o, trimWhitespace: e.target.checked }))}
                className="h-3.5 w-3.5 rounded accent-emerald-500"
              />
              Trim ช่องว่าง
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={options.deduplicateExactLines}
                onChange={e => setOptions(o => ({ ...o, deduplicateExactLines: e.target.checked }))}
                className="h-3.5 w-3.5 rounded accent-emerald-500"
              />
              ตัดบรรทัดซ้ำซ้อน (Deduplicate)
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={options.caseSensitive}
                onChange={e => setOptions(o => ({ ...o, caseSensitive: e.target.checked }))}
                className="h-3.5 w-3.5 rounded accent-emerald-500"
              />
              Case-Sensitive
            </label>
          </div>
        </div>

        {/* ── DIFF RESULTS & STRUCTURED 4-COLUMN TABLE ── */}
        {summary ? (
          <div className="space-y-4">
            {/* 1. Status Filter Cards */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-6">
              {[
                {
                  id: 'DIFF_ONLY' as const,
                  label: 'จุดต่างทั้งหมด (All Diffs)',
                  count:
                    summary.modifiedCount +
                    summary.onlyTbCount +
                    summary.onlyProdCount +
                    summary.malformedCount,
                  sub: 'รายการที่ต้องตรวจสอบ',
                  cls: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
                  icon: AlertTriangle,
                },
                {
                  id: 'MODIFIED' as const,
                  label: 'ค่าไม่ตรงกัน (Modified)',
                  count: summary.modifiedCount,
                  sub: 'Counter / Type / Object ต่างกัน',
                  cls: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
                  icon: GitCompare,
                },
                {
                  id: 'ONLY_TB' as const,
                  label: 'มีเฉพาะ TB (Missing in PRD)',
                  count: summary.onlyTbCount,
                  sub: 'ยังไม่ได้ขึ้น Production',
                  cls: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
                  icon: MinusCircle,
                },
                {
                  id: 'ONLY_PROD' as const,
                  label: 'มีเฉพาะ PRD (Extra in PRD)',
                  count: summary.onlyProdCount,
                  sub: 'ไม่มีในไฟล์ Testbase รอบนี้',
                  cls: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
                  icon: PlusCircle,
                },
                {
                  id: 'MATCH' as const,
                  label: `ตรงกัน (${summary.matchPercentage}%)`,
                  count: summary.matchCount,
                  sub: 'ทั้ง 4 คอลัมน์ตรงกัน 100%',
                  cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
                  icon: CheckCircle2,
                },
                {
                  id: 'ALL' as const,
                  label: 'รวมทั้งหมด (All Rows)',
                  count: summary.totalAlignedRows,
                  sub: `ประมวลผลใน ${summary.executionTimeMs} ms`,
                  cls: 'border-slate-500/40 bg-slate-500/10 text-slate-200',
                  icon: Clock,
                },
              ].map(card => {
                const Icon = card.icon;
                const active = statusFilter === card.id;
                return (
                  <button
                    key={card.id}
                    onClick={() => setStatusFilter(card.id)}
                    className={`flex flex-col justify-between rounded-xl border p-3 text-left transition ${
                      active
                        ? `${card.cls} ring-2 ring-white/20 shadow-md`
                        : 'border-white/10 bg-slate-900/60 text-slate-300 hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-semibold opacity-90">{card.label}</span>
                      <Icon size={14} className="shrink-0 opacity-80" />
                    </div>
                    <div className="mt-1.5 text-2xl font-extrabold text-white">
                      {card.count.toLocaleString()}
                    </div>
                    <div className="mt-0.5 text-[10px] opacity-70">{card.sub}</div>
                  </button>
                );
              })}
            </div>

            {/* Edge-case Warning Banner (Malformed lines or Duplicate rows) */}
            {(summary.malformedCount > 0 ||
              summary.duplicateTbCount > 0 ||
              summary.duplicateProdCount > 0) && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={16} className="text-amber-400 shrink-0" />
                  <span>
                    <strong>ตรวจพบข้อสังเกตในไฟล์ข้อมูล:</strong>{' '}
                    {summary.malformedCount > 0 && (
                      <span className="mr-3 underline">
                        บรรทัดที่คอลัมน์ไม่ครบ 4 ช่อง: {summary.malformedCount} รายการ
                      </span>
                    )}
                    {(summary.duplicateTbCount > 0 || summary.duplicateProdCount > 0) && (
                      <span>
                        บรรทัดซ้ำซ้อนทั้งหมด (TB ซ้ำ {summary.duplicateTbCount} บรรทัด / PRD ซ้ำ{' '}
                        {summary.duplicateProdCount} บรรทัด)
                      </span>
                    )}
                  </span>
                </div>
                {summary.malformedCount > 0 && (
                  <button
                    onClick={() => setStatusFilter('MALFORMED')}
                    className="rounded bg-amber-500/20 px-2.5 py-1 font-bold text-amber-200 hover:bg-amber-500/30"
                  >
                    ดูบรรทัดที่รูปแบบผิด ({summary.malformedCount})
                  </button>
                )}
              </div>
            )}

            {/* 2. Search, Release Type Filter & Export Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/90 p-3">
              <div className="flex flex-wrap flex-1 items-center gap-3 min-w-[260px]">
                {/* Search Box */}
                <div className="relative flex-1 max-w-sm">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ค้นหา Counter, Scenario Name, Release Object..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-black/40 py-1.5 pl-8 pr-3 font-mono text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Release Type Filter Pills (B, R, P, O) */}
                <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 p-1 text-xs">
                  <span className="flex items-center gap-1 px-2 text-slate-400">
                    <Filter size={12} /> Type:
                  </span>
                  {(['ALL', 'P', 'O', 'B', 'R'] as const).map(rt => (
                    <button
                      key={rt}
                      onClick={() => setReleaseTypeFilter(rt)}
                      title={rt === 'ALL' ? 'ทุกประเภท' : RELEASE_TYPE_LABELS[rt]}
                      className={`rounded px-2.5 py-1 font-mono font-bold transition ${
                        releaseTypeFilter === rt
                          ? 'bg-emerald-500 text-slate-950'
                          : 'text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {rt === 'ALL' ? 'ALL' : `${rt} (${RELEASE_TYPE_LABELS[rt].split(' ')[0]})`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Copy & Export Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleCopyFilteredPipe('TB')}
                  className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-500/20"
                >
                  {copiedId === 'TB' ? <Check size={13} /> : <Copy size={13} />}
                  Copy ฝั่ง TB (Pipe)
                </button>
                <button
                  onClick={() => handleCopyFilteredPipe('PROD')}
                  className="flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-xs font-medium text-sky-200 transition hover:bg-sky-500/20"
                >
                  {copiedId === 'PROD' ? <Check size={13} /> : <Copy size={13} />}
                  Copy ฝั่ง PRD (Pipe)
                </button>
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-emerald-400"
                >
                  <Download size={14} /> Export Excel
                </button>
              </div>
            </div>

            {/* 3. Structured 4-Column Comparison Table */}
            <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-slate-950 px-4 py-2.5 text-xs text-slate-400">
                <div>
                  แสดง <strong className="text-white">{displayedRows.length.toLocaleString()}</strong> จาก{' '}
                  <strong className="text-white">{filteredRows.length.toLocaleString()}</strong> รายการ
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-amber-500/50 border border-amber-400" />
                    สีส้ม = ค่าฝั่ง Testbase (TB)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-sky-500/50 border border-sky-400" />
                    สีฟ้า = ค่าฝั่ง Production (PRD)
                  </span>
                </div>
              </div>

              <div className="max-h-[680px] overflow-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-950 text-[11px] uppercase tracking-wider text-slate-400 shadow">
                    <tr className="border-b border-white/10">
                      <th className="w-12 px-3 py-3 text-center">#</th>
                      <th className="w-32 px-3 py-3">สถานะ / จุดที่ต่าง</th>
                      <th className="w-20 px-2 py-3 text-center">บรรทัด (TB/PRD)</th>
                      <th className="px-3 py-3">1. Counter</th>
                      <th className="px-3 py-3">2. Scenario Name</th>
                      <th className="w-28 px-3 py-3 text-center">3. Release Type</th>
                      <th className="px-3 py-3">4. Release Object</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] font-mono">
                    {displayedRows.map(row => {
                      const tb = row.tbRecord;
                      const prod = row.prodRecord;
                      const d = row.diffFields;

                      const renderDualCell = (
                        valTb: string | undefined,
                        valProd: string | undefined,
                        isFieldDiff: boolean
                      ) => {
                        if (row.status === 'MATCH') {
                          return <span className="text-slate-300">{valTb}</span>;
                        }
                        if (row.status === 'ONLY_TB') {
                          return <span className="text-amber-200 font-semibold">{valTb || '—'}</span>;
                        }
                        if (row.status === 'ONLY_PROD') {
                          return <span className="text-sky-200 font-semibold">{valProd || '—'}</span>;
                        }
                        // MODIFIED or MALFORMED: If identical in this column, show once cleanly; if different, stack TB & PRD clearly
                        if (!isFieldDiff) {
                          return <span className="text-slate-300">{valTb || valProd}</span>;
                        }
                        return (
                          <div className="flex flex-col gap-1 rounded-md border border-rose-500/30 bg-rose-500/[0.07] p-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="w-9 shrink-0 rounded bg-amber-500/20 px-1 py-0.5 text-center text-[9px] font-bold text-amber-300">
                                TB
                              </span>
                              <FieldValueDiff valTb={valTb} valProd={valProd} isDiff={true} side="TB" />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-9 shrink-0 rounded bg-sky-500/20 px-1 py-0.5 text-center text-[9px] font-bold text-sky-300">
                                PRD
                              </span>
                              <FieldValueDiff valTb={valTb} valProd={valProd} isDiff={true} side="PROD" />
                            </div>
                          </div>
                        );
                      };

                      const changedList: string[] = [];
                      if (row.status === 'MODIFIED') {
                        if (d.counter) changedList.push('Counter');
                        if (d.scenarioName) changedList.push('Scenario');
                        if (d.releaseType) changedList.push('Type');
                        if (d.releaseObject) changedList.push('Object');
                      }

                      return (
                        <tr
                          key={row.id}
                          className={`transition hover:bg-white/[0.04] ${
                            row.status === 'MATCH'
                              ? 'opacity-70 hover:opacity-100'
                              : row.status === 'ONLY_TB'
                              ? 'bg-amber-500/[0.03]'
                              : row.status === 'ONLY_PROD'
                              ? 'bg-sky-500/[0.03]'
                              : 'bg-rose-500/[0.03]'
                          }`}
                        >
                          <td className="px-3 py-2.5 text-center text-slate-500">{row.id}</td>

                          {/* Status Badge + Changed Column Pills */}
                          <td className="px-3 py-2.5 font-sans">
                            {row.status === 'MATCH' && (
                              <span className="inline-block rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300 border border-emerald-500/30">
                                ✓ ตรงกัน
                              </span>
                            )}
                            {row.status === 'MODIFIED' && (
                              <div>
                                <span className="inline-block rounded bg-rose-500/20 px-2 py-0.5 text-[11px] font-bold text-rose-300 border border-rose-500/40">
                                  ≠ ค่าไม่ตรงกัน
                                </span>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {changedList.map(c => (
                                    <span
                                      key={c}
                                      className="rounded bg-rose-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-rose-100"
                                    >
                                      {c}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {row.status === 'ONLY_TB' && (
                              <span className="inline-block rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-300 border border-amber-500/40">
                                มีเฉพาะ TB
                              </span>
                            )}
                            {row.status === 'ONLY_PROD' && (
                              <span className="inline-block rounded bg-sky-500/20 px-2 py-0.5 text-[11px] font-bold text-sky-300 border border-sky-500/40">
                                มีเฉพาะ PRD
                              </span>
                            )}
                            {row.status === 'MALFORMED' && (
                              <div>
                                <span className="inline-block rounded bg-amber-500/30 px-2 py-0.5 text-[11px] font-bold text-amber-200 border border-amber-400">
                                  ⚠ รูปแบบผิด
                                </span>
                                <p className="mt-1 text-[10px] text-amber-300">
                                  {tb?.malformedReason || prod?.malformedReason}
                                </p>
                              </div>
                            )}
                          </td>

                          {/* Original Line Numbers */}
                          <td className="px-2 py-2.5 text-center text-[11px]">
                            <span className="text-amber-300/80">{tb ? `L${tb.lineNumber}` : '-'}</span>
                            <span className="mx-1 text-slate-600">/</span>
                            <span className="text-sky-300/80">{prod ? `L${prod.lineNumber}` : '-'}</span>
                          </td>

                          {/* 1. Counter */}
                          <td className="px-3 py-2.5 align-middle">
                            {renderDualCell(tb?.counter, prod?.counter, d.counter)}
                          </td>

                          {/* 2. Scenario Name */}
                          <td className="px-3 py-2.5 align-middle">
                            {renderDualCell(tb?.scenarioName, prod?.scenarioName, d.scenarioName)}
                          </td>

                          {/* 3. Release Type */}
                          <td className="px-3 py-2.5 text-center align-middle">
                            {renderDualCell(tb?.releaseType, prod?.releaseType, d.releaseType)}
                          </td>

                          {/* 4. Release Object */}
                          <td className="px-3 py-2.5 align-middle">
                            {renderDualCell(tb?.releaseObject, prod?.releaseObject, d.releaseObject)}
                          </td>
                        </tr>
                      );
                    })}

                    {displayedRows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-16 text-center font-sans text-sm text-slate-400">
                          ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Load More Pagination for thousands of lines */}
              {filteredRows.length > visibleLimit && (
                <div className="border-t border-white/10 bg-slate-950 p-3 text-center">
                  <button
                    onClick={() => setVisibleLimit(prev => prev + PAGE_SIZE)}
                    className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-6 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/25"
                  >
                    แสดงเพิ่มอีก {PAGE_SIZE} รายการ (เหลืออีก{' '}
                    {(filteredRows.length - visibleLimit).toLocaleString()} รายการ)
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-slate-900/40 py-20 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <GitCompare size={24} />
            </div>
            <h2 className="text-base font-bold text-white">
              วางข้อมูล Scenario Release (คั่นด้วย |) หรืออัปโหลดไฟล์ทั้งฝั่ง TB และ PRD
            </h2>
            <p className="mt-1 max-w-lg text-xs text-slate-400">
              ระบบจะตัด Header อัตโนมัติ จับคู่ตาม Scenario Name & Release Object แม้ลำดับบรรทัดสลับกัน และชี้จุดต่างรายคอลัมน์ทันที
            </p>
            <button
              onClick={handleLoadSample}
              className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-lg transition hover:bg-emerald-400"
            >
              <Sparkles size={15} />
              คลิกเพื่อโหลดข้อมูลตัวอย่าง Scenario Release
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
