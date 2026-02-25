#!/bin/bash
set -e

# Get version from package.json
VERSION=$(grep '"version"' package.json | head -1 | awk -F'"' '{print $4}')
echo "Building RPM for cockpit-stigr version ${VERSION}..."

# Clean Python cache files
find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
find . -type f -name "*.pyc" -delete 2>/dev/null || true

# Build the JS bundle
npm run build

# Create tarball structure
TMPDIR=$(mktemp -d)
PKGDIR="${TMPDIR}/cockpit-stigr-${VERSION}"
mkdir -p "${PKGDIR}/stigr"

# Copy spec file and top-level docs to tarball root
cp cockpit-stigr.spec "${PKGDIR}/"
cp LICENSE           "${PKGDIR}/"
cp README.md         "${PKGDIR}/"

# Copy pre-built dist bundle
cp -r dist/* "${PKGDIR}/stigr/"

# Copy the Python bridge
mkdir -p "${PKGDIR}/bridge"
cp src/bridge/cockpit-bridge.py "${PKGDIR}/bridge/"

# Copy metainfo for appstream
cp org.cockpit_project.stigr.metainfo.xml "${PKGDIR}/"

# Clean any stray cache files
find "${PKGDIR}" -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
find "${PKGDIR}" -type f -name "*.pyc" -delete 2>/dev/null || true

# Create tarball
cd "${TMPDIR}"
tar czf "cockpit-stigr-${VERSION}.tar.gz" "cockpit-stigr-${VERSION}/"

# Move to repo root
mv "cockpit-stigr-${VERSION}.tar.gz" "${OLDPWD}/"

# Cleanup
rm -rf "${TMPDIR}"

echo "Created cockpit-stigr-${VERSION}.tar.gz"
echo ""
echo "To build RPM:"
echo "  cp cockpit-stigr-${VERSION}.tar.gz ~/rpmbuild/SOURCES/"
echo "  rpmbuild -ba cockpit-stigr.spec"
