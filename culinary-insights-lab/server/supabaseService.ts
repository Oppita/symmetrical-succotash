import { createClient, SupabaseClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import path from "path";
import { defaultDemoSurvey, defaultPlataformaSurvey } from "./firebaseService";

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
    
    // Inject default templates mapped in case they were lost
    localSurveys["demo"] = defaultDemoSurvey;
    localSurveys["plataforma2026"] = defaultPlataformaSurvey;
  } catch (err) {
    // Ephemeral empty fallback
    localSurveys["demo"] = defaultDemoSurvey;
    localSurveys["plataforma2026"] = defaultPlataformaSurvey;
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

let supabaseInitError: string | null = null;

export async function supabaseInit(): Promise<boolean> {
  await loadFallbackData();
  supabaseInitError = null;

  let url = process.env.SUPABASE_URL || "";
  let key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";

  url = url.trim();
  key = key.trim();
  
  // Fix URL if user just pasted domain or added extra paths
  if (url && !url.startsWith("http")) {
    url = "https://" + url;
  }
  if (url && url.endsWith("/")) {
    url = url.slice(0, -1);
  }
  if (url && url.endsWith("/rest/v1")) {
    url = url.replace("/rest/v1", "");
  }

  if (url && key) {
    try {
      supabase = createClient(url, key, {
        auth: {
          persistSession: false
        }
      });
      isSupabaseEnabled = true;

      // Realizar una consulta de prueba ultra rápida para verificar conexión y existencia de tablas
      const { error, data } = await supabase.from("surveys").select("id").limit(1);
      
      // Intentar una escritura inocua o revisar si RLS está fallando en el triggerSync
      if (error) {
        supabaseInitError = error.message;
        if (error.code === "PGRST116" || error.message.includes("does not exist") || error.message.includes("relation")) {
          supabaseInitError = "Conexión exitosa pero FALTAN LAS TABLAS. Ejecuta el SQL provisto en Diagnóstico BD.";
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
        const syncLogs = await triggerSupabaseSync();
        const rlsFailing = syncLogs.find(l => l.includes("row violates row-level security"));
        if (rlsFailing) {
           supabaseInitError = "BLOQUEADO POR RLS: Tu base de datos tiene la seguridad RLS activa y rechaza sincronizar encuestas. Ve a Supabase SQL y ejecuta: ALTER TABLE surveys DISABLE ROW LEVEL SECURITY; ALTER TABLE responses DISABLE ROW LEVEL SECURITY;";
        }
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
    // Restaurar los datos originales para no malformar el objeto, simplemente usar su `answers`
    // Si accidentalmente tiene la estructura anidada de respuestas previas se aplana
    let cleanAnswers = resp.answers;
    if (cleanAnswers?.answers) {
      cleanAnswers = cleanAnswers.answers; // Si tiene anidación lo aplanamos
    }
  
    const { error: syncErr } = await supabase.from("responses").upsert({
      id: resp.id,
      survey_id: resp.surveyId,
      answers: cleanAnswers,
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

export async function getSupabaseGlobalStats(): Promise<{ surveys: number, responses: number }> {
  let surveys = 0;
  let responses = 0;
  
  if (isSupabaseConnected() && supabase) {
    try {
      const { count: sCount } = await supabase.from("surveys").select("*", { count: "exact", head: true });
      if (sCount !== null) surveys = sCount;
      const { count: rCount } = await supabase.from("responses").select("*", { count: "exact", head: true });
      if (rCount !== null) responses = rCount;
    } catch (e) {
      console.error("Error getting count", e);
    }
  } else {
    surveys = Object.keys(localSurveys).length;
    responses = localResponses.length;
  }
  return { surveys, responses };
}

export function getSupabaseInitError(): string | null {
  return supabaseInitError;
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
        let cleanAnswers = r.answers;
        if (cleanAnswers?.answers) {
          cleanAnswers = cleanAnswers.answers; // Fix para cualquier dato que haya quedado erróneamente anidado
        }
        return {
          id: r.id,
          surveyId: r.survey_id,
          answers: cleanAnswers,
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
