#!/bin/bash
# scripts/utils.sh - Shared helper functions

# Wait for apt/dpkg locks
wait_for_dpkg_lock() {
    echo "Waiting for dpkg lock to be released..."
    while sudo fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do
        sleep 2
    done
}

# Local-only: Remote execution via gcloud
remote_exec() {
    local instance="$1"
    shift
    gcloud compute ssh "$instance" \
        --project="$PROJECT_ID" \
        --zone="$ZONE" \
        --tunnel-through-iap \
        --command="$*"
}

# Local-only: Remote upload via gcloud
remote_scp() {
    local instance="$1"
    shift
    # Note: files are uploaded to /tmp/ then moved by the execution script
    gcloud compute scp "$@" "$instance:/tmp/" \
        --project="$PROJECT_ID" \
        --zone="$ZONE" \
        --tunnel-through-iap
}

# Dynamic Instance Discovery
get_instances_by_tag() {
    local tag="$1"
    gcloud compute instances list \
        --project="$PROJECT_ID" \
        --filter="tags.items=$tag" \
        --format="value(name)" | xargs
}
