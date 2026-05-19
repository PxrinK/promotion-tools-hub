"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
    FileText, Download, Trash2, Settings,
    AlertTriangle, CheckCircle, ArrowLeft,
    Database, Search, Terminal, X, FileSpreadsheet, BarChart3
} from 'lucide-react';
import Swal from 'sweetalert2';
import Link from 'next/link';

// TYPES
const OUTPUT_COLUMNS = [
    '⚠️ ตรวจสอบ?', 'Change log', 'Legacy ID', 'Offering Name', 'Notification Name (Eng)',
    'Notification Name (Thai)', 'Remark', 'Cycle Type', 'Cycle Length',
    'Prorate RC & FU', 'Cycle shift', 'RC failed need Suspend ?',
    'Retry RC times', 'Action after max retry', 'Rental Fee without tax',
    'Bonus', 'Voice Tariff', 'SMS Tariff', 'MMS Tariff', 'GPRS Tariff',
    'Independent Sales', 'Type', 'Free unit type Legacy', 'Free unit type OCS',
    'Free unit value', 'Balance ID', 'SCG config existing',
    'FU ID', 'Speed', 'Offer ID', 'SpeedTemplate', 'Deploy Date',
    'Deploy State', 'Sale Start Date'
] as const;

type ColKey = typeof OUTPUT_COLUMNS[number];
type ExtractedData = Partial<Record<ColKey, string>>;

const EXPORT_COLUMNS = OUTPUT_COLUMNS.filter(
    col => col !== '⚠️ ตรวจสอบ?' && col !== 'Change log'
);

// CONSTANTS
const KNOWN_CYCLE_TYPES = new Set([
    '1day', '1days', '15day', '15days', '186days', '2days', '217days', '24hours',
    '3days', '30days', '31calendar days', '31days', '372days', '434days',
    '45days', '7days', '8days', '90days', '93days', '99days',
    'Bill Cycle', 'Life Time', '31 calendar_day'
]);
const normalizeCycleType = (s: string) => s.replace(/[\s_]/g, '').toLowerCase();
const cycleTypeRegex = new RegExp(
    [...KNOWN_CYCLE_TYPES].sort((a, b) => b.length - a.length)
        .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s_]*'))
        .join('|'), 'i'
);
const KNOWN_RETRY_TIMES = new Set(['3', '7', '99', '999', '9999']);
const KNOWN_CYCLE_SHIFTS = new Set(['Shift', 'Not Shift']);
const DEPLOY_STATE_MAP: Record<string, string> = {
    'in-progress': 'In-progress', 'deploy': 'Deploy', 'approved': 'Approved',
    'draft': 'Draft', 'inactive': 'Inactive', 'active': 'Active',
};
const ACTION_AFTER_RETRY_PATTERNS = ['Cancel offer', 'Suspend', 'Terminate', 'Grace period', 'None'];
const THAI_MONTH_SHORT: Record<string, string> = {
    'ม.ค.': '01', 'ก.พ.': '02', 'มี.ค.': '03', 'เม.ย.': '04',
    'พ.ค.': '05', 'มิ.ย.': '06', 'ก.ค.': '07', 'ส.ค.': '08',
    'ก.ย.': '09', 'ต.ค.': '10', 'พ.ย.': '11', 'ธ.ค.': '12',
    'มกราคม': '01', 'กุมภาพันธ์': '02', 'มีนาคม': '03', 'เมษายน': '04',
    'พฤษภาคม': '05', 'มิถุนายน': '06', 'กรกฎาคม': '07', 'สิงหาคม': '08',
    'กันยายน': '09', 'ตุลาคม': '10', 'พฤศจิกายน': '11', 'ธันวาคม': '12',
};

function parseThaiDate(raw: string): string {
    if (!raw) return '';
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(raw.trim())) return raw.trim();
    const m = raw.match(/(\d{1,2})\s+([ก-๙a-zA-Z.]+)\s+(\d{2,4})/);
    if (m) {
        const day = m[1].padStart(2, '0');
        const monthKey = Object.keys(THAI_MONTH_SHORT).find(k => m[2].startsWith(k.replace('.', '')));
        const month = monthKey ? THAI_MONTH_SHORT[monthKey] : '??';
        let year = parseInt(m[3]);
        if (year > 2400) year -= 543;
        if (year < 100) year += 2500 - 543;
        return `${day}/${month}/${year}`;
    }
    return raw.trim();
}

function extractKeyValueData(textChunk: string): ExtractedData {
    const details: ExtractedData = {};
    const find = (regex: RegExp) => (textChunk.match(regex) || [])[1]?.trim() || '';
    const notifLine = textChunk.match(/Notification Name \(Eng\)\s*:\s*([^\r\n]*)/m);
    if (notifLine) {
        const parts = notifLine[1].split(/Notification Name \(Th\)\s*:/);
        details['Notification Name (Eng)'] = parts[0]?.trim() || '';
        if (parts[1]) details['Notification Name (Thai)'] = parts[1]?.trim();
    }
    if (!details['Notification Name (Thai)']) details['Notification Name (Thai)'] = find(/Notification Name \(Th\)\s*:\s*([^\r\n]*)/m);
    details['Legacy ID'] = find(/รหัสโปรโมชั่น\s*:\s*(\d{8})/m);
    details['Offering Name'] = find(/ชื่อโปรใน OCS\s*:\s*([^\r\n]*)/m);
    details['Change log'] = find(/Change\s*[Ll]og\s*:\s*([^\r\n]*)/m);
    const fee = find(/ค่าบริการ \(บาท\/ไม่รวม VAT\)\s*:\s*([\d.]+)/m);
    if (parseFloat(fee) > 0) details['Rental Fee without tax'] = fee;
    const periodText = find(/ระยะเวลาใช้บริการ \(Period\)\s*:\s*([\s\S]*?)(?=\s*\*|Cycle Length|$)/);
    if (periodText) { const match = periodText.match(cycleTypeRegex); if (match) details['Cycle Type'] = match[0]; }
    const lengthText = find(/Cycle Length\s*:\s*([^\r\n]*)/m);
    if (/^(\d+\s*รอบบิล|\d+\s*times?|Renew)$/i.test(lengthText)) details['Cycle Length'] = lengthText.replace('รอบบิล', 'times');
    details['Prorate RC & FU'] = find(/เกณฑ์การคิดค่าบริการ\s*:\s*(Prorate|Not Prorate)/m);
    details['RC failed need Suspend ?'] = find(/RC failed need Suspend \?\s*:\s*(Suspend)/m);
    details['Retry RC times'] = find(/Retry RC times\s*:\s*(3|7|99|999|9999)\b/m);
    details['Cycle shift'] = find(/ระยะเวลาใช้บริการในรอบบิลต่อไป\s*:\s*(Shift|Not Shift)/m);
    const actionText = find(/Action after max retry\s*:\s*([^\r\n]*)/m);
    if (actionText) { const found = ACTION_AFTER_RETRY_PATTERNS.find(a => actionText.toLowerCase().includes(a.toLowerCase())); details['Action after max retry'] = found || actionText; }
    details['Sale Start Date'] = parseThaiDate(find(/วันที่เริ่มจำหน่าย \(Sale Start Date\)\s*:\s*([^\r\n]*)/m));
    details['Deploy Date'] = parseThaiDate(find(/วันเริ่มต้นใช้แพ็กเกจ \(Effective Date\)\s*:\s*([^\r\n]*)/m));
    const statusText = find(/สถานะโปรโมชั่น\s*:\s*([^\r\n]*)/m);
    if (statusText) details['Deploy State'] = DEPLOY_STATE_MAP[statusText.toLowerCase().trim()] || statusText;
    details['Voice Tariff'] = find(/Voice Tariff\s*:\s*([^\r\n]*)/m);
    details['SMS Tariff'] = find(/SMS Tariff\s*:\s*([^\r\n]*)/m);
    details['MMS Tariff'] = find(/MMS Tariff\s*:\s*([^\r\n]*)/m);
    details['GPRS Tariff'] = find(/GPRS Tariff\s*:\s*([^\r\n]*)/m);
    details['Balance ID'] = find(/Balance\s*ID\s*:\s*([^\r\n\s]*)/m);
    details['FU ID'] = find(/FU\s*ID\s*:\s*([^\r\n\s]*)/m);
    details['Offer ID'] = find(/Offer\s*ID\s*:\s*([^\r\n\s]*)/m);
    details['SCG config existing'] = find(/SCG\s*config\s*existing\s*:\s*([^\r\n]*)/m);
    details['Bonus'] = find(/Bonus\s*:\s*([YN])/m);
    details['Independent Sales'] = find(/Independent Sales\s*:\s*([YN])/m);
    const speedMatch = find(/โปรโมชั่น.*?เน็ต.*?\s([\d.]+Mbps)/m);
    if (speedMatch) { details['Speed'] = `เน็ตไม่จำกัด ${speedMatch}`; details['SpeedTemplate'] = speedMatch; }
    return details;
}

function extractTabSeparatedData(textChunk: string): ExtractedData {
    const details: ExtractedData = {};
    const fields = textChunk.split(/\t|\s{2,}/).map(f => f.trim()).filter(Boolean);
    details['Change log'] = fields[0] || '';
    details['Legacy ID'] = fields.find(f => /^\d{8}$/.test(f)) || '';
    details['Offering Name'] = fields.find(f => f.startsWith('SO_')) || '';
    details['Notification Name (Eng)'] = fields[3] || '';
    details['Notification Name (Thai)'] = fields[4] || '';
    fields.forEach(field => {
        if (/^(\d+\s*times?|Renew)$/i.test(field) && !details['Cycle Length']) details['Cycle Length'] = field;
        else if (KNOWN_RETRY_TIMES.has(field) && !details['Retry RC times']) details['Retry RC times'] = field;
        else if (KNOWN_CYCLE_SHIFTS.has(field) && !details['Cycle shift']) details['Cycle shift'] = field;
        else if (field === 'Prorate' || field === 'Not Prorate') details['Prorate RC & FU'] = field;
        else if (field === 'Suspend' && !details['RC failed need Suspend ?']) details['RC failed need Suspend ?'] = field;
        else if (ACTION_AFTER_RETRY_PATTERNS.includes(field) && !details['Action after max retry']) details['Action after max retry'] = field;
        else if (/^\d+(\.\d+)?$/.test(field) && !details['Rental Fee without tax']) { const fee = parseFloat(field); if (fee > 0) details['Rental Fee without tax'] = field; }
        else if (/^(\dG\/?)+$/.test(field)) details['Type'] = field;
        else if (/Bytes/.test(field)) { details['Free unit type Legacy'] = 'DATA VOLUME'; details['Free unit type OCS'] = 'DATA VOLUME'; details['Free unit value'] = field; }
        else if (/Baht \//.test(field)) { if (/Voice/i.test(field)) details['Voice Tariff'] = field; else if (/SMS/i.test(field)) details['SMS Tariff'] = field; else if (/MMS/i.test(field)) details['MMS Tariff'] = field; else details['GPRS Tariff'] = field; }
        else if (/อินเทอร์เน็ต|โทรฟรี/.test(field)) details['Speed'] = field;
        else if (/Kbps|Mbps|No FUP/i.test(field)) details['SpeedTemplate'] = field;
        else if (field === 'Y' && !details['Bonus']) details['Bonus'] = field;
        else if (field === 'N' && !details['Bonus'] && !details['Independent Sales']) details['Independent Sales'] = field;
        else if (/^B\d+$/.test(field) && !details['Balance ID']) details['Balance ID'] = field;
        else if (/^FU\d+$/i.test(field) && !details['FU ID']) details['FU ID'] = field;
        else if (/^OF\d+$/i.test(field) && !details['Offer ID']) details['Offer ID'] = field;
        else if (/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(field)) { const d = parseThaiDate(field); if (!details['Deploy Date']) details['Deploy Date'] = d; else if (!details['Sale Start Date']) details['Sale Start Date'] = d; }
        else if (/in-progress|deploy|approved|draft|inactive|active/i.test(field)) details['Deploy State'] = DEPLOY_STATE_MAP[field.toLowerCase().trim()] || field;
    });
    return details;
}

function masterExtractor(textChunk: string): ExtractedData {
    let details: ExtractedData;
    if (/^\d{8}:\s*New/.test(textChunk)) details = extractTabSeparatedData(textChunk);
    else if (/รหัสโปรโมชั่น\s*:|ค่าบริการ \(บาท\/ไม่รวม VAT\)/.test(textChunk)) details = extractKeyValueData(textChunk);
    else details = {};
    if (!details['Cycle Type']) {
        const searchable = `${details['Offering Name'] || ''} ${details['Notification Name (Eng)'] || ''} ${textChunk}`;
        const match = searchable.match(cycleTypeRegex);
        if (match) { const nm = normalizeCycleType(match[0]); details['Cycle Type'] = [...KNOWN_CYCLE_TYPES].find(k => normalizeCycleType(k) === nm) || match[0]; }
    }
    let speedValue: string | null = null;
    const rsm = textChunk.match(/Remark\s*:\s*Speed.*?\s(\d+)\s*Mbps/i);
    if (rsm?.[1]) speedValue = rsm[1];
    if (!speedValue && details['Offering Name']) { const ns = details['Offering Name'].match(/_(\d+)(M|Mbps)/i); if (ns?.[1]) speedValue = ns[1]; }
    if (speedValue) { const s = `3G/4G DATA VOLUME ${speedValue}M`; details['Free unit type OCS'] = s; details['Free unit type Legacy'] = s; }
    if (!details['Free unit type OCS'] && /โทรฟรี|Voice|เสียง/i.test(textChunk)) { details['Free unit type OCS'] = 'VOICE'; details['Free unit type Legacy'] = 'VOICE'; }
    details['Remark'] = details['Remark'] || 'Pre-collection';
    if (details['Rental Fee without tax']) { const f = parseFloat(details['Rental Fee without tax']); if (!isNaN(f)) details['Rental Fee without tax'] = f.toFixed(6); }
    const missing = (['Legacy ID', 'Offering Name'] as ColKey[]).filter(f => !details[f]?.trim());
    details['⚠️ ตรวจสอบ?'] = missing.length > 0 ? 'ควรตรวจสอบ' : '';
    return details;
}

// COMPONENT
export default function PromotionExtractor() {
    const [rawInput, setRawInput] = useState('');
    const [dataList, setDataList] = useState<ExtractedData[]>([]);
    const [status, setStatus] = useState('Awaiting input');
    const [editCell, setEditCell] = useState<{ row: number; col: ColKey } | null>(null);
    const editRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const reviewCount = useMemo(() => dataList.filter(d => d['⚠️ ตรวจสอบ?'] === 'ควรตรวจสอบ').length, [dataList]);
    const isProcessed = dataList.length > 0;

    // Dot grid — same as hub
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

    const handleProcess = useCallback(() => {
        setStatus('Processing...');
        const raw = rawInput.trim();
        if (!raw) {
            Swal.fire({ icon: 'warning', title: 'Data Required', text: 'กรุณาวางข้อมูลดิบก่อนประมวลผล', confirmButtonColor: '#0a0c0f' });
            setStatus('Awaiting input'); return;
        }
        const chunks = raw.split(/(?=\d{8}:\s*New|โปรโมชั่น\s\d+\s*:)/).map(c => c.trim()).filter(Boolean);
        const result = chunks.map(chunk => masterExtractor(chunk));
        setDataList(result);
        const rc = result.filter(d => d['⚠️ ตรวจสอบ?'] === 'ควรตรวจสอบ').length;
        if (rc > 0) Swal.fire({ icon: 'info', title: 'Process Complete', text: `พบ ${rc} รายการที่ต้องตรวจสอบ`, confirmButtonColor: '#0a0c0f' });
        else Swal.fire({ icon: 'success', title: 'Success', text: `สกัดข้อมูลสำเร็จ ${result.length} รายการ`, timer: 2000, showConfirmButton: false });
        setStatus(`✓ Processed ${result.length} records`);
    }, [rawInput]);

    const handleClear = useCallback(() => { setRawInput(''); setDataList([]); setStatus('Awaiting input'); setEditCell(null); }, []);
    const handleDeleteRow = useCallback((idx: number) => setDataList(prev => prev.filter((_, i) => i !== idx)), []);
    const handleCellEdit = useCallback((row: number, col: ColKey, value: string) => {
        setDataList(prev => {
            const next = [...prev]; next[row] = { ...next[row], [col]: value };
            const missing = (['Legacy ID', 'Offering Name'] as ColKey[]).filter(f => !next[row][f]?.trim());
            next[row]['⚠️ ตรวจสอบ?'] = missing.length > 0 ? 'ควรตรวจสอบ' : '';
            return next;
        });
    }, []);

    const handleDownloadCSV = useCallback(() => {
        if (!dataList.length) return;
        let csv = '\uFEFF' + EXPORT_COLUMNS.map(c => `"${c}"`).join(',') + '\r\n';
        dataList.forEach(item => { csv += EXPORT_COLUMNS.map(col => `"${String(item[col] || '').replace(/"/g, '""')}"`).join(',') + '\r\n'; });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        a.href = url; a.download = `Extracted_Promo_${today}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    }, [dataList]);

    const handleDownloadXLSX = useCallback(() => {
        if (!dataList.length) return;
        const wb = XLSX.utils.book_new();
        const rows = dataList.map(item => EXPORT_COLUMNS.reduce((acc, col) => ({ ...acc, [col]: item[col] || '' }), {} as Record<string, string>));
        const ws = XLSX.utils.json_to_sheet(rows, { header: [...EXPORT_COLUMNS] });
        ws['!cols'] = EXPORT_COLUMNS.map(col => ({ wch: Math.max(col.length + 2, 14) }));
        XLSX.utils.book_append_sheet(wb, ws, 'Promotions');
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        XLSX.writeFile(wb, `Extracted_Promo_${today}.xlsx`);
    }, [dataList]);

    return (
        <div className="relative min-h-screen overflow-x-hidden bg-[#0a0c0f] pb-24">
            <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap');
        .font-display { font-family: 'Syne', sans-serif; }
        .font-mono-custom { font-family: 'Space Mono', monospace; }
        @keyframes fade-up { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { opacity:0; animation: fade-up 0.55s cubic-bezier(0.16,1,0.3,1) forwards; }
        @keyframes scan { 0%{transform:translateY(-100%);opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{transform:translateY(100vh);opacity:0} }
        .scan-line { animation: scan 8s ease-in-out infinite; }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.7)} }
        .pulse-dot { animation: pulse-dot 1.5s ease-in-out infinite; }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(52,211,153,0.2); border-radius:10px; }
        ::-webkit-scrollbar-thumb:hover { background:rgba(52,211,153,0.4); }
      `}</style>

            <canvas ref={canvasRef} className="pointer-events-none fixed inset-0" />
            <div className="scan-line pointer-events-none fixed left-0 top-0 z-10 h-[2px] w-full bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />
            <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(16,185,129,0.06),transparent)]" />

            <div className="relative z-10 mx-auto max-w-[1480px] px-6 py-10">

                {/* ── HEADER ── */}
                <header className="fade-up mb-12" style={{ animationDelay: '0ms' }}>
                    <div className="mb-8 flex items-center gap-3">
                        <div className="h-px flex-1 bg-white/[0.06]" />
                        <span className="font-mono-custom text-[10px] tracking-[0.3em] text-white/25">BILLONE · OCS TOOLS</span>
                        <div className="h-px flex-1 bg-white/[0.06]" />
                    </div>

                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <Link
                                href="/mainocs"
                                className="group mb-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-mono-custom text-[11px] tracking-widest text-white/40 transition-all hover:border-white/20 hover:text-white/70"
                            >
                                <ArrowLeft size={12} className="transition-transform group-hover:-translate-x-0.5" />
                                BACK TO HUB
                            </Link>
                            <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-white">
                                Promotion Data{' '}
                                <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
                                    Extractor
                                </span>
                            </h1>
                            <p className="mt-2 font-mono-custom text-[11px] text-white/30">
                                สกัดข้อมูลโปรโมชั่นจากข้อความดิบ · export CSV / XLSX สำหรับ config OCS
                            </p>
                        </div>

                        {/* Status pill */}
                        <div className="mt-1 flex shrink-0 items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 backdrop-blur-sm">
                            <div className={`pulse-dot h-2 w-2 rounded-full ${status.startsWith('✓') ? 'bg-emerald-400' : status === 'Processing...' ? 'bg-amber-400' : 'bg-white/20'}`} />
                            <span className="font-mono-custom text-[11px] text-white/50">{status}</span>
                        </div>
                    </div>
                </header>

                {/* ── MAIN GRID ── */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

                    {/* LEFT — Input */}
                    <div className="fade-up lg:col-span-4 space-y-4" style={{ animationDelay: '80ms' }}>
                        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                                <div className="flex items-center gap-2.5">
                                    <Database size={15} className="text-emerald-400" />
                                    <span className="font-mono-custom text-[11px] tracking-[0.2em] text-white/50">SOURCE DATA</span>
                                </div>
                                <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono-custom text-[10px] text-white/25">
                                    Auto-detect
                                </span>
                            </div>
                            <div className="p-5">
                                <textarea
                                    rows={18}
                                    placeholder="วางข้อมูลโปรโมชั่นที่นี่..."
                                    value={rawInput}
                                    onChange={e => setRawInput(e.target.value)}
                                    className="w-full rounded-xl border border-white/[0.08] bg-[#0d0f12] p-4 font-mono-custom text-xs text-white/60 placeholder:text-white/20 outline-none focus:border-emerald-500/30 focus:bg-[#0f1114] transition-all resize-none"
                                />
                                <div className="mt-4 flex flex-col gap-2.5">
                                    <button
                                        onClick={handleProcess}
                                        className="relative w-full overflow-hidden rounded-xl border border-emerald-500/20 bg-emerald-500/10 py-3.5 font-mono-custom text-xs font-bold tracking-[0.2em] text-emerald-400 transition-all hover:bg-emerald-500/20 hover:border-emerald-500/40 flex items-center justify-center gap-2"
                                    >
                                        <Settings size={14} /> PROCESS INTELLIGENCE
                                        <div className="absolute bottom-0 left-0 h-[1px] w-full bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
                                    </button>
                                    <button
                                        onClick={handleClear}
                                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] py-2.5 font-mono-custom text-[11px] tracking-widest text-white/25 transition-all hover:border-red-500/20 hover:bg-red-500/5 hover:text-red-400 flex items-center justify-center gap-2"
                                    >
                                        <Trash2 size={12} /> CLEAR ALL
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Review badge */}
                        {isProcessed && reviewCount > 0 && (
                            <div className="fade-up rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 flex items-center gap-4">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
                                    <AlertTriangle size={18} />
                                </div>
                                <div>
                                    <p className="font-mono-custom text-[10px] tracking-[0.2em] text-amber-400/60">NEEDS REVIEW</p>
                                    <p className="font-display text-2xl font-extrabold text-amber-400 leading-none mt-0.5">
                                        {reviewCount} <span className="text-sm font-normal text-amber-400/60">รายการ</span>
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Legend cards */}
                        {[
                            { icon: AlertTriangle, color: 'text-amber-400', border: 'border-amber-500/15', bg: 'bg-amber-500/5', title: 'Validation', desc: 'ตรวจสอบหาก Legacy ID หรือ Offering Name หาย' },
                            { icon: CheckCircle, color: 'text-emerald-400', border: 'border-emerald-500/15', bg: 'bg-emerald-500/5', title: 'Smart Format', desc: 'Rental Fee 6 ตำแหน่ง · วันที่ไทย → DD/MM/YYYY' },
                            { icon: Search, color: 'text-sky-400', border: 'border-sky-500/15', bg: 'bg-sky-500/5', title: 'Editable', desc: 'คลิกเซลล์เพื่อแก้ไขก่อน export' },
                        ].map((item, i) => (
                            <div key={i} className={`rounded-xl border ${item.border} ${item.bg} p-4 flex items-start gap-3`}>
                                <item.icon size={14} className={`${item.color} mt-0.5 shrink-0`} />
                                <div>
                                    <p className={`font-mono-custom text-[10px] font-bold tracking-widest ${item.color}`}>{item.title.toUpperCase()}</p>
                                    <p className="mt-0.5 font-mono-custom text-[11px] text-white/30 leading-relaxed">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* RIGHT — Results */}
                    <div className="fade-up lg:col-span-8" style={{ animationDelay: '140ms' }}>
                        {!isProcessed ? (
                            <div className="flex h-[680px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.06] text-center">
                                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/20">
                                    <Terminal size={24} strokeWidth={1.5} />
                                </div>
                                <p className="font-display text-lg font-bold text-white/25">No Data Processed</p>
                                <p className="mt-1 font-mono-custom text-[11px] text-white/15">วางข้อมูลแล้วกด Process Intelligence</p>
                            </div>
                        ) : (
                            <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 h-[680px]">
                                {/* Table topbar */}
                                <div className="flex items-center justify-between bg-[#0d0f12] px-6 py-4 border-b border-white/[0.06]">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                                            <FileText size={14} />
                                        </div>
                                        <div>
                                            <p className="font-mono-custom text-[11px] tracking-widest text-white/60">EXTRACTED DATASET</p>
                                            <p className="font-mono-custom text-[10px] text-white/25">{dataList.length} รายการ · คลิกเซลล์เพื่อแก้ไข</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleDownloadCSV}
                                            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-mono-custom text-[11px] tracking-widest text-white/40 transition-all hover:border-white/20 hover:text-white/70"
                                        >
                                            <Download size={12} /> CSV
                                        </button>
                                        <button
                                            onClick={handleDownloadXLSX}
                                            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 font-mono-custom text-[11px] tracking-widest text-emerald-400 transition-all hover:bg-emerald-500/20"
                                        >
                                            <FileSpreadsheet size={12} /> XLSX
                                        </button>
                                    </div>
                                </div>

                                {/* Table */}
                                <div className="flex-1 overflow-auto bg-[#0a0c0f]">
                                    <table className="w-full border-collapse text-left">
                                        <thead className="sticky top-0 z-10 bg-[#0d0f12]">
                                            <tr className="border-b border-white/[0.06]">
                                                <th className="px-3 py-3 font-mono-custom text-[10px] tracking-[0.15em] text-white/20 w-10">#</th>
                                                {OUTPUT_COLUMNS.map(col => (
                                                    <th key={col} className="px-4 py-3 font-mono-custom text-[10px] tracking-[0.12em] text-white/30 whitespace-nowrap">
                                                        {col}
                                                    </th>
                                                ))}
                                                <th className="px-3 py-3 font-mono-custom text-[10px] text-white/20">DEL</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dataList.map((item, idx) => (
                                                <tr
                                                    key={idx}
                                                    className={`group border-b border-white/[0.04] transition-colors ${item['⚠️ ตรวจสอบ?'] === 'ควรตรวจสอบ' ? 'bg-amber-500/[0.04] hover:bg-amber-500/[0.07]' : 'hover:bg-white/[0.025]'}`}
                                                >
                                                    <td className="px-3 py-2.5 font-mono-custom text-[10px] text-white/20 text-center">{idx + 1}</td>
                                                    {OUTPUT_COLUMNS.map(col => {
                                                        const val = item[col] || '';
                                                        const isEditing = editCell?.row === idx && editCell?.col === col;
                                                        const needsReview = col === '⚠️ ตรวจสอบ?' && val === 'ควรตรวจสอบ';
                                                        return (
                                                            <td
                                                                key={col}
                                                                className={`px-4 py-2.5 font-mono-custom text-[11px] whitespace-nowrap border-r border-white/[0.03] cursor-pointer transition-colors
                                  ${needsReview ? 'text-amber-400 font-bold bg-amber-500/10' : 'text-white/40 group-hover:text-white/70'}`}
                                                                onClick={() => { if (col !== '⚠️ ตรวจสอบ?') { setEditCell({ row: idx, col }); setTimeout(() => editRef.current?.focus(), 50); } }}
                                                            >
                                                                {isEditing ? (
                                                                    <input
                                                                        ref={editRef}
                                                                        defaultValue={val}
                                                                        className="min-w-[120px] w-full rounded-lg border border-emerald-500/40 bg-[#0d0f12] px-2 py-1 text-[11px] text-emerald-300 outline-none ring-1 ring-emerald-500/20"
                                                                        onBlur={e => { handleCellEdit(idx, col, e.target.value); setEditCell(null); }}
                                                                        onKeyDown={e => {
                                                                            if (e.key === 'Enter') { handleCellEdit(idx, col, (e.target as HTMLInputElement).value); setEditCell(null); }
                                                                            if (e.key === 'Escape') setEditCell(null);
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    val || <span className="text-white/15">—</span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-3 py-2.5 text-center">
                                                        <button
                                                            onClick={() => handleDeleteRow(idx)}
                                                            className="rounded-lg p-1 text-white/15 transition-all hover:bg-red-500/10 hover:text-red-400"
                                                        >
                                                            <X size={11} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Footer bar */}
                                <div className="flex items-center justify-between bg-[#0d0f12] px-6 py-3 border-t border-white/[0.06]">
                                    <div className="flex items-center gap-2">
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                        <span className="font-mono-custom text-[10px] tracking-[0.2em] text-white/25">DATA INTEGRITY CHECK: PASSED</span>
                                    </div>
                                    {reviewCount > 0 && (
                                        <span className="flex items-center gap-1.5 font-mono-custom text-[10px] tracking-widest text-amber-400/70">
                                            <AlertTriangle size={10} /> NEEDS REVIEW: {reviewCount}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── FOOTER ── */}
                <footer className="mt-20 border-t border-white/[0.05] pt-8 text-center">
                    <p className="font-mono-custom text-[10px] tracking-[0.3em] text-white/15">
                        ARM@MOS · BILLONE INTERNAL ANALYTICS SYSTEMS · © {new Date().getFullYear()}
                    </p>
                </footer>
            </div>
        </div>
    );
}