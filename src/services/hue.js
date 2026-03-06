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

// ─── API client ───────────────────────────────────────────────────────────────
function getConfig() {
  return {
    ip: load('hue_bridge_ip'),
    username: load('hue_username'),
  };
}

function apiUrl(path) {
  const { ip, username } = getConfig();
  return `http://${ip}/api/${username}${path}`;
}

export async function fetchLights() {
  const res = await fetch(apiUrl('/lights'));
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
  const res = await fetch(apiUrl('/groups'));
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
  const res = await fetch(apiUrl('/scenes'));
  const data = await res.json();
  return Object.entries(data).map(([id, s]) => ({
    id,
    name: s.name,
    group: s.group,
    lights: s.lights,
  }));
}

export async function setLightState(lightId, state) {
  await fetch(apiUrl(`/lights/${lightId}/state`), {
    method: 'PUT',
    body: JSON.stringify(state),
  });
}

export async function setGroupState(groupId, state) {
  await fetch(apiUrl(`/groups/${groupId}/action`), {
    method: 'PUT',
    body: JSON.stringify(state),
  });
}

export async function activateScene(sceneId, groupId) {
  await fetch(apiUrl(`/groups/${groupId}/action`), {
    method: 'PUT',
    body: JSON.stringify({ scene: sceneId }),
  });
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
  return !!(load('hue_bridge_ip') && load('hue_username'));
}

export function getStoredConfig() {
  return { ip: load('hue_bridge_ip'), username: load('hue_username') };
}

export function clearConfig() {
  localStorage.removeItem('hue_bridge_ip');
  localStorage.removeItem('hue_username');
}
