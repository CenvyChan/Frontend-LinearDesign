import type {
  InspectionEfficiencyReport,
  InspectionQualityReport,
} from '#/api/inspectionReport';

export type InspectionReportV2Tone = 'danger' | 'info' | 'success' | 'warning';

export interface InspectionReportV2IssueGroup {
  count: number;
  key: 'failItems' | 'overdue';
  label: string;
  tone: InspectionReportV2Tone;
}

export interface InspectionReportV2Hotspot {
  count: number;
  label: string;
  tone: InspectionReportV2Tone;
}

export interface InspectionReportV2Stage {
  description: string;
  key: 'inspect' | 'quality' | 'wait';
  label: string;
  tone: InspectionReportV2Tone;
  value: number;
}

export interface InspectionReportsV2Model {
  hotspots: InspectionReportV2Hotspot[];
  issueGroups: InspectionReportV2IssueGroup[];
  stages: InspectionReportV2Stage[];
  summary: {
    avgInspectMinutes: number;
    avgWaitMinutes: number;
    completed: number;
    passRate: number;
    totalTasks: number;
  };
}

function asNumber(value: unknown): number {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function buildInspectionReportsV2Model(
  efficiency: InspectionEfficiencyReport = {},
  quality: InspectionQualityReport = {},
): InspectionReportsV2Model {
  const overdue = asNumber(efficiency.overdue);
  const failItems = asNumber(quality.failItems);
  const passRate = asNumber(quality.passRate);

  return {
    hotspots: Object.entries(quality.failByItem || {})
      .map(([label, count]) => ({ count: asNumber(count), label, tone: 'danger' as InspectionReportV2Tone }))
      .sort((left, right) => right.count - left.count),
    issueGroups: ([
      { count: overdue, key: 'overdue', label: '超时待检', tone: 'warning' },
      { count: failItems, key: 'failItems', label: '异常检验项', tone: 'danger' },
    ] as InspectionReportV2IssueGroup[]).filter((item) => item.count > 0),
    stages: [
      {
        description: '任务从创建到开始检验的平均等待时长',
        key: 'wait',
        label: '等待',
        tone: asNumber(efficiency.avgWaitMinutes) > 30 ? 'warning' : 'success',
        value: asNumber(efficiency.avgWaitMinutes),
      },
      {
        description: '任务从开始到完成的平均检验时长',
        key: 'inspect',
        label: '执行',
        tone: asNumber(efficiency.avgInspectMinutes) > 30 ? 'warning' : 'success',
        value: asNumber(efficiency.avgInspectMinutes),
      },
      {
        description: '检验项目维度的合格率',
        key: 'quality',
        label: '质量',
        tone: passRate >= 95 ? 'success' : passRate >= 80 ? 'warning' : 'danger',
        value: passRate,
      },
    ],
    summary: {
      avgInspectMinutes: asNumber(efficiency.avgInspectMinutes),
      avgWaitMinutes: asNumber(efficiency.avgWaitMinutes),
      completed: asNumber(efficiency.completed),
      passRate,
      totalTasks: asNumber(efficiency.total),
    },
  };
}
