import { describe, expect, it } from 'vitest';

import type { ProcessTimeReportResult } from '#/api/processTimeReport';

import {
  buildProcessTimeReportV2Model,
  filterRowsByProcessTimeStage,
  paginateProcessTimeRows,
} from './process-time-report-v2-model';

describe('process-time-report-v2-model', () => {
  it('groups takt variance and anomaly causes', () => {
    const report: ProcessTimeReportResult = {
      rows: [
        {
          anomalyLevel: 'NO_STANDARD',
          anomalyText: 'No standard',
          flowId: 1,
          orderNo: 'MO-001',
        },
        {
          actualMinutes: 50,
          anomalyLevel: 'SEVERE',
          anomalyText: 'Slow',
          efficiencyRate: 60,
          flowId: 2,
          operatorName: 'Ann',
          orderNo: 'MO-002',
          standardMinutes: 30,
          varianceMinutes: 20,
        },
      ],
      summary: {
        abnormalCount: 2,
        normalCount: 0,
        overallEfficiencyRate: 60,
        totalCount: 2,
        totalQuantity: 8,
        totalVarianceMinutes: 20,
      },
    };

    const model = buildProcessTimeReportV2Model(report);

    expect(model.summary.totalCount).toBe(2);
    expect(model.summary.abnormalRate).toBe(100);
    expect(model.issueGroups.map((item) => item.key)).toEqual([
      'noStandard',
      'severe',
    ]);
  });

  it('filters rows by clicked stage', () => {
    const rows = [
      { anomalyLevel: 'NO_STANDARD', anomalyText: 'No standard', flowId: 1, standardMinutes: 0 },
      { actualMinutes: 0, anomalyLevel: 'NO_ACTUAL_TIME', anomalyText: 'No actual', flowId: 2 },
      { actualMinutes: 20, anomalyLevel: 'NORMAL', anomalyText: 'Normal', efficiencyRate: 80, flowId: 3, standardMinutes: 10, varianceMinutes: 10 },
      { actualMinutes: 8, anomalyLevel: 'NORMAL', anomalyText: 'Normal', efficiencyRate: 110, flowId: 4, standardMinutes: 10, varianceMinutes: -2 },
    ];

    expect(filterRowsByProcessTimeStage(rows, 'standard').map((row) => row.flowId)).toEqual([1]);
    expect(filterRowsByProcessTimeStage(rows, 'actual').map((row) => row.flowId)).toEqual([2]);
    expect(filterRowsByProcessTimeStage(rows, 'efficiency').map((row) => row.flowId)).toEqual([3]);
    expect(filterRowsByProcessTimeStage(rows, 'anomaly').map((row) => row.flowId)).toEqual([1, 2]);
    expect(filterRowsByProcessTimeStage(rows, '').map((row) => row.flowId)).toEqual([1, 2, 3, 4]);
  });

  it('paginates filtered rows with stable defaults', () => {
    const rows = Array.from({ length: 45 }, (_, index) => ({
      anomalyLevel: 'NORMAL',
      anomalyText: 'Normal',
      flowId: index + 1,
    }));

    expect(paginateProcessTimeRows(rows, 1, 20).map((row) => row.flowId)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    expect(paginateProcessTimeRows(rows, 3, 20).map((row) => row.flowId)).toEqual([41, 42, 43, 44, 45]);
    expect(paginateProcessTimeRows(rows, 0, 20).map((row) => row.flowId)[0]).toBe(1);
  });
});
