#!/bin/sh
set -e
node --import tsx server/src/db/migrate.ts
exec node --import tsx server/src/server.ts
