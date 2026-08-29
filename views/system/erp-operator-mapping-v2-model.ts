import type { ErpOperatorMappingItem } from '#/api/erpOperatorMapping';

export type ErpOperatorMappingV2Tone = 'danger' | 'info' | 'success' | 'warning';

export interface ErpOperatorMappingV2IssueGroup {
  count: number;
  key: 'duplicateUserRole' | 'genericOrg' | 'missingEntry' | 'unmappedUsers';
  label: string;
  tone: ErpOperatorMappingV2Tone;
}

export interface ErpOperatorMappingV2Stage {
  description: string;
  done: number;
  key: 'erpEntry' | 'erpPerson' | 'mesUser' | 'orgScope' | 'role';
  label: string;
  tone: ErpOperatorMappingV2Tone;
  total: number;
}

export interface ErpOperatorMappingV2Model {
  issueGroups: ErpOperatorMappingV2IssueGroup[];
  stages: ErpOperatorMappingV2Stage[];
  summary: {
    genericOrgCount: number;
    mappingCount: number;
    mappedUserCount: number;
    scopedOrgCount: number;
    unmappedUserCount: number;
  };
}

export const MES_SCOPE_TYPE_OPTIONS = [
  { label: '组织', value: 'ORGANIZATION' },
  { label: '仓库', value: 'WAREHOUSE' },
  { label: '车间', value: 'WORKSHOP' },
  { label: '部门', value: 'DEPARTMENT' },
] as const;

export const DEFAULT_MES_RESPONSIBILITY_VIEW = 'USER_RESPONSIBILITY' as const;

/**
 * 后端两个 SaveDto 的字段白名单。
 *
 * <p>`configForm` 是 `reactive<Record<string, any>>`，被职责表单与资源负责人表单
 * **共用**：新建时统一塞入 `{status, scopeType, resourceType}` 默认值，
 * 编辑时又 `Object.assign(configForm, row)` 带入 `tenantId`/`createTime` 等实体元字段。
 *
 * <p>项目全局 ObjectMapper 保持严格模式（`CacheJson`/`JsonUtils` 只在缓存与存量
 * 数据层局部关闭 `FAIL_ON_UNKNOWN_PROPERTIES`，注释明确拒绝放宽到 HTTP 层），
 * 多送一个字段就抛 `UnrecognizedPropertyException`；它是
 * `HttpMessageNotReadableException` 子类，被 AirPower `ExceptionInterceptor`
 * 映射成 **HTTP 415「请求参数格式不正确」——文案不含字段名，极易误查 Content-Type**。
 *
 * <p>TypeScript 无法拦截：`Record<string, any>` 传给 `Partial<T>` 形参时，
 * 多余属性检查只对**对象字面量**生效，对变量不生效。
 */
export const MES_RESPONSIBILITY_PAYLOAD_KEYS = [
  'id', 'responsibilityCode', 'responsibilityName', 'status', 'sort', 'remark',
] as const;

export const MES_RESOURCE_OWNER_PAYLOAD_KEYS = [
  'id', 'erpAcctCode', 'erpOrgId', 'resourceType', 'resourceCode',
  'responsibilityCode', 'userResponsibilityId', 'remark',
] as const;

function pickKeys(
  form: Record<string, any>,
  keys: readonly string[],
): Record<string, any> {
  const payload: Record<string, any> = {};
  for (const key of keys) {
    if (form[key] !== undefined) payload[key] = form[key];
  }
  return payload;
}

/** 按 `MesResponsibilitySaveDto` 契约挑字段。 */
export function pickResponsibilityPayload(form: Record<string, any>) {
  return pickKeys(form, MES_RESPONSIBILITY_PAYLOAD_KEYS);
}

/** 按 `MesResourceResponsibilityOwnerSaveDto` 契约挑字段。 */
export function pickResourceOwnerPayload(form: Record<string, any>) {
  return pickKeys(form, MES_RESOURCE_OWNER_PAYLOAD_KEYS);
}

export function resolveResponsibilityView(path: string): string {
  return path === '/system/erp-operator-mapping-v2'
    ? 'ERP_BINDING'
    : DEFAULT_MES_RESPONSIBILITY_VIEW;
}

export interface ErpMappingUserLookup {
  id?: number;
  nickname?: string;
  real_name?: string;
  username?: string;
}

export function formatErpMappingUserName(
  row: Pick<ErpOperatorMappingItem, 'realName' | 'userId' | 'username'>,
  users: ErpMappingUserLookup[] = [],
): string {
  const user = users.find((item) => item.id === row.userId);
  return [
    row.username || user?.username,
    row.realName || user?.real_name || user?.nickname,
  ].filter(Boolean).join(' / ') || String(row.userId);
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function duplicateUserRoleCount(rows: ErpOperatorMappingItem[]): number {
  const keys = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.userId}|${row.mappingRole || ''}|${row.erpOrgId || '*'}`;
    keys.set(key, (keys.get(key) || 0) + 1);
  }
  return [...keys.values()].filter((count) => count > 1).length;
}

function tone(done: number, total: number, blocked = 0): ErpOperatorMappingV2Tone {
  if (blocked > 0) return 'danger';
  if (total > 0 && done >= total) return 'success';
  if (done > 0) return 'warning';
  return 'info';
}

export function buildErpOperatorMappingV2Model(
  rows: ErpOperatorMappingItem[] = [],
  mesUserCount = 0,
): ErpOperatorMappingV2Model {
  const mappedUserCount = new Set(rows.map((row) => row.userId).filter(Boolean)).size;
  const unmappedUserCount = Math.max(0, mesUserCount - mappedUserCount);
  const genericOrgCount = rows.filter((row) => !hasText(row.erpOrgId)).length;
  const scopedOrgCount = rows.length - genericOrgCount;
  const missingEntry = rows.filter((row) => !row.erpOperatorEntryId).length;
  const duplicateCount = duplicateUserRoleCount(rows);

  return {
    issueGroups: ([
      { count: genericOrgCount, key: 'genericOrg', label: '通用组织映射', tone: 'warning' },
      { count: missingEntry, key: 'missingEntry', label: '缺少 ERP EntryId', tone: 'danger' },
      { count: duplicateCount, key: 'duplicateUserRole', label: '重复用户/角色/组织', tone: 'danger' },
      { count: unmappedUserCount, key: 'unmappedUsers', label: '未映射 MES 用户', tone: 'warning' },
    ] as ErpOperatorMappingV2IssueGroup[]).filter((item) => item.count > 0),
    stages: [
      {
        description: 'MES 用户已纳入映射范围',
        done: mappedUserCount,
        key: 'mesUser',
        label: 'MES 用户',
        tone: tone(mappedUserCount, mesUserCount, unmappedUserCount),
        total: mesUserCount,
      },
      {
        description: '角色决定 ERP 单据业务人员字段',
        done: rows.filter((row) => hasText(row.mappingRole)).length,
        key: 'role',
        label: '角色',
        tone: tone(rows.filter((row) => hasText(row.mappingRole)).length, rows.length),
        total: rows.length,
      },
      {
        description: '组织范围越明确，误匹配风险越低',
        done: scopedOrgCount,
        key: 'orgScope',
        label: '组织',
        tone: genericOrgCount > 0 ? 'warning' : 'success',
        total: rows.length,
      },
      {
        description: 'ERP 人员编号与名称已经绑定',
        done: rows.filter((row) => hasText(row.erpOperatorNumber)).length,
        key: 'erpPerson',
        label: 'ERP 人员',
        tone: tone(rows.filter((row) => hasText(row.erpOperatorNumber)).length, rows.length),
        total: rows.length,
      },
      {
        description: 'EntryId 用于 ERP 单据分录级人员定位',
        done: rows.length - missingEntry,
        key: 'erpEntry',
        label: 'EntryId',
        tone: tone(rows.length - missingEntry, rows.length, missingEntry),
        total: rows.length,
      },
    ],
    summary: {
      genericOrgCount,
      mappedUserCount,
      mappingCount: rows.length,
      scopedOrgCount,
      unmappedUserCount,
    },
  };
}
