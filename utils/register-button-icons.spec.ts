import { describe, expect, it } from 'vitest';

import { registerButtonIcons } from './register-button-icons';

describe('registerButtonIcons', () => {
  it('registers business button icon components globally', () => {
    const registered = new Set<string>();
    const app = {
      component(name: string) {
        registered.add(name);
        return app;
      },
    };

    registerButtonIcons(app as any);

    expect([...registered].sort()).toEqual([
      'ArrowLeft',
      'Check',
      'CircleCheck',
      'CircleClose',
      'CopyDocument',
      'Delete',
      'Document',
      'Download',
      'Edit',
      'EditPen',
      'Printer',
      'Refresh',
      'RefreshRight',
      'Search',
      'Sort',
      'Upload',
      'User',
      'VideoPlay',
      'View',
      'Plus',
    ].sort());
  });
});
