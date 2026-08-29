import { baseRequestClient } from '#/api/request';

export type MetalCategoryType = '' | 'BASE' | 'PRECIOUS' | 'SMALL';

export interface MetalCategory {
  akshareSymbol: null | string;
  categoryCode: string;
  categoryName: string;
  categoryType: 'BASE' | 'PRECIOUS' | 'SMALL';
  dataSource: string;
  displayMode?: string;
  id: number;
  isActive: number;
  sortOrder: number;
  supportsDailyHistory?: boolean;
  supportsMinuteTrend?: boolean;
  trendMode?: string;
  unit: string;
}

export interface MetalLatestItem {
  categoryCode: string;
  categoryName: string;
  categoryType: string;
  changeAmount: null | number;
  changePct: null | number;
  closePrice: null | number;
  dataSource: null | string;
  displayMode?: string;
  fetchedAt: null | string;
  openPrice: null | number;
  priceDate: null | string;
  priceTime: null | string;
  supportsDailyHistory?: boolean;
  supportsMinuteTrend?: boolean;
  trendMode?: string;
  unit: null | string;
}

export interface TrendPoint {
  price: null | number;
  time: string;
}

export interface TrendResponse {
  categoryCode?: string;
  categoryName?: string;
  data: TrendPoint[];
  displayMode: string;
  message?: string;
  points: TrendPoint[];
  success: boolean;
  supportsDailyHistory: boolean;
  supportsMinuteTrend: boolean;
  trendType: 'benchmark' | 'daily' | 'minute';
}

export interface HistoryItem {
  changeAmount: null | number;
  changePct: null | number;
  closePrice: null | number;
  highPrice: null | number;
  id: number;
  lowPrice: null | number;
  openPrice: null | number;
  priceDate: null | string;
  priceTime: null | string;
  volume: null | number;
}

export interface SyncLogItem {
  akshareApi: null | string;
  dataSource: string;
  durationMs: null | number;
  endTime: null | string;
  errorMessage: null | string;
  id: number;
  savedCount: number;
  skippedCount: number;
  startTime: null | string;
  status: string;
  syncType: string;
  totalCount: number;
}

export interface SyncStatus {
  aktoolsEnabled: boolean;
  aktoolsStatus: any;
  failedCount: number;
  latestStatus?: null | string;
  latestStatusMessage?: null | string;
  latestStatusTime?: null | string;
  partialCount: number;
  successCount: number;
  totalCount: number;
  tradingHours: boolean;
}

export interface ListResponse<T> {
  data: T[];
  message?: string;
  success: boolean;
}

export interface LatestResponse {
  data: MetalLatestItem[];
  lastSyncTime: null | string;
  message?: string;
  success: boolean;
}

export interface HistoryResponse {
  data: {
    list: HistoryItem[];
    page: number;
    pageSize: number;
    total: number;
  };
  message?: string;
  success: boolean;
}

export interface SyncLogsResponse {
  data: {
    list: SyncLogItem[];
    page: number;
    pageSize: number;
    total: number;
  };
  message?: string;
  success: boolean;
}

export interface ActionResponse {
  [key: string]: any;
  message?: string;
  success: boolean;
}

export interface SyncStatusResponse {
  data: SyncStatus;
  message?: string;
  success: boolean;
}

export async function getMetalCategories(type?: MetalCategoryType) {
  const resp: any = await baseRequestClient.get('/metal-price/categories', {
    params: { type: type || undefined },
  });
  return resp.data as ListResponse<MetalCategory>;
}

export async function getLatestPrices(type?: MetalCategoryType) {
  const resp: any = await baseRequestClient.get('/metal-price/latest', {
    params: { type: type || undefined },
  });
  return resp.data as LatestResponse;
}

export async function getMetalTrend(categoryCode: string) {
  const resp: any = await baseRequestClient.get('/metal-price/trend', {
    params: { categoryCode },
  });
  return resp.data as TrendResponse;
}

export async function getMetalHistory(params: {
  categoryCode: string;
  dailyOnly?: boolean;
  endDate?: string;
  page?: number;
  pageSize?: number;
  startDate?: string;
}) {
  const resp: any = await baseRequestClient.get('/metal-price/history', {
    params,
  });
  return resp.data as HistoryResponse;
}

export async function syncMetalPrices() {
  const resp: any = await baseRequestClient.post('/metal-price/sync/now');
  return resp.data as ActionResponse;
}

export async function syncMetalInit() {
  const resp: any = await baseRequestClient.post('/metal-price/sync/init');
  return resp.data as ActionResponse;
}

export async function getMetalSyncLogs(params: {
  dataSource?: string;
  page?: number;
  pageSize?: number;
  status?: string;
}) {
  const resp: any = await baseRequestClient.get('/metal-price/sync/logs', {
    params,
  });
  return resp.data as SyncLogsResponse;
}

export async function cleanMetalHistory(params: {
  categoryCode?: string;
  endDate: string;
  startDate: string;
}) {
  const resp: any = await baseRequestClient.delete('/metal-price/clean', {
    params,
  });
  return resp.data as ActionResponse;
}

export async function getMetalSyncStatus() {
  const resp: any = await baseRequestClient.get('/metal-price/sync/status');
  return resp.data as SyncStatusResponse;
}
