// Configuración en tiempo de ejecución (sobreescrita por docker-entrypoint.sh en producción)
window.__ENV__ = window.__ENV__ || {
  JELLYFIN_SERVER_URL: '',
  APP_NAME: '',
  APP_LOGO_URL: '',
};
