import sysinfo from 'systeminformation';

async function getSysteminformation() {
  const osInfoPromise = sysinfo.osInfo();
  const cpuInfoPromise = sysinfo.cpu();
  const diskInfoPromise = sysinfo.diskLayout();
  const memInfoPromise = sysinfo.mem();
  const graphicsInfoPromise = sysinfo.graphics();

  const result = await Promise.all([
    osInfoPromise,
    cpuInfoPromise,
    diskInfoPromise,
    memInfoPromise,
    graphicsInfoPromise,
  ]);

  if (process.send) {
    process.send(result);
  }
}

getSysteminformation();
