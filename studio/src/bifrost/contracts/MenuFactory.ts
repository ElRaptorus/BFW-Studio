import type { Menu } from '@evil/bifrost_fw_sdk';

export type MenuFactoryFunction = (...args: any[]) => Menu | Promise<Menu>;
