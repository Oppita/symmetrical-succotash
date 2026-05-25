import { 
  dbInit as firebaseInit,
  isFirebaseConnected,
  getSurveys as getFirebaseSurveys,
  getSurveyById as getFirebaseSurveyById,
  saveSurvey as saveFirebaseSurvey,
  deleteSurvey as deleteFirebaseSurvey,
  getResponsesForSurvey as getFirebaseResponses,
  saveResponse as saveFirebaseResponse,
  getResponseCount as getFirebaseResponseCount
} from "./firebaseService";

import {
  supabaseInit,
  isSupabaseConnected,
  getSupabaseSurveys,
  getSupabaseSurveyById,
  saveSupabaseSurvey,
  deleteSupabaseSurvey,
  getSupabaseResponsesForSurvey,
  saveSupabaseResponse,
  getSupabaseResponseCount,
  triggerSupabaseSync,
  getSupabaseGlobalStats,
  getSupabaseInitError
} from "./supabaseService";

// Global unified database startup
export async function dbInit() {
  console.log("🛠️  Iniciando Capa Coordinadora de Datos...");
  
  // 1. Intenta inicializar Supabase
  const supabaseOk = await supabaseInit();
  
  // 2. Intenta inicializar Firebase como alternativa
  await firebaseInit();
  
  console.log(`📡 Estado de Persistencia: [Supabase: ${supabaseOk ? '🟢 CONECTADO' : '⚪ INACTIVO'}] | [Firebase: ${isFirebaseConnected() ? '🟢 CONECTADO' : '⚪ INACTIVO'}]`);
}

// Check provider status
export function getDbProviderName(): string {
  if (isSupabaseConnected()) {
    return "Supabase (PostgreSQL Cloud)";
  }
  if (isFirebaseConnected()) {
    return "Firebase Firestore";
  }
  return "Local Disk (data.json)";
}

export function getDbError(): string | null {
  return getSupabaseInitError();
}

export function isDbConnected(): boolean {
  return isSupabaseConnected() || isFirebaseConnected();
}

// Unified APIs
export async function getSurveys(): Promise<any[]> {
  if (isSupabaseConnected()) {
    return getSupabaseSurveys();
  }
  return getFirebaseSurveys();
}

export async function getSurveyById(id: string): Promise<any | null> {
  if (isSupabaseConnected()) {
    return getSupabaseSurveyById(id);
  }
  return getFirebaseSurveyById(id);
}

export async function saveSurvey(id: string, title: string, questions: any[]): Promise<any> {
  if (isSupabaseConnected()) {
    return saveSupabaseSurvey(id, title, questions);
  }
  return saveFirebaseSurvey(id, title, questions);
}

export async function deleteSurvey(id: string): Promise<boolean> {
  if (isSupabaseConnected()) {
    return deleteSupabaseSurvey(id);
  }
  return deleteFirebaseSurvey(id);
}

export async function getResponsesForSurvey(surveyId: string): Promise<any[]> {
  if (isSupabaseConnected()) {
    return getSupabaseResponsesForSurvey(surveyId);
  }
  return getFirebaseResponses(surveyId);
}

export async function saveResponse(surveyId: string, answers: any): Promise<boolean> {
  if (isSupabaseConnected()) {
    return saveSupabaseResponse(surveyId, answers);
  }
  return saveFirebaseResponse(surveyId, answers);
}

export async function getResponseCount(surveyId: string): Promise<number> {
  if (isSupabaseConnected()) {
    return getSupabaseResponseCount(surveyId);
  }
  return getFirebaseResponseCount(surveyId);
}

export async function syncDatabase(): Promise<string[]> {
  if (isSupabaseConnected()) {
    return triggerSupabaseSync();
  }
  return ["❌ Sólo disponible para sincronización con Supabase (PostgreSQL)."];
}

export async function getDatabaseStats(): Promise<{ surveys: number, responses: number }> {
  try {
    if (getDbProviderName().includes("Supabase") || getDbProviderName().includes("Local")) {
      return await getSupabaseGlobalStats();
    }
    const surveysCount = await getSurveys().then(s => s.length).catch(() => 0);
    return { surveys: surveysCount, responses: -1 }; 
  } catch (e) {
    return { surveys: 0, responses: 0 };
  }
}
