"use client";

import { CaretDown, FileText, X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";

import { countryName } from "@/components/Tags";
import { ROLES, SKILLS, expBucket, findRoles, findSkills, findYears, skillFor } from "@/lib/catalog";
import { CV_TYPES, embedCv, readCv } from "@/lib/cv";

import { CARD, FIELD, LABEL, PRIMARY, SECONDARY } from "./ui";

export type ProfileDraft = {
  roles: string[];
  skills: string[];
  prefs: Record<string, string>;
  hasCv: boolean;
};

const field = `${FIELD} h-10`;

/** A list of short values typed one at a time: Enter or comma adds, × removes. */
function Chips({
  label,
  hint,
  values,
  onChange,
  suggestions,
  canonical,
  placeholder,
  max,
}: {
  label: string;
  hint: string;
  values: string[];
  onChange: (values: string[]) => void;
  suggestions: string[];
  /** The catalog's spelling of a typed value ("postgres" -> "PostgreSQL"). */
  canonical: (value: string) => string;
  placeholder: string;
  max: number;
}) {
  const [text, setText] = useState("");
  const listId = useId();
  const add = (raw: string) => {
    const value = canonical(raw.replace(/,$/, "").trim());
    setText("");
    if (!value || values.length >= max || values.some((v) => v.toLowerCase() === value.toLowerCase())) return;
    onChange([...values, value]);
  };
  return (
    <fieldset className="min-w-0">
      <legend className={LABEL}>{label}</legend>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
      {values.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <li key={v}>
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="inline-flex items-center gap-1 rounded-md bg-accent-soft py-1 pl-2 pr-1.5 text-sm font-medium text-accent-ink ring-1 ring-inset ring-accent/20 transition-colors hover:bg-red-bg hover:text-red-ink hover:ring-red-ink/20"
                aria-label={`Remove ${v}`}
              >
                {v}
<X aria-hidden size={12} weight="bold" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        type="text"
        value={text}
        list={listId}
        placeholder={values.length >= max ? `That's the most (${max})` : placeholder}
        disabled={values.length >= max}
        autoComplete="off"
        aria-label={`Add ${label.toLowerCase()}`}
        onChange={(e) => {
          const v = e.target.value;
          // Picking a suggestion (not typing one: "Java" is on the way to
          // "JavaScript"), or typing a comma, adds it straight away.
          const typed = (e.nativeEvent as InputEvent).inputType?.startsWith("insert") &&
            (e.nativeEvent as InputEvent).inputType !== "insertReplacementText";
          if (v.endsWith(",") || (!typed && suggestions.includes(v))) add(v);
          else setText(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(text);
          } else if (e.key === "Backspace" && !text && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={() => add(text)}
        className={`${field} mt-2.5`}
      />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </fieldset>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className={LABEL}>{label}</span>
      {/* The home page's select: no native arrow, the same chevron. */}
      <span className="relative mt-1.5 block">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${field} cursor-pointer appearance-none truncate pr-8`}
        >
          {children}
        </select>
        <CaretDown
          aria-hidden
          size={14}
          weight="bold"
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
        />
      </span>
    </label>
  );
}

type CvState =
  | { step: "idle" }
  | { step: "reading" | "embedding"; name: string }
  | { step: "done"; name: string; found: string }
  | { step: "error"; message: string };

/**
 * Set up or change a "For you" profile. A CV is optional: it fills in the
 * roles, skills and experience (all still editable), and turns on ranking by
 * how close each posting reads to it. The file itself stays in the browser.
 */
export default function ProfileEditor({
  initial,
  countries,
  onCancel,
}: {
  initial: ProfileDraft | null;
  countries: { country: string; n: string }[];
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [roles, setRoles] = useState(initial?.roles ?? []);
  const [skills, setSkills] = useState(initial?.skills ?? []);
  const [prefs, setPrefs] = useState<Record<string, string>>(initial?.prefs ?? {});
  // undefined: keep what's saved. null: remove it.
  const [embedding, setEmbedding] = useState<number[] | null | undefined>(undefined);
  const [cv, setCv] = useState<CvState>({ step: "idle" });
  const [saving, setSaving] = useState(false);
  // The refreshed feed: the editor stays open (Saving…) until it's in, so the
  // new profile and its matches appear together.
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const hasCv = embedding ? true : embedding === null ? false : (initial?.hasCv ?? false);
  const busy = cv.step === "reading" || cv.step === "embedding";
  const changeRoles = (v: string[]) => {
    setRoles(v);
    setError(null);
  };
  const changeSkills = (v: string[]) => {
    setSkills(v);
    setError(null);
  };
  const pref = (key: string) => prefs[key] ?? "";
  const setPref = (key: string, value: string) =>
    setPrefs((p) => {
      const next = { ...p };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });

  async function onFile(file: File) {
    setError(null);
    setCv({ step: "reading", name: file.name });
    try {
      const text = await readCv(file);
      const foundRoles = findRoles(text);
      const foundSkills = findSkills(text);
      const years = findYears(text);
      const merge = (have: string[], found: string[], max: number) =>
        [...have, ...found.filter((f) => !have.some((h) => h.toLowerCase() === f.toLowerCase()))].slice(0, max);
      setRoles((r) => merge(r, foundRoles, 10));
      setSkills((s) => merge(s, foundSkills, 40));
      const bucket = expBucket(years);
      if (bucket) setPrefs((p) => (p.exp ? p : { ...p, exp: bucket }));

      setCv({ step: "embedding", name: file.name });
      setEmbedding(await embedCv(text));
      const found = [
        foundRoles.length && `${foundRoles.length} ${foundRoles.length === 1 ? "role" : "roles"}`,
        foundSkills.length && `${foundSkills.length} ${foundSkills.length === 1 ? "skill" : "skills"}`,
        years !== null && `about ${years} ${years === 1 ? "year" : "years"} of experience`,
      ].filter(Boolean);
      setCv({ step: "done", name: file.name, found: found.length ? `Found ${found.join(", ")}.` : "" });
    } catch (e) {
      console.error(e);
      setCv({
        step: "error",
        message: e instanceof Error && !/fetch|network/i.test(e.message)
          ? e.message
          : "Couldn't read that CV. Check your connection and try again.",
      });
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function save() {
    setError(null);
    if (roles.length === 0 && skills.length === 0) {
      setError("Add at least one role or skill, or upload a CV.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roles, skills, prefs, ...(embedding !== undefined && { embedding }) }),
      });
      const body = (await res.json()) as { ok: boolean; message?: string };
      if (!body.ok) throw new Error(body.message);
      startRefresh(() => {
        router.refresh();
        onCancel?.();
      });
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`${CARD} p-5 sm:p-8`}>
      {/* The CV */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file && !busy) onFile(file);
        }}
        className="rounded-2xl border border-dashed border-line-strong bg-canvas p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3.5">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-accent-ink">
              <FileText size={20} />
            </span>
            <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-strong">
              {hasCv ? "Matching against your CV" : "Start from your CV"}
              <span className="font-normal text-muted"> (optional)</span>
            </p>
            <p className="mt-0.5 max-w-md text-pretty text-xs text-muted">
              PDF, Word or text. It&apos;s read on this device and never uploaded: only the skills you keep
              and a numeric summary are saved.
            </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {hasCv && !busy && (
              <button
                type="button"
                onClick={() => {
                  setEmbedding(null);
                  setCv({ step: "idle" });
                }}
                className="text-xs text-muted underline decoration-line underline-offset-4 hover:text-ink-strong"
              >
                Stop using CV
              </button>
            )}
            <label
              className={`${SECONDARY} cursor-pointer focus-within:ring-4 focus-within:ring-accent/15 ${busy ? "pointer-events-none opacity-60" : ""}`}
            >
              {hasCv ? "Replace CV" : "Choose file"}
              <input
                ref={fileInput}
                type="file"
                accept={CV_TYPES}
                className="sr-only"
                disabled={busy}
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
            </label>
          </div>
        </div>
        {cv.step !== "idle" && (
          <p role="status" className={`mt-3 text-xs ${cv.step === "error" ? "text-red-ink" : "text-ink"}`}>
            {cv.step === "reading" && <>Reading {cv.name}…</>}
            {cv.step === "embedding" && (
              <>Understanding {cv.name}… The first time, this downloads a 23 MB model; after that it&apos;s instant.</>
            )}
            {cv.step === "done" && <>Read {cv.name}. {cv.found} Check the lists below, then save.</>}
            {cv.step === "error" && cv.message}
          </p>
        )}
      </div>

      <div className="mt-7 grid gap-6 sm:grid-cols-2">
        <Chips
          label="Roles you want"
          hint="Matched against job titles. Engineer and Developer count as the same."
          values={roles}
          onChange={changeRoles}
          suggestions={ROLES}
          canonical={(v) => ROLES.find((r) => r.toLowerCase() === v.toLowerCase()) ?? v}
          placeholder="e.g. Backend Engineer"
          max={10}
        />
        <Chips
          label="Your skills"
          hint="The more of them a posting mentions, the higher it ranks."
          values={skills}
          onChange={changeSkills}
          suggestions={SKILLS.map((s) => s.name)}
          canonical={(v) => skillFor(v)?.name ?? v}
          placeholder="e.g. Python"
          max={40}
        />
      </div>

      <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Select label="Where" value={pref("remote")} onChange={(v) => setPref("remote", v)}>
          <option value="">Anywhere</option>
          <option value="apac">Remote, open to Sri Lanka</option>
          <option value="anywhere">Remote, from anywhere</option>
          <option value="1">Remote, any</option>
          <option value="hybrid">Hybrid</option>
          <option value="onsite">On-site</option>
        </Select>
        <Select label="Country" value={pref("country")} onChange={(v) => setPref("country", v)}>
          <option value="">Any country</option>
          {countries.map((c) => (
            <option key={c.country} value={c.country}>{countryName(c.country)}</option>
          ))}
        </Select>
        <Select label="Your experience" value={pref("exp")} onChange={(v) => setPref("exp", v)}>
          <option value="">Not set</option>
          <option value="0-1">0-1 years</option>
          <option value="1-2">1-2 years</option>
          <option value="3-5">3-5 years</option>
          <option value="5+">5+ years</option>
        </Select>
        <Select label="Pay" value={pref("pay")} onChange={(v) => setPref("pay", v)}>
          <option value="">Any pay</option>
          <option value="listed">Pay listed</option>
          <option value="100">$100K+ a year</option>
          <option value="150">$150K+ a year</option>
          <option value="200">$200K+ a year</option>
        </Select>
      </div>
      <p className="mt-2 text-xs text-muted">
        Experience hides roles that ask for clearly more (and senior titles for early careers); roles that
        don&apos;t say stay in.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <button
          type="button"
          onClick={save}
          disabled={saving || refreshing || busy}
          className={`${PRIMARY} h-11`}
        >
          {saving || refreshing ? "Saving…" : initial ? "Save changes" : "Show my matches"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[10px] px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-hover hover:text-ink-strong"
          >
            Cancel
          </button>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-ink">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
