import { describe, expect, it } from 'vitest';

import type {
  InspectionEfficiencyReport,
  InspectionQualityReport,
} from '#/api/inspectionReport';

import { buildInspectionReportsV2Model } from './inspection-reports-v2-model';

describe('inspection-reports-v2-model', () => {
  it('extracts efficiency, quality, and hotspot diagnostics', () => {
    const efficiency: InspectionEfficiencyReport = {
      avgInspectMinutes: 18,
      avgWaitMinutes: 42,
      byInspector: { Ann: 5, Ben: 2 },
      completed: 6,
      overdue: 2,
      total: 8,
    };
    const quality: InspectionQualityReport = {
      failByItem: { Size: 3 },
      failItems: 3,
      passRate: 82.5,
      totalItems: 20,
    };

    const model = buildInspectionReportsV2Model(efficiency, quality);

    expect(model.summary.totalTasks).toBe(8);
    expect(model.summary.passRate).toBe(82.5);
    expect(model.issueGroups.map((item) => item.key)).toEqual([
      'overdue',
      'failItems',
    ]);
    expect(model.hotspots[0]?.label).toBe('Size');
  });
});
