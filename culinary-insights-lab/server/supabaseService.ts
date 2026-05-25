import { createClient, SupabaseClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import path from "path";

let supabase: SupabaseClient | null = null;
let isSupabaseEnabled = false;

// Fallback persistence config
const DATA_FILE = path.join(process.cwd(), "data.json");
let localSurveys: Record<string, any> = {};
let localResponses: any[] = [];

async function loadFallbackData() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed.surveys) localSurveys = parsed.surveys;
    if (parsed.responses) localResponses = parsed.responses;
  } catch (err) {
    // Ephemeral empty fallback
  }
}

async function saveFallbackData() {
  try {
    await fs.writeFile(
      DATA_FILE,
      JSON.stringify({ surveys: localSurveys, responses: localResponses }, null, 2),
      "utf-8"
    );
  } catch (err) {
    console.error("❌ Error guardando fallback local:", err);
  }
}

export async function supabaseInit(): Promise<boolean> {
  await loadFallbackData();

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (url && key) {
    try {
      supabase = createClient(url, key, {
        auth: {
          persistSession: false
        }
      });
      isSupabaseEnabled = true;

      // Realizar una consulta de prueba ultra rápida para verificar conexión y existencia de tablas
      const { error } = await supabase.from("surveys").select("id").limit(1);
      
      if (error) {
        if (error.code === "PGRST116" || error.message.includes("does not exist") || error.message.includes("relation")) {
          console.warn("\n🚨 [SUPABASE] Conectado exitosamente pero las tablas 'surveys' o 'responses' NO existen en tu base de datos postgres.");
          console.warn("👉 Por favor ejecuta el siguiente script SQL en el editor de SQL de Supabase:\n");
          console.warn(`
------------------------------------------------------------------
CREATE TABLE surveys (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  questions JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE responses (
  id TEXT PRIMARY KEY,
  survey_id TEXT REFERENCES surveys(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Deshabilitar RLS para permitir accesos directos desde el backend
ALTER TABLE surveys DISABLE ROW LEVEL SECURITY;
ALTER TABLE responses DISABLE ROW LEVEL SECURITY;
------------------------------------------------------------------
          \n`);
          console.warn("⚠️ Utilizando 'Local Fallback' de manera provisional hasta que crees las tablas.");
          isSupabaseEnabled = false;
        } else {
          throw error;
        }
      } else {
        console.log("⚡ ¡Conexión con Supabase establecida con éxito y tablas validadas!");
        // We will trigger a sync on start
        await triggerSupabaseSync();
      }
    } catch (err: any) {
      console.error("⚠️ Falló la conexión inicial a Supabase. Error:", err.message || err);
      isSupabaseEnabled = false;
    }
  } else {
    console.log("ℹ️ No se detectaron credenciales completas de Supabase (SUPABASE_URL / SUPABASE_KEY).");
  }

  return isSupabaseEnabled;
}

export async function triggerSupabaseSync(): Promise<string[]> {
  const logs: string[] = [];
  if (!isSupabaseEnabled || !supabase) {
    logs.push("❌ Supabase no está configurado o conectado.");
    return logs;
  }

  logs.push("⏳ Iniciando sincronización de datos locales hacia Supabase...");
  
  // Reload fallback data to ensure we have the latest
  await loadFallbackData();

  let surveysCount = 0;
  for (const survey of Object.values(localSurveys)) {
    const { error } = await supabase.from("surveys").upsert({
      id: survey.id,
      title: survey.title,
      questions: survey.questions
    });
    if (error) {
      logs.push(`⚠️ Error subiendo encuesta ${survey.id}: ${error.message}`);
    } else {
      surveysCount++;
    }
  }
  logs.push(`✅ ${surveysCount} encuestas sincronizadas.`);

  let responsesCount = 0;
  for (const resp of localResponses) {
    const { error: syncErr } = await supabase.from("responses").upsert({
      id: resp.id,
      survey_id: resp.surveyId,
      answers: resp.answers ? (resp.answers.answers ? resp.answers : { answers: resp.answers, _respondentName: resp._respondentName, _respondentEmail: resp._respondentEmail, _authorizedConsent: resp._authorizedConsent }) : resp,
      timestamp: resp.timestamp || new Date().toISOString()
    }, { onConflict: "id" });
    
    if (syncErr) {
      logs.push(`⚠️ Error subiendo respuesta ${resp.id}: ${syncErr.message}`);
    } else {
      responsesCount++;
    }
  }
  logs.push(`✅ ${responsesCount} respuestas sincronizadas.`);
  logs.push("🏁 Sincronización finalizada.");
  
  return logs;
}

export function isSupabaseConnected(): boolean {
  return isSupabaseEnabled && supabase !== null;
}

export async function getSupabaseSurveys(): Promise<any[]> {
  if (isSupabaseConnected() && supabase) {
    const { data, error } = await supabase.from("surveys").select("*");
    if (!error && data) {
      return data;
    }
    console.error("❌ Error getSupabaseSurveys:", error);
  }
  return Object.values(localSurveys);
}

export async function getSupabaseSurveyById(id: string): Promise<any | null> {
  if (isSupabaseConnected() && supabase) {
    const { data, error } = await supabase.from("surveys").select("*").eq("id", id).maybeSingle();
    if (!error && data) {
      return data;
    }
    if (error) console.error(`❌ Error getSupabaseSurveyById (${id}):`, error);
  }
  return localSurveys[id] || null;
}

export async function saveSupabaseSurvey(id: string, title: string, questions: any[]): Promise<any> {
  const surveyData = { id, title, questions };
  if (isSupabaseConnected() && supabase) {
    const { error } = await supabase.from("surveys").upsert(surveyData);
    if (error) {
      console.error(`❌ Error saveSupabaseSurvey (${id}):`, error);
    } else {
      // También guardamos localmente como caché de respaldo
      localSurveys[id] = surveyData;
      await saveFallbackData();
      return surveyData;
    }
  }
  localSurveys[id] = surveyData;
  await saveFallbackData();
  return surveyData;
}

export async function deleteSupabaseSurvey(id: string): Promise<boolean> {
  let found = false;
  if (isSupabaseConnected() && supabase) {
    const { error } = await supabase.from("surveys").delete().eq("id", id);
    if (!error) {
      found = true;
    } else {
      console.error(`❌ Error deleteSupabaseSurvey (${id}):`, error);
    }
  }
  
  if (localSurveys[id]) {
    delete localSurveys[id];
    localResponses = localResponses.filter(r => r.surveyId !== id);
    await saveFallbackData();
    found = true;
  }
  return found;
}

export async function getSupabaseResponsesForSurvey(surveyId: string): Promise<any[]> {
  if (isSupabaseConnected() && supabase) {
    const { data, error } = await supabase.from("responses").select("*").eq("survey_id", surveyId);
    if (!error && data) {
      // Mapear "survey_id" de DB de vuelta a camelCase "surveyId" para consistencia con el front
      return data.map(r => {
        // En caso de que se haya guardado con nesting o plano
        const hasNested = r.answers && r.answers.answers !== undefined;
        const payload = hasNested ? r.answers : { answers: r.answers };
        return {
          id: r.id,
          surveyId: r.survey_id,
          ...payload,
          timestamp: r.timestamp
        };
      });
    }
    console.error(`❌ Error getSupabaseResponsesForSurvey (${surveyId}):`, error);
  }
  return localResponses.filter(r => r.surveyId === surveyId);
}

export async function saveSupabaseResponse(surveyId: string, answers: any): Promise<boolean> {
  const responseId = `r_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const responseData = {
    id: responseId,
    surveyId,
    answers,
    timestamp: new Date().toISOString()
  };

  if (isSupabaseConnected() && supabase) {
    // Mapeamos a snake_case para la DB de postgres
    const { error } = await supabase.from("responses").insert({
      id: responseId,
      survey_id: surveyId,
      answers,
      timestamp: responseData.timestamp
    });
    if (error) {
      console.error("❌ Error saveSupabaseResponse:", error);
    } else {
      localResponses.push(responseData);
      await saveFallbackData();
      return true;
    }
  }

  localResponses.push(responseData);
  await saveFallbackData();
  return true;
}

export async function getSupabaseResponseCount(surveyId: string): Promise<number> {
  if (isSupabaseConnected() && supabase) {
    const { count, error } = await supabase
      .from("responses")
      .select("*", { count: "exact", head: true })
      .eq("survey_id", surveyId);
    if (!error && count !== null) {
      return count;
    }
    console.error(`❌ Error getSupabaseResponseCount (${surveyId}):`, error);
  }
  return localResponses.filter(r => r.surveyId === surveyId).length;
}
