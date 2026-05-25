import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, BarChart2, QrCode, Trash2, Edit2, Share2, Check, RefreshCw, XCircle, Database } from "lucide-react";

export default function Home() {
  const [surveys, setSurveys] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[] | null>(null);
  const [showDbInfo, setShowDbInfo] = useState(false);
  const [dbTestLogs, setDbTestLogs] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  const fetchSurveys = () => {
    fetch("/api/surveys")
      .then(res => res.json())
      .then(setSurveys)
      .catch(console.error);
  };

  const fetchDbStatus = () => {
    fetch("/api/db-status")
      .then(res => res.json())
      .then(setDbStatus)
      .catch(console.error);
  };

  const handleTestDatabase = async () => {
    setIsTesting(true);
    try {
      const res = await fetch("/api/db-retry", { method: "POST" });
      const data = await res.json();
      setDbTestLogs(data);
      fetchDbStatus(); // Update outer status
    } catch (e) {
      console.error(e);
      setDbTestLogs({ error: "Fallo de conexión" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncDatabase = async () => {
    setIsSyncing(true);
    setSyncLogs(null);
    try {
      const res = await fetch("/api/db-sync", { method: "POST" });
      const data = await res.json();
      setSyncLogs(data.logs || ["Error parseando respuesta"]);
    } catch (e) {
      console.error(e);
      setSyncLogs(["Error fatal de red al intentar sincronizar."]);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchSurveys();
    fetchDbStatus();
  }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar la encuesta "${title}"?\nSe borrarán permanentemente todos sus resultados recopilados.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/survey/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setSurveys(prev => prev.filter(s => s.id !== id));
      } else {
        alert("Ocurrió un problema en el servidor al intentar borrar la encuesta.");
      }
    } catch (e) {
      console.error(e);
      alert("Error al intentar eliminar la encuesta.");
    }
  };

  const handleShare = (id: string) => {
    const shareUrl = `${window.location.origin}/q/${id}`;
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2500);
      })
      .catch(err => {
        console.error("Error copying link:", err);
      });
  };

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-12">
      <header className="mb-10 flex flex-col md:flex-row justify-between md:items-end gap-4 border-b border-gray-100 pb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Mis Encuestas</h1>
          <p className="text-gray-500 font-medium mb-3">Gestiona tus cuestionarios, comparte enlaces y analiza los resultados.</p>
          
          {dbStatus && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3.5 py-1.5 text-[11px] font-bold tracking-wider uppercase select-none">
                <span className={`relative flex h-2 w-2`}>
                  {dbStatus.connected && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${dbStatus.connected ? "bg-emerald-500" : "bg-amber-500"}`}></span>
                </span>
                <span className={dbStatus.connected ? "text-emerald-700" : "text-amber-800"}>
                  {dbStatus.connected 
                    ? `⚡ Base de Datos: ${dbStatus.provider}` 
                    : "💾 Servidor Local (data.json)"
                  }
                </span>
              </div>
              
              {dbStatus.provider.includes("Supabase") && (
                <button
                  onClick={handleSyncDatabase}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-full px-4 py-1.5 transition-all text-[11px] font-bold tracking-wider uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
                  {isSyncing ? "Sincronizando..." : "Forzar Sincronización"}
                </button>
              )}
              {dbStatus.stats && (
                <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-3.5 py-1.5 text-[11px] font-bold tracking-wider uppercase select-none text-gray-500 shadow-sm">
                  <BarChart2 size={12} />
                  <span>
                    {dbStatus.stats.surveys} Encuestas | {dbStatus.stats.responses > -1 ? `${dbStatus.stats.responses} Respuestas` : ""}
                  </span>
                </div>
              )}
              <button
                onClick={() => { setShowDbInfo(true); setDbTestLogs(null); }}
                className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white rounded-full px-4 py-1.5 transition-all text-[11px] font-bold tracking-wider uppercase shadow-sm"
              >
                <Database size={12} />
                Diagnóstico BD
              </button>
            </div>
          )}
        </div>
        <Link 
          to="/builder"
          className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 shadow-sm whitespace-nowrap cursor-pointer"
        >
          <Plus size={18} /> Crear Nueva Encuesta
        </Link>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {surveys.map(survey => (
          <div key={survey.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col hover:shadow-md transition-all border-l-4 border-l-primary/60 group">
            <div className="flex justify-between items-start gap-4 mb-2">
              <h3 className="text-lg font-bold text-gray-900 line-clamp-2 leading-tight flex-1">{survey.title}</h3>
              <div className="flex items-center gap-1 shrink-0 -mt-1">
                <Link
                  to={`/builder/${survey.id}`}
                  className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition-all"
                  title="Modificar preguntas"
                >
                  <Edit2 size={16} />
                </Link>
                <button
                  onClick={() => handleDelete(survey.id, survey.title)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  title="Borrar encuesta"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">
              {survey.responseCount} {survey.responseCount === 1 ? 'respuesta' : 'respuestas'} recopiladas
            </p>
            
            <div className="space-y-2 mt-auto">
              <div className="grid grid-cols-2 gap-2">
                <Link 
                  to={`/dashboard/${survey.id}`}
                  className="flex items-center justify-center gap-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-lg px-3 py-1.8 text-xs font-semibold transition-colors shadow-sm"
                >
                  <BarChart2 size={14} className="text-primary" /> Dashboard
                </Link>
                <Link 
                  to={`/q/${survey.id}`}
                  target="_blank"
                  className="flex items-center justify-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg px-3 py-1.8 text-xs font-semibold transition-colors"
                >
                  <QrCode size={14} /> Ver en vivo
                </Link>
              </div>

              <button
                onClick={() => handleShare(survey.id)}
                className={`w-full flex items-center justify-center gap-1.5 py-1.8 rounded-lg text-xs font-semibold border transition-all ${
                  copiedId === survey.id
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-white hover:bg-gray-50 text-gray-500 hover:text-gray-900 border-gray-200"
                }`}
              >
                {copiedId === survey.id ? (
                  <>
                    <Check size={14} className="animate-bounce" /> Enlace Copiado
                  </>
                ) : (
                  <>
                    <Share2 size={14} /> Copiar Enlace para Compartir
                  </>
                )}
              </button>
            </div>
          </div>
        ))}

        {surveys.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
            <p className="text-gray-500 mb-4">No tienes encuestas creadas todavía.</p>
            <Link 
              to="/builder"
              className="inline-flex items-center justify-center gap-2 text-primary font-medium hover:underline underline-offset-4"
            >
              <Plus size={18} /> Crear tu primera encuesta
            </Link>
          </div>
        )}
      </div>
      {/* Log Modal */}
      {syncLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh] border border-gray-100 animate-fadeIn">
            <div className="bg-primary px-5 py-4 flex items-center justify-between">
              <h3 className="text-white font-bold tracking-wide flex items-center gap-2">
                <RefreshCw size={18} /> Resultados de Sincronización
              </h3>
              <button
                onClick={() => setSyncLogs(null)}
                className="text-white/80 hover:text-white transition-colors"
                title="Cerrar"
              >
                <XCircle size={22} />
              </button>
            </div>
            
            <div className="p-5 flex-1 overflow-y-auto bg-gray-50/50">
              <div className="space-y-2 font-mono text-xs">
                {syncLogs.map((log, index) => (
                  <div key={index} className={`p-2.5 rounded-lg border ${
                    log.includes('✅') ? 'bg-emerald-50/50 text-emerald-800 border-emerald-100' :
                    log.includes('⚠️') ? 'bg-amber-50/50 text-amber-800 border-amber-100' :
                    log.includes('❌') ? 'bg-red-50/50 text-red-800 border-red-100' :
                    'bg-white text-gray-700 border-gray-200'
                  }`}>
                    {log}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-4 bg-white border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSyncLogs(null)}
                className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-2 rounded-lg font-medium text-sm transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* DB Info Modal */}
      {showDbInfo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-100 animate-fadeIn">
            <div className="bg-gray-900 px-5 py-4 flex items-center justify-between">
              <h3 className="text-white font-bold tracking-wide flex items-center gap-2">
                <Database size={18} /> Diagnóstico y Configuración SQL (Supabase)
              </h3>
              <button
                onClick={() => setShowDbInfo(false)}
                className="text-white/80 hover:text-white transition-colors"
                title="Cerrar"
              >
                <XCircle size={22} />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto bg-gray-50/50 space-y-6">
              
              <div className="bg-white p-5 rounded-xl border border-gray-200">
                <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3 border-b pb-2">Prueba de Conexión en Vivo</h4>
                <div className="flex items-center gap-4 mb-4">
                  <button 
                    onClick={handleTestDatabase} 
                    disabled={isTesting}
                    className="bg-primary hover:bg-primary-dark disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all"
                  >
                    <RefreshCw size={14} className={isTesting ? "animate-spin" : ""} />
                    {isTesting ? "Testeando..." : "Reintentar Conexión Supabase"}
                  </button>
                </div>
                {dbTestLogs && dbTestLogs.envOk === false && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg text-sm">
                    <strong>Faltan Variables de Entorno:</strong> No se han encontrado <code>SUPABASE_URL</code> y <code>SUPABASE_KEY</code> (o <code>SUPABASE_ANON_KEY</code> / <code>SUPABASE_SERVICE_ROLE_KEY</code>) en la configuración del proyecto. Ve a Variables de Entorno y añade ambas claves para poder conectar con Supabase.
                  </div>
                )}
                {dbStatus && dbStatus.errorLog && (
                  <div className="mb-4 bg-red-100 border border-red-300 text-red-900 p-4 rounded-lg text-sm font-bold shadow-sm">
                    ❌ ERROR SUPABASE DETECTADO: {dbStatus.errorLog}
                    <div className="mt-2 text-xs font-normal text-red-800">
                      Revisa que tu <code>SUPABASE_URL</code> sea exactamente la URL del proyecto (Ej: <em>https://wxxmyxrzr.supabase.co</em>) sin rutas adicionales al final y que el <code>SUPABASE_KEY</code> no tenga espacios en blanco u otros caracteres accidentales por haber copiado mal.
                    </div>
                  </div>
                )}
                {dbTestLogs && (
                  <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs whitespace-pre-wrap overflow-x-auto shadow-inner">
                    {JSON.stringify(dbTestLogs, null, 2)}
                  </div>
                )}
                {!dbTestLogs && dbStatus && (
                  <div className="bg-gray-100 text-gray-700 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                    {JSON.stringify(dbStatus, null, 2)}
                  </div>
                )}
              </div>

              <div className="bg-amber-50 p-5 rounded-xl border border-amber-200">
                <h4 className="text-sm font-bold text-amber-900 uppercase tracking-wide mb-2">Instrucciones Estrictas de SQL</h4>
                <p className="text-xs text-amber-800 mb-3 leading-relaxed">
                  Si estás usando Supabase y tienes problemas para guardar encuestas (o tus datos no se ven), 
                  probablemente te faltan las tablas. Copia el siguiente código y ejecútalo en el <strong>Editor SQL</strong> de tu base de datos en Supabase:
                </p>
                <div className="relative group">
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-[11px] font-mono overflow-x-auto leading-relaxed shadow-inner">
{`-- Crea la tabla encuestas
CREATE TABLE IF NOT EXISTS surveys (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  questions JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crea la tabla de respuestas
CREATE TABLE IF NOT EXISTS responses (
  id TEXT PRIMARY KEY,
  survey_id TEXT REFERENCES surveys(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- (VITAL) Deshabilita RLS para permitir acceso desde el backend node.js
ALTER TABLE surveys DISABLE ROW LEVEL SECURITY;
ALTER TABLE responses DISABLE ROW LEVEL SECURITY;`}
                  </pre>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`CREATE TABLE IF NOT EXISTS surveys (id TEXT PRIMARY KEY, title TEXT NOT NULL, questions JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()); CREATE TABLE IF NOT EXISTS responses (id TEXT PRIMARY KEY, survey_id TEXT REFERENCES surveys(id) ON DELETE CASCADE, answers JSONB NOT NULL, timestamp TIMESTAMPTZ DEFAULT NOW()); ALTER TABLE surveys DISABLE ROW LEVEL SECURITY; ALTER TABLE responses DISABLE ROW LEVEL SECURITY;`);
                      alert("Contenido SQL copiado al portapapeles.");
                    }}
                    className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white px-2 py-1 flex items-center gap-1 rounded text-[10px] uppercase font-bold tracking-wider backdrop-blur cursor-pointer"
                  >
                    <Check size={12} /> Copiar Todo
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
