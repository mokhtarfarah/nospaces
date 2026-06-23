#!/bin/sh
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/farahmokhtar/nospaces
npm run dev -- --port ${PORT:-5173}
