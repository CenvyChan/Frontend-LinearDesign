import type { ProcessPool } from '#/api/processPool';

export type ProcessPoolV2Tone = 'danger' | 'info' | 'success' | 'warning';

export interface ProcessPoolV2IssueGroup {
  count: number;
  key: 'disabled' | 'missingReportControl' | 'missingStandard' | 'missingWorkCenter';
  label: string;
  tone: ProcessPoolV2Tone;
}

export interface ProcessPoolV2Stage {
  description: string;
  done: number;
  key: 'active' | 'quality' | 'report' | 'standard' | 'workCenter';
  label: string;
  tone: ProcessPoolV2Tone;
  total: number;
}

export interface ProcessPoolV2Model {
  issueGroups: ProcessPoolV2IssueGroup[];
  stages: ProcessPoolV2Stage[];
  summary: {
    active: number;
    disabled: number;
    missingStandard: number;
    total: number;
    withWorkCenter: number;
  };
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasStandard(row: ProcessPool): boolean {
  return Number(row.standardDuration || row.standardHours || 0) > 0;
}

function stageTone(done: number, total: number, blocked = 0): ProcessPoolV2Tone {
  if (blocked > 0) return 'danger';
  if (total > 0 && done >= total) return 'success';
  if (done > 0) return 'warning';
  return 'info';
}

export function buildProcessPoolV2Model(rows: ProcessPool[] = []): ProcessPoolV2Model {
  const disabled = rows.filter((row) => row.status === 'DISABLED').length;
  const missingWorkCenter = rows.filter((row) => !row.workCenterId && !hasText(row.workCenterName)).length;
  const missingStandard = rows.filter((row) => !hasStandard(row)).length;
  const missingReportControl = rows.filter((row) => !hasText(row.reportMethod) && !hasText(row.reportOrder)).length;

  return {
    issueGroups: ([
      { count: disabled, key: 'disabled', label: '停用工序', tone: 'warning' },
      { count: missingWorkCenter, key: 'missingWorkCenter', label: '缺少工作中心', tone: 'danger' },
      { count: missingStandard, key: 'missingStandard', label: '缺少标准工时', tone: 'danger' },
      { count: missingReportControl, key: 'missingReportControl', label: '缺少报工控制', tone: 'warning' },
    ] as ProcessPoolV2IssueGroup[]).filter((item) => item.count > 0),
    stages: [
      {
        description: '启用后才会参与工艺路线和报工选择',
        done: rows.length - disabled,
        key: 'active',
        label: '启用',
        tone: stageTone(rows.length - disabled, rows.length, disabled),
        total: rows.length,
      },
      {
        description: '绑定工作中心，方便产能与工资归集',
        done: rows.length - missingWorkCenter,
        key: 'workCenter',
        label: '工作中心',
        tone: stageTone(rows.length - missingWorkCenter, rows.length, missingWorkCenter),
        total: rows.length,
      },
      {
        description: '标准工时和准备工时用于节拍分析',
        done: rows.length - missingStandard,
        key: 'standard',
        label: '标准',
        tone: stageTone(rows.length - missingStandard, rows.length, missingStandard),
        total: rows.length,
      },
      {
        description: '检验方式和缺陷类型决定质量动作',
        done: rows.filter((row) => hasText(row.inspectionMethod) || hasText(row.defectTypes)).length,
        key: 'quality',
        label: '质量',
        tone: stageTone(rows.filter((row) => hasText(row.inspectionMethod) || hasText(row.defectTypes)).length, rows.length),
        total: rows.length,
      },
      {
        description: '报工方式和顺序控制影响执行风险',
        done: rows.length - missingReportControl,
        key: 'report',
        label: '报工',
        tone: stageTone(rows.length - missingReportControl, rows.length, missingReportControl),
        total: rows.length,
      },
    ],
    summary: {
      active: rows.length - disabled,
      disabled,
      missingStandard,
      total: rows.length,
      withWorkCenter: rows.length - missingWorkCenter,
    },
  };
}
