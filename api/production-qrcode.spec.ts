import { describe, expect, it } from 'vitest';

import { getStepQrCodeUrl } from './production-qrcode';

describe('production qrcode urls', () => {
  it('builds a step qrcode url that is separate from the order qrcode url', () => {
    expect(getStepQrCodeUrl(1201, 30)).toBe(
      '/api/production-order/1201/qrcode/step/30',
    );
  });
});
