import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { RefreshCw, Sparkles, QrCode, ArrowLeft, Share2, Download, Upload, List, MessageSquare, Award, Edit2, Check, ExternalLink, ShieldCheck, Users, Trash2 } from "lucide-react";
import Markdown from "react-markdown";

export default function Dashboard() {
  const { id } = useParams();
  const [responses, setResponses] = useState<any[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [surveyTitle, setSurveyTitle] = useState("Resultados de Encuesta");
  const [surveyData, setSurveyData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [apiProvider, setApiProvider] = useState<"gemini" | "groq" | "openrouter">("gemini");
  const [apiModel, setApiModel] = useState<string>("");
  
  // Selected question ID to inspect
  const [activeQuestionId, setActiveQuestionId] = useState<string>("");

  // CROSS-TABULATION (SEGMENT FILTERS) STATES & MEMOS
  const [selectedParticipationFilter, setSelectedParticipationFilter] = useState<string>("Todos");

  const participationOptions = useMemo(() => {
    if (!surveyData) return [];
    const q1 = surveyData.questions?.find((q: any) => q.id === "q1");
    return q1?.options || [];
  }, [surveyData]);

  const participationCounts = useMemo(() => {
    const counts: Record<string, number> = { "Todos": responses.length };
    participationOptions.forEach((opt: string) => {
      counts[opt] = 0;
    });
    responses.forEach(r => {
      const val = r.answers?.q1;
      if (val && counts[val] !== undefined) {
        counts[val]++;
      }
    });
    return counts;
  }, [participationOptions, responses]);

  const filteredResponses = useMemo(() => {
    if (!selectedParticipationFilter || selectedParticipationFilter === "Todos") {
      return responses;
    }
    return responses.filter(r => r.answers?.q1 === selectedParticipationFilter);
  }, [responses, selectedParticipationFilter]);

  // COGNITIVE SEMANTIC CLUSTERING (GEMINI) STATES
  const [clustering, setClustering] = useState(false);
  const [clusteredSpecs, setClusteredSpecs] = useState<any[] | null>(null);
  const [specTab, setSpecTab] = useState<"detailed" | "cluster">("detailed");

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

  // Reset clustered specs when changing question or filter
  useEffect(() => {
    setClusteredSpecs(null);
    setSpecTab("detailed");
  }, [activeQuestionId, selectedParticipationFilter]);

  const requestAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyId, data: filteredResponses, apiProvider, model: apiModel })
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
    if (!currentQuestionData || filteredResponses.length === 0) return [];
    
    const counts: Record<string, number> = {};
    
    // 1. Single Choice options counting
    if (currentQuestionData.type === "choice" && currentQuestionData.options) {
      currentQuestionData.options.forEach((opt: string) => counts[opt] = 0);
      filteredResponses.forEach(r => {
        const val = r.answers[currentQuestionData.id];
        if (val) {
          counts[val] = (counts[val] || 0) + 1;
        }
      });
    } 
    // 2. Checkbox (Multiple choices in array) counting
    else if (currentQuestionData.type === "checkbox" && currentQuestionData.options) {
      currentQuestionData.options.forEach((opt: string) => counts[opt] = 0);
      filteredResponses.forEach(r => {
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
      filteredResponses.forEach(r => {
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
  }, [filteredResponses, currentQuestionData]);

  // Rating average for the currently active scale question
  const averageRatingForActiveQuestion = useMemo(() => {
    if (!currentQuestionData || currentQuestionData.type !== "scale" || filteredResponses.length === 0) return null;
    const sum = filteredResponses.reduce((acc, r) => acc + (Number(r.answers[currentQuestionData.id]) || 0), 0);
    return (sum / filteredResponses.length).toFixed(1);
  }, [filteredResponses, currentQuestionData]);

  // Overall General Satisfaction (looks for q3 or another scale, fallback to first scale)
  const generalSatisfaction = useMemo(() => {
    if (!surveyData || filteredResponses.length === 0) return "N/A";
    const satisfactionQ = surveyData.questions.find((q: any) => q.id === "q3") || surveyData.questions.find((q: any) => q.type === "scale");
    if (!satisfactionQ) return "N/A";
    const sum = filteredResponses.reduce((acc, r) => acc + (Number(r.answers[satisfactionQ.id]) || 0), 0);
    return (sum / filteredResponses.length).toFixed(1) + ` / ${satisfactionQ.max || 5}`;
  }, [filteredResponses, surveyData]);

  const textAnswers = useMemo(() => {
    if (!currentQuestionData || currentQuestionData.type !== "text" || filteredResponses.length === 0) return [];
    return filteredResponses
      .map(r => ({
        text: r.answers[currentQuestionData.id],
        respondentName: r.answers._respondentName || r._respondentName || "Anónimo"
      }))
      .filter(item => typeof item.text === "string" && item.text.trim().length > 0);
  }, [filteredResponses, currentQuestionData]);

  const activeQuestionSpecs = useMemo(() => {
    if (!currentQuestionData || filteredResponses.length === 0) return [];
    if (currentQuestionData.id === "q1") {
      return filteredResponses
        .map(r => ({
          option: r.answers["q1"] || "No indicado",
          spec: r.answers["q1_spec"] || "",
          respondentName: r.answers?._respondentName || r._respondentName || "Anónimo"
        }))
        .filter(item => typeof item.spec === "string" && item.spec.trim().length > 0);
    }
    if (currentQuestionData.id === "q2") {
      return filteredResponses
        .map(r => ({
          option: "Otro",
          spec: r.answers["q2_spec"] || "",
          respondentName: r.answers?._respondentName || r._respondentName || "Anónimo"
        }))
        .filter(item => typeof item.spec === "string" && item.spec.trim().length > 0);
    }
    return [];
  }, [filteredResponses, currentQuestionData]);

  const specsToCluster = useMemo(() => {
    return activeQuestionSpecs.map(s => s.spec).filter(s => typeof s === "string" && s.trim().length > 0);
  }, [activeQuestionSpecs]);

  const runSemanticClustering = async () => {
    if (specsToCluster.length === 0) return;
    setClustering(true);
    try {
      const res = await fetch("/api/semantically-cluster-specs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specs: specsToCluster })
      });
      if (res.ok) {
        const json = await res.json();
        setClusteredSpecs(json.clusters || []);
      }
    } catch (e) {
      console.error("Error clustering specifications:", e);
    } finally {
      setClustering(false);
    }
  };

  // Auto trigger clustering when clicking the IA analysis specs tab
  useEffect(() => {
    if (specTab === "cluster" && !clusteredSpecs && !clustering && specsToCluster.length > 0) {
      runSemanticClustering();
    }
  }, [specTab, clusteredSpecs, clustering, specsToCluster]);

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
    
    // Encabezados de preguntas (incluyendo especificaciones dinámicas)
    const headers: string[] = [...baseHeaders];
    surveyData.questions.forEach((q: any) => {
      headers.push(`"${q.text.replace(/"/g, '""')}"`);
      if (q.id === "q1") {
        headers.push(`"Especificación de Tipo de Participación (q1)"`);
      }
      if (q.id === "q2") {
        headers.push(`"Especificación de Otros Espacios (q2)"`);
      }
    });

    let csvContent = "\uFEFF"; // BOM para soportar tildes/UTF-8
    csvContent += headers.join(",") + "\n";

    responses.forEach(r => {
      const name = r.answers?._respondentName || r._respondentName || "Anónimo";
      const email = r.answers?._respondentEmail || r._respondentEmail || "No registrado";
      const consented = (r.answers?._authorizedConsent || r._authorizedConsent) ? "SÍ" : "NO";
      const ts = r.timestamp ? new Date(r.timestamp).toLocaleString("es-CO") : "N/A";
      const id = r.id || "N/A";

      const rCols = [
        `"${id}"`, 
        `"${ts}"`, 
        `"${name}"`, 
        `"${email}"`, 
        `"${consented}"`
      ];
      
      surveyData.questions.forEach((q: any) => {
        const val = r.answers[q.id];
        if (val === undefined || val === null) {
          rCols.push('""');
        } else if (Array.isArray(val)) {
          rCols.push(`"${val.join(" ; ").replace(/"/g, '""')}"`);
        } else {
          rCols.push(`"${String(val).replace(/"/g, '""')}"`);
        }

        if (q.id === "q1") {
          const specVal = r.answers["q1_spec"] || "";
          rCols.push(`"${String(specVal).replace(/"/g, '""')}"`);
        }
        if (q.id === "q2") {
          const specVal = r.answers["q2_spec"] || "";
          rCols.push(`"${String(specVal).replace(/"/g, '""')}"`);
        }
      });

      csvContent += rCols.join(",") + "\n";
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

  const parseCSVLine = (text: string) => {
    const re = /"([^"]*(?:""[^"]*)*)"|([^,]+)/g;
    let result = [];
    let match;
    while ((match = re.exec(text)) !== null) {
      if (match[1] !== undefined) {
        result.push(match[1].replace(/""/g, '"'));
      } else {
        result.push(match[2] || "");
      }
    }
    return result;
  };

  const handleImportCSV = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0];
    if (!file || !surveyData) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) return;
        
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length <= 1) {
            alert("El archivo CSV no tiene datos o está vacío.");
            return;
        }
        
        const importedResponses = [];
        for (let i = 1; i < lines.length; i++) {
           const cols = parseCSVLine(lines[i]);
           if (cols.length < 5) continue; // skip malformed lines
           
           const name = cols[2] !== "Anónimo" ? cols[2] : "";
           const email = cols[3] !== "No registrado" ? cols[3] : "";
           const consented = cols[4]?.toLowerCase() === "sí" || cols[4]?.toLowerCase() === "si" || cols[4] === "true";
           
           const answers: any = {
             _respondentName: name,
             _respondentEmail: email,
             _authorizedConsent: consented
           };

           let colIndex = 5;
           surveyData.questions.forEach((q: any) => {
             let val = cols[colIndex++];
             
             if (val !== undefined && val !== "") {
                if (q.type === "checkbox") {
                   answers[q.id] = val.split(" ; ").map(v => v.trim()).filter(v => v);
                } else if (q.type === "scale") {
                   answers[q.id] = Number(val);
                } else {
                   answers[q.id] = val;
                }
             }
             
             if (q.id === "q1") {
                 const spec = cols[colIndex++];
                 if (spec) answers["q1_spec"] = spec;
             }
             if (q.id === "q2") {
                 const spec = cols[colIndex++];
                 if (spec) answers["q2_spec"] = spec;
             }
           });
           
           importedResponses.push(answers);
        }
        
        if (importedResponses.length > 0) {
            const res = await fetch(`/api/survey/${surveyId}/import-responses`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ responses: importedResponses })
            });
            if (res.ok) {
                alert(`¡Se importaron ${importedResponses.length} respuestas correctamente!`);
                fetchData();
            } else {
                alert("Hubo un problema al importar las respuestas.");
            }
        } else {
            alert("No se encontraron respuestas válidas para importar.");
        }
      } catch (err) {
        console.error(err);
        alert("Ocurrió un error leyendo el archivo.");
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file, "utf-8");
    evt.target.value = "";
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

  const handleDeleteResponse = async (responseId: string) => {
    if (!window.confirm("¿Estás seguro de eliminar este registro? Esta acción no se puede deshacer.")) return;
    try {
      const res = await fetch(`/api/responses/${responseId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        alert("Registro eliminado exitosamente.");
        fetchData();
      } else {
        alert("Error al eliminar el registro.");
      }
    } catch (e) {
      console.error(e);
      alert("Error al conectar con el servidor.");
    }
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

      {/* SEGMENTACIÓN CREADA CON MÉTRICAS CRUZADAS */}
      <div className="bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 border border-primary/20 rounded-2xl p-6 mb-8 shadow-md">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4 select-none">
              <div>
                  <h3 className="text-white text-sm font-bold tracking-tight uppercase flex items-center gap-2">
                      <span className="w-1.5 h-3 bg-[#d4af88] rounded-sm inline-block animate-pulse"></span>
                      Métricas Cruzadas & Segmentación de Audiencia (Cross-Tabulation)
                  </h3>
                  <p className="text-gray-400 text-[11px] mt-0.5 font-medium leading-relaxed">
                      Deconstruye los resultados en tiempo real. Filtra de forma instantánea todos los gráficos, comentarios y promedios según la participación seleccionada.
                  </p>
              </div>
              {selectedParticipationFilter !== "Todos" && (
                  <button 
                      onClick={() => setSelectedParticipationFilter("Todos")}
                      className="text-[10px] font-extrabold text-[#d4af88] uppercase tracking-wider bg-white/5 hover:bg-[#d4af88]/10 px-3 py-1.5 border border-[#d4af88]/30 rounded-lg transition-all cursor-pointer"
                  >
                      Limpiar Filtro
                  </button>
              )}
          </div>
          <div className="flex flex-wrap gap-2.5">
              <button
                  onClick={() => setSelectedParticipationFilter("Todos")}
                  className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 border select-none cursor-pointer ${
                      selectedParticipationFilter === "Todos"
                          ? "bg-white text-gray-950 border-white shadow-lg scale-[1.02]"
                          : "bg-gray-800/30 text-gray-300 border-gray-700/50 hover:bg-gray-800 hover:text-white"
                  }`}
              >
                  <span>Todos los Segmentos</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                      selectedParticipationFilter === "Todos" ? "bg-gray-900 text-white" : "bg-gray-700/60 text-gray-300"
                  }`}>
                      {participationCounts["Todos"] || 0}
                  </span>
              </button>

              {participationOptions.map((opt: string) => {
                  const count = participationCounts[opt] || 0;
                  const isSelected = selectedParticipationFilter === opt;
                  return (
                      <button
                          key={opt}
                          onClick={() => setSelectedParticipationFilter(opt)}
                          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 border select-none cursor-pointer ${
                              isSelected
                                  ? "bg-[#d4af88] text-gray-950 border-[#d4af88] shadow-lg scale-[1.02]"
                                  : "bg-gray-800/30 text-gray-300 border-gray-700/50 hover:bg-gray-800 hover:text-white"
                          }`}
                      >
                          <span>{opt}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                              isSelected ? "bg-gray-950 text-[#d4af88]" : "bg-gray-700/60 text-gray-300"
                          }`}>
                              {count}
                          </span>
                      </button>
                  );
              })}
          </div>
      </div>

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
                    <label className="flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 py-2 rounded-lg font-medium text-xs transition-colors shadow-sm cursor-pointer relative overflow-hidden">
                        {importing ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                        {importing ? 'Importando...' : 'Importar Respuestas (CSV)'}
                        <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} disabled={importing} />
                    </label>
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
                                            <div key={idx} className="bg-gray-50 border border-gray-100 rounded-lg p-3.5 text-sm text-gray-700 shadow-sm leading-relaxed flex flex-col gap-1.5">
                                                <div className="font-semibold text-gray-800">"{ans.text}"</div>
                                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{ans.respondentName}</div>
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
                                                    {(() => {
                                                        const maxVal = currentQuestionData.max || 5;
                                                        const score = parseFloat(averageRatingForActiveQuestion || "0");
                                                        const pct = score / maxVal;
                                                        if (pct >= 0.8) return "Excepcional";
                                                        if (pct >= 0.6) return "Satisfactorio";
                                                        return "Por mejorar";
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeQuestionSpecs.length > 0 && (
                                        <div className="mt-8 border-t border-gray-150 pt-6 animate-fadeIn">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-gray-100 pb-3 select-none">
                                                <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 leading-none">
                                                    <MessageSquare size={13} className="text-primary animate-pulse" /> 
                                                    Respuestas de Especificación ({activeQuestionSpecs.length})
                                                </h4>
                                                
                                                {/* Selector de Pestaña de Consolidación */}
                                                <div className="flex bg-gray-100 p-1 rounded-xl text-[10px] font-extrabold uppercase tracking-widest self-start sm:self-auto border border-gray-200">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSpecTab("detailed")}
                                                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                                                            specTab === "detailed"
                                                                ? "bg-white text-gray-900 shadow-sm font-black"
                                                                : "text-gray-500 hover:text-gray-800"
                                                        }`}
                                                    >
                                                        Lista Detallada
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSpecTab("cluster")}
                                                        className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                                                            specTab === "cluster"
                                                                ? "bg-gray-900 text-[#d4af88] shadow-sm font-black"
                                                                : "text-gray-500 hover:text-gray-800"
                                                        }`}
                                                    >
                                                        <Sparkles size={11} className="text-[#d4af88]" />
                                                        Consolidación Semántica IA
                                                    </button>
                                                </div>
                                            </div>

                                            {specTab === "detailed" ? (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
                                                    {activeQuestionSpecs.map((item, idx) => (
                                                        <div key={idx} className="bg-gray-50/60 border border-gray-150 p-3 rounded-lg flex flex-col justify-between gap-1.5 text-xs shadow-sm">
                                                            <div className="font-semibold text-gray-800 leading-relaxed">
                                                                "{item.spec}"
                                                            </div>
                                                            <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium font-sans mt-1">
                                                                <span className="bg-primary/5 px-2 py-0.5 rounded border border-primary/10 text-primary font-bold uppercase tracking-wide">{item.option}</span>
                                                                <span className="font-semibold">{item.respondentName}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="bg-gradient-to-b from-gray-950 to-gray-900 border border-gray-800 rounded-2xl p-4 md:p-5 max-h-[280px] overflow-y-auto">
                                                    {clustering ? (
                                                        <div className="py-12 flex flex-col items-center justify-center gap-3 text-gray-400 text-center">
                                                            <RefreshCw size={20} className="animate-spin text-[#d4af88]" />
                                                            <span className="font-bold text-[10px] text-[#d4af88] tracking-widest uppercase">Unificando variaciones semánticas con Gemini...</span>
                                                        </div>
                                                    ) : clusteredSpecs && clusteredSpecs.length > 0 ? (
                                                        <div className="space-y-3">
                                                            <div className="flex justify-between items-center text-[10px] text-gray-500 uppercase font-bold tracking-widest pb-2 border-b border-gray-800">
                                                                <span>Nodos de Representación</span>
                                                                <span>Casos Unificados</span>
                                                            </div>
                                                            {clusteredSpecs.map((cluster, cIdx) => (
                                                                <div key={cIdx} className="bg-white/5 border border-white/5 rounded-xl p-3.5 hover:bg-white/10 transition-all shadow-md">
                                                                    <div className="flex items-center justify-between gap-2 mb-2">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="w-1.5 h-1.5 bg-[#d4af88] rounded-full"></span>
                                                                            <span className="font-extrabold text-white text-xs">{cluster.name}</span>
                                                                        </div>
                                                                        <span className="bg-[#d4af88]/10 text-[#d4af88] text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-[#d4af88]/20 tracking-wider">
                                                                            {cluster.count} {cluster.count === 1 ? 'caso' : 'casos'}
                                                                        </span>
                                                                    </div>
                                                                    
                                                                    <div className="pl-3 border-l border-[#d4af88]/30 space-y-1 text-[11px] text-gray-400 font-medium">
                                                                        {cluster.items.map((it: string, itIdx: number) => (
                                                                            <div key={itIdx} className="italic before:content-['•_'] before:text-gray-600 before:font-sans before:not-italic">
                                                                                "{it}"
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="py-12 text-center text-gray-400 flex flex-col items-center justify-center gap-2">
                                                            <Sparkles size={20} className="text-[#d4af88] opacity-50" />
                                                            <p className="text-xs italic text-gray-400">Haga clic de nuevo para reintentar la consolidación semántica con IA.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
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
                        Diagnóstico & Síntesis IA Avanzada
                    </h3>
                    <p className="text-gray-600 text-xs mb-4 leading-relaxed">
                        Analiza e interpreta semánticamente todas las respuestas recolectadas. Puedes elegir distintos modelos avanzados (requiere que las APIs estén configuradas en las variables de entorno).
                    </p>
                    
                    {aiAnalysis ? (
                        <div className="bg-white border border-primary/10 rounded-lg p-5 shadow-sm text-gray-800 text-sm leading-relaxed font-medium">
                            <div className="prose prose-sm max-w-none prose-p:mb-3 prose-headings:font-bold prose-headings:mb-2 prose-headings:mt-4 prose-ul:list-disc prose-ul:pl-5 prose-ol:list-decimal prose-ol:pl-5 prose-li:mb-1">
                                <Markdown>{aiAnalysis}</Markdown>
                            </div>
                        </div>
                    ) : (
                        <div className="text-gray-400 text-sm italic">
                            Los resultados de la síntesis inteligente aparecerán aquí al iniciar el análisis.
                        </div>
                    )}
                </div>
                
                <div className="flex flex-col gap-3 shrink-0 min-w-[220px]">
                  <div className="flex flex-col gap-2 bg-white p-4 rounded-lg border border-primary/10 shadow-sm">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Motor de Análisis</label>
                    <select
                      value={apiProvider}
                      onChange={(e) => {
                         setApiProvider(e.target.value as any);
                         setApiModel(""); 
                      }}
                      className="text-sm bg-gray-50 border border-gray-200 text-gray-700 rounded-md p-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full"
                    >
                      <option value="gemini">Gemini (Por defecto)</option>
                      <option value="groq">Groq</option>
                      <option value="openrouter">OpenRouter</option>
                    </select>

                    {apiProvider === "groq" && (
                        <select
                           value={apiModel}
                           onChange={(e) => setApiModel(e.target.value)}
                           className="text-sm bg-gray-50 border border-gray-200 text-gray-700 rounded-md p-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary mt-1 w-full"
                        >
                          <option value="">Llama 3 70B (Defecto)</option>
                          <option value="llama3-8b-8192">Llama 3 8B</option>
                          <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                          <option value="gemma-7b-it">Gemma 7B</option>
                        </select>
                    )}

                    {apiProvider === "openrouter" && (
                        <select
                           value={apiModel}
                           onChange={(e) => setApiModel(e.target.value)}
                           className="text-sm bg-gray-50 border border-gray-200 text-gray-700 rounded-md p-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary mt-1 w-full"
                        >
                          <option value="">Claude 3.5 Sonnet (Defecto)</option>
                          <option value="anthropic/claude-3-haiku">Claude 3 Haiku</option>
                          <option value="meta-llama/llama-3-8b-instruct">Llama 3 8B Instruct</option>
                          <option value="google/gemini-flash-1.5">Gemini 1.5 Flash</option>
                        </select>
                    )}
                  </div>
                  
                  <button 
                      onClick={requestAnalysis}
                      disabled={analyzing || responses.length === 0}
                      className="bg-white border border-primary text-primary hover:bg-primary hover:text-white px-5 py-3 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm flex justify-center items-center gap-2 w-full"
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
                              <th className="py-3 px-4 font-bold uppercase tracking-wider text-center">Acciones</th>
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
                                  <td className="py-3.5 px-4 text-center">
                                      <button
                                          onClick={() => handleDeleteResponse(resp.id)}
                                          className="text-red-400 hover:text-red-600 transition-colors bg-red-50 hover:bg-red-100 p-2 rounded-full"
                                          title="Eliminar Registro"
                                      >
                                          <Trash2 size={14} />
                                      </button>
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
