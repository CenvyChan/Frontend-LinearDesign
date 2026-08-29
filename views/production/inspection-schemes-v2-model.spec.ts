import { describe, expect, it } from 'vitest';

import type { InspectionScheme, InspectionSchemeItem } from '#/api/inspectionScheme';

import { buildInspectionSchemesV2Model } from './inspection-schemes-v2-model';

describe('inspection-schemes-v2-model', () => {
  it('summarizes scheme coverage and selected item risks', () => {
    const schemes: InspectionScheme[] = [
      {
        id: 1,
        inspectionType: 'PQC',
        processCode: 'P10',
        schemeCode: 'PQC-A',
        schemeName: 'PQC A',
        status: 'ACTIVE',
        version: 'V1',
      },
      {
        id: 2,
        inspectionType: 'IQC',
        schemeCode: 'IQC-A',
        schemeName: 'IQC A',
        status: 'DISABLED',
        version: 'V1',
      },
    ];
    const items: InspectionSchemeItem[] = [
      {
        itemCode: 'SIZE',
        itemName: 'Size',
        requiredFlag: true,
        sampleCount: 1,
        valueType: 'NUMERIC',
      },
      {
        itemCode: 'LOOK',
        itemName: 'Look',
        requiredFlag: false,
        sampleCount: 0,
        valueType: 'TEXT',
      },
    ];

    const model = buildInspectionSchemesV2Model(schemes, items);

    expect(model.summary.total).toBe(2);
    expect(model.summary.active).toBe(1);
    expect(model.summary.selectedItemCount).toBe(2);
    expect(model.issueGroups.map((item) => item.key)).toContain('numericWithoutLimit');
    expect(model.coverageByType.find((item) => item.key === 'PQC')?.count).toBe(1);
  });
});
