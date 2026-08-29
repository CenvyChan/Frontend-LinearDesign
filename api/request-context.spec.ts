import { describe, expect, it } from 'vitest';

import { resolveErpAcctCode } from './request-context';

describe('resolveErpAcctCode', () => {
  it('keeps an explicitly requested account ahead of the current UI account', () => {
    expect(resolveErpAcctCode('HHDEV', 'FNSDEV')).toBe('HHDEV');
  });

  it('falls back to the current UI account when no explicit account is provided', () => {
    expect(resolveErpAcctCode('  ', 'FNSDEV')).toBe('FNSDEV');
  });
});
