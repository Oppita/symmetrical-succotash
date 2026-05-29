import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import {
  dbInit,
  isDbConnected,
  getDbProviderName,
  getSurveys,
  getSurveyById,
  saveSurvey,
  deleteSurvey,
  getResponsesForSurvey,
  saveResponse,
  deleteResponse,
  getResponseCount,
  syncDatabase,
  getDatabaseStats,
  getDbError
} from "./server/dbResolver";

const ai = process.env.GEMINI_API_KEY 
    ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    : null;

const app = express();
app.use(express.json());

// API STATUS
app.get("/api/db-status", async (req, res) => {
  try {
    const stats = await getDatabaseStats();
    res.json({
      connected: isDbConnected(),
      provider: getDbProviderName(),
      supabaseUrl: process.env.SUPABASE_URL ? "Configurado" : null,
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID || null,
      stats,
      errorLog: getDbError()
    });
  } catch (error) {
    res.json({ connected: false, error: "Error de estado" });
  }
});

// TEST DATABASE CONNECTION ENDPOINT
app.post("/api/db-retry", async (req, res) => {
  try {
    const hasUrl = !!process.env.SUPABASE_URL;
    const hasKey = !!(process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    let connectionLog = "Iniciando...";
    if (!hasUrl || !hasKey) {
      connectionLog = "Fallo: SUPABASE_URL o KEY no definidos en entorno.";
    } else {
      connectionLog = "Variables detectadas. Intentando conexión...";
    }

    await dbInit();
    const stats = await getDatabaseStats();
    
    const dbErr = getDbError();
    if (dbErr) connectionLog = `Fallo Supabase SQL: ${dbErr}`;

    res.json({
      connected: isDbConnected(),
      provider: getDbProviderName(),
      envOk: hasUrl && hasKey,
      stats,
      connectionLog,
      errorLog: dbErr
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Fallo en reconexión." });
  }
});

// SYNC DATABASE ENDPOINT
app.post("/api/db-sync", async (req, res) => {
  try {
    const logs = await syncDatabase();
    res.json({ logs });
  } catch (error: any) {
    console.error("Error during DB sync:", error);
    res.status(500).json({ error: error.message || "Failed to synchronize database" });
  }
});

// GET ALL SURVEYS
app.get("/api/surveys", async (req, res) => {
  try {
    const list = await getSurveys();
    const summary = await Promise.all(list.map(async (s: any) => {
      const count = await getResponseCount(s.id);
      return {
        id: s.id,
        title: s.title,
        responseCount: count
      };
    }));
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE NEW SURVEY
app.post("/api/surveys", async (req, res) => {
  try {
    console.log("POST /api/surveys received body:", req.body);
    const id = Date.now().toString(36);
    const newSurvey = await saveSurvey(id, req.body.title, req.body.questions);
    res.json(newSurvey);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET SURVEY DETAILS BY ID
app.get("/api/survey/:id", async (req, res) => {
  try {
    const survey = await getSurveyById(req.params.id);
    if (!survey) {
      res.status(404).json({ error: "Encuesta no encontrada" });
      return;
    }
    res.json(survey);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE EXISTING SURVEY QUESTIONS
app.put("/api/survey/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const existingSurvey = await getSurveyById(id);
    if (!existingSurvey) {
      res.status(404).json({ error: "Encuesta no encontrada" });
      return;
    }
    console.log(`PUT /api/survey/${id} received body:`, req.body);
    const updatedSurvey = await saveSurvey(id, req.body.title, req.body.questions);
    res.json(updatedSurvey);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE SURVEY AND CORRESPONDING RESPONSES
app.delete("/api/survey/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const deleted = await deleteSurvey(id);
    if (!deleted) {
      res.status(404).json({ error: "Encuesta no encontrada" });
      return;
    }
    console.log(`DELETE /api/survey/${id} completed successfully`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST SURVEY RESPONSE SUBMISSION
app.post("/api/survey/:id/import-responses", async (req, res) => {
  try {
    const surveyId = req.params.id;
    const { responses } = req.body;
    
    if (!Array.isArray(responses)) {
        return res.status(400).json({ error: "Invalid data format. Expected an array of responses." });
    }

    // Save each imported response
    for (const r of responses) {
       await saveResponse(surveyId, r);
    }
    
    console.log(`[IMPORT] Importadas ${responses.length} respuestas a la encuesta ${surveyId}`);
    res.json({ success: true, count: responses.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST SURVEY RESPONSE SUBMISSION
app.post("/api/survey/:id/response", async (req, res) => {
  try {
    const surveyId = req.params.id;
    await saveResponse(surveyId, req.body);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET SURVEY RESPONSES/RESULTS LIST
app.get("/api/survey/:id/results", async (req, res) => {
  try {
    const results = await getResponsesForSurvey(req.params.id);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE SURVEY RESPONSE
app.delete("/api/responses/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const deleted = await deleteResponse(id);
    if (!deleted) {
      res.status(404).json({ error: "Respuesta no encontrada" });
      return;
    }
    console.log(`DELETE /api/responses/${id} completed successfully`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI COGNITIVE AGENT ANALYSIS
app.post("/api/analyze", async (req, res) => {
  try {
     const { surveyId, data, apiProvider = "gemini", model = "" } = req.body;
     const survey = await getSurveyById(surveyId);
     
     const prompt = `
     Actúa como un experto investigador en estadística y análisis de datos. 
     Analiza meticulosamente los siguientes resultados de una encuesta. 
     
     Cuestionario Base:
     ${JSON.stringify(survey)}
     
     Resultados Consolidados:
     ${JSON.stringify(data)}
     
     Instrucción:
     Escribe un reporte analítico detallado, estructurado y supremamente riguroso basado EXCLUSIVAMENTE en los datos provistos.
     Utiliza formato Markdown para estructurar el reporte de forma profesional.
     
     El reporte debe contener OBLIGATORIAMENTE la siguiente estructura:
     1. **Resumen Ejecutivo**: Una visión de alto nivel de los hallazgos más críticos.
     2. **Análisis Descriptivo**: Desglose sistemático de tendencias métricas clave para cada pregunta, destacando mayorías, minorías, y dispersión de datos.
     3. **Hallazgos Cualitativos**: Si hay respuestas abiertas (texto), sintetiza el sentimiento general, patrones semánticos y perspectivas clave ocultas en el texto.
     4. **Cruces de Variables y Correlaciones Potenciales**: Si es posible identificar relaciones entre diferentes preguntas (ej. un grupo demográfico específico prefiere cierta opción), descríbelo analíticamente.
     5. **Conclusiones Estratégicas**: Deducciones lógicas derivadas de los datos.
     6. **Recomendaciones de Acción**: Acciones tácticas claras basadas en las conclusiones.
     
     Maneja un tono objetivo, académico, y enfocado en la toma de decisiones. Cita porcentajes o conteos específicos para respaldar tus afirmaciones. No inventes datos que no estén en "Resultados Consolidados".
     `;

    let analysisResult = "";

    if (apiProvider === "groq") {
      const groqKey = process.env.GROQ_API_KEY;
      if (!groqKey) throw new Error("Falta GROQ_API_KEY en las variables de entorno.");
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: model || "llama3-70b-8192", 
          messages: [{ role: "user", content: prompt }]
        })
      });
      const groqData = await response.json();
      if (groqData.error) throw new Error(groqData.error.message || JSON.stringify(groqData.error));
      analysisResult = groqData.choices[0].message.content;
      
    } else if (apiProvider === "openrouter") {
      const orKey = process.env.OPENROUTER_API_KEY;
      if (!orKey) throw new Error("Falta OPENROUTER_API_KEY en las variables de entorno.");
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${orKey}`,
          "HTTP-Referer": "https://ai.studio", 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: model || "anthropic/claude-3.5-sonnet",
          messages: [{ role: "user", content: prompt }]
        })
      });
      const orData = await response.json();
      if (orData.error) throw new Error(orData.error.message || JSON.stringify(orData.error));
      analysisResult = orData.choices[0].message.content;
      
    } else {
      // Default to Gemini
      if (!ai) throw new Error("Falta GEMINI_API_KEY en las variables de entorno.");
      const response = await ai.models.generateContent({ 
        model: model || "gemini-2.5-pro", 
        contents: prompt 
      });
      analysisResult = response.text;
    }
     
    res.json({ analysis: analysisResult });
  } catch (err: any) {
     console.error("Analysis Error:", err);
     res.status(500).json({ error: err.message });
  }
});

// SEMANTIC CLUSTERING API USING GEMINI
app.post("/api/semantically-cluster-specs", async (req, res) => {
  const { specs } = req.body;
  
  if (!Array.isArray(specs) || specs.length === 0) {
    res.json({ clusters: [] });
    return;
  }

  // Backup fallback algorithm
  const getFallbackClusters = () => {
    const groups: Record<string, string[]> = {};
    specs.forEach(s => {
      const clean = String(s).trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      
      const foundKey = Object.keys(groups).find(k => {
        return k.includes(key) || key.includes(k) || k.replace(/[^a-z0-9]/g, "") === key.replace(/[^a-z0-9]/g, "");
      });

      if (foundKey) {
        groups[foundKey].push(clean);
      } else {
        groups[key] = [clean];
      }
    });

    const clusters = Object.entries(groups).map(([_, list]) => ({
      name: list[0],
      count: list.length,
      items: list
    })).sort((a, b) => b.count - a.count);

    return { clusters };
  };

  if (!ai) {
    console.log("No GEMINI_API_KEY. Using local specification clustering fallback.");
    res.json(getFallbackClusters());
    return;
  }

  try {
    const prompt = `
    Eres un analista de datos experto y asistente cognitivo para eventos premium.
    Se te proporciona una lista de nombres de entidades, organizaciones o respuestas de texto libre registradas por usuarios en una encuesta de participación.
    Tu tarea es agrupar y consolidar semánticamente estas cadenas para ignorar variaciones tipográficas, abreviaciones, o diferencias de redacción menores. Concéntrate en unificar las organizaciones o conceptos que sean evidentemente lo mismo.

    Ejemplos de Consolidaciones:
    - "Universidad Nacional", "U. Nacional", "UNAL", "Universidad Nacional de Colombia" -> "Universidad Nacional de Colombia"
    - "Ministerio de Ambiente", "MinAmbiente", "Minambiente" -> "Ministerio de Ambiente y Desarrollo Sostenible"
    - "PNUD", "Program of UN", "Programa de las Naciones Unidas para el Desarrollo" -> "PNUD (Naciones Unidas)"
    - "Empresa X S.A.S", "Empresa X", "Empresa X Ltda" -> "Empresa X"

    Para ítems únicos que no tengan afinidad evidente con otros, mantenlos como su propio grupo consolidado representativo. No obligues a agrupar cosas que son totalmente diferentes.

    Lista de respuestas a agrupar:
    ${JSON.stringify(specs)}

    Devuelve un JSON con la estructura del ResponseSchema solicitado.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            clusters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { 
                    type: Type.STRING, 
                    description: "Nombre normalizado y limpio que represente al grupo consolidado." 
                  },
                  count: { 
                    type: Type.INTEGER, 
                    description: "Número total de respuestas de la lista original que cayeron en este grupo." 
                  },
                  items: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Lista de los textos originales exactos que se agruparon aquí."
                  }
                },
                required: ["name", "count", "items"]
              }
            }
          },
          required: ["clusters"]
        }
      }
    });

    if (response && response.text) {
      const parsed = JSON.parse(response.text.trim());
      // Ensure results are sorted by count desc
      if (parsed && Array.isArray(parsed.clusters)) {
        parsed.clusters.sort((a: any, b: any) => (b.count || 0) - (a.count || 0));
        res.json(parsed);
        return;
      }
    }
    
    throw new Error("Invalid or empty response from Gemini API");

  } catch (err: any) {
    console.error("Gemini specification clustering error:", err);
    res.json(getFallbackClusters());
  }
});

// Middleware Vite + SPA Fallback
async function startServer() {
  // Initialize Database (Firestore with data.json fallback)
  await dbInit();
  
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
