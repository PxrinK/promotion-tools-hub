"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  FileText, GitCompare, Download, ArrowLeft,
  Table as TableIcon, Settings2, Search, ArrowRightLeft,
  CheckCircle2, AlertTriangle, PlusCircle, MinusCircle,
  ClipboardPaste, Upload, Trash2, Key, SortAsc, Layers, Copy, Check, Eye
} from 'lucide-react';
import Link from 'next/link';
import * as XLSX from 'xlsx';

// --- TYPES ---
type DiffStatus = 'match' | 'modified' | 'only_a' | 'only_b';
type CompareMode = 'smart_align' | 'key_match' | 'line_by_line';

interface AlignedRow {
  index: number;
  lineNumA: number | null;
  lineNumB: number | null;
  keyVal: string;
  contentA: string;
  contentB: string;
  rawRowA?: any[];
  rawRowB?: any[];
  status: DiffStatus;
  diffCols?: number[]; // indices of columns that differ when comparing full Excel rows
}

interface CompareSummary {
  totalAligned: number;
  matchCount: number;
  modifiedCount: number;
  onlyACount: number;
  onlyBCount: number;
  rows: AlignedRow[];
  isTruncated: boolean;
}

interface FileState {
  file: File | null;
  name: string;
  content: any[][];
  headers: string[];
  sheetNames: string[];
  selectedSheet: string;
  rawWorkbook: XLSX.WorkBook | null;
  isExcel: boolean;
  inputMode: 'file' | 'paste';
  pastedText: string;
}

const INITIAL_FILE_STATE: FileState = {
  file: null,
  name: '',
  content: [],
  headers: [],
  sheetNames: [],
  selectedSheet: '',
  rawWorkbook: null,
  isExcel: false,
  inputMode: 'file',
  pastedText: ''
};

const MAX_DISPLAY_ROWS = 2500;

// Helper: Highlight character/word differences between two strings
function renderInlineDiff(textA: string, textB: string, side: 'A' | 'B') {
  if (!textA && !textB) return <span className="text-white/20 italic">empty</span>;
  if (side === 'A' && !textA) return <span className="text-white/20 italic">— ไม่มีข้อมูล —</span>;
  if (side === 'B' && !textB) return <span className="text-white/20 italic">— ไม่มีข้อมูล —</span>;
  if (textA === textB) {
    return <span>{side === 'A' ? textA : textB}</span>;
  }

  // Split by pipe or space or token to highlight exact segments that differ
  const sep = textA.includes(' | ') || textB.includes(' | ') ? ' | ' : null;
  if (sep) {
    const partsA = textA.split(' | ');
    const partsB = textB.split(' | ');
    const myParts = side === 'A' ? partsA : partsB;
    const otherParts = side === 'A' ? partsB : partsA;

    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        {myParts.map((part, idx) => {
          const isSame = part.trim() === (otherParts[idx] ?? '').trim();
          return (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-white/20">|</span>}
              <span
                className={
                  isSame
                    ? 'text-white/60'
                    : side === 'A'
                    ? 'rounded bg-amber-500/25 px-1 py-0.5 font-bold text-amber-200 border border-amber-400/30'
                    : 'rounded bg-sky-500/25 px-1 py-0.5 font-bold text-sky-200 border border-sky-400/30'
                }
              >
                {part || 'empty'}
              </span>
            </React.Fragment>
          );
        })}
      </span>
    );
  }

  // Character-level prefix/suffix diff for single strings
  let prefixLen = 0;
  const minLen = Math.min(textA.length, textB.length);
  while (prefixLen < minLen && textA[prefixLen] === textB[prefixLen]) {
    prefixLen++;
  }

  let suffixLen = 0;
  while (
    suffixLen < minLen - prefixLen &&
    textA[textA.length - 1 - suffixLen] === textB[textB.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const target = side === 'A' ? textA : textB;
  const prefix = target.slice(0, prefixLen);
  const mid = target.slice(prefixLen, target.length - suffixLen);
  const suffix = suffixLen > 0 ? target.slice(target.length - suffixLen) : '';

  return (
    <span>
      <span className="text-white/60">{prefix}</span>
      {mid ? (
        <span
          className={
            side === 'A'
              ? 'rounded bg-amber-500/30 px-1 font-bold text-amber-200 underline decoration-amber-400/60'
              : 'rounded bg-sky-500/30 px-1 font-bold text-sky-200 underline decoration-sky-400/60'
          }
        >
          {mid}
        </span>
      ) : (
        <span className="mx-0.5 inline-block h-3 w-1 rounded bg-rose-400/60 align-middle" title="จุดที่มีข้อมูลขาดหาย" />
      )}
      <span className="text-white/60">{suffix}</span>
    </span>
  );
}

export default function ComparatorPage() {
  const [fileA, setFileA] = useState<FileState>(INITIAL_FILE_STATE);
  const [fileB, setFileB] = useState<FileState>(INITIAL_FILE_STATE);

  // Column selections
  const [selectedColA, setSelectedColA] = useState('');
  const [selectedColB, setSelectedColB] = useState('');
  const [keyColA, setKeyColA] = useState('');
  const [keyColB, setKeyColB] = useState('');

  // Compare Mode & Settings
  const [compareMode, setCompareMode] = useState<CompareMode>('smart_align');
  const [settings, setSettings] = useState({
    caseSensitive: false,
    trimWhitespace: true,
    ignoreEmptyLines: true,
    skipHeaderRow: true,
    sortBeforeCompare: true,
  });

  // Results & Filtering
  const [result, setResult] = useState<CompareSummary | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('รออัปโหลดหรือวางข้อมูล 2 ฝั่ง');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'diff_only' | DiffStatus>('diff_only');
  const [copiedState, setCopiedState] = useState<string | null>(null);
  const [dragOverSide, setDragOverSide] = useState<'A' | 'B' | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isReady = useMemo(() => {
    return fileA.content.length > 0 && fileB.content.length > 0;
  }, [fileA.content.length, fileB.content.length]);

  // Animated dot grid
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    let frame = 0;
    let animId: number;
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
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  // Normalize string for comparison
  const normalizeStr = (val: string) => {
    let s = String(val ?? '');
    if (settings.trimWhitespace) {
      s = s.replace(/\s+/g, ' ').trim();
    }
    if (!settings.caseSensitive) {
      s = s.toLowerCase();
    }
    return s;
  };

  // Format row to display string
  const formatRowText = (row: any[], colIdx: number) => {
    if (!row) return '';
    if (colIdx !== -1) {
      return String(row[colIdx] ?? '');
    }
    return row
      .map(cell => String(cell ?? '').trim())
      .filter((c, i, arr) => !(c === '' && i === arr.length - 1))
      .join(' | ');
  };

  // Parse pasted text into 2D array
  const handlePasteChange = (text: string, side: 'A' | 'B') => {
    const rawLines = text.split(/\r?\n/);
    const isTabSeparated = rawLines.some(l => l.includes('\t'));
    const content = rawLines.map(line => (isTabSeparated ? line.split('\t') : [line]));
    const headers = isTabSeparated && content.length > 0 ? content[0].map((h, i) => String(h || `Col_${i + 1}`)) : [];

    const updateFn = side === 'A' ? setFileA : setFileB;
    updateFn(prev => ({
      ...prev,
      name: `Pasted Text (${content.filter(r => r.join('').trim() !== '').length} บรรทัด)`,
      pastedText: text,
      content,
      headers,
      isExcel: isTabSeparated && headers.length > 1
    }));
    setResult(null);
    setStatus('โหลดข้อความเรียบร้อย — พร้อมเปรียบเทียบ');
  };

  // Load file (Excel / CSV / TXT)
  const processUploadedFile = (file: File, side: 'A' | 'B') => {
    const isExcel = /\.(xlsx|xls|csv)$/i.test(file.name);
    const reader = new FileReader();
    setStatus(`กำลังอ่านไฟล์ ${file.name}...`);

    reader.onload = ev => {
      let content: any[][] = [];
      let headers: string[] = [];
      let sheetNames: string[] = [];
      let selectedSheet = '';
      let rawWorkbook: XLSX.WorkBook | null = null;

      if (isExcel) {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        rawWorkbook = XLSX.read(data, { type: 'array' });
        sheetNames = rawWorkbook.SheetNames;
        selectedSheet = sheetNames[0] || '';
        const ws = rawWorkbook.Sheets[selectedSheet];
        content = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
        headers = (content[0] || []).map((h, idx) => String(h || `Column ${idx + 1}`));
      } else {
        const text = ev.target?.result as string;
        content = text.split(/\r?\n/).map(line => [line]);
      }

      const newState: FileState = {
        file,
        name: file.name,
        content,
        headers,
        sheetNames,
        selectedSheet,
        rawWorkbook,
        isExcel,
        inputMode: 'file',
        pastedText: ''
      };

      if (side === 'A') {
        setFileA(newState);
        setSelectedColA('');
        setKeyColA('');
      } else {
        setFileB(newState);
        setSelectedColB('');
        setKeyColB('');
      }
      setResult(null);
      setStatus(`โหลดไฟล์ ${file.name} สำเร็จ (${content.length.toLocaleString()} แถว)`);
    };

    if (isExcel) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, side: 'A' | 'B') => {
    const file = e.target.files?.[0];
    if (file) processUploadedFile(file, side);
  };

  const handleSheetChange = (sheetName: string, side: 'A' | 'B') => {
    const target = side === 'A' ? fileA : fileB;
    if (!target.rawWorkbook) return;
    const ws = target.rawWorkbook.Sheets[sheetName];
    const content = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
    const headers = (content[0] || []).map((h, idx) => String(h || `Column ${idx + 1}`));

    if (side === 'A') {
      setFileA(prev => ({ ...prev, selectedSheet: sheetName, content, headers }));
      setSelectedColA('');
      setKeyColA('');
    } else {
      setFileB(prev => ({ ...prev, selectedSheet: sheetName, content, headers }));
      setSelectedColB('');
      setKeyColB('');
    }
    setResult(null);
  };

  const handleSwapFiles = () => {
    const tempFile = fileA;
    const tempCol = selectedColA;
    const tempKey = keyColA;
    setFileA(fileB);
    setSelectedColA(selectedColB);
    setKeyColA(keyColB);
    setFileB(tempFile);
    setSelectedColB(tempCol);
    setKeyColB(tempKey);
    setResult(null);
    setStatus('สลับฝั่งไฟล์ A ⇄ B เรียบร้อย');
  };

  // --- CORE COMPARISON & AUTO-ALIGNMENT ENGINE ---
  const handleCompare = () => {
    if (!isReady) return;
    setIsProcessing(true);
    setStatus('กำลังจัดเรียงบรรทัดและเปรียบเทียบข้อมูล...');

    setTimeout(() => {
      const idxA = fileA.isExcel && selectedColA ? fileA.headers.indexOf(selectedColA) : -1;
      const idxB = fileB.isExcel && selectedColB ? fileB.headers.indexOf(selectedColB) : -1;

      const keyIdxA = fileA.isExcel && keyColA ? fileA.headers.indexOf(keyColA) : 0;
      const keyIdxB = fileB.isExcel && keyColB ? fileB.headers.indexOf(keyColB) : 0;

      const startRowA = fileA.isExcel && settings.skipHeaderRow ? 1 : 0;
      const startRowB = fileB.isExcel && settings.skipHeaderRow ? 1 : 0;

      // Build structured items from A and B
      type Item = {
        origLine: number;
        text: string;
        normText: string;
        keyText: string;
        normKey: string;
        raw: any[];
      };

      const buildList = (data: any[][], startIdx: number, colIdx: number, kIdx: number): Item[] => {
        const list: Item[] = [];
        for (let i = startIdx; i < data.length; i++) {
          const row = data[i];
          const text = formatRowText(row, colIdx);
          const normText = normalizeStr(text);
          if (settings.ignoreEmptyLines && normText === '') continue;

          const keyRaw = kIdx !== -1 && row[kIdx] !== undefined ? String(row[kIdx]) : text.split('|')[0] || text;
          const normKey = normalizeStr(keyRaw);

          list.push({
            origLine: i + 1,
            text: settings.trimWhitespace ? text.trim() : text,
            normText,
            keyText: keyRaw.trim(),
            normKey,
            raw: row
          });
        }
        return list;
      };

      const listA = buildList(fileA.content, startRowA, idxA, keyIdxA);
      const listB = buildList(fileB.content, startRowB, idxB, keyIdxB);

      const alignedRows: AlignedRow[] = [];
      let matchCount = 0;
      let modifiedCount = 0;
      let onlyACount = 0;
      let onlyBCount = 0;

      if (compareMode === 'smart_align') {
        // Mode 1: Smart Align & Sort
        // Group items by normalized full text first, then pair up identical items,
        // and for remaining unmatched items, try pairing by primary key/first token or sort them side-by-side!
        const mapA = new Map<string, Item[]>();
        const mapB = new Map<string, Item[]>();

        listA.forEach(item => {
          const arr = mapA.get(item.normText) || [];
          arr.push(item);
          mapA.set(item.normText, arr);
        });
        listB.forEach(item => {
          const arr = mapB.get(item.normText) || [];
          arr.push(item);
          mapB.set(item.normText, arr);
        });

        const matchedRows: AlignedRow[] = [];
        const leftoverA: Item[] = [];
        const leftoverB: Item[] = [];

        // 1. Exact matches across entire files (regardless of original line order)
        const allNormTexts = new Set([...mapA.keys(), ...mapB.keys()]);
        allNormTexts.forEach(normKey => {
          const aItems = mapA.get(normKey) || [];
          const bItems = mapB.get(normKey) || [];
          const commonLen = Math.min(aItems.length, bItems.length);

          for (let i = 0; i < commonLen; i++) {
            matchCount++;
            matchedRows.push({
              index: 0,
              lineNumA: aItems[i].origLine,
              lineNumB: bItems[i].origLine,
              keyVal: aItems[i].keyText,
              contentA: aItems[i].text,
              contentB: bItems[i].text,
              rawRowA: aItems[i].raw,
              rawRowB: bItems[i].raw,
              status: 'match'
            });
          }
          for (let i = commonLen; i < aItems.length; i++) leftoverA.push(aItems[i]);
          for (let i = commonLen; i < bItems.length; i++) leftoverB.push(bItems[i]);
        });

        // 2. Try matching leftovers by Key (first column or selected key column) so modified lines align on the same row!
        const keyMapB = new Map<string, Item[]>();
        leftoverB.forEach(item => {
          if (item.normKey) {
            const arr = keyMapB.get(item.normKey) || [];
            arr.push(item);
            keyMapB.set(item.normKey, arr);
          }
        });

        const unmatchedA: Item[] = [];
        const pairedRows: AlignedRow[] = [];

        leftoverA.forEach(itemA => {
          const bCandidates = itemA.normKey ? keyMapB.get(itemA.normKey) : undefined;
          if (bCandidates && bCandidates.length > 0) {
            const itemB = bCandidates.shift()!;
            modifiedCount++;
            pairedRows.push({
              index: 0,
              lineNumA: itemA.origLine,
              lineNumB: itemB.origLine,
              keyVal: itemA.keyText,
              contentA: itemA.text,
              contentB: itemB.text,
              rawRowA: itemA.raw,
              rawRowB: itemB.raw,
              status: 'modified'
            });
          } else {
            unmatchedA.push(itemA);
          }
        });

        const unmatchedB: Item[] = [];
        keyMapB.forEach(arr => unmatchedB.push(...arr));
        leftoverB.filter(x => !x.normKey).forEach(x => unmatchedB.push(x));

        // Sort unmatched items so similar strings appear next to each other
        if (settings.sortBeforeCompare) {
          unmatchedA.sort((a, b) => a.normText.localeCompare(b.normText, 'th'));
          unmatchedB.sort((a, b) => a.normText.localeCompare(b.normText, 'th'));
        }

        unmatchedA.forEach(itemA => {
          onlyACount++;
          pairedRows.push({
            index: 0,
            lineNumA: itemA.origLine,
            lineNumB: null,
            keyVal: itemA.keyText,
            contentA: itemA.text,
            contentB: '',
            rawRowA: itemA.raw,
            status: 'only_a'
          });
        });

        unmatchedB.forEach(itemB => {
          onlyBCount++;
          pairedRows.push({
            index: 0,
            lineNumA: null,
            lineNumB: itemB.origLine,
            keyVal: itemB.keyText,
            contentA: '',
            contentB: itemB.text,
            rawRowB: itemB.raw,
            status: 'only_b'
          });
        });

        // Combine and sort so everything is aligned cleanly
        const combined = [...pairedRows, ...matchedRows];
        if (settings.sortBeforeCompare) {
          combined.sort((a, b) => {
            // Put differences first or sort alphabetically by content/key
            const strA = normalizeStr(a.contentA || a.contentB);
            const strB = normalizeStr(b.contentA || b.contentB);
            return strA.localeCompare(strB, 'th', { numeric: true });
          });
        }

        combined.forEach((r, idx) => {
          r.index = idx + 1;
          alignedRows.push(r);
        });
      } else if (compareMode === 'key_match') {
        // Mode 2: Key Column Alignment (like VLOOKUP / SQL FULL OUTER JOIN)
        const mapA = new Map<string, Item[]>();
        const mapB = new Map<string, Item[]>();
        const allKeysOrder: string[] = [];
        const seenKeys = new Set<string>();

        listA.forEach(item => {
          const k = item.normKey || `__EMPTY_${item.origLine}`;
          if (!seenKeys.has(k)) {
            seenKeys.add(k);
            allKeysOrder.push(k);
          }
          const arr = mapA.get(k) || [];
          arr.push(item);
          mapA.set(k, arr);
        });

        listB.forEach(item => {
          const k = item.normKey || `__EMPTY_B_${item.origLine}`;
          if (!seenKeys.has(k)) {
            seenKeys.add(k);
            allKeysOrder.push(k);
          }
          const arr = mapB.get(k) || [];
          arr.push(item);
          mapB.set(k, arr);
        });

        if (settings.sortBeforeCompare) {
          allKeysOrder.sort((a, b) => a.localeCompare(b, 'th', { numeric: true }));
        }

        let idxCounter = 1;
        allKeysOrder.forEach(k => {
          const aItems = mapA.get(k) || [];
          const bItems = mapB.get(k) || [];
          const maxLen = Math.max(aItems.length, bItems.length);

          for (let i = 0; i < maxLen; i++) {
            const itemA = aItems[i];
            const itemB = bItems[i];

            if (itemA && itemB) {
              const isSame = itemA.normText === itemB.normText;
              if (isSame) matchCount++;
              else modifiedCount++;

              alignedRows.push({
                index: idxCounter++,
                lineNumA: itemA.origLine,
                lineNumB: itemB.origLine,
                keyVal: itemA.keyText || itemB.keyText,
                contentA: itemA.text,
                contentB: itemB.text,
                rawRowA: itemA.raw,
                rawRowB: itemB.raw,
                status: isSame ? 'match' : 'modified'
              });
            } else if (itemA) {
              onlyACount++;
              alignedRows.push({
                index: idxCounter++,
                lineNumA: itemA.origLine,
                lineNumB: null,
                keyVal: itemA.keyText,
                contentA: itemA.text,
                contentB: '',
                rawRowA: itemA.raw,
                status: 'only_a'
              });
            } else if (itemB) {
              onlyBCount++;
              alignedRows.push({
                index: idxCounter++,
                lineNumA: null,
                lineNumB: itemB.origLine,
                keyVal: itemB.keyText,
                contentA: '',
                contentB: itemB.text,
                rawRowB: itemB.raw,
                status: 'only_b'
              });
            }
          }
        });
      } else {
        // Mode 3: Strict Line-by-Line (with optional A-Z sort first)
        const sortedA = settings.sortBeforeCompare
          ? [...listA].sort((a, b) => a.normText.localeCompare(b.normText, 'th', { numeric: true }))
          : listA;
        const sortedB = settings.sortBeforeCompare
          ? [...listB].sort((a, b) => a.normText.localeCompare(b.normText, 'th', { numeric: true }))
          : listB;

        const maxLen = Math.max(sortedA.length, sortedB.length);
        for (let i = 0; i < maxLen; i++) {
          const itemA = sortedA[i];
          const itemB = sortedB[i];

          if (itemA && itemB) {
            const isSame = itemA.normText === itemB.normText;
            if (isSame) matchCount++;
            else modifiedCount++;

            alignedRows.push({
              index: i + 1,
              lineNumA: itemA.origLine,
              lineNumB: itemB.origLine,
              keyVal: `#${i + 1}`,
              contentA: itemA.text,
              contentB: itemB.text,
              rawRowA: itemA.raw,
              rawRowB: itemB.raw,
              status: isSame ? 'match' : 'modified'
            });
          } else if (itemA) {
            onlyACount++;
            alignedRows.push({
              index: i + 1,
              lineNumA: itemA.origLine,
              lineNumB: null,
              keyVal: `#${i + 1}`,
              contentA: itemA.text,
              contentB: '',
              rawRowA: itemA.raw,
              status: 'only_a'
            });
          } else if (itemB) {
            onlyBCount++;
            alignedRows.push({
              index: i + 1,
              lineNumA: null,
              lineNumB: itemB.origLine,
              keyVal: `#${i + 1}`,
              contentA: '',
              contentB: itemB.text,
              rawRowB: itemB.raw,
              status: 'only_b'
            });
          }
        }
      }

      const totalDiffs = modifiedCount + onlyACount + onlyBCount;
      setResult({
        totalAligned: alignedRows.length,
        matchCount,
        modifiedCount,
        onlyACount,
        onlyBCount,
        rows: alignedRows,
        isTruncated: alignedRows.length > MAX_DISPLAY_ROWS
      });

      if (totalDiffs === 0) {
        setStatusFilter('all');
        setStatus('✓ ข้อมูลตรงกันสมบูรณ์ 100%');
      } else {
        setStatusFilter('diff_only');
        setStatus(`พบจุดต่าง ${totalDiffs.toLocaleString()} รายการ (จัดเรียงเทียบให้แล้ว)`);
      }
      setIsProcessing(false);
    }, 80);
  };

  // Filtered rows for display
  const filteredRows = useMemo(() => {
    if (!result) return [];
    return result.rows.filter(r => {
      if (statusFilter === 'diff_only' && r.status === 'match') return false;
      if (statusFilter !== 'all' && statusFilter !== 'diff_only' && r.status !== statusFilter) return false;
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase();
        return (
          r.contentA.toLowerCase().includes(q) ||
          r.contentB.toLowerCase().includes(q) ||
          r.keyVal.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [result, statusFilter, searchTerm]);

  const displayedRows = useMemo(() => {
    return filteredRows.slice(0, MAX_DISPLAY_ROWS);
  }, [filteredRows]);

  const matchPct = useMemo(() => {
    if (!result || result.totalAligned === 0) return '0.0';
    return ((result.matchCount / result.totalAligned) * 100).toFixed(1);
  }, [result]);

  // Export Multi-Sheet Excel Report
  const exportReport = () => {
    if (!result) return;
    const wb = XLSX.utils.book_new();

    const statusLabel = (s: DiffStatus) => {
      if (s === 'match') return 'ตรงกัน (Match)';
      if (s === 'modified') return 'ข้อมูลไม่ตรง (Modified)';
      if (s === 'only_a') return 'มีเฉพาะฝั่ง A (Missing in B)';
      return 'มีเฉพาะฝั่ง B (Missing in A)';
    };

    // 1. All Aligned Rows
    const allSheetData = result.rows.map(r => ({
      'ลำดับที่จัดเรียง': r.index,
      'สถานะ': statusLabel(r.status),
      'Key / รหัสอ้างอิง': r.keyVal,
      'บรรทัดเดิม (A)': r.lineNumA ?? '-',
      'ข้อมูลฝั่ง A': r.contentA || '-',
      'บรรทัดเดิม (B)': r.lineNumB ?? '-',
      'ข้อมูลฝั่ง B': r.contentB || '-'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allSheetData), 'All_Aligned');

    // 2. Differences Only
    const diffSheetData = result.rows
      .filter(r => r.status !== 'match')
      .map(r => ({
        'ลำดับ': r.index,
        'สถานะ': statusLabel(r.status),
        'Key / รหัสอ้างอิง': r.keyVal,
        'บรรทัดเดิม (A)': r.lineNumA ?? '-',
        'ข้อมูลฝั่ง A': r.contentA || '-',
        'บรรทัดเดิม (B)': r.lineNumB ?? '-',
        'ข้อมูลฝั่ง B': r.contentB || '-'
      }));
    if (diffSheetData.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(diffSheetData), 'Differences_Only');
    }

    // 3. Only in A & Only in B
    const onlyAData = result.rows
      .filter(r => r.status === 'only_a')
      .map(r => ({ 'บรรทัดเดิม (A)': r.lineNumA, 'Key': r.keyVal, 'ข้อมูลฝั่ง A': r.contentA }));
    if (onlyAData.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(onlyAData), 'Only_In_A');
    }

    const onlyBData = result.rows
      .filter(r => r.status === 'only_b')
      .map(r => ({ 'บรรทัดเดิม (B)': r.lineNumB, 'Key': r.keyVal, 'ข้อมูลฝั่ง B': r.contentB }));
    if (onlyBData.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(onlyBData), 'Only_In_B');
    }

    XLSX.writeFile(wb, `Aligned_Comparison_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Copy filtered rows to clipboard
  const copyAlignedToClipboard = () => {
    if (filteredRows.length === 0) return;
    const header = ['ลำดับ', 'สถานะ', 'บรรทัด A', 'ข้อมูลฝั่ง A', 'บรรทัด B', 'ข้อมูลฝั่ง B'].join('\t');
    const lines = filteredRows.map(r =>
      [r.index, r.status.toUpperCase(), r.lineNumA ?? '-', r.contentA, r.lineNumB ?? '-', r.contentB].join('\t')
    );
    navigator.clipboard.writeText([header, ...lines].join('\n'));
    setCopiedState('table');
    setTimeout(() => setCopiedState(null), 2000);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0a0c0f] pb-24 text-white">
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

        ::-webkit-scrollbar { width: 6px; height: 6px; }
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

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-10">

        {/* ── HEADER ── */}
        <header className="fade-up mb-8" style={{ animationDelay: '0ms' }}>
          <div className="mb-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.06]" />
            <span className="font-mono-custom text-[10px] tracking-[0.3em] text-white/25">BILLONE · SMART FILE COMPARATOR</span>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link
                href="/mainocs"
                className="group mb-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-mono-custom text-[11px] tracking-widest text-white/40 transition-all hover:border-white/20 hover:text-white/70"
              >
                <ArrowLeft size={12} className="transition-transform group-hover:-translate-x-0.5" />
                BACK TO HUB
              </Link>
              <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-white">
                Smart <span className="bg-gradient-to-r from-amber-400 via-emerald-300 to-sky-400 bg-clip-text text-transparent">Comparator</span>
              </h1>
              <p className="mt-1.5 font-mono-custom text-xs text-white/40">
                จัดเรียงบรรทัดที่เหมือนกันให้ตรงกันอัตโนมัติ · ไฮไลต์จุดต่างระดับคำ · รองรับทั้งอัปโหลดไฟล์และวางข้อความ
              </p>
            </div>

            {/* Status pill */}
            <div className="mt-1 flex shrink-0 items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 backdrop-blur-sm">
              <div className={`pulse-dot h-2 w-2 rounded-full ${status.startsWith('✓') ? 'bg-emerald-400' : isProcessing ? 'bg-amber-400' : 'bg-sky-400'}`} />
              <span className="font-mono-custom text-[11px] text-white/70">{status}</span>
            </div>
          </div>
        </header>

        {/* ── MODE SELECTOR BAR ── */}
        <div className="fade-up mb-6 grid grid-cols-1 gap-3 md:grid-cols-3" style={{ animationDelay: '40ms' }}>
          {[
            {
              id: 'smart_align' as CompareMode,
              icon: Layers,
              title: '1. จัดเรียงจับคู่อัตโนมัติ (แนะนำ)',
              desc: 'ดึงบรรทัดที่เหมือนกันมาวางคู่กันให้อัตโนมัติ แม้ลำดับบรรทัดในไฟล์จะสลับกัน'
            },
            {
              id: 'key_match' as CompareMode,
              icon: Key,
              title: '2. จับคู่ด้วยคอลัมน์ Key / รหัส',
              desc: 'เรียงและจับคู่บรรทัดโดยยึดรหัสอ้างอิง (เช่น เบอร์โทร, Promo ID) ให้ตรงกัน'
            },
            {
              id: 'line_by_line' as CompareMode,
              icon: SortAsc,
              title: '3. เทียบบรรทัดต่อบรรทัด (1:1)',
              desc: 'เทียบตามลำดับบรรทัดที่ 1, 2, 3... (เลือกเปิดเรียง A-Z ก่อนเทียบได้)'
            }
          ].map(m => {
            const Icon = m.icon;
            const active = compareMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setCompareMode(m.id)}
                className={`flex items-start gap-3.5 rounded-2xl border p-4 text-left transition-all ${
                  active
                    ? 'border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_25px_rgba(16,185,129,0.12)]'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
                }`}
              >
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${active ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-300' : 'border-white/10 bg-white/5 text-white/40'}`}>
                  <Icon size={17} />
                </div>
                <div>
                  <div className={`font-mono-custom text-xs font-bold ${active ? 'text-emerald-300' : 'text-white/80'}`}>
                    {m.title}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/40">{m.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── CONFIG & INPUT CARD ── */}
        <div className="fade-up mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm" style={{ animationDelay: '80ms' }}>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

            {/* File Slots (8 cols) */}
            <div className="lg:col-span-8 grid grid-cols-1 gap-4 md:grid-cols-2 relative">
              {/* Swap Button between A and B */}
              <button
                onClick={handleSwapFiles}
                title="สลับข้อมูลฝั่ง A กับ B"
                className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#12161f] text-white/60 shadow-lg transition-all hover:scale-110 hover:border-emerald-400/50 hover:text-emerald-300"
              >
                <ArrowRightLeft size={14} />
              </button>

              {([fileA, fileB] as FileState[]).map((f, i) => {
                const side: 'A' | 'B' = i === 0 ? 'A' : 'B';
                const tag = side === 'A' ? 'SOURCE A (ต้นฉบับ)' : 'SOURCE B (ไฟล์เทียบ)';
                const isDragging = dragOverSide === side;
                const accentA = 'border-amber-500/35 bg-amber-500/[0.04]';
                const accentB = 'border-sky-500/35 bg-sky-500/[0.04]';
                const hasData = f.content.length > 0;
                const accent = isDragging
                  ? 'border-emerald-400 bg-emerald-500/10'
                  : hasData
                  ? i === 0
                    ? accentA
                    : accentB
                  : 'border-white/10 bg-white/[0.02]';

                return (
                  <div
                    key={side}
                    onDragOver={e => {
                      e.preventDefault();
                      setDragOverSide(side);
                    }}
                    onDragLeave={() => setDragOverSide(null)}
                    onDrop={e => {
                      e.preventDefault();
                      setDragOverSide(null);
                      const droppedFile = e.dataTransfer.files?.[0];
                      if (droppedFile) processUploadedFile(droppedFile, side);
                    }}
                    className={`flex flex-col justify-between rounded-xl border-2 border-dashed p-5 transition-all duration-300 ${accent}`}
                  >
                    <div>
                      {/* Top bar: Tag + Mode Toggle */}
                      <div className="mb-4 flex items-center justify-between gap-2">
                        <span
                          className={`rounded-md border px-2.5 py-1 font-mono-custom text-[10px] font-bold tracking-[0.15em] ${
                            i === 0
                              ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                              : 'border-sky-500/30 bg-sky-500/10 text-sky-400'
                          }`}
                        >
                          {tag}
                        </span>

                        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 p-0.5">
                          <button
                            type="button"
                            onClick={() =>
                              (side === 'A' ? setFileA : setFileB)(prev => ({ ...prev, inputMode: 'file' }))
                            }
                            className={`flex items-center gap-1 rounded-md px-2 py-1 font-mono-custom text-[10px] transition-all ${
                              f.inputMode === 'file'
                                ? 'bg-white/15 text-white'
                                : 'text-white/40 hover:text-white/70'
                            }`}
                          >
                            <Upload size={11} /> ไฟล์
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              (side === 'A' ? setFileA : setFileB)(prev => ({ ...prev, inputMode: 'paste' }))
                            }
                            className={`flex items-center gap-1 rounded-md px-2 py-1 font-mono-custom text-[10px] transition-all ${
                              f.inputMode === 'paste'
                                ? 'bg-white/15 text-white'
                                : 'text-white/40 hover:text-white/70'
                            }`}
                          >
                            <ClipboardPaste size={11} /> วางข้อความ
                          </button>
                        </div>
                      </div>

                      {/* File Upload Mode */}
                      {f.inputMode === 'file' ? (
                        <div>
                          <input
                            type="file"
                            id={`f-${side}`}
                            accept=".xlsx,.xls,.csv,.txt,.log,.sql,.json"
                            className="hidden"
                            onChange={e => handleFileChange(e, side)}
                          />
                          <div
                            onClick={() => document.getElementById(`f-${side}`)?.click()}
                            className="group cursor-pointer rounded-xl border border-white/10 bg-black/20 p-4 text-center transition-all hover:border-white/25 hover:bg-white/[0.04]"
                          >
                            <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 group-hover:text-white">
                              {f.isExcel ? <TableIcon size={16} /> : <FileText size={16} />}
                            </div>
                            <p className="truncate font-mono-custom text-xs font-bold text-white/80">
                              {f.file ? f.name : 'คลิกเลือกไฟล์ หรือลากไฟล์มาวาง'}
                            </p>
                            <p className="mt-1 font-mono-custom text-[10px] text-white/35">
                              {f.file
                                ? `${f.content.length.toLocaleString()} แถว ${
                                    f.isExcel ? `· ${f.headers.length} คอลัมน์` : ''
                                  }`
                                : 'รองรับ Excel (.xlsx, .csv) และ Text (.txt, .sql)'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        /* Paste Text Mode */
                        <div>
                          <textarea
                            rows={4}
                            placeholder={`วางข้อมูลฝั่ง ${side} ที่นี่ (ก๊อปปี้จาก Excel หรือ Notepad มาวางได้เลย)...`}
                            value={f.pastedText}
                            onChange={e => handlePasteChange(e.target.value, side)}
                            className="w-full rounded-xl border border-white/10 bg-black/30 p-3 font-mono-custom text-xs text-white/80 placeholder:text-white/25 focus:border-emerald-500/40 focus:outline-none"
                          />
                          <p className="mt-1 font-mono-custom text-[10px] text-white/35">
                            {f.content.length > 0
                              ? `รับข้อมูลแล้ว ${f.content.length.toLocaleString()} บรรทัด`
                              : 'รองรับ Tab-separated จาก Excel และข้อความทีละบรรทัด'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Excel Sheet & Column Pickers */}
                    {f.content.length > 0 && (
                      <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                        {/* Sheet selector if multiple sheets */}
                        {f.sheetNames.length > 1 && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono-custom text-[10px] text-white/40">Sheet:</span>
                            <select
                              className="flex-1 rounded-lg border border-white/10 bg-[#0a0c0f] px-2.5 py-1.5 font-mono-custom text-[11px] text-white/70 outline-none focus:border-emerald-500/40"
                              value={f.selectedSheet}
                              onChange={e => handleSheetChange(e.target.value, side)}
                            >
                              {f.sheetNames.map(s => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Key Column Selector (when in key_match or smart_align with Excel) */}
                        {f.isExcel && f.headers.length > 0 && (
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block font-mono-custom text-[10px] text-white/40">
                                คอลัมน์อ้างอิง (Key):
                              </label>
                              <select
                                className="w-full rounded-lg border border-white/10 bg-[#0a0c0f] px-2.5 py-1.5 font-mono-custom text-[11px] text-emerald-300/90 outline-none focus:border-emerald-500/40"
                                value={side === 'A' ? keyColA : keyColB}
                                onChange={e =>
                                  side === 'A' ? setKeyColA(e.target.value) : setKeyColB(e.target.value)
                                }
                              >
                                <option value="">— คอลัมน์แรก ({f.headers[0] || 'Col 1'}) —</option>
                                {f.headers.map((h, idx) => (
                                  <option key={idx} value={h}>
                                    {h}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="mb-1 block font-mono-custom text-[10px] text-white/40">
                                คอลัมน์ที่จะเทียบค่า:
                              </label>
                              <select
                                className="w-full rounded-lg border border-white/10 bg-[#0a0c0f] px-2.5 py-1.5 font-mono-custom text-[11px] text-white/70 outline-none focus:border-emerald-500/40"
                                value={side === 'A' ? selectedColA : selectedColB}
                                onChange={e =>
                                  side === 'A'
                                    ? setSelectedColA(e.target.value)
                                    : setSelectedColB(e.target.value)
                                }
                              >
                                <option value="">— เทียบทั้งแถว (Full Row) —</option>
                                {f.headers.map((h, idx) => (
                                  <option key={idx} value={h}>
                                    {h}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Settings + Run Button (4 cols) */}
            <div className="lg:col-span-4 flex flex-col justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings2 size={14} className="text-emerald-400/70" />
                    <span className="font-mono-custom text-[10px] font-bold tracking-[0.2em] text-white/50">
                      ALIGNMENT & OPTIONS
                    </span>
                  </div>
                  {(fileA.content.length > 0 || fileB.content.length > 0) && (
                    <button
                      onClick={() => {
                        setFileA(INITIAL_FILE_STATE);
                        setFileB(INITIAL_FILE_STATE);
                        setResult(null);
                        setStatus('ล้างข้อมูลแล้ว');
                      }}
                      className="flex items-center gap-1 font-mono-custom text-[10px] text-rose-400/70 hover:text-rose-300"
                    >
                      <Trash2 size={11} /> ล้างทั้งหมด
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {[
                    {
                      key: 'sortBeforeCompare',
                      label: 'จัดเรียงบรรทัดให้ตรงกันอัตโนมัติ (Sort A-Z)',
                      desc: 'เรียงลำดับข้อมูลให้ตรงกันก่อนตรวจหาจุดต่าง'
                    },
                    {
                      key: 'trimWhitespace',
                      label: 'ตัดช่องว่างเกินหน้า-หลัง (Auto-trim)',
                      desc: 'ลดปัญหาเคาะ Space เกินทำให้ขึ้นว่าไม่ตรง'
                    },
                    {
                      key: 'ignoreEmptyLines',
                      label: 'ข้ามบรรทัดว่าง (Ignore empty rows)',
                      desc: 'ไม่นำบรรทัดที่ว่างเปล่ามาคิดเป็นจุดต่าง'
                    },
                    {
                      key: 'skipHeaderRow',
                      label: 'ข้ามแถวหัวตาราง Excel (Skip Header)',
                      desc: 'เริ่มเทียบตั้งแต่แถวข้อมูลจริงในไฟล์ Excel'
                    },
                    {
                      key: 'caseSensitive',
                      label: 'แยกตัวพิมพ์เล็ก-ใหญ่ (Case sensitive)',
                      desc: 'หากปิดไว้ ABC กับ abc จะถือว่าตรงกัน'
                    }
                  ].map(opt => {
                    const checked = settings[opt.key as keyof typeof settings];
                    return (
                      <label
                        key={opt.key}
                        onClick={() =>
                          setSettings(s => ({ ...s, [opt.key]: !s[opt.key as keyof typeof s] }))
                        }
                        className="flex cursor-pointer items-start gap-3 rounded-lg p-1.5 transition-colors hover:bg-white/[0.03]"
                      >
                        <div
                          className={`mt-0.5 relative h-5 w-9 shrink-0 rounded-full border transition-all ${
                            checked
                              ? 'border-emerald-500/50 bg-emerald-500/25'
                              : 'border-white/15 bg-white/5'
                          }`}
                        >
                          <div
                            className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all ${
                              checked ? 'left-4 bg-emerald-400' : 'left-0.5 bg-white/30'
                            }`}
                          />
                        </div>
                        <div>
                          <div className="font-mono-custom text-[11px] font-bold text-white/80">
                            {opt.label}
                          </div>
                          <div className="text-[10px] text-white/35">{opt.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={handleCompare}
                disabled={!isReady || isProcessing}
                className="relative mt-5 w-full overflow-hidden rounded-xl border border-emerald-500/40 bg-emerald-500/20 py-3.5 font-mono-custom text-xs font-bold tracking-[0.2em] text-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.15)] transition-all hover:bg-emerald-500/30 hover:border-emerald-400 disabled:pointer-events-none disabled:opacity-25"
              >
                {isProcessing ? 'กำลังจัดเรียงและเปรียบเทียบ...' : '⚡ จัดเรียงและเปรียบเทียบทันที'}
                <div className="absolute bottom-0 left-0 h-[1px] w-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
              </button>
            </div>
          </div>
        </div>

        {/* ── RESULTS SECTION ── */}
        {result && (
          <div className="fade-up space-y-5" style={{ animationDelay: '0ms' }}>

            {/* Summary KPI Cards (Clickable to filter!) */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <button
                onClick={() => setStatusFilter('all')}
                className={`rounded-xl border p-4 text-left transition-all ${
                  statusFilter === 'all'
                    ? 'border-white/30 bg-white/10'
                    : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05]'
                }`}
              >
                <p className="font-mono-custom text-[10px] tracking-[0.15em] text-white/40">
                  ทั้งหมดที่นำมาเรียงเทียบ
                </p>
                <p className="mt-1 font-display text-2xl font-extrabold text-white">
                  {result.totalAligned.toLocaleString()}
                </p>
                <p className="mt-0.5 font-mono-custom text-[10px] text-emerald-400">
                  ความเหมือน {matchPct}%
                </p>
              </button>

              <button
                onClick={() => setStatusFilter('match')}
                className={`rounded-xl border p-4 text-left transition-all ${
                  statusFilter === 'match'
                    ? 'border-emerald-500/50 bg-emerald-500/15'
                    : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-mono-custom text-[10px] tracking-[0.15em] text-emerald-400/80">
                    ตรงกัน (MATCH)
                  </p>
                  <CheckCircle2 size={14} className="text-emerald-400" />
                </div>
                <p className="mt-1 font-display text-2xl font-extrabold text-emerald-400">
                  {result.matchCount.toLocaleString()}
                </p>
                <p className="mt-0.5 font-mono-custom text-[10px] text-white/35">คลิกเพื่อดูรายการที่ตรงกัน</p>
              </button>

              <button
                onClick={() => setStatusFilter('modified')}
                className={`rounded-xl border p-4 text-left transition-all ${
                  statusFilter === 'modified'
                    ? 'border-rose-500/50 bg-rose-500/15'
                    : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-mono-custom text-[10px] tracking-[0.15em] text-rose-400/80">
                    ค่าไม่ตรงกัน (DIFF)
                  </p>
                  <AlertTriangle size={14} className="text-rose-400" />
                </div>
                <p className="mt-1 font-display text-2xl font-extrabold text-rose-400">
                  {result.modifiedCount.toLocaleString()}
                </p>
                <p className="mt-0.5 font-mono-custom text-[10px] text-white/35">วางเทียบข้างกันพร้อมไฮไลต์</p>
              </button>

              <button
                onClick={() => setStatusFilter('only_a')}
                className={`rounded-xl border p-4 text-left transition-all ${
                  statusFilter === 'only_a'
                    ? 'border-amber-500/50 bg-amber-500/15'
                    : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-mono-custom text-[10px] tracking-[0.15em] text-amber-400/80">
                    มีเฉพาะฝั่ง A
                  </p>
                  <MinusCircle size={14} className="text-amber-400" />
                </div>
                <p className="mt-1 font-display text-2xl font-extrabold text-amber-400">
                  {result.onlyACount.toLocaleString()}
                </p>
                <p className="mt-0.5 font-mono-custom text-[10px] text-white/35">ตกหล่นในไฟล์ B</p>
              </button>

              <button
                onClick={() => setStatusFilter('only_b')}
                className={`rounded-xl border p-4 text-left transition-all ${
                  statusFilter === 'only_b'
                    ? 'border-sky-500/50 bg-sky-500/15'
                    : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-mono-custom text-[10px] tracking-[0.15em] text-sky-400/80">
                    มีเฉพาะฝั่ง B
                  </p>
                  <PlusCircle size={14} className="text-sky-400" />
                </div>
                <p className="mt-1 font-display text-2xl font-extrabold text-sky-400">
                  {result.onlyBCount.toLocaleString()}
                </p>
                <p className="mt-0.5 font-mono-custom text-[10px] text-white/35">เกินมาในไฟล์ B</p>
              </button>
            </div>

            {/* Filter Pills + Search + Export Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  {
                    id: 'diff_only' as const,
                    label: `เฉพาะจุดต่าง (${(
                      result.modifiedCount +
                      result.onlyACount +
                      result.onlyBCount
                    ).toLocaleString()})`
                  },
                  { id: 'all' as const, label: `ดูทั้งหมดที่เรียงคู่กัน (${result.totalAligned.toLocaleString()})` },
                  { id: 'modified' as const, label: `ค่าไม่ตรง (${result.modifiedCount.toLocaleString()})` },
                  { id: 'only_a' as const, label: `มีเฉพาะ A (${result.onlyACount.toLocaleString()})` },
                  { id: 'only_b' as const, label: `มีเฉพาะ B (${result.onlyBCount.toLocaleString()})` },
                  { id: 'match' as const, label: `ตรงกัน (${result.matchCount.toLocaleString()})` }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    className={`rounded-lg px-3 py-1.5 font-mono-custom text-[11px] transition-all ${
                      statusFilter === tab.id
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                        : 'bg-white/5 text-white/50 hover:text-white/80 border border-transparent'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search & Actions */}
              <div className="flex flex-1 items-center justify-end gap-2.5 min-w-[280px]">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={13} />
                  <input
                    type="text"
                    placeholder="ค้นหาคำ, เบอร์, รหัสโปร..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/30 py-2 pl-8 pr-3 font-mono-custom text-xs text-white/80 outline-none placeholder:text-white/25 focus:border-emerald-500/40"
                  />
                </div>

                <button
                  onClick={copyAlignedToClipboard}
                  className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 font-mono-custom text-[11px] text-white/70 transition-all hover:border-white/30 hover:text-white"
                >
                  {copiedState === 'table' ? (
                    <>
                      <Check size={13} className="text-emerald-400" /> คัดลอกแล้ว
                    </>
                  ) : (
                    <>
                      <Copy size={13} /> ก๊อปปี้ตาราง
                    </>
                  )}
                </button>

                <button
                  onClick={exportReport}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 font-mono-custom text-[11px] font-bold tracking-wider text-emerald-300 transition-all hover:bg-emerald-500/25"
                >
                  <Download size={13} /> EXPORT EXCEL
                </button>
              </div>
            </div>

            {/* Aligned Comparison Table */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1017]">
              {/* Table Header Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-[#0a0c10] px-6 py-3.5">
                <div className="flex items-center gap-2.5">
                  <Eye size={15} className="text-emerald-400" />
                  <h2 className="font-display text-sm font-bold text-white">
                    ตารางเปรียบเทียบข้อมูลที่จัดเรียงบรรทัดตรงกันแล้ว
                  </h2>
                  <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono-custom text-[10px] text-white/40">
                    แสดง {displayedRows.length.toLocaleString()} จาก {filteredRows.length.toLocaleString()} รายการ
                  </span>
                </div>

                <div className="flex items-center gap-3 font-mono-custom text-[10px] text-white/40">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-amber-400/70" /> ไฮไลต์สีส้ม = จุดต่างฝั่ง A
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-sky-400/70" /> ไฮไลต์สีฟ้า = จุดต่างฝั่ง B
                  </span>
                </div>
              </div>

              <div className="max-h-[640px] overflow-y-auto">
                <table className="w-full border-collapse text-left">
                  <thead className="sticky top-0 z-10 bg-[#0a0c10]/95 backdrop-blur-md">
                    <tr className="border-b border-white/[0.08]">
                      <th className="w-16 px-4 py-3 font-mono-custom text-[10px] tracking-[0.15em] text-white/35">
                        ลำดับ
                      </th>
                      <th className="w-28 px-3 py-3 font-mono-custom text-[10px] tracking-[0.15em] text-white/35">
                        สถานะ
                      </th>
                      <th className="w-20 px-3 py-3 font-mono-custom text-[10px] tracking-[0.1em] text-amber-400/70 text-center">
                        บรรทัด A
                      </th>
                      <th className="w-[40%] px-4 py-3 font-mono-custom text-[10px] tracking-[0.15em] text-amber-400">
                        SOURCE A ({fileA.name || 'ฝั่ง A'})
                      </th>
                      <th className="w-20 px-3 py-3 font-mono-custom text-[10px] tracking-[0.1em] text-sky-400/70 text-center">
                        บรรทัด B
                      </th>
                      <th className="w-[40%] px-4 py-3 font-mono-custom text-[10px] tracking-[0.15em] text-sky-400">
                        SOURCE B ({fileB.name || 'ฝั่ง B'})
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {displayedRows.map(row => {
                      const badge =
                        row.status === 'match'
                          ? { text: '✓ ตรงกัน', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' }
                          : row.status === 'modified'
                          ? { text: '≠ ไม่ตรงกัน', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' }
                          : row.status === 'only_a'
                          ? { text: 'เฉพาะ A', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' }
                          : { text: 'เฉพาะ B', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };

                      return (
                        <tr
                          key={row.index}
                          className={`group transition-colors hover:bg-white/[0.03] ${
                            row.status === 'match' ? 'opacity-75 hover:opacity-100' : ''
                          }`}
                        >
                          <td className="px-4 py-3 font-mono-custom text-xs text-white/30">
                            #{row.index}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`inline-block rounded-md border px-2 py-0.5 font-mono-custom text-[10px] font-bold ${badge.cls}`}
                            >
                              {badge.text}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center font-mono-custom text-[11px] text-amber-300/50">
                            {row.lineNumA ? `L${row.lineNumA}` : '—'}
                          </td>
                          <td className="px-4 py-2.5 align-top">
                            <div
                              className={`rounded-lg border px-3 py-2 font-mono-custom text-xs leading-relaxed break-all ${
                                row.status === 'match'
                                  ? 'border-white/5 bg-white/[0.02] text-white/60'
                                  : row.status === 'only_b'
                                  ? 'border-dashed border-white/5 bg-transparent text-white/20'
                                  : 'border-amber-500/20 bg-amber-500/[0.06] text-amber-100'
                              }`}
                            >
                              {row.status === 'modified'
                                ? renderInlineDiff(row.contentA, row.contentB, 'A')
                                : row.contentA || <span className="text-white/20 italic">— ไม่มีในฝั่ง A —</span>}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center font-mono-custom text-[11px] text-sky-300/50">
                            {row.lineNumB ? `L${row.lineNumB}` : '—'}
                          </td>
                          <td className="px-4 py-2.5 align-top">
                            <div
                              className={`rounded-lg border px-3 py-2 font-mono-custom text-xs leading-relaxed break-all ${
                                row.status === 'match'
                                  ? 'border-white/5 bg-white/[0.02] text-white/60'
                                  : row.status === 'only_a'
                                  ? 'border-dashed border-white/5 bg-transparent text-white/20'
                                  : 'border-sky-500/20 bg-sky-500/[0.06] text-sky-100'
                              }`}
                            >
                              {row.status === 'modified'
                                ? renderInlineDiff(row.contentA, row.contentB, 'B')
                                : row.contentB || <span className="text-white/20 italic">— ไม่มีในฝั่ง B —</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {displayedRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-20 text-center font-mono-custom text-xs text-white/30">
                          ไม่พบรายการในหมวดหมู่นี้ (ลองเปลี่ยนตัวกรองด้านบนเป็น &ldquo;ดูทั้งหมดที่เรียงคู่กัน&rdquo;)
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
          <div
            className="fade-up mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.07] py-24 text-center"
            style={{ animationDelay: '140ms' }}
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-400/60">
              <GitCompare size={24} strokeWidth={1.5} />
            </div>
            <p className="font-display text-lg font-bold text-white/50">
              พร้อมจัดเรียงและเปรียบเทียบไฟล์
            </p>
            <p className="mt-1 max-w-md font-mono-custom text-xs text-white/25">
              อัปโหลดไฟล์ Excel / CSV / TXT หรือวางข้อความทั้ง 2 ฝั่ง ระบบจะดึงบรรทัดที่เหมือนกันมาวางเทียบคู่กันให้อัตโนมัติแม้ลำดับบรรทัดจะสลับกัน
            </p>
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
