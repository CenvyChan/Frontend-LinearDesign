const ERROR_RESPONSE_TYPES = ['application/json', 'text/html', 'text/plain'];

export function assertDownloadableBlob(blob: Blob) {
  const contentType = blob.type.toLowerCase();
  if (blob.size === 0) {
    throw new Error('下载内容为空');
  }
  if (ERROR_RESPONSE_TYPES.some((type) => contentType.includes(type))) {
    throw new Error('下载接口返回了错误响应，不是可打开的文件');
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  assertDownloadableBlob(blob);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
