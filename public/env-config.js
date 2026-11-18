// Runtime configuration (overwritten by docker-entrypoint.sh in production)
window.__ENV__ = window.__ENV__ || {
  JELLYFIN_SERVER_URL: '',
  APP_NAME: '',
  APP_LOGO_URL: '',
};
