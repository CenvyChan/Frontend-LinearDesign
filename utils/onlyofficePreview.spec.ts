import { describe, expect, it } from 'vitest';

import {
  attachOnlyOfficeToken,
  buildOnlyOfficeEditorConfig,
  isOnlyOfficeJwt,
} from './onlyofficePreview';

describe('OnlyOffice preview config', () => {
  it('places the generated token in the Document Server top-level slot only', () => {
    const config = attachOnlyOfficeToken(
      { document: { title: 'drawing.docx' }, editorConfig: { mode: 'view' } },
      'header.payload.signature',
    );

    expect(config.token).toBe('header.payload.signature');
    expect(config.editorConfig.token).toBeUndefined();
  });

  it('accepts compact JWTs and rejects malformed token responses', () => {
    expect(isOnlyOfficeJwt('header.payload.signature')).toBe(true);
    expect(isOnlyOfficeJwt('not-a-jwt')).toBe(false);
    expect(isOnlyOfficeJwt('header..signature')).toBe(false);
  });

  it('uses the signed source URL and a stable document identity in editor config', () => {
    const config = buildOnlyOfficeEditorConfig({
      documentId: '25',
      fileExt: 'docx',
      fileName: 'drawing.docx',
      source: 'material-document',
      sourceUrl: 'http://mes-backend:8080/api/public/onlyoffice/sources/material-document/25?signature=short-lived',
    });

    expect(config.document.url).toContain('/api/public/onlyoffice/sources/material-document/25?');
    expect(config.document.key).toBe('material-document-25');
    expect(config.document.url).not.toContain('/api/uploads/');
  });
});
