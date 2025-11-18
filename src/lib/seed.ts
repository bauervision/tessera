// src/lib/tessera/seed.ts
import type { Job, Project } from "./types";

export const jobsSeed: Job[] = [
  {
    id: "job-ibm",
    name: "IBM",
    label: "R&D: Spatial Audio + Terrain",
    order: 1,
    status: "active",
  },
  {
    id: "job-knexus",
    name: "Knexus.Ai",
    label: "DLA / Logistics Suite",
    order: 2,
    status: "active",
  },
  {
    id: "job-constellis",
    name: "Constellis",
    label: "New role",
    order: 3,
    status: "active",
  },
  {
    id: "job-bauervision",
    name: "BauerVision",
    label: "Personal products",
    order: 99,
    status: "active",
  },
];

export const projectsSeed: Project[] = [
  // Job 1 — R&D
  {
    id: "sonus",
    jobId: "job-ibm",
    name: "Sonus",
    code: "Sonus",
    status: "active",
    priority: "cool", // 🟢 simmering R&D
  },
  {
    id: "eidomap",
    jobId: "job-ibm",
    name: "EidoMap",
    code: "EidoMap",
    status: "active",
    priority: "cool", // 🟢
  },

  // Job 2 — Knexus.Ai
  {
    id: "gailforce",
    jobId: "job-knexus",
    name: "Gailforce",
    code: "Gailforce",
    status: "active",
    priority: "hot", // 🔥
  },
  {
    id: "clara",
    jobId: "job-knexus",
    name: "Clara (Kustos)",
    code: "Clara",
    status: "active",
    priority: "warm", // 🟡
  },
  {
    id: "jv",
    jobId: "job-knexus",
    name: "Journal Voucher",
    code: "JV",
    status: "active",
    priority: "warm", // 🟡
  },
  {
    id: "knexplan",
    jobId: "job-knexus",
    name: "KnexPlan",
    code: "KnexPlan",
    status: "active",
    priority: "hot", // 🔥
  },

  // Job 3 — Constellis
  {
    id: "constellis-onboarding",
    jobId: "job-constellis",
    name: "Onboarding & Playbook",
    code: "Onboarding",
    status: "active",
    priority: "hot", // 🔥 new job energy
  },

  // Job 4 — BauerVision
  {
    id: "tessera",
    jobId: "job-bauervision",
    name: "Tessera",
    code: "Tessera",
    status: "active",
    priority: "hot", // 🔥 this is your current meta-focus
  },
  {
    id: "mentrogress",
    jobId: "job-bauervision",
    name: "Mentrogress",
    code: "Mentrogress",
    status: "active",
    priority: "warm", // 🟡
  },
  {
    id: "forevian",
    jobId: "job-bauervision",
    name: "Forevian",
    code: "Forevian",
    status: "active",
    priority: "cool", // 🟢
  },
];
