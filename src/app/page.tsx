"use client";

import { useEffect, useRef, useState } from "react";
import {
  createIdea,
  deleteIdea as deleteIdeaFromSupabase,
  getIdeas,
  isSupabaseConfigured,
  updateIdea,
  type CreateIdeaInput,
  type Idea as SupabaseIdea,
} from "@/lib/supabase";

type ScreenId = "homeScreen" | "ideasScreen" | "settingsScreen";

type Idea = {
  id: string;
  emoji: string;
  title: string;
  copy: string;
  tag: string;
  time: string;
  isFavorite: boolean;
  isPinned: boolean;
};

type PreparedIdea = {
  original: string;
  title: string;
  text: string;
  summary: string;
  category: string;
};

type OrganizedIdeaResult = {
  title: string;
  summary: string;
  category: string;
};

type StoredIdea = {
  id: string;
  title: string;
  originalText: string;
  correctedText: string;
  summary: string;
  category: string;
  month: string;
  createdAt: string;
  status: "Guardada";
  isFavorite: boolean;
  isPinned: boolean;
};

type MonthGroup = {
  month: string;
  ideas: Idea[];
};

type EditIdeaDraft = {
  id: string;
  title: string;
  summary: string;
};

const IDEAS_STORAGE_KEY = "ideapp_ideas";
const DELETED_IDEAS_STORAGE_KEY = "ideapp_deleted_idea_ids";

const screenMeta: Record<ScreenId, { title: string; subtitle: string; eyebrow: string }> = {
  homeScreen: {
    title: "👋 Hola Fran",
    subtitle: "No pierdas ninguna idea.",
    eyebrow: "3 ideas guardadas hoy",
  },
  ideasScreen: {
    title: "Tus ideas",
    subtitle: "Volvé a encontrarlas sin esfuerzo.",
    eyebrow: "Organizadas por hábito",
  },
  settingsScreen: {
    title: "Ajustes",
    subtitle: "Todo tranquilo y en orden.",
    eyebrow: "IdeApp lista para crecer",
  },
};

const initialJuneIdeas: Idea[] = [
  {
    id: "fake-june-app",
    emoji: "📱",
    title: "App para recordar ideas",
    copy: "Una herramienta que vuelve a mostrar ideas antiguas cuando pueden servir.",
    tag: "App",
    time: "Hace 4 min",
    isFavorite: false,
    isPinned: false,
  },
  {
    id: "fake-june-reel",
    emoji: "🎬",
    title: "Reel para diseñadores",
    copy: "Un video corto sobre cómo las buenas ideas se pierden cuando no se capturan a tiempo.",
    tag: "Contenido",
    time: "Hoy",
    isFavorite: false,
    isPinned: false,
  },
  {
    id: "fake-june-projects",
    emoji: "🧭",
    title: "Sistema para organizar proyectos",
    copy: "Un método simple para transformar ideas sueltas en próximos pasos concretos.",
    tag: "Diseño",
    time: "Ayer",
    isFavorite: false,
    isPinned: false,
  },
];

const mayIdeas: Idea[] = [
  {
    id: "fake-may-product",
    emoji: "🧩",
    title: "Producto digital para freelancers",
    copy: "Una plantilla para convertir servicios repetidos en productos digitales simples.",
    tag: "Negocio",
    time: "Mayo",
    isFavorite: false,
    isPinned: false,
  },
  {
    id: "fake-may-messages",
    emoji: "💬",
    title: "Automatización de mensajes",
    copy: "Un flujo amable para responder consultas frecuentes sin perder el tono humano.",
    tag: "Automatización",
    time: "Mayo",
    isFavorite: false,
    isPinned: false,
  },
];

const fakeMonthGroups: MonthGroup[] = [
  { month: "Junio 2026", ideas: initialJuneIdeas },
  { month: "Mayo 2026", ideas: mayIdeas },
];

const habitCards = [
  {
    icon: "🕘",
    title: "Recientes",
    copy: "Lo último que capturaste.",
    panelCopy: "Tus últimas ideas guardadas aparecen acá para que las retomes cuando todavía están frescas.",
  },
  {
    icon: "📆",
    title: "Esta semana",
    copy: "Ideas con ritmo reciente.",
    panelCopy: "Un repaso liviano para detectar ideas que todavía tienen energía esta semana.",
  },
  {
    icon: "🌿",
    title: "Este mes",
    copy: "Tu mapa de junio.",
    panelCopy: "Una mirada mensual para ver qué ideas se repiten, crecen o piden convertirse en proyecto.",
  },
  {
    icon: "⭐",
    title: "Favoritas",
    copy: "Las que querés cuidar.",
    panelCopy: "Ideas marcadas como especiales para volver sin tener que buscarlas.",
    countType: "favorite",
  },
  {
    icon: "📦",
    title: "Archivadas",
    copy: "Guardadas sin ruido.",
    panelCopy: "Ideas que descansan, pero siguen guardadas para cuando vuelvan a servir.",
  },
  {
    icon: "📌",
    title: "Fijadas",
    copy: "Siempre arriba de su mes.",
    panelCopy: "Ideas fijadas para mantenerlas visibles arriba de cada mes.",
    countType: "pinned",
  },
];

const settingsRows = [
  { icon: "user", title: "Perfil", copy: "Nombre, saludo y datos básicos." },
  { icon: "bell", title: "Notificaciones", copy: "Avisos suaves para volver a IdeApp." },
  { icon: "clock", title: "Recordatorios de ideas", copy: "Recuperar ideas cuando puedan servir." },
  { icon: "palette", title: "Apariencia", copy: "Color, estilo y sensación visual." },
  { icon: "export", title: "Exportar ideas", copy: "Llevar tus ideas a otro lugar." },
  { icon: "lock", title: "Privacidad", copy: "Control y tranquilidad sobre tus datos." },
  { icon: "question", title: "Ayuda", copy: "Preguntas, guía y soporte." },
  { icon: "logout", title: "Cerrar sesión", copy: "Solo visual por ahora.", danger: true },
];

function cleanText(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

function limitWords(text: string, maxWords: number) {
  return cleanText(text).split(" ").slice(0, maxWords).join(" ");
}

function correctedTextFromText(text: string) {
  const replacements: Array<[RegExp, string]> = [
    [/\bq\b/gi, "que"],
    [/\bxq\b/gi, "porque"],
    [/\bapp\b/gi, "aplicación"],
    [/\bfots\b/gi, "fotos"],
    [/\bgracios+s\b/gi, "graciosos"],
    [/\brecuerde\b/gi, "recuerde"],
  ];

  let corrected = cleanText(text);
  replacements.forEach(([pattern, replacement]) => {
    corrected = corrected.replace(pattern, replacement);
  });

  corrected = corrected.charAt(0).toUpperCase() + corrected.slice(1);
  return /[.!?]$/.test(corrected) ? corrected : `${corrected}.`;
}

function organizeIdeaLocally(text: string): OrganizedIdeaResult {
  const correctedText = correctedTextFromText(text);
  const lower = correctedText.toLowerCase();

  if (lower.includes("fotos") && lower.includes("perros")) {
    return {
      title: "Generador de Fotos Divertidas para Perros",
      summary: "Transforma fotos de perros en imágenes creativas y humorísticas.",
      category: "Random",
    };
  }

  if (lower.includes("recordar") || lower.includes("recuerde") || lower.includes("ideas")) {
    return {
      title: "Aplicación para Recordar Ideas",
      summary: "Captura ideas rápidamente, las organiza y permite recuperarlas cuando vuelvan a ser útiles.",
      category: "Random",
    };
  }

  if (lower.includes("reel") || lower.includes("contenido") || lower.includes("video")) {
    return {
      title: "Contenido Breve para Compartir",
      summary: "Convierte una idea central en contenido claro, atractivo y fácil de publicar.",
      category: "Random",
    };
  }

  const titleWords = correctedText
    .replace(/[.!?]/g, "")
    .split(" ")
    .filter((word) => !["una", "un", "para", "crear", "hacer"].includes(word.toLowerCase()));
  const title = limitWords(titleWords.join(" "), 6);

  return {
    title: title ? title.charAt(0).toUpperCase() + title.slice(1) : "Idea Organizada",
    summary: limitWords(correctedText, 20),
    category: "Random",
  };
}

function isOrganizedIdeaResult(value: unknown): value is OrganizedIdeaResult {
  if (!value || typeof value !== "object") return false;

  const result = value as Record<string, unknown>;
  return (
    typeof result.title === "string" &&
    result.title.trim() !== "" &&
    typeof result.summary === "string" &&
    result.summary.trim() !== "" &&
    typeof result.category === "string" &&
    result.category.trim() !== ""
  );
}

function currentMonthName() {
  const month = new Intl.DateTimeFormat("es", { month: "long", year: "numeric" }).format(new Date());
  return month.charAt(0).toUpperCase() + month.slice(1);
}

function toStoredIdea(idea: SupabaseIdea): StoredIdea {
  return {
    id: idea.id,
    title: idea.title,
    originalText: idea.original_text || "",
    correctedText: idea.corrected_text || "",
    summary: idea.summary || "",
    category: idea.category || "Random",
    month: idea.month || currentMonthName(),
    createdAt: idea.created_at,
    status: idea.status === "Guardada" ? "Guardada" : "Guardada",
    isFavorite: idea.is_favorite ?? false,
    isPinned: idea.is_pinned ?? false,
  };
}

function toSupabaseIdeaInput(idea: StoredIdea): CreateIdeaInput {
  return {
    user_id: null,
    title: idea.title,
    original_text: idea.originalText,
    corrected_text: idea.correctedText,
    summary: idea.summary,
    category: idea.category,
    month: idea.month,
    status: idea.status,
    is_favorite: idea.isFavorite,
    is_pinned: idea.isPinned,
    created_at: idea.createdAt,
  };
}

function currentMonthTag(month: string) {
  return month.split(" ")[0] || month;
}

function formatIdeaTime(createdAt: string) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return "Ahora";

  const today = new Date();
  const isToday = created.toDateString() === today.toDateString();
  return isToday ? "Ahora" : currentMonthTag(currentMonthName());
}

function daysSinceIdeaWasSaved(createdAt: string) {
  const createdTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdTime)) return null;

  const elapsedDays = Math.floor((Date.now() - createdTime) / (1000 * 60 * 60 * 24));
  return elapsedDays > 7 ? elapsedDays : null;
}

function findIdeaToRemember(ideas: StoredIdea[]) {
  return ideas
    .filter((idea) => !idea.isPinned && daysSinceIdeaWasSaved(idea.createdAt) !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
}

function normalizeSearchText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isStoredIdea(value: unknown): value is StoredIdea {
  if (!value || typeof value !== "object") return false;

  const idea = value as Record<string, unknown>;
  return (
    typeof idea.id === "string" &&
    typeof idea.title === "string" &&
    typeof idea.originalText === "string" &&
    typeof idea.correctedText === "string" &&
    typeof idea.summary === "string" &&
    typeof idea.month === "string" &&
    typeof idea.createdAt === "string" &&
    idea.status === "Guardada"
  );
}

function readStoredIdeas() {
  try {
    const rawIdeas = window.localStorage.getItem(IDEAS_STORAGE_KEY);
    if (!rawIdeas) return [];

    const parsedIdeas: unknown = JSON.parse(rawIdeas);
    if (!Array.isArray(parsedIdeas)) return [];

    return parsedIdeas.filter(isStoredIdea).map((idea) => ({
      ...idea,
      category: typeof idea.category === "string" && idea.category.trim() ? idea.category : "Random",
      isFavorite: idea.isFavorite ?? false,
      isPinned: idea.isPinned ?? false,
    }));
  } catch {
    return [];
  }
}

function writeStoredIdeas(ideas: StoredIdea[]) {
  try {
    window.localStorage.setItem(IDEAS_STORAGE_KEY, JSON.stringify(ideas));
  } catch {
    // The app should keep working even when storage is unavailable.
  }
}

function readDeletedIdeaIds() {
  try {
    const rawIds = window.localStorage.getItem(DELETED_IDEAS_STORAGE_KEY);
    const parsedIds: unknown = rawIds ? JSON.parse(rawIds) : [];
    return Array.isArray(parsedIds)
      ? parsedIds.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function rememberDeletedIdeaId(id: string) {
  try {
    const deletedIds = new Set(readDeletedIdeaIds());
    deletedIds.add(id);
    window.localStorage.setItem(DELETED_IDEAS_STORAGE_KEY, JSON.stringify(Array.from(deletedIds)));
  } catch {
    // Keep the UI responsive even when localStorage is unavailable.
  }
}

function toDisplayIdea(idea: StoredIdea): Idea {
  return {
    id: idea.id,
    emoji: "",
    title: idea.title,
    copy: idea.summary,
    tag: idea.category || "Random",
    time: formatIdeaTime(idea.createdAt),
    isFavorite: idea.isFavorite,
    isPinned: idea.isPinned,
  };
}

function groupStoredIdeasByMonth(ideas: StoredIdea[]): MonthGroup[] {
  const groups = new Map<string, Idea[]>();

  ideas.forEach((idea) => {
    const monthIdeas = groups.get(idea.month) || [];
    monthIdeas.push(toDisplayIdea(idea));
    groups.set(idea.month, monthIdeas);
  });

  return Array.from(groups.entries()).map(([month, monthIdeas]) => ({
    month,
    ideas: monthIdeas.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;

      const aIdea = ideas.find((idea) => idea.id === a.id);
      const bIdea = ideas.find((idea) => idea.id === b.id);
      return new Date(bIdea?.createdAt || 0).getTime() - new Date(aIdea?.createdAt || 0).getTime();
    }),
  }));
}

function createIdeaId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `idea-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function fakeIdeasAsStoredIdeas() {
  return fakeMonthGroups.flatMap((group, groupIndex) =>
    group.ideas.map((idea, ideaIndex) => ({
      id: idea.id,
      title: idea.title,
      originalText: idea.copy,
      correctedText: idea.copy,
      summary: idea.copy,
      category: idea.tag || "Random",
      month: group.month,
      createdAt: new Date(Date.UTC(2026, 5 - groupIndex, 10 - ideaIndex, 12)).toISOString(),
      status: "Guardada" as const,
      isFavorite: idea.isFavorite,
      isPinned: idea.isPinned,
    })),
  );
}

function FavoriteIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.6Z" />
    </svg>
  );
}

function PinIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="m8.1 4.2 7.7 7.7" />
      <path d="m14.7 3.7 5.6 5.6-3.2 1.1-4.7 4.7-1.1 4.3-2.2-2.2-4.5 4.5-1.3-1.3 4.5-4.5-2.2-2.2 4.3-1.1 4.7-4.7 1.1-3.2Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 7.2h15" />
      <path d="M9.2 7.2V4.8h5.6v2.4" />
      <path d="m6.8 7.2.8 12h8.8l.8-12" />
      <path d="M10 10.5v5.4M14 10.5v5.4" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="m14.2 5.1 4.7 4.7" />
      <path d="m16.6 2.7 4.7 4.7L9.1 19.6l-5.8 1.1 1.1-5.8L16.6 2.7Z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4.2 4.2" />
    </svg>
  );
}

function IdeaCard({
  idea,
  onToggleFavorite,
  onTogglePinned,
  onRequestEdit,
  onRequestDelete,
  isDeleting,
  isHighlighted,
  elementId,
}: {
  idea: Idea;
  onToggleFavorite: (idea: Idea) => void;
  onTogglePinned: (idea: Idea) => void;
  onRequestEdit: (idea: Idea) => void;
  onRequestDelete: (idea: Idea) => void;
  isDeleting: boolean;
  isHighlighted: boolean;
  elementId?: string;
}) {
  return (
    <article
      className={`idea-card ${isDeleting ? "removing" : ""} ${isHighlighted ? "highlighted" : ""}`}
      id={elementId}
    >
      <div className="idea-emoji" aria-hidden="true">{idea.emoji || <LightbulbIcon />}</div>
      <div className="idea-content">
        <div className="idea-topline">
          <h3 className="idea-title">{idea.title}</h3>
          <span className="idea-time">{idea.time}</span>
        </div>
        <p className="idea-copy">{idea.copy}</p>
        <div className="idea-meta">
          <span className="tag">{idea.tag}</span>
          <span className="saved">Guardada</span>
          <span className="idea-actions">
            <button
              className="idea-action"
              type="button"
              aria-label="Editar idea"
              onClick={() => onRequestEdit(idea)}
            >
              <EditIcon />
            </button>
            <button
              className={`idea-action ${idea.isFavorite ? "active" : ""}`}
              type="button"
              aria-label={idea.isFavorite ? "Quitar de favoritas" : "Marcar como favorita"}
              aria-pressed={idea.isFavorite}
              onClick={() => onToggleFavorite(idea)}
            >
              <FavoriteIcon active={idea.isFavorite} />
            </button>
            <button
              className={`idea-action ${idea.isPinned ? "active" : ""}`}
              type="button"
              aria-label={idea.isPinned ? "Desfijar idea" : "Fijar idea"}
              aria-pressed={idea.isPinned}
              onClick={() => onTogglePinned(idea)}
            >
              <PinIcon active={idea.isPinned} />
            </button>
            <button
              className="idea-action destructive"
              type="button"
              aria-label="Eliminar idea"
              onClick={() => onRequestDelete(idea)}
            >
              <TrashIcon />
            </button>
          </span>
        </div>
      </div>
    </article>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.8 10.7 12 4l8.2 6.7" />
      <path d="M6.2 9.8v8.1c0 .7.5 1.2 1.2 1.2h9.2c.7 0 1.2-.5 1.2-1.2V9.8" />
      <path d="M9.7 19.1v-5.2h4.6v5.2" />
    </svg>
  );
}

function LightbulbIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18.5h6" />
      <path d="M10 21h4" />
      <path d="M8.5 15.2c-1.7-1.2-2.8-3.1-2.8-5.3A6.3 6.3 0 0 1 12 3.6a6.3 6.3 0 0 1 6.3 6.3c0 2.2-1.1 4.1-2.8 5.3-.6.4-.9 1-.9 1.7v.1H9.4v-.1c0-.7-.3-1.3-.9-1.7Z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6Z" />
      <path d="M13.4 2.8h-2.8l-.4 2.1a7.4 7.4 0 0 0-1.6.7L6.8 4.4 4.4 6.8l1.2 1.8a7.4 7.4 0 0 0-.7 1.6l-2.1.4v2.8l2.1.4c.2.6.4 1.1.7 1.6l-1.2 1.8 2.4 2.4 1.8-1.2c.5.3 1 .5 1.6.7l.4 2.1h2.8l.4-2.1c.6-.2 1.1-.4 1.6-.7l1.8 1.2 2.4-2.4-1.2-1.8c.3-.5.5-1 .7-1.6l2.1-.4v-2.8l-2.1-.4a7.4 7.4 0 0 0-.7-1.6l1.2-1.8-2.4-2.4-1.8 1.2a7.4 7.4 0 0 0-1.6-.7l-.4-2.1Z" />
    </svg>
  );
}

function SettingIcon({ name }: { name: string }) {
  const commonProps = {
    viewBox: "0 0 24 24",
    width: "21",
    height: "21",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (name === "user") {
    return (
      <svg {...commonProps}>
        <path d="M12 12.2a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2Z" />
        <path d="M4.8 20.2c.8-3.2 3.5-5.2 7.2-5.2s6.4 2 7.2 5.2" />
      </svg>
    );
  }

  if (name === "bell") {
    return (
      <svg {...commonProps}>
        <path d="M6.5 10.4a5.5 5.5 0 0 1 11 0v3.2l1.7 2.7H4.8l1.7-2.7v-3.2Z" />
        <path d="M10 19a2.2 2.2 0 0 0 4 0" />
      </svg>
    );
  }

  if (name === "clock") {
    return (
      <svg {...commonProps}>
        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
        <path d="M12 7.5v5l3.2 2" />
      </svg>
    );
  }

  if (name === "palette") {
    return (
      <svg {...commonProps}>
        <path d="M12 3.5a8.5 8.5 0 0 0 0 17h1.1a1.9 1.9 0 0 0 1.4-3.2l-.2-.2a1.6 1.6 0 0 1 1.2-2.7H17a4.2 4.2 0 0 0 4.2-4.2C21.2 6.5 17.2 3.5 12 3.5Z" />
        <path d="M7.9 10h.1" />
        <path d="M10.5 7.3h.1" />
        <path d="M14.2 7.5h.1" />
        <path d="M16.7 10.2h.1" />
      </svg>
    );
  }

  if (name === "export") {
    return (
      <svg {...commonProps}>
        <path d="M12 15.2V4.2" />
        <path d="M7.8 8.4 12 4.2l4.2 4.2" />
        <path d="M5.2 12.8v5.1c0 .9.7 1.6 1.6 1.6h10.4c.9 0 1.6-.7 1.6-1.6v-5.1" />
      </svg>
    );
  }

  if (name === "lock") {
    return (
      <svg {...commonProps}>
        <path d="M7.2 10.4V8.1a4.8 4.8 0 0 1 9.6 0v2.3" />
        <path d="M6.2 10.4h11.6c.8 0 1.4.6 1.4 1.4v6.4c0 .8-.6 1.4-1.4 1.4H6.2c-.8 0-1.4-.6-1.4-1.4v-6.4c0-.8.6-1.4 1.4-1.4Z" />
      </svg>
    );
  }

  if (name === "question") {
    return (
      <svg {...commonProps}>
        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
        <path d="M9.7 9.1a2.5 2.5 0 0 1 4.8.8c0 1.8-2.1 2.2-2.1 3.8" />
        <path d="M12.4 16.8h.1" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M9.6 5.2H6.4c-.8 0-1.4.6-1.4 1.4v10.8c0 .8.6 1.4 1.4 1.4h3.2" />
      <path d="M14.2 15.8 18 12l-3.8-3.8" />
      <path d="M18 12H9.4" />
    </svg>
  );
}

function WelcomeScreen({ onEnter, isExiting }: { onEnter: () => void; isExiting: boolean }) {
  return (
    <section className={`welcome-screen ${isExiting ? "exiting" : ""}`} aria-label="Bienvenida a IdeApp">
      <div className="welcome-hero" aria-hidden="true">
        <img src="/images/welcome-hero.png" alt="" />
      </div>

      <div className="welcome-content">
        <h1>Nunca pierdas una buena idea.</h1>
        <p>Las mejores ideas aparecen cuando menos lo esperás. IdeApp las guarda antes de que se pierdan.</p>
        <div className="welcome-actions">
          <button className="welcome-primary" type="button" onClick={onEnter}>Empezar</button>
          <button className="welcome-secondary" type="button" onClick={onEnter}>Omitir</button>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>("homeScreen");
  const [storedIdeas, setStoredIdeas] = useState<StoredIdea[]>([]);
  const [total, setTotal] = useState(12);
  const [today, setToday] = useState(3);
  const [input, setInput] = useState("");
  const [preparedIdea, setPreparedIdea] = useState<PreparedIdea | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isFeedbackVisible, setIsFeedbackVisible] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [ideasPanel, setIdeasPanel] = useState<{ title: string; copy: string } | null>(null);
  const [hasCheckedWelcome, setHasCheckedWelcome] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isWelcomeExiting, setIsWelcomeExiting] = useState(false);
  const [ideaPendingDelete, setIdeaPendingDelete] = useState<Idea | null>(null);
  const [deletingIdeaId, setDeletingIdeaId] = useState<string | null>(null);
  const [highlightedIdeaId, setHighlightedIdeaId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editDraft, setEditDraft] = useState<EditIdeaDraft | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isMounted = true;

    try {
      setShowWelcome(localStorage.getItem("ideapp-welcome-seen") !== "true");
    } catch {
      setShowWelcome(true);
    }

    async function loadIdeas() {
      let loadedIdeas: StoredIdea[] = [];
      const deletedIdeaIds = new Set(readDeletedIdeaIds());
      const localIdeas = readStoredIdeas().filter((idea) => !deletedIdeaIds.has(idea.id));

      if (isSupabaseConfigured) {
        try {
          const supabaseIdeas = await getIdeas();
          const mergedIdeas = new Map(
            supabaseIdeas
              .map(toStoredIdea)
              .filter((idea) => !deletedIdeaIds.has(idea.id))
              .map((idea) => [idea.id, idea]),
          );

          localIdeas.forEach((idea) => {
            mergedIdeas.set(idea.id, {
              ...mergedIdeas.get(idea.id),
              ...idea,
            });
          });

          loadedIdeas = Array.from(mergedIdeas.values());
        } catch {
          loadedIdeas = localIdeas;
        }
      } else {
        loadedIdeas = localIdeas;
      }

      if (!isMounted) return;

      if (loadedIdeas.length > 0) {
        setStoredIdeas(loadedIdeas);
        setTotal(12 + loadedIdeas.length);
        setToday(3 + loadedIdeas.filter((idea) => new Date(idea.createdAt).toDateString() === new Date().toDateString()).length);
      }
    }

    void loadIdeas();

    setHasCheckedWelcome(true);

    return () => {
      isMounted = false;
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      if (processingTimer.current) clearTimeout(processingTimer.current);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, []);

  const meta = screenMeta[activeScreen];

  function showFeedback(message: string) {
    setFeedback(message);
    setIsFeedbackVisible(true);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setIsFeedbackVisible(false), 2400);
  }

  function resetPreview() {
    setPreparedIdea(null);
    setIsProcessing(false);
  }

  function shakeCapture(message: string) {
    setIsShaking(false);
    requestAnimationFrame(() => setIsShaking(true));
    showFeedback(message);
  }

  async function organizeIdea() {
    const value = cleanText(input);
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 130);

    if (!value) {
      shakeCapture("Escribí una idea primero.");
      return;
    }

    setPreparedIdea(null);
    setIsFeedbackVisible(false);
    setIsProcessing(true);
    if (processingTimer.current) clearTimeout(processingTimer.current);

    const minimumProcessingTime = new Promise<void>((resolve) => {
      processingTimer.current = setTimeout(resolve, 850);
    });

    try {
      const response = await fetch("/api/organize-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      });

      if (!response.ok) throw new Error(`Idea organization failed with status ${response.status}.`);

      const organizedIdea: unknown = await response.json();
      if (!isOrganizedIdeaResult(organizedIdea)) throw new Error("Idea organization returned invalid data.");

      await minimumProcessingTime;
      setPreparedIdea({
        original: value,
        text: organizedIdea.summary,
        ...organizedIdea,
      });
    } catch (error) {
      console.error("Gemini organization unavailable; using local fallback.", error);
      await minimumProcessingTime;
      const organizedIdea = organizeIdeaLocally(value);
      setPreparedIdea({
        original: value,
        text: correctedTextFromText(value),
        ...organizedIdea,
      });
    } finally {
      setIsProcessing(false);
    }
  }

  async function saveIdea() {
    if (!preparedIdea) {
      organizeIdea();
      return;
    }

    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 130);

    const newIdea: StoredIdea = {
      id: createIdeaId(),
      title: preparedIdea.title,
      originalText: preparedIdea.original,
      correctedText: preparedIdea.text,
      summary: preparedIdea.summary,
      category: preparedIdea.category,
      month: currentMonthName(),
      createdAt: new Date().toISOString(),
      status: "Guardada",
      isFavorite: false,
      isPinned: false,
    };

    let ideaToDisplay = newIdea;
    let shouldUseLocalStorage = !isSupabaseConfigured;

    if (isSupabaseConfigured) {
      try {
        const createdIdea = await createIdea(toSupabaseIdeaInput(newIdea));
        ideaToDisplay = toStoredIdea(createdIdea);
      } catch {
        shouldUseLocalStorage = true;
      }
    }

    setStoredIdeas((ideas) => {
      const nextIdeas = [ideaToDisplay, ...ideas];
      if (shouldUseLocalStorage) {
        writeStoredIdeas(nextIdeas);
      }
      return nextIdeas;
    });
    setInput("");
    setTotal((value) => value + 1);
    setToday((value) => value + 1);
    resetPreview();
    showFeedback("Listo. Esta idea ya no se pierde.");
  }

  async function toggleIdeaFlag(idea: Idea, flag: "isFavorite" | "isPinned") {
    const baseIdeas = storedIdeas.length > 0 ? storedIdeas : fakeIdeasAsStoredIdeas();
    const currentIdea = baseIdeas.find((storedIdea) => storedIdea.id === idea.id);
    if (!currentIdea) return;

    const nextValue = !currentIdea[flag];
    const nextIdeas = baseIdeas.map((storedIdea) =>
      storedIdea.id === idea.id
        ? { ...storedIdea, [flag]: nextValue }
        : storedIdea,
    );

    setStoredIdeas(nextIdeas);
    writeStoredIdeas(nextIdeas);

    const isFakeIdea = idea.id.startsWith("fake-");
    if (!isSupabaseConfigured || isFakeIdea) {
      return;
    }

    try {
      await updateIdea(
        idea.id,
        flag === "isFavorite"
          ? { is_favorite: nextValue }
          : { is_pinned: nextValue },
      );
    } catch {
      // The optimistic state is already persisted in localStorage.
    }
  }

  function toggleFavorite(idea: Idea) {
    void toggleIdeaFlag(idea, "isFavorite");
  }

  function togglePinned(idea: Idea) {
    void toggleIdeaFlag(idea, "isPinned");
  }

  function requestDeleteIdea(idea: Idea) {
    setIdeaPendingDelete(idea);
  }

  function requestEditIdea(idea: Idea) {
    const baseIdeas = storedIdeas.length > 0 ? storedIdeas : fakeIdeasAsStoredIdeas();
    const storedIdea = baseIdeas.find((item) => item.id === idea.id);
    if (!storedIdea) return;

    setEditDraft({
      id: storedIdea.id,
      title: storedIdea.title,
      summary: storedIdea.summary,
    });
  }

  function cancelEditIdea() {
    setEditDraft(null);
  }

  function saveEditedIdea() {
    if (!editDraft) return;

    const title = cleanText(editDraft.title);
    const summary = cleanText(editDraft.summary);
    if (!title || !summary) return;

    const baseIdeas = storedIdeas.length > 0 ? storedIdeas : fakeIdeasAsStoredIdeas();
    const nextIdeas = baseIdeas.map((idea) =>
      idea.id === editDraft.id ? { ...idea, title, summary } : idea,
    );

    setStoredIdeas(nextIdeas);
    writeStoredIdeas(nextIdeas);
    setEditDraft(null);

    if (!isSupabaseConfigured || editDraft.id.startsWith("fake-")) return;

    void updateIdea(editDraft.id, { title, summary }).catch((error) => {
      console.error("Failed to update idea in Supabase; local changes were preserved.", error);
    });
  }

  function cancelDeleteIdea() {
    setIdeaPendingDelete(null);
  }

  function confirmDeleteIdea() {
    if (!ideaPendingDelete) return;

    const idea = ideaPendingDelete;
    const baseIdeas = storedIdeas.length > 0 ? storedIdeas : fakeIdeasAsStoredIdeas();
    const storedIdea = baseIdeas.find((item) => item.id === idea.id);
    const nextIdeas = baseIdeas.filter((item) => item.id !== idea.id);

    setIdeaPendingDelete(null);
    setDeletingIdeaId(idea.id);

    window.setTimeout(() => {
      setStoredIdeas(nextIdeas);
      writeStoredIdeas(nextIdeas);
      setDeletingIdeaId(null);
      setTotal((value) => Math.max(0, value - 1));

      if (storedIdea && new Date(storedIdea.createdAt).toDateString() === new Date().toDateString()) {
        setToday((value) => Math.max(0, value - 1));
      }
    }, 220);

    const isFakeIdea = idea.id.startsWith("fake-");
    if (!isSupabaseConfigured || isFakeIdea) return;

    void deleteIdeaFromSupabase(idea.id).catch((error) => {
      console.error("Failed to delete idea from Supabase", error);
      rememberDeletedIdeaId(idea.id);
    });
  }

  function switchScreen(screenId: ScreenId) {
    setActiveScreen(screenId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reviewRememberedIdea(ideaId: string) {
    setHighlightedIdeaId(ideaId);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedIdeaId(null), 1800);

    requestAnimationFrame(() => {
      document.getElementById(`idea-${ideaId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function updateInput(value: string) {
    setInput(value);
    if (preparedIdea) resetPreview();
  }

  function enterApp() {
    setIsWelcomeExiting(true);
    window.setTimeout(() => {
      try {
        localStorage.setItem("ideapp-welcome-seen", "true");
      } catch {
        // Ignore storage failures so the app can still be used.
      }
      setShowWelcome(false);
      setIsWelcomeExiting(false);
    }, 320);
  }

  if (!hasCheckedWelcome) {
    return null;
  }

  if (showWelcome) {
    return <WelcomeScreen onEnter={enterApp} isExiting={isWelcomeExiting} />;
  }

  const monthGroups = storedIdeas.length > 0 ? groupStoredIdeasByMonth(storedIdeas) : fakeMonthGroups;
  const sourceIdeas = storedIdeas.length > 0 ? storedIdeas : fakeIdeasAsStoredIdeas();
  const rememberedIdea = findIdeaToRemember(sourceIdeas);
  const rememberedIdeaAge = rememberedIdea ? daysSinceIdeaWasSaved(rememberedIdea.createdAt) : null;
  const activeMonthLabel = `${currentMonthTag(monthGroups[0]?.month || currentMonthName())} activo`;
  const visibleIdeas = monthGroups.flatMap((group) => group.ideas);
  const favoriteCount = visibleIdeas.filter((idea) => idea.isFavorite).length;
  const pinnedCount = visibleIdeas.filter((idea) => idea.isPinned).length;
  const normalizedSearchQuery = normalizeSearchText(searchQuery);
  const searchResults = normalizedSearchQuery
    ? sourceIdeas.filter((idea) =>
        normalizeSearchText(
          [idea.title, idea.summary, idea.originalText, idea.correctedText, idea.category].join(" "),
        ).includes(normalizedSearchQuery),
      )
    : [];

  return (
    <>
      <main className="app-shell" aria-label="IdeApp">
        <header className="topbar">
          <div>
            <div className="eyebrow">{activeScreen === "homeScreen" ? `${today} ideas guardadas hoy` : meta.eyebrow}</div>
            <h1>{meta.title}</h1>
            <p className="subtitle">{meta.subtitle}</p>
          </div>
          <div className="avatar" aria-hidden="true">💡</div>
        </header>

        <section className="progress-row" aria-label="Progreso">
          <div className="stat-pill">
            <span className="stat-icon" aria-hidden="true">🔥</span>
            <span className="stat-text">3 días capturando ideas</span>
          </div>
          <div className="stat-pill">
            <span className="stat-icon" aria-hidden="true">💡</span>
            <span className="stat-text"><span>{total}</span> ideas guardadas</span>
          </div>
        </section>

        <section className={`screen ${activeScreen === "homeScreen" ? "active" : ""}`}>
          <section className={`capture-card ${isShaking ? "shake" : ""}`} onAnimationEnd={() => setIsShaking(false)}>
            <div className="capture-head">
              <h2>¿Qué idea apareció?</h2>
              <span className="ai-soon">✨ Próximamente: corrección automática con IA</span>
            </div>

            <div className="idea-input-wrap">
              <textarea
                value={input}
                onChange={(event) => updateInput(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    if (preparedIdea) saveIdea();
                    else organizeIdea();
                  }
                }}
                placeholder="Escribila aunque esté desordenada..."
                aria-label="Escribir idea"
              />
              <span className="spark" aria-hidden="true">✨</span>
            </div>

            {!preparedIdea && !isProcessing && (
              <button className={`primary-button ${isPressed ? "pressed" : ""}`} type="button" onClick={organizeIdea}>
                Organizar idea
              </button>
            )}

            <div className={`processing ${isProcessing ? "show" : ""}`} aria-live="polite">
              ✨ Organizando idea...
              <span className="dots" aria-hidden="true"><span /><span /><span /></span>
            </div>

            <div className={`preview-card ${preparedIdea ? "show" : ""}`} aria-live="polite">
              {preparedIdea && (
                <>
                  <div className="preview-item">
                    <div className="preview-label">💡 Título</div>
                    <p className="preview-value">{preparedIdea.title}</p>
                  </div>
                  <div className="preview-item">
                    <div className="preview-label">📝 Resumen</div>
                    <p className="preview-value">{preparedIdea.summary}</p>
                  </div>
                  <button className={`primary-button ${isPressed ? "pressed" : ""}`} type="button" onClick={saveIdea}>
                    Guardar idea
                  </button>
                  <button className="secondary-button" type="button" onClick={() => setPreparedIdea(null)}>
                    Editar texto
                  </button>
                </>
              )}
            </div>

            <div className={`feedback ${isFeedbackVisible ? "show" : ""}`} role="status" aria-live="polite">
              {feedback || "Listo. Esta idea ya no se pierde."}
            </div>
          </section>

          {rememberedIdea && rememberedIdeaAge !== null && (
            <section className="section memory-section" aria-labelledby="memoryTitle">
              <div className="section-head">
                <h2 className="section-title" id="memoryTitle">💡 Te puede servir hoy</h2>
              </div>
              <article className="memory-card">
                <div>
                  <h3>{rememberedIdea.title}</h3>
                  <p>{rememberedIdea.summary}</p>
                  <span>Guardada hace {rememberedIdeaAge} días</span>
                </div>
                <button type="button" onClick={() => reviewRememberedIdea(rememberedIdea.id)}>
                  Revisar idea
                </button>
              </article>
            </section>
          )}

          <section className="section" aria-labelledby="timelineTitle">
            <div className="section-head">
              <h2 className="section-title" id="timelineTitle">Ideas por mes</h2>
              <span className="count-badge">{activeMonthLabel}</span>
            </div>

            <div>
              {monthGroups.map((group) => (
                <section className="month-section" data-month={group.month} key={group.month}>
                  <h2 className="month-title">{group.month}</h2>
                  <div className="ideas-list">
                    {group.ideas.map((idea) => (
                      <IdeaCard
                        key={idea.id}
                        idea={idea}
                        onToggleFavorite={toggleFavorite}
                        onTogglePinned={togglePinned}
                        onRequestEdit={requestEditIdea}
                        onRequestDelete={requestDeleteIdea}
                        isDeleting={deletingIdeaId === idea.id}
                        isHighlighted={highlightedIdeaId === idea.id}
                        elementId={`idea-${idea.id}`}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>

          <section className="section">
            <div className="reminder-card">
              <div className="reminder-icon" aria-hidden="true">⏰</div>
              <p>Más adelante IdeApp podrá recordarte ideas antiguas para que no queden olvidadas.</p>
            </div>
          </section>
        </section>

        <section className={`screen ${activeScreen === "ideasScreen" ? "active" : ""}`}>
          <div className="ideas-search-wrap">
            <span aria-hidden="true"><SearchIcon /></span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar ideas"
              aria-label="Buscar ideas"
            />
          </div>

          {normalizedSearchQuery ? (
            <section className="search-results" aria-live="polite">
              <div className="section-head">
                <h2 className="section-title">Resultados</h2>
                <span className="section-note">{searchResults.length}</span>
              </div>
              {searchResults.length > 0 ? (
                <div className="ideas-list">
                  {searchResults.map((storedIdea) => {
                    const idea = toDisplayIdea(storedIdea);
                    return (
                      <IdeaCard
                        key={idea.id}
                        idea={idea}
                        onToggleFavorite={toggleFavorite}
                        onTogglePinned={togglePinned}
                        onRequestEdit={requestEditIdea}
                        onRequestDelete={requestDeleteIdea}
                        isDeleting={deletingIdeaId === idea.id}
                        isHighlighted={false}
                        elementId={`search-idea-${idea.id}`}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="search-empty">
                  <h3>No encontramos esa idea</h3>
                  <p>Probá con otra palabra o categoría.</p>
                </div>
              )}
            </section>
          ) : (
            <>
          <div className="section-head">
            <h2 className="section-title">Revisar por hábito</h2>
            <span className="section-note">Toque rápido</span>
          </div>

          <div className="habit-grid">
            {habitCards.map((card) => (
              <button
                className="habit-card"
                key={card.title}
                type="button"
                onClick={() => setIdeasPanel({ title: card.title, copy: card.panelCopy })}
              >
                <span className="habit-icon" aria-hidden="true">{card.icon}</span>
                <span>
                  <span className="habit-title">{card.title}</span>
                  <span className="habit-copy">
                    {card.countType === "favorite"
                      ? `${favoriteCount} ${favoriteCount === 1 ? "idea favorita" : "ideas favoritas"}.`
                      : card.countType === "pinned"
                        ? `${pinnedCount} ${pinnedCount === 1 ? "idea fijada" : "ideas fijadas"}.`
                        : card.copy}
                  </span>
                </span>
                <span className="chevron" aria-hidden="true">›</span>
              </button>
            ))}
          </div>

          <div className={`fake-panel ${ideasPanel ? "show" : ""}`}>
            <h3>{ideasPanel?.title || "Recientes"}</h3>
            <p>{ideasPanel?.copy || "Tus últimas ideas guardadas aparecen acá para que las retomes cuando todavía están frescas."}</p>
          </div>
            </>
          )}
        </section>

        <section className={`screen ${activeScreen === "settingsScreen" ? "active" : ""}`}>
          <div className="section-head">
            <h2 className="section-title">Preferencias</h2>
            <span className="section-note">Visual</span>
          </div>

          <div className="settings-list">
            {settingsRows.map((row) => (
              <button className={`setting-row ${row.danger ? "danger" : ""}`} key={row.title} type="button">
                <span className="setting-icon" aria-hidden="true"><SettingIcon name={row.icon} /></span>
                <span>
                  <span className="setting-title">{row.title}</span>
                  <span className="setting-copy">{row.copy}</span>
                </span>
                <span className="chevron" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        </section>
      </main>

      <nav className="bottom-nav" aria-label="Navegación principal">
        <button className={`tab ${activeScreen === "homeScreen" ? "active" : ""}`} type="button" onClick={() => switchScreen("homeScreen")}>
          <span className="tab-icon" aria-hidden="true"><HomeIcon /></span>
          <span>Inicio</span>
        </button>
        <button className={`tab ${activeScreen === "ideasScreen" ? "active" : ""}`} type="button" onClick={() => switchScreen("ideasScreen")}>
          <span className="tab-icon" aria-hidden="true"><LightbulbIcon /></span>
          <span>Ideas</span>
        </button>
        <button className={`tab ${activeScreen === "settingsScreen" ? "active" : ""}`} type="button" onClick={() => switchScreen("settingsScreen")}>
          <span className="tab-icon" aria-hidden="true"><GearIcon /></span>
          <span>Ajustes</span>
        </button>
      </nav>

      {ideaPendingDelete && (
        <div className="delete-dialog-backdrop" role="presentation" onClick={cancelDeleteIdea}>
          <section
            className="delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-description"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="delete-dialog-title">¿Eliminar esta idea?</h2>
            <p id="delete-dialog-description">Esta acción no se puede deshacer.</p>
            <div className="delete-dialog-actions">
              <button type="button" className="delete-cancel" onClick={cancelDeleteIdea}>Cancelar</button>
              <button type="button" className="delete-confirm" onClick={confirmDeleteIdea}>Eliminar</button>
            </div>
          </section>
        </div>
      )}

      {editDraft && (
        <div className="delete-dialog-backdrop" role="presentation" onClick={cancelEditIdea}>
          <section
            className="edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="edit-dialog-title">Editar idea</h2>
            <label>
              <span>Título</span>
              <input
                type="text"
                value={editDraft.title}
                onChange={(event) => setEditDraft({ ...editDraft, title: event.target.value })}
                maxLength={120}
              />
            </label>
            <label>
              <span>Resumen</span>
              <textarea
                value={editDraft.summary}
                onChange={(event) => setEditDraft({ ...editDraft, summary: event.target.value })}
                maxLength={400}
              />
            </label>
            <div className="edit-dialog-actions">
              <button type="button" className="edit-cancel" onClick={cancelEditIdea}>Cancelar</button>
              <button
                type="button"
                className="edit-save"
                disabled={!cleanText(editDraft.title) || !cleanText(editDraft.summary)}
                onClick={saveEditedIdea}
              >
                Guardar cambios
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
