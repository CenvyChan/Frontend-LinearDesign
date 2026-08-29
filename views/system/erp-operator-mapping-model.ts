import type { ErpOrganization } from '#/api/erpData';

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function formatErpOrganizationLabel(organization: ErpOrganization): string {
  const parts = [text(organization.erpOrgNumber), text(organization.remark)].filter(Boolean);
  return parts.join(' / ') || text(organization.erpOrgId);
}

export function resolveErpOrganizationLabel(
  organizations: ErpOrganization[],
  erpOrgId: unknown,
): string {
  const normalizedId = text(erpOrgId);
  if (!normalizedId) return '-';
  const organization = organizations.find((item) => text(item.erpOrgId) === normalizedId);
  return organization ? formatErpOrganizationLabel(organization) : normalizedId;
}

export function resolveDefaultErpOrgId(
  defaultOrganization: ErpOrganization | null | undefined,
  organizations: ErpOrganization[],
  currentErpOrgId?: string | null,
): string {
  const normalizedCurrentId = text(currentErpOrgId);
  const currentOrganization = organizations.find(
    (organization) => text(organization.erpOrgId) === normalizedCurrentId,
  );
  if (currentOrganization) return text(currentOrganization.erpOrgId);
  return text(defaultOrganization?.erpOrgId) || text(organizations[0]?.erpOrgId);
}
