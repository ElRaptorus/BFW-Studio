export declare type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'CONNECT' | 'TRACE' | 'OPTIONS';
export declare class HttpService {
  getText(uri: string, additionalHeaders?: any): Promise<any>;
  getJson(uri: string, additionalHeaders?: any): Promise<any>;
  postText(uri: string, data?: any, additionalHeaders?: any): Promise<any>;
  postJson(uri: string, data?: any, additionalHeaders?: any): Promise<any>;
  request(uri: string, method: HttpMethod, headers: any, body: any): Promise<Response>;
}
