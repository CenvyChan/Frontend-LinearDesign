import { describe, expect, it } from 'vitest';

import {
  dashboardOverviewV2Scenarios,
  getDashboardOverviewV2Groups,
  getDashboardScenarioByCode,
  getDashboardScenarioRoute,
  getNormalizedDashboardScenarioCode,
  getDefaultDashboardScenario,
  isImplementedDashboardScenario,
  resolveDashboardScenario,
} from './overview-v2-model';

describe('overview-v2-model', () => {
  it('defines all analytics and workspace V2 scenarios with unique codes and prototype paths', () => {
    expect(dashboardOverviewV2Scenarios).toHaveLength(12);

    const codes = dashboardOverviewV2Scenarios.map((item) => item.code);
    expect(new Set(codes).size).toBe(12);
    expect(codes).toEqual([
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
    expect(dashboardOverviewV2Scenarios.every((item) => item.prototypePath.startsWith('docs/MainPage/prototypes/'))).toBe(true);
  });

  it('groups scenarios into analytics and workspace entry sections', () => {
    const groups = getDashboardOverviewV2Groups();

    expect(groups.map((group) => group.key)).toEqual(['analytics', 'workspace']);
    expect(groups[0]?.title).toBe('分析页');
    expect(groups[0]?.items).toHaveLength(6);
    expect(groups[1]?.title).toBe('工作台');
    expect(groups[1]?.items).toHaveLength(6);
  });

  it('uses A1 and W1 as default scenarios', () => {
    expect(getDefaultDashboardScenario('analytics')).toMatchObject({
      code: 'A1',
      title: '生产闭环总览',
    });
    expect(getDefaultDashboardScenario('workspace')).toMatchObject({
      code: 'W1',
      title: '今日闭环工作台',
    });
  });

  it('resolves query scenario codes and falls back to the default group scenario', () => {
    expect(resolveDashboardScenario('analytics', 'a4')).toMatchObject({
      code: 'A4',
      title: 'ERP 单据链分析',
    });
    expect(resolveDashboardScenario('workspace', 'W6')).toMatchObject({
      code: 'W6',
      title: '管理者晨会工作台',
    });
    expect(resolveDashboardScenario('analytics', 'W1')).toMatchObject({ code: 'A1' });
    expect(resolveDashboardScenario('workspace', 'A1')).toMatchObject({ code: 'W1' });
    expect(resolveDashboardScenario('analytics', undefined)).toMatchObject({ code: 'A1' });
  });

  it('normalizes missing or invalid query values to a loadable default code', () => {
    expect(getNormalizedDashboardScenarioCode('analytics', undefined)).toBe('A1');
    expect(getNormalizedDashboardScenarioCode('analytics', 'w1')).toBe('A1');
    expect(getNormalizedDashboardScenarioCode('analytics', 'a3')).toBe('A3');
    expect(getNormalizedDashboardScenarioCode('workspace', undefined)).toBe('W1');
    expect(getNormalizedDashboardScenarioCode('workspace', 'a1')).toBe('W1');
    expect(getNormalizedDashboardScenarioCode('workspace', 'w5')).toBe('W5');
  });

  it('builds stable query deep links for A/W V2 switching', () => {
    const analytics = getDashboardScenarioByCode('analytics', 'A1');
    const workspace = getDashboardScenarioByCode('workspace', 'W1');

    expect(analytics && getDashboardScenarioRoute(analytics)).toBe(
      '/dashboard/analytics-v2?scenario=A1',
    );
    expect(workspace && getDashboardScenarioRoute(workspace)).toBe(
      '/dashboard/workspace-v2?scenario=W1',
    );
  });

  it('returns undefined for unknown scenario codes', () => {
    expect(getDashboardScenarioByCode('analytics', 'W1')).toBeUndefined();
    expect(getDashboardScenarioByCode('workspace', 'A1')).toBeUndefined();
    expect(getDashboardScenarioByCode('analytics', 'A9')).toBeUndefined();
  });

  it('marks all A1-A6 and W1-W6 as implemented scenarios', () => {
    expect(isImplementedDashboardScenario('A1')).toBe(true);
    expect(isImplementedDashboardScenario('a3')).toBe(true);
    expect(isImplementedDashboardScenario('W2')).toBe(true);
    expect(isImplementedDashboardScenario('w3')).toBe(true);
    expect(isImplementedDashboardScenario('A4')).toBe(true);
    expect(isImplementedDashboardScenario('A6')).toBe(true);
    expect(isImplementedDashboardScenario('W4')).toBe(true);
    expect(isImplementedDashboardScenario('W6')).toBe(true);
    expect(isImplementedDashboardScenario(undefined)).toBe(false);
  });
});
