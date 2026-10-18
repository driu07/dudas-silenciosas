/*
  Solo debes editar estos DOS valores desde Supabase > Project Settings > API Keys.
  Este archivo ES PÚBLICO: nunca pegues aquí secret/service_role ni la API key de Claude.
  El campo supabasePublishableKey admite sb_publishable_... o la clave pública legacy anon.
*/
window.DS_CONFIG = {
  supabaseUrl: "PON_AQUI_TU_URL_SUPABASE",
  supabasePublishableKey: "PON_AQUI_TU_CLAVE_PUBLICA_SUPABASE",
  turnstileSiteKey: "" // Opcional: usar solo si activas Cloudflare Turnstile en Supabase Auth
};
