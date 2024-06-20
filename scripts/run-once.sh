#!/bin/bash
set -e
set -o pipefail
rm -f last.txt
npx ts-node collect.ts
./scripts/deploy.sh
backup-db
