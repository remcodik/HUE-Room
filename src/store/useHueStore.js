import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  fetchLights, fetchGroups, fetchScenes,
  fetchSensors, fetchSchedules, fetchRules,
  fetchBridgeConfig, fetchCapabilities, fetchLightDetail,
  setLightState, setGroupState, activateScene,
  createSchedule, updateSchedule, deleteSchedule,
  startPolling,
} from '../services/hue';

export const useHueStore = create(
  persist(
    (set, get) => ({
      // ── Connection ────────────────────────────────────────────────────
      connected: false,
      bridgeIp: null,
      username: null,
      pollingStop: null,

      setConnection: (ip, username) => set({ bridgeIp: ip, username, connected: true }),
      disconnect: () => {
        get().pollingStop?.();
        get().stopVacationMode();
        set({ connected: false, bridgeIp: null, username: null, pollingStop: null });
      },

      // ── Lights ────────────────────────────────────────────────────────
      lights: {},
      groups: {},
      scenes: [],
      sensors: {},
      schedules: {},
      rules: [],
      bridgeConfig: {},
      capabilities: {},
      lightDetails: {},   // { [lightId]: extended detail }

      setLights: (list) => set({
        lights: Object.fromEntries(list.map(l => [l.id, l])),
      }),
      updateLight: (id, patch) => set(state => ({
        lights: { ...state.lights, [id]: { ...state.lights[id], ...patch } },
      })),
      setGroups: (list) => set({
        groups: Object.fromEntries(list.map(g => [g.id, g])),
      }),
      setScenes: (list) => set({ scenes: list }),
      setSensors: (list) => set({
        sensors: Object.fromEntries(list.map(s => [s.id, s])),
      }),
      setSchedules: (list) => set({
        schedules: Object.fromEntries(list.map(s => [s.id, s])),
      }),

      // ── Light actions ─────────────────────────────────────────────────
      toggleLight: async (id) => {
        const light = get().lights[id];
        if (!light) return;
        const newOn = !light.on;
        get().updateLight(id, { on: newOn });
        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(40);
        try {
          await setLightState(id, { on: newOn });
        } catch {
          get().updateLight(id, { on: light.on });
        }
      },

      setLightBrightness: async (id, bri) => {
        get().updateLight(id, { bri, on: bri > 0 });
        await setLightState(id, { bri: Math.round(bri), on: bri > 0 });
      },

      setLightColor: async (id, xy) => {
        get().updateLight(id, { xy, colormode: 'xy' });
        await setLightState(id, { xy, colormode: 'xy' });
      },

      setLightColorTemp: async (id, ct) => {
        get().updateLight(id, { ct, colormode: 'ct' });
        await setLightState(id, { ct: Math.round(ct), colormode: 'ct' });
      },

      setLightSaturation: async (id, sat) => {
        get().updateLight(id, { sat });
        await setLightState(id, { sat: Math.round(sat) });
      },

      setLightAlert: async (id, alert) => {
        await setLightState(id, { alert });
      },

      setLightEffect: async (id, effect) => {
        get().updateLight(id, { effect });
        await setLightState(id, { effect });
      },

      toggleGroup: async (id) => {
        const group = get().groups[id];
        if (!group) return;
        const newOn = !group.on;
        if (navigator.vibrate) navigator.vibrate(40);
        set(state => ({
          groups: { ...state.groups, [id]: { ...state.groups[id], on: newOn } },
        }));
        await setGroupState(id, { on: newOn });
      },

      activateScene: async (sceneId, groupId) => {
        await activateScene(sceneId, groupId);
        setTimeout(() => get().refresh(), 500);
      },

      // Load extended light detail (product info, capabilities)
      loadLightDetail: async (lightId) => {
        try {
          const detail = await fetchLightDetail(lightId);
          set(state => ({
            lightDetails: { ...state.lightDetails, [lightId]: detail },
          }));
        } catch { /* silently ignore */ }
      },

      // ── Schedule actions ──────────────────────────────────────────────
      createSchedule: async (data) => {
        const id = await createSchedule(data);
        const schedules = await fetchSchedules();
        get().setSchedules(schedules);
        return id;
      },
      updateSchedule: async (id, patch) => {
        await updateSchedule(id, patch);
        const schedules = await fetchSchedules();
        get().setSchedules(schedules);
      },
      deleteSchedule: async (id) => {
        await deleteSchedule(id);
        set(state => {
          const next = { ...state.schedules };
          delete next[id];
          return { schedules: next };
        });
      },

      // ── Data fetching ─────────────────────────────────────────────────
      refresh: async () => {
        try {
          const [lights, groups, scenes] = await Promise.all([
            fetchLights(), fetchGroups(), fetchScenes(),
          ]);
          get().setLights(lights);
          get().setGroups(groups);
          get().setScenes(scenes);
          set({ connected: true });
        } catch (e) {
          console.warn('Hue refresh error:', e.message);
        }
      },

      // Full refresh including sensors, schedules, config
      refreshAll: async () => {
        try {
          const [lights, groups, scenes, sensors, schedules, rules, config, caps] =
            await Promise.all([
              fetchLights(), fetchGroups(), fetchScenes(),
              fetchSensors(), fetchSchedules(), fetchRules(),
              fetchBridgeConfig(), fetchCapabilities(),
            ]);
          get().setLights(lights);
          get().setGroups(groups);
          get().setScenes(scenes);
          get().setSensors(sensors);
          get().setSchedules(schedules);
          set({ rules, bridgeConfig: config, capabilities: caps, connected: true });
        } catch (e) {
          console.warn('Hue refreshAll error:', e.message);
        }
      },

      startPolling: () => {
        const stop = startPolling((lights) => get().setLights(lights), 3000);
        set({ pollingStop: stop });
      },

      stopPolling: () => {
        get().pollingStop?.();
        set({ pollingStop: null });
      },

      // ── Circadian mode ────────────────────────────────────────────────
      circadianMode: false,
      setCircadianMode: (v) => set({ circadianMode: v }),

      /** Get target ct + bri for current time of day */
      getCircadianTarget: () => {
        const now = new Date();
        const h = now.getHours() + now.getMinutes() / 60;
        // 23:00–06:00 → nacht (warm dim)
        if (h >= 23 || h < 6)  return { ct: 500, bri: 30  };
        // 06:00–08:00 → zonsopgang (warm)
        if (h < 8)              return { ct: 447, bri: 144 };
        // 08:00–17:00 → daglicht (koel)
        if (h < 17)             return { ct: 233, bri: 220 };
        // 17:00–20:00 → avond (neutraal)
        if (h < 20)             return { ct: 370, bri: 200 };
        // 20:00–23:00 → laat avond (warm)
        return                       { ct: 447, bri: 144 };
      },

      applyCircadian: async () => {
        const { ct, bri } = get().getCircadianTarget();
        const lightIds = Object.keys(get().lights);
        await Promise.all(lightIds.map(id => {
          const l = get().lights[id];
          if (!l?.on) return Promise.resolve();
          return setLightState(id, { ct, bri, colormode: 'ct' }).catch(() => {});
        }));
        lightIds.forEach(id => {
          get().updateLight(id, { ct, bri, colormode: 'ct' });
        });
      },

      // ── Vacation mode ─────────────────────────────────────────────────
      vacationMode: false,
      vacationTimer: null,

      startVacationMode: () => {
        if (get().vacationMode) return;
        set({ vacationMode: true });
        const schedule = () => {
          const lightIds = Object.keys(get().lights);
          if (!lightIds.length) return;
          // Pick 1-3 random lights to toggle
          const count = Math.floor(Math.random() * 3) + 1;
          const toToggle = lightIds.sort(() => Math.random() - 0.5).slice(0, count);
          toToggle.forEach(id => {
            const on = Math.random() > 0.4; // 60% chance on
            const bri = 80 + Math.floor(Math.random() * 150);
            setLightState(id, { on, bri }).catch(() => {});
            get().updateLight(id, { on, bri });
          });
          // Next cycle: 3–12 minutes
          const delay = (3 + Math.random() * 9) * 60 * 1000;
          const timer = setTimeout(schedule, delay);
          set({ vacationTimer: timer });
        };
        // First trigger after 30 seconds
        const timer = setTimeout(schedule, 30000);
        set({ vacationTimer: timer });
      },

      stopVacationMode: () => {
        clearTimeout(get().vacationTimer);
        set({ vacationMode: false, vacationTimer: null });
      },

      // ── Floor plans ───────────────────────────────────────────────────
      rooms: [],

      addRoom: (room) => set(state => ({ rooms: [...state.rooms, room] })),
      updateRoom: (id, patch) => set(state => ({
        rooms: state.rooms.map(r => r.id === id ? { ...r, ...patch } : r),
      })),
      deleteRoom: (id) => set(state => ({
        rooms: state.rooms.filter(r => r.id !== id),
      })),

      activeRoomId: null,
      setActiveRoom: (id) => set({ activeRoomId: id }),

      // ── UI state ──────────────────────────────────────────────────────
      editMode: false,
      setEditMode: (v) => set({ editMode: v }),

      // Basic = tik aan/uit + helderheid alleen
      // Advanced = kleur, kleurtemp, effecten, info, sensoren, timers
      advancedMode: false,
      setAdvancedMode: (v) => set({ advancedMode: v }),
      toggleAdvancedMode: () => set(state => ({ advancedMode: !state.advancedMode })),
    }),
    {
      name: 'hue-room-storage',
      partialize: (state) => ({
        rooms: state.rooms,
        activeRoomId: state.activeRoomId,
        circadianMode: state.circadianMode,
      }),
    }
  )
);
