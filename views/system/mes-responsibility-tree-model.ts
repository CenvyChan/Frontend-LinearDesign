export type MesResponsibilityNodeType =
  | 'ACCOUNT'
  | 'ORGANIZATION'
  | 'RESPONSIBILITY'
  | 'SCOPE';

export type MesScopeType =
  | 'DEPARTMENT'
  | 'ORGANIZATION'
  | 'WAREHOUSE'
  | 'WORKSHOP';

export interface MesResponsibilityTreeNode {
  children?: MesResponsibilityTreeNode[];
  /** 该职责节点下已绑定的 ERP 人员编码，仅 RESPONSIBILITY 节点有值 */
  erpOperatorNumber?: string;
  erpAcctCode: string;
  erpOrgId?: string;
  /** 车间候选按组织编码查询，仓库候选按组织 ID 查询，两者都要带上 */
  erpOrgNumber?: string;
  /** 仅 SCOPE 叶子可勾选 */
  checkable: boolean;
  disabled: boolean;
  key: string;
  label: string;
  responsibilityCode?: string;
  scopeKey?: string;
  scopeType?: MesScopeType;
  /** 已存在且启用的范围记录 ID，用于回显和判断是否新增 */
  assignmentId?: number;
  /** 当前职责已绑定的 ERP 人员数量 */
  erpOperatorCount?: number;
  /** 当前职责下已启用的数据范围数量 */
  scopeCount?: number;
  status?: number;
  type: MesResponsibilityNodeType;
}

export interface MesResponsibilityTreeAssignment {
  erpAcctCode: string;
  erpOrgId: string;
  id?: number;
  responsibilityCode: string;
  scopeKey?: string;
  scopeType: MesScopeType;
  status: number;
}

export interface MesResponsibilityTreeOrganization {
  erpAcctCode?: string;
  erpOrgId: string;
  erpOrgName?: string;
  erpOrgNumber?: string;
}

export interface MesResponsibilityTreeErpBinding {
  erpAcctCode?: string;
  erpOperatorName?: string;
  erpOperatorNumber?: string;
  erpOrgId?: string;
  responsibilityCode?: string;
}

export interface MesResponsibilityTreeInput {
  accounts: string[];
  assignments: MesResponsibilityTreeAssignment[];
  erpBindings?: MesResponsibilityTreeErpBinding[];
  /** 为 false 时只保留已有职责范围或 ERP 人员绑定所在的分支 */
  includeUnassigned?: boolean;
  organizations: MesResponsibilityTreeOrganization[];
  responsibilities: { responsibilityCode: string; responsibilityName?: string }[];
}

export interface MesResponsibilityTreeResult {
  /** 已启用范围叶子的 key，直接喂给 el-tree 的 default-checked-keys */
  checkedKeys: string[];
  nodes: MesResponsibilityTreeNode[];
}

const SCOPE_TYPE_LABEL: Record<MesScopeType, string> = {
  DEPARTMENT: '部门',
  ORGANIZATION: '组织范围',
  WAREHOUSE: '仓库',
  WORKSHOP: '车间',
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function scopeTypeLabel(scopeType: MesScopeType): string {
  return SCOPE_TYPE_LABEL[scopeType] ?? scopeType;
}

export function accountNodeKey(erpAcctCode: string): string {
  return `ACCOUNT::${erpAcctCode}`;
}

export function organizationNodeKey(erpAcctCode: string, erpOrgId: string): string {
  return `ORGANIZATION::${erpAcctCode}::${erpOrgId}`;
}

export function responsibilityNodeKey(
  erpAcctCode: string,
  erpOrgId: string,
  responsibilityCode: string,
): string {
  return `RESPONSIBILITY::${erpAcctCode}::${erpOrgId}::${responsibilityCode}`;
}

export function scopeNodeKey(
  erpAcctCode: string,
  erpOrgId: string,
  responsibilityCode: string,
  scopeType: MesScopeType,
  scopeKey: string,
): string {
  return `SCOPE::${erpAcctCode}::${erpOrgId}::${responsibilityCode}::${scopeType}::${scopeKey}`;
}

function uniqueInOrder(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function resolveOrganizationId(
  organizations: MesResponsibilityTreeOrganization[],
  erpAcctCode: string,
  erpOrgId: string,
): string {
  const organization = organizations.find((item) => {
    if (text(item.erpAcctCode) !== erpAcctCode) return false;
    return [item.erpOrgId, item.erpOrgNumber, item.erpOrgName]
      .map(text)
      .includes(erpOrgId);
  });
  return text(organization?.erpOrgId) || erpOrgId;
}

function buildScopeLeaves(
  erpAcctCode: string,
  erpOrgId: string,
  responsibilityCode: string,
  assignments: MesResponsibilityTreeAssignment[],
  includeUnassigned: boolean,
): MesResponsibilityTreeNode[] {
  const organizationLeaf: MesResponsibilityTreeNode = {
    checkable: true,
    disabled: false,
    erpAcctCode,
    erpOrgId,
    key: scopeNodeKey(erpAcctCode, erpOrgId, responsibilityCode, 'ORGANIZATION', ''),
    label: SCOPE_TYPE_LABEL.ORGANIZATION,
    responsibilityCode,
    scopeKey: '',
    scopeType: 'ORGANIZATION',
    type: 'SCOPE',
  };
  const leaves = new Map<string, MesResponsibilityTreeNode>();
  if (includeUnassigned) {
    leaves.set(organizationLeaf.key, organizationLeaf);
  }
  for (const assignment of assignments) {
    const scopeType = assignment.scopeType;
    const scopeKey = scopeType === 'ORGANIZATION' ? '' : text(assignment.scopeKey);
    const key = scopeNodeKey(erpAcctCode, erpOrgId, responsibilityCode, scopeType, scopeKey);
    const existing = leaves.get(key);
    const leaf: MesResponsibilityTreeNode = existing ?? {
      checkable: true,
      disabled: false,
      erpAcctCode,
      erpOrgId,
      key,
      label: `${scopeTypeLabel(scopeType)} ${scopeKey}`.trim(),
      responsibilityCode,
      scopeKey,
      scopeType,
      type: 'SCOPE',
    };
    leaf.assignmentId = assignment.id;
    leaf.status = assignment.status;
    leaves.set(key, leaf);
  }
  return [...leaves.values()];
}

export function buildMesResponsibilityTree(
  input: MesResponsibilityTreeInput,
): MesResponsibilityTreeResult {
  const assignments = input.assignments ?? [];
  const organizations = input.organizations ?? [];
  const bindings = input.erpBindings ?? [];
  const includeUnassigned = input.includeUnassigned ?? true;
  const accounts = uniqueInOrder([
    ...(includeUnassigned ? (input.accounts ?? []).map(text) : []),
    ...assignments.map((item) => text(item.erpAcctCode)),
    ...bindings.map((item) => text(item.erpAcctCode)),
  ]);

  const nodes = accounts.map<MesResponsibilityTreeNode>((erpAcctCode) => {
    const accountAssignments = assignments.filter((item) => text(item.erpAcctCode) === erpAcctCode);
    const accountBindings = bindings.filter((item) => text(item.erpAcctCode) === erpAcctCode);
    const orgIds = uniqueInOrder([
      ...(includeUnassigned
        ? organizations.filter((org) => text(org.erpAcctCode) === erpAcctCode).map((org) => text(org.erpOrgId))
        : []),
      ...accountAssignments.map((item) => resolveOrganizationId(organizations, erpAcctCode, text(item.erpOrgId))),
      ...accountBindings.map((item) => resolveOrganizationId(organizations, erpAcctCode, text(item.erpOrgId))),
    ]);

    return {
      checkable: false,
      children: orgIds.map<MesResponsibilityTreeNode>((erpOrgId) => {
        const organization = organizations.find(
          (org) => text(org.erpAcctCode) === erpAcctCode && text(org.erpOrgId) === erpOrgId,
        );
        const orgAssignments = accountAssignments.filter(
          (item) => resolveOrganizationId(organizations, erpAcctCode, text(item.erpOrgId)) === erpOrgId,
        );
        const orgBindings = accountBindings.filter(
          (item) => resolveOrganizationId(organizations, erpAcctCode, text(item.erpOrgId)) === erpOrgId,
        );
        const responsibilityCodes = uniqueInOrder([
          ...(includeUnassigned ? (input.responsibilities ?? []).map((item) => text(item.responsibilityCode)) : []),
          ...orgAssignments.map((item) => text(item.responsibilityCode)),
          ...orgBindings.map((item) => text(item.responsibilityCode)),
        ]);

        return {
          checkable: false,
          children: responsibilityCodes.map<MesResponsibilityTreeNode>((responsibilityCode) => {
            const responsibility = (input.responsibilities ?? []).find(
              (item) => text(item.responsibilityCode) === responsibilityCode,
            );
            const responsibilityAssignments = orgAssignments.filter(
              (item) => text(item.responsibilityCode) === responsibilityCode,
            );
            const responsibilityBindings = orgBindings.filter(
              (item) => text(item.responsibilityCode) === responsibilityCode,
            );
            const erpOperatorNumbers = uniqueInOrder(
              responsibilityBindings.map((item) => text(item.erpOperatorNumber)),
            );
            const erpOperatorNumber = erpOperatorNumbers[0];
            const baseLabel = [responsibilityCode, text(responsibility?.responsibilityName)]
              .filter(Boolean)
              .join(' / ');

            return {
              checkable: false,
              children: buildScopeLeaves(
                erpAcctCode,
                erpOrgId,
                responsibilityCode,
                responsibilityAssignments,
                includeUnassigned,
              ),
              disabled: true,
              erpAcctCode,
              erpOperatorCount: erpOperatorNumbers.length,
              erpOperatorNumber: erpOperatorNumber || undefined,
              erpOrgId,
              erpOrgNumber: text(organization?.erpOrgNumber) || undefined,
              key: responsibilityNodeKey(erpAcctCode, erpOrgId, responsibilityCode),
              label: erpOperatorNumber ? `${baseLabel} · ERP ${erpOperatorNumber}` : baseLabel,
              responsibilityCode,
              scopeCount: responsibilityAssignments.filter((item) => item.status === 1).length,
              type: 'RESPONSIBILITY',
            };
          }),
          disabled: true,
          erpAcctCode,
          erpOrgId,
          erpOrgNumber: text(organization?.erpOrgNumber) || undefined,
          key: organizationNodeKey(erpAcctCode, erpOrgId),
          label: [text(organization?.erpOrgNumber), text(organization?.erpOrgName) || erpOrgId]
            .filter(Boolean)
            .join(' / '),
          type: 'ORGANIZATION',
        };
      }),
      disabled: true,
      erpAcctCode,
      key: accountNodeKey(erpAcctCode),
      label: erpAcctCode,
      type: 'ACCOUNT',
    };
  });

  const checkedKeys = flattenMesResponsibilityTree(nodes)
    .filter((node) => node.type === 'SCOPE' && node.status === 1)
    .map((node) => node.key);

  return { checkedKeys, nodes };
}

export function flattenMesResponsibilityTree(
  nodes: MesResponsibilityTreeNode[],
): MesResponsibilityTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenMesResponsibilityTree(node.children ?? [])]);
}

export function collectCheckedAssignments(
  nodes: MesResponsibilityTreeNode[],
  checkedKeys: string[],
): MesResponsibilityTreeAssignment[] {
  const checked = new Set(checkedKeys);
  return flattenMesResponsibilityTree(nodes)
    .filter((node) => node.type === 'SCOPE' && checked.has(node.key))
    .map((node) => ({
      erpAcctCode: node.erpAcctCode,
      erpOrgId: node.erpOrgId ?? '',
      responsibilityCode: node.responsibilityCode ?? '',
      scopeKey: node.scopeKey ?? '',
      scopeType: node.scopeType ?? 'ORGANIZATION',
      status: 1,
    }));
}
