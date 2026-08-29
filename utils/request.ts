import { requestClient } from '#/api/request';

export const request = {
 post(url: string, data?: any) { return requestClient.post(url, data, { responseReturn: 'body' }); },
 get(url: string, config?: any) { return requestClient.get(url, { params: config?.params, responseReturn: 'body' }); },
 put(url: string, data?: any) { return requestClient.put(url, data, { responseReturn: 'body' }); },
 delete(url: string, config?: any) { return requestClient.delete(url, { params: config?.params, responseReturn: 'body' }); },
};
