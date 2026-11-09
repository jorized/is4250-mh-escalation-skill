import nus from "../../../skill/references/routing/nus.json";
import ntu from "../../../skill/references/routing/ntu.json";
import smu from "../../../skill/references/routing/smu.json";
import suss from "../../../skill/references/routing/suss.json";
import sutd from "../../../skill/references/routing/sutd.json";
import sit from "../../../skill/references/routing/sit.json";
import national from "../../../skill/references/routing/national.json";

export interface RouteEntry {
  id: string;
  unit: string;
  level: number;
  institution?: string;
  faculty?: string | null;
  phone: string | null;
  email: string | null;
  booking_url: string | null;
  hours: string | null;
  access: string | null;
  situations: string[];
  verified: boolean;
  notes?: string | null;
}

interface RoutingFile {
  institution: string;
  entries: RouteEntry[];
}

export const ROUTING_FILES: Record<string, RoutingFile> = {
  "nus.json": nus as RoutingFile,
  "ntu.json": ntu as RoutingFile,
  "smu.json": smu as RoutingFile,
  "suss.json": suss as RoutingFile,
  "sutd.json": sutd as RoutingFile,
  "sit.json": sit as RoutingFile,
  "national.json": national as RoutingFile,
};

const BY_ID = new Map<string, RouteEntry>();
for (const file of Object.values(ROUTING_FILES)) {
  for (const e of file.entries) BY_ID.set(e.id, e);
}

/** Only ids present in the routing table survive. The model cannot invent contacts. */
export function resolveRoutes(ids: string[]): RouteEntry[] {
  const seen = new Set<string>();
  const out: RouteEntry[] = [];
  for (const id of ids) {
    const e = BY_ID.get(id);
    if (e && !seen.has(id)) {
      seen.add(id);
      out.push(e);
    }
  }
  return out;
}

export const HOTLINE_IDS = ["sg-sos", "sg-mindline"];
export const EMERGENCY_IDS = ["sg-995"];

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function mailtoHref(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
