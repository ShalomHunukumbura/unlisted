"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type Props = {
  companies: { name: string; n: string }[];
  countries: { country: string; n: string }[];
  departments: { department: string; n: string }[];
};

export default function FilterBar({ companies, countries, departments }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  // Debounce the text box; every other control commits immediately.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => set("q", q), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("cursor"); // any filter change resets pagination
    startTransition(() => router.replace(`/?${next.toString()}`, { scroll: false }));
  }

  const select =
    "rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm " +
    "dark:border-neutral-700 dark:bg-neutral-900";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search title & description…"
        className="min-w-56 flex-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />

      <select className={select} value={params.get("remote") ?? ""} onChange={(e) => set("remote", e.target.value)}>
        <option value="">Any location</option>
        <option value="anywhere">Remote — anywhere 🌍</option>
        <option value="apac">Remote — open to Sri Lanka</option>
        <option value="1">Remote (any)</option>
        <option value="hybrid">Hybrid</option>
        <option value="onsite">On-site</option>
      </select>

      <select className={select} value={params.get("country") ?? ""} onChange={(e) => set("country", e.target.value)}>
        <option value="">Any country</option>
        {countries.map((c) => (
          <option key={c.country} value={c.country}>{c.country} ({c.n})</option>
        ))}
      </select>

      <select className={select} value={params.get("company") ?? ""} onChange={(e) => set("company", e.target.value)}>
        <option value="">Any company</option>
        {companies.map((c) => (
          <option key={c.name} value={c.name}>{c.name} ({c.n})</option>
        ))}
      </select>

      <select className={select} value={params.get("department") ?? ""} onChange={(e) => set("department", e.target.value)}>
        <option value="">Any team</option>
        {departments.map((d) => (
          <option key={d.department} value={d.department}>
            {d.department.length > 28 ? d.department.slice(0, 28) + "…" : d.department} ({d.n})
          </option>
        ))}
      </select>

      <select className={select} value={params.get("exp") ?? ""} onChange={(e) => set("exp", e.target.value)}>
        <option value="">Any experience</option>
        <option value="0-1">0–1 years</option>
        <option value="1-2">1–2 years</option>
        <option value="3-5">3–5 years</option>
        <option value="5+">5+ years</option>
        <option value="unknown">Not stated</option>
      </select>

      <select className={select} value={params.get("since") ?? ""} onChange={(e) => set("since", e.target.value)}>
        <option value="">Past 2 weeks</option>
        <option value="1">Past 24h</option>
        <option value="3">Past 3 days</option>
        <option value="7">Past week</option>
      </select>

      {Array.from(params.keys()).some((k) => k !== "cursor") && (
        <button
          onClick={() => startTransition(() => router.replace("/", { scroll: false }))}
          className="rounded-md px-2 py-1.5 text-sm text-neutral-500 underline-offset-2 hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}
