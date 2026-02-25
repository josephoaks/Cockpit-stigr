// src/components/DaemonTab.jsx
import React from 'react';
import {
  Card, CardTitle, CardBody,
  DescriptionList, DescriptionListGroup, DescriptionListTerm, DescriptionListDescription,
  Label, Grid, GridItem, Spinner,
  Button, Flex, FlexItem,
  Switch,
  Alert,
} from '@patternfly/react-core';
import {
  useDaemon,
  FREQUENCY_OPTIONS,
  DAY_OPTIONS,
  TIME_OPTIONS,
} from '../hooks/useDaemon';

function SimpleSelect({ options, value, onChange, disabled, placeholder }) {
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
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => (
        <option key={o.key} value={o.key}>{o.label}</option>
      ))}
    </select>
  );
}

export const DaemonTab = () => {
  const {
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
  } = useDaemon();

  if (loading) return <Spinner aria-label="Loading daemon config" />;

  return (
    <Grid hasGutter style={{ padding: '1rem' }}>

      <GridItem span={12}>
        <Card>
          <CardTitle>Compliance Scan Daemon</CardTitle>
          <CardBody>
            <DescriptionList isHorizontal horizontalTermWidthModifier={{ default: '10ch' }}
              style={{ marginBottom: '1.25rem' }}>
              <DescriptionListGroup>
                <DescriptionListTerm>Status</DescriptionListTerm>
                <DescriptionListDescription>
                  <Label color={timerActive ? 'green' : 'gold'} isCompact>
                    {timerActive ? 'Active' : 'Disabled'}
                  </Label>
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Last run</DescriptionListTerm>
                <DescriptionListDescription style={{ color: 'var(--pf-v6-global--Color--200)' }}>
                  {lastRun ?? 'Never'}
                </DescriptionListDescription>
              </DescriptionListGroup>
            </DescriptionList>

            <Flex gap={{ default: 'gapXl' }}>
              <FlexItem>
                <Switch
                  id="daemon-enabled"
                  label="Enable"
                  isChecked={enabled}
                  onChange={(_, val) => setEnabled(val)}
                />
              </FlexItem>
              <FlexItem>
                <Switch
                  id="daemon-notify-new"
                  label="New findings"
                  isChecked={notifyNew}
                  onChange={(_, val) => setNotifyNew(val)}
                />
              </FlexItem>
              <FlexItem>
                <Switch
                  id="daemon-notify-regression"
                  label="Regression"
                  isChecked={notifyRegression}
                  onChange={(_, val) => setNotifyRegression(val)}
                />
              </FlexItem>
            </Flex>

            {scanError && (
              <Alert variant="danger" title={scanError} isInline style={{ marginTop: '1rem' }} />
            )}

            <div style={{ marginTop: '1.25rem' }}>
              <Button
                variant="secondary"
                onClick={handleRunScan}
                isLoading={scanning}
                isDisabled={scanning || saving}
              >
                Run Scan Now
              </Button>
            </div>
          </CardBody>
        </Card>
      </GridItem>

      <GridItem span={12}>
        <Card>
          <CardTitle>Schedule</CardTitle>
          <CardBody>
            <Flex gap={{ default: 'gapMd' }} style={{ marginBottom: '1.25rem' }}>
              <FlexItem grow={{ default: 'grow' }}>
                <SimpleSelect
                  options={FREQUENCY_OPTIONS}
                  value={frequency}
                  onChange={setFrequency}
                  disabled={!enabled}
                  placeholder="Scan Frequency"
                />
              </FlexItem>
              <FlexItem grow={{ default: 'grow' }}>
                <SimpleSelect
                  options={DAY_OPTIONS}
                  value={day}
                  onChange={setDay}
                  disabled={!enabled || frequency === 'daily'}
                  placeholder="Day of Week"
                />
              </FlexItem>
              <FlexItem grow={{ default: 'grow' }}>
                <SimpleSelect
                  options={TIME_OPTIONS}
                  value={time}
                  onChange={setTime}
                  disabled={!enabled}
                  placeholder="Run Time (UTC)"
                />
              </FlexItem>
            </Flex>

            {saveError && (
              <Alert variant="danger" title={saveError} isInline style={{ marginBottom: '1rem' }} />
            )}

            <Button
              variant="primary"
              onClick={handleSave}
              isLoading={saving}
              isDisabled={saving || scanning}
            >
              Save
            </Button>
          </CardBody>
        </Card>
      </GridItem>

    </Grid>
  );
};
