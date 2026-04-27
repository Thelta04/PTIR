#!/bin/bash
# scripts/config.sh - Centralized configuration for all scripts

# GCP Project Configuration
PROJECT_ID="project-dc8596f3-77e8-4941-a9a"
REGION="europe-southwest1"
ZONE="europe-southwest1-c"

# Networking
NETWORK="lan"
SUBNET="lan"
INTERNAL_CIDR="10.10.10.0/24"

# Deployment Paths and Users
REMOTE_USER="athen"
TARGET_DIR="/home/$REMOTE_USER/app"

# Database defaults
DB_NAME_DEFAULT="tuxy_db"
DB_USER_DEFAULT="tuxy_user"
DB_PRIMARY_IP="10.10.10.30"
DB_PORT="5432"

# Tagging (for dynamic discovery)
TAG_WEB="webapp-server"
TAG_DB="db-server"
TAG_LB="lb-server"
