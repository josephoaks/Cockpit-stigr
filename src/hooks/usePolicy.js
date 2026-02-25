// src/hooks/usePolicy.js
import { useState, useEffect, useMemo } from 'react';
import cockpit from 'cockpit';
import { watchState } from '../lib/files';
import { saveDecision } from '../lib/bridge';

const VAR_LIB    = '/var/lib/stigr';
const NS         = 'http://checklists.nist.gov/xccdf/1.2';
const PROFILE_SSG = 'xccdf_org.ssgproject.content_profile_stig';

// ── XML parsing ───────────────────────────────────────────────────────────────

function parseResultsXml(xmlText) {
  const parser      = new DOMParser();
  const doc         = parser.parseFromString(xmlText, 'application/xml');
  const results     = [];
  const ruleResults = doc.getElementsByTagNameNS(NS, 'rule-result');

  for (const rr of ruleResults) {
    const id       = rr.getAttribute('idref') ?? '';
    const severity = rr.getAttribute('severity') ?? 'unknown';
    const resultEl = rr.getElementsByTagNameNS(NS, 'result')[0];
    const result   = resultEl?.textContent?.trim() ?? 'unknown';
    results.push({ id, severity, result, title: shortId(id) });
  }
  return results;
}

async function loadTitleMap(datastreamPath) {
  try {
    const out = await cockpit.spawn(
      ['python3', '-c', `
import sys
from lxml import etree
ns = 'http://checklists.nist.gov/xccdf/1.2'
tree = etree.parse(sys.argv[1])
for rule in tree.findall('.//{%s}Rule' % ns):
    rid = rule.get('id', '')
    t = rule.find('{%s}title' % ns)
    if rid and t is not None and t.text:
        print(rid + '\\t' + t.text.strip().replace('\\n', ' '))
`, datastreamPath],
      { superuser: 'require' }
    );
    const map = {};
    for (const line of out.trim().split('\n')) {
      const tab = line.indexOf('\t');
      if (tab > 0) map[line.substring(0, tab)] = line.substring(tab + 1);
    }
    return map;
  } catch (e) {
    console.error('title map load error:', e);
    return {};
  }
}

// ── Datastream resolution ─────────────────────────────────────────────────────

async function resolveDatastream(state) {
  const gpp = state.generated_profile_path;
  if (gpp) {
    try {
      await cockpit.spawn(['test', '-f', gpp], { superuser: 'require' });
      const filename  = gpp.split('/').pop();
      const profileId = filename.replace(/_ds\.xml$/, '');
      return {
        datastreamPath: `${VAR_LIB}/scap/xml/${state.authority_source}`,
        tailoringPath:  gpp,
        profileId,
        isGenerated:    true,
      };
    } catch {
      // generated file missing — fall through
    }
  }
  return {
    datastreamPath: `${VAR_LIB}/scap/xml/${state.authority_source ?? ''}`,
    tailoringPath:  null,
    profileId:      PROFILE_SSG,
    isGenerated:    false,
  };
}

// ── Exported helpers ──────────────────────────────────────────────────────────

export function shortId(id) {
  const sv = id.match(/(SV-\d+)/);
  if (sv) return sv[1];
  const ssg = id.match(/content_rule_(.+)/);
  if (ssg) return ssg[1].substring(0, 24);
  return id.split('_').pop() ?? id;
}

export function buildConsiderations(finding) {
  const id  = (finding?.id ?? '').toLowerCase();
  const out = [];
  if (id.includes('ssh'))                                out.push("SSH config change — ensure you won't lose remote access");
  if (id.includes('audit'))                              out.push('Audit rule change — auditd restart may be needed');
  if (id.includes('service') || id.includes('systemd'))  out.push('Service restart or system reboot may be required');
  if (id.includes('crypto')  || id.includes('fips'))     out.push('Crypto policy change — verify application compatibility');
  if (id.includes('grub')    || id.includes('boot'))     out.push('Boot/kernel change — reboot required to take effect');
  if (id.includes('pam')     || id.includes('shadow'))   out.push('PAM/auth change — verify login still works');
  return out;
}

export function resultColor(result, decision) {
  if (decision === 'exception') return 'purple';
  if (decision === 'enforce')   return 'blue';
  switch (result) {
    case 'fail':          return 'red';
    case 'pass':          return 'green';
    case 'notapplicable': return 'grey';
    case 'notchecked':    return 'gold';
    default:              return 'grey';
  }
}

export function resultLabel(result, decision) {
  if (decision === 'exception') return 'Exception';
  if (decision === 'enforce')   return 'Enforce';
  switch (result) {
    case 'fail':          return 'Fail';
    case 'pass':          return 'Pass';
    case 'notapplicable': return 'N/A';
    case 'notchecked':    return 'Not Checked';
    default:              return result;
  }
}

export function severityColor(sev) {
  switch (sev) {
    case 'high':   return 'red';
    case 'medium': return 'orange';
    case 'low':    return 'gold';
    default:       return 'grey';
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePolicy() {
  const [findings,        setFindings]        = useState([]);
  const [decisions,       setDecisions]       = useState({});
  const [datastreamPath,  setDatastreamPath]  = useState('');
  const [tailoringPath,   setTailoringPath]   = useState(null);
  const [profileId,       setProfileId]       = useState(PROFILE_SSG);
  const [isGenerated,     setIsGenerated]     = useState(false);
  const [loading,         setLoading]         = useState(true);
  const [selectedRule,    setSelectedRule]    = useState(null);
  const [ruleModalOpen,   setRuleModalOpen]   = useState(false);
  const [scriptModalOpen, setScriptModalOpen] = useState(false);
  const [search,          setSearch]          = useState('');
  const [filterResult,    setFilterResult]    = useState('all');

  useEffect(() => {
    const stop = watchState(async s => {
      if (!s) { setLoading(false); return; }

      setDecisions(s.rules ?? {});

      const resolved = await resolveDatastream(s);
      setDatastreamPath(resolved.datastreamPath);
      setTailoringPath(resolved.tailoringPath);
      setProfileId(resolved.profileId);
      setIsGenerated(resolved.isGenerated);

      try {
        const proc = await cockpit.spawn(
          ['bash', '-c', `ls -t ${VAR_LIB}/results/daemon_*.xml ${VAR_LIB}/results/scan_*.xml 2>/dev/null | head -1`],
          { superuser: 'require' }
        );
        const xmlPath = proc.trim();
        if (!xmlPath) { setLoading(false); return; }

        const [content, titleMap] = await Promise.all([
          cockpit.file(xmlPath, { superuser: 'require' }).read(),
          loadTitleMap(resolved.datastreamPath),
        ]);

        if (content) {
          const parsed = parseResultsXml(content);
          setFindings(parsed.map(f => ({
            ...f,
            title: titleMap[f.id] ?? shortId(f.id),
          })));
        }
      } catch (e) {
        console.error('Policy load error:', e);
      }
      setLoading(false);
    });
    return stop;
  }, []);

  const handleDecision = async (decision) => {
    if (!selectedRule) return;
    const updated = { ...decisions };
    if (decision) updated[selectedRule.id] = decision;
    else delete updated[selectedRule.id];
    setDecisions(updated);
    setRuleModalOpen(false);
    try {
      await saveDecision(selectedRule.id, decision);
    } catch (e) {
      console.error('Failed to save decision:', e);
    }
  };

  const openRule         = (finding) => { setSelectedRule(finding); setRuleModalOpen(true); };
  const openScriptEditor = ()         => { setRuleModalOpen(false); setScriptModalOpen(true); };
  const closeRuleModal   = ()         => setRuleModalOpen(false);
  const closeScriptModal = ()         => setScriptModalOpen(false);

  const filtered = useMemo(() => findings.filter(f => {
    const matchSearch = !search ||
      f.id.toLowerCase().includes(search.toLowerCase()) ||
      f.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filterResult === 'all' || f.result === filterResult;
    return matchSearch && matchFilter;
  }), [findings, search, filterResult]);

  return {
    findings, filtered, decisions, loading,
    datastreamPath, tailoringPath, profileId, isGenerated,
    selectedRule, ruleModalOpen, scriptModalOpen,
    openRule, handleDecision, openScriptEditor,
    closeRuleModal, closeScriptModal,
    search, setSearch, filterResult, setFilterResult,
  };
}
