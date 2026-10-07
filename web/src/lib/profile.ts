import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { cleanFilters } from "./alerts";
import { query } from "./db";
import { getJob, iso, type Filters } from "./queries";

/**
 * A "For you" profile. No account: the browser holds a random token in a
 * cookie, and that's the only key to the profile. An email address can be
 * added later, only so the same profile can be opened on another device.
 */
export const COOKIE = "unlisted_profile";
// Chrome caps cookie lifetimes at 400 days; each visit renews it.
const COOKIE_MAX_AGE = 400 * 86_400;

const MAX_ROLES = 10;
const MAX_SKILLS = 40;
const MAX_HIDDEN = 500;
const MAX_SAVED = 200;
export const EMBEDDING_SIZE = 384;

/** The home page filters a profile keeps; the rest are searches, not preferences. */
const PREF_KEYS = ["remote", "country", "exp", "pay"] as const;

export type SavedJob = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  apply_url: string;
  saved_at: string;
};

export type Profile = {
  id: string;
  roles: string[];
  skills: string[];
  prefs: Filters;
  /** pgvector text, only ever handed back to Postgres. */
  embedding: string | null;
  hidden: string[];
  saved: SavedJob[];
  email: string | null;
};

type Row = Profile & { last_seen_at: Date };

const COLUMNS = `id::text, roles, skills, prefs, embedding::text, hidden::text[], saved, email, last_seen_at`;

function fromRow(row: Row): Profile {
  return {
    id: row.id,
    roles: row.roles,
    skills: row.skills,
    prefs: row.prefs,
    embedding: row.embedding,
    hidden: row.hidden,
    saved: row.saved,
    email: row.email,
  };
}

export async function profileByToken(token: string | undefined): Promise<Profile | null> {
  if (!token || token.length > 100) return null;
  const [row] = await query<Row>(`SELECT ${COLUMNS} FROM profiles WHERE token = $1`, [token]);
  if (!row) return null;
  // Unused profiles are deleted after a while (see cleanUpProfiles).
  if (Date.now() - row.last_seen_at.getTime() > 86_400_000) {
    await query(`UPDATE profiles SET last_seen_at = now() WHERE id = $1`, [row.id]);
  }
  return fromRow(row);
}

/** For the hourly notifications: doesn't count as a visit. */
export async function profileById(id: string): Promise<Profile | null> {
  const [row] = await query<Row>(`SELECT ${COLUMNS} FROM profiles WHERE id = $1`, [id]);
  return row ? fromRow(row) : null;
}

export async function currentProfile(): Promise<Profile | null> {
  return profileByToken((await cookies()).get(COOKIE)?.value);
}

/** Route handlers and server actions only: pages can't set cookies. */
export async function rememberProfile(token: string) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export type ProfileInput = {
  roles: string[];
  skills: string[];
  prefs: Filters;
  /** undefined: keep the one stored. null: remove it (CV removed). */
  embedding?: string | null;
};

function cleanList(raw: unknown, max: number, length: number): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const value = item.replace(/\s+/g, " ").trim().slice(0, length);
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    out.push(value);
    if (out.length === max) break;
  }
  return out;
}

/** A unit-length vector of the right size as pgvector text, or null if it isn't one. */
function cleanEmbedding(raw: unknown): string | null {
  if (!Array.isArray(raw) || raw.length !== EMBEDDING_SIZE) return null;
  if (!raw.every((v) => typeof v === "number" && Number.isFinite(v))) return null;
  const norm = Math.hypot(...(raw as number[]));
  if (norm === 0) return null;
  return `[${(raw as number[]).map((v) => (v / norm).toFixed(5)).join(",")}]`;
}

/** The profile to save, or what's wrong with it. */
export function cleanProfileInput(raw: Record<string, unknown>): ProfileInput | string {
  const roles = cleanList(raw.roles, MAX_ROLES, 80);
  const skills = cleanList(raw.skills, MAX_SKILLS, 40);
  if (roles.length === 0 && skills.length === 0) return "Add at least one role or skill.";
  const all = cleanFilters((raw.prefs ?? {}) as Record<string, unknown>);
  const prefs: Filters = {};
  for (const key of PREF_KEYS) if (all[key]) prefs[key] = all[key];
  const input: ProfileInput = { roles, skills, prefs };
  if (raw.embedding === null) input.embedding = null;
  else if (raw.embedding !== undefined) {
    const embedding = cleanEmbedding(raw.embedding);
    if (!embedding) return "Couldn't use that CV. Please upload it again.";
    input.embedding = embedding;
  }
  return input;
}

/** Update this device's profile, or create one and remember it. */
export async function saveProfile(input: ProfileInput): Promise<void> {
  const current = await currentProfile();
  const embedding = input.embedding === undefined ? current?.embedding ?? null : input.embedding;
  if (current) {
    await query(
      `UPDATE profiles SET roles = $2, skills = $3, prefs = $4::jsonb, embedding = $5::halfvec, updated_at = now()
        WHERE id = $1`,
      [current.id, input.roles, input.skills, JSON.stringify(input.prefs), embedding],
    );
    return;
  }
  const token = randomBytes(24).toString("base64url");
  await query(
    `INSERT INTO profiles (token, roles, skills, prefs, embedding) VALUES ($1, $2, $3, $4::jsonb, $5::halfvec)`,
    [token, input.roles, input.skills, JSON.stringify(input.prefs), embedding],
  );
  await rememberProfile(token);
}

export async function deleteProfile(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await query(`DELETE FROM profiles WHERE token = $1`, [token]);
  jar.delete(COOKIE);
}

export type JobAction = "hide" | "unhide" | "save" | "unsave";

/** "Not for me" and "Save" on one job. Newest last, oldest dropped past the cap. */
export async function actOnJob(profile: Profile, id: string, action: JobAction): Promise<boolean> {
  if (!/^\d{1,18}$/.test(id)) return false;
  switch (action) {
    case "hide":
      await query(
        `UPDATE profiles p SET hidden = (SELECT a[greatest(1, cardinality(a) - $3 + 1):]
                                            FROM (SELECT array_remove(p.hidden, $2::bigint) || $2::bigint AS a) x)
          WHERE id = $1`,
        [profile.id, id, MAX_HIDDEN],
      );
      return true;
    case "unhide":
      await query(`UPDATE profiles SET hidden = array_remove(hidden, $2::bigint) WHERE id = $1`, [profile.id, id]);
      return true;
    case "save": {
      if (profile.saved.some((s) => s.id === id)) return true;
      const job = await getJob(id);
      if (!job) return false;
      const saved: SavedJob = {
        id,
        title: job.title,
        company: job.company_name,
        location: job.location_raw,
        apply_url: job.apply_url,
        saved_at: iso(new Date())!,
      };
      await query(`UPDATE profiles SET saved = $2::jsonb WHERE id = $1`, [
        profile.id,
        JSON.stringify([saved, ...profile.saved].slice(0, MAX_SAVED)),
      ]);
      return true;
    }
    case "unsave":
      await query(`UPDATE profiles SET saved = $2::jsonb WHERE id = $1`, [
        profile.id,
        JSON.stringify(profile.saved.filter((s) => s.id !== id)),
      ]);
      return true;
  }
}

/** Run with the hourly alerts: profiles nobody has opened in six months, and old sign-in links. */
export async function cleanUpProfiles() {
  await query(`DELETE FROM profiles WHERE last_seen_at < now() - interval '180 days'`);
  await query(`DELETE FROM profile_logins WHERE created_at < now() - interval '1 day'`);
}
