/**
 * Landscape Kitchen Sink. Every command returns plain data so the integration tests can assert on it:
 * - `call(method, args)` runs any `api.landscape` method (also `modeling.*`) and reports success or the error message.
 * - `subscribe(uri)` records element and overlay-context events; `events()` returns them.
 * - `registerFactory()` adds a badge to every process on the plane; `factoryCalls()` reports what the factory saw.
 * - `mark` is the command behind the manifest palette entry and the manifest context pad entry.
 * - `rendererMessages()` returns what the renderer module posted back.
 */

const recordedEvents = [];
const rendererMessages = [];
const markInvocations = [];
const factoryCalls = [];
let factoryDisposable = null;

exports.activate = async (api) => {
  function resolveMethod(path) {
    const segments = path.split('.');
    const name = segments.pop();
    const owner = segments.reduce((target, segment) => target[segment], api.landscape);
    return (...args) => owner[name](...args);
  }

  await api.landscape.onRendererModuleMessage((data) => {
    rendererMessages.push(data);
  });

  await api.commands.register('call', async (method, args) => {
    try {
      const result = await resolveMethod(method)(...(args ?? []));
      return { success: true, result: result ?? null };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  await api.commands.register('subscribe', async (uri) => {
    await api.landscape.onElementSelected(uri, (event) => recordedEvents.push({ kind: 'selected', ...event }));
    await api.landscape.onElementHover(uri, (event) => recordedEvents.push({ kind: 'hover', ...event }));
    await api.landscape.onElementDoubleClick(uri, (event) => recordedEvents.push({ kind: 'doubleClick', ...event }));
    await api.landscape.onElementContextMenu(uri, (event) => recordedEvents.push({ kind: 'contextMenu', ...event }));
    await api.landscape.onOverlayContextChanged(uri, (event) =>
      recordedEvents.push({ kind: 'overlayContext', reason: event.reason, uri: event.uri }),
    );
    return true;
  });

  await api.commands.register('events', async () => recordedEvents.slice());
  await api.commands.register('clearEvents', async () => {
    recordedEvents.length = 0;
    return true;
  });

  await api.commands.register('registerFactory', async () => {
    factoryDisposable = await api.landscape.registerOverlayFactory((context) => {
      factoryCalls.push({
        uri: context.uri,
        elementIds: context.elements.map((element) => element.id).sort(),
        relationCount: context.elements.filter((element) => element.type === 'relation').length,
      });
      const badges = context.elements
        .filter((element) => element.type === 'process')
        .map((element) => ({
          elementId: element.id,
          position: 'top-right',
          type: 'badge',
          text: 'KS',
          tooltip: 'Kitchen Sink badge',
          style: 'info',
        }));
      return [...context.currentOverlays, ...badges];
    });
    return true;
  });

  await api.commands.register('disposeFactory', async () => {
    await factoryDisposable?.dispose();
    factoryDisposable = null;
    return true;
  });

  await api.commands.register('factoryCalls', async () => factoryCalls.slice());

  await api.commands.register('mark', async (...args) => {
    markInvocations.push(args);
    return true;
  });
  await api.commands.register('markInvocations', async () => markInvocations.slice());

  await api.commands.register('rendererMessages', async () => rendererMessages.slice());
};

exports.deactivate = () => {};
