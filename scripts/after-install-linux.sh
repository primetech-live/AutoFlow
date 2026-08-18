#!/bin/sh
# Post-install script for Debian/Ubuntu (.deb) packages
# Creates a symlink /usr/local/bin/autoflow -> /opt/Autoflow-vNext/autoflow

chmod +x /opt/Autoflow-vNext/autoflow 2>/dev/null || true
chmod +x /opt/Autoflow-vNext/autoflow.cmd 2>/dev/null || true

if [ -d "/usr/local/bin" ]; then
    ln -sf /opt/Autoflow-vNext/autoflow /usr/local/bin/autoflow 2>/dev/null || true
fi
