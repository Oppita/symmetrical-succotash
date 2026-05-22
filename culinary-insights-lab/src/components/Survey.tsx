import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { cn } from "../lib/utils";

const q1SpecsMap: Record<string, { label: string; placeholder: string }> = {
  "Entidad pública": {
    label: "¿Cuál entidad pública?",
    placeholder: "Ej: Ministerio de Ambiente, Alcaldía Municipal, etc."
  },
  "Academia": {
    label: "¿Cuál institución académica / universidad?",
    placeholder: "Ej: Universidad Nacional de Colombia, Universidad del Valle, etc."
  },
  "Organización social/comunitaria": {
    label: "¿Cuál organización social o comunitaria?",
    placeholder: "Ej: Asociación de Juntas de Acción Comunal, Cabildo..."
  },
  "Cooperación internacional": {
    label: "¿Cuál organismo / agencia de cooperación?",
    placeholder: "Ej: PNUD, USAID, Cruz Roja, etc."
  },
  "Sector privado": {
    label: "¿Cuál empresa, gremio o entidad privada?",
    placeholder: "Ej: Cámara de Comercio de Bogotá, Constructora Y, etc."
  },
  "Otro": {
    label: "Por favor especifica tu tipo de participación",
    placeholder: "Ej: Voluntario, Prensa, Delegado extranjero, etc."
  }
};

export default function Survey() {
  const { id } = useParams();
  const [survey, setSurvey] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [respondentName, setRespondentName] = useState("");
  const [respondentEmail, setRespondentEmail] = useState("");
  const [authorizedConsent, setAuthorizedConsent] = useState(false);

  useEffect(() => {
    fetch(`/api/survey/${id}`)
      .then(res => res.json())
      .then(setSurvey)
      .catch(console.error);
  }, [id]);

  if (!survey) return (
    <div className="min-h-screen flex items-center justify-center text-gray-500">
      Cargando cuestionario...
    </div>
  );

  const handleSubmit = async () => {
    if (!authorizedConsent) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/survey/${id}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...answers,
          _respondentName: respondentName.trim(),
          _respondentEmail: respondentEmail.trim(),
          _authorizedConsent: authorizedConsent
        })
      });
      if (!res.ok) throw new Error("Error en servidor: " + res.statusText);
      setSubmitted(true);
    } catch (e: any) {
      console.error(e);
      alert("Hubo un error al enviar las respuestas. Por favor intenta de nuevo. Detalle: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const isQuestionAnswered = (q: any) => {
    if (q.optional) return true;
    const ans = answers[q.id];
    
    // Dynamic specification validations
    if (q.id === "q1") {
      if (!ans) return false;
      const isSpecRequired = ["Entidad pública", "Academia", "Organización social/comunitaria", "Cooperación internacional", "Sector privado", "Otro"].includes(ans);
      if (isSpecRequired) {
        return typeof answers["q1_spec"] === "string" && answers["q1_spec"].trim().length > 0;
      }
    }
    
    if (q.id === "q2") {
      if (!Array.isArray(ans) || ans.length === 0) return false;
      if (ans.includes("Otro")) {
        return typeof answers["q2_spec"] === "string" && answers["q2_spec"].trim().length > 0;
      }
    }

    if (q.type === "checkbox") {
      return Array.isArray(ans) && ans.length > 0;
    }
    if (q.type === "text") {
      return typeof ans === "string" && ans.trim().length > 0;
    }
    return ans !== undefined && ans !== null && ans !== "";
  };

  const isFormValid = survey.questions.every((q: any) => isQuestionAnswered(q)) && authorizedConsent;

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="bg-white border border-gray-200 rounded-xl p-10 max-w-lg text-center shadow-sm">
            <h2 className="text-2xl font-semibold text-primary mb-4">¡Gracias por participar!</h2>
            <p className="text-gray-600">
              Tus respuestas han sido registradas exitosamente.
            </p>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12 bg-gray-50">
        <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-xl w-full shadow-sm">
            <h1 className="text-2xl font-semibold text-gray-900 mb-8">{survey.title}</h1>
            
            <div className="space-y-8">
                {survey.questions.map((q: any, index: number) => {
                    const minVal = q.min !== undefined ? q.min : 1;
                    const maxVal = q.max !== undefined ? q.max : 5;
                    const rangeLength = (maxVal - minVal) + 1;

                    return (
                        <div key={q.id} className="space-y-3">
                            {q.section && (
                                <div className="pt-6 pb-2 border-t border-gray-100 mt-6 first:border-t-0 first:pt-0">
                                    <h3 className="text-xs font-bold text-primary uppercase tracking-widest">{q.section}</h3>
                                </div>
                            )}

                            <p className="text-gray-800 font-medium text-sm md:text-base">
                              {index + 1}. {q.text} {q.optional && <span className="text-gray-400 text-xs font-normal">(Opcional)</span>}
                            </p>
                            
                            {q.type === "scale" && (
                                <div className="space-y-3">
                                    {rangeLength === 5 ? (
                                        <div className="flex flex-col gap-2 pt-1">
                                            {Array.from({length: rangeLength}).map((_, i) => {
                                                const currentVal = minVal + i;
                                                const getScaleOptionLabel = (val: number) => {
                                                    if (q.id === "q7" || q.minLabel?.toLowerCase().includes("útil") || q.maxLabel?.toLowerCase().includes("útil")) {
                                                        const labels = ["Nada útiles", "Poco útiles", "Regularmente útiles", "Útiles", "Muy útiles"];
                                                        return labels[val - 1] || `${val}`;
                                                    }
                                                    if (q.minLabel?.toLowerCase().includes("deficiente") || q.maxLabel?.toLowerCase().includes("excelente")) {
                                                        const labels = ["Deficiente", "Mala", "Regular", "Buena", "Excelente"];
                                                        return labels[val - 1] || `${val}`;
                                                    }
                                                    if (q.minLabel?.toLowerCase().includes("malo") || q.maxLabel?.toLowerCase().includes("bueno") || q.minLabel?.toLowerCase().includes("mala") || q.maxLabel?.toLowerCase().includes("buena")) {
                                                        const labels = ["Muy mala", "Mala", "Regular", "Buena", "Muy buena"];
                                                        return labels[val - 1] || `${val}`;
                                                    }
                                                    // Fallback 1-5
                                                    const labels = ["Muy mala", "Mala", "Regular", "Buena", "Muy buena"];
                                                    return labels[val - 1] || `${val}`;
                                                };
                                                
                                                return (
                                                    <button 
                                                        key={i} 
                                                        type="button"
                                                        onClick={() => setAnswers({...answers, [q.id]: currentVal})}
                                                        className={cn(
                                                            "p-3.5 text-left border rounded-lg transition-all text-sm font-medium flex justify-between items-center",
                                                            answers[q.id] === currentVal 
                                                                ? "border-primary bg-primary-light text-primary-dark font-semibold" 
                                                                : "border-gray-200 bg-gray-50 text-gray-700 hover:border-primary/50"
                                                        )}
                                                    >
                                                        <span className="capitalize">{getScaleOptionLabel(currentVal)}</span>
                                                        <div className={cn(
                                                            "w-5 h-5 rounded-full border flex items-center justify-center transition-all shrink-0",
                                                            answers[q.id] === currentVal 
                                                                ? "bg-primary border-primary text-white" 
                                                                : "border-gray-300 bg-white"
                                                        )}>
                                                            {answers[q.id] === currentVal && "✓"}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {Array.from({length: rangeLength}).map((_, i) => {
                                                const currentVal = minVal + i;
                                                return (
                                                    <button 
                                                        key={i} 
                                                        type="button"
                                                        onClick={() => setAnswers({...answers, [q.id]: currentVal})}
                                                        className={cn(
                                                            "w-10 h-10 md:w-11 md:h-11 rounded-full border transition-all text-sm font-medium",
                                                            answers[q.id] === currentVal 
                                                                ? "bg-primary text-white border-primary shadow-sm" 
                                                                : "border-gray-200 text-gray-600 bg-gray-50 hover:border-primary hover:text-primary"
                                                        )}
                                                    >
                                                        {currentVal}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {(q.minLabel || q.maxLabel) && rangeLength !== 5 && (
                                        <p className="text-xs text-gray-500 bg-gray-100/60 border border-gray-200/50 px-3 py-1.5 rounded-lg inline-block select-none animate-fadeIn">
                                            Valoración desde <strong className="font-semibold text-gray-700">{q.minLabel}</strong> hasta <strong className="font-semibold text-gray-700">{q.maxLabel}</strong>.
                                        </p>
                                    )}
                                </div>
                            )}
                            
                            {q.type === "choice" && (
                                <div className="space-y-3 pt-1">
                                    <div className="flex flex-col gap-2">
                                        {q.options.map((opt: string) => (
                                            <button 
                                                key={opt}
                                                type="button"
                                                onClick={() => {
                                                    const updatedAnswers = { ...answers, [q.id]: opt };
                                                    if (q.id === "q1" && !q1SpecsMap[opt]) {
                                                        delete updatedAnswers["q1_spec"];
                                                    }
                                                    setAnswers(updatedAnswers);
                                                }}
                                                className={cn(
                                                    "p-3.5 text-left border rounded-lg transition-all text-sm font-medium flex justify-between items-center",
                                                    answers[q.id] === opt 
                                                        ? "border-primary bg-primary-light text-primary-dark font-semibold shadow-sm" 
                                                        : "border-gray-200 bg-gray-50 text-gray-700 hover:border-primary/50"
                                                )}
                                            >
                                                <span>{opt}</span>
                                                <div className={cn(
                                                    "w-5 h-5 rounded-full border flex items-center justify-center transition-all shrink-0",
                                                    answers[q.id] === opt 
                                                        ? "bg-primary border-primary text-white" 
                                                        : "border-gray-300 bg-white"
                                                )}>
                                                    {answers[q.id] === opt && "✓"}
                                                </div>
                                            </button>
                                        ))}
                                    </div>

                                    {q.id === "q1" && answers["q1"] && q1SpecsMap[answers["q1"]] && (
                                        <div className="bg-primary/[0.02] border border-primary/15 rounded-xl p-4 mt-2 space-y-2 animate-fadeIn">
                                            <label className="block text-[11px] font-bold text-primary uppercase tracking-wider">
                                                {q1SpecsMap[answers["q1"]].label} <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={answers["q1_spec"] || ""}
                                                onChange={(e) => setAnswers({ ...answers, q1_spec: e.target.value })}
                                                placeholder={q1SpecsMap[answers["q1"]].placeholder}
                                                className="w-full text-xs text-gray-800 bg-white border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-inner"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {q.type === "checkbox" && (
                                <div className="space-y-3 pt-1">
                                    <div className="flex flex-col gap-2">
                                        {q.options.map((opt: string) => {
                                            const currentAnswers = answers[q.id] || [];
                                            const isSelected = currentAnswers.includes(opt);
                                            const toggleCheckbox = () => {
                                                let newSelection;
                                                if (isSelected) {
                                                    newSelection = currentAnswers.filter((item: string) => item !== opt);
                                                } else {
                                                    newSelection = [...currentAnswers, opt];
                                                }
                                                const updatedAnswers = { ...answers, [q.id]: newSelection };
                                                if (q.id === "q2" && !newSelection.includes("Otro")) {
                                                    delete updatedAnswers["q2_spec"];
                                                }
                                                setAnswers(updatedAnswers);
                                            };
                                            return (
                                                <button 
                                                    key={opt}
                                                    type="button"
                                                    onClick={toggleCheckbox}
                                                    className={cn(
                                                        "p-3.5 text-left border rounded-lg transition-all text-sm font-medium flex justify-between items-center",
                                                        isSelected 
                                                            ? "border-primary bg-primary-light text-primary-dark font-semibold shadow-sm" 
                                                            : "border-gray-200 bg-gray-50 text-gray-700 hover:border-primary/40"
                                                    )}
                                                >
                                                    <span>{opt}</span>
                                                    <div className={cn(
                                                        "w-5 h-5 rounded border flex items-center justify-center transition-all",
                                                        isSelected 
                                                            ? "bg-primary border-primary text-white animate-scaleIn" 
                                                            : "border-gray-300 bg-white"
                                                    )}>
                                                        {isSelected && "✓"}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {q.id === "q2" && Array.isArray(answers["q2"]) && answers["q2"].includes("Otro") && (
                                        <div className="bg-primary/[0.02] border border-primary/15 rounded-xl p-4 mt-2 space-y-2 animate-fadeIn">
                                            <label className="block text-[11px] font-bold text-primary uppercase tracking-wider">
                                                ¿Cuál es el otro espacio o actividad? <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={answers["q2_spec"] || ""}
                                                onChange={(e) => setAnswers({ ...answers, q2_spec: e.target.value })}
                                                placeholder="Ej: Talleres paralelos, Stand cultural, etc."
                                                className="w-full text-xs text-gray-800 bg-white border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-inner"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {q.type === "text" && (
                                <div className="pt-1">
                                    <textarea
                                        rows={3}
                                        value={answers[q.id] || ""}
                                        onChange={(e) => setAnswers({...answers, [q.id]: e.target.value})}
                                        placeholder={q.placeholder || "Escribe tu respuesta aquí..."}
                                        className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary bg-gray-50"
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* FORMULARIO DE REGISTRO E INFORMACIÓN DE DATOS PERSONALES */}
            <div className="mt-10 pt-8 border-t border-gray-100 space-y-5">
                <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                        Información del Participante & Habeas Data
                    </h3>
                    <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                        Por favor, proporciona tus datos básicos y autoriza el tratamiento de tu información personal antes de enviar el cuestionario.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nombre Completo</label>
                        <input 
                            type="text"
                            value={respondentName}
                            onChange={e => setRespondentName(e.target.value)}
                            placeholder="Ej: Laura Castro"
                            className="w-full text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Correo Electrónico</label>
                        <input 
                            type="email"
                            value={respondentEmail}
                            onChange={e => setRespondentEmail(e.target.value)}
                            placeholder="Ej: laura@ejemplo.com"
                            className="w-full text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                        />
                    </div>
                </div>

                {/* POLITICA DE TRATAMIENTO DE DATOS / HABEAS DATA */}
                <div 
                    onClick={() => setAuthorizedConsent(!authorizedConsent)}
                    className={cn(
                        "p-4 border rounded-xl transition-all cursor-pointer flex gap-3 text-left select-none",
                        authorizedConsent 
                            ? "bg-primary/[0.03] border-primary/20 text-gray-800" 
                            : "bg-gray-50/50 border-gray-200 text-gray-600 hover:border-gray-300"
                    )}
                >
                    <div className="pt-0.5">
                        <div className={cn(
                            "w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0",
                            authorizedConsent 
                                ? "bg-primary border-primary text-white" 
                                : "border-gray-300 bg-white"
                        )}>
                            {authorizedConsent && "✓"}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-700">Autorización de Tratamiento de Datos (Requerido)</p>
                        <p className="text-[10px] leading-relaxed text-gray-500 font-medium">
                            De conformidad con la Ley 1581 de 2012 de Protección de Datos Personales (Habeas Data), autorizo de manera libre, previa e informada el uso de mis datos recolectados en esta encuesta con finalidades estrictamente académicas, estadísticas y de mejora del servicio. El organizador garantiza la confidencialidad y el derecho a revocar este acceso en cualquier momento.
                        </p>
                    </div>
                </div>
            </div>

            <button 
                onClick={handleSubmit} 
                disabled={!isFormValid || submitting}
                className="mt-8 w-full bg-primary hover:bg-primary-dark text-white font-medium rounded-lg px-6 py-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm"
            >
                {submitting ? 'Enviando Respuestas...' : 'Enviar Respuestas'}
            </button>
        </div>
    </div>
  );
}
