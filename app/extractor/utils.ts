// Extractor utility functions (pulled from page.tsx for unit testing)
export type ExtractedData = Record<string, string>;

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

export function parseThaiDate(raw: string): string {
    if (!raw) return '';
    const t = raw.trim();
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(t)) return t;
    const m = t.match(/(\d{1,2})\s+([ก-๙a-zA-Z.]+)\s+(\d{2,4})/);
    if (m) {
        const day = m[1].padStart(2, '0');
        const monthKey = Object.keys(THAI_MONTH_SHORT).find(k => m[2].startsWith(k.replace('.', '')));
        const month = monthKey ? THAI_MONTH_SHORT[monthKey] : '??';
        let year = parseInt(m[3]);
        if (year > 2400) year -= 543;
        if (year < 100) year += 2500 - 543;
        return `${day}/${month}/${year}`;
    }
    return t;
}

const findFn = (textChunk: string, regex: RegExp) => (textChunk.match(regex) || [])[1]?.trim() || '';

export function extractKeyValueData(textChunk: string): ExtractedData {
    const details: ExtractedData = {};
    const notifLine = textChunk.match(/Notification Name \(Eng\)\s*:\s*([^\r\n]*)/m);
    if (notifLine) {
        const parts = notifLine[1].split(/Notification Name \(Th\)\s*:/);
        details['Notification Name (Eng)'] = parts[0]?.trim() || '';
        if (parts[1]) details['Notification Name (Thai)'] = parts[1]?.trim();
    }
    if (!details['Notification Name (Thai)']) details['Notification Name (Thai)'] = findFn(textChunk, /Notification Name \(Th\)\s*:\s*([^\r\n]*)/m);
    details['Legacy ID'] = findFn(textChunk, /รหัสโปรโมชั่น\s*:\s*(\d{8})/m);
    details['Offering Name'] = findFn(textChunk, /ชื่อโปรใน OCS\s*:\s*([^\r\n]*)/m);
    details['Change log'] = findFn(textChunk, /Change\s*[Ll]og\s*:\s*([^\r\n]*)/m);
    const fee = findFn(textChunk, /ค่าบริการ \(บาท\/ไม่รวม VAT\)\s*:\s*([\d.]+)/m);
    if (parseFloat(fee) > 0) details['Rental Fee without tax'] = fee;
    const periodText = findFn(textChunk, /ระยะเวลาใช้บริการ \(Period\)\s*:\s*([\s\S]*?)(?=\s*\*|Cycle Length|$)/);
    if (periodText) { const match = periodText.match(cycleTypeRegex); if (match) details['Cycle Type'] = match[0]; }
    const lengthText = findFn(textChunk, /Cycle Length\s*:\s*([^\r\n]*)/m);
    if (/^(\d+\s*รอบบิล|\d+\s*times?|Renew)$/i.test(lengthText)) details['Cycle Length'] = lengthText.replace('รอบบิล', 'times');
    details['Prorate RC & FU'] = findFn(textChunk, /เกณฑ์การคิดค่าบริการ\s*:\s*(Prorate|Not Prorate)/m);
    details['RC failed need Suspend ?'] = findFn(textChunk, /RC failed need Suspend \?\s*:\s*(Suspend)/m);
    details['Retry RC times'] = findFn(textChunk, /Retry RC times\s*:\s*(3|7|99|999|9999)\b/m);
    details['Cycle shift'] = findFn(textChunk, /ระยะเวลาใช้บริการในรอบบิลต่อไป\s*:\s*(Shift|Not Shift)/m);
    const actionText = findFn(textChunk, /Action after max retry\s*:\s*([^\r\n]*)/m);
    if (actionText) { const found = ACTION_AFTER_RETRY_PATTERNS.find(a => actionText.toLowerCase().includes(a.toLowerCase())); details['Action after max retry'] = found || actionText; }
    details['Sale Start Date'] = parseThaiDate(findFn(textChunk, /วันที่เริ่มจำหน่าย \(Sale Start Date\)\s*:\s*([^\r\n]*)/m));
    details['Deploy Date'] = parseThaiDate(findFn(textChunk, /วันเริ่มต้นใช้แพ็กเกจ \(Effective Date\)\s*:\s*([^\r\n]*)/m));
    const statusText = findFn(textChunk, /สถานะโปรโมชั่น\s*:\s*([^\r\n]*)/m);
    if (statusText) details['Deploy State'] = DEPLOY_STATE_MAP[statusText.toLowerCase().trim()] || statusText;
    details['Voice Tariff'] = findFn(textChunk, /Voice Tariff\s*:\s*([^\r\n]*)/m);
    details['SMS Tariff'] = findFn(textChunk, /SMS Tariff\s*:\s*([^\r\n]*)/m);
    details['MMS Tariff'] = findFn(textChunk, /MMS Tariff\s*:\s*([^\r\n]*)/m);
    details['GPRS Tariff'] = findFn(textChunk, /GPRS Tariff\s*:\s*([^\r\n]*)/m);
    details['Balance ID'] = findFn(textChunk, /Balance\s*ID\s*:\s*([^\r\n\s]*)/m);
    details['FU ID'] = findFn(textChunk, /FU\s*ID\s*:\s*([^\r\n\s]*)/m);
    details['Offer ID'] = findFn(textChunk, /Offer\s*ID\s*:\s*([^\r\n\s]*)/m);
    details['SCG config existing'] = findFn(textChunk, /SCG\s*config\s*existing\s*:\s*([^\r\n]*)/m);
    details['Bonus'] = findFn(textChunk, /Bonus\s*:\s*([YN])/m);
    details['Independent Sales'] = findFn(textChunk, /Independent Sales\s*:\s*([YN])/m);
    const speedMatch = findFn(textChunk, /โปรโมชั่น.*?เน็ต.*?\s([\d.]+Mbps)/m);
    if (speedMatch) { details['Speed'] = `เน็ตไม่จำกัด ${speedMatch}`; details['SpeedTemplate'] = speedMatch; }
    return details;
}

export function extractTabSeparatedData(textChunk: string): ExtractedData {
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

export function masterExtractor(textChunk: string): ExtractedData {
    let details: ExtractedData = {};
    if (/^\d{8}:\s*New/.test(textChunk)) details = extractTabSeparatedData(textChunk);
    else if (/รหัสโปรโมชั่น\s*:|ค่าบริการ \(บาท\/ไม่รวม VAT\)/.test(textChunk)) details = extractKeyValueData(textChunk);
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
    const missing = ['Legacy ID', 'Offering Name'].filter(f => !(details[f] || '').trim());
    details['⚠️ ตรวจสอบ?'] = missing.length > 0 ? 'ควรตรวจสอบ' : '';
    return details;
}
