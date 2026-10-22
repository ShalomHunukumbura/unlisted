"use client";

import { CaretDown, MagnifyingGlass, SlidersHorizontal, X } from "@phosphor-icons/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";

import { countryName } from "@/components/Tags";

type Props = {
  countries: { country: string; n: string }[];
  departments: { department: string; n: string }[];
};

function Select({
  label,
  value,
  onChange,
  wide = false,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  // min-w-0 + w-full: a native select is as wide as its longest option (some
  // company names are very long), which would push the page past a phone screen.
  return (
    <label className={`relative block min-w-0 sm:max-w-60 ${wide ? "col-span-2 sm:col-span-1" : ""}`}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-10 w-full min-w-0 cursor-pointer appearance-none truncate rounded-[10px] border py-2 pl-3 pr-8 text-sm transition-[border-color,background-color,box-shadow] duration-200 hover:border-line-strong focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 ${
          value ? "border-accent/50 bg-accent-soft font-medium text-accent-ink" : "border-line bg-surface text-ink"
        }`}
      >
        {children}
      </select>
      <CaretDown
        aria-hidden
        size={14}
        weight="bold"
        className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 ${value ? "text-accent-ink" : "text-muted"}`}
      />
    </label>
  );
}

/**
 * Type-to-search over thousands of company names. The list is fetched the first
 * time the field is focused, so the page itself stays small.
 */
function CompanyFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [names, setNames] = useState<{ name: string; n: string }[] | null>(null);
  const [text, setText] = useState(value);
  const [failed, setFailed] = useState(false);

  // Follow the URL (e.g. after "Clear filters"). Adjusting state during render,
  // as React recommends, rather than in an effect.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setText(value);
  }

  function load() {
    if (names || failed) return;
    fetch("/api/companies")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setNames)
      .catch(() => setFailed(true));
  }

  function match(v: string) {
    const wanted = v.trim().toLowerCase();
    return names?.find((c) => c.name.toLowerCase() === wanted)?.name;
  }

  function commit(v: string) {
    if (!v.trim()) return value && onChange("");
    const exact = match(v);
    if (exact) {
      if (exact !== value) onChange(exact);
      setText(exact);
    } else {
      setText(value); // not a company we know: put the field back
    }
  }

  return (
    <label className="relative col-span-2 block min-w-0 sm:col-span-1 sm:w-60">
      <span className="sr-only">Company</span>
      <input
        type="text"
        list="company-options"
        value={text}
        placeholder={failed ? "Company list unavailable" : "Any company"}
        autoComplete="off"
        onFocus={load}
        onChange={(e) => {
          setText(e.target.value);
          // Picking a suggestion fills in the exact name: apply it right away.
          const exact = match(e.target.value);
          if (exact && exact !== value) onChange(exact);
        }}
        onKeyDown={(e) => e.key === "Enter" && commit(text)}
        onBlur={() => commit(text)}
        className={`h-10 w-full min-w-0 rounded-[10px] border py-2 pl-3 pr-3 text-sm transition-[border-color,background-color,box-shadow] duration-200 placeholder:text-ink hover:border-line-strong focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 ${
          value ? "border-accent/50 bg-accent-soft font-medium text-accent-ink" : "border-line bg-surface text-ink"
        }`}
      />
      <datalist id="company-options">
        {names?.map((c) => (
          <option key={c.name} value={c.name} label={`${c.n} ${c.n === "1" ? "job" : "jobs"}`} />
        ))}
      </datalist>
    </label>
  );
}

export default function FilterBar({ countries, departments }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  // Phones show search + "Where" and fold the rest away, so the jobs start on
  // the first screen. Desktop always shows everything.
  const [more, setMore] = useState(false);

  // Debounce the text box; every other control commits immediately. Depends on
  // params too, so a pending search re-applies on top of the latest filters
  // (and "Clear filters" can't be undone by a timer holding the old ones).
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => set("q", q), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, params]);

  // Picking the first filter hides the home page's introduction above the
  // list, and clearing the last one brings it back: about a thousand pixels
  // appear or vanish above you. Keep the filters where they were on screen:
  // note their position before the change, and correct the scroll once the
  // new results are in, before the browser paints.
  const anchor = useRef<number | null>(null);
  const navigate = (url: string) => {
    anchor.current = document.getElementById("roles")?.getBoundingClientRect().top ?? null;
    startTransition(() => router.replace(url, { scroll: false }));
  };
  useLayoutEffect(() => {
    const before = anchor.current;
    anchor.current = null;
    const after = document.getElementById("roles")?.getBoundingClientRect().top;
    if (before == null || after == null || Math.abs(after - before) < 2) return;
    window.scrollBy({ top: after - before, behavior: "instant" });
  }, [params]);

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("cursor"); // any filter change resets pagination
    next.delete("pages");
    navigate(`/?${next.toString()}`);
  }

  const value = (key: string) => params.get(key) ?? "";
  const active = Array.from(params.keys()).some((k) => k !== "cursor" && k !== "pages");
  const folded = ["country", "exp", "pay", "department", "since", "company"].filter((k) => params.get(k)).length;

  return (
    <div role="search">
      <label className="relative block">
        <span className="sr-only">Search jobs</span>
        <MagnifyingGlass
          aria-hidden
          size={20}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search titles or skills"
          className="h-14 w-full rounded-2xl border border-line bg-surface pl-12 pr-20 text-base sm:pr-28 text-ink-strong shadow-card transition-[border-color,box-shadow] duration-200 placeholder:text-muted hover:border-line-strong focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 [&::-webkit-search-cancel-button]:hidden"
        />
        <span
          aria-live="polite"
          className={`pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-xs text-muted transition-opacity duration-200 ${pending ? "opacity-100" : "opacity-0"}`}
        >
          {pending ? "Updating…" : ""}
        </span>
      </label>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <Select label="Where" value={value("remote")} onChange={(v) => set("remote", v)} wide>
          <option value="">Any location</option>
          <option value="apac">Remote, open to Sri Lanka</option>
          <option value="anywhere">Remote, from anywhere</option>
          <option value="1">Remote, any</option>
          <option value="hybrid">Hybrid</option>
          <option value="onsite">On-site</option>
        </Select>

        <button
          type="button"
          aria-expanded={more}
          onClick={() => setMore((m) => !m)}
          className="col-span-2 flex h-10 items-center justify-between rounded-[10px] border border-line bg-surface px-3 text-sm text-ink transition-colors hover:border-line-strong sm:hidden"
        >
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal aria-hidden size={16} />
            {more ? "Fewer filters" : "More filters"}
          </span>
          {folded > 0 && <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent-ink">{folded} on</span>}
        </button>

        <div className={`${more ? "contents" : "hidden"} sm:contents`}>
        <Select label="Country" value={value("country")} onChange={(v) => set("country", v)}>
          <option value="">Any country</option>
          {countries.map((c) => (
            <option key={c.country} value={c.country}>{countryName(c.country)} ({c.n})</option>
          ))}
        </Select>

        <Select label="Experience" value={value("exp")} onChange={(v) => set("exp", v)}>
          <option value="">Any experience</option>
          <option value="0-1">0-1 years</option>
          <option value="1-2">1-2 years</option>
          <option value="3-5">3-5 years</option>
          <option value="5+">5+ years</option>
          <option value="unknown">Not stated</option>
        </Select>

        <Select label="Pay" value={value("pay")} onChange={(v) => set("pay", v)}>
          <option value="">Any pay</option>
          <option value="listed">Pay listed</option>
          <option value="100">$100K+ a year</option>
          <option value="150">$150K+ a year</option>
          <option value="200">$200K+ a year</option>
        </Select>

        <Select label="Team" value={value("department")} onChange={(v) => set("department", v)}>
          <option value="">Any team</option>
          {departments.map((d) => (
            <option key={d.department} value={d.department}>
              {d.department.length > 28 ? d.department.slice(0, 28) + "…" : d.department} ({d.n})
            </option>
          ))}
        </Select>

        <Select label="Posted" value={value("since")} onChange={(v) => set("since", v)}>
          <option value="">Past 3 days</option>
          <option value="1">Past 24 hours</option>
        </Select>

        <CompanyFilter value={value("company")} onChange={(v) => set("company", v)} />
        </div>

        {active && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              navigate("/");
            }}
            className="col-span-2 inline-flex h-10 items-center gap-1.5 justify-self-start rounded-[10px] px-2.5 text-sm font-medium text-muted transition-colors hover:bg-hover hover:text-ink-strong sm:ml-auto"
          >
            <X aria-hidden size={14} weight="bold" />
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
