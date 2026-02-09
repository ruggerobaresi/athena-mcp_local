#!/bin/bash
set -e

# Pre-flight Verification
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running."
    exit 1
fi

if [ ! -f .env ]; then
    echo "Warning: .env file missing. Using strict defaults from docker-compose."
fi

# Create data directories
echo "Initializing data structure..."
mkdir -p data/.context
mkdir -p data/litegraph
mkdir -p data/litegraph-db

# Seed .context if empty and source exists
if [ -z "$(ls -A data/.context)" ] && [ -d .context ]; then
    echo "Seeding data/.context from local .context..."
    cp -r .context/* data/.context/
fi

# Launch
echo "Starting Athena Stack..."
docker compose up -d --build

echo ""
echo "⚡ Athena Stack Running."
echo "----------------------------------------"
echo "To attach to CLI (Interactive Mode):"
echo "docker attach athena_mcp"
echo ""
echo "To run a single command:"
echo "docker exec -i athena_mcp node dist/index.js [command]"
echo "----------------------------------------"
