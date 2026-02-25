// src/hooks/useDaemon.js
import { useState, useEffect } from 'react';
import cockpit from 'cockpit';
import { saveDaemonConfig, runScan } from '../lib/bridge';

const DAEMON_CONFIG = '/etc/stigr/daemon.conf';

function parseConfig(text) {
  const out = {};
  for (const raw of (text ?? '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    out[line.substring(0, eq).trim()] = line.substring(eq + 1).trim();
  }
  return out;
}

function parseBool(value, fallback = false) {
  if (value === 'true')  return true;
  if (value === 'false') return false;
  return fallback;
}

export const FREQUENCY_OPTIONS = [
  { key: 'daily',   label: 'Daily' },
  { key: 'weekly',  label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

export const DAY_OPTIONS = [
  { key: 'sunday',    label: 'Sunday' },
  { key: 'monday',    label: 'Monday' },
  { key: 'tuesday',   label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday',  label: 'Thursday' },
  { key: 'friday',    label: 'Friday' },
  { key: 'saturday',  label: 'Saturday' },
];

export const TIME_OPTIONS = Array.from({ length: 24 }, (_, h) => {
  const hh = String(h).padStart(2, '0');
  return { key: `${hh}:00`, label: `${hh}:00 UTC` };
});

export function useDaemon() {
  const [loading,          setLoading]          = useState(true);
  const [saving,           setSaving]           = useState(false);
  const [scanning,         setScanning]         = useState(false);
  const [saveError,        setSaveError]        = useState('');
  const [scanError,        setScanError]        = useState('');
  const [lastRun,          setLastRun]          = useState(null);
  const [timerActive,      setTimerActive]      = useState(false);
  const [enabled,          setEnabled]          = useState(false);
  const [notifyNew,        setNotifyNew]        = useState(false);
  const [notifyRegression, setNotifyRegression] = useState(false);
  const [frequency,        setFrequency]        = useState('weekly');
  const [day,              setDay]              = useState('sunday');
  const [time,             setTime]             = useState('02:00');

  useEffect(() => {
    const configPromise = cockpit.file(DAEMON_CONFIG, { superuser: 'require' })
      .read()
      .then(content => parseConfig(content ?? ''))
      .catch(() => ({}));

    const timerPromise = cockpit.spawn(
      ['systemctl', 'is-active', 'stigr-scan.timer'],
      { superuser: 'require' }
    )
      .then(out => out.trim() === 'active')
      .catch(() => false);

    const lastRunPromise = cockpit.spawn(
      ['systemctl', 'show', 'stigr-scan.timer', '--property=LastTriggerUSec'],
      { superuser: 'require' }
    )
      .then(out => {
        const val = out.replace('LastTriggerUSec=', '').trim();
        return (val && val !== 'n/a' && val !== '0') ? val : null;
      })
      .catch(() => null);

    Promise.all([configPromise, timerPromise, lastRunPromise]).then(([cfg, active, last]) => {
      // If daemon.conf has an explicit enabled key use it, otherwise trust systemctl
      const enabledVal = cfg.enabled !== undefined ? parseBool(cfg.enabled) : active;

      setEnabled(enabledVal);
      setNotifyNew(parseBool(cfg.notify_new));
      setNotifyRegression(parseBool(cfg.notify_regression));
      if (cfg.frequency) setFrequency(cfg.frequency);
      if (cfg.day)       setDay(cfg.day);
      if (cfg.time)      setTime(cfg.time);
      setTimerActive(active);
      if (last) setLastRun(last);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const result = await saveDaemonConfig({
        enabled:           String(enabled),
        notify_new:        String(notifyNew),
        notify_regression: String(notifyRegression),
        frequency,
        day,
        time,
      });
      if (result.status !== 'ok') setSaveError(result.error ?? 'Save failed');
      else setTimerActive(enabled);
    } catch (e) {
      setSaveError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleRunScan = async () => {
    setScanning(true);
    setScanError('');
    try {
      const result = await runScan();
      if (result.status !== 'ok') setScanError(result.error ?? 'Scan failed');
      else setLastRun(new Date().toLocaleString());
    } catch (e) {
      setScanError(String(e));
    } finally {
      setScanning(false);
    }
  };

  return {
    loading, saving, scanning, saveError, scanError,
    lastRun, timerActive,
    enabled,          setEnabled,
    notifyNew,        setNotifyNew,
    notifyRegression, setNotifyRegression,
    frequency,        setFrequency,
    day,              setDay,
    time,             setTime,
    handleSave,
    handleRunScan,
  };
}
