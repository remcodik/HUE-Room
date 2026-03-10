/**
 * Philips Hue Bridge API service
 * Supports both v1 (local) and CLIP v2 (EventSource SSE)
 */

const DISCOVERY_URL = 'https://discovery.meethue.com/';
const HUE_APP_NAME = 'HUERoom#App';

// ─── Storage helpers ─────────────────────────────────────────────────────────
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function load(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

// ─── Discovery ────────────────────────────────────────────────────────────────
export async function discoverBridges() {
  try {
    const res = await fetch(DISCOVERY_URL);
    const data = await res.json();
    return data.map(b => ({ id: b.id, ip: b.internalipaddress }));
  } catch {
    // Fallback: try common local addresses
    return [{ id: 'manual', ip: null }];
  }
}

// ─── Pairing ──────────────────────────────────────────────────────────────────
export async function pairWithBridge(ip) {
  const res = await fetch(`http://${ip}/api`, {
    method: 'POST',
    body: JSON.stringify({ devicetype: HUE_APP_NAME, generateclientkey: true }),
  });
  const data = await res.json();
  if (data[0]?.success) {
    const username = data[0].success.username;
    save('hue_bridge_ip', ip);
    save('hue_username', username);
    return { ip, username };
  }
  if (data[0]?.error?.type === 101) {
    throw new Error('PRESS_BUTTON');
  }
  throw new Error(data[0]?.error?.description || 'Pairing failed');
}

// ─── API client (local + remote) ─────────────────────────────────────────────
function getConfig() {
  return {
    ip: load('hue_bridge_ip'),
    username: load('hue_username'),
  };
}

function apiUrl(path) {
  const { ip, username } = getConfig();
  if (isRemoteMode()) {
    return `${REMOTE_BASE}/bridge/${username}${path}`;
  }
  return `http://${ip}/api/${username}${path}`;
}

async function apiFetch(path, options = {}) {
  if (isRemoteMode()) {
    const token = await getValidRemoteToken();
    return fetch(apiUrl(path), {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }
  return fetch(apiUrl(path), options);
}

export async function fetchLights() {
  const res = await apiFetch('/lights');
  const data = await res.json();
  return Object.entries(data).map(([id, light]) => ({
    id,
    name: light.name,
    type: light.type,
    on: light.state.on,
    bri: light.state.bri ?? 254,
    hue: light.state.hue ?? 0,
    sat: light.state.sat ?? 0,
    ct: light.state.ct ?? 366,
    colormode: light.state.colormode ?? 'ct',
    reachable: light.state.reachable,
    xy: light.state.xy ?? [0.3127, 0.3290],
  }));
}

export async function fetchGroups() {
  const res = await apiFetch('/groups');
  const data = await res.json();
  return Object.entries(data).map(([id, g]) => ({
    id,
    name: g.name,
    type: g.type,
    lights: g.lights,
    on: g.state?.any_on ?? false,
    all_on: g.state?.all_on ?? false,
    bri: g.action?.bri ?? 254,
    hue: g.action?.hue ?? 0,
    sat: g.action?.sat ?? 0,
    ct: g.action?.ct ?? 366,
  }));
}

export async function fetchScenes() {
  const res = await apiFetch('/scenes');
  const data = await res.json();
  return Object.entries(data).map(([id, s]) => ({
    id,
    name: s.name,
    group: s.group,
    lights: s.lights,
  }));
}

export async function setLightState(lightId, state) {
  await apiFetch(`/lights/${lightId}/state`, {
    method: 'PUT',
    body: JSON.stringify(state),
  });
}

export async function setGroupState(groupId, state) {
  await apiFetch(`/groups/${groupId}/action`, {
    method: 'PUT',
    body: JSON.stringify(state),
  });
}

export async function activateScene(sceneId, groupId) {
  await apiFetch(`/groups/${groupId}/action`, {
    method: 'PUT',
    body: JSON.stringify({ scene: sceneId }),
  });
}

// ─── Extended API endpoints ───────────────────────────────────────────────────

export async function fetchSensors() {
  const res = await apiFetch('/sensors');
  const data = await res.json();
  return Object.entries(data).map(([id, s]) => ({
    id,
    name: s.name,
    type: s.type,             // 'ZLLPresence' | 'ZLLTemperature' | 'ZLLLightLevel' | 'ZGPSwitch' | 'ZLLSwitch'
    modelid: s.modelid,
    manufacturername: s.manufacturername,
    uniqueid: s.uniqueid,
    // State varies by sensor type:
    presence: s.state?.presence ?? null,          // motion sensor
    temperature: s.state?.temperature ?? null,    // in 1/100 °C → divide by 100
    lightlevel: s.state?.lightlevel ?? null,      // in lux (10^((val-1)/10000))
    buttonevent: s.state?.buttonevent ?? null,     // dimmer switch button code
    lastupdated: s.state?.lastupdated ?? null,
    // Config
    on: s.config?.on ?? true,
    reachable: s.config?.reachable ?? false,
    battery: s.config?.battery ?? null,
  }));
}

export async function fetchSchedules() {
  const res = await apiFetch('/schedules');
  const data = await res.json();
  return Object.entries(data).map(([id, s]) => ({
    id,
    name: s.name,
    description: s.description,
    command: s.command,       // { address, method, body }
    time: s.time,             // ISO 8601 or "PT00:30:00" (timer) or "W127/T07:00:00" (recurring)
    localtime: s.localtime,
    status: s.status,         // 'enabled' | 'disabled'
    autodelete: s.autodelete,
    type: s.type,             // 'Timer' | 'Absolute' | 'Recurring'
  }));
}

export async function fetchRules() {
  const res = await apiFetch('/rules');
  const data = await res.json();
  return Object.entries(data).map(([id, r]) => ({
    id,
    name: r.name,
    conditions: r.conditions ?? [],
    actions: r.actions ?? [],
    status: r.status,
    timestriggered: r.timestriggered ?? 0,
    lasttriggered: r.lasttriggered,
  }));
}

export async function fetchBridgeConfig() {
  const res = await apiFetch('/config');
  const data = await res.json();
  return {
    name: data.name,
    zigbeechannel: data.zigbeechannel,
    bridgeid: data.bridgeid,
    mac: data.mac,
    ipaddress: data.ipaddress,
    netmask: data.netmask,
    gateway: data.gateway,
    dhcp: data.dhcp,
    timezone: data.timezone,
    modelid: data.modelid,
    swversion: data.swversion,
    apiversion: data.apiversion,
    updatestate: data.swupdate2?.state ?? data.swupdate?.updatestate ?? 0,
    updateavailable: data.swupdate2?.checkforupdate ?? false,
    linkbutton: data.linkbutton,
    portalservices: data.portalservices,
    portalconnection: data.portalconnection,
    utc: data.UTC,
    localtime: data.localtime,
  };
}

export async function fetchCapabilities() {
  const res = await apiFetch('/capabilities');
  const data = await res.json();
  return {
    lights: data.lights ?? {},
    groups: data.groups ?? {},
    scenes: data.scenes ?? {},
    schedules: data.schedules ?? {},
    rules: data.rules ?? {},
    sensors: data.sensors ?? {},
    streaming: data.streaming ?? {},
  };
}

export async function fetchLightDetail(lightId) {
  const res = await apiFetch(`/lights/${lightId}`);
  const data = await res.json();
  return {
    id: lightId,
    productname: data.productname,
    manufacturername: data.manufacturername,
    modelid: data.modelid,
    swversion: data.swversion,
    uniqueid: data.uniqueid,
    swconfigid: data.swconfigid,
    productid: data.productid,
    capabilities: {
      certified: data.capabilities?.certified,
      control: {
        mindimlevel: data.capabilities?.control?.mindimlevel,
        maxlumen: data.capabilities?.control?.maxlumen,
        colorgamuttype: data.capabilities?.control?.colorgamuttype,
        colorgamut: data.capabilities?.control?.colorgamut,
        ct: data.capabilities?.control?.ct,       // { min, max }
      },
    },
  };
}

export async function createSchedule(scheduleData) {
  const res = await apiFetch('/schedules', {
    method: 'POST',
    body: JSON.stringify(scheduleData),
  });
  const data = await res.json();
  if (data[0]?.success) return data[0].success.id;
  throw new Error(data[0]?.error?.description || 'Failed to create schedule');
}

export async function updateSchedule(id, patch) {
  await apiFetch(`/schedules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

export async function deleteSchedule(id) {
  await apiFetch(`/schedules/${id}`, { method: 'DELETE' });
}

// ─── Real-time polling (SSE not available on local bridge v1) ─────────────────
export function startPolling(onUpdate, intervalMs = 2000) {
  let active = true;
  let timer = null;

  async function poll() {
    if (!active) return;
    try {
      const lights = await fetchLights();
      onUpdate(lights);
    } catch {
      // silently ignore network errors during polling
    }
    if (active) timer = setTimeout(poll, intervalMs);
  }

  poll();
  return () => { active = false; clearTimeout(timer); };
}

// ─── Color utils ──────────────────────────────────────────────────────────────
/** Convert Hue bridge XY + bri to hex color string */
export function xyBriToHex(xy, bri) {
  if (!xy || xy.length < 2) return '#ffd700';
  const [x, y] = xy;
  const z = 1.0 - x - y;
  const Y = bri / 254;
  const X = (Y / y) * x;
  const Z = (Y / y) * z;

  let r = X * 1.656492 - Y * 0.354851 - Z * 0.255038;
  let g = -X * 0.707196 + Y * 1.655397 + Z * 0.036152;
  let b = X * 0.051713 - Y * 0.121364 + Z * 1.011530;

  // Clamp
  const max = Math.max(r, g, b, 1);
  r = Math.max(0, r / max);
  g = Math.max(0, g / max);
  b = Math.max(0, b / max);

  // Gamma
  r = r <= 0.0031308 ? 12.92 * r : (1.055 * Math.pow(r, 1/2.4) - 0.055);
  g = g <= 0.0031308 ? 12.92 * g : (1.055 * Math.pow(g, 1/2.4) - 0.055);
  b = b <= 0.0031308 ? 12.92 * b : (1.055 * Math.pow(b, 1/2.4) - 0.055);

  const toHex = v => Math.round(Math.min(255, v * 255)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Convert Mired color temperature to warm/cool hex */
export function ctToHex(ct) {
  // ct: 153 (cool/6500K) -> 500 (warm/2000K)
  const ratio = (ct - 153) / (500 - 153);
  const r = Math.round(255);
  const g = Math.round(200 + (1 - ratio) * 55);
  const b = Math.round(255 - ratio * 200);
  const toHex = v => Math.min(255, Math.max(0, v)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Get display color for a light state */
export function getLightColor(light) {
  if (!light.on) return '#1e293b';
  if (light.colormode === 'xy' && light.xy) return xyBriToHex(light.xy, light.bri);
  if (light.colormode === 'ct') return ctToHex(light.ct);
  return '#ffd700';
}

/** Convert hex color to Hue XY for PUT state */
export function hexToXY(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const R = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  const G = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  const B = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  const X = R * 0.664511 + G * 0.154324 + B * 0.162028;
  const Y = R * 0.283881 + G * 0.668433 + B * 0.047685;
  const Z = R * 0.000088 + G * 0.072310 + B * 0.986039;

  const sum = X + Y + Z;
  if (sum === 0) return [0.3127, 0.3290];
  return [X / sum, Y / sum];
}

// ─── Saved config helpers ─────────────────────────────────────────────────────
export function isConfigured() {
  // Local bridge OR remote OAuth
  return !!(load('hue_bridge_ip') && load('hue_username'))
    || !!(load('hue_remote_token') && load('hue_username'));
}

export function isRemoteMode() {
  return !!load('hue_remote_token');
}

export function getStoredConfig() {
  return { ip: load('hue_bridge_ip'), username: load('hue_username') };
}

export function clearConfig() {
  localStorage.removeItem('hue_bridge_ip');
  localStorage.removeItem('hue_username');
  localStorage.removeItem('hue_remote_token');
  localStorage.removeItem('hue_remote_refresh');
  localStorage.removeItem('hue_remote_expires');
  localStorage.removeItem('hue_client_id');
}

// ─── Remote API (Philips Hue Cloud) ───────────────────────────────────────────
const REMOTE_BASE = 'https://api.meethue.com';

export function saveRemoteTokens({ access_token, refresh_token, expires_in }) {
  save('hue_remote_token', access_token);
  if (refresh_token) save('hue_remote_refresh', refresh_token);
  if (expires_in) save('hue_remote_expires', Date.now() + expires_in * 1000);
}

export function getRemoteToken() {
  return load('hue_remote_token');
}

export function saveClientId(clientId) {
  save('hue_client_id', clientId);
}

export function getClientId() {
  return load('hue_client_id') || import.meta.env.VITE_HUE_CLIENT_ID || '';
}

/** Redirect URL the browser should return to after Hue login */
export function getOAuthRedirectUri() {
  return window.location.origin + '/';
}

/** Build the Hue authorization URL – redirects user to Hue login page */
export function getOAuthUrl(clientId) {
  const state = Math.random().toString(36).slice(2);
  sessionStorage.setItem('hue_oauth_state', state);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    state,
  });
  return `${REMOTE_BASE}/v2/oauth2/authorize?${params}`;
}

/**
 * Exchange authorization code for tokens.
 * Calls /api/token (Vercel serverless) to avoid CORS issues with client_secret.
 */
export async function exchangeOAuthCode(code, clientId) {
  const res = await fetch(`/api/token?code=${encodeURIComponent(code)}&client_id=${encodeURIComponent(clientId)}&grant_type=authorization_code`);
  if (!res.ok) throw new Error('Token uitwisseling mislukt');
  const data = await res.json();
  if (!data.access_token) throw new Error(data.error_description || 'Geen access token');
  return data;
}

/**
 * Refresh the access token using the stored refresh token.
 */
export async function refreshRemoteToken() {
  const refreshToken = load('hue_remote_refresh');
  const clientId = load('hue_client_id');
  if (!refreshToken || !clientId) throw new Error('Geen refresh token');
  const res = await fetch(`/api/token?refresh_token=${encodeURIComponent(refreshToken)}&client_id=${encodeURIComponent(clientId)}&grant_type=refresh_token`);
  if (!res.ok) throw new Error('Token vernieuwen mislukt');
  const data = await res.json();
  if (!data.access_token) throw new Error('Geen access token');
  saveRemoteTokens(data);
  return data.access_token;
}

/**
 * Get a valid access token, refreshing if needed.
 */
export async function getValidRemoteToken() {
  const expires = load('hue_remote_expires');
  if (expires && Date.now() > expires - 60000) {
    return await refreshRemoteToken();
  }
  return load('hue_remote_token');
}

/**
 * After OAuth: link bridge to get/confirm the whitelist username.
 * With Remote API, username = the stored API key.
 * This creates a whitelist entry if not yet done.
 */
export async function linkRemoteBridge(accessToken) {
  // Try to create whitelist entry (press link button is NOT required for Remote API)
  const res = await fetch(`${REMOTE_BASE}/bridge/0/config`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ devicetype: HUE_APP_NAME }),
  });
  const data = await res.json();
  // The response contains the whitelist username
  if (Array.isArray(data) && data[0]?.success?.username) {
    return data[0].success.username;
  }
  // Fallback: try fetching existing whitelist
  if (data.whitelist) {
    const firstKey = Object.keys(data.whitelist)[0];
    if (firstKey) return firstKey;
  }
  throw new Error('Bridge koppeling mislukt – probeer opnieuw');
}

// ─── API client (local + remote) ─────────────────────────────────────────────

// ─── Sensor value helpers ─────────────────────────────────────────────────────
/** Convert Hue temperature sensor value (1/100 °C) to Celsius string */
export function sensorTempC(raw) {
  if (raw == null) return null;
  return (raw / 100).toFixed(1);
}

/** Convert Hue lightlevel to approximate lux */
export function sensorLux(lightlevel) {
  if (lightlevel == null) return null;
  return Math.round(Math.pow(10, (lightlevel - 1) / 10000));
}

/** Get sensor type emoji */
export function sensorEmoji(type) {
  if (type?.includes('Presence')) return '👁';
  if (type?.includes('Temperature')) return '🌡';
  if (type?.includes('LightLevel')) return '☀️';
  if (type?.includes('Switch')) return '🔘';
  return '📡';
}

/** Hue localtime string → human readable */
export function scheduleTimeLabel(localtime) {
  if (!localtime) return '';
  // Timer: PT00:30:00
  if (localtime.startsWith('PT')) {
    const match = localtime.match(/PT(\d+):(\d+):(\d+)/);
    if (match) {
      const h = parseInt(match[1]);
      const m = parseInt(match[2]);
      if (h > 0) return `Over ${h}u ${m}m`;
      return `Over ${m} min`;
    }
  }
  // Recurring: W127/T07:00:00
  if (localtime.startsWith('W')) {
    const parts = localtime.split('/T');
    if (parts.length === 2) return `Dagelijks om ${parts[1].slice(0, 5)}`;
  }
  // Absolute: 2026-03-06T07:00:00
  try {
    const d = new Date(localtime);
    return d.toLocaleString('nl-NL', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return localtime; }
}
