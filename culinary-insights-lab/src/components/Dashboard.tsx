import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { RefreshCw, Sparkles, QrCode, ArrowLeft, Share2, Download, List, MessageSquare, Award, Edit2, Check, ExternalLink, ShieldCheck, Users } from "lucide-react";

export default function Dashboard() {
  const { id } = useParams();
  const [responses, setResponses] = useState<any[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [surveyTitle, setSurveyTitle] = useState("Resultados de Encuesta");
  const [surveyData, setSurveyData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  
  // Selected question ID to inspect
  const [activeQuestionId, setActiveQuestionId] = useState<string>("");

  const surveyId = id || "demo";
  const qrUrl = typeof window !== 'undefined' ? `${window.location.origin}/q/${surveyId}` : '';

  const fetchData = async () => {
    try {
      const sRes = await fetch(`/api/survey/${surveyId}`);
      if (sRes.ok) {
        const sData = await sRes.json();
        if (sData.title) setSurveyTitle(sData.title);
        setSurveyData(sData);
      }

      const res = await fetch(`/api/survey/${surveyId}/results`);
      if (res.ok) {
        const data = await res.json();
        setResponses(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000); 
    return () => clearInterval(interval);
  }, [surveyId]);

  // Auto-initialize activeQuestionId to the first question
  useEffect(() => {
    if (surveyData?.questions?.length > 0 && !activeQuestionId) {
      setActiveQuestionId(surveyData.questions[0].id);
    }
  }, [surveyData, activeQuestionId]);

  const requestAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyId, data: responses })
      });
      const json = await res.json();
      if (json.analysis) {
        setAiAnalysis(json.analysis);
      }
    } catch (e) {
      console.error("Error analizando:", e);
    } finally {
      setAnalyzing(false);
    }
  };

  const chartableQuestions = useMemo(() => {
    if (!surveyData) return [];
    return surveyData.questions.filter((q: any) => q.type === "choice" || q.type === "checkbox" || q.type === "scale");
  }, [surveyData]);

  const textQuestions = useMemo(() => {
    if (!surveyData) return [];
    return surveyData.questions.filter((q: any) => q.type === "text");
  }, [surveyData]);

  const currentQuestionData = useMemo(() => {
    if (!surveyData) return null;
    return surveyData.questions.find((q: any) => q.id === activeQuestionId);
  }, [surveyData, activeQuestionId]);

  const getScaleLabelForValue = (val: number, q: any) => {
    const minVal = q.min !== undefined ? q.min : 1;
    const maxVal = q.max !== undefined ? q.max : 5;
    const rangeLength = maxVal - minVal + 1;

    if (rangeLength === 5) {
      if (q.id === "q7" || q.minLabel?.toLowerCase().includes("útil") || q.maxLabel?.toLowerCase().includes("útil")) {
        const labels = ["Nada útiles", "Poco útiles", "Regularmente útiles", "Útiles", "Muy útiles"];
        return labels[val - 1] || `${val}`;
      }
      if (q.minLabel?.toLowerCase().includes("deficiente") || q.maxLabel?.toLowerCase().includes("excelente")) {
        const labels = ["Deficiente", "Mala", "Regular", "Buena", "Excelente"];
        return labels[val - 1] || `${val}`;
      }
      const labels = ["Muy mala", "Mala", "Regular", "Buena", "Muy buena"];
      return labels[val - 1] || `${val}`;
    }

    if (val === minVal) return `${val} (${q.minLabel || "Mínimo"})`;
    if (val === maxVal) return `${val} (${q.maxLabel || "Máximo"})`;
    return `${val}`;
  };

  const chartStats = useMemo(() => {
    if (!currentQuestionData || responses.length === 0) return [];
    
    const counts: Record<string, number> = {};
    
    // 1. Single Choice options counting
    if (currentQuestionData.type === "choice" && currentQuestionData.options) {
      currentQuestionData.options.forEach((opt: string) => counts[opt] = 0);
      responses.forEach(r => {
        const val = r.answers[currentQuestionData.id];
        if (val) {
          counts[val] = (counts[val] || 0) + 1;
        }
      });
    } 
    // 2. Checkbox (Multiple choices in array) counting
    else if (currentQuestionData.type === "checkbox" && currentQuestionData.options) {
      currentQuestionData.options.forEach((opt: string) => counts[opt] = 0);
      responses.forEach(r => {
        const val = r.answers[currentQuestionData.id];
        if (Array.isArray(val)) {
          val.forEach((item: string) => {
            counts[item] = (counts[item] || 0) + 1;
          });
        }
      });
    } 
    // 3. Scale rating distribution
    else if (currentQuestionData.type === "scale") {
      const minVal = currentQuestionData.min !== undefined ? currentQuestionData.min : 1;
      const maxVal = currentQuestionData.max !== undefined ? currentQuestionData.max : 5;
      for (let i = minVal; i <= maxVal; i++) {
        const labelName = getScaleLabelForValue(i, currentQuestionData);
        counts[labelName] = 0;
      }
      responses.forEach(r => {
        const val = r.answers[currentQuestionData.id];
        if (val !== undefined && val !== null) {
          const numVal = Number(val);
          if (!isNaN(numVal)) {
            const labelName = getScaleLabelForValue(numVal, currentQuestionData);
            counts[labelName] = (counts[labelName] || 0) + 1;
          } else {
            counts[val.toString()] = (counts[val.toString()] || 0) + 1;
          }
        }
      });
    }

    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [responses, currentQuestionData]);

  // Rating average for the currently active scale question
  const averageRatingForActiveQuestion = useMemo(() => {
    if (!currentQuestionData || currentQuestionData.type !== "scale" || responses.length === 0) return null;
    const sum = responses.reduce((acc, r) => acc + (Number(r.answers[currentQuestionData.id]) || 0), 0);
    return (sum / responses.length).toFixed(1);
  }, [responses, currentQuestionData]);

  // Overall General Satisfaction (looks for q3 or another scale, fallback to first scale)
  const generalSatisfaction = useMemo(() => {
    if (!surveyData || responses.length === 0) return "N/A";
    const satisfactionQ = surveyData.questions.find((q: any) => q.id === "q3") || surveyData.questions.find((q: any) => q.type === "scale");
    if (!satisfactionQ) return "N/A";
    const sum = responses.reduce((acc, r) => acc + (Number(r.answers[satisfactionQ.id]) || 0), 0);
    return (sum / responses.length).toFixed(1) + ` / ${satisfactionQ.max || 5}`;
  }, [responses, surveyData]);

  const textAnswers = useMemo(() => {
    if (!currentQuestionData || currentQuestionData.type !== "text" || responses.length === 0) return [];
    return responses
      .map(r => r.answers[currentQuestionData.id])
      .filter(val => typeof val === "string" && val.trim().length > 0);
  }, [responses, currentQuestionData]);

  const respondents = useMemo(() => {
    return responses.map(r => {
      const name = r.answers?._respondentName || r._respondentName || "";
      const email = r.answers?._respondentEmail || r._respondentEmail || "";
      const consented = r.answers?._authorizedConsent || r._authorizedConsent || false;
      return {
        id: r.id,
        name: name.trim() ? name : "Anónimo",
        email: email.trim() ? email : "No registrado",
        consented,
        timestamp: r.timestamp 
          ? new Date(r.timestamp).toLocaleString("es-CO", { 
              year: "numeric", 
              month: "2-digit", 
              day: "2-digit", 
              hour: "2-digit", 
              minute: "2-digit"
            }) 
          : "N/A"
      };
    });
  }, [responses]);

  const colors = ["#10b981", "#34d399", "#059669", "#6ee7b7", "#a7f3d0", "#047857", "#065f46", "#022c22"];

  const whatsappMsg = encodeURIComponent(`¡Te invito a completar esta encuesta: "${surveyTitle}"!\n\nIngresa aquí: ${qrUrl}`);
  const whatsappUrl = `https://wa.me/?text=${whatsappMsg}`;

  const downloadCSV = () => {
    if (!surveyData || responses.length === 0) return;

    // Encabezados base
    const baseHeaders = ["ID Respuesta", "Fecha", "Nombre", "Correo", "Habeas Data Autorizado"];
    
    // Encabezados de preguntas (sanitizados para CSV)
    const questionHeaders = surveyData.questions.map((q: any) => `"${q.text.replace(/"/g, '""')}"`);

    let csvContent = "\uFEFF"; // BOM para soportar tildes/UTF-8
    csvContent += [...baseHeaders, ...questionHeaders].join(",") + "\n";

    responses.forEach(r => {
      const name = r.answers?._respondentName || r._respondentName || "Anónimo";
      const email = r.answers?._respondentEmail || r._respondentEmail || "No registrado";
      const consented = (r.answers?._authorizedConsent || r._authorizedConsent) ? "SÍ" : "NO";
      const ts = r.timestamp ? new Date(r.timestamp).toLocaleString("es-CO") : "N/A";
      const id = r.id || "N/A";

      const baseCols = [
        `"${id}"`, 
        `"${ts}"`, 
        `"${name}"`, 
        `"${email}"`, 
        `"${consented}"`
      ];
      
      const questionCols = surveyData.questions.map((q: any) => {
        const val = r.answers[q.id];
        if (val === undefined || val === null) return '""';
        if (Array.isArray(val)) return `"${val.join(" ; ").replace(/"/g, '""')}"`;
        return `"${String(val).replace(/"/g, '""')}"`;
      });

      csvContent += [...baseCols, ...questionCols].join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = `Resultados_${surveyTitle.replace(/\s+/g, "_")}.csv`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const downloadQR = () => {
    const canvas = document.getElementById("qrCodeEl") as HTMLCanvasElement;
    if (!canvas) return;
    const pngUrl = canvas
      .toDataURL("image/png")
      .replace("image/png", "image/octet-stream");
    let downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = `QR_${surveyTitle.replace(/\s+/g, "_")}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-12">
      <Link to="/" className="text-gray-500 hover:text-gray-900 flex items-center gap-2 mb-6 font-medium text-sm transition-colors w-fit">
        <ArrowLeft size={16} /> Volver a encuestas
      </Link>
      
      <header className="mb-10 flex flex-col md:flex-row justify-between md:items-end gap-4 border-b border-gray-100 pb-6">
        <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">{surveyTitle}</h1>
            <p className="text-gray-500 font-medium">Consolidación de percepciones e indicadores claves en tiempo real.</p>
        </div>
        <div className="text-left md:text-right flex items-center gap-6">
            <div className="border-r border-gray-200 pr-6">
                <p className="text-3xl font-bold text-gray-900">{responses.length}</p>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Respuestas</p>
            </div>
            <div>
                <p className="text-3xl font-bold text-primary">{generalSatisfaction}</p>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Satisfacción Gral.</p>
            </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Panel Izquierdo: Configuración e Invitación */}
        <div className="lg:col-span-4 flex flex-col gap-8">
            <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center shadow-sm">
                <h3 className="text-gray-600 font-semibold mb-4 flex items-center justify-between w-full text-sm">
                    <span>Lanzador QR & Compartir</span>
                    <QrCode size={18} className="text-primary" />
                </h3>
                
                <div className="p-4 bg-white border border-gray-100 rounded-lg shadow-sm mb-4 flex justify-center w-full">
                    <QRCodeCanvas id="qrCodeEl" value={qrUrl} size={150} />
                </div>
                
                <div className="flex flex-col gap-2 w-full">
                    <button 
                        onClick={downloadQR}
                        className="flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 py-2 rounded-lg font-medium text-xs transition-colors shadow-sm"
                    >
                        <Download size={14} /> Descargar QR para Imprimir
                    </button>
                    <a href={whatsappUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 bg-[#25d366] hover:bg-[#20bd5a] text-white py-2 rounded-lg font-medium text-xs transition-colors shadow-sm">
                        <Share2 size={14} /> Compartir por WhatsApp
                    </a>
                    <a href={`/q/${surveyId}`} target="_blank" rel="noreferrer" className="text-primary hover:text-primary-dark font-semibold text-center mt-2 text-xs">
                        Abrir cuestionario para responder en vivo
                    </a>
                </div>
            </div>

            {/* Listado de preguntas para navegar */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-gray-700 font-bold text-sm mb-4 flex items-center gap-2">
                    <List size={16} className="text-primary" />
                    Seleccionar Pregunta
                </h3>
                <div className="max-h-[380px] overflow-y-auto space-y-1.5 pr-1 text-xs">
                    {surveyData?.questions?.map((q: any, i: number) => {
                        const isSelected = q.id === activeQuestionId;
                        return (
                            <button
                                key={q.id}
                                onClick={() => {
                                    setActiveQuestionId(q.id);
                                    setAiAnalysis(null); // Limpiar análisis al cambiar de pregunta
                                }}
                                className={`w-full text-left p-2.5 rounded-lg transition-all border block ${
                                    isSelected 
                                        ? "bg-primary/10 border-primary/30 text-primary-dark font-semibold" 
                                        : "bg-gray-50 hover:bg-gray-100 border-gray-100 text-gray-600"
                                }`}
                            >
                                <span className="block font-bold text-[10px] text-gray-400 mb-0.5">PREGUNTA {i + 1} • {q.type.toUpperCase()}</span>
                                <span className="line-clamp-2">{q.text}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>

        {/* Panel Central: Gráficos de Datos e Integración IA */}
        <div className="lg:col-span-8 flex flex-col gap-8">
            <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm flex flex-col min-h-[400px]">
                <div className="flex justify-between items-start mb-6 border-b border-gray-100 pb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="bg-primary/20 text-primary text-[10px] font-extrabold uppercase px-2 py-0.5 rounded">
                                {currentQuestionData?.type}
                            </span>
                            {currentQuestionData?.section && (
                                <span className="text-xs text-primary font-bold">{currentQuestionData.section}</span>
                            )}
                        </div>
                        <h3 className="text-gray-900 font-bold text-lg leading-tight">
                            {currentQuestionData?.text}
                        </h3>
                        {currentQuestionData?.type === "scale" && (currentQuestionData.minLabel || currentQuestionData.maxLabel) && (
                            <p className="text-xs text-gray-500 mt-2 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 inline-block">
                                Escala de {currentQuestionData.min !== undefined ? currentQuestionData.min : 1} a {currentQuestionData.max !== undefined ? currentQuestionData.max : 5} — 
                                siendo <span className="font-semibold text-gray-700">{currentQuestionData.min !== undefined ? currentQuestionData.min : 1} ({currentQuestionData.minLabel || "Mínimo"})</span> y 
                                <span className="font-semibold text-gray-700"> {currentQuestionData.max !== undefined ? currentQuestionData.max : 5} ({currentQuestionData.maxLabel || "Máximo"})</span>.
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex-1 min-h-0 pt-2">
                    {responses.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-lg py-16">
                            Aún no hay respuestas recopiladas para esta encuesta.
                        </div>
                    ) : (
                        <>
                            {currentQuestionData?.type === "text" ? (
                                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-2">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <MessageSquare size={12} className="text-primary" /> {textAnswers.length} Respuestas abiertas
                                    </h4>
                                    {textAnswers.length === 0 ? (
                                        <p className="text-gray-400 text-sm italic">No hay comentarios en este campo aún.</p>
                                    ) : (
                                        textAnswers.map((ans, idx) => (
                                            <div key={idx} className="bg-gray-50 border border-gray-100 rounded-lg p-3.5 text-sm text-gray-700 shadow-sm leading-relaxed">
                                                "{ans}"
                                            </div>
                                        ))
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="h-[250px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartStats} margin={{ top: 10, right: 10, left: -25, bottom: 10 }}>
                                                <XAxis dataKey="name" stroke="#9ca3af" tick={{fill: '#6b7280', fontSize: 10}} tickLine={false} axisLine={false} dy={10} />
                                                <YAxis stroke="#9ca3af" tick={{fill: '#6b7280', fontSize: 10}} tickLine={false} axisLine={false} allowDecimals={false} />
                                                <Tooltip 
                                                    cursor={{fill: '#f3f4f6'}}
                                                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                                                />
                                                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={45}>
                                                    {chartStats.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>

                                    {averageRatingForActiveQuestion && (
                                        <div className="mt-6 border border-gray-150 rounded-xl p-5 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center gap-4 animate-fadeIn">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0">
                                                    <Award size={24} />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                                                        Promedio Aritmético Ponderado (Score Medio)
                                                    </h4>
                                                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                                                        Índice medio calculado de forma ponderada con base en todas las respuestas registradas en directo para esta escala.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-center sm:text-right shrink-0">
                                                <div className="text-4xl font-extrabold text-gray-900 tracking-tight">
                                                    {averageRatingForActiveQuestion}
                                                    <span className="text-lg font-bold text-gray-400">
                                                        /{currentQuestionData.max || 5}
                                                    </span>
                                                </div>
                                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 mt-1 rounded-full bg-primary/5 text-primary text-[10px] font-extrabold uppercase tracking-widest border border-primary/10">
                                                    {parseFloat(averageRatingForActiveQuestion) >= 4.0 
                                                        ? "Excepcional" 
                                                        : parseFloat(averageRatingForActiveQuestion) >= 3.0 
                                                            ? "Satisfactorio" 
                                                            : "Por mejorar"}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* AI Analysis section */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-8 flex flex-col md:flex-row gap-6 items-start h-auto">
                <div className="flex-1">
                    <h3 className="text-gray-900 font-bold text-base mb-1.5 flex items-center gap-2">
                        <Sparkles size={18} className="text-primary" />
                        Diagnóstico & Síntesis IA (Gemini)
                    </h3>
                    <p className="text-gray-600 text-xs mb-4 leading-relaxed">
                        Analiza e interpreta semánticamente todas las respuestas recolectadas para este formulario.
                    </p>
                    
                    {aiAnalysis ? (
                        <div className="bg-white border border-primary/10 rounded-lg p-4 shadow-sm text-gray-800 text-sm leading-relaxed font-medium">
                            {aiAnalysis}
                        </div>
                    ) : (
                        <div className="text-gray-400 text-sm italic">
                            Los resultados de la síntesis inteligente aparecerán aquí al iniciar el análisis.
                        </div>
                    )}
                </div>
                
                <button 
                    onClick={requestAnalysis}
                    disabled={analyzing || responses.length === 0}
                    className="shrink-0 bg-white border border-primary text-primary hover:bg-primary hover:text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm flex items-center gap-2"
                >
                    {analyzing ? (
                        <>Procesando <RefreshCw size={14} className="animate-spin" /></>
                    ) : (
                        <><Sparkles size={14} /> Analizar Todo</>
                    )}
                </button>
            </div>
        </div>
      </div>

      {/* REGISTRO DE PARTICIPANTES Y CONSENTIMIENTO DE HABEAS DATA */}
      <div className="mt-12 bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-gray-100 pb-5">
              <div>
                  <h3 className="text-gray-900 font-bold text-lg flex items-center gap-2">
                        <Users size={20} className="text-primary" />
                        Consolidado de Respuestas & Participantes
                  </h3>
                  <p className="text-gray-500 text-xs mt-1">
                      Detalle de personas, estado de Habeas Data, y descarga de matriz CSV con todo el consolidado de respuestas.
                  </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <div className="bg-emerald-50/80 px-3 py-1.5 rounded-lg border border-emerald-100 text-[11px] font-bold text-emerald-700 flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-emerald-600" />
                      Habeas Data (1581)
                  </div>
                  <button 
                      onClick={downloadCSV}
                      disabled={responses.length === 0}
                      className="bg-primary hover:bg-primary-dark text-white text-[11px] font-extrabold px-3 py-2 rounded-lg shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                  >
                      <Download size={14} /> Descargar CSV
                  </button>
              </div>
          </div>

          {respondents.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">
                  Aún no se registran participantes para esta encuesta.
              </div>
          ) : (
              <div className="overflow-x-auto select-none rounded-lg border border-gray-105">
                  <table className="w-full text-left text-xs border-collapse">
                      <thead>
                          <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-500">
                              <th className="py-3 px-4 font-bold uppercase tracking-wider">Nombre Completo</th>
                              <th className="py-3 px-4 font-bold uppercase tracking-wider">Contacto / Correo</th>
                              <th className="py-3 px-4 font-bold uppercase tracking-wider text-center">Autorización Datos</th>
                              <th className="py-3 px-4 font-bold uppercase tracking-wider text-right">Fecha Registro</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {respondents.map((resp, idx) => (
                              <tr key={resp.id || idx} className="hover:bg-gray-50/50 transition-colors">
                                  <td className="py-3.5 px-4 font-semibold text-gray-800">
                                      {resp.name}
                                  </td>
                                  <td className="py-3.5 px-4 text-gray-500 font-medium font-mono">
                                      {resp.email}
                                  </td>
                                  <td className="py-3.5 px-4 text-center">
                                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                          resp.consented 
                                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                                              : "bg-amber-50 text-amber-700 border border-amber-100"
                                      }`}>
                                          <ShieldCheck size={12} className={resp.consented ? "text-emerald-600" : "text-amber-600"} />
                                          {resp.consented ? "Autorizado (SÍ)" : "No indicado"}
                                      </span>
                                  </td>
                                  <td className="py-3.5 px-4 text-right text-gray-400 font-medium font-mono">
                                      {resp.timestamp}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          )}
      </div>
    </div>
  );
}
