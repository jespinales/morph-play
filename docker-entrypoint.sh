#!/bin/sh
set -eu

CONFIG_PATH="/usr/share/nginx/html/env-config.js"
SERVER_URL="${JELLYFIN_SERVER_URL:-}"
APP_NAME_VAL="${APP_NAME:-}"
APP_LOGO_URL_VAL="${APP_LOGO_URL:-}"

# Escapar comillas y barras invertidas para generar JS válido
escape_js() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

ESCAPED_URL=$(escape_js "$SERVER_URL")
ESCAPED_APP_NAME=$(escape_js "$APP_NAME_VAL")
ESCAPED_APP_LOGO_URL=$(escape_js "$APP_LOGO_URL_VAL")

cat <<EOF > "$CONFIG_PATH"
window.__ENV__ = {
  JELLYFIN_SERVER_URL: "${ESCAPED_URL}",
  APP_NAME: "${ESCAPED_APP_NAME}",
  APP_LOGO_URL: "${ESCAPED_APP_LOGO_URL}"
};
EOF

exec nginx -g "daemon off;"
