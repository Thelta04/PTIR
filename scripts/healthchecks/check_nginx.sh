#!/bin/bash
# scripts/check_nginx.sh
# Used by Keepalived to verify Nginx is running and responding.

if pgrep nginx > /dev/null && curl -s --max-time 2 http://localhost/ > /dev/null; then
    exit 0
else
    exit 1
fi
