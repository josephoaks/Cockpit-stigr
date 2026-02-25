// src/hooks/useLogs.js
import { useState, useEffect, useRef, useCallback } from 'react';
import cockpit from 'cockpit';

const LOG_DIR   = '/var/lib/stigr/logs';
const MAX_LINES = 500;

// ── Parser ────────────────────────────────────────────────────────────────────
// Each line is a raw JSON object: {"ts": "...", "level": "INFO", ...}

function parseLine(raw, index) {
  const line = raw.trim();
  if (!line) return null;

  try {
    const obj = JSON.parse(line);
    return {
      id:        index,
      timestamp: obj.ts ?? '',
      level:     (obj.level ?? 'DEBUG').toUpperCase(),
      text:      line,   // display the full JSON as-is
      obj,               // keep parsed object for future use
    };
  } catch {
    // Not JSON — show as-is at DEBUG level
    return {
      id:        index,
      timestamp: '',
      level:     'DEBUG',
      text:      line,
      obj:       null,
    };
  }
}

export function levelColor(level) {
  switch (level) {
    case 'INFO':  return '#2ec4b6';
    case 'WARN':  return '#f0a500';
    case 'ERROR': return '#e05252';
    default:      return '#6b7280';  // DEBUG
  }
}

export const LEVELS = ['ALL', 'INFO', 'WARN', 'ERROR'];

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLogs() {
  const [lines,       setLines]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [level,       setLevel]       = useState('ALL');
  const [search,      setSearch]      = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [logFile,     setLogFile]     = useState('');

  const intervalRef = useRef(null);

  const loadLogs = useCallback(() => {
    cockpit.spawn(
      ['bash', '-c', `ls -t ${LOG_DIR}/*.log 2>/dev/null | head -1`],
      { superuser: 'require' }
    )
      .then(out => {
        const file = out.trim();
        if (!file) { setLoading(false); return Promise.resolve(null); }
        setLogFile(file);
        return cockpit.spawn(
          ['tail', '-n', String(MAX_LINES), file],
          { superuser: 'require' }
        );
      })
      .then(content => {
        if (!content) return;
        const parsed = content
          .split('\n')
          .map((l, i) => parseLine(l, i))
          .filter(Boolean);
        setLines(parsed);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(loadLogs, 5000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, loadLogs]);

  const filtered = lines.filter(l => {
    const matchLevel  = level === 'ALL' || l.level === level;
    const matchSearch = !search || l.text.toLowerCase().includes(search.toLowerCase());
    return matchLevel && matchSearch;
  });

  return {
    lines, filtered, loading,
    level,       setLevel,
    search,      setSearch,
    autoRefresh, setAutoRefresh,
    logFile,
    refresh: loadLogs,
  };
}
