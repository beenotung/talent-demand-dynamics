#!/bin/bash
set -e
set -o pipefail

source .env

ssh "$USER@$HOST" "
cd $PROJECT_DIR && \
sqlite3 db.sqlite3 '.backup log.sqlite3'
"

rsync -SavLPz \
  "$USER@$HOST:$PROJECT_DIR/log.sqlite3" \
  .
