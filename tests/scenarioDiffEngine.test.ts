import { describe, it, expect } from 'vitest';
import {
  compareScenarioReleases,
  parseScenarioText,
  DiffEngineOptions,
} from '../lib/scenarioDiffEngine';

const DEFAULT_OPTIONS: DiffEngineOptions = {
  caseSensitive: false,
  trimWhitespace: true,
  ignoreHeader: true,
  deduplicateExactLines: false,
  keyStrategy: 'SCENARIO_AND_OBJECT',
};

describe('Scenario Release Diff Engine', () => {
  it('ignores header row, empty lines, and matches shuffled pipe-delimited rows accurately', () => {
    const tb = `Counter|Scenario Name|Release Type(B: BE; R: Brand; P: Primary Offering; O: Supplementary Offering)|Release Object
SO_Speed_30M|SCE_SO_PPS_30M_63210012|O|C_SO_63210012
SFU_Speed_Max|SCE_SFU_4GMax|P|C_PO_51006670
PO_Speed_2|SCE_PO_POS_10M|P|C_PO_52100117
`;

    // Prod has rows in reverse order + extra whitespace
    const prod = `Counter|Scenario Name|Release Type(B: BE; R: Brand; P: Primary Offering; O: Supplementary Offering)|Release Object

PO_Speed_2 | SCE_PO_POS_10M | P | C_PO_52100117
SFU_Speed_Max|SCE_SFU_4GMax|P|C_PO_51006670
SO_Speed_30M|SCE_SO_PPS_30M_63210012|O|C_SO_63210012
`;

    const summary = compareScenarioReleases(tb, prod, DEFAULT_OPTIONS);
    expect(summary.totalTbLines).toBe(3);
    expect(summary.totalProdLines).toBe(3);
    expect(summary.matchCount).toBe(3);
    expect(summary.modifiedCount).toBe(0);
    expect(summary.onlyTbCount).toBe(0);
    expect(summary.onlyProdCount).toBe(0);
    expect(summary.matchPercentage).toBe('100.0');
  });

  it('detects MODIFIED fields (Counter, Release Type, Release Object) and ONLY_TB / ONLY_PROD accurately', () => {
    const tb = `Counter|Scenario Name|Release Type(B: BE; R: Brand; P: Primary Offering; O: Supplementary Offering)|Release Object
SO_Speed_30M|SCE_SO_PPS_30M_63210012|O|C_SO_63210012
SFU_Speed_Max|SCE_SFU_4GMax|P|C_PO_51006670
PO_Speed_2|SCE_PO_POS_10M|P|C_PO_52100117
O_Dr_AWN_20M_64k|SCE_SO_PPS_20M_63210084_2|O|C_SO_63210084`;

    const prod = `Counter|Scenario Name|Release Type(B: BE; R: Brand; P: Primary Offering; O: Supplementary Offering)|Release Object
SO_Speed_30M|SCE_SO_PPS_30M_63210012|O|C_SO_63210012
SFU_Speed_Max_OLD|SCE_SFU_4GMax|P|C_PO_51006670
PO_Speed_2|SCE_PO_POS_20M|P|C_PO_52100118`;

    const summary = compareScenarioReleases(tb, prod, DEFAULT_OPTIONS);

    // 1 exact match: SCE_SO_PPS_30M_63210012
    expect(summary.matchCount).toBe(1);
    // 1 modified: SCE_SFU_4GMax (Counter changed from SFU_Speed_Max to SFU_Speed_Max_OLD)
    expect(summary.modifiedCount).toBe(1);
    // 2 only in TB: SCE_PO_POS_10M and SCE_SO_PPS_20M_63210084_2
    expect(summary.onlyTbCount).toBe(2);
    // 1 only in Prod: SCE_PO_POS_20M
    expect(summary.onlyProdCount).toBe(1);

    const modRow = summary.rows.find(r => r.status === 'MODIFIED');
    expect(modRow).toBeDefined();
    expect(modRow?.diffFields.counter).toBe(true);
    expect(modRow?.diffFields.scenarioName).toBe(false);
  });

  it('flags malformed lines (missing or extra pipe columns)', () => {
    const raw = `Counter|Scenario Name|Release Type|Release Object
BROKEN_LINE_WITHOUT_ENOUGH_PIPES|SCE_TEST
VALID_CNT|SCE_VALID|O|C_SO_1001`;

    const parsed = parseScenarioText(raw, DEFAULT_OPTIONS);
    expect(parsed.records.length).toBe(2);
    expect(parsed.records[0].isMalformed).toBe(true);
    expect(parsed.records[1].isMalformed).toBe(false);
  });
});
