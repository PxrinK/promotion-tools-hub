export type ScenarioDiffStatus =
  | 'MATCH'
  | 'MODIFIED'
  | 'ONLY_TB'
  | 'ONLY_PROD'
  | 'MALFORMED';

export type CompositeKeyStrategy =
  | 'SCENARIO_AND_OBJECT' // Default: Scenario Name + Release Object (Best for OCS Scenario Release)
  | 'SCENARIO_ONLY'       // Key by Scenario Name
  | 'COUNTER_AND_OBJECT'  // Key by Counter + Release Object
  | 'FULL_ROW';           // Exact 4-column tuple match

export interface ScenarioRecord {
  lineNumber: number;
  rawLine: string;
  counter: string;
  scenarioName: string;
  releaseType: string;
  releaseObject: string;
  isMalformed: boolean;
  malformedReason?: string;
  duplicateIndex: number; // 1-based occurrence counter if duplicate keys exist in same file
}

export interface AlignedScenarioRow {
  id: number;
  status: ScenarioDiffStatus;
  compositeKey: string;
  tbRecord: ScenarioRecord | null;
  prodRecord: ScenarioRecord | null;
  diffFields: {
    counter: boolean;
    scenarioName: boolean;
    releaseType: boolean;
    releaseObject: boolean;
  };
  isDuplicateKey: boolean;
}

export interface DiffEngineOptions {
  caseSensitive: boolean;
  trimWhitespace: boolean;
  ignoreHeader: boolean;
  deduplicateExactLines: boolean;
  keyStrategy: CompositeKeyStrategy;
}

export interface ScenarioDiffSummary {
  executionTimeMs: number;
  totalTbLines: number;
  totalProdLines: number;
  totalAlignedRows: number;
  matchCount: number;
  modifiedCount: number;
  onlyTbCount: number;
  onlyProdCount: number;
  malformedCount: number;
  duplicateTbCount: number;
  duplicateProdCount: number;
  matchPercentage: string;
  rows: AlignedScenarioRow[];
}

export const RELEASE_TYPE_LABELS: Record<string, string> = {
  B: 'BE (Billing Event)',
  R: 'Brand',
  P: 'Primary Offering',
  O: 'Supplementary Offering',
};

const HEADER_SIGNATURE = /^counter\s*\|\s*scenario\s*name/i;

/**
 * Pure helper to normalize string values according to engine options.
 */
export function normalizeField(value: string, options: Pick<DiffEngineOptions, 'caseSensitive' | 'trimWhitespace'>): string {
  let result = value ?? '';
  if (options.trimWhitespace) {
    result = result.trim();
  }
  if (!options.caseSensitive) {
    result = result.toLowerCase();
  }
  return result;
}

/**
 * Pure function to parse raw pipe-delimited text into structured ScenarioRecord items.
 * Handles BOM, CRLF/LF, empty lines, header lines, and malformed records.
 */
export function parseScenarioText(
  rawText: string,
  options: DiffEngineOptions
): { records: ScenarioRecord[]; duplicateCount: number } {
  if (!rawText) return { records: [], duplicateCount: 0 };

  // Strip UTF-8 BOM if present and split lines
  const cleanText = rawText.replace(/^\uFEFF/, '');
  const lines = cleanText.split(/\r?\n/);

  const records: ScenarioRecord[] = [];
  const seenExactLines = new Set<string>();
  let duplicateCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmedLine = rawLine.trim();

    // Skip empty lines
    if (trimmedLine === '') continue;

    // Auto-detect and skip Header row (usually line 1, or any repeated header)
    if (options.ignoreHeader && HEADER_SIGNATURE.test(trimmedLine)) {
      continue;
    }

    const parts = rawLine.split('|');
    const c0 = options.trimWhitespace ? (parts[0] ?? '').trim() : (parts[0] ?? '');
    const c1 = options.trimWhitespace ? (parts[1] ?? '').trim() : (parts[1] ?? '');
    const c2 = options.trimWhitespace ? (parts[2] ?? '').trim() : (parts[2] ?? '');
    const c3 = options.trimWhitespace ? (parts[3] ?? '').trim() : (parts[3] ?? '');

    const normFull = `${normalizeField(c0, options)}|${normalizeField(c1, options)}|${normalizeField(c2, options)}|${normalizeField(c3, options)}`;

    if (seenExactLines.has(normFull)) {
      duplicateCount++;
      if (options.deduplicateExactLines) {
        continue;
      }
    } else {
      seenExactLines.add(normFull);
    }

    let isMalformed = false;
    let malformedReason: string | undefined;

    if (parts.length < 4) {
      isMalformed = true;
      malformedReason = `พบเพียง ${parts.length} คอลัมน์ (ต้องมี 4 คอลัมน์คั่นด้วย |)`;
    } else if (parts.length > 4) {
      isMalformed = true;
      malformedReason = `พบ ${parts.length} คอลัมน์ (มีเครื่องหมาย | เกินมา ${parts.length - 4} จุด)`;
    } else if (!c0 || !c1 || !c2 || !c3) {
      isMalformed = true;
      malformedReason = 'มีคอลัมน์ที่มีค่าว่างเปล่า';
    }

    records.push({
      lineNumber: i + 1,
      rawLine: options.trimWhitespace ? trimmedLine : rawLine,
      counter: c0,
      scenarioName: c1,
      releaseType: c2,
      releaseObject: c3,
      isMalformed,
      malformedReason,
      duplicateIndex: 1,
    });
  }

  return { records, duplicateCount };
}

/**
 * Pure function to build a composite lookup key for a ScenarioRecord.
 */
export function buildCompositeKey(
  rec: ScenarioRecord,
  options: DiffEngineOptions
): string {
  const counter = normalizeField(rec.counter, options);
  const scenario = normalizeField(rec.scenarioName, options);
  const rType = normalizeField(rec.releaseType, options);
  const rObj = normalizeField(rec.releaseObject, options);

  switch (options.keyStrategy) {
    case 'SCENARIO_ONLY':
      return scenario || `__LINE_${rec.lineNumber}`;
    case 'COUNTER_AND_OBJECT':
      return `${counter}||${rObj}`;
    case 'FULL_ROW':
      return `${counter}|${scenario}|${rType}|${rObj}`;
    case 'SCENARIO_AND_OBJECT':
    default:
      return `${scenario}||${rObj}`;
  }
}

/**
 * High-Performance O(N) Data Diffing Engine for Scenario Release (Testbase vs Production).
 * Multi-stage alignment:
 *   Stage 1: Exact 4-column match pairing (handles identical rows even if shuffled or duplicated)
 *   Stage 2: Composite Key alignment (pairs modified rows where e.g. Counter or Release Type changed)
 *   Stage 3: Secondary fallback pairing by Scenario Name or Release Object so renamed scenarios/objects align side-by-side
 */
export function compareScenarioReleases(
  rawTbText: string,
  rawProdText: string,
  options: DiffEngineOptions
): ScenarioDiffSummary {
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const parsedTb = parseScenarioText(rawTbText, options);
  const parsedProd = parseScenarioText(rawProdText, options);

  const tbRecords = parsedTb.records;
  const prodRecords = parsedProd.records;

  const fullTupleKey = (r: ScenarioRecord) =>
    `${normalizeField(r.counter, options)}|${normalizeField(r.scenarioName, options)}|${normalizeField(r.releaseType, options)}|${normalizeField(r.releaseObject, options)}`;

  // Track duplicate composite keys within each side
  const tbKeyCounts = new Map<string, number>();
  for (const r of tbRecords) {
    const k = buildCompositeKey(r, options);
    const count = (tbKeyCounts.get(k) ?? 0) + 1;
    tbKeyCounts.set(k, count);
    r.duplicateIndex = count;
  }

  const prodKeyCounts = new Map<string, number>();
  for (const r of prodRecords) {
    const k = buildCompositeKey(r, options);
    const count = (prodKeyCounts.get(k) ?? 0) + 1;
    prodKeyCounts.set(k, count);
    r.duplicateIndex = count;
  }

  // --- STAGE 1: Exact 4-Column Match Pairing (O(N)) ---
  const exactMapTb = new Map<string, ScenarioRecord[]>();
  const exactMapProd = new Map<string, ScenarioRecord[]>();

  for (const r of tbRecords) {
    const fk = fullTupleKey(r);
    const bucket = exactMapTb.get(fk);
    if (bucket) bucket.push(r);
    else exactMapTb.set(fk, [r]);
  }
  for (const r of prodRecords) {
    const fk = fullTupleKey(r);
    const bucket = exactMapProd.get(fk);
    if (bucket) bucket.push(r);
    else exactMapProd.set(fk, [r]);
  }

  const alignedRows: AlignedScenarioRow[] = [];
  const leftoverTb: ScenarioRecord[] = [];
  const leftoverProd: ScenarioRecord[] = [];

  let matchCount = 0;
  let modifiedCount = 0;
  let onlyTbCount = 0;
  let onlyProdCount = 0;
  let malformedCount = 0;

  const allExactKeys = new Set([...exactMapTb.keys(), ...exactMapProd.keys()]);
  allExactKeys.forEach(fk => {
    const aList = exactMapTb.get(fk) ?? [];
    const bList = exactMapProd.get(fk) ?? [];
    const commonLen = Math.min(aList.length, bList.length);

    for (let i = 0; i < commonLen; i++) {
      const tbRec = aList[i];
      const prodRec = bList[i];
      const compKey = buildCompositeKey(tbRec, options);
      const isMalformed = tbRec.isMalformed || prodRec.isMalformed;

      if (isMalformed) malformedCount++;
      else matchCount++;

      alignedRows.push({
        id: 0,
        status: isMalformed ? 'MALFORMED' : 'MATCH',
        compositeKey: compKey,
        tbRecord: tbRec,
        prodRecord: prodRec,
        diffFields: {
          counter: false,
          scenarioName: false,
          releaseType: false,
          releaseObject: false,
        },
        isDuplicateKey: (tbKeyCounts.get(compKey) ?? 0) > 1 || (prodKeyCounts.get(compKey) ?? 0) > 1,
      });
    }

    for (let i = commonLen; i < aList.length; i++) leftoverTb.push(aList[i]);
    for (let i = commonLen; i < bList.length; i++) leftoverProd.push(bList[i]);
  });

  // --- STAGE 2: Composite Key Pairing for Modified Rows (O(N)) ---
  const keyMapProd = new Map<string, ScenarioRecord[]>();
  for (const r of leftoverProd) {
    const k = buildCompositeKey(r, options);
    const bucket = keyMapProd.get(k);
    if (bucket) bucket.push(r);
    else keyMapProd.set(k, [r]);
  }

  const stage2UnmatchedTb: ScenarioRecord[] = [];

  const createModifiedOrMalformedRow = (tbRec: ScenarioRecord, prodRec: ScenarioRecord) => {
    const compKey = buildCompositeKey(tbRec, options);
    const isMalformed = tbRec.isMalformed || prodRec.isMalformed;
    if (isMalformed) malformedCount++;
    else modifiedCount++;

    alignedRows.push({
      id: 0,
      status: isMalformed ? 'MALFORMED' : 'MODIFIED',
      compositeKey: compKey,
      tbRecord: tbRec,
      prodRecord: prodRec,
      diffFields: {
        counter: normalizeField(tbRec.counter, options) !== normalizeField(prodRec.counter, options),
        scenarioName: normalizeField(tbRec.scenarioName, options) !== normalizeField(prodRec.scenarioName, options),
        releaseType: normalizeField(tbRec.releaseType, options) !== normalizeField(prodRec.releaseType, options),
        releaseObject: normalizeField(tbRec.releaseObject, options) !== normalizeField(prodRec.releaseObject, options),
      },
      isDuplicateKey: (tbKeyCounts.get(compKey) ?? 0) > 1 || (prodKeyCounts.get(compKey) ?? 0) > 1,
    });
  };

  for (const tbRec of leftoverTb) {
    const k = buildCompositeKey(tbRec, options);
    const candidates = keyMapProd.get(k);
    if (candidates && candidates.length > 0) {
      const prodRec = candidates.shift()!;
      createModifiedOrMalformedRow(tbRec, prodRec);
    } else {
      stage2UnmatchedTb.push(tbRec);
    }
  }

  const stage2UnmatchedProd: ScenarioRecord[] = [];
  keyMapProd.forEach(bucket => {
    for (const r of bucket) stage2UnmatchedProd.push(r);
  });

  // --- STAGE 3: Smart Fallback Pairing by Scenario Name OR Release Object ---
  // In telecom releases, sometimes the Scenario Name is kept identical while Release Object changed,
  // or Counter + Release Object are identical while Scenario Name suffix (_2) changed.
  if (options.keyStrategy === 'SCENARIO_AND_OBJECT') {
    const scenarioMapProd = new Map<string, ScenarioRecord[]>();
    for (const r of stage2UnmatchedProd) {
      const sKey = normalizeField(r.scenarioName, options);
      if (!sKey) continue;
      const bucket = scenarioMapProd.get(sKey);
      if (bucket) bucket.push(r);
      else scenarioMapProd.set(sKey, [r]);
    }

    const stage3UnmatchedTb: ScenarioRecord[] = [];
    for (const tbRec of stage2UnmatchedTb) {
      const sKey = normalizeField(tbRec.scenarioName, options);
      const candidates = sKey ? scenarioMapProd.get(sKey) : undefined;
      if (candidates && candidates.length > 0) {
        const prodRec = candidates.shift()!;
        createModifiedOrMalformedRow(tbRec, prodRec);
      } else {
        stage3UnmatchedTb.push(tbRec);
      }
    }

    const remainingProdAfterScenario: ScenarioRecord[] = [];
    scenarioMapProd.forEach(bucket => {
      for (const r of bucket) remainingProdAfterScenario.push(r);
    });
    for (const r of stage2UnmatchedProd) {
      if (!normalizeField(r.scenarioName, options)) remainingProdAfterScenario.push(r);
    }

    // Secondary fallback: Match by Counter + Release Object
    const counterObjMapProd = new Map<string, ScenarioRecord[]>();
    for (const r of remainingProdAfterScenario) {
      const coKey = `${normalizeField(r.counter, options)}||${normalizeField(r.releaseObject, options)}`;
      const bucket = counterObjMapProd.get(coKey);
      if (bucket) bucket.push(r);
      else counterObjMapProd.set(coKey, [r]);
    }

    const finalUnmatchedTb: ScenarioRecord[] = [];
    for (const tbRec of stage3UnmatchedTb) {
      const coKey = `${normalizeField(tbRec.counter, options)}||${normalizeField(tbRec.releaseObject, options)}`;
      const candidates = counterObjMapProd.get(coKey);
      if (candidates && candidates.length > 0) {
        const prodRec = candidates.shift()!;
        createModifiedOrMalformedRow(tbRec, prodRec);
      } else {
        finalUnmatchedTb.push(tbRec);
      }
    }

    const finalUnmatchedProd: ScenarioRecord[] = [];
    counterObjMapProd.forEach(bucket => {
      for (const r of bucket) finalUnmatchedProd.push(r);
    });

    // Remaining are strictly ONLY_TB or ONLY_PROD
    for (const tbRec of finalUnmatchedTb) {
      const compKey = buildCompositeKey(tbRec, options);
      if (tbRec.isMalformed) malformedCount++;
      else onlyTbCount++;

      alignedRows.push({
        id: 0,
        status: tbRec.isMalformed ? 'MALFORMED' : 'ONLY_TB',
        compositeKey: compKey,
        tbRecord: tbRec,
        prodRecord: null,
        diffFields: { counter: true, scenarioName: true, releaseType: true, releaseObject: true },
        isDuplicateKey: (tbKeyCounts.get(compKey) ?? 0) > 1,
      });
    }

    for (const prodRec of finalUnmatchedProd) {
      const compKey = buildCompositeKey(prodRec, options);
      if (prodRec.isMalformed) malformedCount++;
      else onlyProdCount++;

      alignedRows.push({
        id: 0,
        status: prodRec.isMalformed ? 'MALFORMED' : 'ONLY_PROD',
        compositeKey: compKey,
        tbRecord: null,
        prodRecord: prodRec,
        diffFields: { counter: true, scenarioName: true, releaseType: true, releaseObject: true },
        isDuplicateKey: (prodKeyCounts.get(compKey) ?? 0) > 1,
      });
    }
  } else {
    // Non-fallback mode: remaining stage2 items go straight to ONLY_TB / ONLY_PROD
    for (const tbRec of stage2UnmatchedTb) {
      const compKey = buildCompositeKey(tbRec, options);
      if (tbRec.isMalformed) malformedCount++;
      else onlyTbCount++;

      alignedRows.push({
        id: 0,
        status: tbRec.isMalformed ? 'MALFORMED' : 'ONLY_TB',
        compositeKey: compKey,
        tbRecord: tbRec,
        prodRecord: null,
        diffFields: { counter: true, scenarioName: true, releaseType: true, releaseObject: true },
        isDuplicateKey: (tbKeyCounts.get(compKey) ?? 0) > 1,
      });
    }

    for (const prodRec of stage2UnmatchedProd) {
      const compKey = buildCompositeKey(prodRec, options);
      if (prodRec.isMalformed) malformedCount++;
      else onlyProdCount++;

      alignedRows.push({
        id: 0,
        status: prodRec.isMalformed ? 'MALFORMED' : 'ONLY_PROD',
        compositeKey: compKey,
        tbRecord: null,
        prodRecord: prodRec,
        diffFields: { counter: true, scenarioName: true, releaseType: true, releaseObject: true },
        isDuplicateKey: (prodKeyCounts.get(compKey) ?? 0) > 1,
      });
    }
  }

  // Sort rows deterministically:
  // Priority: MALFORMED -> MODIFIED -> ONLY_TB -> ONLY_PROD -> MATCH
  // Within same status: sort by Scenario Name -> Counter -> Release Object
  const statusOrder: Record<ScenarioDiffStatus, number> = {
    MALFORMED: 0,
    MODIFIED: 1,
    ONLY_TB: 2,
    ONLY_PROD: 3,
    MATCH: 4,
  };

  alignedRows.sort((a, b) => {
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    const scA = a.tbRecord?.scenarioName || a.prodRecord?.scenarioName || '';
    const scB = b.tbRecord?.scenarioName || b.prodRecord?.scenarioName || '';
    const cmpScenario = scA.localeCompare(scB, undefined, { numeric: true, sensitivity: 'base' });
    if (cmpScenario !== 0) return cmpScenario;

    const cntA = a.tbRecord?.counter || a.prodRecord?.counter || '';
    const cntB = b.tbRecord?.counter || b.prodRecord?.counter || '';
    return cntA.localeCompare(cntB, undefined, { numeric: true, sensitivity: 'base' });
  });

  for (let i = 0; i < alignedRows.length; i++) {
    alignedRows[i].id = i + 1;
  }

  const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const totalAlignedRows = alignedRows.length;
  const matchPercentage =
    totalAlignedRows > 0 ? ((matchCount / totalAlignedRows) * 100).toFixed(1) : '0.0';

  return {
    executionTimeMs: Math.max(1, Math.round(endTime - startTime)),
    totalTbLines: tbRecords.length,
    totalProdLines: prodRecords.length,
    totalAlignedRows,
    matchCount,
    modifiedCount,
    onlyTbCount,
    onlyProdCount,
    malformedCount,
    duplicateTbCount: parsedTb.duplicateCount,
    duplicateProdCount: parsedProd.duplicateCount,
    matchPercentage,
    rows: alignedRows,
  };
}
