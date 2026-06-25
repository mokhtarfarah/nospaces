#!/bin/sh
# No-auth dev instance: clearing VITE_SUPABASE_URL trips App.tsx's skipAuth so the
# UI is explorable without Google login (data will be empty — layout checks only).
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/farahmokhtar/nospaces
export VITE_SUPABASE_URL=
npm run dev -- --port ${PORT:-5180}
