#!/usr/bin/env bash

# Script to delete all node_modules folders in the monorepo
# This is useful for cleaning up disk space or resetting dependencies

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔍 Searching for node_modules folders...${NC}"
echo ""

# Find all node_modules directories
NODE_MODULES_DIRS=$(find . -name "node_modules" -type d -prune)

if [ -z "$NODE_MODULES_DIRS" ]; then
    echo -e "${GREEN}✓ No node_modules folders found. Already clean!${NC}"
    exit 0
fi

# Count how many directories we found
COUNT=$(echo "$NODE_MODULES_DIRS" | wc -l | tr -d ' ')

echo -e "${YELLOW}Found ${COUNT} node_modules folder(s):${NC}"
echo "$NODE_MODULES_DIRS" | sed 's/^/  /'
echo ""

# Ask for confirmation
read -p "$(echo -e ${RED}Are you sure you want to delete all these folders? [y/N]:${NC} )" -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Cancelled. No folders were deleted.${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}🗑️  Deleting node_modules folders...${NC}"
echo ""

# Delete each node_modules directory
while IFS= read -r dir; do
    if [ -d "$dir" ]; then
        echo -e "  Deleting: ${RED}$dir${NC}"
        rm -rf "$dir"
    fi
done <<< "$NODE_MODULES_DIRS"

echo ""
echo -e "${GREEN}✓ Done! All node_modules folders have been deleted.${NC}"
echo -e "${GREEN}  Run 'bun install' to reinstall dependencies.${NC}"

