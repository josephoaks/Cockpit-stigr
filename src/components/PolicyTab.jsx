// src/components/PolicyTab.jsx
import React from 'react';
import {
  Card, CardTitle, CardBody,
  Label, Button, Spinner,
  EmptyState, EmptyStateBody, Title,
  Modal, ModalHeader, ModalBody, ModalFooter,
  Alert,
  SearchInput,
  Toolbar, ToolbarContent, ToolbarItem,
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import cockpit from 'cockpit';
import {
  usePolicy,
  shortId, resultColor, resultLabel, severityColor, buildConsiderations,
} from '../hooks/usePolicy';

const VAR_LIB = '/var/lib/stigr';

// ── ScriptModal ───────────────────────────────────────────────────────────────

const ScriptModal = ({ isOpen, onClose, finding, datastreamPath, profileId }) => {
  const [script,  setScript]  = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [saving,  setSaving]  = React.useState(false);
  const [error,   setError]   = React.useState('');

  React.useEffect(() => {
    if (!isOpen || !finding) return;
    setLoading(true);
    setError('');

    const customPath = `${VAR_LIB}/custom_scripts/${finding.id}.sh`;
    cockpit.file(customPath, { superuser: 'require' })
      .read()
      .then(content => {
        if (content) { setScript(content); setLoading(false); return; }
        return cockpit.spawn(
          ['oscap', 'xccdf', 'generate', 'fix',
           '--fix-type', 'bash',
           '--profile', profileId,
           '--rule', finding.id,
           datastreamPath],
          { superuser: 'require' }
        ).then(out => { setScript(out); setLoading(false); });
      })
      .catch(err => { setError(`Failed to load script: ${err.message ?? err}`); setLoading(false); });
  }, [isOpen, finding?.id]);

  const handleSave = async () => {
    setSaving(true);
    setError('');

    const scriptPath = `${VAR_LIB}/custom_scripts/${finding.id}.sh`;
    const xccdfPath  = `${VAR_LIB}/custom_scripts/${finding.id}.xccdf.xml`;

    try {
      // 1. Write the script file
      await cockpit.file(scriptPath, { superuser: 'require' }).replace(script);

      // 2. chmod 700
      await cockpit.spawn(['chmod', '700', scriptPath], { superuser: 'require' });

      // 3. Get original fix from datastream for audit file
      const originalFix = await cockpit.spawn(
        ['oscap', 'xccdf', 'generate', 'fix',
         '--fix-type', 'bash',
         '--profile', profileId,
         '--rule', finding.id,
         datastreamPath],
        { superuser: 'require' }
      ).catch(() => '');

      // 4. Get current user for audit trail
      const whoami = await cockpit.spawn(['whoami'], { superuser: 'require' }).catch(() => 'unknown');
      const username  = whoami.trim();
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

      // 5. Write xccdf audit file matching TUI format
      const xccdfContent = [
        `<!-- Original XCCDF fix for ${finding.id} -->`,
        `<!-- Modified by: ${username} -->`,
        `<!-- Modified on: ${timestamp} -->`,
        `<!-- Preserved for audit -->`,
        `<fix system="urn:xccdf:fix:script:sh" id="${finding.id}">`,
        originalFix,
        `</fix>`,
      ].join('\n');

      await cockpit.file(xccdfPath, { superuser: 'require' }).replace(xccdfContent);

      setSaving(false);
      onClose();
    } catch (err) {
      setError(`Save failed: ${err.message ?? err}`);
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} variant="large">
      <ModalHeader title={`Editing Remediation Script — ${shortId(finding?.id ?? '')}`} />
      <ModalBody>
        {error && <Alert variant="danger" title={error} style={{ marginBottom: '1rem' }} />}
        {loading
          ? <Spinner aria-label="Loading script" />
          : <textarea
              value={script}
              onChange={e => setScript(e.target.value)}
              rows={24}
              style={{
                width: '100%', fontFamily: 'monospace', fontSize: '0.8rem',
                background: 'var(--pf-v6-global--BackgroundColor--200, #1b1d21)',
                color: 'var(--pf-v6-global--Color--100, #e0e0e0)',
                border: '1px solid var(--pf-v6-global--BorderColor--100, #444)',
                borderRadius: '4px', padding: '0.75rem', resize: 'vertical',
              }}
            />
        }
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" onClick={handleSave} isLoading={saving} isDisabled={loading || saving}>
          Save Changes
        </Button>
        <Button variant="link" onClick={onClose}>Cancel</Button>
      </ModalFooter>
    </Modal>
  );
};

// ── RuleModal ─────────────────────────────────────────────────────────────────

const RuleModal = ({ isOpen, onClose, finding, decision, onDecision, onEditScript }) => {
  if (!finding) return null;
  const considerations = buildConsiderations(finding);

  return (
    <Modal isOpen={isOpen} onClose={onClose} variant="medium">
      <ModalHeader title={shortId(finding.id)} />
      <ModalBody>
        <dl style={{ display: 'grid', gridTemplateColumns: '8rem 1fr', gap: '0.4rem 1rem', marginBottom: '1rem' }}>
          <dt><strong>Rule</strong></dt>   <dd>{shortId(finding.id)}</dd>
          <dt><strong>Title</strong></dt>  <dd>{finding.title}</dd>
          <dt><strong>Severity</strong></dt>
          <dd><Label color={severityColor(finding.severity)} isCompact>{finding.severity.toUpperCase()}</Label></dd>
          <dt><strong>Status</strong></dt>
          <dd><Label color={resultColor(finding.result, decision)} isCompact>{resultLabel(finding.result, decision)}</Label></dd>
        </dl>

        {considerations.length > 0 && (
          <Alert variant="warning" title="Considerations:" style={{ marginBottom: '1rem' }}>
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {considerations.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </Alert>
        )}

        <p><strong>Choose an action:</strong></p>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          <Button variant="primary"   onClick={() => onDecision('enforce')}>Enforce</Button>
          <Button variant="danger"    onClick={() => onDecision('exception')}>Exception</Button>
          <Button variant="secondary" onClick={() => onDecision('')}>Skip</Button>
          <Button variant="secondary" onClick={onEditScript}>✎ Edit Script</Button>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="link" onClick={onClose}>Close</Button>
      </ModalFooter>
    </Modal>
  );
};

// ── PolicyTab ─────────────────────────────────────────────────────────────────

export const PolicyTab = () => {
  const {
    filtered, findings, decisions, loading,
    datastreamPath, tailoringPath, profileId, isGenerated,
    selectedRule, ruleModalOpen, scriptModalOpen,
    openRule, handleDecision, openScriptEditor,
    closeRuleModal, closeScriptModal,
    search, setSearch, filterResult, setFilterResult,
  } = usePolicy();

  if (loading) return <Spinner aria-label="Loading policy" />;

  if (!findings.length) {
    return (
      <EmptyState>
        <Title headingLevel="h4" size="lg">No scan results found</Title>
        <EmptyStateBody>Run a scan from the Target tab or via the daemon to populate findings.</EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <>
      <Card style={{ margin: '1rem' }}>
        <CardTitle>
          Policy Status
          <Button variant="primary" size="sm" style={{ float: 'right' }}
            onClick={() => console.log('Rescan — TODO: wire to bridge')}>
            Rescan
          </Button>
        </CardTitle>
        <CardBody style={{ padding: 0 }}>
          <Toolbar style={{ padding: '0.5rem 1rem' }}>
            <ToolbarContent>
              <ToolbarItem>
                <SearchInput
                  placeholder="Search rules…"
                  value={search}
                  onChange={(_, val) => setSearch(val)}
                  onClear={() => setSearch('')}
                />
              </ToolbarItem>
              <ToolbarItem>
                <select
                  value={filterResult}
                  onChange={e => setFilterResult(e.target.value)}
                  style={{
                    padding: '0.4rem 0.6rem',
                    background: 'var(--pf-v6-global--BackgroundColor--200, #1b1d21)',
                    border: '1px solid var(--pf-v6-global--BorderColor--100, #444)',
                    color: 'var(--pf-v6-global--Color--100, #e0e0e0)',
                    borderRadius: '4px', fontSize: '0.875rem',
                  }}
                >
                  <option value="all">All results</option>
                  <option value="fail">Fail</option>
                  <option value="pass">Pass</option>
                  <option value="notchecked">Not Checked</option>
                  <option value="notapplicable">N/A</option>
                </select>
              </ToolbarItem>
              <ToolbarItem align={{ default: 'alignEnd' }}>
                <span style={{ color: 'var(--pf-v6-global--Color--200)', fontSize: '0.875rem' }}>
                  {filtered.length} / {findings.length} rules
                </span>
              </ToolbarItem>
            </ToolbarContent>
          </Toolbar>

          <Table aria-label="Policy findings" variant="compact">
            <Thead>
              <Tr>
                <Th>Rule ID</Th>
                <Th>Title</Th>
                <Th>Severity</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.map(f => {
                const dec = decisions[f.id] ?? '';
                return (
                  <Tr key={f.id} onRowClick={() => openRule(f)} style={{ cursor: 'pointer' }}>
                    <Td dataLabel="Rule ID"><code style={{ fontSize: '0.8rem' }}>{shortId(f.id)}</code></Td>
                    <Td dataLabel="Title">{f.title}</Td>
                    <Td dataLabel="Severity"><Label color={severityColor(f.severity)} isCompact>{f.severity}</Label></Td>
                    <Td dataLabel="Status"><Label color={resultColor(f.result, dec)} isCompact>{resultLabel(f.result, dec)}</Label></Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </CardBody>
      </Card>

      <RuleModal
        isOpen={ruleModalOpen}
        onClose={closeRuleModal}
        finding={selectedRule}
        decision={decisions[selectedRule?.id] ?? ''}
        onDecision={handleDecision}
        onEditScript={openScriptEditor}
      />
      <ScriptModal
        isOpen={scriptModalOpen}
        onClose={closeScriptModal}
        finding={selectedRule}
        datastreamPath={datastreamPath}
        tailoringPath={tailoringPath}
      	profileId={profileId}
      />
    </>
  );
};
