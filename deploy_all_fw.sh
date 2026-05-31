#!/bin/bash
source ./scripts/common/config.sh
source ./scripts/common/utils.sh

# WebApps
for INSTANCE in "web-1" "web-2"; do
    echo "Deploying to $INSTANCE"
    remote_scp "$INSTANCE" "./scripts/firewall/web-firewall-rules.sh"
    remote_exec "$INSTANCE" "chmod +x /tmp/web-firewall-rules.sh && sudo /tmp/web-firewall-rules.sh"
done

# LBs
for INSTANCE in "lb-01" "lb-02"; do
    echo "Deploying to $INSTANCE"
    remote_scp "$INSTANCE" "./scripts/firewall/${INSTANCE}-firewall-rules.sh"
    remote_exec "$INSTANCE" "chmod +x /tmp/${INSTANCE}-firewall-rules.sh && sudo /tmp/${INSTANCE}-firewall-rules.sh"
done

# DBs
for INSTANCE in "db-01" "db-02"; do
    echo "Deploying to $INSTANCE"
    remote_scp "$INSTANCE" "./scripts/firewall/${INSTANCE}-firewall-rules.sh"
    remote_exec "$INSTANCE" "chmod +x /tmp/${INSTANCE}-firewall-rules.sh && sudo /tmp/${INSTANCE}-firewall-rules.sh"
done

echo "Done!"
