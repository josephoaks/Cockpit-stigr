# cockpit-stigr

A [Cockpit](https://cockpit-project.org/) web UI plugin for [STIGR](https://github.com/josephoaks/stigr) — a STIG compliance management tool for Linux systems.

cockpit-stigr exposes STIGR's full compliance workflow directly in the Cockpit web console, allowing administrators to manage SCAP scanning, review findings, apply policy decisions, configure the compliance daemon, and export audit reports without leaving the browser.

---

## Screenshots

_Coming soon._

---

## Requirements

| Requirement | Version |
|---|---|
| [Cockpit](https://cockpit-project.org/) | ≥ 264 |
| [STIGR](https://github.com/josephoaks/stigr) | ≥ 1.0.0 |
| Python | ≥ 3.10 |
| Node.js | ≥ 16 (build only) |
| OpenSCAP (`oscap`) | ≥ 1.3 |

STIGR must be installed and initialized on the system before cockpit-stigr will function. The plugin is a UI layer on top of STIGR — it does not replace or bundle STIGR itself.

---

## Description

Cockpit-stigr provides a browser-based interface for the STIGR compliance engine. It communicates with the underlying STIGR installation via a Python bridge process (`cockpit-bridge.py`) that runs with elevated privileges through Cockpit's superuser mechanism.

### Tabs

| Tab | Description |
|---|---|
| **Target** | OS detection, authority selection (SSG / DISA), server profile (role / environment / zone), last scan summary |
| **Policy** | Per-rule compliance status, analyst decisions (enforce / exception / skip), remediation script viewer |
| **Daemon** | Compliance scan daemon configuration, schedule management, manual scan trigger |
| **Logs** | Live system log viewer with level filtering, search, and auto-refresh |
| **Audit Trail** | Full scan history with per-entry rule detail, CKL export for STIG Viewer, CSV export |

---

## Project Structure

```
cockpit-stigr/
├── src/
│   ├── app.jsx               # Root component and tab routing
│   ├── app.scss              # Global styles
│   ├── index.html            # Cockpit plugin entry point
│   ├── index.tsx             # React mount
│   ├── manifest.json         # Cockpit plugin manifest
│   ├── bridge/
│   │   └── cockpit-bridge.py # Python bridge — STIGR ↔ Cockpit
│   ├── components/
│   │   ├── TargetTab.jsx
│   │   ├── PolicyTab.jsx
│   │   ├── DaemonTab.jsx
│   │   ├── LogsTab.jsx
│   │   └── AuditTab.jsx
│   ├── hooks/
│   │   ├── useTarget.js
│   │   ├── usePolicy.js
│   │   ├── useDaemon.js
│   │   ├── useLogs.js
│   │   └── useAudit.js
│   └── lib/
│       ├── bridge.js         # Bridge call helpers
│       └── files.js
├── dist/                     # Built output (generated, not committed)
├── src/bridge/
│   └── cockpit-bridge.py
├── build.js                  # esbuild configuration
├── build-stigr.sh            # Local dev deploy script
├── build-rpm.sh              # RPM tarball build script
├── cockpit-stigr.spec        # RPM spec file
├── package.json
└── Makefile
```

---

## Installation

### RPM (recommended)

```bash
# Install STIGR first (required)
dnf install stigr

# Install cockpit-stigr
dnf install cockpit-stigr

# Enable and start Cockpit if not already running
systemctl enable --now cockpit.socket

# Open Cockpit in your browser
# https://<hostname>:9090
```

### Manual / Development

```bash
# Clone the repository
git clone https://github.com/josephoaks/cockpit-stigr
cd cockpit-stigr

# Install Node dependencies
npm install

# Build and deploy to the local system
./build-stigr.sh

# Open Cockpit
# https://localhost:9090
```

The `build-stigr.sh` script builds the JS bundle, copies the Cockpit plugin to `/usr/share/cockpit/stigr/`, deploys the Python bridge to `/usr/lib/stigr/cockpit-bridge.py`, and restarts Cockpit.

### Building an RPM

```bash
# Produce the source tarball
./build-rpm.sh

# Copy to rpmbuild sources
cp cockpit-stigr-0.1.0.tar.gz ~/rpmbuild/SOURCES/

# Build the RPM
rpmbuild -ba cockpit-stigr.spec
```

---

## File Paths

cockpit-stigr reads from and writes to the same paths as STIGR:

| Path | Purpose |
|---|---|
| `/var/lib/stigr/generated/stigr_*_state.json` | Profile state and audit log |
| `/var/lib/stigr/results/scan_*.xml` | OpenSCAP results XML |
| `/var/lib/stigr/results/daemon_*.xml` | Daemon scan results XML |
| `/var/lib/stigr/logs/stigr.log` | STIGR application log |
| `/var/lib/stigr/exports/` | CKL and CSV export output |
| `/etc/stigr/daemon.conf` | Compliance daemon configuration |
| `/usr/lib/stigr/cockpit-bridge.py` | Python bridge (installed by this package) |

---

## Contributing

The repository is currently private. Contributions are not open to the public at this time. If you have been granted access, please:

1. Fork or branch from `main`
2. Make your changes with clear, focused commits
3. Test against a live STIGR installation before submitting
4. Open a pull request with a description of what changed and why

---

## Author

**Joseph Oaks**

- GitHub: [@josephoaks](https://github.com/josephoaks)
- Repository: [Cockpit-stigr](https://github.com/josephoaks/Cockpit-stigr)

---

## License

Apache-2.0 - see [LICENSE](LICENSE) file for details
