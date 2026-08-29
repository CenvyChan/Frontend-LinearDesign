import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const readSource = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

describe('table operation layout', () => {
  it('keeps direct table action buttons in one horizontal group', () => {
    const styles = readSource('./tailwind.css');

    expect(styles).toMatch(
      /\.el-table__body\s+\.el-table__cell\s*>\s*\.cell:has\(>\s*\.el-button\s+\+\s+\.el-button\)[\s\S]*?display:\s*inline-flex[\s\S]*?flex-wrap:\s*nowrap/,
    );
    expect(styles).toContain(
      ":is([class*='action'], [class*='operation']):has(> .el-button + .el-button)",
    );
  });

  it('does not allow named operation containers to wrap', () => {
    const userPage = readSource('../views/system/user/index.vue');
    const masterDataPage = readSource(
      '../views/system/master-data-import-export.vue',
    );

    expect(userPage).toMatch(
      /\.action-buttons\s*\{[\s\S]*?flex-wrap:\s*nowrap;/,
    );
    expect(masterDataPage).toMatch(
      /\.master-data-actions\s*\{[\s\S]*?flex-wrap:\s*nowrap;/,
    );
  });
});
