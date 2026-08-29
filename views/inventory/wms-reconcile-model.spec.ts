import { describe, expect, it } from 'vitest';

import type { WmsReconcileLine } from '#/api/wms';

import {
  buildWmsInventorySyncPayloadFromLine,
  buildWmsReconcileQueryPayload,
  buildWmsMovePayloadFromLine,
  getWmsReconcileRowActions,
  WMS_MANUAL_SYNC_ACTIONS,
} from './wms-reconcile-model';

describe('wms reconcile model', () => {
  it('exposes row actions based on reconcile status', () => {
    expect(getWmsReconcileRowActions(line('ERP_ONLY'))).toMatchObject({
      canMoveUnallocated: false,
      canSyncFromErp: true,
      canTrace: true,
    });
    expect(getWmsReconcileRowActions(line('UNALLOCATED_ONLY', { wmsUnallocatedQty: 12 }))).toMatchObject({
      canMoveUnallocated: true,
      canSyncFromErp: false,
      canTrace: true,
    });
    expect(getWmsReconcileRowActions(line('MATCHED'))).toMatchObject({
      canMoveUnallocated: false,
      canSyncFromErp: false,
      canTrace: true,
    });
  });

  it('builds a move payload from an unallocated reconcile line', () => {
    const payload = buildWmsMovePayloadFromLine(
      line('UNALLOCATED_ONLY', {
        erpOrgName: '一厂',
        erpOrgNumber: '100',
        keeperName: '保管员',
        keeperNumber: 'KEEP',
        lotNo: 'LOT-01',
        materialCode: 'M-001',
        materialName: '物料',
        materialSpecification: 'Spec',
        ownerName: '货主',
        ownerNumber: 'ORG',
        stockName: '原料仓',
        stockNumber: 'CK-01',
        stockStatusName: '可用',
        stockStatusNumber: 'KC',
        unitName: 'pcs',
        wmsUnallocatedQty: 12,
      }),
      {
        qty: 5,
        remark: '现场上架',
        toLocationCode: 'A-01',
        toLocationName: 'A区01',
      },
    );

    expect(payload).toMatchObject({
      businessSource: 'WMS_RECONCILE_MOVE',
      erpOrgNumber: '100',
      fromLocationCode: 'UNALLOCATED',
      materialCode: 'M-001',
      qty: 5,
      remark: '现场上架',
      stockNumber: 'CK-01',
      toLocationCode: 'A-01',
      toLocationName: 'A区01',
    });
  });

  it('keeps ERP snapshot refresh separate from WMS inventory import', () => {
    expect(WMS_MANUAL_SYNC_ACTIONS).toEqual([
      expect.objectContaining({
        key: 'REFRESH_ERP_SNAPSHOT',
        title: 'ERP库存快照刷新',
      }),
      expect.objectContaining({
        key: 'SYNC_TO_WMS_UNALLOCATED',
        title: 'ERP库存拉取到WMS',
      }),
    ]);
  });

  it('builds a reconcile query payload with owner and keeper dimensions', () => {
    expect(
      buildWmsReconcileQueryPayload(
        {
          erpOrgNumber: ' 100 ',
          keeperNumber: ' KEEP ',
          lotNo: ' LOT-01 ',
          materialCode: ' M-001 ',
          ownerNumber: ' OWNER ',
          stockNumber: ' CK-01 ',
          stockStatusNumber: ' KCZT01_SYS ',
        },
        'ACCT-A',
        true,
      ),
    ).toMatchObject({
      erpAcctCode: 'ACCT-A',
      erpOrgNumber: '100',
      forceRefreshErp: true,
      keeperNumber: 'KEEP',
      lotNo: 'LOT-01',
      materialCode: 'M-001',
      materialNumber: 'M-001',
      ownerNumber: 'OWNER',
      stockNumber: 'CK-01',
      stockStatusNumber: 'KCZT01_SYS',
    });
  });

  it('builds a WMS import payload from an ERP-only line with full stock dimensions', () => {
    expect(
      buildWmsInventorySyncPayloadFromLine(
        line('ERP_ONLY', {
          erpOrgNumber: '100',
          keeperNumber: 'KEEP',
          lotNo: 'LOT-01',
          materialCode: 'M-001',
          ownerNumber: 'OWNER',
          stockNumber: 'CK-01',
          stockStatusNumber: 'KCZT01_SYS',
        }),
        'ACCT-A',
      ),
    ).toMatchObject({
      erpAcctCode: 'ACCT-A',
      erpOrgNumber: '100',
      forceRefreshErp: true,
      keeperNumber: 'KEEP',
      lotNo: 'LOT-01',
      materialCode: 'M-001',
      ownerNumber: 'OWNER',
      stockNumber: 'CK-01',
      stockStatusNumber: 'KCZT01_SYS',
    });
  });

  function line(status: WmsReconcileLine['reconcileStatus'], patch: Partial<WmsReconcileLine> = {}): WmsReconcileLine {
    return {
      id: 1,
      reconcileStatus: status,
      ...patch,
    };
  }
});
