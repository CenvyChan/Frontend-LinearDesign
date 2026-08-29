import type { InspectionScheme, InspectionSchemeItem, InspectionType } from '#/api/inspectionScheme';

export type InspectionSchemeV2Tone = 'danger' | 'info' | 'success' | 'warning';

export interface InspectionSchemeV2IssueGroup {
  count: number;
  key: 'disabled' | 'missingItems' | 'missingScope' | 'numericWithoutLimit';
  label: string;
  tone: InspectionSchemeV2Tone;
}

export interface InspectionSchemeV2Coverage {
  count: number;
  key: InspectionType;
  label: string;
  tone: InspectionSchemeV2Tone;
}

export interface InspectionSchemesV2Model {
  coverageByType: InspectionSchemeV2Coverage[];
  issueGroups: InspectionSchemeV2IssueGroup[];
  summary: {
    active: number;
    disabled: number;
    requiredItemCount: number;
    selectedItemCount: number;
    total: number;
  };
}

const TYPE_LABELS: Record<InspectionType, string> = {
  FQC: '成品检验',
  IQC: '来料检验',
  LQC: '产线巡检',
  OQC: '发货检验',
  PQC: '制程检验',
};

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasScope(row: InspectionScheme): boolean {
  return [
    row.materialCode,
    row.productCode,
    row.processCode,
    row.supplierCode,
    row.customerCode,
    row.lineCode,
  ].some(hasText);
}

export function buildInspectionSchemesV2Model(
  schemes: InspectionScheme[] = [],
  selectedItems: InspectionSchemeItem[] = [],
): InspectionSchemesV2Model {
  const disabled = schemes.filter((row) => row.status === 'DISABLED').length;
  const missingScope = schemes.filter((row) => !hasScope(row)).length;
  const numericWithoutLimit = selectedItems.filter((row) =>
    row.valueType === 'NUMERIC'
    && row.lowerLimit === undefined
    && row.upperLimit === undefined
    && !hasText(row.standardValue),
  ).length;

  return {
    coverageByType: (Object.keys(TYPE_LABELS) as InspectionType[]).map((key) => {
      const count = schemes.filter((row) => row.inspectionType === key).length;
      return {
        count,
        key,
        label: TYPE_LABELS[key],
        tone: count > 0 ? 'success' : 'info',
      };
    }),
    issueGroups: ([
      { count: disabled, key: 'disabled', label: '停用方案', tone: 'warning' },
      { count: missingScope, key: 'missingScope', label: '适用范围过宽', tone: 'warning' },
      { count: selectedItems.length === 0 && schemes.length > 0 ? 1 : 0, key: 'missingItems', label: '当前方案无项目', tone: 'danger' },
      { count: numericWithoutLimit, key: 'numericWithoutLimit', label: '数值项缺少标准', tone: 'danger' },
    ] as InspectionSchemeV2IssueGroup[]).filter((item) => item.count > 0),
    summary: {
      active: schemes.filter((row) => row.status !== 'DISABLED').length,
      disabled,
      requiredItemCount: selectedItems.filter((row) => row.requiredFlag !== false).length,
      selectedItemCount: selectedItems.length,
      total: schemes.length,
    },
  };
}
