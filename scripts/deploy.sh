#!/bin/bash
set -e
set -o pipefail

npm run build
node dist/prerender.js

source .env

rsync -SavLPz \
  package.json \
  dist \
	public \
  "$USER@$HOST:$PROJECT_DIR/"

ssh "$USER@$HOST" "
source ~/.nvm/nvm.sh && \
cd $PROJECT_DIR/dist && \
rm -f db.sqlite3 && \
ln -s ../db.sqlite3 && \
npx knex migrate:latest && \
cd .. && \
pnpm i --prod --no-optional && \
pm2 reload talent-demand-dynamics
"
