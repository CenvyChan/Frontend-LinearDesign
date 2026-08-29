import type { ProcessStepPrice, ProcessWageSettlement } from '#/api/processWage';

export type ProcessWageV2Tone = 'danger' | 'info' | 'normal' | 'primary' | 'success' | 'warning';

export interface ProcessWageV2IssueGroup {
  count: number;
  key: 'calcFailed' | 'erpFailed' | 'missingPrice' | 'rejected';
  label: string;
  tone: ProcessWageV2Tone;
}

export interface ProcessWageV2Stage {
  blocked: number;
  description: string;
  done: number;
  key: 'audit' | 'confirm' | 'erp' | 'price' | 'submit';
  label: string;
  tone: ProcessWageV2Tone;
  total: number;
}

export interface ProcessWageV2ActionState {
  canAudit: boolean;
  canConfirm: boolean;
  canPushErp: boolean;
  canRecalculate: boolean;
  risk: ProcessWageV2Tone;
}

export interface ProcessWageV2Model {
  issueGroups: ProcessWageV2IssueGroup[];
  stages: ProcessWageV2Stage[];
  summary: {
    activePriceCount: number;
    canPushErp: number;
    erpFailed: number;
    priceCount: number;
    workflowTotal: number;
  };
}

function count<T>(rows: T[], predicate: (row: T) => boolean): number {
  return rows.filter(predicate).length;
}

function isRejected(row: ProcessWageSettlement): boolean {
  return row.calcStatus === 'AUDIT_REJECTED' || row.calcStatus === 'CONFIRM_REJECTED';
}

function hasMissingPrice(row: ProcessWageSettlement): boolean {
  return !row.priceConfigId && !row.priceType;
}

function stageTone(total: number, blocked: number, done = 0): ProcessWageV2Tone {
  if (blocked > 0) return 'danger';
  if (total > 0 && done >= total) return 'success';
  if (total > 0) return 'warning';
  return 'info';
}

export function getProcessWageV2ActionState(row: ProcessWageSettlement): ProcessWageV2ActionState {
  return {
    canAudit: row.calcStatus === 'CONFIRMED' || row.calcStatus === 'FAILED',
    canConfirm: row.calcStatus === 'SUBMITTED' || row.calcStatus === 'FAILED',
    canPushErp: Boolean(row.canPushErp),
    canRecalculate: ['FAILED', 'CONFIRM_REJECTED', 'AUDIT_REJECTED'].includes(row.calcStatus),
    risk: row.calcStatus === 'ERP_FAILED' || row.calcStatus === 'FAILED'
      ? 'danger'
      : isRejected(row)
        ? 'warning'
        : row.calcStatus === 'ERP_PUSHED'
          ? 'success'
          : 'normal',
  };
}

export function buildProcessWageV2Model(
  settlements: ProcessWageSettlement[] = [],
  prices: ProcessStepPrice[] = [],
): ProcessWageV2Model {
  const calcFailed = count(settlements, (row) => row.calcStatus === 'FAILED');
  const erpFailed = count(settlements, (row) => row.calcStatus === 'ERP_FAILED');
  const rejected = count(settlements, isRejected);
  const missingPrice = count(settlements, hasMissingPrice);
  const activePriceCount = count(prices, (row) => row.status !== 'DISABLED');

  return {
    issueGroups: ([
      { count: calcFailed, key: 'calcFailed', label: '核算失败', tone: 'danger' },
      { count: erpFailed, key: 'erpFailed', label: 'ERP 推送失败', tone: 'danger' },
      { count: missingPrice, key: 'missingPrice', label: '缺少单价配置', tone: 'warning' },
      { count: rejected, key: 'rejected', label: '审核驳回', tone: 'warning' },
    ] as ProcessWageV2IssueGroup[]).filter((item) => item.count > 0),
    stages: [
      {
        blocked: calcFailed,
        description: '报工工资已提交等待统计确认',
        done: count(settlements, (row) => row.calcStatus !== 'SUBMITTED' && row.calcStatus !== 'FAILED'),
        key: 'submit',
        label: '提交',
        tone: stageTone(settlements.length, calcFailed),
        total: settlements.length,
      },
      {
        blocked: count(settlements, (row) => row.calcStatus === 'CONFIRM_REJECTED'),
        description: '统计确认工资金额和工序数据',
        done: count(settlements, (row) => ['CONFIRMED', 'AUDITED', 'ERP_PUSHED', 'ERP_FAILED'].includes(row.calcStatus)),
        key: 'confirm',
        label: '确认',
        tone: stageTone(settlements.length, count(settlements, (row) => row.calcStatus === 'CONFIRM_REJECTED')),
        total: settlements.length,
      },
      {
        blocked: count(settlements, (row) => row.calcStatus === 'AUDIT_REJECTED'),
        description: '主管审核工资结算结果',
        done: count(settlements, (row) => ['AUDITED', 'ERP_PUSHED', 'ERP_FAILED'].includes(row.calcStatus)),
        key: 'audit',
        label: '审核',
        tone: stageTone(settlements.length, count(settlements, (row) => row.calcStatus === 'AUDIT_REJECTED')),
        total: settlements.length,
      },
      {
        blocked: erpFailed,
        description: '末道工序工资可推送 ERP',
        done: count(settlements, (row) => row.calcStatus === 'ERP_PUSHED'),
        key: 'erp',
        label: 'ERP',
        tone: stageTone(count(settlements, (row) => Boolean(row.canPushErp || row.erpReportBillNo)), erpFailed),
        total: count(settlements, (row) => Boolean(row.canPushErp || row.erpReportBillNo)),
      },
      {
        blocked: missingPrice,
        description: '单价配置覆盖工序池、路线或工序步骤',
        done: activePriceCount,
        key: 'price',
        label: '单价',
        tone: stageTone(prices.length, missingPrice, activePriceCount),
        total: prices.length,
      },
    ],
    summary: {
      activePriceCount,
      canPushErp: count(settlements, (row) => Boolean(row.canPushErp)),
      erpFailed,
      priceCount: prices.length,
      workflowTotal: settlements.length,
    },
  };
}
