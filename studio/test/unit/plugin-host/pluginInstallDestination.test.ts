import assert from 'node:assert';
import * as path from 'path';
import { describe, it } from 'vitest';

import {
  isResolvedPathInsideDirectory,
  isSafePluginPackageName,
  resolvePluginInstallDestination,
} from '../../../src/bifrost/common/plugin-host/permissions/pluginInstallDestination';

const pluginsDirectory = path.join('/home', 'studio', 'plugins');

describe('plugin install destination', () => {
  it('joins an unscoped name under the plugins directory', () => {
    assert.strictEqual(
      resolvePluginInstallDestination(pluginsDirectory, 'order-tools'),
      path.join(pluginsDirectory, 'order-tools'),
    );
  });

  it('joins a scoped name as scope directory plus package name', () => {
    assert.strictEqual(
      resolvePluginInstallDestination(pluginsDirectory, '@acme/order-tools'),
      path.join(pluginsDirectory, '@acme', 'order-tools'),
    );
  });

  it('rejects names that would escape the plugins directory', () => {
    for (const packageName of ['.', '..', '../outside', 'foo/bar', '@scope/../name', 'foo\\bar', '@', '@scope', '']) {
      assert.strictEqual(isSafePluginPackageName(packageName), false, packageName);
      assert.throws(() => resolvePluginInstallDestination(pluginsDirectory, packageName));
    }
  });

  it('treats a path as inside a directory only when it is a descendant', () => {
    const inside = path.join(pluginsDirectory, 'order-tools');
    assert.strictEqual(isResolvedPathInsideDirectory(pluginsDirectory, inside), true);
    assert.strictEqual(isResolvedPathInsideDirectory(pluginsDirectory, pluginsDirectory), false);
    assert.strictEqual(
      isResolvedPathInsideDirectory(pluginsDirectory, path.join('/home', 'dev', 'order-tools')),
      false,
    );
    assert.strictEqual(
      isResolvedPathInsideDirectory(pluginsDirectory, path.join('/home', 'studio', 'plugins-other')),
      false,
    );
  });
});
