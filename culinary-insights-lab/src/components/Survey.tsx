import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { cn } from "../lib/utils";

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
                                    {(q.minLabel || q.maxLabel) && (
                                        <p className="text-xs text-gray-500 bg-gray-100/60 border border-gray-200/50 px-3 py-1.5 rounded-lg inline-block select-none animate-fadeIn">
                                            Escala de <strong className="font-semibold text-gray-700">{minVal} a {maxVal}</strong>, siendo <strong className="font-semibold text-gray-700">{minVal} ({q.minLabel || "Mínimo"})</strong> y <strong className="font-semibold text-gray-700">{maxVal} ({q.maxLabel || "Máximo"})</strong>.
                                        </p>
                                    )}
                                </div>
                            )}
                            
                            {q.type === "choice" && (
                                <div className="flex flex-col gap-2 pt-1">
                                    {q.options.map((opt: string) => (
                                        <button 
                                            key={opt}
                                            type="button"
                                            onClick={() => setAnswers({...answers, [q.id]: opt})}
                                            className={cn(
                                                "p-3.5 text-left border rounded-lg transition-all text-sm font-medium",
                                                answers[q.id] === opt 
                                                    ? "border-primary bg-primary-light text-primary-dark" 
                                                    : "border-gray-200 bg-gray-50 text-gray-700 hover:border-primary/50"
                                            )}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {q.type === "checkbox" && (
                                <div className="flex flex-col gap-2 pt-1">
                                    {q.options.map((opt: string) => {
                                        const currentAnswers = answers[q.id] || [];
                                        const isSelected = currentAnswers.includes(opt);
                                        const toggleCheckbox = () => {
                                            if (isSelected) {
                                                setAnswers({
                                                    ...answers,
                                                    [q.id]: currentAnswers.filter((item: string) => item !== opt)
                                                });
                                            } else {
                                                setAnswers({
                                                    ...answers,
                                                    [q.id]: [...currentAnswers, opt]
                                                });
                                            }
                                        };
                                        return (
                                            <button 
                                                key={opt}
                                                type="button"
                                                onClick={toggleCheckbox}
                                                className={cn(
                                                    "p-3.5 text-left border rounded-lg transition-all text-sm font-medium flex justify-between items-center",
                                                    isSelected 
                                                        ? "border-primary bg-primary-light text-primary-dark font-semibold" 
                                                        : "border-gray-200 bg-gray-50 text-gray-700 hover:border-primary/40"
                                                )}
                                            >
                                                <span>{opt}</span>
                                                <div className={cn(
                                                    "w-5 h-5 rounded border flex items-center justify-center transition-all",
                                                    isSelected 
                                                        ? "bg-primary border-primary text-white" 
                                                        : "border-gray-300 bg-white"
                                                )}>
                                                    {isSelected && "✓"}
                                                </div>
                                            </button>
                                        );
                                    })}
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
