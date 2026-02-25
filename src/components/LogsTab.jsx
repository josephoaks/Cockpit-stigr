// src/components/LogsTab.jsx
import React, { useRef, useEffect } from 'react';
import {
  Card, CardBody,
  Spinner,
  Button, Flex, FlexItem,
  Switch,
  SearchInput,
} from '@patternfly/react-core';
import { useLogs, levelColor, LEVELS } from '../hooks/useLogs';

// ── LevelButton ───────────────────────────────────────────────────────────────

function LevelButton({ label, active, onClick }) {
  const color = label === 'ALL' ? '#e0e0e0' : levelColor(label);
  return (
    <button
      onClick={onClick}
      style={{
        padding:      '0.25rem 0.85rem',
        borderRadius: '4px',
        border:       active ? `1px solid ${color}` : '1px solid transparent',
        background:   active ? `${color}22` : 'transparent',
        color:        color,
        fontWeight:   active ? 700 : 400,
        fontSize:     '0.875rem',
        cursor:       'pointer',
        transition:   'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}

// ── LogLine ───────────────────────────────────────────────────────────────────

function LogLine({ line }) {
  const color = levelColor(line.level);
  return (
    <div style={{
      fontFamily: 'monospace',
      fontSize:   '0.775rem',
      lineHeight: '1.6',
      padding:    '0.05rem 0',
      color:      color,
      whiteSpace: 'pre-wrap',
      wordBreak:  'break-all',
    }}>
      {line.text}
    </div>
  );
}

// ── LogsTab ───────────────────────────────────────────────────────────────────

export const LogsTab = () => {
  const {
    filtered, loading,
    level,       setLevel,
    search,      setSearch,
    autoRefresh, setAutoRefresh,
    logFile,
    refresh,
  } = useLogs();

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filtered.length]);

  return (
    <div style={{ padding: '1rem' }}>
      <Card>
        <CardBody style={{ padding: '1rem' }}>

          {/* ── Controls ── */}
          <Flex
            alignItems={{ default: 'alignItemsCenter' }}
            gap={{ default: 'gapMd' }}
            style={{ marginBottom: '0.75rem', flexWrap: 'wrap' }}
          >
            <FlexItem>
              <span style={{ color: 'var(--pf-v6-global--Color--200)', fontSize: '0.875rem', marginRight: '0.5rem' }}>
                Level:
              </span>
              <span style={{ display: 'inline-flex', gap: '0.25rem' }}>
                {LEVELS.map(l => (
                  <LevelButton key={l} label={l} active={level === l} onClick={() => setLevel(l)} />
                ))}
              </span>
            </FlexItem>

            <FlexItem>
              <span style={{ color: 'var(--pf-v6-global--Color--200)', fontSize: '0.875rem', marginRight: '0.5rem' }}>
                Search:
              </span>
              <SearchInput
                placeholder="filter"
                value={search}
                onChange={(_, val) => setSearch(val)}
                onClear={() => setSearch('')}
                style={{ width: '14rem' }}
              />
            </FlexItem>

            <FlexItem>
              <Switch
                id="logs-autorefresh"
                label="Auto-refresh"
                isChecked={autoRefresh}
                onChange={(_, val) => setAutoRefresh(val)}
              />
            </FlexItem>

            <FlexItem>
              <Button variant="secondary" size="sm" onClick={refresh} isDisabled={loading}>
                ↺ Refresh
              </Button>
            </FlexItem>

            <FlexItem align={{ default: 'alignRight' }} style={{ marginLeft: 'auto' }}>
              <span style={{ color: 'var(--pf-v6-global--Color--200)', fontSize: '0.8rem' }}>
                {logFile ? `Watching: ${logFile}` : 'No log file found'}
                {filtered.length > 0 && `  ·  ${filtered.length} entries`}
              </span>
            </FlexItem>
          </Flex>

          {/* ── Log output ── */}
          <div style={{
            background:   '#0d1117',
            border:       '1px solid var(--pf-v6-global--BorderColor--100, #333)',
            borderRadius: '4px',
            padding:      '0.75rem 1rem',
            minHeight:    '400px',
            maxHeight:    '60vh',
            overflowY:    'auto',
          }}>
            {loading && <Spinner aria-label="Loading logs" size="sm" />}
            {!loading && filtered.length === 0 && (
              <span style={{ color: '#6b7280', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                No log entries match the current filter.
              </span>
            )}
            {filtered.map(line => (
              <LogLine key={line.id} line={line} />
            ))}
            <div ref={bottomRef} />
          </div>

        </CardBody>
      </Card>
    </div>
  );
};
