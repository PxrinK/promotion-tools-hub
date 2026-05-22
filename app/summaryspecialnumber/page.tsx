'use client';

import React, { useState } from 'react';
import ExcelJS from 'exceljs';

export default function SummarySpecialNumber() {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleProcessFiles = async () => {
    if (!file1 || !file2) return alert('กรุณาเลือกไฟล์ให้ครบ');
    setIsProcessing(true);

    try {
      // 1. อ่านไฟล์ Non_Charge
      const wb1 = new ExcelJS.Workbook();
      await wb1.xlsx.load(await file1.arrayBuffer());
      const nonChargeNumbers = new Set();
      wb1.worksheets[0].eachRow((row, rowNumber) => {
        if (rowNumber > 1) nonChargeNumbers.add(String(row.getCell(2).value).trim());
      });

      // 2. เตรียม Workbook ใหม่
      const newWorkbook = new ExcelJS.Workbook();
      const summaryData: any[] = [];

      // 3. สร้างชีท TOTAL ไว้เป็นหน้าแรกสุด
      const wsTotal = newWorkbook.addWorksheet('TOTAL');
      wsTotal.addRow(['รายงานการใช้บริการเสริมแยกตามผู้ให้บริการ']);
      wsTotal.addRow(['ประจำเดือน เมษายน 2026']);
      wsTotal.addRow([]);
      wsTotal.addRow(['Sheet Name', 'Amount (exc VAT)', 'Share CP', 'Share CAT']);

      // 4. อ่านไฟล์ข้อมูลหลักและประมวลผล
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
          rows.forEach(r => newWs.addRow(r));
          
          // ปรับตำแหน่ง footer ให้ตรงกับคอลัมน์ 5, 6, 7 (AMOUNT, SHARE_CP, SHARE_CAT)
          // ใส่ค่าว่าง 4 ช่องแรก แล้วค่าเริ่มลงช่องที่ 5
          const footerRow = newWs.addRow(['', '', '', '', sAmt, sCP, sCAT]);
          
          // ใส่ฟอร์แมตเลขและเส้นขอบเฉพาะช่องที่มีข้อมูล
          [5, 6, 7].forEach(i => {
             const cell = footerRow.getCell(i);
             cell.numFmt = '#,##0.00';
             cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
          });
          
          summaryData.push({ name: ws.name, amt: sAmt, cp: sCP, cat: sCAT });
        }
      });

      // 5. เติมข้อมูลลงชีท TOTAL และใส่สูตรคำนวณ
      summaryData.forEach(d => {
        const row = wsTotal.addRow([d.name, d.amt, d.cp, d.cat]);
        [2, 3, 4].forEach(i => row.getCell(i).numFmt = '#,##0.00');
      });

      const lastRow = wsTotal.rowCount;
      if (lastRow > 4) {
        const sumRow = wsTotal.addRow(['รวม (Total)', 
          { formula: `SUM(B5:B${lastRow})` }, 
          { formula: `SUM(C5:C${lastRow})` }, 
          { formula: `SUM(D5:D${lastRow})` }
        ]);
        [2, 3, 4].forEach(i => sumRow.getCell(i).numFmt = '#,##0.00');
      }

      // 6. สร้างชีท Non_Charge (ต่อท้าย)
      const wsNC = newWorkbook.addWorksheet('Non_Charge');
      wb1.worksheets[0].eachRow(row => { wsNC.addRow(row.values); });

      // 7. จัดรูปแบบฟอนต์และเส้นขอบเฉพาะเซลล์ที่มีข้อมูล
      newWorkbook.eachSheet(ws => {
        ws.eachRow(row => {
          row.eachCell(cell => {
            if (cell.value !== null && cell.value !== '' && cell.value !== undefined) {
              cell.font = { name: 'TH SarabunPSK', size: 16 };
              cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
            }
          });
        });
      });

      const buffer = await newWorkbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = 'Summary_Report_Final.xlsx';
      a.click();
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการประมวลผล');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-10 bg-gray-100 min-h-screen">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-lg">
        <h1 className="text-xl font-bold mb-6 text-center">summaryspecialnumber</h1>
        <div className="space-y-4 mb-6">
          <label className="block text-sm font-medium">ไฟล์ Non_Charge:</label>
          <input type="file" onChange={(e) => setFile1(e.target.files?.[0] || null)} className="w-full border p-2" />
          <label className="block text-sm font-medium">ไฟล์ข้อมูลหลัก:</label>
          <input type="file" onChange={(e) => setFile2(e.target.files?.[0] || null)} className="w-full border p-2" />
        </div>
        <button onClick={handleProcessFiles} disabled={isProcessing} className="w-full bg-blue-600 text-white py-3 rounded">
          {isProcessing ? 'กำลังประมวลผล...' : 'ดาวน์โหลดไฟล์ผลลัพธ์'}
        </button>
      </div>
    </div>
  );
}