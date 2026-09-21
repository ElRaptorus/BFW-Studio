import type { Menu } from '@elraptorus/bfw_studio_sdk';

export type MenuFactoryFunction = (...args: any[]) => Menu | Promise<Menu>;
