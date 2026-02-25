// src/hooks/useTarget.js
import { useState, useEffect } from 'react';
import cockpit from 'cockpit';
import { readSystemInfo, watchState } from '../lib/files';
import { saveAuthority, saveProfile } from '../lib/bridge';

// ── YAML parser ───────────────────────────────────────────────────────────────

function parseServerProfiles(text) {
  const roles        = [];
  const environments = [];
  const zones        = [];

  let section  = null;
  let current  = null;
  let gotLabel = false;

  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();

    if (/^roles:/.test(line))        { section = 'roles';        current = null; continue; }
    if (/^environments:/.test(line)) { section = 'environments'; current = null; continue; }
    if (/^zones:/.test(line))        { section = 'zones';        current = null; continue; }
    if (!section) continue;

    const keyMatch = line.match(/^  (\w+):$/);
    if (keyMatch) {
      current  = keyMatch[1];
      gotLabel = false;
      continue;
    }

    const labelMatch = line.match(/^    label:\s+"([^"]+)"/);
    if (labelMatch && current && !gotLabel) {
      const label = labelMatch[1];
      gotLabel    = true;
      if (section === 'roles')        roles.push({ key: current, label });
      if (section === 'environments') environments.push({ key: current, label });
      if (section === 'zones')        zones.push({ key: current, label });
    }
  }

  return { roles, environments, zones };
}

// ── Exported helpers ──────────────────────────────────────────────────────────

export function complianceBreadcrumb(authoritySource) {
  if (!authoritySource) return { mode: null, modeColor: 'grey', type: null, profile: null };
  const src = authoritySource.toLowerCase();
  if (src.includes('stig') || src.includes('disa')) {
    const ver = authoritySource.match(/V(\d+)R(\d+)/i);
    return {
      mode:      'Authoritative',
      modeColor: 'green',
      type:      'DISA SCAP Benchmark',
      profile:   ver ? `V${ver[1]}R${ver[2]}` : null,
    };
  }
  if (src.includes('cis')) {
    return { mode: 'Community', modeColor: 'yellow', type: 'CIS Benchmark', profile: null };
  }
  return { mode: 'Community', modeColor: 'yellow', type: 'SSG Datastream', profile: null };
}

export const SSG_PROFILES = [
  { key: 'xccdf_org.ssgproject.content_profile_cis',                     label: 'CIS' },
  { key: 'xccdf_org.ssgproject.content_profile_cis_server_l1',           label: 'CIS Server L1' },
  { key: 'xccdf_org.ssgproject.content_profile_cis_workstation_l1',      label: 'CIS Workstation L1' },
  { key: 'xccdf_org.ssgproject.content_profile_cis_workstation_l2',      label: 'CIS Workstation L2' },
  { key: 'xccdf_org.ssgproject.content_profile_stig',                    label: 'STIG' },
  { key: 'xccdf_org.ssgproject.content_profile_stig_gui',                label: 'STIG with GUI' },
  { key: 'xccdf_org.ssgproject.content_profile_anssi_bp28_enhanced',     label: 'ANSSI BP28 Enhanced' },
  { key: 'xccdf_org.ssgproject.content_profile_anssi_bp28_high',         label: 'ANSSI BP28 High' },
  { key: 'xccdf_org.ssgproject.content_profile_anssi_bp28_intermediary', label: 'ANSSI BP28 Intermediary' },
  { key: 'xccdf_org.ssgproject.content_profile_anssi_bp28_minimal',      label: 'ANSSI BP28 Minimal' },
];

export const DISA_PROFILES = [
  { key: 'xccdf_mil.disa.stig_profile_MAC-1_Classified', label: 'I - Mission Critical Classified' },
  { key: 'xccdf_mil.disa.stig_profile_MAC-1_Public',     label: 'I - Mission Critical Public' },
  { key: 'xccdf_mil.disa.stig_profile_MAC-1_Sensitive',  label: 'I - Mission Critical Sensitive' },
  { key: 'xccdf_mil.disa.stig_profile_MAC-2_Classified', label: 'II - Mission Support Classified' },
  { key: 'xccdf_mil.disa.stig_profile_MAC-2_Public',     label: 'II - Mission Support Public' },
  { key: 'xccdf_mil.disa.stig_profile_MAC-2_Sensitive',  label: 'II - Mission Support Sensitive' },
  { key: 'xccdf_mil.disa.stig_profile_MAC-3_Classified', label: 'III - Administrative Classified' },
  { key: 'xccdf_mil.disa.stig_profile_MAC-3_Public',     label: 'III - Administrative Public' },
  { key: 'xccdf_mil.disa.stig_profile_MAC-3_Sensitive',  label: 'III - Administrative Sensitive' },
  { key: 'xccdf_mil.disa.stig_profile_CAT_I_Only',       label: 'CAT I Only' },
];

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTarget() {
  const [state,          setState]          = useState(null);
  const [sysInfo,        setSysInfo]        = useState(null);
  const [profiles,       setProfiles]       = useState({ roles: [], environments: [], zones: [] });
  const [loading,        setLoading]        = useState(true);
  const [availableFiles, setAvailableFiles] = useState([]);
  const [authorityOpen,  setAuthorityOpen]  = useState(false);
  const [xccdfOpen,      setXccdfOpen]      = useState(false);
  const [profileOpen,    setProfileOpen]    = useState(false);
  const [role,           setRole]           = useState('');
  const [env,            setEnv]            = useState('');
  const [zone,           setZone]           = useState('');

  useEffect(() => {
    readSystemInfo().then(setSysInfo);

    cockpit.file('/var/lib/stigr/server_profiles.yaml', { superuser: 'require' })
      .read()
      .then(content => {
        if (content) setProfiles(parseServerProfiles(content));
      });

    cockpit.spawn(
      ['bash', '-c', 'ls /var/lib/stigr/scap/xml/*.xml 2>/dev/null | xargs -n1 basename'],
      { superuser: 'require' }
    )
      .then(out => setAvailableFiles(out.trim().split('\n').filter(Boolean)))
      .catch(() => setAvailableFiles([]));

    const stop = watchState(s => {
      setState(s);
      if (s) {
        setRole(s.role ?? '');
        setEnv(s.environment ?? '');
        setZone(s.zone ?? '');
      }
      setLoading(false);
    });
    return stop;
  }, []);

  const handleAuthorityApply = async ({ authorityType, profile }) => {
    try {
      const result = await saveAuthority(authorityType, profile);
      if (result.status !== 'ok') console.error('saveAuthority failed:', result.error);
    } catch (e) {
      console.error('saveAuthority error:', e);
    }
  };

  // Wrap the three setters so each change is persisted immediately
  const handleRoleChange = async (value) => {
    setRole(value);
    try {
      await saveProfile(value, env, zone);
    } catch (e) {
      console.error('saveProfile error:', e);
    }
  };

  const handleEnvChange = async (value) => {
    setEnv(value);
    try {
      await saveProfile(role, value, zone);
    } catch (e) {
      console.error('saveProfile error:', e);
    }
  };

  const handleZoneChange = async (value) => {
    setZone(value);
    try {
      await saveProfile(role, env, value);
    } catch (e) {
      console.error('saveProfile error:', e);
    }
  };

  const handleXccdfImport = (path) => {
    cockpit.spawn(['cp', path, '/var/lib/stigr/scap/xml/'], { superuser: 'require' })
      .catch(err => console.error(err));
    setXccdfOpen(false);
  };

  const handleProfileImport = (path) => {
    cockpit.spawn(['cp', path, '/var/lib/stigr/generated/'], { superuser: 'require' })
      .catch(err => console.error(err));
    setProfileOpen(false);
  };

  return {
    state, sysInfo, profiles, loading, availableFiles,
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
  };
}
