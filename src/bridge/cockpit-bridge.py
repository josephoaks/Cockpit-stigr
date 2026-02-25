#!/usr/bin/env python3
# /usr/lib/stigr/cockpit-bridge.py
import json
import sys
import subprocess
import xml.etree.ElementTree as ET
import re as _re
from pathlib import Path
from datetime import datetime, timezone

GENERATED_DIR  = Path("/var/lib/stigr/generated")
DAEMON_CONFIG  = Path("/etc/stigr/daemon.conf")
SCAP_XML_DIR   = Path("/var/lib/stigr/scap/xml")
RESULTS_DIR    = Path("/var/lib/stigr/results")
UTC            = timezone.utc


def find_state_file() -> Path | None:
    files = sorted(GENERATED_DIR.glob("stigr_*_state.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    return files[0] if files else None


def read_state(path: Path) -> dict:
    with open(path) as f:
        return json.load(f)


def write_state(path: Path, state: dict) -> None:
    with open(path, "w") as f:
        json.dump(state, f, indent=2)


def run_scan(datastream: Path, profile: str, results_file: Path) -> dict:
    cmd = [
        "oscap", "xccdf", "eval",
        "--results", str(results_file),
        "--profile", profile,
        str(datastream),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    return {"returncode": result.returncode, "stderr": result.stderr}


def parse_counts(results_file: Path) -> dict:
    import xml.etree.ElementTree as ET
    import re

    NS     = "http://checklists.nist.gov/xccdf/1.2"
    counts = {"high": 0, "medium": 0, "low": 0, "pass": 0, "rules": []}

    def _clean(rule_id: str) -> str:
        short = rule_id.replace("xccdf_org.ssgproject.content_rule_", "")
        return short.replace("_", " ").title()

    try:
        tree = ET.parse(str(results_file))
        root = tree.getroot()

        sev_map:   dict[str, str] = {}
        title_map: dict[str, str] = {}
        for rule_el in root.iter(f"{{{NS}}}Rule"):
            rid = rule_el.get("id", "")
            if rid:
                sev_map[rid] = rule_el.get("severity", "unknown")
                t = rule_el.find(f"{{{NS}}}title")
                if t is not None and t.text:
                    title_map[rid] = t.text.strip()

        for rr in root.iter(f"{{{NS}}}rule-result"):
            rule_id   = rr.get("idref", "")
            result_el = rr.find(f"{{{NS}}}result")
            if result_el is None:
                continue
            result = (result_el.text or "").strip()
            if not result:
                continue

            severity = sev_map.get(rule_id, rr.get("severity", "unknown"))
            title    = title_map.get(rule_id, _clean(rule_id))

            if result == "pass":
                counts["pass"] += 1
                counts["pass"].append({
                    "id":       rule_id,
                    "title":    title_map.get(rule_id, _clean(rule_id)),
                    "result":   result,
                    "severity": sev_map.get(rule.id, "unknown"),
                })
            elif result == "fail":
                if severity == "high":   counts["high"]   += 1
                elif severity == "medium": counts["medium"] += 1
                elif severity == "low":    counts["low"]    += 1
                counts["rules"].append({
                    "id": rule_id, "title": title,
                    "result": result, "severity": severity,
                })
            elif result in ("notapplicable", "notchecked", "notselected"):
                counts["rules"].append({
                    "id": rule_id, "title": title,
                    "result": result, "severity": "unknown",
                })
    except Exception:
        pass

    return counts


# ── Actions ───────────────────────────────────────────────────────────────────

def action_run_scan(payload: dict) -> dict:
    state_path = find_state_file()
    if not state_path:
        return {"status": "error", "error": "No state file found"}

    state = read_state(state_path)

    gpp = state.get("generated_profile_path")
    if gpp and Path(gpp).exists():
        datastream  = Path(gpp)
        profile_arg = "xccdf_stigr_profile_custom"
    else:
        datastream_name = state.get("authority_source", "")
        datastream      = SCAP_XML_DIR / datastream_name
        profile_arg     = "xccdf_org.ssgproject.content_profile_stig"

    if not datastream.exists():
        return {"status": "error", "error": f"Datastream not found: {datastream}"}

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    ts           = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    results_file = RESULTS_DIR / f"daemon_{ts}.xml"

    scan = run_scan(datastream, profile_arg, results_file)

    if not results_file.exists():
        return {"status": "error", "error": f"Scan failed (rc={scan['returncode']}): {scan['stderr'][:200]}"}

    counts = parse_counts(results_file)
    now    = datetime.now(UTC).isoformat()

    state.setdefault("audit_log", []).append({
        "timestamp": now,
        "trigger":   "cockpit",
        "results": {
            "high":   counts["high"],
            "medium": counts["medium"],
            "low":    counts["low"],
            "pass":   counts["pass"],
        },
        "rules":        counts.get("rules", []),
        "results_file": str(results_file),
    })

    state["last_scan"]         = now
    state["last_scan_results"] = {
        "high":   counts["high"],
        "medium": counts["medium"],
        "low":    counts["low"],
        "pass":   counts["pass"],
    }

    write_state(state_path, state)
    return {"status": "ok", "results_file": str(results_file), "counts": counts}


def action_save_daemon_config(payload: dict) -> dict:
    config = payload.get("config", {})
    DAEMON_CONFIG.parent.mkdir(parents=True, exist_ok=True)

    lines = [f"{key}={value}" for key, value in config.items()]

    try:
        DAEMON_CONFIG.write_text("\n".join(lines) + "\n")

        enabled = config.get("enabled", "false") == "true"
        action  = "enable" if enabled else "disable"
        subprocess.run(["systemctl", action, "--now", "stigr-scan.timer"],
                       capture_output=True)
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def action_save_decision(payload: dict) -> dict:
    rule_id  = payload.get("rule_id", "")
    decision = payload.get("decision", "")

    if not rule_id:
        return {"status": "error", "error": "rule_id required"}

    state_path = find_state_file()
    if not state_path:
        return {"status": "error", "error": "No state file found"}

    try:
        state = read_state(state_path)

        if not isinstance(state.get("rules"), dict):
            state["rules"] = {}

        if decision:
            state["rules"][rule_id] = decision
        else:
            state["rules"].pop(rule_id, None)

        state.setdefault("audit_log", []).append({
            "timestamp": datetime.now(UTC).isoformat(),
            "action":    "decision",
            "rule_id":   rule_id,
            "decision":  decision or "cleared",
            "source":    "cockpit",
        })

        write_state(state_path, state)
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def action_save_authority(payload: dict) -> dict:
    authority_type = payload.get("authority_type", "")
    profile        = payload.get("profile", "")

    if not authority_type or not profile:
        return {"status": "error", "error": "authority_type and profile required"}

    state_path = find_state_file()
    if not state_path:
        return {"status": "error", "error": "No state file found"}

    try:
        state  = read_state(state_path)
        os_id  = state.get("os_id", "rhel9")

        if authority_type == "disa":
            state["authority_source"] = f"U_{os_id.upper()}_STIG_SCAP_1-3_Benchmark.xml"
        else:
            state["authority_source"] = f"ssg-{os_id}-ds.xml"

        state["base_profile"] = profile
        state.pop("generated_profile_path", None)

        state.setdefault("audit_log", []).append({
            "timestamp":      datetime.now(UTC).isoformat(),
            "action":         "set_authority",
            "authority_type": authority_type,
            "profile":        profile,
            "source":         "cockpit",
        })

        write_state(state_path, state)
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def action_save_profile(payload: dict) -> dict:
    role        = payload.get("role", "")
    environment = payload.get("environment", "")
    zone        = payload.get("zone", "")

    state_path = find_state_file()
    if not state_path:
        return {"status": "error", "error": "No state file found"}

    try:
        state = read_state(state_path)

        if role:        state["role"]        = role
        if environment: state["environment"] = environment
        if zone:        state["zone"]        = zone

        state.setdefault("audit_log", []).append({
            "timestamp":   datetime.now(UTC).isoformat(),
            "action":      "set_profile",
            "role":        role,
            "environment": environment,
            "zone":        zone,
            "source":      "cockpit",
        })

        write_state(state_path, state)
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


# ── action_get_audit_entries ─────────────────────────────────────────────

def action_get_audit_entries(payload: dict) -> dict:
    """
    Return all audit entries aggregated from state JSON audit_log arrays
    and results/scan_*.xml files — mirrors _load_audit_entries() in audit_tab.py.
    """
    import glob
    import re

    entries:   list[dict] = []
    seen_keys: set[str]   = set()

    # ── Source 1: state JSON audit_log[] ─────────────────────
    for path in sorted(glob.glob(str(GENERATED_DIR / "stigr_*_state.json"))):
        stem    = Path(path).stem
        profile = stem.removeprefix("stigr_").removesuffix("_state") or stem
        try:
            with open(path) as fh:
                data = json.load(fh)
            for row in data.get("audit_log", []):
                ts      = row.get("timestamp", "")
                results = row.get("results", row)
                entry   = {
                    "profile":   profile,
                    "timestamp": ts,
                    "trigger":   row.get("trigger", "scan"),
                    "high":      int(results.get("high",   0)),
                    "medium":    int(results.get("medium", 0)),
                    "low":       int(results.get("low",    0)),
                    "pass":      int(results.get("pass",   0)),
                    "rules":     row.get("rules", results.get("rules", [])),
                    "_source":   "state",
                    "_xml_path": "",
                }
                key = f"{profile}|{ts[:16]}"
                seen_keys.add(key)
                entries.append(entry)
        except (OSError, json.JSONDecodeError, ValueError):
            continue

    # ── Source 2: results/scan_*.xml and daemon_*.xml ────────
    for pattern in ("scan_*.xml", "daemon_*.xml"):
        for path in sorted(glob.glob(str(RESULTS_DIR / pattern))):
            stem    = Path(path).stem
            # derive profile from filename
            rest    = stem.removeprefix("scan_").removeprefix("daemon_")
            parts   = rest.split("_")
            while parts and re.fullmatch(r"\d{8,15}", parts[-1]):
                parts.pop()
            profile = "_".join(parts).strip("_") or "unknown"

            # quick timestamp from xml
            try:
                text     = Path(path).read_text(errors="replace")
                ts_match = re.search(r'time="([^"]+)"', text)
                if ts_match:
                    ts = ts_match.group(1)
                else:
                    import datetime
                    ts = datetime.datetime.fromtimestamp(
                        Path(path).stat().st_mtime
                    ).isoformat(timespec="seconds")
            except OSError:
                continue

            key = f"{profile}|{ts[:16]}"
            if key in seen_keys:
                continue
            seen_keys.add(key)

            # summary counts only — rules loaded on demand via parse_audit_rules
            results_text = re.findall(r"<result[^>]*>\s*(\w+)\s*</result>", text, re.IGNORECASE)
            pass_count   = sum(1 for r in results_text if r.lower() in ("pass", "notapplicable"))
            highs   = len(re.findall(r'severity="high"[^/]*/?>[\s\S]*?<result[^>]*>fail',   text, re.IGNORECASE))
            mediums = len(re.findall(r'severity="medium"[^/]*/?>[\s\S]*?<result[^>]*>fail', text, re.IGNORECASE))
            lows    = len(re.findall(r'severity="low"[^/]*/?>[\s\S]*?<result[^>]*>fail',    text, re.IGNORECASE))

            entries.append({
                "profile":   profile,
                "timestamp": ts,
                "trigger":   "oscap",
                "high":      highs,
                "medium":    mediums,
                "low":       lows,
                "pass":      pass_count,
                "rules":     [],
                "_source":   "xml",
                "_xml_path": path,
            })

    entries.sort(key=lambda r: r["timestamp"], reverse=True)
    return {"status": "ok", "entries": entries}


def action_parse_audit_rules(payload: dict) -> dict:
    """
    Parse per-rule data from an oscap results XML file.
    Mirrors SCAPManager.parse_results_with_severity() using stdlib
    so we don't need to instantiate SCAPManager in the bridge.
    """
    import xml.etree.ElementTree as ET
    import re

    xml_path = payload.get("xml_path", "")
    if not xml_path:
        return {"status": "error", "error": "xml_path required"}
    if not Path(xml_path).exists():
        return {"status": "error", "error": f"File not found: {xml_path}"}

    NS    = "http://checklists.nist.gov/xccdf/1.2"
    rules = []

    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()

        def _clean(rule_id: str) -> str:
            short = rule_id.replace("xccdf_org.ssgproject.content_rule_", "")
            return short.replace("_", " ").title()

        # Build severity + title maps from Rule elements
        sev_map:   dict[str, str] = {}
        title_map: dict[str, str] = {}
        for rule_el in root.iter(f"{{{NS}}}Rule"):
            rid = rule_el.get("id", "")
            if rid:
                sev_map[rid] = rule_el.get("severity", "unknown")
                t = rule_el.find(f"{{{NS}}}title")
                if t is not None and t.text:
                    title_map[rid] = t.text.strip()

        for rr in root.iter(f"{{{NS}}}rule-result"):
            rule_id   = rr.get("idref", "")
            result_el = rr.find(f"{{{NS}}}result")
            if result_el is None:
                continue
            result = (result_el.text or "").strip()
            if not result:
                continue

            severity = sev_map.get(rule_id, rr.get("severity", "unknown"))
            title    = title_map.get(rule_id, _clean(rule_id))

            rules.append({
                "id":       rule_id,
                "title":    title,
                "result":   result,
                "severity": severity,
            })

    except Exception as e:
        return {"status": "error", "error": str(e)}

    return {"status": "ok", "rules": rules}

# ── Dispatch ──────────────────────────────────────────────────────────────────

ACTIONS = {
    "run_scan":           action_run_scan,
    "save_daemon_config": action_save_daemon_config,
    "save_decision":      action_save_decision,
    "save_authority":     action_save_authority,
    "save_profile":       action_save_profile,
    "get_audit_entries":  action_get_audit_entries,
    "parse_audit_rules":  action_parse_audit_rules,
}

def main() -> None:
    try:
        payload = json.loads(sys.stdin.readline())
    except json.JSONDecodeError as e:
        print(json.dumps({"status": "error", "error": f"Invalid JSON: {e}"}))
        sys.exit(1)

    action  = payload.get("action", "")
    handler = ACTIONS.get(action)

    if not handler:
        print(json.dumps({"status": "error", "error": f"Unknown action: {action}"}))
        sys.exit(1)

    result = handler(payload)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
