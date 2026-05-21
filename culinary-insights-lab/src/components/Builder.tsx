import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2, Save, ArrowLeft, Loader2 } from "lucide-react";

export default function Builder() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [title, setTitle] = useState("Nueva Encuesta");
  const [questions, setQuestions] = useState<any[]>([
    { id: "q1", text: "Calificación general (1-5)", type: "scale", min: 1, max: 5 }
  ]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Cargar datos si estamos en modo edición
  useEffect(() => {
    if (id) {
      setLoading(true);
      fetch(`/api/survey/${id}`)
        .then((res) => {
          if (!res.ok) throw new Error("No se pudo cargar la encuesta");
          return res.json();
        })
        .then((data) => {
          setTitle(data.title);
          if (data.questions && data.questions.length > 0) {
            setQuestions(data.questions);
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          alert("Error cargando la encuesta para editar.");
          setLoading(false);
          navigate("/");
        });
    }
  }, [id, navigate]);

  const addQuestion = (type: "scale" | "choice" | "checkbox" | "text") => {
    const qId = `q_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    let defaultQ: any = { id: qId, type, text: "" };

    if (type === "scale") {
      defaultQ.text = "Nueva pregunta de escala";
      defaultQ.min = 1;
      defaultQ.max = 5;
      defaultQ.minLabel = "Deficiente";
      defaultQ.maxLabel = "Excelente";
    } else if (type === "choice") {
      defaultQ.text = "Nueva pregunta de opciones";
      defaultQ.options = ["Opción 1", "Opción 2"];
    } else if (type === "checkbox") {
      defaultQ.text = "Nueva pregunta de selección múltiple";
      defaultQ.options = ["Opción A", "Opción B"];
    } else if (type === "text") {
      defaultQ.text = "Nueva pregunta de respuesta abierta";
      defaultQ.placeholder = "Escribe tu respuesta...";
    }

    setQuestions([...questions, defaultQ]);
  };

  const removeQuestion = (qId: string) => {
    setQuestions(questions.filter(q => q.id !== qId));
  };

  const updateQuestionText = (qId: string, text: string) => {
    setQuestions(questions.map(q => q.id === qId ? { ...q, text } : q));
  };

  const updateQuestionSection = (qId: string, section: string) => {
    setQuestions(questions.map(q => q.id === qId ? { ...q, section } : q));
  };

  const updateQuestionOptional = (qId: string, optional: boolean) => {
    setQuestions(questions.map(q => q.id === qId ? { ...q, optional } : q));
  };

  const updateOptions = (qId: string, optionsValue: string) => {
    const optsCount = optionsValue.split(',').map(s => s.trim()).filter(Boolean);
    setQuestions(questions.map(q => q.id === qId ? { ...q, options: optsCount } : q));
  };

  const updateScaleMax = (qId: string, maxVal: number) => {
    setQuestions(questions.map(q => q.id === qId ? { ...q, max: maxVal } : q));
  };

  const updateScaleMin = (qId: string, minVal: number) => {
    setQuestions(questions.map(q => q.id === qId ? { ...q, min: minVal } : q));
  };

  const updateScaleMinLabel = (qId: string, minLabel: string) => {
    setQuestions(questions.map(q => q.id === qId ? { ...q, minLabel } : q));
  };

  const updateScaleMaxLabel = (qId: string, maxLabel: string) => {
    setQuestions(questions.map(q => q.id === qId ? { ...q, maxLabel } : q));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert("Por favor introduce un título para la encuesta.");
      return;
    }
    if (questions.length === 0) {
      alert("La encuesta debe tener al menos una pregunta.");
      return;
    }

    setSaving(true);
    const url = id ? `/api/survey/${id}` : "/api/surveys";
    const method = id ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, questions })
      });
      if (!res.ok) {
        throw new Error(`Error del servidor: ${res.statusText}`);
      }
      const data = await res.json();
      alert(id ? "¡Encuesta modificada correctamente!" : "¡Encuesta creada correctamente!");
      navigate(`/dashboard/${data.id || id}`);
    } catch (e: any) {
      console.error(e);
      alert("No se pudo guardar la encuesta. Detalles: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-gray-500">
        <Loader2 className="animate-spin text-primary mb-4" size={32} />
        <p className="font-semibold text-sm">Cargando encuesta para editar...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-12">
      <button onClick={() => navigate("/")} className="text-gray-500 hover:text-gray-900 flex items-center gap-2 mb-8 font-medium text-sm transition-colors">
        <ArrowLeft size={16} /> Volver a mis encuestas
      </button>

      <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
        <div className="mb-8">
          <label className="block text-[11px] font-bold text-primary uppercase tracking-wider mb-1">Título de la Encuesta</label>
          <input 
            type="text" 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
            className="text-3xl font-bold text-gray-900 border-b-2 border-dashed border-gray-200 hover:border-gray-300 focus:border-primary focus:outline-none w-full bg-transparent px-1 py-1 transition-colors"
            placeholder="Título de la Encuesta"
          />
        </div>

        <div className="space-y-6 mb-10">
          {questions.map((q, index) => (
            <div key={q.id} className="border border-gray-200 rounded-xl p-6 bg-gray-50/50 relative group shadow-sm hover:border-gray-300 transition-all">
              <button 
                onClick={() => removeQuestion(q.id)}
                className="absolute top-6 right-6 text-gray-400 hover:text-red-500 transition-colors"
                title="Eliminar pregunta"
                disabled={questions.length === 1}
              >
                <Trash2 size={18} />
              </button>
              
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
                {/* Pregunta Texto */}
                <div className="md:col-span-8">
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pregunta {index + 1}</label>
                    <span className="bg-primary/10 text-primary font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full">
                      {q.type}
                    </span>
                  </div>
                  <input 
                    type="text" 
                    value={q.text} 
                    onChange={e => updateQuestionText(q.id, e.target.value)}
                    placeholder="Escribe la pregunta..."
                    className="w-full font-semibold text-gray-800 bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>

                {/* Sección opcional */}
                <div className="md:col-span-4">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Grupo/Sección (Opcional)</label>
                  <input 
                    type="text" 
                    value={q.section || ""} 
                    onChange={e => updateQuestionSection(q.id, e.target.value)}
                    placeholder="Ej, SECCIÓN 1 - PERFIL"
                    className="w-full font-medium text-gray-600 bg-white border border-gray-300 rounded-lg px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>
              </div>

              {/* Opciones Específicas del tipo de pregunta */}
              <div className="mt-4 pt-4 border-t border-gray-200/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Configuración de opciones */}
                <div className="flex-1">
                  {(q.type === "choice" || q.type === "checkbox") && (
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Opciones (separadas por coma)</label>
                      <input 
                        type="text" 
                        value={q.options ? q.options.join(', ') : ""} 
                        onChange={e => updateOptions(q.id, e.target.value)}
                        className="w-full text-xs text-gray-700 bg-white border border-gray-300 rounded-lg px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                        placeholder="Ejemplo: Excelente, Bueno, Regular, Malo"
                      />
                    </div>
                  )}

                  {q.type === "scale" && (
                    <div className="flex flex-wrap items-end gap-3 bg-gray-100/60 p-3 rounded-xl border border-gray-200/50">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Mínimo</label>
                        <select 
                          value={q.min !== undefined ? q.min : 1}
                          onChange={e => updateScaleMin(q.id, Number(e.target.value))}
                          className="bg-white border border-gray-300 text-gray-700 rounded-lg text-xs px-2.5 py-1.5 focus:outline-none"
                        >
                          <option value="0">0</option>
                          <option value="1">1</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Máximo</label>
                        <select 
                          value={q.max !== undefined ? q.max : 5}
                          onChange={e => updateScaleMax(q.id, Number(e.target.value))}
                          className="bg-white border border-gray-300 text-gray-700 rounded-lg text-xs px-2.5 py-1.5 focus:outline-none"
                        >
                          <option value="5">5</option>
                          <option value="10">10</option>
                        </select>
                      </div>
                      <div className="flex-1 min-w-[130px]">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Texto para el Mínimo ({q.min !== undefined ? q.min : 1})</label>
                        <input 
                          type="text"
                          value={q.minLabel || ""}
                          onChange={e => updateScaleMinLabel(q.id, e.target.value)}
                          placeholder="Ej: Deficiente"
                          className="w-full text-xs text-gray-700 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                        />
                      </div>
                      <div className="flex-1 min-w-[130px]">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Texto para el Máximo ({q.max !== undefined ? q.max : 5})</label>
                        <input 
                          type="text"
                          value={q.maxLabel || ""}
                          onChange={e => updateScaleMaxLabel(q.id, e.target.value)}
                          placeholder="Ej: Excelente"
                          className="w-full text-xs text-gray-700 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                        />
                      </div>
                    </div>
                  )}

                  {q.type === "text" && (
                    <div>
                      <p className="text-[11px] text-gray-400 italic">Los usuarios recibirán un cuadro de texto amplio para responder libremente.</p>
                    </div>
                  )}
                </div>

                {/* Interruptor Opcional */}
                <div className="flex items-center gap-2 select-none">
                  <input 
                    type="checkbox" 
                    id={`opt-${q.id}`}
                    checked={!!q.optional}
                    onChange={e => updateQuestionOptional(q.id, e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor={`opt-${q.id}`} className="text-xs font-semibold text-gray-500 cursor-pointer">
                    Es pregunta opcional
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Botones de Selección para Añadir Preguntas */}
        <div className="mb-10">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 text-center">Añadir Tipo de Pregunta</label>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <button 
              type="button"
              onClick={() => addQuestion('scale')}
              className="flex items-center justify-center gap-2 border border-gray-300 hover:border-primary hover:text-primary hover:bg-primary/5 text-gray-600 rounded-xl px-4 py-3 font-semibold text-xs transition-colors border-dashed"
            >
              <Plus size={14} /> Escala Numérica
            </button>
            <button 
              type="button"
              onClick={() => addQuestion('choice')}
              className="flex items-center justify-center gap-2 border border-gray-300 hover:border-primary hover:text-primary hover:bg-primary/5 text-gray-600 rounded-xl px-4 py-3 font-semibold text-xs transition-colors border-dashed"
            >
              <Plus size={14} /> Opción Única
            </button>
            <button 
              type="button"
              onClick={() => addQuestion('checkbox')}
              className="flex items-center justify-center gap-2 border border-gray-300 hover:border-primary hover:text-primary hover:bg-primary/5 text-gray-600 rounded-xl px-4 py-3 font-semibold text-xs transition-colors border-dashed"
            >
              <Plus size={14} /> Selección Múltiple
            </button>
            <button 
              type="button"
              onClick={() => addQuestion('text')}
              className="flex items-center justify-center gap-2 border border-gray-300 hover:border-primary hover:text-primary hover:bg-primary/5 text-gray-600 rounded-xl px-4 py-3 font-semibold text-xs transition-colors border-dashed"
            >
              <Plus size={14} /> Respuesta Abierta
            </button>
          </div>
        </div>

        {/* Guardar cambios */}
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white rounded-xl px-6 py-4 font-bold text-lg transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
        >
          {saving ? 'Guardando...' : <><Save size={20} /> {id ? "Actualizar Cambios" : "Guardar y Crear Encuesta"}</>}
        </button>
      </div>
    </div>
  );
}
