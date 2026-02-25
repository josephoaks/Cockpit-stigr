// src/app.jsx
import React from 'react';
import {
  Tabs,
  Tab,
  TabTitleText,
} from '@patternfly/react-core';
import './app.scss';
import { TargetTab }    from './components/TargetTab';
import { PolicyTab }    from './components/PolicyTab';
import { DaemonTab }    from './components/DaemonTab';
import { LogsTab }      from './components/LogsTab';
import { AuditTab }     from './components/AuditTab';

export const Application = () => {
  const [activeTabKey, setActiveTabKey] = React.useState(0);

  const handleTabClick = (event, tabIndex) => {
    setActiveTabKey(tabIndex);
  };

  React.useEffect(() => {
    const handleNavigate = (event) => {
      setActiveTabKey(event.detail.tabIndex);
    };
    window.addEventListener('navigate-to-tab', handleNavigate);
    return () => window.removeEventListener('navigate-to-tab', handleNavigate);
  }, []);

  return (
    <Tabs
      activeKey={activeTabKey}
      onSelect={handleTabClick}
      aria-label="STIGR Compliance Tabs"
      role="region"
    >
      <Tab eventKey={0} title={<TabTitleText>Target</TabTitleText>} aria-label="Target">
        <TargetTab />
      </Tab>
      <Tab eventKey={1} title={<TabTitleText>Policy</TabTitleText>} aria-label="Policy">
        <PolicyTab />
      </Tab>
      <Tab eventKey={2} title={<TabTitleText>Daemon</TabTitleText>} aria-label="Daemon">
        <DaemonTab />
      </Tab>
      <Tab eventKey={3} title={<TabTitleText>Logs</TabTitleText>} aria-label="Logs">
        <LogsTab />
      </Tab>
      <Tab eventKey={4} title={<TabTitleText>Audit Trail</TabTitleText>} aria-label="Audit Trail">
        <AuditTab />
      </Tab>
    </Tabs>
  );
};
