import { describe, expect, it } from 'vitest';

import { createProcessRouteCopyDraft } from './process-route-copy-model';

describe('process route copy draft', () => {
  it('builds an unsaved copy draft from source route data', () => {
    const draft = createProcessRouteCopyDraft({
      id: 96,
      routeCode: 'test0601',
      routeName: 'OIUYT',
      routeCategory: 'PACKAGING' as any,
      version: 'V2',
      materialCode: '1.02.03.0125001',
      materialName: '短夹齿',
      productSpec: '镀紫铜M02859743B',
      customerCode: '1.04.02.0001',
      customerName: '四川虹锐电工有限责任公司',
      projectName: '',
      bomVersion: '1.02.03.0125001_V1.4',
      status: 'ACTIVE' as any,
      remark: '测试',
      erpRouteId: 1001,
      steps: [
        {
          id: 8,
          stepNo: 1,
          processPoolId: 3,
          processCode: 'P001',
          processName: '冲压',
          stepName: '冲压',
          standardHours: 1,
          workCenters: [{ id: 11, workCenterId: 22, workCenterName: 'A线' }],
          machines: [{ id: 12, machineId: 23, machineName: '冲床' }],
          toolings: [{ id: 13, toolingId: 24, toolingName: '夹具' }],
          gauges: [{ id: 14, gaugeId: 25, gaugeName: '卡尺' }],
          moulds: [{ id: 15, mouldId: 26, mouldName: '模具' }],
        },
      ],
    });

    expect(draft.id).toBeUndefined();
    expect(draft.routeCode).toBe('');
    expect(draft.routeName).toBe('');
    expect(draft.materialCode).toBe('');
    expect(draft.materialName).toBe('');
    expect(draft.productSpec).toBe('');
    expect(draft.bomVersion).toBe('');
    expect(draft.status).toBe('DRAFT');
    expect(draft.erpRouteId).toBeUndefined();
    expect(draft.steps?.[0]?.id).toBeUndefined();
    expect(draft.steps?.[0]?.workCenters?.[0]?.id).toBeUndefined();
    expect(draft.steps?.[0]?.machines?.[0]?.id).toBeUndefined();
    expect(draft.steps?.[0]?.toolings?.[0]?.id).toBeUndefined();
    expect(draft.steps?.[0]?.gauges?.[0]?.id).toBeUndefined();
    expect(draft.steps?.[0]?.moulds?.[0]?.id).toBeUndefined();
  });
});
