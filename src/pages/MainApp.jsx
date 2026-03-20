import { useState, useEffect } from 'react';
import { useHueStore } from '../store/useHueStore';
import { getLightColor, clearConfig } from '../services/hue';
import FloorPlan from '../components/FloorPlan';
import RoomEditor from '../components/RoomEditor';
import ScenePanel from '../components/ScenePanel';
import LightControls from '../components/LightControls';
import ShortcutsGuide from '../components/ShortcutsGuide';

export default function MainApp() {
  const {
    lights, groups, rooms, activeRoomId,
    setActiveRoom, addRoom, updateRoom, deleteRoom,
    editMode, setEditMode,
    refresh, startPolling, stopPolling,
    toggleLight, disconnect,
  } = useHueStore();

  const handleDisconnect = () => {
    disconnect();
    clearConfig();
    window.location.reload();
  };

  const [showRoomEditor, setShowRoomEditor] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [showScenes, setShowScenes] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [selectedLightId, setSelectedLightId] = useState(null);

  const activeRoom = rooms.find(r => r.id === activeRoomId) || rooms[0] || null;
  const lightList = Object.values(lights);

  useEffect(() => {
    refresh();
    startPolling();
    return () => stopPolling();
  }, []);

  // Auto-select first room
  useEffect(() => {
    if (!activeRoomId && rooms.length > 0) {
      setActiveRoom(rooms[0].id);
    }
  }, [rooms, activeRoomId]);

  const handleSaveRoom = (roomData) => {
    if (editingRoom) {
      updateRoom(roomData.id, roomData);
    } else {
      addRoom(roomData);
      setActiveRoom(roomData.id);
    }
    setShowRoomEditor(false);
    setEditingRoom(null);
  };

  const allLightsOn = lightList.length > 0 && lightList.every(l => l.on);

  return (
    <div className="flex flex-col h-full bg-slate-950 safe-top">
      {/* ── Top bar ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/80">
        {/* Sidebar toggle / room name */}
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="flex items-center gap-2 text-white font-semibold text-base"
        >
          <span className="text-xl">🏠</span>
          <span className="max-w-32 truncate">{activeRoom?.name || 'Geen kamer'}</span>
          <svg width="14" height="14" viewBox="0 0 14 14" className="text-slate-400 mt-0.5">
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          </svg>
        </button>

        <div className="flex-1" />

        {/* Quick actions */}
        <button
          onClick={() => setShowShortcuts(true)}
          className="w-9 h-9 flex items-center justify-center bg-slate-800 rounded-xl border border-slate-700 text-base"
          title="iPhone Opdrachten"
        >
          🔗
        </button>

        <button
          onClick={() => setShowScenes(true)}
          className="w-9 h-9 flex items-center justify-center bg-slate-800 rounded-xl border border-slate-700 text-base"
          title="Scenes"
        >
          ✨
        </button>

        <button
          onClick={() => setEditMode(!editMode)}
          className={`w-9 h-9 flex items-center justify-center rounded-xl border text-base transition-all ${
            editMode
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-slate-800 border-slate-700'
          }`}
          title="Bewerkmodus"
        >
          ✏️
        </button>

        <button
          onClick={refresh}
          className="w-9 h-9 flex items-center justify-center bg-slate-800 rounded-xl border border-slate-700 text-base"
          title="Vernieuwen"
        >
          🔄
        </button>
      </div>

      {/* ── Main content ──────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        {rooms.length === 0 ? (
          <EmptyState onAdd={() => setShowRoomEditor(true)} />
        ) : activeRoom ? (
          <FloorPlan room={activeRoom} />
        ) : (
          <EmptyState onAdd={() => setShowRoomEditor(true)} />
        )}

        {/* Edit mode banner */}
        {editMode && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-blue-600/90 text-white text-xs px-4 py-2 rounded-full backdrop-blur-sm pointer-events-none">
            Bewerkmodus — sleep lampen naar positie
          </div>
        )}
      </div>

      {/* ── Bottom bar ────────────────────────────────────────── */}
      <div className="border-t border-slate-800/80 px-4 py-3 safe-bottom">
        <div className="flex items-center gap-3">
          {/* Master on/off */}
          <button
            onClick={() => {
              const newState = !allLightsOn;
              lightList.forEach(l => {
                if (l.on !== newState) {
                  useHueStore.getState().toggleLight(l.id);
                }
              });
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              allLightsOn
                ? 'bg-amber-400/20 border-amber-400/60 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <span className="text-base">{allLightsOn ? '💡' : '🌑'}</span>
            {allLightsOn ? 'Alles aan' : 'Alles uit'}
          </button>

          {/* Light count */}
          <div className="text-xs text-slate-500">
            {lightList.filter(l => l.on).length}/{lightList.length} aan
          </div>

          <div className="flex-1" />

          {/* Mini light list (iPad: show more) */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar max-w-48">
            {lightList.slice(0, 6).map(l => (
              <button
                key={l.id}
                onClick={() => setSelectedLightId(l.id)}
                className={`w-8 h-8 rounded-full border flex-shrink-0 transition-all ${
                  l.on ? 'border-amber-400/60' : 'border-slate-700 opacity-50'
                }`}
                style={{ background: l.on ? getLightDotColor(l) : '#1e293b' }}
                title={l.name}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Sidebar (room list) ───────────────────────────────── */}
      {showSidebar && (
        <div className="fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowSidebar(false)} />
          <div className="relative w-72 bg-slate-900 border-r border-slate-700 h-full overflow-y-auto safe-top">
            <div className="px-5 py-4 border-b border-slate-800">
              <h2 className="text-white font-semibold">Kamers</h2>
            </div>
            <div className="p-3 space-y-1">
              {rooms.map(room => (
                <div key={room.id} className="flex items-center gap-2">
                  <button
                    onClick={() => { setActiveRoom(room.id); setShowSidebar(false); }}
                    className={`flex-1 flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all ${
                      room.id === activeRoomId
                        ? 'bg-amber-400/10 border border-amber-400/30 text-amber-300'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>🏠</span>
                    <span className="font-medium">{room.name}</span>
                    <span className="ml-auto text-xs text-slate-500">
                      {room.lightPlacements?.length || 0}💡
                    </span>
                  </button>
                  <button
                    onClick={() => { setEditingRoom(room); setShowRoomEditor(true); setShowSidebar(false); }}
                    className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-300 text-sm"
                  >
                    ✏️
                  </button>
                </div>
              ))}

              <button
                onClick={() => { setEditingRoom(null); setShowRoomEditor(true); setShowSidebar(false); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-blue-400 hover:bg-blue-900/20 border border-dashed border-blue-800"
              >
                <span>+</span> Kamer toevoegen
              </button>
            </div>

            <div className="px-3 pb-5 pt-2 border-t border-slate-800 mt-2">
              <button
                onClick={handleDisconnect}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-red-400 hover:bg-red-900/20"
              >
                <span>🔌</span> Verbinding verbreken
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Overlays ─────────────────────────────────────────── */}
      {showRoomEditor && (
        <div className="fixed inset-0 z-50 bg-slate-950">
          <RoomEditor
            room={editingRoom}
            onSave={handleSaveRoom}
            onCancel={() => { setShowRoomEditor(false); setEditingRoom(null); }}
          />
        </div>
      )}

      {showScenes && (
        <ScenePanel
          groupId={Object.keys(groups)[0]}
          onClose={() => setShowScenes(false)}
        />
      )}

      {selectedLightId && (
        <LightControls
          lightId={selectedLightId}
          onClose={() => setSelectedLightId(null)}
        />
      )}

      {showShortcuts && (
        <div className="absolute inset-0 bg-slate-950 z-50">
          <ShortcutsGuide onClose={() => setShowShortcuts(false)} />
        </div>
      )}
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-8 text-center">
      <div className="w-20 h-20 rounded-3xl bg-slate-800 flex items-center justify-center text-4xl">
        🏠
      </div>
      <div>
        <h2 className="text-white font-semibold text-lg">Geen kamer</h2>
        <p className="text-slate-400 text-sm mt-1 leading-relaxed">
          Maak een plattegrond aan en plaats uw Hue lampen op de kaart.
        </p>
      </div>
      <button
        onClick={onAdd}
        className="px-6 py-3 bg-gradient-to-r from-amber-400 to-orange-400 text-slate-900 font-semibold rounded-2xl text-sm active:scale-98 transition-all"
      >
        Kamer aanmaken
      </button>
    </div>
  );
}

function getLightDotColor(light) {
  if (!light.on) return '#1e293b';
  return getLightColor(light);
}
