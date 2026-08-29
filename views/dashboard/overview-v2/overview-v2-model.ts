export type DashboardOverviewV2GroupKey = 'analytics' | 'workspace';

export interface DashboardOverviewV2Scenario {
  code: string;
  description: string;
  group: DashboardOverviewV2GroupKey;
  prototypePath: string;
  tags: string[];
  title: string;
}

export interface DashboardOverviewV2Group {
  description: string;
  key: DashboardOverviewV2GroupKey;
  items: DashboardOverviewV2Scenario[];
  title: string;
}

const implementedScenarioCodes = new Set([
  'A1',
  'A2',
  'A3',
  'A4',
  'A5',
  'A6',
  'W1',
  'W2',
  'W3',
  'W4',
  'W5',
  'W6',
]);

const scenarioPagePaths: Record<DashboardOverviewV2GroupKey, string> = {
  analytics: '/dashboard/analytics-v2',
  workspace: '/dashboard/workspace-v2',
};

export const dashboardOverviewV2Scenarios: DashboardOverviewV2Scenario[] = [
  {
    code: 'A1',
    description: '从 ERP 工单到生产入库审核的全链路视角，作为分析页 V2 的默认落地页。',
    group: 'analytics',
    prototypePath: 'docs/MainPage/prototypes/analytics/a1-production-closure/index.html',
    tags: ['阶段漏斗', '闭环趋势', '阻塞 TOP'],
    title: '生产闭环总览',
  },
  {
    code: 'A2',
    description: '突出计划、完工、延期和车间达成率，面向计划员与生产经理。',
    group: 'analytics',
    prototypePath: 'docs/MainPage/prototypes/analytics/a2-plan-attainment/index.html',
    tags: ['计划达成', '延期分布', '车间排行'],
    title: '计划达成分析',
  },
  {
    code: 'A3',
    description: '围绕检验积压、缺陷分布、产品入库检验推送和质量趋势展开。',
    group: 'analytics',
    prototypePath: 'docs/MainPage/prototypes/analytics/a3-quality-closure/index.html',
    tags: ['缺陷 Pareto', '检验堆叠', '待检积压'],
    title: '质量闭环分析',
  },
  {
    code: 'A4',
    description: '沿 ERP 单据链看生产汇报单、产品入库检验、入库与领退补料的状态与失败原因。',
    group: 'analytics',
    prototypePath: 'docs/MainPage/prototypes/analytics/a4-erp-chain/index.html',
    tags: ['单据链路', '失败原因', '审核等待'],
    title: 'ERP 单据链分析',
  },
  {
    code: 'A5',
    description: '聚焦生产入库、WMS 任务、库存对账和库位差异风险。',
    group: 'analytics',
    prototypePath: 'docs/MainPage/prototypes/analytics/a5-warehouse-risk/index.html',
    tags: ['仓储风险', '任务状态环', '风险物料'],
    title: '仓储与入库风险',
  },
  {
    code: 'A6',
    description: '综合工作中心负荷、工时偏差、工资核算与异常报工。',
    group: 'analytics',
    prototypePath: 'docs/MainPage/prototypes/analytics/a6-capacity-wage/index.html',
    tags: ['产能负荷', '工时偏差', '核算漏斗'],
    title: '产能与报工核算',
  },
  {
    code: 'W1',
    description: '当天待处理的工单、检验、入库和 ERP 异常，按紧急程度排序。',
    group: 'workspace',
    prototypePath: 'docs/MainPage/prototypes/workspace/w1-today-closure/index.html',
    tags: ['今日待办', '异常优先', '快捷入口'],
    title: '今日闭环工作台',
  },
  {
    code: 'W2',
    description: '按工作中心、工序队列和阻塞状态组织，适合班组长开工调度。',
    group: 'workspace',
    prototypePath: 'docs/MainPage/prototypes/workspace/w2-team-leader/index.html',
    tags: ['工序队列', '负荷预警', '阻塞任务'],
    title: '班组长调度台',
  },
  {
    code: 'W3',
    description: '围绕质检员的待检、检验中、完成、ERP 重试和样本异常动作展开。',
    group: 'workspace',
    prototypePath: 'docs/MainPage/prototypes/workspace/w3-inspector/index.html',
    tags: ['待检积压', '样本录入', 'ERP 重试'],
    title: '质检员工作台',
  },
  {
    code: 'W4',
    description: '统一排队领料、退料、补料、生产入库、WMS 任务与库位差异。',
    group: 'workspace',
    prototypePath: 'docs/MainPage/prototypes/workspace/w4-warehouse/index.html',
    tags: ['仓储队列', '库位差异', '入库确认'],
    title: '仓储工作台',
  },
  {
    code: 'W5',
    description: '集中处理推送失败、待审核、可重试、最后错误和单据追踪。',
    group: 'workspace',
    prototypePath: 'docs/MainPage/prototypes/workspace/w5-erp-ops/index.html',
    tags: ['失败队列', '待审核', '单据追踪'],
    title: 'ERP 运维工作台',
  },
  {
    code: 'W6',
    description: '展示昨日遗留、今日风险、跨部门阻塞和关键指标，服务晨会扫视。',
    group: 'workspace',
    prototypePath: 'docs/MainPage/prototypes/workspace/w6-morning-brief/index.html',
    tags: ['晨会指标', '今日风险', '部门阻塞'],
    title: '管理者晨会工作台',
  },
];

const groupMeta: Array<Omit<DashboardOverviewV2Group, 'items'>> = [
  {
    description: 'A1-A6 分析页方案，按验收节奏逐个接入真实聚合数据。',
    key: 'analytics',
    title: '分析页',
  },
  {
    description: 'W1-W6 工作台方案，按角色与当日任务逐步落地。',
    key: 'workspace',
    title: '工作台',
  },
];

export function getDashboardOverviewV2Groups(): DashboardOverviewV2Group[] {
  return groupMeta.map((group) => ({
    ...group,
    items: dashboardOverviewV2Scenarios.filter((item) => item.group === group.key),
  }));
}

export function getDashboardScenariosByGroup(
  group: DashboardOverviewV2GroupKey,
): DashboardOverviewV2Scenario[] {
  return dashboardOverviewV2Scenarios.filter((item) => item.group === group);
}

export function getDashboardScenarioByCode(
  group: DashboardOverviewV2GroupKey,
  code?: string,
): DashboardOverviewV2Scenario | undefined {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) {
    return undefined;
  }
  return dashboardOverviewV2Scenarios.find(
    (item) => item.group === group && item.code === normalizedCode,
  );
}

export function getDefaultDashboardScenario(
  group: DashboardOverviewV2GroupKey,
): DashboardOverviewV2Scenario {
  const defaultCode = group === 'analytics' ? 'A1' : 'W1';
  return getDashboardScenarioByCode(group, defaultCode)!;
}

export function resolveDashboardScenario(
  group: DashboardOverviewV2GroupKey,
  code?: string,
): DashboardOverviewV2Scenario {
  return getDashboardScenarioByCode(group, code) || getDefaultDashboardScenario(group);
}

export function getNormalizedDashboardScenarioCode(
  group: DashboardOverviewV2GroupKey,
  code?: unknown,
): string {
  const rawCode = Array.isArray(code) ? code[0] : code;
  return resolveDashboardScenario(group, typeof rawCode === 'string' ? rawCode : undefined).code;
}

export function getDashboardScenarioRoute(scenario: DashboardOverviewV2Scenario): string {
  return `${scenarioPagePaths[scenario.group]}?scenario=${scenario.code}`;
}

export function isImplementedDashboardScenario(code?: string): boolean {
  return implementedScenarioCodes.has(String(code || '').trim().toUpperCase());
}
