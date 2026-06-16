import { ipcRenderer } from 'electron';

import { HttpService } from '../browser/HttpService';
import { IPC_INVOKE_FETCH } from '../contracts/IpcEvents';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'CONNECT' | 'TRACE' | 'OPTIONS';

export class HttpServiceElectron extends HttpService {
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

    const result = await ipcRenderer.invoke(IPC_INVOKE_FETCH, uri, { method, headers, body });

    if (result.error) {
      console.warn(`HTTP request to ${uri} failed: ${result.error.message}`, result.error);
      throw new Error(`HTTP request failed: ${result.error.message}`);
    }

    return createMockResponse(result.response) as unknown as Response;
  }
}

function createMockResponse(responseData) {
  const { status, statusText, headers, body, ok, redirected, url, contentType } = responseData;

  return {
    status,
    statusText,
    headers,
    ok,
    redirected,
    url,
    getHeader(name) {
      return headers?.[name.toLowerCase()] ?? null;
    },
    text() {
      return Promise.resolve(body);
    },
    json() {
      try {
        return Promise.resolve(JSON.parse(body));
      } catch {
        return Promise.reject(new Error('Invalid JSON'));
      }
    },
    contentType,
  };
}
