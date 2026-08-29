export interface OnlyOfficeEditorConfigInput {
  documentId?: number | string | null;
  fileExt: string;
  fileName: string;
  source: string;
  sourceUrl: string;
}

function documentType(fileExt: string) {
  if (['xls', 'xlsx'].includes(fileExt)) return 'cell';
  if (['ppt', 'pptx'].includes(fileExt)) return 'slide';
  return 'word';
}

export function buildOnlyOfficeEditorConfig(input: OnlyOfficeEditorConfigInput): Record<string, any> {
  const identity = `${input.documentId ?? input.fileName}`.replace(/[^a-zA-Z0-9._-]/g, '_');
  return {
    document: {
      fileType: input.fileExt,
      key: `${input.source}-${identity}`.slice(0, 120),
      title: input.fileName,
      url: input.sourceUrl,
    },
    documentType: documentType(input.fileExt),
    editorConfig: {
      lang: 'zh-CN',
      mode: 'view',
      user: { id: 'mes-preview', name: 'MES' },
    },
    height: '100%',
    type: 'desktop',
    width: '100%',
  };
}

export function attachOnlyOfficeToken<T extends Record<string, any>>(
  config: T,
  token: string,
): Omit<T, 'editorConfig' | 'token'> & {
  editorConfig: Record<string, any> & { token?: undefined };
  token: string;
} {
  const { token: _editorToken, ...editorConfig } = config.editorConfig || {};
  return {
    ...config,
    editorConfig,
    token,
  };
}

export function isOnlyOfficeJwt(token: unknown): token is string {
  return typeof token === 'string'
    && token.split('.').length === 3
    && token.split('.').every((part) => part.length > 0);
}
