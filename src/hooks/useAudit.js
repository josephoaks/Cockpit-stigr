// src/hooks/useAudit.js
import { useState, useEffect, useMemo } from 'react';
import { getAuditEntries, parseAuditRules } from '../lib/bridge';

export function shortId(id) {
  const sv = id.match(/(SV-\d+)/);
  if (sv) return sv[1];
  const ssg = id.match(/content_rule_(.+)/);
  if (ssg) return ssg[1].substring(0, 18);
  return id.split('_').pop() ?? id;
}

export function severityColor(sev) {
  switch (sev) {
    case 'high':   return 'red';
    case 'medium': return 'orange';
    case 'low':    return 'gold';
    default:       return 'grey';
  }
}

export function resultColor(result) {
  switch (result) {
    case 'pass':          return 'green';
    case 'fail':          return 'red';
    case 'notapplicable': return 'grey';
    case 'notchecked':    return 'gold';
    default:              return 'grey';
  }
}

// ── CKL builder (client-side) ─────────────────────────────────────────────────

export function buildCkl(entry, rules, hostname) {
  const now     = new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  const profile = entry.profile ?? 'unknown';

  const statusMap = {
    pass:          'NotAFinding',
    fail:          'Open',
    notapplicable: 'Not_Applicable',
    notchecked:    'Not_Reviewed',
    notselected:   'Not_Reviewed',
  };

  const vulns = rules.map(r => {
    const sid    = shortId(r.id);
    const status = statusMap[r.result] ?? 'Not_Reviewed';
    return `    <VULN>
      <STIG_DATA><VULN_ATTRIBUTE>Vuln_Num</VULN_ATTRIBUTE><ATTRIBUTE_DATA>${sid}</ATTRIBUTE_DATA></STIG_DATA>
      <STIG_DATA><VULN_ATTRIBUTE>Severity</VULN_ATTRIBUTE><ATTRIBUTE_DATA>${r.severity}</ATTRIBUTE_DATA></STIG_DATA>
      <STIG_DATA><VULN_ATTRIBUTE>Group_Title</VULN_ATTRIBUTE><ATTRIBUTE_DATA>${sid}</ATTRIBUTE_DATA></STIG_DATA>
      <STIG_DATA><VULN_ATTRIBUTE>Rule_ID</VULN_ATTRIBUTE><ATTRIBUTE_DATA>${r.id}</ATTRIBUTE_DATA></STIG_DATA>
      <STIG_DATA><VULN_ATTRIBUTE>Rule_Ver</VULN_ATTRIBUTE><ATTRIBUTE_DATA>${sid}</ATTRIBUTE_DATA></STIG_DATA>
      <STIG_DATA><VULN_ATTRIBUTE>Rule_Title</VULN_ATTRIBUTE><ATTRIBUTE_DATA>${r.title}</ATTRIBUTE_DATA></STIG_DATA>
      <STIG_DATA><VULN_ATTRIBUTE>Vuln_Discuss</VULN_ATTRIBUTE><ATTRIBUTE_DATA></ATTRIBUTE_DATA></STIG_DATA>
      <STIG_DATA><VULN_ATTRIBUTE>Check_Content</VULN_ATTRIBUTE><ATTRIBUTE_DATA></ATTRIBUTE_DATA></STIG_DATA>
      <STIG_DATA><VULN_ATTRIBUTE>Fix_Text</VULN_ATTRIBUTE><ATTRIBUTE_DATA></ATTRIBUTE_DATA></STIG_DATA>
      <STIG_DATA><VULN_ATTRIBUTE>Documentable</VULN_ATTRIBUTE><ATTRIBUTE_DATA>false</ATTRIBUTE_DATA></STIG_DATA>
      <STIG_DATA><VULN_ATTRIBUTE>Weight</VULN_ATTRIBUTE><ATTRIBUTE_DATA>10.0</ATTRIBUTE_DATA></STIG_DATA>
      <STIG_DATA><VULN_ATTRIBUTE>Class</VULN_ATTRIBUTE><ATTRIBUTE_DATA>Unclass</ATTRIBUTE_DATA></STIG_DATA>
      <STIG_DATA><VULN_ATTRIBUTE>STIGRef</VULN_ATTRIBUTE><ATTRIBUTE_DATA>${profile} :: Version 1, Release: 1</ATTRIBUTE_DATA></STIG_DATA>
      <STIG_DATA><VULN_ATTRIBUTE>TargetKey</VULN_ATTRIBUTE><ATTRIBUTE_DATA></ATTRIBUTE_DATA></STIG_DATA>
      <STATUS>${status}</STATUS>
      <FINDING_DETAILS></FINDING_DETAILS>
      <COMMENTS></COMMENTS>
      <SEVERITY_OVERRIDE></SEVERITY_OVERRIDE>
      <SEVERITY_JUSTIFICATION></SEVERITY_JUSTIFICATION>
    </VULN>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<CHECKLIST>
  <ASSET>
    <ROLE>None</ROLE>
    <ASSET_TYPE>Computing</ASSET_TYPE>
    <HOST_NAME>${hostname}</HOST_NAME>
    <HOST_IP></HOST_IP><HOST_MAC></HOST_MAC><HOST_FQDN></HOST_FQDN>
    <TECH_AREA></TECH_AREA><TARGET_KEY></TARGET_KEY>
    <WEB_OR_DATABASE>false</WEB_OR_DATABASE>
  </ASSET>
  <STIGS><iSTIG>
    <STIG_INFO>
      <SI_DATA><SID_NAME>version</SID_NAME><SID_DATA>1</SID_DATA></SI_DATA>
      <SI_DATA><SID_NAME>classification</SID_NAME><SID_DATA>UNCLASSIFIED</SID_DATA></SI_DATA>
      <SI_DATA><SID_NAME>stigid</SID_NAME><SID_DATA>${profile}</SID_DATA></SI_DATA>
      <SI_DATA><SID_NAME>title</SID_NAME><SID_DATA>${profile}</SID_DATA></SI_DATA>
      <SI_DATA><SID_NAME>releaseinfo</SID_NAME><SID_DATA>Release: 1 Benchmark Date: ${now}</SID_DATA></SI_DATA>
      <SI_DATA><SID_NAME>source</SID_NAME><SID_DATA>STIG.DOD.MIL</SID_DATA></SI_DATA>
    </STIG_INFO>
${vulns}
  </iSTIG></STIGS>
</CHECKLIST>`;
}

export function downloadCkl(ckl, filename) {
  const blob = new Blob([ckl], { type: 'application/xml' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(entries, filename) {
  const cols  = ['timestamp', 'profile', 'trigger', 'high', 'medium', 'low', 'pass'];
  const lines = [
    cols.join(','),
    ...entries.map(e => cols.map(c => JSON.stringify(e[c] ?? '')).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAudit() {
  const [entries,       setEntries]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [profileFilter, setProfileFilter] = useState('ALL');
  const [selected,      setSelected]      = useState(null);   // entry object
  const [detailOpen,    setDetailOpen]    = useState(false);
  const [detailRules,   setDetailRules]   = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [hostname,      setHostname]      = useState('');

  useEffect(() => {
    import('cockpit').then(({ default: cockpit }) => {
      cockpit.spawn(['hostname'], { superuser: 'require' })
        .then(h => setHostname(h.trim()))
        .catch(() => setHostname('unknown'));
    });

    getAuditEntries()
      .then(result => {
        if (result.status === 'ok') setEntries(result.entries);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const profiles = useMemo(() => {
    const set = new Set(entries.map(e => e.profile));
    return ['ALL', ...Array.from(set).sort()];
  }, [entries]);

  const filtered = useMemo(() => {
    if (profileFilter === 'ALL') return entries;
    return entries.filter(e => e.profile === profileFilter);
  }, [entries, profileFilter]);

  const openDetail = async (entry) => {
    setSelected(entry);
    setDetailOpen(true);
    setDetailRules([]);

    // If entry already has rules use them directly
    if (entry.rules && entry.rules.length > 0) {
      setDetailRules(entry.rules);
      return;
    }

    // Otherwise fetch from bridge
    if (entry._xml_path) {
      setDetailLoading(true);
      try {
        const result = await parseAuditRules(entry._xml_path);
        if (result.status === 'ok') setDetailRules(result.rules);
      } catch (e) {
        console.error('parseAuditRules error:', e);
      } finally {
        setDetailLoading(false);
      }
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setSelected(null);
    setDetailRules([]);
  };

  const handleExportCkl = (entry, rules) => {
    const ckl      = buildCkl(entry, rules, hostname);
    const ts       = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `audit_${entry.profile}_${ts}.ckl`;
    downloadCkl(ckl, filename);
  };

  const handleExportCsv = () => {
    const ts       = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `audit_export_${ts}.csv`;
    downloadCsv(filtered, filename);
  };

  const refresh = () => {
    setLoading(true);
    getAuditEntries()
      .then(result => {
        if (result.status === 'ok') setEntries(result.entries);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  return {
    entries, filtered, loading, profiles,
    profileFilter, setProfileFilter,
    selected, detailOpen, detailRules, detailLoading,
    openDetail, closeDetail,
    handleExportCkl,
    handleExportCsv,
    refresh,
    hostname,
  };
}
