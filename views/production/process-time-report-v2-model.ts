import type { ProcessTimeReportResult, ProcessTimeReportRow } from '#/api/processTimeReport';

export type ProcessTimeReportV2Tone = 'danger' | 'info' | 'success' | 'warning';
export type ProcessTimeReportV2StageKey = '' | 'actual' | 'anomaly' | 'efficiency' | 'standard';

export interface ProcessTimeReportV2IssueGroup {
  count: number;
  key: 'noActualTime' | 'noQuantity' | 'noStandard' | 'severe';
  label: string;
  tone: ProcessTimeReportV2Tone;
}

export interface ProcessTimeReportV2Stage {
  description: string;
  key: 'actual' | 'anomaly' | 'efficiency' | 'standard';
  label: string;
  tone: ProcessTimeReportV2Tone;
  value: number;
}

export interface ProcessTimeReportV2Model {
  issueGroups: ProcessTimeReportV2IssueGroup[];
  stages: ProcessTimeReportV2Stage[];
  summary: {
    abnormalRate: number;
    totalCount: number;
    totalQuantity: number;
    totalVarianceMinutes: number;
    efficiencyRate: number;
  };
}

function asNumber(value: unknown): number {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function count(rows: ProcessTimeReportRow[], predicate: (row: ProcessTimeReportRow) => boolean): number {
  return rows.filter(predicate).length;
}

function isPositiveVariance(row: ProcessTimeReportRow): boolean {
  return asNumber(row.varianceMinutes) > 0 || asNumber(row.taktVarianceMinutes) > 0;
}

export function filterRowsByProcessTimeStage(
  rows: ProcessTimeReportRow[],
  stageKey: ProcessTimeReportV2StageKey,
): ProcessTimeReportRow[] {
  if (!stageKey) return rows;
  const filters: Record<Exclude<ProcessTimeReportV2StageKey, ''>, (row: ProcessTimeReportRow) => boolean> = {
    actual: (row) =>
      row.anomalyLevel === 'NO_ACTUAL_TIME'
      || row.anomalyLevel === 'NO_QUANTITY'
      || (row.actualMinutes !== undefined && asNumber(row.actualMinutes) <= 0)
      || (row.actualWorkSeconds !== undefined && asNumber(row.actualWorkSeconds) <= 0)
      || (row.actualQuantity !== undefined && asNumber(row.actualQuantity) <= 0),
    anomaly: (row) => Boolean(row.anomalyLevel && row.anomalyLevel !== 'NORMAL'),
    efficiency: (row) => (row.efficiencyRate !== undefined && asNumber(row.efficiencyRate) < 90) || isPositiveVariance(row),
    standard: (row) => row.anomalyLevel === 'NO_STANDARD' || (row.standardMinutes !== undefined && asNumber(row.standardMinutes) <= 0),
  };
  return rows.filter(filters[stageKey]);
}

export function paginateProcessTimeRows(
  rows: ProcessTimeReportRow[],
  page: number,
  pageSize: number,
): ProcessTimeReportRow[] {
  const safePage = Math.max(1, Math.floor(asNumber(page)) || 1);
  const safePageSize = Math.max(1, Math.floor(asNumber(pageSize)) || 20);
  const start = (safePage - 1) * safePageSize;
  return rows.slice(start, start + safePageSize);
}

export function buildProcessTimeReportV2Model(report: Partial<ProcessTimeReportResult> = {}): ProcessTimeReportV2Model {
  const rows = report.rows || [];
  const summary = report.summary || {
    abnormalCount: 0,
    normalCount: 0,
    totalCount: 0,
    totalQuantity: 0,
  };
  const totalCount = asNumber(summary.totalCount);
  const abnormalCount = asNumber(summary.abnormalCount);
  const noStandard = count(rows, (row) => row.anomalyLevel === 'NO_STANDARD' || asNumber(row.standardMinutes) <= 0);
  const noActualTime = count(rows, (row) => row.anomalyLevel === 'NO_ACTUAL_TIME');
  const noQuantity = count(rows, (row) => row.anomalyLevel === 'NO_QUANTITY');
  const severe = count(rows, (row) => ['SEVERE', 'MAJOR'].includes(row.anomalyLevel));

  return {
    issueGroups: ([
      { count: noStandard, key: 'noStandard', label: '缺少标准工时', tone: 'danger' },
      { count: noActualTime, key: 'noActualTime', label: '缺少实际工时', tone: 'danger' },
      { count: noQuantity, key: 'noQuantity', label: '缺少完工数量', tone: 'warning' },
      { count: severe, key: 'severe', label: '严重节拍偏差', tone: 'danger' },
    ] as ProcessTimeReportV2IssueGroup[]).filter((item) => item.count > 0),
    stages: [
      {
        description: '标准工时、标准产出和工序节拍配置',
        key: 'standard',
        label: '标准',
        tone: noStandard ? 'danger' : 'success',
        value: rows.length - noStandard,
      },
      {
        description: '实际工时、完成数量和不良数量',
        key: 'actual',
        label: '实际',
        tone: noActualTime || noQuantity ? 'warning' : 'success',
        value: rows.length - noActualTime - noQuantity,
      },
      {
        description: '总体效率和工时偏差',
        key: 'efficiency',
        label: '效率',
        tone: asNumber(summary.overallEfficiencyRate) >= 90 ? 'success' : 'warning',
        value: asNumber(summary.overallEfficiencyRate),
      },
      {
        description: '异常等级和异常说明',
        key: 'anomaly',
        label: '异常',
        tone: abnormalCount > 0 ? 'danger' : 'success',
        value: abnormalCount,
      },
    ],
    summary: {
      abnormalRate: totalCount ? Math.round((abnormalCount / totalCount) * 10000) / 100 : 0,
      efficiencyRate: asNumber(summary.overallEfficiencyRate),
      totalCount,
      totalQuantity: asNumber(summary.totalQuantity),
      totalVarianceMinutes: asNumber(summary.totalVarianceMinutes),
    },
  };
}
