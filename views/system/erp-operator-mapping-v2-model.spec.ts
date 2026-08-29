import { describe, expect, it } from 'vitest';

import type { ErpOperatorMappingItem } from '#/api/erpOperatorMapping';

import {
  buildErpOperatorMappingV2Model,
  DEFAULT_MES_RESPONSIBILITY_VIEW,
  formatErpMappingUserName,
  MES_SCOPE_TYPE_OPTIONS,
  pickResourceOwnerPayload,
  pickResponsibilityPayload,
  resolveResponsibilityView,
} from './erp-operator-mapping-v2-model';

describe('erp-operator-mapping-v2-model', () => {
  it('summarizes ERP personnel mapping coverage and duplicates', () => {
    const rows: ErpOperatorMappingItem[] = [
      {
        erpOperatorEntryId: 10,
        erpOperatorName: 'ERP Ann',
        erpOperatorNumber: 'E001',
        mappingRole: 'STOCKER',
        userId: 1,
      },
      {
        erpOperatorName: 'ERP Ben',
        erpOperatorNumber: 'E002',
        mappingRole: 'STOCKER',
        userId: 2,
      },
      {
        erpOperatorName: 'ERP Ben 2',
        erpOperatorNumber: 'E003',
        mappingRole: 'STOCKER',
        userId: 2,
      },
    ];

    const model = buildErpOperatorMappingV2Model(rows, 5);

    expect(model.summary.mappingCount).toBe(3);
    expect(model.summary.unmappedUserCount).toBe(3);
    expect(model.issueGroups.map((item) => item.key)).toEqual([
      'genericOrg',
      'missingEntry',
      'duplicateUserRole',
      'unmappedUsers',
    ]);
  });

  it('resolves the MES user name from the loaded user dictionary when the mapping row only has an id', () => {
    expect(formatErpMappingUserName(
      { userId: 1 },
      [{ id: 1, username: 'test001', real_name: '测试用户001' }],
    )).toBe('test001 / 测试用户001');
  });

  it('exposes department as a supported MES responsibility scope', () => {
    expect(MES_SCOPE_TYPE_OPTIONS).toContainEqual({ label: '部门', value: 'DEPARTMENT' });
  });

  it('opens the visible entry on MES responsibility scope instead of ERP personnel binding', () => {
    expect(DEFAULT_MES_RESPONSIBILITY_VIEW).toBe('USER_RESPONSIBILITY');
  });

  it('keeps the hidden v2 route on the legacy ERP binding view', () => {
    expect(resolveResponsibilityView('/system/erp-operator-mapping')).toBe('USER_RESPONSIBILITY');
    expect(resolveResponsibilityView('/system/erp-operator-mapping-v2')).toBe('ERP_BINDING');
  });
});

/**
 * 后端 DTO 字段清单，抄自
 * `src/main/java/cn/hamm/mes/dto/MesResourceResponsibilityOwnerSaveDto.java`
 * 与 `MesResponsibilitySaveDto.java`。
 * 断言"发出的键集合 ⊆ DTO 已知字段"——只断言值抓不到"多一个键"。
 */
const RESOURCE_OWNER_DTO_FIELDS = new Set([
  'id', 'erpAcctCode', 'erpOrgId', 'resourceType', 'resourceCode',
  'responsibilityCode', 'userResponsibilityId', 'remark',
]);

const RESPONSIBILITY_DTO_FIELDS = new Set([
  'id', 'responsibilityCode', 'responsibilityName', 'status', 'sort', 'remark',
]);

describe('MES 职责配置请求体裁剪', () => {
  /** 复现 2026-08-24 的 415：共用 configForm 带着职责表单的 status/scopeType。 */
  const sharedForm = {
    status: 1,
    scopeType: 'ORGANIZATION',
    resourceType: 'WAREHOUSE',
    erpAcctCode: 'FNSDEV',
    erpOrgId: '100071',
    resourceCode: 'FNS01.29',
    responsibilityCode: 'STOCKER',
    userResponsibilityId: 32,
  };

  it('剔除 status 与 scopeType —— 资源负责人 DTO 没有这两个字段，会 415', () => {
    const payload = pickResourceOwnerPayload(sharedForm);

    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('scopeType');
  });

  it('保留资源负责人 DTO 真正需要的字段', () => {
    expect(pickResourceOwnerPayload(sharedForm)).toEqual({
      erpAcctCode: 'FNSDEV',
      erpOrgId: '100071',
      resourceType: 'WAREHOUSE',
      resourceCode: 'FNS01.29',
      responsibilityCode: 'STOCKER',
      userResponsibilityId: 32,
    });
  });

  it('剔除编辑已有行时 Object.assign 带入的实体元字段', () => {
    const payload = pickResourceOwnerPayload({
      ...sharedForm,
      id: 7,
      tenantId: 1,
      createTime: 1_784_115_699_000,
      updateTime: 1_784_115_699_000,
      isDisabled: false,
    });

    expect(payload.id).toBe(7);
    for (const leaked of ['tenantId', 'createTime', 'updateTime', 'isDisabled']) {
      expect(payload).not.toHaveProperty(leaked);
    }
  });

  it('两个表单发出的键都不超出各自后端 DTO 的字段集合', () => {
    for (const key of Object.keys(pickResourceOwnerPayload(sharedForm))) {
      expect([...RESOURCE_OWNER_DTO_FIELDS]).toContain(key);
    }
    for (const key of Object.keys(pickResponsibilityPayload({
      ...sharedForm,
      responsibilityName: '仓管员',
      sort: 0,
    }))) {
      expect([...RESPONSIBILITY_DTO_FIELDS]).toContain(key);
    }
  });

  it('职责表单保留 status 但不带资源负责人字段', () => {
    const payload = pickResponsibilityPayload({
      responsibilityCode: 'STOCKER',
      responsibilityName: '仓管员',
      status: 1,
      scopeType: 'ORGANIZATION',
      resourceType: 'WAREHOUSE',
      erpAcctCode: 'FNSDEV',
    });

    expect(payload.status).toBe(1);
    for (const leaked of ['scopeType', 'resourceType', 'erpAcctCode']) {
      expect(payload).not.toHaveProperty(leaked);
    }
  });

  it('不把未填字段写成 undefined 键', () => {
    expect(Object.keys(pickResourceOwnerPayload({
      erpAcctCode: 'FNSDEV',
      responsibilityCode: 'STOCKER',
    }))).not.toContain('remark');
  });
});
