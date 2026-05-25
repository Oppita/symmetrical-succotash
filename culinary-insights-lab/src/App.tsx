import React, { useState } from 'react';
import { Calendar, Bookmark, Settings, QrCode, Users, LogOut, Cloud, CloudOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Toaster } from 'sonner';
import QRCode from 'react-qr-code';
import { useAgendaData } from './hooks/useAgendaData';
import { FilterBar } from './components/FilterBar';
import { AgendaCard } from './components/AgendaCard';
import { RoomModal } from './components/RoomModal';
import { EventModal } from './components/EventModal';
import { AdminEventDetailsModal } from './components/AdminEventDetailsModal';
import { AdminPanel } from './components/AdminPanel';
import { QRControlPanel } from './components/QRControlPanel';
import { InteractiveMap } from './components/InteractiveMap';
import { formatTime, classNames } from './lib/utils';
import { Room, AgendaEvent } from './data/agenda';
import { useAuth } from './context/AuthContext';

export default function App() {
  const { loading } = useAuth();
  
  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return <MainApp />;
}

function MainApp() {
  const { isAdmin, signOut } = useAuth();
  const {
    events,
    groupedEvents,
    rooms,
    setRooms,
    setEventsData,
    bookmarks,
    toggleBookmark,
    registrations,
    registerForEvent,
    cancelRegistration,
    searchQuery,
    setSearchQuery,
    selectedType,
    setSelectedType,
    selectedRoom,
    setSelectedRoom,
    viewMode,
    setViewMode,
    selectedDay,
    setSelectedDay,
    availableDays,
    syncData,
    syncStatus,
    lastSynced,
    supabaseLog,
    clearLocalCache,
    deleteEvent,
    saveEvent,
    saveRoom,
    deleteRoom,
  } = useAgendaData();

  const [activeRoomModal, setActiveRoomModal] = useState<Room | null>(null);
  const [activeEventModal, setActiveEventModal] = useState<AgendaEvent | null>(null);
  const [activeAdminEventModal, setActiveAdminEventModal] = useState<AgendaEvent | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isQRHubOpen, setIsQRHubOpen] = useState(false);
  const [qrHubInitialTab, setQrHubInitialTab] = useState<'ROOM' | 'MEAL' | 'DIRECTORY'>('ROOM');

  const handleRoomClick = (roomId: string) => {
    const room = rooms.find(r => r.id === roomId) || null;
    setActiveRoomModal(room);
  };

  const openQRHub = (tab: 'ROOM' | 'MEAL' | 'DIRECTORY') => {
    setQrHubInitialTab(tab);
    setIsQRHubOpen(true);
  };

  const handleCardClick = (event: AgendaEvent) => {
    if (isAdmin) {
      setActiveAdminEventModal(event);
    } else {
      setActiveEventModal(event);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden text-slate-800 bg-slate-50">
      <Toaster position="top-right" richColors />
      {/* Header */}
      <header className="h-auto min-h-16 py-3 lg:py-0 lg:h-16 bg-white border-b border-slate-250 text-slate-800 flex flex-col lg:flex-row items-center justify-between px-6 shrink-0 z-40 gap-3 lg:gap-0 shadow-sm">
        <div className="flex items-center gap-4 w-full lg:w-auto overflow-x-auto scrollbar-hide pb-1 lg:pb-0">
          <div className="w-10 h-10 bg-emerald-600 text-white rounded-lg flex items-center justify-center font-black text-xl italic uppercase shrink-0">P</div>
          <div className="flex items-center gap-4 shrink-0">
            <div>
              <h1 className="text-xl font-black tracking-tight leading-none uppercase text-emerald-800">PN26</h1>
              <p className="text-[10px] text-slate-500 font-bold tracking-widest mt-1 uppercase hidden sm:block">Plataforma de Navegación</p>
            </div>
            
            {/* Sync Indicator */}
            {isAdmin && (
              <button 
                onClick={syncData}
                title={`Forzar Sincronización. Última act: ${lastSynced ? lastSynced.toLocaleTimeString() : 'N/A'}`}
                className="ml-2 sm:ml-4 flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 text-slate-700 transition"
              >
                {syncStatus === 'syncing' && <RefreshCw className="w-3.5 h-3.5 text-emerald-500 animate-spin" />}
                {syncStatus === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                {syncStatus === 'error' && <CloudOff className="w-3.5 h-3.5 text-red-500" />}
                {syncStatus === 'idle' && <Cloud className="w-3.5 h-3.5 text-slate-400" />}
                
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider hidden md:inline-block">
                  {syncStatus === 'syncing' 
                    ? 'Sincronizando...' 
                    : syncStatus === 'success' 
                      ? `${supabaseLog?.events || 0} charlas • ${supabaseLog?.rooms || 0} salas` 
                      : syncStatus === 'error' 
                        ? 'Error Sync' 
                        : 'Sync'}
                </span>
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2 sm:gap-3 items-center w-full lg:w-auto overflow-x-auto scrollbar-hide pb-1 lg:pb-0">
          {isAdmin && (
            <>
              <button 
                className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-500 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-[10px] font-black transition-colors uppercase tracking-widest text-white shadow-md shrink-0"
                onClick={() => openQRHub('DIRECTORY')}
              >
                <Users className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Directorio</span>
              </button>
              <button 
                className="flex items-center gap-1.5 px-3 py-1.5 border border-teal-500 bg-teal-600 hover:bg-teal-500 rounded-lg text-[10px] font-black transition-colors uppercase tracking-widest text-white shadow-md shrink-0"
                onClick={() => openQRHub('ROOM')}
              >
                <QrCode className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Escáner</span>
              </button>
              <button 
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-750 rounded-lg text-[10px] font-black transition-colors uppercase tracking-widest shrink-0"
                onClick={() => setIsAdminOpen(true)}
              >
                <Settings className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Config</span>
              </button>
              <button 
                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg text-[10px] font-black transition-colors uppercase tracking-widest text-red-700 shrink-0"
                onClick={() => signOut()}
                title="Salir del modo administrador"
              >
                <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Salir</span>
              </button>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        
        {/* Hero Interactive Map */}
        <div className="h-[35vh] lg:h-[45vh] shrink-0 border-b border-slate-200 relative z-10 shadow-sm bg-white">
            <InteractiveMap rooms={rooms} onSelectRoom={(id) => setSelectedRoom(prev => prev === id ? 'All' : id)} />
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <aside className="hidden lg:flex w-80 bg-white border-r border-slate-200 p-6 flex-col gap-8 overflow-y-auto relative z-20">
               <div className="relative z-10">
                 <FilterBar 
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    selectedType={selectedType}
                    setSelectedType={setSelectedType}
                    selectedRoom={selectedRoom}
                    setSelectedRoom={setSelectedRoom}
                    rooms={rooms}
                  />
               </div>
          </aside>

          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 relative">
            
            {/* Days & Main Navigation */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 shadow-sm z-30">
               <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto scroller-hide">
                  {availableDays.map((day, index) => (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      className={classNames(
                        "flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-widest whitespace-nowrap",
                        selectedDay === day 
                          ? "bg-white text-slate-800 shadow-sm scale-[1.02] border border-slate-200" 
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      DÍA {index + 1}
                    </button>
                  ))}
                  {availableDays.length === 0 && (
                     <div className="px-6 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Aún no hay días</div>
                  )}
               </div>

               <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scroller-hide">
                  <button 
                    onClick={() => setViewMode('All')}
                    className={classNames(
                      "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border",
                      viewMode === 'All' ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    AGENDA GENERAL
                  </button>
                  <button 
                    onClick={() => setViewMode('MyAgenda')}
                    className={classNames(
                      "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap border",
                      viewMode === 'MyAgenda' ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    <Bookmark className="w-3.5 h-3.5" /> MIS SESIONES ({bookmarks.size})
                  </button>
               </div>
            </div>

          <main className="flex-1 overflow-y-auto p-6 md:p-8">
             <div className="max-w-7xl mx-auto">
                 {viewMode === 'MyAgenda' && bookmarks.size === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-white rounded-3xl border-2 border-dashed border-slate-200 shadow-sm">
                    <Bookmark className="w-12 h-12 mb-4 opacity-20" />
                    <p className="font-bold uppercase tracking-widest text-xs">No tienes sesiones guardadas aún</p>
                    <button onClick={() => setViewMode('All')} className="mt-4 text-blue-600 text-[10px] font-black uppercase hover:underline">Ir a la agenda general</button>
                  </div>
                ) : Object.keys(groupedEvents).length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                    <Calendar className="w-12 h-12 mb-4 opacity-20" />
                    <p className="font-bold uppercase tracking-widest text-xs">No se encontraron sesiones</p>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Prueba ajustando los filtros o la búsqueda</p>
                  </div>
                ) : (
                  <div className="space-y-12 pb-20">
                    {Object.entries(groupedEvents).map(([dayKey, timeGroups]) => (
                      <div key={dayKey} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-6">
                          {Object.entries(timeGroups).sort().map(([time, events]) => (
                            <div key={time} className="grid grid-cols-1 lg:grid-cols-[120px_1fr] gap-4 md:gap-8 border-b border-slate-200 pb-8 last:border-0 relative z-10">
                              {/* Time Block Column */}
                              <div className="lg:sticky lg:top-8 self-start">
                                <div className="bg-emerald-50 text-emerald-800 border-2 border-emerald-200/50 px-4 py-3 rounded-2xl inline-block lg:block text-center shadow-sm">
                                  <span className="text-lg font-black tracking-tighter">
                                    {formatTime(time)}
                                  </span>
                                </div>
                              </div>

                              {/* Sessions Cards Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {events.map(event => (
                                  <AgendaCard
                                    key={event.id}
                                    event={event}
                                    room={rooms.find(r => r.id === event.roomId)}
                                    isBookmarked={bookmarks.has(event.id)}
                                    onToggleBookmark={toggleBookmark}
                                    onClickRoom={handleRoomClick}
                                    onClickCard={() => handleCardClick(event)}
                                  />
                                ))}
                              </div>

                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
             </div>

             {/* QR Code Section for feedback */}
             <div className="max-w-[15rem] mx-auto mt-6 mb-8 flex flex-col items-center justify-center p-6 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
                 <h3 className="font-black text-emerald-800 tracking-tight leading-tight mb-2 uppercase text-sm">Déjanos conocer tu opinión</h3>
                 <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-4">Escanea el código QR</p>
                 <div className="p-3 bg-white border-2 border-emerald-50 rounded-xl shadow-sm">
                   <QRCode value="https://symmetrical-succotash-1.onrender.com/q/plataforma2026" size={120} fgColor="#064e3b" />
                 </div>
             </div>
          </main>
        </div>
      </div>
    </div>

    <RoomModal 
        room={activeRoomModal} 
        onClose={() => setActiveRoomModal(null)}
        onFilterByRoom={(roomId) => {
          setSelectedRoom(roomId);
          setActiveRoomModal(null);
        }}
      />

      <EventModal
        event={activeEventModal}
        room={activeEventModal ? rooms.find(r => r.id === activeEventModal.roomId) : undefined}
        isBookmarked={activeEventModal ? bookmarks.has(activeEventModal.id) : false}
        isRegistered={activeEventModal ? registrations.has(activeEventModal.id) : false}
        onClose={() => setActiveEventModal(null)}
        onToggleBookmark={toggleBookmark}
        onRoomClick={handleRoomClick}
        onRegister={activeEventModal ? () => registerForEvent(activeEventModal.id) : () => {}}
        onCancelRegistration={activeEventModal ? () => cancelRegistration(activeEventModal.id) : () => {}}
      />

      {activeAdminEventModal && (
        <AdminEventDetailsModal
          event={activeAdminEventModal}
          room={rooms.find(r => r.id === activeAdminEventModal.roomId)}
          onClose={() => setActiveAdminEventModal(null)}
        />
      )}

      {isAdminOpen && (
          <AdminPanel 
            rooms={rooms}
            setRooms={setRooms}
            events={events}
            setEvents={setEventsData}
            onClose={() => setIsAdminOpen(false)}
            onEventClick={(event) => setActiveAdminEventModal(event)}
            syncData={syncData}
            deleteEvent={deleteEvent}
            saveEvent={saveEvent}
            saveRoom={saveRoom}
            deleteRoom={deleteRoom}
            supabaseLog={supabaseLog}
            clearLocalCache={clearLocalCache}
          />
      )}

      {isQRHubOpen && (
        <QRControlPanel 
          rooms={rooms}
          initialTab={qrHubInitialTab}
          onClose={() => setIsQRHubOpen(false)}
        />
      )}
    </div>
  );
}
