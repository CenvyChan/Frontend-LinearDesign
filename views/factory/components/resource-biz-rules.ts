import type { ButtonProps } from 'element-plus';

import type { ResourceBizAction, ResourceType } from '#/api/resourceBiz';

export interface ResourceBizActionRule {
  action: ResourceBizAction;
  label: string;
  icon: string;
  buttonType: ButtonProps['type'];
  detailLabel: string;
  detailPlaceholder: string;
  nextBizDateLabel?: string;
  nextBizDateRequired?: boolean;
  confirmMessage?: string;
}

export const resourceBizActionLabels: Record<ResourceBizAction, string> = {
  RECEIVE: '领用',
  RETURN: '归还',
  MAINTAIN: '保养',
  REPAIR: '维修',
  SCRAP: '报废',
  CALIBRATE: '校准',
};

export interface ResourceStatusView {
  statusCode: string;
  statusText: string;
  tagType: ButtonProps['type'];
  canReceive: boolean;
  canReturn: boolean;
  canMaintain: boolean;
  canRepair: boolean;
  canScrap: boolean;
  canCalibrate: boolean;
}

const commonRules: Record<ResourceBizAction, ResourceBizActionRule> = {
  RECEIVE: {
    action: 'RECEIVE',
    label: '领用',
    icon: 'Check',
    buttonType: 'primary',
    detailLabel: '领用说明',
    detailPlaceholder: '填写领用用途或工序说明',
  },
  RETURN: {
    action: 'RETURN',
    label: '归还',
    icon: 'RefreshRight',
    buttonType: 'success',
    detailLabel: '归还说明',
    detailPlaceholder: '填写归还情况',
  },
  MAINTAIN: {
    action: 'MAINTAIN',
    label: '保养',
    icon: 'Refresh',
    buttonType: 'warning',
    detailLabel: '保养内容',
    detailPlaceholder: '填写保养内容、检查项和处理结果',
    nextBizDateLabel: '下次保养日期',
    nextBizDateRequired: true,
  },
  REPAIR: {
    action: 'REPAIR',
    label: '维修',
    icon: 'Edit',
    buttonType: 'warning',
    detailLabel: '维修原因/结果',
    detailPlaceholder: '填写故障原因、维修过程和处理结果',
  },
  SCRAP: {
    action: 'SCRAP',
    label: '报废',
    icon: 'Delete',
    buttonType: 'danger',
    detailLabel: '报废原因',
    detailPlaceholder: '填写报废原因和审批说明',
    confirmMessage: '确认报废该资源？此操作会改变资源状态。',
  },
  CALIBRATE: {
    action: 'CALIBRATE',
    label: '校准',
    icon: 'CircleCheck',
    buttonType: 'primary',
    detailLabel: '校准结果',
    detailPlaceholder: '填写校准结果、附件编号或异常说明',
    nextBizDateLabel: '下次校准日期',
    nextBizDateRequired: true,
  },
};

const actionsByResource: Record<ResourceType, ResourceBizAction[]> = {
  MACHINE: ['RECEIVE', 'RETURN', 'MAINTAIN', 'REPAIR', 'SCRAP'],
  TOOLING: ['RECEIVE', 'RETURN', 'MAINTAIN', 'REPAIR', 'SCRAP'],
  GAUGE: ['RECEIVE', 'RETURN', 'CALIBRATE', 'REPAIR', 'SCRAP'],
  MOULD: ['RECEIVE', 'RETURN', 'MAINTAIN', 'REPAIR', 'SCRAP'],
};

const statusTextMap: Record<string, string> = {
  CALIBRATION_DUE: '待校准',
  DISABLED: '停用',
  EXPIRED: '已过期',
  IN_USE: '使用中',
  MAINTAINING: '保养中',
  MAINTENANCE: '维修中',
  MOVED_IN: '移模入',
  MOVED_OUT: '移模出',
  NORMAL: '正常',
  REPAIRING: '维修中',
  RUNNING: '运行中',
  SCRAP: '已报废',
  SCRAPPED: '已报废',
  STALE: '呆滞',
  END_OF_LIFE: '寿终',
};

const statusTagMap: Record<string, ButtonProps['type']> = {
  CALIBRATION_DUE: 'warning',
  DISABLED: 'info',
  EXPIRED: 'danger',
  IN_USE: 'primary',
  MAINTAINING: 'warning',
  MAINTENANCE: 'warning',
  MOVED_IN: 'success',
  MOVED_OUT: 'info',
  NORMAL: 'success',
  REPAIRING: 'warning',
  RUNNING: 'primary',
  SCRAP: 'danger',
  SCRAPPED: 'danger',
  STALE: 'info',
  END_OF_LIFE: 'danger',
};

function rawStatus(resource: Record<string, any> | undefined) {
  return String(resource?.status ?? resource?.mouldStatus ?? '').trim().toUpperCase();
}

function normalizeStatus(resourceType: ResourceType, resource: Record<string, any> | undefined) {
  const status = String(resource?.statusCode ?? '').trim().toUpperCase() || rawStatus(resource);
  if (resourceType === 'MOULD') {
    if (!status || status === 'ZC') return 'NORMAL';
    if (status === 'YMC') return 'MOVED_OUT';
    if (status === 'YMR') return 'MOVED_IN';
    if (status === 'SZ') return 'END_OF_LIFE';
    if (status === 'DZ') return 'STALE';
    if (status === 'BF') return 'SCRAPPED';
    return status;
  }
  const commonAliasMap: Record<string, string> = {
    ACTIVE: 'NORMAL',
    AVAILABLE: 'NORMAL',
    IDLE: 'NORMAL',
    SCRAP: 'SCRAPPED',
  };
  return commonAliasMap[status] || status;
}

export function getResourceStatusView(
  resourceType: ResourceType,
  resource: Record<string, any> | undefined,
): ResourceStatusView {
  if (resource?.statusCode && resource?.statusText) {
    return {
      statusCode: String(resource.statusCode),
      statusText: String(resource.statusText),
      tagType: resource.statusTagType || 'info',
      canReceive: Boolean(resource.canReceive),
      canReturn: Boolean(resource.canReturn),
      canMaintain: Boolean(resource.canMaintain),
      canRepair: Boolean(resource.canRepair),
      canScrap: Boolean(resource.canScrap),
      canCalibrate: Boolean(resource.canCalibrate),
    };
  }
  const statusCode = normalizeStatus(resourceType, resource);
  if (resourceType === 'MOULD') {
    const canReceive = ['NORMAL', 'MOVED_IN'].includes(statusCode);
    const canReturn = ['IN_USE', 'MAINTAINING', 'REPAIRING'].includes(statusCode);
    const blocked = ['END_OF_LIFE', 'MOVED_OUT', 'SCRAPPED', 'STALE'].includes(statusCode);
    return {
      statusCode,
      statusText: rawStatus(resource) === 'BF'
        ? '报废'
        : statusCode === 'IN_USE'
          ? '已领用/生产中'
          : statusTextMap[statusCode] || statusCode || '未知状态',
      tagType: statusTagMap[statusCode] || 'info',
      canReceive,
      canReturn,
      canMaintain: !blocked && !canReturn,
      canRepair: !blocked && !canReturn,
      canScrap: !blocked,
      canCalibrate: false,
    };
  }
  const blocked = ['DISABLED', 'END_OF_LIFE', 'EXPIRED', 'SCRAPPED', 'STALE'].includes(statusCode);
  const busy = ['IN_USE', 'RUNNING'].includes(statusCode);
  const canReceive = ['NORMAL'].includes(statusCode);
  return {
    statusCode,
    statusText: statusTextMap[statusCode] || statusCode || '未知状态',
    tagType: statusTagMap[statusCode] || 'info',
    canReceive,
    canReturn: busy,
    canMaintain: !blocked && !busy,
    canRepair: !blocked,
    canScrap: !blocked,
    canCalibrate: resourceType === 'GAUGE' && !blocked,
  };
}

function hasResourceIdentity(resourceType: ResourceType, resource: Record<string, any> | undefined) {
  if (!resource) return false;
  if (resource.id) return true;
  if (resourceType === 'MOULD') return !!String(resource.mouldCode ?? '').trim();
  return !!String(resource.code ?? resource.resourceCode ?? resource.machineCode ?? resource.toolingCode ?? resource.gaugeCode ?? '').trim();
}

export function getResourceBizActions(resourceType: ResourceType) {
  return actionsByResource[resourceType].map((action) => commonRules[action]);
}

export function isResourceBizActionDisabled(
  resourceType: ResourceType,
  resource: Record<string, any> | undefined,
  action: ResourceBizAction,
) {
  if (!resource) return true;
  if (!hasResourceIdentity(resourceType, resource)) return true;
  const view = getResourceStatusView(resourceType, resource);
  if (action === 'RETURN') return !view.canReturn;
  if (action === 'RECEIVE') return !view.canReceive;
  if (action === 'SCRAP') return !view.canScrap;
  if (action === 'CALIBRATE') return !view.canCalibrate;
  if (action === 'MAINTAIN') return !view.canMaintain;
  if (action === 'REPAIR') return !view.canRepair;
  return false;
}

export function getResourceBizDisabledReason(
  resourceType: ResourceType,
  resource: Record<string, any> | undefined,
  action: ResourceBizAction,
) {
  if (!resource) return '缺少资源数据';
  if (!hasResourceIdentity(resourceType, resource)) return '缺少资源编码';
  if (!isResourceBizActionDisabled(resourceType, resource, action)) return '';
  const status = getResourceStatusView(resourceType, resource).statusText;
  if (action === 'RETURN') return `当前状态 ${status}，无需归还`;
  if (action === 'RECEIVE') return `当前状态 ${status}，不可领用`;
  if (action === 'SCRAP') return '资源已报废';
  if (action === 'CALIBRATE') return resourceType === 'GAUGE' ? '报废量具不可校准' : '仅量具支持校准';
  if (action === 'MAINTAIN') return `当前状态 ${status}，不可保养`;
  if (action === 'REPAIR') return '报废资源不可维修';
  return '当前状态不可操作';
}

export function getResourceBizRule(action: ResourceBizAction) {
  return commonRules[action];
}
