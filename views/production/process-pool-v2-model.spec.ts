import { describe, expect, it } from 'vitest';

import type { ProcessPool } from '#/api/processPool';

import { buildProcessPoolV2Model } from './process-pool-v2-model';

describe('process-pool-v2-model', () => {
  it('summarizes process readiness and configuration gaps', () => {
    const rows: ProcessPool[] = [
      {
        processCode: 'P10',
        processName: 'Cut',
        reportMethod: 'REQUIRED',
        standardDuration: 10,
        status: 'ACTIVE',
        workCenterName: 'WC-A',
      },
      {
        processCode: 'P20',
        processName: 'Polish',
        status: 'ACTIVE',
      },
      {
        processCode: 'P30',
        processName: 'Pack',
        status: 'DISABLED',
        workCenterName: 'WC-B',
      },
    ];

    const model = buildProcessPoolV2Model(rows);

    expect(model.summary.total).toBe(3);
    expect(model.summary.active).toBe(2);
    expect(model.issueGroups.map((item) => item.key)).toEqual([
      'disabled',
      'missingWorkCenter',
      'missingStandard',
      'missingReportControl',
    ]);
  });
});
