import type { MaterialListItem } from '@/api/production'

export const DEFAULT_INTEGER_UNIT_NUMBERS = 'PCS,pcs,Pcs,个,件,只,套'
export const DEFAULT_ONE_DECIMAL_UNIT_NUMBERS = 'KG,kg,Kg,千克'

export interface ApplySplitResult {
  allowedPickQty: number
  feedQty: number
  integerUnit: boolean
  normalizedRequestQty: number
  pickQty: number
}

export function isIntegerUnit(unitNumber?: string, integerUnitNumbers = DEFAULT_INTEGER_UNIT_NUMBERS) {
  if (!unitNumber) return false
  const normalized = unitNumber.trim().toLowerCase()
  return integerUnitNumbers
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .some((item) => item.toLowerCase() === normalized)
}

export function isOneDecimalUnit(unitNumber?: string, oneDecimalUnitNumbers = DEFAULT_ONE_DECIMAL_UNIT_NUMBERS) {
  if (!unitNumber) return false
  const normalized = unitNumber.trim().toLowerCase()
  return oneDecimalUnitNumbers
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .some((item) => item.toLowerCase() === normalized)
}

export function normalizeQtyByUnit(
  qty: number | string | undefined | null,
  unitNumber?: string,
  integerUnitNumbers = DEFAULT_INTEGER_UNIT_NUMBERS,
  oneDecimalUnitNumbers = DEFAULT_ONE_DECIMAL_UNIT_NUMBERS,
) {
  const value = Number(qty || 0)
  if (!Number.isFinite(value) || value <= 0) {
    return value
  }
  if (isIntegerUnit(unitNumber, integerUnitNumbers)) {
    return Math.ceil(value)
  }
  if (isOneDecimalUnit(unitNumber, oneDecimalUnitNumbers)) {
    return Math.round(value * 10) / 10
  }
  return value
}

function getRawErpAvailableApplyQty(row: Pick<MaterialListItem, 'goodReturnQty' | 'incDefectReturnQty' | 'mustQty' | 'returnQty' | 'selectedPickedQty'>) {
  return Math.max(
    0,
    Number(row.mustQty || 0)
      - Number(row.selectedPickedQty || 0)
      + Number(row.goodReturnQty || 0)
      + Number(row.incDefectReturnQty || 0)
      - Number(row.returnQty || 0),
  )
}

export function getErpAvailableApplyQty(
  row: Pick<MaterialListItem, 'baseUnitNumber' | 'goodReturnQty' | 'incDefectReturnQty' | 'mustQty' | 'returnQty' | 'selectedPickedQty'>,
  integerUnitNumbers = DEFAULT_INTEGER_UNIT_NUMBERS,
  oneDecimalUnitNumbers = DEFAULT_ONE_DECIMAL_UNIT_NUMBERS,
) {
  const raw = Math.max(
    0,
    Number(row.mustQty || 0)
      - Number(row.selectedPickedQty || 0)
      + Number(row.goodReturnQty || 0)
      + Number(row.incDefectReturnQty || 0)
      - Number(row.returnQty || 0),
  )
  return normalizeQtyByUnit(raw, row.baseUnitNumber, integerUnitNumbers, oneDecimalUnitNumbers)
}

export function getAllowedPickQty(
  row: Pick<MaterialListItem, 'baseUnitNumber' | 'consumVolatility' | 'goodReturnQty' | 'incDefectReturnQty' | 'mustQty' | 'returnQty' | 'selectedPickedQty'>,
  preparingQty: number,
  integerUnitNumbers = DEFAULT_INTEGER_UNIT_NUMBERS,
  oneDecimalUnitNumbers = DEFAULT_ONE_DECIMAL_UNIT_NUMBERS,
) {
  const base = Math.max(0, getRawErpAvailableApplyQty(row) - Number(preparingQty || 0))
  return normalizeQtyByUnit(base, row.baseUnitNumber, integerUnitNumbers, oneDecimalUnitNumbers)
}

export function buildApplySplit(
  row: Pick<MaterialListItem, 'baseUnitNumber' | 'consumVolatility' | 'goodReturnQty' | 'incDefectReturnQty' | 'mustQty' | 'pbomEntryId' | 'returnQty' | 'selectedPickedQty'>,
  requestQty: number,
  preparingQty: number,
  integerUnitNumbers = DEFAULT_INTEGER_UNIT_NUMBERS,
  oneDecimalUnitNumbers = DEFAULT_ONE_DECIMAL_UNIT_NUMBERS,
): ApplySplitResult {
  const normalizedRequestQty = normalizeQtyByUnit(requestQty, row.baseUnitNumber, integerUnitNumbers, oneDecimalUnitNumbers)
  const allowedPickQty = getAllowedPickQty(row, preparingQty, integerUnitNumbers, oneDecimalUnitNumbers)
  const pickQty = Math.min(normalizedRequestQty, allowedPickQty)
  const feedQty = Math.max(0, normalizedRequestQty - pickQty)
  return {
    allowedPickQty,
    feedQty,
    integerUnit: isIntegerUnit(row.baseUnitNumber, integerUnitNumbers),
    normalizedRequestQty,
    pickQty,
  }
}
