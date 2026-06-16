import type { Debugger } from 'debug';
import Debug from 'debug';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'CONNECT' | 'TRACE' | 'OPTIONS';

export class HttpService {
  protected log: Debugger;

  constructor() {
    this.log = Debug(`/${this.constructor.name}`);
  }

  async getText(uri: string, additionalHeaders: any = {}): Promise<any> {
    throw new Error('implement me');
  }

  async getJson(uri: string, additionalHeaders: any = {}): Promise<any> {
    const headers = {
      Accept: 'application/json',
      ...additionalHeaders,
    };

    const response = await this.request(uri, 'GET', headers, null);

    return response.json();
  }

  async postText(uri: string, data: any = {}, additionalHeaders: any = {}): Promise<any> {
    throw new Error('implement me');
  }

  async postJson(uri: string, data: any = {}, additionalHeaders: any = {}): Promise<any> {
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json;charset=UTF-8',
      ...additionalHeaders,
    };

    const response = await this.request(uri, 'POST', headers, JSON.stringify(data));

    return response.json();
  }

  async request(uri: string, method: HttpMethod, headers: any, body: any): Promise<Response> {
    this.log(method, uri);

    return fetch(uri, { method, headers, body });
  }
}
