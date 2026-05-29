import express from "express";
import path from "path";
import dotenv from "dotenv";
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

dotenv.config();

const app = express();

app.use(express.json());

const getAI = () => {
  if (process.env.GEMINI_API_KEY) {
    return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return null;
};

// =========================
// DB STATUS
// =========================
app.get("/api/db-status", async (_, res) => {
  try {
    const stats = await getDatabaseStats();

    res.json({
      connected: isDbConnected(),
      provider: getDbProviderName(),
      stats,
      errorLog: getDbError()
    });

  } catch (error: any) {

    res.status(500).json({
      error: error.message
    });

  }
});

// =========================
// DB RETRY
// =========================
app.post("/api/db-retry", async (_, res) => {
  try {

    await dbInit();

    const stats = await getDatabaseStats();

    res.json({
      connected: isDbConnected(),
      provider: getDbProviderName(),
      stats,
      errorLog: getDbError()
    });

  } catch (error: any) {

    res.status(500).json({
      error: error.message
    });

  }
});

// =========================
// DB SYNC
// =========================
app.post("/api/db-sync", async (_, res) => {
  try {

    const logs = await syncDatabase();

    res.json({ logs });

  } catch (error: any) {

    res.status(500).json({
      error: error.message
    });

  }
});

// =========================
// GET SURVEYS
// =========================
app.get("/api/surveys", async (_, res) => {
  try {

    const surveys = await getSurveys();

    const result = await Promise.all(
      surveys.map(async (s: any) => ({
        id: s.id,
        title: s.title,
        responseCount: await getResponseCount(s.id)
      }))
    );

    res.json(result);

  } catch (error: any) {

    res.status(500).json({
      error: error.message
    });

  }
});

// =========================
// CREATE SURVEY
// =========================
app.post("/api/surveys", async (req, res) => {
  try {

    const id = Date.now().toString(36);

    const survey = await saveSurvey(
      id,
      req.body.title,
      req.body.questions
    );

    res.json(survey);

  } catch (error: any) {

    res.status(500).json({
      error: error.message
    });

  }
});

// =========================
// GET SURVEY
// =========================
app.get("/api/survey/:id", async (req, res) => {
  try {

    const survey = await getSurveyById(req.params.id);

    if (!survey) {
      return res.status(404).json({
        error: "Survey not found"
      });
    }

    res.json(survey);

  } catch (error: any) {

    res.status(500).json({
      error: error.message
    });

  }
});

// =========================
// UPDATE SURVEY
// =========================
app.put("/api/survey/:id", async (req, res) => {
  try {

    const survey = await saveSurvey(
      req.params.id,
      req.body.title,
      req.body.questions
    );

    res.json(survey);

  } catch (error: any) {

    res.status(500).json({
      error: error.message
    });

  }
});

// =========================
// DELETE SURVEY
// =========================
app.delete("/api/survey/:id", async (req, res) => {
  try {

    const deleted = await deleteSurvey(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        error: "Survey not found"
      });
    }

    res.json({
      success: true
    });

  } catch (error: any) {

    res.status(500).json({
      error: error.message
    });

  }
});

// =========================
// IMPORT RESPONSES
// =========================
app.post("/api/survey/:id/import-responses", async (req, res) => {
  try {

    const { responses } = req.body;

    if (!Array.isArray(responses)) {
      return res.status(400).json({
        error: "Invalid responses array"
      });
    }

    for (const r of responses) {
      await saveResponse(req.params.id, r);
    }

    res.json({
      success: true,
      count: responses.length
    });

  } catch (error: any) {

    res.status(500).json({
      error: error.message
    });

  }
});

// =========================
// SAVE RESPONSE
// =========================
app.post("/api/survey/:id/response", async (req, res) => {
  try {

    await saveResponse(req.params.id, req.body);

    res.json({
      success: true
    });

  } catch (error: any) {

    res.status(500).json({
      error: error.message
    });

  }
});

// =========================
// GET RESULTS
// =========================
app.get("/api/survey/:id/results", async (req, res) => {
  try {

    const results = await getResponsesForSurvey(req.params.id);

    res.json(results);

  } catch (error: any) {

    res.status(500).json({
      error: error.message
    });

  }
});

// =========================
// DELETE RESPONSE
// =========================
app.delete("/api/responses/:id", async (req, res) => {
  try {

    const deleted = await deleteResponse(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        error: "Response not found"
      });
    }

    res.json({
      success: true
    });

  } catch (error: any) {

    res.status(500).json({
      error: error.message
    });

  }
});

// =========================
// AI ANALYSIS
// =========================
app.post("/api/analyze", async (req, res) => {
  try {

    console.log("BODY:", req.body);

    const {
      surveyId,
      data,
      apiProvider = "gemini",
      model = ""
    } = req.body;

    if (!surveyId) {
      return res.status(400).json({
        error: "surveyId missing"
      });
    }

    const survey = await getSurveyById(surveyId);

    if (!survey) {
      return res.status(404).json({
        error: "Survey not found"
      });
    }

    const prompt = `
Analiza estos resultados de encuesta.

ENCUESTA:
${JSON.stringify(survey)}

RESULTADOS:
${JSON.stringify(data)}

Genera:
1. Resumen ejecutivo
2. Tendencias
3. Hallazgos clave
4. Conclusiones
5. Recomendaciones

Usa Markdown profesional.
`;

    let analysis = "";

    // =========================
    // GEMINI
    // =========================
    if (apiProvider === "gemini") {

      if (!process.env.GEMINI_API_KEY) {
        throw new Error("Missing GEMINI_API_KEY");
      }

      const ai = getAI();
      if (!ai) {
        throw new Error("Gemini client not initialized");
      }

      const response = await ai.models.generateContent({
        model: model || "gemini-2.5-flash",
        contents: prompt
      });

      analysis = response.text || "";

    }

    // =========================
    // GROQ
    // =========================
    else if (apiProvider === "groq") {

      const groqKey = process.env.GROQ_API_KEY;

      if (!groqKey) {
        throw new Error("Missing GROQ_API_KEY");
      }

      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: model || "llama3-70b-8192",
            messages: [
              {
                role: "user",
                content: prompt
              }
            ]
          })
        }
      );

      const data = await response.json();

      analysis = data?.choices?.[0]?.message?.content || "";

    }

    // =========================
    // OPENROUTER
    // =========================
    else if (apiProvider === "openrouter") {

      const orKey = process.env.OPENROUTER_API_KEY;

      if (!orKey) {
        throw new Error("Missing OPENROUTER_API_KEY");
      }

      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${orKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: model || "anthropic/claude-3.5-sonnet",
            messages: [
              {
                role: "user",
                content: prompt
              }
            ]
          })
        }
      );

      const data = await response.json();

      analysis = data?.choices?.[0]?.message?.content || "";

    }

    res.json({
      success: true,
      analysis
    });

  } catch (error: any) {

    console.error("ANALYZE ERROR:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });

  }
});

// =========================
// SEMANTIC CLUSTER
// =========================
app.post("/api/semantically-cluster-specs", async (req, res) => {
  try {

    const { specs } = req.body;

    if (!Array.isArray(specs)) {
      return res.json({
        clusters: []
      });
    }

    const ai = getAI();
    if (!ai) {
      return res.json({
        clusters: []
      });
    }

    const prompt = `
Agrupa semánticamente estas respuestas:

${JSON.stringify(specs)}

Devuelve JSON.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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
                    type: Type.STRING
                  },
                  count: {
                    type: Type.INTEGER
                  },
                  items: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.STRING
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");

    res.json(parsed);

  } catch (error: any) {

    console.error("CLUSTER ERROR:", error);

    res.status(500).json({
      error: error.message
    });

  }
});

// =========================
// START SERVER
// =========================
async function startServer() {

  await dbInit();

  if (process.env.NODE_ENV !== "production") {

    const vite = await createViteServer({
      server: {
        middlewareMode: true
      },
      appType: "spa"
    });

    app.use(vite.middlewares);

  } else {

    const distPath = path.join(process.cwd(), "dist");

    app.use(express.static(distPath));

    app.get("*", (_, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });

  }

  app.listen(3000, "0.0.0.0", () => {
    console.log(`Server running on port 3000`);
  });
}

startServer();
