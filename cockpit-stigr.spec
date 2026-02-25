#
# spec file for package cockpit-stigr
#
# Copyright (c) 2026 Joseph Oaks
#
# License: LGPL-2.1
#
Name:           cockpit-stigr
Version:        0.1.0
Release:        1%{?dist}
Summary:        Cockpit plugin for STIGr compliance management
License:        LGPL-2.1
URL:            https://github.com/josephoaks/cockpit-stigr
Source0:        cockpit-stigr-%{version}.tar.gz
BuildArch:      noarch

# cockpit for the web UI runtime
Requires:       cockpit
# stigr must already be installed — this plugin is a UI layer on top of it
Requires:       stigr
Requires:       python3

%description
cockpit-stigr is a Cockpit web UI plugin that provides a graphical
interface for the STIGr STIG compliance management tool.

It exposes the STIGr Target, Policy, Daemon, Logs, and Audit Trail
tabs directly in the Cockpit web console, allowing administrators
to manage SCAP scanning, review findings, apply policy decisions,
and export CKL/CSV audit reports without leaving the browser.

Requires the stigr package to be installed on the system.

%prep
%autosetup -n cockpit-stigr-%{version}

%build
# Nothing to build — tarball contains pre-built dist/

%install
# Install the Cockpit plugin
mkdir -p %{buildroot}/usr/share/cockpit
cp -a stigr %{buildroot}/usr/share/cockpit/

# Install the Python bridge
mkdir -p %{buildroot}/usr/lib/stigr
install -m 0755 bridge/cockpit-bridge.py %{buildroot}/usr/lib/stigr/cockpit-bridge.py

# Install appstream metainfo
mkdir -p %{buildroot}/usr/share/metainfo
install -m 0644 org.cockpit_project.stigr.metainfo.xml \
    %{buildroot}/usr/share/metainfo/org.cockpit_project.stigr.metainfo.xml

%files
%license LICENSE
%doc README.md
/usr/share/cockpit/stigr
/usr/lib/stigr/cockpit-bridge.py
/usr/share/metainfo/org.cockpit_project.stigr.metainfo.xml

%changelog
* Wed Feb 25 2026 Joseph Oaks <trell@trells.com> - 0.1.0-1
- Initial RPM packaging
- Target, Policy, Daemon, Logs, and Audit Trail tabs
- Python bridge for cockpit-to-stigr communication
- CKL and CSV export support
- Per-rule audit detail modal
