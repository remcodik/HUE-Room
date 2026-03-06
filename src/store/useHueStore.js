import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  fetchLights, fetchGroups, fetchScenes,
  setLightState, setGroupState, activateScene,
  startPolling, isConfigured,
} from '../services/hue';

export const useHueStore = create(
  persist(
    (set, get) => ({
      // ── Connection ──────────────────────────────────────────────────
      connected: false,
      bridgeIp: null,
      username: null,
      pollingStop: null,

      setConnection: (ip, username) => set({ bridgeIp: ip, username, connected: true }),
      disconnect: () => {
        get().pollingStop?.();
        set({ connected: false, bridgeIp: null, username: null, pollingStop: null });
      },

      // ── Lights ──────────────────────────────────────────────────────
      lights: {},        // { [id]: lightObj }
      groups: {},        // { [id]: groupObj }
      scenes: [],

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

      // ── Actions ─────────────────────────────────────────────────────
      toggleLight: async (id) => {
        const light = get().lights[id];
        if (!light) return;
        const newOn = !light.on;
        get().updateLight(id, { on: newOn });
        try {
          await setLightState(id, { on: newOn });
        } catch {
          get().updateLight(id, { on: light.on }); // rollback
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

      toggleGroup: async (id) => {
        const group = get().groups[id];
        if (!group) return;
        const newOn = !group.on;
        set(state => ({
          groups: { ...state.groups, [id]: { ...state.groups[id], on: newOn } },
        }));
        await setGroupState(id, { on: newOn });
      },

      activateScene: async (sceneId, groupId) => {
        await activateScene(sceneId, groupId);
        setTimeout(() => get().refresh(), 500);
      },

      // ── Data fetching ────────────────────────────────────────────────
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

      startPolling: () => {
        const stop = startPolling((lights) => get().setLights(lights), 3000);
        set({ pollingStop: stop });
      },

      stopPolling: () => {
        get().pollingStop?.();
        set({ pollingStop: null });
      },

      // ── Floor plans ──────────────────────────────────────────────────
      rooms: [],           // saved floor plan rooms

      addRoom: (room) => set(state => ({ rooms: [...state.rooms, room] })),
      updateRoom: (id, patch) => set(state => ({
        rooms: state.rooms.map(r => r.id === id ? { ...r, ...patch } : r),
      })),
      deleteRoom: (id) => set(state => ({
        rooms: state.rooms.filter(r => r.id !== id),
      })),

      activeRoomId: null,
      setActiveRoom: (id) => set({ activeRoomId: id }),

      // ── UI state ─────────────────────────────────────────────────────
      selectedLightId: null,
      setSelectedLight: (id) => set({ selectedLightId: id }),
      editMode: false,
      setEditMode: (v) => set({ editMode: v }),
    }),
    {
      name: 'hue-room-storage',
      partialize: (state) => ({
        rooms: state.rooms,
        activeRoomId: state.activeRoomId,
      }),
    }
  )
);
