import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc,
  query,
  where,
  Firestore 
} from "firebase/firestore";
import fs from "fs/promises";
import path from "path";

let db: Firestore | null = null;
let isFirebaseEnabled = false;

// Fallback high-performance local database structures
const DATA_FILE = path.join(process.cwd(), "data.json");
const defaultDemoSurvey = {
  id: "demo",
  title: "Encuesta de Evaluación",
  questions: [
    { 
      id: "q1", 
      text: "Calificación de la experiencia", 
      type: "scale", 
      min: 1, 
      max: 5,
      minLabel: "Deficiente",
      maxLabel: "Excelente"
    },
    { id: "q2", text: "Aspecto más valorado", type: "choice", options: ["Atención", "Calidad", "Rapidez", "Precio"] }
  ]
};

const defaultPlataformaSurvey = {
  id: "plataforma2026",
  title: "Evaluación Plataforma Nacional 2026",
  questions: [
    {
      id: "q1",
      section: "SECCIÓN 1 – PARTICIPACIÓN",
      text: "¿Cuál fue su tipo de participación en el evento?",
      type: "choice",
      options: [
        "Asistente",
        "Ponente",
        "Entidad pública",
        "Academia",
        "Organización social/comunitaria",
        "Cooperación internacional",
        "Sector privado",
        "Otro"
      ]
    },
    {
      id: "q2",
      text: "¿En qué espacios participó principalmente? (Puede seleccionar varios)",
      type: "checkbox",
      options: [
        "Plenarias",
        "Sesiones paralelas",
        "Laboratorios",
        "Espacios de alto nivel",
        "Stands",
        "Galería de posters",
        "Espacios de networking/interacción",
        "Otro"
      ]
    },
    {
      id: "q3",
      section: "SECCIÓN 2 – EXPERIENCIA GENERAL",
      text: "¿Cómo calificaría su experiencia general en la Plataforma Nacional 2026?",
      type: "scale",
      min: 1,
      max: 5,
      minLabel: "Muy mala",
      maxLabel: "Muy buena"
    },
    {
      id: "q4",
      text: "¿En qué medida el evento cumplió sus expectativas?",
      type: "choice",
      options: [
        "Superó mis expectativas",
        "Cumplió totalmente",
        "Cumplió parcialmente",
        "No cumplió"
      ]
    },
    {
      id: "q5",
      text: "¿Qué tan probable es que recomiende este evento a otras personas o entidades?",
      type: "scale",
      min: 0,
      max: 10,
      minLabel: "Muy improbable",
      maxLabel: "Muy probable"
    },
    {
      id: "q6",
      section: "SECCIÓN 3 – CONTENIDO Y PERTINENCIA",
      text: "¿Cómo evalúa la calidad y pertinencia de los contenidos abordados?",
      type: "scale",
      min: 1,
      max: 5,
      minLabel: "Muy mala",
      maxLabel: "Muy buena"
    },
    {
      id: "q7",
      text: "¿Qué tan útiles fueron las experiencias, metodologías y conocimientos compartidos para su trabajo o territorio?",
      type: "scale",
      min: 1,
      max: 5,
      minLabel: "Nada útiles",
      maxLabel: "Muy útiles"
    },
    {
      id: "q8",
      text: "¿Considera que la agenda abordó temas relevantes y actuales para la gestión del riesgo de desastres?",
      type: "choice",
      options: [
        "Totalmente",
        "En gran medida",
        "Parcialmente",
        "Muy poco",
        "Nada"
      ]
    },
    {
      id: "q9_1",
      section: "SECCIÓN 4 – ORGANIZACIÓN Y LOGÍSTICA",
      text: "Evaluación logística: Proceso de acreditación e ingreso",
      type: "scale",
      min: 1,
      max: 5,
      minLabel: "Muy mala",
      maxLabel: "Muy buena"
    },
    {
      id: "q9_2",
      text: "Evaluación logística: Organización general",
      type: "scale",
      min: 1,
      max: 5,
      minLabel: "Muy mala",
      maxLabel: "Muy buena"
    },
    {
      id: "q9_3",
      text: "Evaluación logística: Puntualidad de las sesiones",
      type: "scale",
      min: 1,
      max: 5,
      minLabel: "Muy mala",
      maxLabel: "Muy buena"
    },
    {
      id: "q9_4",
      text: "Evaluación logística: Calidad de los espacios y salas",
      type: "scale",
      min: 1,
      max: 5,
      minLabel: "Muy mala",
      maxLabel: "Muy buena"
    },
    {
      id: "q9_5",
      text: "Evaluación logística: Señalización y orientación",
      type: "scale",
      min: 1,
      max: 5,
      minLabel: "Muy mala",
      maxLabel: "Muy buena"
    },
    {
      id: "q9_6",
      text: "Evaluación logística: Atención del equipo organizador",
      type: "scale",
      min: 1,
      max: 5,
      minLabel: "Muy mala",
      maxLabel: "Muy buena"
    },
    {
      id: "q9_7",
      text: "Evaluación logística: Recursos audiovisuales y técnicos",
      type: "scale",
      min: 1,
      max: 5,
      minLabel: "Muy mala",
      maxLabel: "Muy buena"
    },
    {
      id: "q10",
      section: "SECCIÓN 5 – IMPACTO Y VALOR GENERADO",
      text: "¿Cuál fue el espacio o actividad más valiosa para usted y por qué?",
      type: "text",
      placeholder: "Escribe tu respuesta..."
    },
    {
      id: "q11",
      text: "¿Qué aprendizaje, herramienta o experiencia considera que podrá aplicar posteriormente en su organización, comunidad o territorio?",
      type: "text",
      placeholder: "Escribe tu respuesta..."
    },
    {
      id: "q12",
      section: "SECCIÓN 6 – OPORTUNIDADES DE MEJORA",
      text: "¿Qué aspecto considera que debería mejorarse para futuras versiones de la Plataforma Nacional?",
      type: "text",
      placeholder: "Escribe tu respuesta..."
    },
    {
      id: "q13",
      text: "¿Qué temas o enfoques le gustaría que se fortalecieran en próximas ediciones?",
      type: "text",
      placeholder: "Escribe tu respuesta..."
    },
    {
      id: "q14",
      section: "CIERRE",
      text: "Comentarios finales",
      type: "text",
      optional: true,
      placeholder: "Comentarios opcionales..."
    }
  ]
};

let localSurveys: Record<string, any> = {
  "demo": defaultDemoSurvey,
  "plataforma2026": defaultPlataformaSurvey
};

let localResponses: any[] = [
  {
    id: "r1",
    surveyId: "plataforma2026",
    answers: {
      q1: "Asistente",
      q2: ["Plenarias", "Laboratorios"],
      q3: 5,
      q4: "Superó mis expectativas",
      q5: 9,
      q6: 5,
      q7: 4,
      q8: "Totalmente",
      q10: "Los laboratorios prácticos por la interacción",
      q11: "La metodología de diagnóstico territorial"
    },
    timestamp: new Date().toISOString()
  },
  {
    id: "r2",
    surveyId: "plataforma2026",
    answers: {
      q1: "Entidad pública",
      q2: ["Plenarias", "Espacios de alto nivel"],
      q3: 4,
      q4: "Cumplió totalmente",
      q5: 8,
      q6: 4,
      q7: 5,
      q8: "En gran medida",
      q10: "Los espacios de alto nivel para articulación interinstitucional",
      q11: "Herramientas de mapeo de riesgos de desastres"
    },
    timestamp: new Date().toISOString()
  }
];

// Helper to load fallback disk data
async function loadLocalDiskData() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed.surveys) {
      localSurveys = parsed.surveys;
    }
    // Force reset standard template surveys to ensure scale 1-5 and label updates are applied instantly
    localSurveys["demo"] = defaultDemoSurvey;
    localSurveys["plataforma2026"] = defaultPlataformaSurvey;
    
    if (parsed.responses) localResponses = parsed.responses;
    console.log("💾 Carga de datos locales desde data.json completada, plantillas estándar actualizadas.");
    await saveLocalDiskData();
  } catch (err) {
    // Si no existe, creamos el archivo inicial para que persista
    await saveLocalDiskData();
  }
}

// Helper to save fallback disk data
async function saveLocalDiskData() {
  try {
    await fs.writeFile(
      DATA_FILE, 
      JSON.stringify({ surveys: localSurveys, responses: localResponses }, null, 2), 
      "utf-8"
    );
  } catch (err) {
    console.error("❌ Error guardando datos locales en data.json:", err);
  }
}

// Firestore operations error handler
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null // Server-side environment
    },
    operationType,
    path
  };
  console.error('🔥 Error de Firestore Detectado:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Global initialization
export async function dbInit() {
  await loadLocalDiskData();

  const apiKey = process.env.FIREBASE_API_KEY;
  const authDomain = process.env.FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = process.env.FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.FIREBASE_APP_ID;

  if (projectId && apiKey) {
    try {
      const config = {
        apiKey,
        authDomain,
        projectId,
        storageBucket,
        messagingSenderId,
        appId
      };
      const app = getApps().length === 0 ? initializeApp(config) : getApp();
      db = getFirestore(app);
      isFirebaseEnabled = true;
      console.log("🔥 ¡Conexión con Firebase Firestore establecida con éxito!");
      
      // Auto-update standard surveys to Firestore to ensure boundaries and labels are current
      for (const surveyId of Object.keys(localSurveys)) {
        const docRef = doc(db, "surveys", surveyId);
        await setDoc(docRef, localSurveys[surveyId]);
      }
      console.log("⚡ Encuestas estándar sincronizadas con Firebase Firestore.");
    } catch (err) {
      console.error("⚠️ Falló la conexión inicial a Firebase. Utilizando fallback local:", err);
      isFirebaseEnabled = false;
    }
  } else {
    console.warn("⚠️ Variables de Firebase ausentes en el entorno. Funcionando en Modo de Persistencia Local (data.json).");
  }
}

export function isFirebaseConnected(): boolean {
  return isFirebaseEnabled && db !== null;
}

// Unified Database Coordinator Layer
export async function getSurveys(): Promise<any[]> {
  if (isFirebaseConnected() && db) {
    try {
      const colRef = collection(db, "surveys");
      const snapshot = await getDocs(colRef);
      const surveysList: any[] = [];
      snapshot.forEach(doc => {
        surveysList.push(doc.data());
      });
      return surveysList;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, "surveys");
    }
  }
  return Object.values(localSurveys);
}

export async function getSurveyById(id: string): Promise<any | null> {
  if (isFirebaseConnected() && db) {
    try {
      const docRef = doc(db, "surveys", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data();
      }
      return null;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `surveys/${id}`);
    }
  }
  return localSurveys[id] || null;
}

export async function saveSurvey(id: string, title: string, questions: any[]): Promise<any> {
  const surveyData = { id, title, questions };
  if (isFirebaseConnected() && db) {
    try {
      const docRef = doc(db, "surveys", id);
      await setDoc(docRef, surveyData);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `surveys/${id}`);
    }
  }
  localSurveys[id] = surveyData;
  await saveLocalDiskData();
  return surveyData;
}

export async function deleteSurvey(id: string): Promise<boolean> {
  let found = false;
  if (isFirebaseConnected() && db) {
    try {
      const docRef = doc(db, "surveys", id);
      await deleteDoc(docRef);
      
      // Delete associated responses from Firestore as well
      const resColRef = collection(db, "responses");
      const q = query(resColRef, where("surveyId", "==", id));
      const querySnapshot = await getDocs(q);
      for (const responseDoc of querySnapshot.docs) {
        await deleteDoc(doc(db, "responses", responseDoc.id));
      }
      found = true;
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `surveys/${id}`);
    }
  }
  
  if (localSurveys[id]) {
    delete localSurveys[id];
    localResponses = localResponses.filter(r => r.surveyId !== id);
    await saveLocalDiskData();
    found = true;
  }
  return found;
}

export async function getResponsesForSurvey(surveyId: string): Promise<any[]> {
  if (isFirebaseConnected() && db) {
    try {
      const colRef = collection(db, "responses");
      const q = query(colRef, where("surveyId", "==", surveyId));
      const snapshot = await getDocs(q);
      const list: any[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data());
      });
      return list;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, `responses?surveyId=${surveyId}`);
    }
  }
  return localResponses.filter(r => r.surveyId === surveyId);
}

export async function saveResponse(surveyId: string, answers: any): Promise<boolean> {
  const responseId = `r_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const responseData = {
    id: responseId,
    surveyId,
    answers,
    timestamp: new Date().toISOString()
  };

  if (isFirebaseConnected() && db) {
    try {
      const docRef = doc(db, "responses", responseId);
      await setDoc(docRef, responseData);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `responses/${responseId}`);
    }
  }
  localResponses.push(responseData);
  await saveLocalDiskData();
  return true;
}

export async function getResponseCount(surveyId: string): Promise<number> {
  if (isFirebaseConnected() && db) {
    try {
      const list = await getResponsesForSurvey(surveyId);
      return list.length;
    } catch (err) {
      return 0;
    }
  }
  return localResponses.filter(r => r.surveyId === surveyId).length;
}
