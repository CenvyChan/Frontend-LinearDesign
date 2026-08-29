import { ElMessageBox } from 'element-plus';

const BROWSER_PREVIEW_EXTENSIONS = new Set([
  'bmp',
  'gif',
  'jpeg',
  'jpg',
  'pdf',
  'png',
  'svg',
  'txt',
  'webp',
]);

const ONLY_OFFICE_EXTENSIONS = new Set([
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
]);

const UNIFIED_PREVIEW_EXTENSIONS = new Set([
  ...BROWSER_PREVIEW_EXTENSIONS,
  ...ONLY_OFFICE_EXTENSIONS,
]);

export interface DocumentPreviewTarget {
  documentId?: number | string | null;
  fileExt?: string | null;
  fileName?: string | null;
  source?: 'material-document' | 'mould-document' | 'process-route-document';
  url?: string | null;
}

export function normalizeFileExt(fileExt?: string | null) {
  return (fileExt || '').trim().replace(/^\./, '').toLowerCase();
}

export function canPreviewInBrowser(fileExt?: string | null) {
  return BROWSER_PREVIEW_EXTENSIONS.has(normalizeFileExt(fileExt));
}

export function canPreviewInOnlyOffice(fileExt?: string | null) {
  return ONLY_OFFICE_EXTENSIONS.has(normalizeFileExt(fileExt));
}

export function canPreviewInUnifiedPage(fileExt?: string | null) {
  return UNIFIED_PREVIEW_EXTENSIONS.has(normalizeFileExt(fileExt));
}

function buildDocumentPreviewUrl(target: DocumentPreviewTarget) {
  const params = new URLSearchParams();
  params.set('url', target.url || '');
  if (target.fileExt) params.set('fileExt', target.fileExt);
  if (target.fileName) params.set('fileName', target.fileName);
  if (target.source) params.set('source', target.source);
  if (target.documentId != null) params.set('documentId', String(target.documentId));
  const base = (import.meta.env.VITE_BASE || '/').replace(/\/$/, '');
  const route = `/utils/documentPreview?${params.toString()}`;
  if (import.meta.env.VITE_ROUTER_HISTORY === 'hash') {
    return `${window.location.origin}${base || ''}/#${route}`;
  }
  return `${window.location.origin}${base || ''}${route}`;
}

export async function openDocumentPreview(target: DocumentPreviewTarget) {
  if (!target.url) {
    await ElMessageBox.alert(
      '\u8be5\u6587\u4ef6\u6682\u65e0\u53ef\u8bbf\u95ee\u5730\u5740\uff0c\u8bf7\u4e0b\u8f7d\u67e5\u770b\u3002',
      '\u65e0\u6cd5\u9884\u89c8',
      {
        confirmButtonText: '\u77e5\u9053\u4e86',
        type: 'warning',
      },
    );
    return false;
  }

  if (!canPreviewInUnifiedPage(target.fileExt)) {
    const suffix = normalizeFileExt(target.fileExt).toUpperCase() || '\u672a\u77e5\u683c\u5f0f';
    await ElMessageBox.alert(
      `\u5f53\u524d\u6587\u4ef6\u7c7b\u578b ${suffix} \u4e0d\u652f\u6301\u5728\u7ebf\u9884\u89c8\uff0c\u8bf7\u4e0b\u8f7d\u540e\u67e5\u770b\u3002`,
      '\u65e0\u6cd5\u9884\u89c8',
      {
        confirmButtonText: '\u77e5\u9053\u4e86',
        type: 'warning',
      },
    );
    return false;
  }

  window.open(buildDocumentPreviewUrl(target), '_blank', 'noopener,noreferrer');
  return true;
}
