import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import {
  dbInit,
  isFirebaseConnected,
  getSurveys,
  getSurveyById,
  saveSurvey,
  deleteSurvey,
  getResponsesForSurvey,
  saveResponse,
  getResponseCount
} from "./server/firebaseService";

const ai = process.env.GEMINI_API_KEY 
    ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    : null;

const app = express();
app.use(express.json());

// API STATUS
app.get("/api/db-status", (req, res) => {
  res.json({
    connected: isFirebaseConnected(),
    projectId: process.env.FIREBASE_PROJECT_ID || null,
    provider: isFirebaseConnected() ? "Firebase Firestore" : "Local Disk Fallback (data.json)"
  });
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

// AI COGNITIVE AGENT ANALYSIS
app.post("/api/analyze", async (req, res) => {
  if (!ai) {
    res.status(500).json({ error: "Falta GEMINI_API_KEY en las variables de entorno." });
    return;
  }
  try {
     const { surveyId, data } = req.body;
     const survey = await getSurveyById(surveyId);
     
     const prompt = `
     Analiza los siguientes resultados de una encuesta. 
     Cuestionario Base: ${JSON.stringify(survey)}. 
     Resultados Consolidados: ${JSON.stringify(data)}. 
     Instrucción: Escribe un breve párrafo resumiendo el patrón principal encontrado de manera profesional y clara.
     `;
     
     const response = await ai.models.generateContent({ 
        model: "gemini-2.5-flash", 
        contents: prompt 
     });
     
     res.json({ analysis: response.text });
  } catch (err: any) {
     res.status(500).json({ error: err.message });
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
