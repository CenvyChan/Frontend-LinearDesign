import { describe, expect, it } from 'vitest';

import type { ErpOrganization } from '#/api/erpData';

import {
  formatErpOrganizationLabel,
  resolveDefaultErpOrgId,
  resolveErpOrganizationLabel,
} from './erp-operator-mapping-model';

function organization(overrides: Partial<ErpOrganization> = {}): ErpOrganization {
  return {
    erpOrgId: '100071',
    erpOrgName: '飞诺斯制造组织',
    erpOrgNumber: '001',
    id: 1,
    isDefault: true,
    mesOrgId: 1,
    remark: 'FNSDEV',
    status: true,
    ...overrides,
  };
}

describe('erp-operator-mapping-model', () => {
  it('formats an organization with ERP number and remark', () => {
    expect(formatErpOrganizationLabel(organization())).toBe('001 / FNSDEV');
  });

  it('resolves an ERP organization label and falls back to the raw ID', () => {
    const organizations = [organization()];

    expect(resolveErpOrganizationLabel(organizations, '100071')).toBe('001 / FNSDEV');
    expect(resolveErpOrganizationLabel(organizations, '326691')).toBe('326691');
  });

  it('prefers the API default organization before the first option', () => {
    const first = organization({ erpOrgId: '326691', erpOrgNumber: '005', isDefault: false });
    const defaultOrg = organization();

    expect(resolveDefaultErpOrgId(defaultOrg, [first, defaultOrg])).toBe('100071');
    expect(resolveDefaultErpOrgId(null, [first, defaultOrg])).toBe('326691');
  });

  it('prefers the current selected organization when it is available', () => {
    const current = organization({ erpOrgId: '326691', erpOrgNumber: '005', isDefault: false });
    const defaultOrg = organization();

    expect(resolveDefaultErpOrgId(defaultOrg, [current, defaultOrg], '326691')).toBe('326691');
  });
});
