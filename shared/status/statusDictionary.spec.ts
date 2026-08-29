import { describe, expect, it } from 'vitest';

import {
  clearStatusTextOverrides,
  resolveStatus,
  setStatusTextOverrides,
} from './statusDictionary';

describe('resolveStatus', () => {
  it('uses a field-specific built-in Chinese label', () => {
    expect(resolveStatus('productionReport', 'aggregateStatus', 'PUSH_FAILED')).toBe('生产汇报推送失败');
  });

  it('falls back to the global built-in label', () => {
    expect(resolveStatus('wms', 'operationTaskStatus', 'WMS_POSTED')).toBe('WMS已过账');
  });

  it('returns unknown status instead of raw code for missing values', () => {
    expect(resolveStatus('wms', 'operationTaskStatus', '')).toBe('未知状态');
    expect(resolveStatus('wms', 'operationTaskStatus', 'NOT_REGISTERED')).toBe('未知状态');
  });

  it('formats technical details with the code and Chinese label', () => {
    expect(resolveStatus('productionReport', 'aggregateStatus', 'PUSH_FAILED', 'zh-CN', 'technical')).toBe('PUSH_FAILED（生产汇报推送失败）');
  });

  it('lets an online override take precedence', () => {
    setStatusTextOverrides([{ domain: 'productionReport', field: 'aggregateStatus', code: 'PUSH_FAILED', locale: 'zh-CN', text: '运维自定义文案' }]);
    expect(resolveStatus('productionReport', 'aggregateStatus', 'PUSH_FAILED')).toBe('运维自定义文案');
    clearStatusTextOverrides();
  });
});
