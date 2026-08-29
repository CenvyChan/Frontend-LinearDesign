import { describe, expect, it } from 'vitest';

import { referenceOptionLabel } from './option-label';

describe('referenceOptionLabel', () => {
  it('shows code and name so same-named candidates are decidable', () => {
    expect(
      referenceOptionLabel({
        code: '1.01.01.0101001',
        id: '1.01.01.0101001',
        label: 'BB1306L-5',
      }),
    ).toBe('1.01.01.0101001｜BB1306L-5');
  });

  it('appends the specification when the source provides one', () => {
    // 物料重名时规格型号才是真正的区分依据
    expect(
      referenceOptionLabel({
        code: '1.01.01.0101001',
        description: '(1.2.3.4.6) PET 黄色 圆状 立式',
        id: '1.01.01.0101001',
        label: 'BB1306L-5',
      }),
    ).toBe('1.01.01.0101001｜BB1306L-5（(1.2.3.4.6) PET 黄色 圆状 立式）');
  });

  it('falls back to the name alone when there is no code', () => {
    // 字典等来源没有独立编码，不能渲染出前导分隔符
    expect(referenceOptionLabel({ id: 'HIGH', label: '高' })).toBe('高');
  });

  it('does not repeat a code that equals the name', () => {
    expect(referenceOptionLabel({ code: 'WH01', id: 'WH01', label: 'WH01' })).toBe(
      'WH01',
    );
  });

  it('ignores blank code and description', () => {
    expect(
      referenceOptionLabel({
        code: '   ',
        description: '  ',
        id: 'X',
        label: '仓库',
      }),
    ).toBe('仓库');
  });
});
