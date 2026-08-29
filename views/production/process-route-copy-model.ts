import { RouteStatus } from '#/api/processRoute';

import type { ProcessRoute, ProcessStep } from '#/api/processRoute';

type ResourceList = Array<Record<string, unknown>> | undefined;

function stripResourceIds<T extends ResourceList>(items: T): T {
  if (!items) return items;
  return items.map(({ id: _id, ...item }) => ({ ...item })) as T;
}

function cloneCopyStep(step: ProcessStep): ProcessStep {
  const { id: _id, routeId: _routeId, ...copy } = step;
  return {
    ...copy,
    workCenters: stripResourceIds(copy.workCenters as ResourceList) as ProcessStep['workCenters'],
    machines: stripResourceIds(copy.machines as ResourceList) as ProcessStep['machines'],
    toolings: stripResourceIds(copy.toolings as ResourceList) as ProcessStep['toolings'],
    gauges: stripResourceIds(copy.gauges as ResourceList) as ProcessStep['gauges'],
    moulds: stripResourceIds(copy.moulds as ResourceList) as ProcessStep['moulds'],
  };
}

export function createProcessRouteCopyDraft(source: ProcessRoute): Partial<ProcessRoute> {
  const { id: _id, erpRouteId: _erpRouteId, createdTime: _createdTime, ...copy } = source;
  return {
    ...copy,
    routeCode: '',
    routeName: '',
    materialCode: '',
    materialName: '',
    productCode: '',
    productSpec: '',
    bomVersion: '',
    status: RouteStatus.DRAFT,
    steps: (source.steps || []).map(cloneCopyStep),
  };
}
