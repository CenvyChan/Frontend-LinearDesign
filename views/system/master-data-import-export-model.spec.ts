import { describe, expect, it } from 'vitest';

import {
  buildMasterDataGroups,
  findMasterDataItem,
} from './master-data-import-export-model';

describe('master-data-import-export-model', () => {
  it('groups base data entries for centralized import and export', () => {
    const groups = buildMasterDataGroups();
    const allItems = groups.flatMap((group) => group.items);

    expect(groups.map((group) => group.key)).toEqual([
      'factory',
      'process',
      'system',
      'integration',
      'opening',
    ]);
    expect(allItems.map((item) => item.key)).toEqual([
      'work-center',
      'machine',
      'tooling',
      'gauge',
      'mould',
      'process-pool',
      'process-route',
      'inspection-schemes',
      'process-step-price',
      'department',
      'post',
      'dictionary',
      'config',
      'user',
      'role',
      'responsibility',
      'user-responsibility',
      'resource-responsibility-owner',
      'erp-operator-mapping',
      'responsibility-integrity-report',
      'opening-inventory',
      'opening-wip-orders',
      'erp-reference-check',
    ]);
    expect(findMasterDataItem('config')?.warning).toContain('password');
    expect(findMasterDataItem('machine')?.basePath).toBe('/machine');
    expect(findMasterDataItem('opening-inventory')?.basePath).toBe('/opening/inventory');
    expect(findMasterDataItem('erp-reference-check')?.mode).toBe('reference-check');
    expect(findMasterDataItem('responsibility-integrity-report')?.mode).toBe('export-only');
  });
});
