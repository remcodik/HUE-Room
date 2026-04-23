import { useState, useEffect } from 'react';
import { useHueStore } from '../store/useHueStore';
import { getLightColor } from '../services/hue';
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
  } = useHueStore();

  const [showRoomEditor, setShowRoomEditor] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [showScenes, setShowScenes] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [selectedLightId, setSelectedLightId] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activeRoom = rooms.find(r => r.id === activeRoomId) || rooms[0] || null;
  const lightList = Object.values(lights);

  useEffect(() => {
    refresh();
    startPolling();
    return () => stopPolling();
  }, []);

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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const lightsOn = lightList.filter(l => l.on);
  const allLightsOn = lightList.length > 0 && lightList.every(l => l.on);
  const anyLightOn = lightsOn.length > 0;

  const toggleAllLights = () => {
    const newState = !allLightsOn;
    lightList.forEach(l => {
      if (l.on !== newState) {
        useHueStore.getState().toggleLight(l.id);
      }
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 safe-top">

      {/* ── Top bar ── */}
      <header className="flex items-center gap-2 px-4 py-3 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-sm">

        {/* Room name / menu toggle */}
        <button
          onClick={() => setShowSidebar(true)}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${
            anyLightOn ? 'bg-amber-400/20' : 'bg-slate-800'
          }`}>
            🏠
          </div>
          <div className="min-w-0 text-left">
            <p className="text-white font-semibold text-sm leading-tight truncate max-w-40">
              {activeRoom?.name || 'Geen kamer'}
            </p>
            {lightList.length > 0 && (
              <p className="text-slate-500 text-xs">
                {lightsOn.length} van {lightList.length} aan
              </p>
            )}
          </div>
          <svg width="14" height="14" viewBox="0 0 14 14" className="text-slate-600 flex-shrink-0">
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Action buttons */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setShowScenes(true)}
            className="w-9 h-9 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700/80 text-base transition-colors"
            title="Scenes"
          >
            ✨
          </button>

          <button
            onClick={() => setEditMode(!editMode)}
            className={`w-9 h-9 flex items-center justify-center rounded-xl border text-base transition-all ${
              editMode
                ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-500/25'
                : 'bg-slate-800 border-slate-700/80 hover:bg-slate-700'
            }`}
            title={editMode ? 'Bewerkmodus uit' : 'Lampen verplaatsen'}
          >
            ✏️
          </button>

          <button
            onClick={handleRefresh}
            className={`w-9 h-9 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700/80 text-base transition-all ${
              isRefreshing ? 'opacity-60' : ''
            }`}
            title="Vernieuwen"
          >
            <span className={isRefreshing ? 'animate-spin inline-block' : ''}>🔄</span>
          </button>
        </div>
      </header>

      {/* ── Edit mode banner ── */}
      {editMode && (
        <div className="bg-blue-600/95 text-white text-xs px-4 py-2.5 text-center font-medium">
          Bewerkmodus — sleep lampen naar positie · Tik ✏️ om te stoppen
        </div>
      )}

      {/* ── Main floor plan ── */}
      <main className="flex-1 relative overflow-hidden">
        {rooms.length === 0 ? (
          <EmptyState onAdd={() => { setEditingRoom(null); setShowRoomEditor(true); }} />
        ) : activeRoom ? (
          <FloorPlan room={activeRoom} />
        ) : (
          <EmptyState onAdd={() => { setEditingRoom(null); setShowRoomEditor(true); }} />
        )}
      </main>

      {/* ── Bottom bar ── */}
      <footer className="border-t border-slate-800/80 bg-slate-950/95 backdrop-blur-sm safe-bottom">

        {/* Room tabs (if multiple rooms) */}
        {rooms.length > 1 && (
          <div className="flex gap-1 px-3 pt-2 overflow-x-auto no-scrollbar">
            {rooms.map(room => (
              <button
                key={room.id}
                onClick={() => setActiveRoom(room.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                  room.id === activeRoomId
                    ? 'bg-amber-400/15 border border-amber-400/30 text-amber-300'
                    : 'text-slate-500 hover:text-slate-300 border border-transparent'
                }`}
              >
                🏠 {room.name}
              </button>
            ))}
            <button
              onClick={() => { setEditingRoom(null); setShowRoomEditor(true); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs text-slate-600 hover:text-slate-400 whitespace-nowrap flex-shrink-0 border border-transparent transition-colors"
            >
              + Kamer
            </button>
          </div>
        )}

        {/* Controls row */}
        <div className="flex items-center gap-3 px-4 py-3">

          {/* Master toggle */}
          <button
            onClick={toggleAllLights}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-sm font-semibold transition-all ${
              allLightsOn
                ? 'bg-amber-400/15 border-amber-400/40 text-amber-300'
                : anyLightOn
                ? 'bg-amber-400/08 border-amber-400/20 text-amber-400/60'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            <span className="text-base">{allLightsOn ? '💡' : anyLightOn ? '💡' : '🌑'}</span>
            {allLightsOn ? 'Alles aan' : anyLightOn ? `${lightsOn.length} aan` : 'Alles uit'}
          </button>

          <div className="flex-1" />

          {/* Shortcuts button */}
          <button
            onClick={() => setShowShortcuts(true)}
            className="w-9 h-9 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700/80 text-base transition-colors"
            title="iPhone Opdrachten"
          >
            🔗
          </button>

          {/* Mini light dots */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar max-w-36">
            {lightList.slice(0, 7).map(l => (
              <button
                key={l.id}
                onClick={() => setSelectedLightId(l.id)}
                className={`w-7 h-7 rounded-full border-2 flex-shrink-0 transition-all active:scale-90 ${
                  l.on ? 'border-amber-400/50 shadow-sm' : 'border-slate-700 opacity-40'
                }`}
                style={{ background: l.on ? getLightColor(l) : '#1e293b' }}
                title={l.name}
              />
            ))}
            {lightList.length > 7 && (
              <div className="w-7 h-7 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-500 text-xs flex-shrink-0">
                +{lightList.length - 7}
              </div>
            )}
          </div>
        </div>
      </footer>

      {/* ── Sidebar (room list) ── */}
      {showSidebar && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSidebar(false)}
          />
          <div className="relative w-72 bg-slate-900 border-r border-slate-800 h-full flex flex-col safe-top">
            <div className="px-5 py-4 border-b border-slate-800">
              <h2 className="text-white font-bold text-base">Kamers</h2>
              <p className="text-slate-500 text-xs mt-0.5">{rooms.length} kamer{rooms.length !== 1 ? 's' : ''}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {rooms.map(room => {
                const placedCount = room.lightPlacements?.length || 0;
                return (
                  <div key={room.id} className="flex items-center gap-1">
                    <button
                      onClick={() => { setActiveRoom(room.id); setShowSidebar(false); }}
                      className={`flex-1 flex items-center gap-3 px-3 py-3 rounded-2xl text-sm transition-all ${
                        room.id === activeRoomId
                          ? 'bg-amber-400/10 border border-amber-400/25 text-amber-300'
                          : 'text-slate-300 hover:bg-slate-800 border border-transparent'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base ${
                        room.id === activeRoomId ? 'bg-amber-400/20' : 'bg-slate-800'
                      }`}>
                        🏠
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-semibold truncate">{room.name}</p>
                        <p className="text-xs text-slate-500">{placedCount} lamp{placedCount !== 1 ? 'en' : ''}</p>
                      </div>
                      {room.id === activeRoomId && (
                        <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                      )}
                    </button>
                    <button
                      onClick={() => { setEditingRoom(room); setShowRoomEditor(true); setShowSidebar(false); }}
                      className="w-8 h-8 flex items-center justify-center text-slate-600 hover:text-slate-300 rounded-xl hover:bg-slate-800 transition-all text-sm"
                      title="Bewerken"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`"${room.name}" verwijderen?`)) {
                          deleteRoom(room.id);
                          if (activeRoomId === room.id) {
                            const remaining = rooms.filter(r => r.id !== room.id);
                            if (remaining.length > 0) setActiveRoom(remaining[0].id);
                          }
                        }
                      }}
                      className="w-8 h-8 flex items-center justify-center text-slate-700 hover:text-red-400 rounded-xl hover:bg-red-900/20 transition-all text-sm"
                      title="Verwijderen"
                    >
                      🗑
                    </button>
                  </div>
                );
              })}

              <button
                onClick={() => { setEditingRoom(null); setShowRoomEditor(true); setShowSidebar(false); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-sm text-blue-400 hover:bg-blue-900/15 border border-dashed border-blue-900 hover:border-blue-700 transition-all"
              >
                <div className="w-8 h-8 rounded-xl bg-blue-900/30 flex items-center justify-center text-blue-400">+</div>
                <span className="font-medium">Kamer toevoegen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Overlays ── */}
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
        <div className="fixed inset-0 bg-slate-950 z-50">
          <ShortcutsGuide onClose={() => setShowShortcuts(false)} />
        </div>
      )}
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-8 text-center">
      <div className="w-24 h-24 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-5xl">
        🏠
      </div>
      <div>
        <h2 className="text-white font-bold text-xl">Maak je eerste kamer aan</h2>
        <p className="text-slate-500 text-sm mt-2 leading-relaxed max-w-xs">
          Teken een plattegrond en plaats je Hue lampen op de kaart om ze visueel te bedienen.
        </p>
      </div>
      <button
        onClick={onAdd}
        className="px-7 py-3.5 bg-gradient-to-r from-amber-400 to-orange-400 text-slate-900 font-bold rounded-2xl text-sm shadow-lg shadow-amber-400/25 active:scale-98 transition-all"
      >
        + Kamer aanmaken
      </button>
    </div>
  );
}
