import { describe, expect, it, vi } from 'vitest';

import {
  openControlledPrintWindow,
  renderControlledPrintJob,
} from './controlledPrint';

describe('controlledPrint', () => {
  it('opens a blank print shell instead of exposing the server print url', async () => {
    const writes: string[] = [];
    const printWindow = {
      close: vi.fn(),
      document: {
        close: vi.fn(),
        open: vi.fn(),
        write: vi.fn((html: string) => writes.push(html)),
      },
      opener: {},
    } as unknown as Window;
    const openWindow = vi.fn(() => printWindow);
    const blob = new Blob(['pdf'], { type: 'application/pdf' });
    const fetchImpl = vi.fn(async () => new Response(blob, { status: 200 }));
    const createObjectURL = vi.fn(() => 'blob:controlled-print');
    const revokeObjectURL = vi.fn();
    const setTimeoutImpl = vi.fn((callback: TimerHandler) => {
      if (typeof callback === 'function') callback();
      return 1 as unknown as number;
    });

    const openedWindow = openControlledPrintWindow({ openWindow });
    await renderControlledPrintJob(
      openedWindow,
      { printUrl: '/api/material-documents/print-jobs/MDP-once/file' },
      { createObjectURL, fetchImpl, revokeObjectURL, setTimeout: setTimeoutImpl },
    );

    expect(openWindow).toHaveBeenCalledWith('', '_blank', expect.any(String));
    expect(openWindow).not.toHaveBeenCalledWith(
      '/api/material-documents/print-jobs/MDP-once/file',
      expect.anything(),
      expect.anything(),
    );
    expect(fetchImpl).toHaveBeenCalledWith('/api/material-documents/print-jobs/MDP-once/file', {
      cache: 'no-store',
      credentials: 'include',
    });
    expect(writes.join('\n')).toContain('blob:controlled-print');
    expect(writes.join('\n')).not.toContain('/api/material-documents/print-jobs/MDP-once/file');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:controlled-print');
  });
});
