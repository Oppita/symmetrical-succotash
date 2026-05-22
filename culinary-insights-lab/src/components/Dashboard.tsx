import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";

import {
  RefreshCw,
  Sparkles,
  QrCode,
  ArrowLeft,
  Share2,
  Download,
  List,
  MessageSquare,
  Award,
  ShieldCheck,
  Users
} from "lucide-react";

export default function Dashboard() {
  const { id } = useParams();

  const surveyId = id || "demo";

  const [responses, setResponses] = useState<any[]>([]);
  const [surveyData, setSurveyData] = useState<any>(null);

  const [surveyTitle, setSurveyTitle] = useState(
    "Resultados de Encuesta"
  );

  const [activeQuestionId, setActiveQuestionId] =
    useState<string>("");

  const [selectedParticipationFilter, setSelectedParticipationFilter] =
    useState<string>("Todos");

  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  const [analyzing, setAnalyzing] = useState(false);

  const qrUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/q/${surveyId}`
      : "";

  const colors = [
    "#10b981",
    "#34d399",
    "#059669",
    "#6ee7b7",
    "#a7f3d0",
    "#047857",
    "#065f46",
    "#022c22"
  ];

  // FETCH DATA
  const fetchData = async () => {
    try {
      const surveyRes = await fetch(`/api/survey/${surveyId}`);

      if (surveyRes.ok) {
        const survey = await surveyRes.json();

        setSurveyData(survey);

        if (survey.title) {
          setSurveyTitle(survey.title);
        }
      }

      const resultsRes = await fetch(
        `/api/survey/${surveyId}/results`
      );

      if (resultsRes.ok) {
        const results = await resultsRes.json();
        setResponses(results);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();

    const interval = setInterval(fetchData, 3000);

    return () => clearInterval(interval);
  }, [surveyId]);

  useEffect(() => {
    if (
      surveyData?.questions?.length > 0 &&
      !activeQuestionId
    ) {
      setActiveQuestionId(surveyData.questions[0].id);
    }
  }, [surveyData, activeQuestionId]);

  // QUESTIONS
  const currentQuestionData = useMemo(() => {
    if (!surveyData) return null;

    return surveyData.questions.find(
      (q: any) => q.id === activeQuestionId
    );
  }, [surveyData, activeQuestionId]);

  // PARTICIPATION OPTIONS
  const participationOptions = useMemo(() => {
    if (!surveyData) return [];

    const q1 = surveyData.questions?.find(
      (q: any) => q.id === "q1"
    );

    return q1?.options || [];
  }, [surveyData]);

  // COUNTS
  const participationCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Todos: responses.length
    };

    participationOptions.forEach((opt: string) => {
      counts[opt] = 0;
    });

    responses.forEach((r) => {
      const val = r.answers?.q1;

      if (val && counts[val] !== undefined) {
        counts[val]++;
      }
    });

    return counts;
  }, [responses, participationOptions]);

  // FILTERED RESPONSES
  const filteredResponses = useMemo(() => {
    if (
      selectedParticipationFilter === "Todos"
    ) {
      return responses;
    }

    return responses.filter(
      (r) =>
        r.answers?.q1 ===
        selectedParticipationFilter
    );
  }, [responses, selectedParticipationFilter]);

  // SCALE LABELS
  const getScaleLabelForValue = (
    val: number,
    q: any
  ) => {
    const minVal =
      q.min !== undefined ? q.min : 1;

    const maxVal =
      q.max !== undefined ? q.max : 5;

    const range = maxVal - minVal + 1;

    if (range === 5) {
      if (
        q.minLabel?.toLowerCase().includes(
          "deficiente"
        ) ||
        q.maxLabel?.toLowerCase().includes(
          "excelente"
        )
      ) {
        const labels = [
          "Deficiente",
          "Mala",
          "Regular",
          "Buena",
          "Excelente"
        ];

        return labels[val - 1] || String(val);
      }

      const labels = [
        "Muy mala",
        "Mala",
        "Regular",
        "Buena",
        "Muy buena"
      ];

      return labels[val - 1] || String(val);
    }

    if (val === minVal) {
      return `${val} (${q.minLabel || "Mínimo"})`;
    }

    if (val === maxVal) {
      return `${val} (${q.maxLabel || "Máximo"})`;
    }

    return String(val);
  };

  // CHART STATS
  const chartStats = useMemo(() => {
    if (
      !currentQuestionData ||
      filteredResponses.length === 0
    ) {
      return [];
    }

    const counts: Record<string, number> = {};

    // CHOICE
    if (
      currentQuestionData.type === "choice"
    ) {
      currentQuestionData.options?.forEach(
        (opt: string) => {
          counts[opt] = 0;
        }
      );

      filteredResponses.forEach((r) => {
        const val =
          r.answers[currentQuestionData.id];

        if (val) {
          counts[val] =
            (counts[val] || 0) + 1;
        }
      });
    }

    // CHECKBOX
    else if (
      currentQuestionData.type === "checkbox"
    ) {
      currentQuestionData.options?.forEach(
        (opt: string) => {
          counts[opt] = 0;
        }
      );

      filteredResponses.forEach((r) => {
        const vals =
          r.answers[currentQuestionData.id];

        if (Array.isArray(vals)) {
          vals.forEach((v: string) => {
            counts[v] =
              (counts[v] || 0) + 1;
          });
        }
      });
    }

    // SCALE
    else if (
      currentQuestionData.type === "scale"
    ) {
      const min =
        currentQuestionData.min || 1;

      const max =
        currentQuestionData.max || 5;

      for (let i = min; i <= max; i++) {
        counts[
          getScaleLabelForValue(
            i,
            currentQuestionData
          )
        ] = 0;
      }

      filteredResponses.forEach((r) => {
        const val = Number(
          r.answers[currentQuestionData.id]
        );

        if (!isNaN(val)) {
          const label =
            getScaleLabelForValue(
              val,
              currentQuestionData
            );

          counts[label] =
            (counts[label] || 0) + 1;
        }
      });
    }

    return Object.entries(counts).map(
      ([name, count]) => ({
        name,
        count
      })
    );
  }, [filteredResponses, currentQuestionData]);

  // AVERAGE SCORE
  const averageRatingForActiveQuestion =
    useMemo(() => {
      if (
        !currentQuestionData ||
        currentQuestionData.type !==
          "scale" ||
        filteredResponses.length === 0
      ) {
        return null;
      }

      const sum = filteredResponses.reduce(
        (acc, r) => {
          return (
            acc +
            (Number(
              r.answers[currentQuestionData.id]
            ) || 0)
          );
        },
        0
      );

      return (
        sum / filteredResponses.length
      ).toFixed(1);
    }, [
      filteredResponses,
      currentQuestionData
    ]);

  // GENERAL SATISFACTION
  const generalSatisfaction = useMemo(() => {
    if (
      !surveyData ||
      filteredResponses.length === 0
    ) {
      return "N/A";
    }

    const q =
      surveyData.questions.find(
        (x: any) => x.id === "q3"
      ) ||
      surveyData.questions.find(
        (x: any) => x.type === "scale"
      );

    if (!q) return "N/A";

    const sum = filteredResponses.reduce(
      (acc, r) => {
        return (
          acc +
          (Number(r.answers[q.id]) || 0)
        );
      },
      0
    );

    return (
      (
        sum / filteredResponses.length
      ).toFixed(1) +
      ` / ${q.max || 5}`
    );
  }, [surveyData, filteredResponses]);

  // TEXT ANSWERS
  const textAnswers = useMemo(() => {
    if (
      !currentQuestionData ||
      currentQuestionData.type !== "text"
    ) {
      return [];
    }

    return filteredResponses
      .map(
        (r) =>
          r.answers[currentQuestionData.id]
      )
      .filter(
        (v: any) =>
          typeof v === "string" &&
          v.trim().length > 0
      );
  }, [
    filteredResponses,
    currentQuestionData
  ]);

  // RESPONDENTS
  const respondents = useMemo(() => {
    return responses.map((r) => ({
      id: r.id,
      name:
        r.answers?._respondentName ||
        "Anónimo",

      email:
        r.answers?._respondentEmail ||
        "No registrado",

      consented:
        r.answers?._authorizedConsent ||
        false,

      timestamp: r.timestamp
        ? new Date(
            r.timestamp
          ).toLocaleString("es-CO")
        : "N/A"
    }));
  }, [responses]);

  // AI ANALYSIS
  const requestAnalysis = async () => {
    setAnalyzing(true);

    try {
      const res = await fetch(
        "/api/analyze",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            surveyId,
            data: filteredResponses
          })
        }
      );

      const json = await res.json();

      if (json.analysis) {
        setAiAnalysis(json.analysis);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  // DOWNLOAD CSV
  const downloadCSV = () => {
    if (
      !surveyData ||
      responses.length === 0
    ) {
      return;
    }

    const headers = [
      "ID",
      "Fecha",
      "Nombre",
      "Correo",
      "Consentimiento"
    ];

    surveyData.questions.forEach(
      (q: any) => {
        headers.push(q.text);
      }
    );

    let csv =
      "\uFEFF" + headers.join(",") + "\n";

    responses.forEach((r) => {
      const row = [
        r.id || "",
        r.timestamp || "",
        r.answers?._respondentName ||
          "",
        r.answers?._respondentEmail ||
          "",
        r.answers?._authorizedConsent
          ? "SÍ"
          : "NO"
      ];

      surveyData.questions.forEach(
        (q: any) => {
          const val = r.answers[q.id];

          if (Array.isArray(val)) {
            row.push(
              `"${val.join(" ; ")}"`
            );
          } else {
            row.push(
              `"${String(
                val || ""
              ).replace(/"/g, '""')}"`
            );
          }
        }
      );

      csv += row.join(",") + "\n";
    });

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;

    a.download = `Resultados_${surveyTitle}.csv`;

    document.body.appendChild(a);

    a.click();

    document.body.removeChild(a);
  };

  // DOWNLOAD QR
  const downloadQR = () => {
    const canvas =
      document.getElementById(
        "qrCodeEl"
      ) as HTMLCanvasElement;

    if (!canvas) return;

    const pngUrl = canvas
      .toDataURL("image/png")
      .replace(
        "image/png",
        "image/octet-stream"
      );

    const a =
      document.createElement("a");

    a.href = pngUrl;

    a.download = `QR_${surveyTitle}.png`;

    document.body.appendChild(a);

    a.click();

    document.body.removeChild(a);
  };

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
    `¡Te invito a completar esta encuesta!\n\n${qrUrl}`
  )}`;

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-10">
      {/* HEADER */}
      <Link
        to="/"
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-black mb-6"
      >
        <ArrowLeft size={16} />
        Volver
      </Link>

      <header className="flex flex-col md:flex-row justify-between gap-6 border-b border-gray-100 pb-6 mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">
            {surveyTitle}
          </h1>

          <p className="text-gray-500 mt-2">
            Dashboard analítico en tiempo real
          </p>
        </div>

        <div className="flex gap-8">
          <div>
            <div className="text-3xl font-bold">
              {responses.length}
            </div>

            <div className="text-xs uppercase text-gray-500 font-semibold">
              Respuestas
            </div>
          </div>

          <div>
            <div className="text-3xl font-bold text-primary">
              {generalSatisfaction}
            </div>

            <div className="text-xs uppercase text-gray-500 font-semibold">
              Satisfacción
            </div>
          </div>
        </div>
      </header>

      {/* FILTERS */}
      <div className="bg-gray-950 rounded-2xl p-6 mb-8 border border-gray-800">
        <h3 className="text-white font-bold text-sm mb-4">
          Segmentación
        </h3>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              setSelectedParticipationFilter(
                "Todos"
              )
            }
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedParticipationFilter ===
              "Todos"
                ? "bg-white text-black"
                : "bg-gray-800 text-white"
            }`}
          >
            Todos (
            {participationCounts["Todos"]})
          </button>

          {participationOptions.map(
            (opt: string) => (
              <button
                key={opt}
                onClick={() =>
                  setSelectedParticipationFilter(
                    opt
                  )
                }
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  selectedParticipationFilter ===
                  opt
                    ? "bg-primary text-black"
                    : "bg-gray-800 text-white"
                }`}
              >
                {opt} (
                {participationCounts[opt] || 0}
                )
              </button>
            )
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          {/* QR */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm">
                Compartir Encuesta
              </h3>

              <QrCode
                size={18}
                className="text-primary"
              />
            </div>

            <div className="flex justify-center bg-gray-50 rounded-xl p-4 border border-gray-100 mb-4">
              <QRCodeCanvas
                id="qrCodeEl"
                value={qrUrl}
                size={160}
              />
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={downloadQR}
                className="bg-gray-100 hover:bg-gray-200 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2"
              >
                <Download size={14} />
                Descargar QR
              </button>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-[#25d366] hover:bg-[#20bd5a] text-white py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Share2 size={14} />
                Compartir WhatsApp
              </a>
            </div>
          </div>

          {/* QUESTIONS */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
              <List size={16} />
              Preguntas
            </h3>

            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {surveyData?.questions?.map(
                (q: any, i: number) => (
                  <button
                    key={q.id}
                    onClick={() => {
                      setActiveQuestionId(
                        q.id
                      );

                      setAiAnalysis(null);
                    }}
                    className={`w-full text-left rounded-xl p-3 border transition-all ${
                      activeQuestionId === q.id
                        ? "border-primary bg-primary/10"
                        : "border-gray-100 bg-gray-50 hover:bg-gray-100"
                    }`}
                  >
                    <div className="text-[10px] uppercase text-gray-400 font-bold mb-1">
                      Pregunta {i + 1}
                    </div>

                    <div className="text-xs font-semibold text-gray-700 line-clamp-2">
                      {q.text}
                    </div>
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          {/* CHART */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <div className="mb-6 border-b border-gray-100 pb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {currentQuestionData?.text}
              </h2>
            </div>

            {responses.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-gray-400">
                No hay respuestas aún.
              </div>
            ) : currentQuestionData?.type ===
              "text" ? (
              <div className="space-y-3">
                {textAnswers.map(
                  (answer, index) => (
                    <div
                      key={index}
                      className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm"
                    >
                      "{answer}"
                    </div>
                  )
                )}
              </div>
            ) : (
              <>
                <div className="h-[320px]">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <BarChart
                      data={chartStats}
                    >
                      <XAxis
                        dataKey="name"
                        tick={{
                          fontSize: 10
                        }}
                      />

                      <YAxis
                        allowDecimals={
                          false
                        }
                      />

                      <Tooltip />

                      <Bar
                        dataKey="count"
                        radius={[
                          6,
                          6,
                          0,
                          0
                        ]}
                      >
                        {chartStats.map(
                          (
                            entry,
                            index
                          ) => (
                            <Cell
                              key={index}
                              fill={
                                colors[
                                  index %
                                    colors.length
                                ]
                              }
                            />
                          )
                        )}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {averageRatingForActiveQuestion && (
                  <div className="mt-6 bg-gray-50 border border-gray-100 rounded-2xl p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Award size={22} />
                      </div>

                      <div>
                        <div className="font-bold text-sm">
                          Promedio
                        </div>

                        <div className="text-xs text-gray-500">
                          Calificación media
                        </div>
                      </div>
                    </div>

                    <div className="text-4xl font-bold">
                      {
                        averageRatingForActiveQuestion
                      }

                      <span className="text-lg text-gray-400">
                        /
                        {currentQuestionData.max ||
                          5}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* AI */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-8 flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <h3 className="font-bold flex items-center gap-2 mb-2">
                <Sparkles
                  size={18}
                  className="text-primary"
                />
                Diagnóstico IA
              </h3>

              {aiAnalysis ? (
                <div className="bg-white rounded-xl border border-primary/10 p-4 text-sm leading-relaxed">
                  {aiAnalysis}
                </div>
              ) : (
                <div className="text-sm text-gray-400 italic">
                  Ejecuta el análisis IA.
                </div>
              )}
            </div>

            <button
              onClick={requestAnalysis}
              disabled={
                analyzing ||
                responses.length === 0
              }
              className="bg-white border border-primary text-primary hover:bg-primary hover:text-white px-5 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  Procesando
                  <RefreshCw
                    size={16}
                    className="animate-spin"
                  />
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Analizar
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* RESPONDENTS */}
      <div className="mt-12 bg-white border border-gray-200 rounded-2xl p-8">
        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Users
                size={20}
                className="text-primary"
              />
              Participantes
            </h3>

            <p className="text-xs text-gray-500 mt-1">
              Consolidado de personas y
              consentimiento
            </p>
          </div>

          <button
            onClick={downloadCSV}
            className="bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2"
          >
            <Download size={14} />
            Descargar CSV
          </button>
        </div>

        {respondents.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No hay registros aún.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500 uppercase text-xs">
                  <th className="text-left py-3">
                    Nombre
                  </th>

                  <th className="text-left py-3">
                    Correo
                  </th>

                  <th className="text-center py-3">
                    Habeas Data
                  </th>

                  <th className="text-right py-3">
                    Fecha
                  </th>
                </tr>
              </thead>

              <tbody>
                {respondents.map(
                  (r, index) => (
                    <tr
                      key={index}
                      className="border-b border-gray-50 hover:bg-gray-50"
                    >
                      <td className="py-4 font-semibold">
                        {r.name}
                      </td>

                      <td className="py-4 text-gray-500">
                        {r.email}
                      </td>

                      <td className="py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${
                            r.consented
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          <ShieldCheck size={12} />

                          {r.consented
                            ? "Autorizado"
                            : "No"}
                        </span>
                      </td>

                      <td className="py-4 text-right text-gray-400">
                        {r.timestamp}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
