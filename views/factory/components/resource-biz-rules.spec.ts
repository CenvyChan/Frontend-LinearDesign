import { describe, expect, it } from 'vitest';

import {
  getResourceBizDisabledReason,
  getResourceStatusView,
  isResourceBizActionDisabled,
} from './resource-biz-rules';

describe('factory resource business rules', () => {
  it('maps K3Cloud mould statuses to their actual business labels', () => {
    expect(getResourceStatusView('MOULD', { status: 'ZC' })).toMatchObject({
      statusCode: 'NORMAL',
      statusText: '正常',
      canReceive: true,
      canReturn: false,
    });
    expect(getResourceStatusView('MOULD', { status: '' })).toMatchObject({
      statusCode: 'NORMAL',
      statusText: '正常',
      canReceive: true,
    });
    expect(getResourceStatusView('MOULD', { status: 'YMC' })).toMatchObject({
      statusCode: 'MOVED_OUT',
      statusText: '移模出',
      canReceive: false,
      canReturn: false,
    });
    expect(getResourceStatusView('MOULD', { status: 'YMR' })).toMatchObject({
      statusCode: 'MOVED_IN',
      statusText: '移模入',
      canReceive: true,
      canReturn: false,
    });
    expect(getResourceStatusView('MOULD', { status: 'SZ' }).statusText).toBe('寿终');
    expect(getResourceStatusView('MOULD', { status: 'DZ' }).statusText).toBe('呆滞');
    expect(getResourceStatusView('MOULD', { status: 'BF' }).statusText).toBe('报废');
  });

  it('keeps MES mould business statuses separate from K3Cloud transfer statuses', () => {
    expect(getResourceStatusView('MOULD', { status: 'IN_USE' })).toMatchObject({
      statusCode: 'IN_USE',
      statusText: '已领用/生产中',
      canReceive: false,
      canReturn: true,
    });
    expect(getResourceStatusView('MOULD', { status: 'MAINTAINING' })).toMatchObject({
      statusText: '保养中',
      canReceive: false,
      canReturn: true,
    });
    expect(getResourceStatusView('MOULD', { status: 'REPAIRING' })).toMatchObject({
      statusText: '维修中',
      canReceive: false,
      canReturn: true,
    });
  });

  it('allows MES native resource actions to ensure local records by stable code', () => {
    expect(isResourceBizActionDisabled('MACHINE', { code: 'MC-001', status: 'IDLE' }, 'RECEIVE')).toBe(false);
    expect(isResourceBizActionDisabled('TOOLING', { code: 'TL-001', status: 'AVAILABLE' }, 'RECEIVE')).toBe(false);
    expect(isResourceBizActionDisabled('GAUGE', { gaugeCode: 'G-001', status: 'ACTIVE' }, 'RECEIVE')).toBe(false);
    expect(getResourceBizDisabledReason('MACHINE', { status: 'IDLE' }, 'RECEIVE')).toBe('缺少资源编码');
  });
});
