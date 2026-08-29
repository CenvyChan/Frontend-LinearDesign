export function getStepQrCodeUrl(orderId: number, stepNo: number): string {
  return `/api/production-order/${orderId}/qrcode/step/${stepNo}`;
}
