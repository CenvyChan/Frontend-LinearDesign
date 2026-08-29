import { describe, expect, it } from 'vitest';

import { buildMaterialDocumentPrintEvidence } from './materialDocument';

describe('material document print evidence', () => {
  it('falls back to capability quota when print history omits quota fields', () => {
    const evidence = buildMaterialDocumentPrintEvidence(
      {
        records: [
          {
            jobNo: 'MDP-second',
            maxPrintCount: 3,
            printCount: 2,
            printerName: 'other printer',
            printTime: 1_720_000_060_000,
            status: 'PRINTED',
          },
        ],
      },
      {
        fileExt: 'pdf',
        maxPrintCount: 3,
        printable: true,
        remainingPrintCount: 1,
        usedPrintCount: 2,
      },
    );

    expect(evidence.maxPrintCount).toBe(3);
    expect(evidence.usedPrintCount).toBe(2);
    expect(evidence.remainingPrintCount).toBe(1);
    expect(evidence.latestRecord?.printerName).toBe('other printer');
    expect(evidence.latestRecord?.printTime).toBe(1_720_000_060_000);
    expect(evidence.latestRecord?.printCount).toBe(2);
  });
});
