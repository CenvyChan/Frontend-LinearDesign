import { requestClient } from '#/api/request';

export type OnlyOfficePreviewSource =
  | 'material-document'
  | 'mould-document'
  | 'process-route-document';

export interface OnlyOfficePreviewSourceResponse {
  checks: {
    file: 'READY';
    jwt: 'VALIDATED';
    source: 'SIGNED';
  };
  sourceUrl: string;
}

export function createOnlyOfficePreviewSource(payload: {
  documentId: number;
  source: OnlyOfficePreviewSource;
}) {
  return requestClient.post<OnlyOfficePreviewSourceResponse>('/onlyoffice/preview-source', payload);
}
