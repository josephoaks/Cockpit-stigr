#!/bin/bash

make
make install PREFIX=/usr
cp src/bridge/cockpit-bridge.py /usr/lib/stigr/cockpit-bridge.py
systemctl restart cockpit
