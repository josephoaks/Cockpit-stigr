// src/lib/bridge.js
// Privileged operations via the stigr Python bridge script.
import cockpit from 'cockpit';

const BRIDGE = '/usr/lib/stigr/cockpit-bridge.py';

async function callBridge(payload) {
  const input = JSON.stringify(payload) + '\n';
  const proc  = cockpit.spawn(
    ['python3', BRIDGE],
    { superuser: 'require', err: 'message' }
  );
  proc.input(input);
  const output = await proc;
  return JSON.parse(output);
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function runScan() {
  return callBridge({ action: 'run_scan' });
}

export async function saveDaemonConfig(config) {
  return callBridge({ action: 'save_daemon_config', config });
}

export async function saveDecision(ruleId, decision) {
  return callBridge({ action: 'save_decision', rule_id: ruleId, decision });
}

export async function saveAuthority(authorityType, profile) {
  return callBridge({ action: 'save_authority', authority_type: authorityType, profile });
}

export async function saveProfile(role, environment, zone) {
  return callBridge({ action: 'save_profile', role, environment, zone });
}

export async function getAuditEntries() {
  return callBridge({ action: 'get_audit_entries' });
}

export async function parseAuditRules(xmlPath) {
  return callBridge({ action: 'parse_audit_rules', xml_path: xmlPath });
}
