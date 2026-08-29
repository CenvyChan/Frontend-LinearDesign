import { describe, expect, it } from 'vitest';

import {
  buildResponsibilityScopePreview,
  buildScopeCandidateOptions,
  dedupeErpOrganizations,
  extractScopeCandidateItems,
  normalizeErpOrganizations,
  resolveErpOrgId,
} from './mes-responsibility-workbench-model';
import { scopeNodeKey } from './mes-responsibility-tree-model';

describe('buildResponsibilityScopePreview', () => {
  it('deduplicates draft rows and marks existing scopes without offering them for insertion', () => {
    const existing = new Set([
      scopeNodeKey('FNS', '100071', 'STOCKER', 'WAREHOUSE', 'WH-A'),
    ]);

    const rows = buildResponsibilityScopePreview({
      erpAcctCode: 'FNS',
      erpOrgId: '100071',
      responsibilityCodes: ['STOCKER', 'STOCKER', 'WORKSHOP_STATISTIC'],
      scopeKeys: ['WH-A', 'WH-A', 'WH-B'],
      scopeType: 'WAREHOUSE',
    }, existing);

    expect(rows).toEqual([
      expect.objectContaining({ responsibilityCode: 'STOCKER', scopeKey: 'WH-A', exists: true }),
      expect.objectContaining({ responsibilityCode: 'STOCKER', scopeKey: 'WH-B', exists: false }),
      expect.objectContaining({ responsibilityCode: 'WORKSHOP_STATISTIC', scopeKey: 'WH-A', exists: false }),
      expect.objectContaining({ responsibilityCode: 'WORKSHOP_STATISTIC', scopeKey: 'WH-B', exists: false }),
    ]);
  });
});

describe('ERP organization and scope candidate normalization', () => {
  it('resolves an old organization-number reference to the canonical ERP organization ID', () => {
    const organizations = [
      { erpAcctCode: 'FNSDEV', erpOrgId: '100001', erpOrgNumber: '001', erpOrgName: 'FNSDEV' },
    ];

    expect(resolveErpOrgId(organizations, '001')).toBe('100001');
  });

  it('deduplicates organization options by account and ERP organization identity', () => {
    const organizations = dedupeErpOrganizations([
      { erpAcctCode: 'FNSDEV', erpOrgId: '100001', erpOrgNumber: '001', erpOrgName: 'FNSDEV' },
      { erpAcctCode: 'FNSDEV', erpOrgId: '100001', erpOrgNumber: '001', erpOrgName: 'FNSDEV' },
      { erpAcctCode: 'HHDEV', erpOrgId: '200001', erpOrgNumber: '001', erpOrgName: 'HHDEV' },
    ]);

    expect(organizations).toHaveLength(2);
    expect(organizations.map((item) => item.erpAcctCode)).toEqual(['FNSDEV', 'HHDEV']);
  });

  it('keeps organizations under the account that was requested', () => {
    expect(normalizeErpOrganizations([
      {
        acctCode: 'FNSDEV',
        responseAcctCode: 'FNSDEV',
        organizations: [
          { erpOrgId: '100001', erpOrgNumber: '001', erpOrgName: 'FNSDEV' },
        ],
      },
      {
        acctCode: 'HHDEV',
        responseAcctCode: 'HHDEV',
        organizations: [
          { erpOrgId: '200001', erpOrgNumber: '001', erpOrgName: 'HHDEV' },
          { erpOrgId: '200002', erpOrgNumber: '002', erpOrgName: 'HHDEV-2' },
        ],
      },
      {
        acctCode: 'FNSDEV',
        responseAcctCode: 'HHDEV',
        organizations: [
          { erpOrgId: '200001', erpOrgNumber: '001', erpOrgName: 'HHDEV' },
        ],
      },
    ])).toEqual([
      { erpAcctCode: 'FNSDEV', erpOrgId: '100001', erpOrgNumber: '001', erpOrgName: 'FNSDEV' },
      { erpAcctCode: 'HHDEV', erpOrgId: '200001', erpOrgNumber: '001', erpOrgName: 'HHDEV' },
      { erpAcctCode: 'HHDEV', erpOrgId: '200002', erpOrgNumber: '002', erpOrgName: 'HHDEV-2' },
    ]);
  });

  it('unwraps nested candidate payloads before extracting warehouse codes', () => {
    const items = extractScopeCandidateItems({
      data: {
        records: [
          { erpStockId: 99, warehouseName: 'Finished goods' },
        ],
      },
    });

    expect(buildScopeCandidateOptions(items)).toEqual([
      { label: '99 / Finished goods', value: '99' },
    ]);
  });

  it('uses a warehouse code or a stable ERP stock ID as the selectable value', () => {
    expect(buildScopeCandidateOptions([
      { warehouseNumber: 'WH-001', warehouseName: '原料仓' },
      { erpStockId: 99, warehouseName: '成品仓' },
      { warehouseNumber: 'WH-001', warehouseName: '重复仓' },
    ])).toEqual([
      { label: 'WH-001 / 原料仓', value: 'WH-001' },
      { label: '99 / 成品仓', value: '99' },
    ]);
  });

  it('uses the same candidate normalization for workshop options', () => {
    expect(buildScopeCandidateOptions([
      { warehouseNumber: 'WH-001', warehouseName: '原料仓' },
      { workshopNumber: 'WS-001', workshopName: '组装车间' },
    ])).toEqual([
      { label: 'WH-001 / 原料仓', value: 'WH-001' },
      { label: 'WS-001 / 组装车间', value: 'WS-001' },
    ]);
  });
});
