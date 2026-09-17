#!/bin/sh
# Sobe o Next em desenvolvimento com o Node instalado em ~/.local/node.
export PATH="$HOME/.local/node/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1
exec npm run dev
