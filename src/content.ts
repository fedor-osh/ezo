// Everything a human reads on the site. Keep it short: the yard does the talking.
import type { SectionId } from "./shared/protocol.ts";

export const PERSON = {
  name: "Fedor Oshepkov",
  role: "Fullstack engineer",
  /** One line. */
  tagline: "I build calm, accessible interfaces in TypeScript and the Node services behind them.",
  location: "Tbilisi, Georgia · remote, overlaps with PT/ET/CET",
  email: "oshepkov.fedor@gmail.com",
  github: "https://github.com/fedor-osh",
  githubHandle: "fedor-osh",
};

export interface Project {
  name: string;
  what: string;
  stack: string[];
  url?: string;
}

export const PROJECTS: Project[] = [
  {
    name: "Ezo — this yard",
    what: "Multiplayer 3D portfolio: cloth buttons, physics leaves, visitors who leave traces.",
    stack: ["TypeScript", "Three.js", "Rapier", "Nanostores", "Node WebSockets"],
    url: "https://github.com/fedor-osh/ezo",
  },
  {
    name: "vanilla-sky-watch",
    what: "Cron-driven Vercel function that watches mountain-flight tickets and pings Telegram.",
    stack: ["TypeScript", "Vercel Functions", "Vitest"],
    url: "https://github.com/fedor-osh/vanilla-sky-watch",
  },
  {
    name: "deepsearch-ai-chat",
    what: "LLM research chat that crawls, cites and is graded by evals.",
    stack: ["Next.js", "AI SDK", "Postgres", "Redis", "Vitest evals"],
    url: "https://github.com/fedor-osh/deepsearch-ai-chat",
  },
  {
    name: "account-charts",
    what: "Turns raw bank statements into readable personal-finance charts, all in the browser.",
    stack: ["React", "TypeScript", "Radix UI"],
    url: "https://github.com/fedor-osh/account-charts",
  },
  {
    name: "code-weaver",
    what: "VS Code extension that renders a repo's structure as a typed object, with a React webview.",
    stack: ["VS Code API", "React", "Vite"],
    url: "https://github.com/fedor-osh/code-weaver",
  },
];

export const STACK: Array<{ group: string; items: string[] }> = [
  { group: "Frontend", items: ["TypeScript", "React", "CSS & modern browser APIs", "Three.js / WebGL", "Accessibility"] },
  { group: "Backend", items: ["Node.js", "WebSockets", "Postgres", "Redis", "Serverless"] },
  { group: "Tooling", items: ["Vite", "Vitest", "PostCSS", "Browserslist", "Nanostores", "CI"] },
];

export const ABOUT = [
  "I take a vague idea to a shipped product: clarify the scope, pick the stack, write the update before anyone asks.",
  "I care about the details users feel — focus states, motion that respects settings, pages that work without a mouse.",
];

export const SECTION_TITLES: Record<SectionId, string> = {
  home: "Hello",
  work: "Work",
  about: "About",
  stack: "Stack",
  contact: "Contact",
};
