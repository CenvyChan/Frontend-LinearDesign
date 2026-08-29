export type ActiveModule =
  | 'dashboard'
  | 'order-diagnostics'
  | 'production-tasks'
  | 'quality-inspection'
  | 'inventory-wms'
  | 'form-model'
  | 'system-factory';

export interface MetricCard {
  label: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  helpText: string;
}

export interface WorkOrderDiagnostic {
  id: string;
  orderNo: string;
  productCode: string;
  productName: string;
  batchNo: string;
  planQty: number;
  completedQty: number;
  currentProcess: string;
  healthScore: number; // 0-100
  status: 'NORMAL' | 'BLOCKED' | 'WARNING' | 'COMPLETED';
  stages: {
    name: string;
    status: 'completed' | 'in_progress' | 'blocked' | 'pending';
    erpStatus: 'SYNCED' | 'FAILED' | 'PENDING' | 'N_A';
    operator?: string;
    timestamp?: string;
    details: string;
  }[];
  exceptions: {
    type: string;
    severity: 'high' | 'medium' | 'low';
    message: string;
    solution: string;
  }[];
}

export interface ProductionTask {
  id: string;
  taskNo: string;
  taskType: 'PICK' | 'FEED' | 'RETURN';
  orderNo: string;
  materialCode: string;
  materialName: string;
  spec: string;
  applyQty: number;
  actualQty: number;
  unit: string;
  status: 'PENDING' | 'CLAIMED' | 'EXECUTING' | 'WAIT_ERP_AUDIT' | 'COMPLETED' | 'ERP_FAILED';
  warehouseCode: string;
  warehouseName: string;
  applicant: string;
  createdAt: string;
  erpVoucherNo?: string;
  erpErrorMsg?: string;
}

export interface QualityTask {
  id: string;
  taskNo: string;
  orderNo: string;
  schemeName: string;
  checkType: 'IQC' | 'IPQC' | 'FQC' | 'OQC';
  sampleQty: number;
  passQty: number;
  failQty: number;
  result: 'PASS' | 'FAIL' | 'PENDING' | 'CONCESSION';
  inspector: string;
  inspectTime: string;
  erpPushStatus: 'PUSHED' | 'UNPUSHED' | 'FAILED';
  items: {
    paramName: string;
    standard: string;
    measured: string;
    result: 'OK' | 'NG';
  }[];
}

export interface InStockTask {
  id: string;
  instockNo: string;
  orderNo: string;
  productName: string;
  reportQty: number;
  qualifiedQty: number;
  targetWarehouse: string;
  locationCode: string;
  status: 'WAIT_ERP_AUDIT' | 'PENDING_CONFIRM' | 'COMPLETED' | 'ERP_FAILED';
  erpReceiptNo?: string;
  erpErrorMsg?: string;
  handler: string;
  reportTime: string;
}

export interface FormModelItem {
  id: string;
  modelKey: string;
  modelName: string;
  accountGroup: string;
  version: string;
  status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';
  fieldCount: number;
  detailTableCount: number;
  views: {
    id: string;
    viewName: string;
    routePath: string;
    isDefault: boolean;
  }[];
  authorizations: {
    principalType: 'USER' | 'ROLE';
    principalName: string;
    canView: boolean;
    canCreate: boolean;
    canExport: boolean;
  }[];
}
