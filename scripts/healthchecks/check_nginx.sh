#!/bin/bash
# scripts/check_nginx.sh
# Used by Keepalived to verify Nginx is running and responding.

if /usr/sbin/nginx -t > /dev/null 2>&1 && killall -0 nginx > /dev/null 2>&1; then
    exit 0
else
    exit 1
fi
