import { describe, expect, it } from 'vitest';

import { assertDownloadableBlob } from './download';

describe('download utilities', () => {
  it('rejects json error responses before saving them as files', () => {
    const blob = new Blob(['{"code":500}'], { type: 'application/json' });

    expect(() => assertDownloadableBlob(blob)).toThrow('不是可打开的文件');
  });

  it('allows xlsx binary responses', () => {
    const blob = new Blob(['PK'], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    expect(() => assertDownloadableBlob(blob)).not.toThrow();
  });
});
