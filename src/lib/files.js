// src/lib/files.js
import cockpit from 'cockpit';

const VAR_LIB = '/var/lib/stigr';

export async function readSystemInfo() {
  const hostname = await cockpit.spawn(['hostname'], { superuser: 'require' })
    .catch(() => 'unknown');

  const osRelease = await cockpit.file('/etc/os-release').read().catch(() => '');
  const nameMatch = osRelease?.match(/^PRETTY_NAME="(.+)"/m);
  const verMatch  = osRelease?.match(/^VERSION_ID="(.+)"/m);

  return {
    hostname:   hostname.trim(),
    os_name:    nameMatch ? nameMatch[1] : 'Unknown OS',
    os_version: verMatch  ? verMatch[1]  : '',
  };
}

export async function readState() {
  try {
    const proc = await cockpit.spawn(
      ['bash', '-c', `ls -t ${VAR_LIB}/generated/stigr_*_state.json 2>/dev/null | head -1`],
      { superuser: 'require' }
    );
    const path = proc.trim();
    if (!path) return null;
    const content = await cockpit.file(path, { superuser: 'require' }).read();
    return content ? JSON.parse(content) : null;
  } catch {
    return null;
  }
}

export function watchState(callback) {
  let stopped = false;

  const poll = async () => {
    if (stopped) return;
    try {
      const state = await readState();
      callback(state);
    } catch {
      callback(null);
    }
    if (!stopped) setTimeout(poll, 30000);
  };

  poll();
  return () => { stopped = true; };
}

export async function readDaemonConfig() {
  try {
    const content = await cockpit.file('/etc/stigr/daemon.conf', { superuser: 'require' }).read();
    if (!content) return null;
    const config = {};
    for (const line of content.split('\n')) {
      const [key, ...rest] = line.split('=');
      if (key && rest.length) config[key.trim()] = rest.join('=').trim();
    }
    return config;
  } catch {
    return null;
  }
}

export function watchDaemonLog(callback) {
  const file   = cockpit.file(`${VAR_LIB}/logs/daemon.log`, { superuser: 'require' });
  const handle = file.watch(content => {
    if (content) callback(content);
  });
  return () => handle.remove();
}

export async function listResultFiles() {
  try {
    const out = await cockpit.spawn(
      ['bash', '-c', `ls -t ${VAR_LIB}/results/*.xml 2>/dev/null`],
      { superuser: 'require' }
    );
    return out.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

export async function readResultFile(path) {
  try {
    return await cockpit.file(path, { superuser: 'require' }).read();
  } catch {
    return null;
  }
}

export async function isTimerActive() {
  try {
    await cockpit.spawn(['systemctl', 'is-active', 'stigr-scan.timer'], { superuser: 'require' });
    return true;
  } catch {
    return false;
  }
}
