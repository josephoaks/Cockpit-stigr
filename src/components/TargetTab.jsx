// src/components/TargetTab.jsx
import React, { useState, useEffect } from 'react';
import {
  Card, CardTitle, CardBody,
  DescriptionList, DescriptionListGroup, DescriptionListTerm, DescriptionListDescription,
  Label, Grid, GridItem, Spinner, EmptyState, EmptyStateBody, Title,
  Button, Flex, FlexItem,
  Modal, ModalHeader, ModalBody, ModalFooter,
  FormGroup, Form,
} from '@patternfly/react-core';
import {
  useTarget,
  complianceBreadcrumb,
  SSG_PROFILES,
  DISA_PROFILES,
} from '../hooks/useTarget';

// ── SimpleSelect ──────────────────────────────────────────────────────────────

function SimpleSelect({ placeholder, options, value, onChange, disabled }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      style={{
        width:        '100%',
        padding:      '0.5rem 0.75rem',
        background:   'var(--pf-v6-global--BackgroundColor--200, #1b1d21)',
        border:       '1px solid var(--pf-v6-global--BorderColor--100, #444)',
        color:        'var(--pf-v6-global--Color--100, #e0e0e0)',
        borderRadius: '4px',
        fontSize:     '0.875rem',
        cursor:       disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <option value="">{placeholder}</option>
      {options.map(o => (
        <option key={o.key} value={o.key}>{o.label}</option>
      ))}
    </select>
  );
}

// ── ScanSummary ───────────────────────────────────────────────────────────────

function ScanSummary({ counts }) {
  return (
    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      <Label color="red"    isCompact>High: {counts.high}</Label>
      <Label color="orange" isCompact>Medium: {counts.medium}</Label>
      <Label color="yellow" isCompact>Low: {counts.low}</Label>
      <Label color="green"  isCompact>Pass: {counts.pass}</Label>
    </div>
  );
}

// ── AuthorityModal ────────────────────────────────────────────────────────────

function AuthorityModal({ isOpen, onClose, currentAuthority, onApply }) {
  const [authorityType, setAuthorityType] = useState('ssg');
  const [profile,       setProfile]       = useState('');

  const profileOptions = authorityType === 'disa' ? DISA_PROFILES : SSG_PROFILES;

  useEffect(() => { setProfile(''); }, [authorityType]);

  const handleApply = () => {
    onApply({ authorityType, profile });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} variant="medium">
      <ModalHeader title="Compliance Settings" />
      <ModalBody>
        <Form>
          <FormGroup label="Authority:">
            <SimpleSelect
              placeholder="Select authority…"
              options={[
                { key: 'ssg',  label: 'SSG Community' },
                { key: 'disa', label: 'DISA STIG' },
              ]}
              value={authorityType}
              onChange={setAuthorityType}
            />
          </FormGroup>
          <FormGroup label="Profile:" style={{ marginTop: '1rem' }}>
            <SimpleSelect
              placeholder="Select…"
              options={profileOptions}
              value={profile}
              onChange={setProfile}
            />
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" onClick={handleApply} isDisabled={!profile}>Apply</Button>
        <Button variant="link"    onClick={onClose}>Cancel</Button>
      </ModalFooter>
    </Modal>
  );
}

// ── ImportModal ───────────────────────────────────────────────────────────────

function ImportModal({ isOpen, onClose, title, onImport }) {
  const [filePath, setFilePath] = useState('');

  return (
    <Modal isOpen={isOpen} onClose={onClose} variant="small">
      <ModalHeader title={title} />
      <ModalBody>
        <p style={{ marginBottom: '0.5rem', color: 'var(--pf-v6-global--Color--200)', fontSize: '0.875rem' }}>
          Enter the full path to the file on this system:
        </p>
        <input
          type="text"
          value={filePath}
          onChange={e => setFilePath(e.target.value)}
          placeholder="/path/to/file.xml"
          style={{
            width:        '100%',
            padding:      '0.5rem',
            background:   'var(--pf-v6-global--BackgroundColor--200, #1b1d21)',
            border:       '1px solid var(--pf-v6-global--BorderColor--100, #444)',
            color:        'var(--pf-v6-global--Color--100, #e0e0e0)',
            borderRadius: '4px',
          }}
        />
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" onClick={() => { onImport(filePath); setFilePath(''); }} isDisabled={!filePath}>
          Import
        </Button>
        <Button variant="link" onClick={onClose}>Cancel</Button>
      </ModalFooter>
    </Modal>
  );
}

// ── TargetTab ─────────────────────────────────────────────────────────────────

export const TargetTab = () => {
  const {
    state, sysInfo, profiles, loading,
    role, env, zone,
    authorityOpen, setAuthorityOpen,
    xccdfOpen,     setXccdfOpen,
    profileOpen,   setProfileOpen,
    handleAuthorityApply,
    handleRoleChange,
    handleEnvChange,
    handleZoneChange,
    handleXccdfImport,
    handleProfileImport,
  } = useTarget();

  if (loading) return <Spinner aria-label="Loading target info" />;

  if (!state) {
    return (
      <EmptyState>
        <Title headingLevel="h4" size="lg">No STIGR state found</Title>
        <EmptyStateBody>
          Run STIGR from the command line to initialize a scan profile for this host.
        </EmptyStateBody>
      </EmptyState>
    );
  }

  const lastScan = state.last_scan ? new Date(state.last_scan).toLocaleString() : 'Never';
  const crumb    = complianceBreadcrumb(state.authority_source);

  return (
    <>
      <Grid hasGutter style={{ padding: '1rem' }}>

        {/* ── Target Selection ── */}
        <GridItem span={12}>
          <Card>
            <CardTitle>Target Selection</CardTitle>
            <CardBody>
              <DescriptionList isHorizontal horizontalTermWidthModifier={{ default: '14ch' }}>
                <DescriptionListGroup>
                  <DescriptionListTerm>Detected</DescriptionListTerm>
                  <DescriptionListDescription>{sysInfo?.os_name ?? '—'}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Hostname</DescriptionListTerm>
                  <DescriptionListDescription>{sysInfo?.hostname ?? '—'}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Compliance</DescriptionListTerm>
                  <DescriptionListDescription>
                    {crumb.mode && <Label color={crumb.modeColor} isCompact>{crumb.mode}</Label>}
                    {crumb.type && (
                      <span style={{ marginLeft: '0.75rem', color: 'var(--pf-v6-global--Color--200)' }}>
                        {crumb.type}
                      </span>
                    )}
                    {crumb.profile && (
                      <span style={{ marginLeft: '0.5rem', color: 'var(--pf-v6-global--Color--200)' }}>
                        — {crumb.profile}
                      </span>
                    )}
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Authority</DescriptionListTerm>
                  <DescriptionListDescription>
                    {state.authority_source ?? '—'}
                    {state.authority_version && (
                      <span style={{ marginLeft: '0.5rem', color: 'var(--pf-v6-global--Color--200)' }}>
                        v{state.authority_version}
                      </span>
                    )}
                  </DescriptionListDescription>
                </DescriptionListGroup>
              </DescriptionList>

              <Flex style={{ marginTop: '1rem' }} gap={{ default: 'gapSm' }}>
                <FlexItem>
                  <Button variant="secondary" size="sm" onClick={() => setAuthorityOpen(true)}>
                    Authority
                  </Button>
                </FlexItem>
                <FlexItem>
                  <Button variant="secondary" size="sm" onClick={() => setXccdfOpen(true)}>
                    Import XCCDF
                  </Button>
                </FlexItem>
                <FlexItem>
                  <Button variant="secondary" size="sm" onClick={() => setProfileOpen(true)}>
                    Import Profile
                  </Button>
                </FlexItem>
              </Flex>
            </CardBody>
          </Card>
        </GridItem>

        {/* ── Server Profile ── */}
        <GridItem span={12}>
          <Card>
            <CardTitle>Server Profile</CardTitle>
            <CardBody>
              <Flex gap={{ default: 'gapMd' }}>
                <FlexItem grow={{ default: 'grow' }}>
                  <SimpleSelect placeholder="Role…"        options={profiles.roles}        value={role} onChange={handleRoleChange} />
                </FlexItem>
                <FlexItem grow={{ default: 'grow' }}>
                  <SimpleSelect placeholder="Environment…" options={profiles.environments} value={env}  onChange={handleEnvChange}  />
                </FlexItem>
                <FlexItem grow={{ default: 'grow' }}>
                  <SimpleSelect placeholder="Zone…"        options={profiles.zones}        value={zone} onChange={handleZoneChange} />
                </FlexItem>
              </Flex>
            </CardBody>
          </Card>
        </GridItem>

        {/* ── Last Scan ── */}
        <GridItem span={12}>
          <Card>
            <CardTitle>Last Scan</CardTitle>
            <CardBody>
              <DescriptionList isHorizontal horizontalTermWidthModifier={{ default: '14ch' }}>
                <DescriptionListGroup>
                  <DescriptionListTerm>Run at</DescriptionListTerm>
                  <DescriptionListDescription>{lastScan}</DescriptionListDescription>
                </DescriptionListGroup>
              </DescriptionList>
              {state.last_scan_results && <ScanSummary counts={state.last_scan_results} />}
            </CardBody>
          </Card>
        </GridItem>

      </Grid>

      <AuthorityModal
        isOpen={authorityOpen}
        onClose={() => setAuthorityOpen(false)}
        currentAuthority={state.authority_source}
        onApply={handleAuthorityApply}
      />
      <ImportModal
        isOpen={xccdfOpen}
        onClose={() => setXccdfOpen(false)}
        title="Import XCCDF"
        onImport={handleXccdfImport}
      />
      <ImportModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        title="Import Profile"
        onImport={handleProfileImport}
      />
    </>
  );
};
