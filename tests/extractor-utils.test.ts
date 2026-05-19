// import { describe, it, expect } from 'vitest';
// import { parseThaiDate, extractTabSeparatedData, extractKeyValueData, masterExtractor } from '../app/extractor/utils';

// describe('parseThaiDate', () => {
//   it('returns same format for DD/MM/YYYY', () => {
//     expect(parseThaiDate('12/05/2022')).toBe('12/05/2022');
//   });

//   it('parses Thai month short with BE year', () => {
//     expect(parseThaiDate('1 ม.ค. 2566')).toBe('01/01/2023');
//   });

//   it('parses Thai full month name', () => {
//     expect(parseThaiDate('5 กุมภาพันธ์ 2564')).toBe('05/02/2021');
//   });
// });

// describe('extractTabSeparatedData', () => {
//   it('extracts basic fields from tab/double-space separated string', () => {
//     const input = 'ChangeLog\t12345678\tSO_TEST_10Mbps\tNotifyEng\tNotifyThai\t3 times\t7\tProrate\t100\tB123\tFU1\tOF1\t01/01/2022\tin-progress';
//     const out = extractTabSeparatedData(input);
//     expect(out['Legacy ID']).toBe('12345678');
//     expect(out['Offering Name']).toBe('SO_TEST_10Mbps');
//     expect(out['Retry RC times']).toBe('7');
//     expect(out['Rental Fee without tax']).toBe('100');
//     expect(out['Balance ID']).toBe('B123');
//     expect(out['FU ID']).toBe('FU1');
//     expect(out['Offer ID']).toBe('OF1');
//     expect(out['Deploy Date']).toBe('01/01/2022');
//     expect(out['Deploy State']).toBe('In-progress');
//   });
// });

// describe('masterExtractor', () => {
//   it('extracts from key-value thai block and normalizes fields', () => {
//     const block = `รหัสโปรโมชั่น : 87654321\nชื่อโปรใน OCS : SO_BLOCK_5M\nค่าบริการ (บาท/ไม่รวม VAT) : 50\nวันที่เริ่มจำหน่าย (Sale Start Date) : 1 ม.ค. 2566\nสถานะโปรโมชั่น : in-progress`;
//     const res = masterExtractor(block);
//     expect(res['Legacy ID']).toBe('87654321');
//     expect(res['Offering Name']).toBe('SO_BLOCK_5M');
//     expect(res['Rental Fee without tax']).toBe('50.000000');
//     expect(res['Sale Start Date']).toBe('01/01/2023');
//     expect(res['Deploy State']).toBe('In-progress');
//     expect(res['Remark']).toBe('Pre-collection');
//   });
// });
