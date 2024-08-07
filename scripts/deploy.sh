#!/bin/bash
set -e
set -o pipefail

npx ts-node count-words.ts
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
cd $PROJECT_DIR && \
pnpm i --prod --no-optional && \
cd $PROJECT_DIR/dist && \
rm -f db.sqlite3 && \
ln -s ../db.sqlite3 && \
npx knex migrate:latest && \
cd .. && \
pm2 reload talent-demand-dynamics
"
