import {
  scopeNodeKey,
  type MesScopeType,
} from './mes-responsibility-tree-model';

export interface ErpOrganizationOption {
  erpAcctCode?: string;
  erpOrgId?: string;
  erpOrgName?: string;
  erpOrgNumber?: string;
  mesOrgId?: number;
}

export interface ScopeCandidateOption {
  label: string;
  value: string;
}

export interface ErpOrganizationBatch<T extends ErpOrganizationOption = ErpOrganizationOption> {
  acctCode: string;
  organizations: T[];
  responseAcctCode?: string;
}

export interface ResponsibilityScopeDraftInput {
  erpAcctCode: string;
  erpOrgId: string;
  responsibilityCodes: string[];
  scopeKeys: string[];
  scopeType: MesScopeType;
}

export interface ResponsibilityScopePreviewRow {
  exists: boolean;
  key: string;
  responsibilityCode: string;
  scopeKey: string;
  scopeType: MesScopeType;
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function firstText(...values: unknown[]): string {
  return values.map(text).find(Boolean) || '';
}

function organizationIdentity(organization: ErpOrganizationOption): string {
  return [text(organization.erpAcctCode), text(organization.erpOrgId)].join('|');
}

export function resolveErpOrgId(
  organizations: ErpOrganizationOption[],
  erpOrgId: unknown,
  erpAcctCode?: unknown,
): string {
  const value = text(erpOrgId);
  if (!value) return '';
  const account = text(erpAcctCode);
  const organization = organizations.find((item) => {
    if (account && text(item.erpAcctCode) !== account) return false;
    return [item.erpOrgId, item.erpOrgNumber, item.mesOrgId, item.erpOrgName]
      .map(text)
      .includes(value);
  });
  return text(organization?.erpOrgId) || value;
}

export function dedupeErpOrganizations<T extends ErpOrganizationOption>(organizations: T[]): T[] {
  const uniqueOrganizations = new Map<string, T>();
  for (const organization of organizations) {
    const key = organizationIdentity(organization) || [
      text(organization.erpAcctCode),
      text(organization.erpOrgNumber),
      text(organization.erpOrgName),
    ].join('|');
    if (!key || uniqueOrganizations.has(key)) continue;
    uniqueOrganizations.set(key, organization);
  }
  return [...uniqueOrganizations.values()];
}

export function normalizeErpOrganizations<T extends ErpOrganizationOption>(
  batches: ErpOrganizationBatch<T>[],
): T[] {
  const normalized: T[] = [];
  for (const batch of batches) {
    const requestedAcctCode = text(batch.acctCode);
    const responseAcctCode = text(batch.responseAcctCode) || requestedAcctCode;
    if (!requestedAcctCode || responseAcctCode !== requestedAcctCode) continue;
    for (const organization of batch.organizations ?? []) {
      const organizationAcctCode = text(organization.erpAcctCode);
      if (organizationAcctCode && organizationAcctCode !== requestedAcctCode) continue;
      normalized.push({ ...organization, erpAcctCode: requestedAcctCode } as T);
    }
  }
  return dedupeErpOrganizations(normalized);
}

export function extractScopeCandidateItems(payload: unknown, depth = 0): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object' || depth > 3) return [];
  const record = payload as Record<string, unknown>;
  for (const key of ['data', 'records', 'list', 'rows', 'items']) {
    const value = record[key];
    if (Array.isArray(value)) return value;
    const nested = extractScopeCandidateItems(value, depth + 1);
    if (nested.length > 0) return nested;
  }
  return [];
}

export function buildScopeCandidateOptions(items: unknown[]): ScopeCandidateOption[] {
  const options = new Map<string, ScopeCandidateOption>();
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const value = firstText(
      record.warehouseNumber,
      record.workshopNumber,
      record.number,
      record.code,
      record.stockNumber,
      record.erpStockId,
      record.id,
    );
    if (!value || options.has(value)) continue;
    const name = firstText(
      record.warehouseName,
      record.workshopName,
      record.name,
      record.stockName,
    );
    options.set(value, {
      label: [value, name].filter(Boolean).join(' / '),
      value,
    });
  }
  return [...options.values()];
}

export function buildResponsibilityScopePreview(
  input: ResponsibilityScopeDraftInput,
  existingKeys: Set<string>,
): ResponsibilityScopePreviewRow[] {
  const scopeKeys = input.scopeType === 'ORGANIZATION' ? [''] : unique(input.scopeKeys);
  const rows: ResponsibilityScopePreviewRow[] = [];
  for (const responsibilityCode of unique(input.responsibilityCodes)) {
    for (const scopeKey of scopeKeys) {
      const key = scopeNodeKey(
        input.erpAcctCode,
        input.erpOrgId,
        responsibilityCode,
        input.scopeType,
        scopeKey,
      );
      rows.push({
        exists: existingKeys.has(key),
        key,
        responsibilityCode,
        scopeKey,
        scopeType: input.scopeType,
      });
    }
  }
  return rows;
}
