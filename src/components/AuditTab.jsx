// src/components/AuditTab.jsx
import React from 'react';
import {
  Card, CardTitle, CardBody,
  Grid, GridItem, Spinner,
  Button, Flex, FlexItem,
  Label,
  Modal, ModalHeader, ModalBody, ModalFooter,
  EmptyState, EmptyStateBody, Title,
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import {
  useAudit,
  shortId,
  severityColor,
  resultColor,
} from '../hooks/useAudit';

// ── SimpleSelect ──────────────────────────────────────────────────────────────

function SimpleSelect({ options, value, onChange }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding:      '0.4rem 0.6rem',
        background:   'var(--pf-v6-global--BackgroundColor--200, #1b1d21)',
        border:       '1px solid var(--pf-v6-global--BorderColor--100, #444)',
        color:        'var(--pf-v6-global--Color--100, #e0e0e0)',
        borderRadius: '4px',
        fontSize:     '0.875rem',
      }}
    >
      {options.map(o => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

// ── ScanCounts ────────────────────────────────────────────────────────────────

function ScanCounts({ entry, compact = false }) {
  const total = entry.high + entry.medium + entry.low + entry.pass;
  return (
    <span style={{ display: 'inline-flex', gap: compact ? '0.4rem' : '0.6rem', alignItems: 'center' }}>
      <Label color="red"    isCompact>H: {entry.high}</Label>
      <Label color="orange" isCompact>M: {entry.medium}</Label>
      <Label color="gold"   isCompact>L: {entry.low}</Label>
      <Label color="green"  isCompact>P: {entry.pass}</Label>
      {!compact && (
        <span style={{ color: 'var(--pf-v6-global--Color--200)', fontSize: '0.8rem' }}>
          / {total}
        </span>
      )}
    </span>
  );
}

// ── DetailModal ───────────────────────────────────────────────────────────────

function DetailModal({ isOpen, onClose, entry, rules, rulesLoading, onExportCkl }) {
  if (!entry) return null;

  const total = entry.high + entry.medium + entry.low + entry.pass;

  return (
    <Modal isOpen={isOpen} onClose={onClose} variant="large">
      <ModalHeader title="Audit Entry Detail" />
      <ModalBody>

        {/* ── Summary ── */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: '10rem 1fr',
          gap:                 '0.2rem 1rem',
          marginBottom:        '1rem',
          fontSize:            '0.875rem',
        }}>
          <span style={{ color: 'var(--pf-v6-global--Color--200)' }}>Timestamp</span>
          <span>{entry.timestamp}</span>
          <span style={{ color: 'var(--pf-v6-global--Color--200)' }}>Profile</span>
          <span>{entry.profile}</span>
          <span style={{ color: 'var(--pf-v6-global--Color--200)' }}>Trigger</span>
          <span>{entry.trigger}</span>
          <span style={{ color: 'var(--pf-v6-global--Color--200)' }}>Source</span>
          <span>{entry._source}</span>
          <span style={{ color: 'var(--pf-v6-global--Color--200)' }}>Results</span>
          <span>
            <ScanCounts entry={entry} />
            <span style={{ marginLeft: '0.5rem', color: 'var(--pf-v6-global--Color--200)', fontSize: '0.8rem' }}>
              Total: {total}
            </span>
          </span>
        </div>

        {/* ── Rule table ── */}
        <div style={{
          borderTop:   '1px solid var(--pf-v6-global--BorderColor--100, #444)',
          paddingTop:  '0.75rem',
          marginTop:   '0.25rem',
        }}>
          <p style={{
            fontSize:     '0.8rem',
            color:        'var(--pf-v6-global--Color--200)',
            marginBottom: '0.5rem',
            fontWeight:   600,
          }}>
            Findings
          </p>

          {rulesLoading && <Spinner aria-label="Loading rules" size="sm" />}

          {!rulesLoading && rules.length === 0 && (
            <p style={{ color: 'var(--pf-v6-global--Color--200)', fontSize: '0.8rem' }}>
              No per-rule data available for this entry.
            </p>
          )}

          {!rulesLoading && rules.length > 0 && (
            <div style={{ maxHeight: '45vh', overflowY: 'auto' }}>
              <Table aria-label="Findings" variant="compact">
                <Thead>
                  <Tr>
                    <Th>Rule</Th>
                    <Th>Title</Th>
                    <Th>Severity</Th>
                    <Th>Result</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {rules.map((r, i) => (
                    <Tr key={i}>
                      <Td dataLabel="Rule">
                        <code style={{ fontSize: '0.8rem' }}>{shortId(r.id)}</code>
                      </Td>
                      <Td dataLabel="Title" style={{ fontSize: '0.8rem' }}>{r.title}</Td>
                      <Td dataLabel="Severity">
                        <Label color={severityColor(r.severity)} isCompact>{r.severity}</Label>
                      </Td>
                      <Td dataLabel="Result">
                        <Label color={resultColor(r.result)} isCompact>{r.result}</Label>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          onClick={() => onExportCkl(entry, rules)}
          isDisabled={rulesLoading}
        >
          Export CKL
        </Button>
        <Button variant="link" onClick={onClose}>Close</Button>
      </ModalFooter>
    </Modal>
  );
}

// ── AuditTab ──────────────────────────────────────────────────────────────────

export const AuditTab = () => {
  const {
    filtered, loading, profiles,
    profileFilter, setProfileFilter,
    selected, detailOpen, detailRules, detailLoading,
    openDetail, closeDetail,
    handleExportCkl,
    handleExportCsv,
    refresh,
  } = useAudit();

  if (loading) return <Spinner aria-label="Loading audit trail" />;

  return (
    <>
      <Grid hasGutter style={{ padding: '1rem' }}>

        {/* ── Toolbar ── */}
        <GridItem span={12}>
          <Card>
            <CardBody>
              <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapMd' }}>
                <FlexItem>
                  <span style={{ color: 'var(--pf-v6-global--Color--200)', fontSize: '0.875rem', marginRight: '0.5rem' }}>
                    Profile:
                  </span>
                  <SimpleSelect
                    options={profiles}
                    value={profileFilter}
                    onChange={setProfileFilter}
                  />
                </FlexItem>
                <FlexItem align={{ default: 'alignRight' }} style={{ marginLeft: 'auto' }}>
                  <Flex gap={{ default: 'gapSm' }}>
                    <FlexItem>
                      <Button variant="secondary" size="sm" onClick={refresh}>
                        ↺ Refresh
                      </Button>
                    </FlexItem>
                    <FlexItem>
                      <Button variant="secondary" size="sm" onClick={handleExportCsv} isDisabled={!filtered.length}>
                        Export CSV
                      </Button>
                    </FlexItem>
                  </Flex>
                </FlexItem>
              </Flex>
            </CardBody>
          </Card>
        </GridItem>

        {/* ── Table ── */}
        <GridItem span={12}>
          <Card>
            <CardTitle>
              Scan History
              <span style={{ float: 'right', color: 'var(--pf-v6-global--Color--200)', fontSize: '0.8rem', fontWeight: 400 }}>
                {filtered.length} entries
              </span>
            </CardTitle>
            <CardBody style={{ padding: 0 }}>
              {filtered.length === 0 ? (
                <EmptyState style={{ padding: '2rem' }}>
                  <Title headingLevel="h4" size="lg">No audit entries found</Title>
                  <EmptyStateBody>
                    Run a scan to populate the audit trail.
                  </EmptyStateBody>
                </EmptyState>
              ) : (
                <Table aria-label="Audit trail" variant="compact">
                  <Thead>
                    <Tr>
                      <Th>Timestamp</Th>
                      <Th>Profile</Th>
                      <Th>Trigger</Th>
                      <Th>Results</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {filtered.map((e, i) => (
                      <Tr
                        key={i}
                        onRowClick={() => openDetail(e)}
                        style={{
                          cursor:  'pointer',
                          opacity: e._source === 'xml' ? 0.75 : 1,
                        }}
                      >
                        <Td dataLabel="Timestamp">
                          <code style={{ fontSize: '0.8rem' }}>{e.timestamp}</code>
                        </Td>
                        <Td dataLabel="Profile">{e.profile}</Td>
                        <Td dataLabel="Trigger">
                          <span style={{ color: 'var(--pf-v6-global--Color--200)', fontSize: '0.8rem' }}>
                            {e.trigger}
                          </span>
                        </Td>
                        <Td dataLabel="Results">
                          <ScanCounts entry={e} compact />
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              )}
            </CardBody>
          </Card>
        </GridItem>

      </Grid>

      <DetailModal
        isOpen={detailOpen}
        onClose={closeDetail}
        entry={selected}
        rules={detailRules}
        rulesLoading={detailLoading}
        onExportCkl={handleExportCkl}
      />
    </>
  );
};
