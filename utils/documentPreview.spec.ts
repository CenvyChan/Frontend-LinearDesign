import { beforeEach, describe, expect, it, vi } from 'vitest';

import { canPreviewInBrowser, canPreviewInOnlyOffice, openDocumentPreview } from './documentPreview';

vi.mock('element-plus', () => ({
  ElMessageBox: {
    alert: vi.fn(() => Promise.resolve()),
  },
}));

describe('document preview utilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('opens browser-previewable documents through the unified preview page', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    await expect(openDocumentPreview({
      documentId: 20,
      fileExt: 'pdf',
      fileName: 'a.pdf',
      source: 'material-document',
      url: '/api/material-documents/versions/MATERIAL_DOCUMENT/20/download',
    })).resolves.toBe(true);

    expect(open).toHaveBeenCalledWith(
      'http://localhost:3000/utils/documentPreview?url=%2Fapi%2Fmaterial-documents%2Fversions%2FMATERIAL_DOCUMENT%2F20%2Fdownload&fileExt=pdf&fileName=a.pdf&source=material-document&documentId=20',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('opens office documents through the unified preview page', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    await expect(openDocumentPreview({ fileExt: 'docx', fileName: 'a.docx', url: '/api/uploads/a.docx' })).resolves.toBe(true);

    expect(open).toHaveBeenCalledWith(
      'http://localhost:3000/utils/documentPreview?url=%2Fapi%2Fuploads%2Fa.docx&fileExt=docx&fileName=a.docx',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('asks users to download unsupported file types', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    await expect(openDocumentPreview({ fileExt: 'dwg', url: '/api/uploads/a.dwg' })).resolves.toBe(false);

    expect(open).not.toHaveBeenCalled();
  });

  it('normalizes common previewable image extensions', () => {
    expect(canPreviewInBrowser('.PNG')).toBe(true);
    expect(canPreviewInOnlyOffice('.XLSX')).toBe(true);
  });
});
