export interface ControlledPrintJob {
  printUrl: string;
}

export interface ControlledPrintDeps {
  createObjectURL?: typeof URL.createObjectURL;
  fetchImpl?: typeof fetch;
  openWindow?: typeof window.open;
  revokeObjectURL?: typeof URL.revokeObjectURL;
  setTimeout?: (handler: TimerHandler, timeout?: number, ...arguments_: any[]) => number;
}

const PRINT_WINDOW_FEATURES = 'popup,width=960,height=720';
const BLOB_REVOKE_DELAY_MS = 60_000;

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function writeDocument(printWindow: Window, html: string) {
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

function writeStatus(printWindow: Window, message: string) {
  writeDocument(
    printWindow,
    `<!doctype html><html><head><meta charset="utf-8"><title>Controlled Print</title></head><body>${escapeHtml(
      message,
    )}</body></html>`,
  );
}

export function openControlledPrintWindow(deps: ControlledPrintDeps = {}) {
  const openWindow = deps.openWindow ?? window.open.bind(window);
  const printWindow = openWindow('', '_blank', PRINT_WINDOW_FEATURES);
  if (!printWindow) {
    throw new Error('Controlled print window was blocked by the browser');
  }
  try {
    printWindow.opener = null;
  } catch {
    // Some browsers expose opener as read-only for WindowProxy.
  }
  writeStatus(printWindow, 'Preparing controlled print...');
  return printWindow;
}

export async function renderControlledPrintJob(
  printWindow: Window,
  job: ControlledPrintJob,
  deps: ControlledPrintDeps = {},
) {
  const fetchImpl = deps.fetchImpl ?? fetch.bind(window);
  const createObjectURL = deps.createObjectURL ?? URL.createObjectURL.bind(URL);
  const revokeObjectURL = deps.revokeObjectURL ?? URL.revokeObjectURL.bind(URL);
  const setTimeoutImpl = deps.setTimeout ?? window.setTimeout.bind(window);

  const response = await fetchImpl(job.printUrl, {
    cache: 'no-store',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Controlled print file request failed: ${response.status}`);
  }
  const pdfUrl = createObjectURL(await response.blob());
  writeDocument(
    printWindow,
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Controlled Print</title>
  <style>
    html, body, iframe { width: 100%; height: 100%; margin: 0; border: 0; }
    body { overflow: hidden; }
  </style>
</head>
<body>
  <iframe id="controlled-print-frame" src="${escapeHtml(pdfUrl)}"></iframe>
  <script>
    (function () {
      var printed = false;
      var frame = document.getElementById('controlled-print-frame');
      function runPrint() {
        if (printed) return;
        printed = true;
        setTimeout(function () {
          try {
            frame.contentWindow.focus();
            frame.contentWindow.print();
          } catch (error) {
            window.print();
          }
          setTimeout(function () {
            window.close();
          }, 1200);
        }, 300);
      }
      frame.addEventListener('load', runPrint, { once: true });
      setTimeout(runPrint, 2000);
    })();
  </script>
</body>
</html>`,
  );
  setTimeoutImpl(() => revokeObjectURL(pdfUrl), BLOB_REVOKE_DELAY_MS);
}
