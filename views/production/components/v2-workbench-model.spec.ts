import { describe, expect, it } from 'vitest';

import { paginateV2Rows } from './v2-workbench-model';

describe('paginateV2Rows', () => {
  it('returns the requested page slice', () => {
    expect(paginateV2Rows([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4]);
  });

  it('falls back to the first page and default size for invalid values', () => {
    expect(paginateV2Rows([1, 2, 3], 0, 0)).toEqual([1, 2, 3]);
  });
});
