export type MasterDataGroupKey = 'factory' | 'integration' | 'opening' | 'process' | 'system';
export type MasterDataTone = 'info' | 'primary' | 'success' | 'warning';

export interface MasterDataItem {
  basePath: string;
  description: string;
  filename: string;
  key: string;
  label: string;
  mode?: 'excel' | 'export-only' | 'reference-check';
  tone: MasterDataTone;
  warning?: string;
}

export interface MasterDataGroup {
  description: string;
  items: MasterDataItem[];
  key: MasterDataGroupKey;
  label: string;
}

const MASTER_DATA_GROUPS: MasterDataGroup[] = [
  {
    description: '工作中心、机台、工装、量具和模具等工厂建模资料集中维护',
    key: 'factory',
    label: '工厂建模',
    items: [
      {
        basePath: '/work-center',
        description: '工作中心编码、名称、位置、产能和启用状态',
        filename: '工作中心',
        key: 'work-center',
        label: '工作中心',
        tone: 'primary',
      },
      {
        basePath: '/machine',
        description: '机台编码、名称、规格型号、工作中心、状态和购置维护日期',
        filename: '机台',
        key: 'machine',
        label: '机台',
        tone: 'success',
      },
      {
        basePath: '/tooling',
        description: '工装夹具编码、名称、规格型号、状态和位置',
        filename: '工装夹具',
        key: 'tooling',
        label: '工装夹具',
        tone: 'info',
      },
      {
        basePath: '/gauge',
        description: '量具检具编码、名称、精度、状态和校准日期',
        filename: '量具检具',
        key: 'gauge',
        label: '量具检具',
        tone: 'warning',
      },
      {
        basePath: '/mould',
        description: '模具编码、名称、归属、状态、寿命和存放位置',
        filename: '模具',
        key: 'mould',
        label: '模具',
        tone: 'primary',
      },
    ],
  },
  {
    description: '工序池、工艺路线、检验方案和工序单价等生产基础资料集中维护',
    key: 'process',
    label: '工艺与质量',
    items: [
      {
        basePath: '/process-pool',
        description: '工序编码、名称、类型、工作中心、状态和标准节拍',
        filename: '工序池',
        key: 'process-pool',
        label: '工序池',
        tone: 'primary',
      },
      {
        basePath: '/process-route',
        description: '工艺路线、版本、步骤、资源绑定和生效信息',
        filename: '工艺路线',
        key: 'process-route',
        label: '工艺路线',
        tone: 'success',
      },
      {
        basePath: '/inspection-schemes',
        description: '检验方案、检验项目、上下限、抽样数和生效日期',
        filename: '检验方案',
        key: 'inspection-schemes',
        label: '检验方案',
        tone: 'warning',
      },
      {
        basePath: '/process-wage/prices',
        description: '工序单价、计价方式、工作中心、有效期和状态',
        filename: '工序单价',
        key: 'process-step-price',
        label: '工序单价',
        tone: 'info',
      },
    ],
  },
  {
    description: '部门、岗位、字典、配置、用户和角色等系统主数据集中维护',
    key: 'system',
    label: '系统主数据',
    items: [
      {
        basePath: '/system-master/department',
        description: '部门名称、上级部门、排序、负责人和联系方式',
        filename: '部门',
        key: 'department',
        label: '部门',
        tone: 'primary',
      },
      {
        basePath: '/system-master/post',
        description: '岗位编码、岗位名称、排序和启用状态',
        filename: '岗位',
        key: 'post',
        label: '岗位',
        tone: 'success',
      },
      {
        basePath: '/system-master/dictionary',
        description: '字典类型、字典编码、显示值、排序和默认值',
        filename: '字典',
        key: 'dictionary',
        label: '字典',
        tone: 'info',
      },
      {
        basePath: '/system-master/config',
        description: '配置键、配置值、配置名称和描述',
        filename: '系统配置',
        key: 'config',
        label: '系统配置',
        tone: 'warning',
        warning: '包含 password 的敏感配置键不会导出，也不允许通过 Excel 导入。',
      },
      {
        basePath: '/system-master/user',
        description: '用户名、姓名、手机号、邮箱、性别、角色和状态',
        filename: '用户',
        key: 'user',
        label: '用户',
        tone: 'primary',
        warning: '新增用户使用系统默认密码配置；默认密码本身请在专用配置页维护。',
      },
      {
        basePath: '/system-master/role',
        description: '角色编码、角色名称、权限编码、排序和状态',
        filename: '角色',
        key: 'role',
        label: '角色',
        tone: 'success',
      },
    ],
  },
  {
    description: 'MES 人员和 ERP 单据人员映射等集成基础资料集中维护',
    key: 'integration',
    label: '集成映射',
    items: [
      {
        basePath: '/system-master/responsibility',
        description: 'MES 职责编码、名称、状态、排序和备注',
        filename: 'MES职责目录',
        key: 'responsibility',
        label: 'MES 职责目录',
        tone: 'primary',
      },
      {
        basePath: '/system-master/user-responsibility',
        description: 'MES 用户、职责、账套、ERP 组织与组织/仓库/车间范围',
        filename: '用户职责分配',
        key: 'user-responsibility',
        label: '用户职责分配',
        tone: 'success',
      },
      {
        basePath: '/system-master/resource-responsibility-owner',
        description: '账套、ERP 组织、仓库或车间负责人职责绑定',
        filename: '资源职责负责人',
        key: 'resource-responsibility-owner',
        label: '资源职责负责人',
        tone: 'info',
      },
      {
        basePath: '/system-master/erp-operator-mapping',
        description: 'MES 用户、职责、账套、ERP 组织与 ERP 人员编码',
        filename: 'ERP人员映射',
        key: 'erp-operator-mapping',
        label: 'ERP 人员映射',
        tone: 'warning',
      },
      {
        basePath: '/system-master/responsibility-integrity-report',
        description: '导出职责、资源负责人、ERP 人员绑定及旧数据整改项，仅供核查整改',
        filename: '职责配置完整性报告',
        key: 'responsibility-integrity-report',
        label: '职责配置完整性报告',
        mode: 'export-only',
        tone: 'warning',
        warning: '该报告仅支持导出，不支持模板下载或导入。',
      },
    ],
  },
  {
    description: '库存期初、在制工单期初和 ERP 引用校验刷新，集中处理上线前的一次性基础导入',
    key: 'opening',
    label: '期初数据',
    items: [
      {
        basePath: '/opening/inventory',
        description: '组织、仓库、库位、物料、批号、状态、数量和锁定数量等 MES/WMS 库存基线',
        filename: '库存期初',
        key: 'opening-inventory',
        label: '库存期初',
        tone: 'primary',
        warning: '仅建立 MES/WMS 本地库存基线，不覆盖 ERP 实时库存。',
      },
      {
        basePath: '/opening/wip-orders',
        description: '工单号、产品、数量、工艺路线、当前工序、计划日期和业务状态',
        filename: '在制工单期初',
        key: 'opening-wip-orders',
        label: '在制工单期初',
        tone: 'success',
        warning: '导入后会创建或更新 MES 工单并生成流转卡，不推送 ERP。',
      },
      {
        basePath: '/opening/references',
        description: 'ERP 连接状态、基础缓存刷新、库存和工单引用校验报告',
        filename: 'ERP引用校验报告',
        key: 'erp-reference-check',
        label: 'ERP 缓存校验',
        mode: 'reference-check',
        tone: 'warning',
        warning: 'ERP 主数据以 ERP 为准，这里只做连接、刷新和引用校验。',
      },
    ],
  },
];

export function buildMasterDataGroups(): MasterDataGroup[] {
  return MASTER_DATA_GROUPS.map((group) => ({
    ...group,
    items: group.items.map((item) => ({ ...item })),
  }));
}

export function findMasterDataItem(key: string): MasterDataItem | undefined {
  return buildMasterDataGroups()
    .flatMap((group) => group.items)
    .find((item) => item.key === key);
}

export function countMasterDataItems(groups: MasterDataGroup[]): number {
  return groups.reduce((total, group) => total + group.items.length, 0);
}
