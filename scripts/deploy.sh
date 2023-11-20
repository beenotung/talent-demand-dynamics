#!/bin/bash
set -e
set -o pipefail

source .env

rsync -SavLPz \
  package.json \
  dist \
	public \
  db.sqlite3 \
  "$USER@$HOST:$PROJECT_DIR/"

ssh "$USER@$HOST" "
source ~/.nvm/nvm.sh && \
cd $PROJECT_DIR && \
pnpm i --prod --no-optional && \
pm2 reload talent-demand-dynamics
"
