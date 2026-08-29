import { requestClient } from '#/api/request';

export type MouldQuoteCategory = 'INJECTION' | 'SHEET_METAL' | 'STAMPING';
export type MouldQuoteCostCategory = 'LABOR' | 'MATERIAL' | 'OTHER' | 'OUTSOURCE';
export type MouldQuoteStatus =
  | 'ACCEPTED'
  | 'APPROVED'
  | 'CANCELLED'
  | 'CUSTOMER_CONFIRMED'
  | 'DRAFT'
  | 'QUOTED'
  | 'REJECTED'
  | 'REVIEWED'
  | 'SUBMITTED';

export interface MouldQuote {
  acceptedTime?: number;
  approvedBy?: number;
  approvedByName?: string;
  approvedTime?: number;
  customerConfirmedTime?: number;
  customerName?: string;
  directCost?: number;
  grossProfit?: number;
  grossProfitRate?: number;
  id?: number;
  laborBudget?: number;
  managementFee?: number;
  managementRate?: number;
  materialBudget?: number;
  mouldCode?: string;
  mouldId?: number;
  mouldName?: string;
  mouldType?: string;
  orderId?: number;
  orderNo?: string;
  otherBudget?: number;
  outsourceBudget?: number;
  productName?: string;
  productNo?: string;
  quoteAmount?: number;
  quoteBy?: number;
  quoteByName?: string;
  quoteCategory?: MouldQuoteCategory;
  quoteDate?: number;
  quoteNo?: string;
  quoteStatus?: MouldQuoteStatus;
  remark?: string;
  reviewedTime?: number;
  riskFee?: number;
  riskRate?: number;
  submittedTime?: number;
  taxAmount?: number;
  taxIncludedAmount?: number;
  taxRate?: number;
  tenantId?: number;
  updateTime?: number;
}

export interface MouldQuoteParameter {
  id?: number;
  paramKey: string;
  paramName: string;
  paramValue?: string;
  quoteId?: number;
  sectionCode?: string;
  sortNo?: number;
  valueType?: string;
}

export interface MouldQuoteLine {
  amount?: number;
  calculatedAmount?: number;
  costCategory: MouldQuoteCostCategory;
  density?: number;
  formulaCode?: string;
  formulaText?: string;
  heightValue?: number;
  id?: number;
  inputSnapshot?: string;
  itemName: string;
  lengthValue?: number;
  lossRate?: number;
  materialName?: string;
  processName?: string;
  quantity?: number;
  quoteId?: number;
  remark?: string;
  sourceCell?: string;
  sourceSheet?: string;
  sortNo?: number;
  specification?: string;
  supplierName?: string;
  unitPrice?: number;
  widthValue?: number;
  workHours?: number;
}

export interface MouldQuoteLaborPrice {
  costCategory: 'LABOR' | 'OTHER';
  fixedAmount?: number;
  grade: string;
  id?: number;
  itemName: string;
  mouldType: string;
  remark?: string;
  sortNo?: number;
  sourceSheet?: string;
  tenantId?: number;
  unitPrice?: number;
  workHours?: number;
}

export interface MouldQuotePressPrice {
  actualCloseHeight?: string;
  applicableShape?: string;
  continuousPrice?: number;
  handleSpec?: string;
  id?: number;
  machineModel: string;
  mouldCloseHeight?: string;
  remark?: string;
  singlePrice?: number;
  sortNo?: number;
  sourceSheet?: string;
  tenantId?: number;
  tonnage: number;
}

export interface MouldQuoteActualCost {
  amount?: number;
  costCategory: Exclude<MouldQuoteCostCategory, 'OTHER'>;
  id?: number;
  itemName: string;
  quantity?: number;
  quoteId?: number;
  remark?: string;
  sourceBill?: string;
  sourceId?: number;
  sourceType?: string;
  unitPrice?: number;
}

export interface MouldQuoteRuleParameter {
  id?: number;
  mouldType: string;
  paramKey: string;
  paramName: string;
  paramValue?: string;
  remark?: string;
  ruleCode: string;
  sortNo?: number;
  sourceCell?: string;
  sourceSheet?: string;
  tenantId?: number;
  valueType?: string;
}

export interface MouldQuoteFormulaMapping {
  costCategory: MouldQuoteCostCategory;
  formulaCode: string;
  formulaText?: string;
  id?: number;
  lineName: string;
  mouldType: string;
  remark?: string;
  sortNo?: number;
  sourceCell?: string;
  sourceSheet?: string;
  tenantId?: number;
}

export interface MouldQuoteFlowLog {
  actionCode?: string;
  fromStatus?: MouldQuoteStatus;
  id?: number;
  operateTime?: number;
  operatorName?: string;
  remark?: string;
  toStatus?: MouldQuoteStatus;
}

export interface MouldQuoteComparisonItem {
  actualAmount: number;
  budgetAmount: number;
  category: Exclude<MouldQuoteCostCategory, 'OTHER'>;
  categoryName: string;
  varianceAmount: number;
  varianceRate: number;
}

export interface MouldQuoteDetail {
  actualCosts: MouldQuoteActualCost[];
  budgetLines: MouldQuoteLine[];
  comparison: MouldQuoteComparisonItem[];
  flowLogs: MouldQuoteFlowLog[];
  parameters: MouldQuoteParameter[];
  quote: MouldQuote;
}

export interface MouldQuoteRequest {
  budgetLines?: MouldQuoteLine[];
  parameters?: MouldQuoteParameter[];
  quote: MouldQuote;
}

export interface MouldQuoteQuery {
  keyword?: string;
  status?: MouldQuoteStatus | '';
}

export async function getMouldQuotes(params: MouldQuoteQuery) {
  return requestClient.get<{ data: MouldQuote[]; message?: string; success: boolean; total: number }>(
    '/mould-quotes',
    { params, responseReturn: 'body' },
  );
}

export async function getMouldQuoteDetail(id: number) {
  return requestClient.get<{ data: MouldQuoteDetail; message?: string; success: boolean }>(
    `/mould-quotes/${id}`,
    { responseReturn: 'body' },
  );
}

export async function getMouldQuoteLaborPrices(params?: { grade?: string; mouldType?: string }) {
  return requestClient.get<{ data: MouldQuoteLaborPrice[]; message?: string; success: boolean; total: number }>(
    '/mould-quotes/labor-prices',
    { params, responseReturn: 'body' },
  );
}

export async function getMouldQuotePressPrices(params?: { tonnage?: number }) {
  return requestClient.get<{ data: MouldQuotePressPrice[]; message?: string; success: boolean; total: number }>(
    '/mould-quotes/press-prices',
    { params, responseReturn: 'body' },
  );
}

export async function getMouldQuoteRuleParameters(params?: { mouldType?: string; ruleCode?: string }) {
  return requestClient.get<{ data: MouldQuoteRuleParameter[]; message?: string; success: boolean; total: number }>(
    '/mould-quotes/rule-parameters',
    { params, responseReturn: 'body' },
  );
}

export async function getMouldQuoteFormulaMappings(params?: { mouldType?: string }) {
  return requestClient.get<{ data: MouldQuoteFormulaMapping[]; message?: string; success: boolean; total: number }>(
    '/mould-quotes/formula-mappings',
    { params, responseReturn: 'body' },
  );
}

export async function createMouldQuote(data: MouldQuoteRequest) {
  return requestClient.post<{ data: MouldQuote; message?: string; success: boolean }>(
    '/mould-quotes',
    data,
    { responseReturn: 'body' },
  );
}

export async function updateMouldQuote(id: number, data: MouldQuoteRequest) {
  return requestClient.put<{ data: MouldQuote; message?: string; success: boolean }>(
    `/mould-quotes/${id}`,
    data,
    { responseReturn: 'body' },
  );
}

export async function submitMouldQuote(id: number) {
  return requestClient.post<{ data: MouldQuote; message?: string; success: boolean }>(
    `/mould-quotes/${id}/submit`,
    undefined,
    { responseReturn: 'body' },
  );
}

export async function calculateMouldQuote(id: number) {
  return requestClient.post<{ data: MouldQuote; message?: string; success: boolean }>(
    `/mould-quotes/${id}/calculate`,
    undefined,
    { responseReturn: 'body' },
  );
}

export async function approveMouldQuote(id: number) {
  return requestClient.post<{ data: MouldQuote; message?: string; success: boolean }>(
    `/mould-quotes/${id}/approve`,
    undefined,
    { responseReturn: 'body' },
  );
}

export async function customerConfirmMouldQuote(id: number) {
  return requestClient.post<{ data: MouldQuote; message?: string; success: boolean }>(
    `/mould-quotes/${id}/customer-confirm`,
    undefined,
    { responseReturn: 'body' },
  );
}

export async function acceptMouldQuote(id: number) {
  return requestClient.post<{ data: MouldQuote; message?: string; success: boolean }>(
    `/mould-quotes/${id}/accept`,
    undefined,
    { responseReturn: 'body' },
  );
}

export async function syncMouldQuoteActualCosts(id: number) {
  return requestClient.post<{ data: MouldQuoteActualCost[]; message?: string; success: boolean }>(
    `/mould-quotes/${id}/actual-costs/sync`,
    undefined,
    { responseReturn: 'body' },
  );
}

export async function addMouldQuoteActualCost(id: number, data: MouldQuoteActualCost) {
  return requestClient.post<{ data: MouldQuoteActualCost; message?: string; success: boolean }>(
    `/mould-quotes/${id}/actual-costs`,
    data,
    { responseReturn: 'body' },
  );
}

export async function getMouldQuoteComparison(id: number) {
  return requestClient.get<{ data: MouldQuoteComparisonItem[]; message?: string; success: boolean }>(
    `/mould-quotes/${id}/comparison`,
    { responseReturn: 'body' },
  );
}

export async function getMouldQuoteCalculationTrace(id: number) {
  return requestClient.get<{ data: MouldQuoteLine[]; message?: string; success: boolean; total: number }>(
    `/mould-quotes/${id}/calculation-trace`,
    { responseReturn: 'body' },
  );
}
