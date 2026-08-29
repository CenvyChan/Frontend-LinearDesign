import { afterEach, describe, expect, it } from 'vitest';

import initialXml from './phase0-approval.bpmn20.xml?raw';
import { roundTripBpmn } from './bpmn-probe';

const browserExportSha256 =
  '78687118e3453f320484277731b9d0578623de243e00913207eb3b619b32abaa';

describe('phase 0 BPMN modeler probe', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('loads and exports BPMN XML', async () => {
    const container = document.createElement('div');
    document.body.append(container);

    const exported = await roundTripBpmn(container, initialXml);

    expect(exported).toContain('<bpmn:process');
    expect(exported).toContain('phase0Approval');
    expect(exported).toContain('<bpmn:userTask');
    expect(await sha256(exported)).toBe(browserExportSha256);
  });
});

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
