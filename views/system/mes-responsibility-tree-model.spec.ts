import { describe, expect, it } from 'vitest';

import {
  buildMesResponsibilityTree,
  collectCheckedAssignments,
  organizationNodeKey,
  responsibilityNodeKey,
  scopeNodeKey,
  type MesResponsibilityTreeInput,
} from './mes-responsibility-tree-model';

function input(overrides: Partial<MesResponsibilityTreeInput> = {}): MesResponsibilityTreeInput {
  return {
    accounts: ['FNS', 'FNSCJJ'],
    assignments: [],
    organizations: [
      { erpAcctCode: 'FNS', erpOrgId: '100071', erpOrgName: '总部', erpOrgNumber: '101' },
      { erpAcctCode: 'FNSCJJ', erpOrgId: '200082', erpOrgName: '长兴', erpOrgNumber: '201' },
    ],
    responsibilities: [
      { responsibilityCode: 'STOCKER', responsibilityName: '仓管' },
      { responsibilityCode: 'WORKSHOP_STATISTIC', responsibilityName: '车间统计' },
    ],
    ...overrides,
  };
}

describe('buildMesResponsibilityTree', () => {
  it('nests account > organization > responsibility > scope', () => {
    const { nodes } = buildMesResponsibilityTree(input());

    expect(nodes.map((node) => node.erpAcctCode)).toEqual(['FNS', 'FNSCJJ']);
    const [fns] = nodes;
    expect(fns?.type).toBe('ACCOUNT');
    expect(fns?.checkable).toBe(false);

    const org = fns?.children?.[0];
    expect(org?.type).toBe('ORGANIZATION');
    expect(org?.key).toBe(organizationNodeKey('FNS', '100071'));
    expect(org?.checkable).toBe(false);

    const responsibility = org?.children?.[0];
    expect(responsibility?.type).toBe('RESPONSIBILITY');
    expect(responsibility?.key).toBe(responsibilityNodeKey('FNS', '100071', 'STOCKER'));
    expect(responsibility?.checkable).toBe(false);

    const scope = responsibility?.children?.[0];
    expect(scope?.type).toBe('SCOPE');
    expect(scope?.scopeType).toBe('ORGANIZATION');
    expect(scope?.checkable).toBe(true);
  });

  it('carries erpOrgNumber on organization nodes so workshop lookups work', () => {
    const { nodes } = buildMesResponsibilityTree(input());
    const org = nodes[0]?.children?.[0];

    expect(org?.erpOrgId).toBe('100071');
    expect(org?.erpOrgNumber).toBe('101');
  });

  it('always offers the default ORGANIZATION scope leaf under every responsibility', () => {
    const { nodes } = buildMesResponsibilityTree(input());
    const scopes = nodes[0]?.children?.[0]?.children?.[0]?.children ?? [];

    expect(scopes).toHaveLength(1);
    expect(scopes[0]?.scopeKey).toBe('');
    expect(scopes[0]?.key).toBe(scopeNodeKey('FNS', '100071', 'STOCKER', 'ORGANIZATION', ''));
  });

  it('shows only configured account, organization, responsibility, and scope branches when unassigned items are hidden', () => {
    const { nodes } = buildMesResponsibilityTree(
      input({
        assignments: [
          { erpAcctCode: 'FNS', erpOrgId: '100071', responsibilityCode: 'STOCKER', scopeKey: 'WH-A', scopeType: 'WAREHOUSE', status: 1 },
        ],
        includeUnassigned: false,
      }),
    );

    expect(nodes.map((node) => node.erpAcctCode)).toEqual(['FNS']);
    const scopes = nodes[0]?.children?.[0]?.children?.[0]?.children ?? [];
    expect(scopes.map((node) => node.scopeKey)).toEqual(['WH-A']);
    expect(nodes[0]?.children?.[0]?.children?.map((node) => node.responsibilityCode)).toEqual(['STOCKER']);
  });

  it('adds existing warehouse and workshop scopes as sibling leaves and checks the enabled ones', () => {
    const { checkedKeys, nodes } = buildMesResponsibilityTree(
      input({
        assignments: [
          { erpAcctCode: 'FNS', erpOrgId: '100071', id: 19, responsibilityCode: 'STOCKER', scopeKey: 'WH-A', scopeType: 'WAREHOUSE', status: 1 },
          { erpAcctCode: 'FNS', erpOrgId: '100071', id: 20, responsibilityCode: 'STOCKER', scopeKey: 'WH-B', scopeType: 'WAREHOUSE', status: 0 },
          { erpAcctCode: 'FNS', erpOrgId: '100071', id: 21, responsibilityCode: 'WORKSHOP_STATISTIC', scopeKey: 'WS-1', scopeType: 'WORKSHOP', status: 1 },
        ],
      }),
    );

    const stocker = nodes[0]?.children?.[0]?.children?.[0];
    expect(stocker?.children?.map((node) => node.scopeKey)).toEqual(['', 'WH-A', 'WH-B']);
    expect(stocker?.children?.find((node) => node.scopeKey === 'WH-A')?.assignmentId).toBe(19);

    expect(checkedKeys).toEqual([
      scopeNodeKey('FNS', '100071', 'STOCKER', 'WAREHOUSE', 'WH-A'),
      scopeNodeKey('FNS', '100071', 'WORKSHOP_STATISTIC', 'WORKSHOP', 'WS-1'),
    ]);
  });

  it('lets one user hold several responsibilities across several accounts at once', () => {
    const { checkedKeys } = buildMesResponsibilityTree(
      input({
        assignments: [
          { erpAcctCode: 'FNS', erpOrgId: '100071', responsibilityCode: 'STOCKER', scopeKey: '', scopeType: 'ORGANIZATION', status: 1 },
          { erpAcctCode: 'FNSCJJ', erpOrgId: '200082', responsibilityCode: 'WORKSHOP_STATISTIC', scopeKey: 'WS-9', scopeType: 'WORKSHOP', status: 1 },
        ],
      }),
    );

    expect(checkedKeys).toEqual([
      scopeNodeKey('FNS', '100071', 'STOCKER', 'ORGANIZATION', ''),
      scopeNodeKey('FNSCJJ', '200082', 'WORKSHOP_STATISTIC', 'WORKSHOP', 'WS-9'),
    ]);
  });

  it('attaches the ERP operator binding to its responsibility node', () => {
    const { nodes } = buildMesResponsibilityTree(
      input({
        erpBindings: [
          { erpAcctCode: 'FNS', erpOperatorName: '张三', erpOperatorNumber: 'OP-001', erpOrgId: '100071', responsibilityCode: 'STOCKER' },
        ],
      }),
    );

    const stocker = nodes[0]?.children?.[0]?.children?.[0];
    expect(stocker?.erpOperatorNumber).toBe('OP-001');
    expect(stocker?.label).toContain('OP-001');
  });

  it('keeps orphan assignments visible even when the organization is not in the ERP list', () => {
    const { nodes } = buildMesResponsibilityTree(
      input({
        organizations: [],
        assignments: [
          { erpAcctCode: 'FNS', erpOrgId: '999', responsibilityCode: 'STOCKER', scopeKey: 'WH-X', scopeType: 'WAREHOUSE', status: 1 },
        ],
      }),
    );

    const org = nodes.find((node) => node.erpAcctCode === 'FNS')?.children?.[0];
    expect(org?.erpOrgId).toBe('999');
    expect(org?.erpOrgNumber).toBeUndefined();
  });

  it('merges assignments stored with an organization number into the canonical organization node', () => {
    const { nodes } = buildMesResponsibilityTree(
      input({
        organizations: [
          { erpAcctCode: 'FNS', erpOrgId: '100071', erpOrgName: '总部', erpOrgNumber: '001' },
        ],
        assignments: [
          { erpAcctCode: 'FNS', erpOrgId: '001', responsibilityCode: 'STOCKER', scopeKey: '', scopeType: 'ORGANIZATION', status: 1 },
        ],
      }),
    );

    const fns = nodes.find((node) => node.erpAcctCode === 'FNS');
    expect(fns?.children).toHaveLength(1);
    expect(fns?.children?.[0]?.erpOrgId).toBe('100071');
    expect(fns?.children?.[0]?.children?.[0]?.children?.[0]?.key).toBe(
      scopeNodeKey('FNS', '100071', 'STOCKER', 'ORGANIZATION', ''),
    );
  });
});

describe('collectCheckedAssignments', () => {
  it('maps checked scope leaves back to batch save rows', () => {
    const { nodes } = buildMesResponsibilityTree(
      input({
        assignments: [
          { erpAcctCode: 'FNS', erpOrgId: '100071', id: 19, responsibilityCode: 'STOCKER', scopeKey: 'WH-A', scopeType: 'WAREHOUSE', status: 1 },
        ],
      }),
    );

    const rows = collectCheckedAssignments(nodes, [
      scopeNodeKey('FNS', '100071', 'STOCKER', 'WAREHOUSE', 'WH-A'),
      scopeNodeKey('FNSCJJ', '200082', 'WORKSHOP_STATISTIC', 'ORGANIZATION', ''),
    ]);

    expect(rows).toEqual([
      { erpAcctCode: 'FNS', erpOrgId: '100071', responsibilityCode: 'STOCKER', scopeKey: 'WH-A', scopeType: 'WAREHOUSE', status: 1 },
      { erpAcctCode: 'FNSCJJ', erpOrgId: '200082', responsibilityCode: 'WORKSHOP_STATISTIC', scopeKey: '', scopeType: 'ORGANIZATION', status: 1 },
    ]);
  });

  it('ignores checked keys that are not scope leaves', () => {
    const { nodes } = buildMesResponsibilityTree(input());

    const rows = collectCheckedAssignments(nodes, [
      organizationNodeKey('FNS', '100071'),
      responsibilityNodeKey('FNS', '100071', 'STOCKER'),
    ]);

    expect(rows).toEqual([]);
  });
});
