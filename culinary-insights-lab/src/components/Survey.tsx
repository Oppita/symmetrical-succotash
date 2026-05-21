import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { cn } from "../lib/utils";

export default function Survey() {
  const { id } = useParams();
  const [survey, setSurvey] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);

  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);
    try {
      const res = await fetch(`/api/survey/${id}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers)
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

  const isFormValid = survey.questions.every((q: any) => isQuestionAnswered(q));

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

            <button 
                onClick={handleSubmit} 
                disabled={!isFormValid || submitting}
                className="mt-10 w-full bg-primary hover:bg-primary-dark text-white font-medium rounded-lg px-6 py-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
                {submitting ? 'Enviando Respuestas...' : 'Enviar Respuestas'}
            </button>
        </div>
    </div>
  );
}
