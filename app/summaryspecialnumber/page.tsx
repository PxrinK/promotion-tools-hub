'use client';

import React, { useState, useEffect, useRef } from 'react';
import ExcelJS from 'exceljs';
import { ArrowLeft, FileSpreadsheet, Upload, Download, Loader2, CheckCircle, Info, X, Calendar } from 'lucide-react';

const MONTHS_TH = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export default function SummarySpecialNumber() {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDone, setIsDone] = useState(false);
  
  // เพิ่ม State สำหรับเลือก เดือน และ ปี
  const currentYear = new Date().getFullYear() + 543; // ดึงปี พ.ศ. ปัจจุบันเป็นค่าเริ่มต้น
  const currentMonth = new Date().getMonth(); // ดึงเดือนปัจจุบัน (0-11)
  
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // สร้างรายการปี พ.ศ. ย้อนหลัง 5 ปี และล่วงหน้า 2 ปี เพื่อให้เลือก
  const yearOptions = Array.from({ length: 8 }, (_, i) => currentYear - 5 + i);

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
    let animationId: number;

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
          ctx.fillStyle = `rgba(52,211,153,${0.03 + pulse * 0.05})`;
          ctx.fill();
        }
      }
      frame++;
      animationId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  const handleProcessFiles = async () => {
    if (!file1 || !file2) return alert('กรุณาเลือกไฟล์ให้ครบ');
    setIsProcessing(true);
    setIsDone(false);

    try {
      const wb1 = new ExcelJS.Workbook();
      await wb1.xlsx.load(await file1.arrayBuffer());
      const nonChargeNumbers = new Set();
      wb1.worksheets[0].eachRow((row, rowNumber) => {
        if (rowNumber > 1) nonChargeNumbers.add(String(row.getCell(2).value).trim());
      });

      const newWorkbook = new ExcelJS.Workbook();
      const summaryData: any[] = [];

      // 1. จัดการชีท TOTAL
      const wsTotal = newWorkbook.addWorksheet('TOTAL');
      wsTotal.addRow(['รายงานการใช้บริการเสริมแยกตามผู้ให้บริการ']);
      wsTotal.addRow([`ประจำเดือน ${MONTHS_TH[selectedMonth]} ${selectedYear}`]);
      wsTotal.addRow([]);
      
      const headerRowTotal = wsTotal.addRow(['Sheet Name', 'Amount (exc VAT)', 'Share CP', 'Share CAT']);
      // ปรับให้ Header ของหน้า TOTAL เป็นตัวหนา
      headerRowTotal.eachCell((cell) => {
        cell.font = { name: 'TH SarabunPSK', size: 16, bold: true };
      });

      const wb2 = new ExcelJS.Workbook();
      await wb2.xlsx.load(await file2.arrayBuffer());

      wb2.eachSheet((ws) => {
        if (ws.name.toUpperCase() === 'TOTAL' || ws.name === 'Non_Charge') return;

        const rows: any[] = [];
        let sAmt = 0, sCP = 0, sCAT = 0;

        ws.eachRow((row, rowNumber) => {
          if (rowNumber === 1) { rows.push(row.values); return; }
          const num = String(row.getCell(1).value).trim();
          if (!nonChargeNumbers.has(num)) {
            rows.push(row.values);
            sAmt += Number(row.getCell(5).value) || 0;
            sCP += Number(row.getCell(6).value) || 0;
            sCAT += Number(row.getCell(7).value) || 0;
          }
        });

        if (rows.length > 1) {
          const newWs = newWorkbook.addWorksheet(ws.name);
          
          // เพิ่มข้อมูลแถว รวมถึงแถวหัวข้อ (Row 1)
          rows.forEach((r, idx) => {
            const addedRow = newWs.addRow(r);
            // ปรับแถวหัวข้อ (Row แรกสุดของแต่ละคอลัมน์) ให้เป็นตัวหนาตามรูปภาพตัวอย่าง
            if (idx === 0) {
              addedRow.eachCell((cell) => {
                cell.font = { name: 'TH SarabunPSK', size: 16, bold: true };
              });
            }
          });

          // แถวผลรวมท้ายชีทของแต่ละดีลเลอร์
          const footerRow = newWs.addRow(['รวม (Total)', '', '', '', sAmt, sCP, sCAT]);
          
          // กำหนด Format และปรับตัวเลขผลรวมท้ายชีทให้เป็น "ตัวหนา"
          footerRow.eachCell((cell, colNumber) => {
            if (colNumber >= 1) {
              cell.font = { name: 'TH SarabunPSK', size: 16, bold: true }; // ทำเป็นตัวหนาทั้งแถวสรุป
            }
            if (colNumber === 5 || colNumber === 6 || colNumber === 7) {
              cell.numFmt = '#,##0.00';
            }
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          });

          summaryData.push({ name: ws.name, amt: sAmt, cp: sCP, cat: sCAT });
        }
      });

      // ใส่ข้อมูลในชีท TOTAL
      summaryData.forEach(d => {
        const row = wsTotal.addRow([d.name, d.amt, d.cp, d.cat]);
        [2, 3, 4].forEach(i => row.getCell(i).numFmt = '#,##0.00');
      });

      // คำนวณบรรทัด รวม (Total) ของชีท TOTAL
      const lastRow = wsTotal.rowCount;
      if (lastRow > 4) {
        const sumRow = wsTotal.addRow(['รวม (Total)',
          { formula: `SUM(B5:B${lastRow})` },
          { formula: `SUM(C5:C${lastRow})` },
          { formula: `SUM(D5:D${lastRow})` }
        ]);
        
        // กำหนดให้ตัวเลขผลรวมผลลัพธ์ในชีท TOTAL เป็น "ตัวหนา" ทั้งหมด
        sumRow.eachCell((cell, colNumber) => {
          cell.font = { name: 'TH SarabunPSK', size: 16, bold: true };
          if (colNumber >= 2 && colNumber <= 4) {
            cell.numFmt = '#,##0.00';
          }
        });
      }

      // จัดการชีท Non_Charge
      const wsNC = newWorkbook.addWorksheet('Non_Charge');
      wb1.worksheets[0].eachRow((row, rowNumber) => { 
        const addedRow = wsNC.addRow(row.values); 
        // ทำหัวข้อคอลัมน์ของชีท Non_Charge เป็นตัวหนาด้วยเช่นกัน
        if (rowNumber === 1) {
          addedRow.eachCell((cell) => {
            cell.font = { name: 'TH SarabunPSK', size: 16, bold: true };
          });
        }
      });

      // วนลูปเก็บรายละเอียดฟอนต์และเส้นขอบพื้นฐาน (ไม่ให้เขียนทับค่าตัวหนาที่เซ็ตไว้ก่อนหน้า)
      newWorkbook.eachSheet(ws => {
        ws.eachRow((row, rowIdx) => {
          row.eachCell(cell => {
            if (cell.value !== null && cell.value !== '' && cell.value !== undefined) {
              // ตรวจสอบว่าถ้าเซลล์นั้นถูกตั้งค่า bold ไว้แล้ว ให้คงค่าเดิมไว้ (ไม่ไปทับให้กลายเป็นตัวบาง)
              const isBold = cell.font && cell.font.bold;
              cell.font = { name: 'TH SarabunPSK', size: 16, bold: isBold };
              cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            }
          });
        });
      });

      const buffer = await newWorkbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = `Summary_Report_${MONTHS_TH[selectedMonth]}_${selectedYear}.xlsx`;
      a.click();
      setIsDone(true);
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการประมวลผล');
    } finally {
      setIsProcessing(false);
    }
  };

  const FileDropZone = ({
    label,
    sublabel,
    file,
    onFile,
    color,
  }: {
    label: string;
    sublabel: string;
    file: File | null;
    onFile: (f: File | null) => void;
    color: 'emerald' | 'teal';
  }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

    const accent = color === 'emerald'
      ? { ring: 'ring-emerald-500/30', border: 'border-emerald-500/40', text: 'text-emerald-400', bg: 'bg-emerald-500/10', badge: 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300' }
      : { ring: 'ring-teal-500/30', border: 'border-teal-500/40', text: 'text-teal-400', bg: 'bg-teal-500/10', badge: 'bg-teal-500/5 border-teal-500/20 text-teal-300' };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) onFile(f);
    };

    return (
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`
          relative cursor-pointer rounded-[2rem] border transition-all duration-300 overflow-hidden
          ${file
            ? `${accent.border} ${accent.bg}`
            : dragging
              ? `${accent.border} ${accent.bg}`
              : 'border-white/10 bg-white/[0.02] hover:border-white/20'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] || null)}
        />

        <div className="p-8 flex flex-col items-center gap-4 text-center">
          <div className={`p-4 rounded-2xl border transition-all ${file ? `${accent.bg} ${accent.border} ${accent.text}` : 'bg-white/[0.03] border-white/10 text-white/30'}`}>
            {file ? <CheckCircle size={28} /> : <Upload size={28} />}
          </div>

          <div>
            <p className={`font-mono-custom text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${file ? accent.text : 'text-white/30'}`}>
              {label}
            </p>
            <p className="font-mono-custom text-[9px] text-white/20 uppercase tracking-wider">{sublabel}</p>
          </div>

          {file ? (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-mono-custom font-bold ${accent.badge}`}>
              <FileSpreadsheet size={11} />
              <span className="truncate max-w-[180px]">{file.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onFile(null); }}
                className="ml-1 text-white/30 hover:text-red-400 transition-colors"
              >
                <X size={11} />
              </button>
            </div>
          ) : (
            <p className="font-mono-custom text-[9px] text-white/20">คลิกหรือลากไฟล์มาวางที่นี่</p>
          )}
        </div>
      </div>
    );
  };

  const canRun = file1 && file2 && !isProcessing;

  return (
    <div className="relative min-h-screen bg-[#0a0c0f] text-white font-sans antialiased overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap');
        .font-display { font-family: 'Syne', sans-serif; }
        .font-mono-custom { font-family: 'Space Mono', monospace; }

        @keyframes scan {
          0%   { transform: translateY(-100%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        .scan-line { animation: scan 8s ease-in-out infinite; }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .blink { animation: blink 1s step-end infinite; }

        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(52,211,153,0.1); }
          50% { box-shadow: 0 0 40px rgba(52,211,153,0.25); }
        }
        .pulse-glow { animation: pulse-glow 3s ease-in-out infinite; }

        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .shimmer-btn {
          background-size: 200% auto;
          animation: shimmer 3s linear infinite;
        }
      `}} />

      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0" />
      <div className="scan-line pointer-events-none fixed left-0 top-0 z-10 h-[2px] w-full bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(16,185,129,0.05),transparent)] z-0" />

      <div className="relative z-10">

        {/* ── HEADER ── */}
        <header className="bg-white/[0.02] border-b border-white/[0.06] py-10 px-8 backdrop-blur-sm">
          <div className="max-w-[860px] mx-auto relative flex flex-col items-center">

            <div className="absolute top-0 left-0">
              <a
                href="/mainocs"
                className="inline-flex items-center gap-3 text-white/40 hover:text-emerald-400 transition-all duration-300 group"
              >
                <div className="p-2.5 rounded-xl border border-white/10 bg-white/5 group-hover:border-emerald-500/40 group-hover:bg-emerald-500/10 transition-all text-white/50 group-hover:text-emerald-400">
                  <ArrowLeft size={16} />
                </div>
                <span className="font-mono-custom text-xs font-bold tracking-widest uppercase">Back to Hub</span>
              </a>
            </div>

            <div className="text-center pt-10 md:pt-0">
              <div className="inline-flex items-center justify-center p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl shadow-lg mb-4 text-emerald-400">
                <FileSpreadsheet size={28} />
              </div>
              <h1 className="font-display text-2xl md:text-4xl font-extrabold tracking-tight text-white uppercase">
                Summary <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent font-light">Special Number</span>
              </h1>
              <p className="font-mono-custom text-xs tracking-wide text-white/40 mt-3 max-w-xl mx-auto leading-relaxed">
                ประมวลผลและสรุปข้อมูลบริการเสริม โดยกรองหมายเลข Non-Charge ออกจากรายงาน <span className="blink ml-0.5 text-emerald-400">_</span>
              </p>
            </div>
          </div>
        </header>

        {/* ── MAIN ── */}
        <main className="max-w-[860px] mx-auto px-8 py-12 space-y-8">

          {/* เลือกช่วงเวลาของรายงาน */}
          <section className="bg-white/[0.03] backdrop-blur-sm rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden transition-all duration-300 hover:border-emerald-500/20">
            <div className="p-8 border-b border-white/[0.04] bg-white/[0.01] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                  <Calendar size={20} />
                </div>
                <h2 className="font-mono-custom text-xs font-bold text-white/80 uppercase tracking-widest">เลือกช่วงเวลาของรายงาน</h2>
              </div>
            </div>
            
            <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Dropdown เลือกเดือน */}
              <div className="flex flex-col gap-2">
                <label className="font-mono-custom text-[10px] text-white/40 uppercase tracking-widest font-black">เดือน (Month)</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => { setSelectedMonth(Number(e.target.value)); setIsDone(false); }}
                  className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors font-sans"
                >
                  {MONTHS_TH.map((month, idx) => (
                    <option key={idx} value={idx} className="bg-[#0a0c0f] text-white">{month}</option>
                  ))}
                </select>
              </div>

              {/* Dropdown เลือกปี */}
              <div className="flex flex-col gap-2">
                <label className="font-mono-custom text-[10px] text-white/40 uppercase tracking-widest font-black">ปี พ.ศ. (Year)</label>
                <select
                  value={selectedYear}
                  onChange={(e) => { setSelectedYear(Number(e.target.value)); setIsDone(false); }}
                  className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors font-sans"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year} className="bg-[#0a0c0f] text-white">{year}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* File Upload Section */}
          <section className="bg-white/[0.03] backdrop-blur-sm rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden transition-all duration-300 hover:border-emerald-500/20">
            <div className="p-8 border-b border-white/[0.04] bg-white/[0.01] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                  <Upload size={20} />
                </div>
                <h2 className="font-mono-custom text-xs font-bold text-white/80 uppercase tracking-widest">อัปโหลดไฟล์</h2>
              </div>
              <span className="font-mono-custom text-[10px] font-black text-emerald-400/80 px-3 py-1 bg-emerald-500/5 border border-emerald-500/20 rounded-lg uppercase tracking-wider">Excel Input</span>
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <FileDropZone
                label="ไฟล์ Non_Charge"
                sublabel="รายชื่อหมายเลขที่ไม่คิดค่าบริการ"
                file={file1}
                onFile={setFile1}
                color="emerald"
              />
              <FileDropZone
                label="ไฟล์ข้อมูลหลัก"
                sublabel="ข้อมูลการใช้บริการรายเดือน"
                file={file2}
                onFile={setFile2}
                color="teal"
              />
            </div>

            <div className="px-8 pb-8">
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-black/30 border border-white/[0.06]">
                <div className={`w-2 h-2 rounded-full transition-all ${file1 && file2 ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-white/10'}`} />
                <span className="font-mono-custom text-[10px] text-white/30 uppercase tracking-wider">
                  {!file1 && !file2 && 'รอการเลือกไฟล์'}
                  {file1 && !file2 && 'เลือกไฟล์ Non_Charge แล้ว — รอไฟล์ข้อมูลหลัก'}
                  {!file1 && file2 && 'เลือกไฟล์ข้อมูลหลักแล้ว — รอไฟล์ Non_Charge'}
                  {file1 && file2 && 'พร้อมประมวลผล ✓'}
                </span>
              </div>
            </div>
          </section>

          {/* Process Button */}
          <div className="flex justify-center">
            <button
              onClick={handleProcessFiles}
              disabled={!canRun}
              className={`
                relative flex items-center gap-3 px-12 py-5 rounded-2xl
                font-mono-custom font-bold text-xs tracking-widest uppercase
                transition-all duration-300 shadow-lg
                ${canRun
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-[#0a0c0f] hover:brightness-110 active:brightness-95 shadow-emerald-500/20 pulse-glow cursor-pointer'
                  : 'bg-white/[0.04] text-white/20 border border-white/[0.06] cursor-not-allowed'
                }
              `}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  กำลังประมวลผล...
                </>
              ) : isDone ? (
                <>
                  <CheckCircle size={16} />
                  ดาวน์โหลดสำเร็จแล้ว
                </>
              ) : (
                <>
                  <Download size={16} />
                  ประมวลผลและดาวน์โหลดไฟล์
                </>
              )}
            </button>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div className="flex items-start gap-4 p-6 bg-white/[0.02] border border-white/10 rounded-2xl backdrop-blur-sm">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 shrink-0">
                <Info size={16} />
              </div>
              <div className="font-mono-custom text-[10px] text-white/50 leading-relaxed">
                <span className="text-white font-bold block mb-1">ขั้นตอนการทำงาน:</span>
                <span>ระบบจะอ่านหมายเลข Non_Charge และกรองออกจากข้อมูลหลัก จากนั้นสร้างชีทสรุปและคำนวณยอดรวมอัตโนมัติ</span>
                <span className="block mt-1 text-emerald-400/70">Output: Summary_Report_[เดือน]_[ปี].xlsx</span>
              </div>
            </div>
            <div className="flex items-start gap-4 p-6 bg-white/[0.02] border border-white/10 rounded-2xl backdrop-blur-sm">
              <div className="p-2 bg-teal-500/10 border border-teal-500/20 rounded-xl text-teal-400 shrink-0">
                <Info size={16} />
              </div>
              <div className="font-mono-custom text-[10px] text-white/50 leading-relaxed">
                <span className="text-white font-bold block mb-1">รูปแบบไฟล์ที่รองรับ:</span>
                <span>รองรับเฉพาะไฟล์ .xlsx และ .xls ผลลัพธ์จะมีชีท TOTAL, ชีทข้อมูลแต่ละ Provider และ Non_Charge</span>
                <span className="block mt-1 text-teal-400/70">ฟอนต์: TH SarabunPSK ขนาด 16pt (หัวข้อและผลรวมเป็นตัวหนา)</span>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="py-16 text-center border-t border-white/[0.04] bg-white/[0.01]">
          <p className="font-mono-custom text-[10px] font-bold text-white/20 uppercase tracking-[0.4em]">Internal Engineering Unit • Billone Professional Suite</p>
        </footer>
      </div>
    </div>
  );
}