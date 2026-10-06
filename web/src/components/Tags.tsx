import type { Job } from "@/lib/queries";

type Tone = "neutral" | "green" | "blue" | "yellow";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

/** "IN" -> "India"; anything that isn't a known code is shown as it is. */
export function countryName(code: string | null): string {
  if (!code) return "one country";
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

const TONES: Record<Tone, string> = {
  neutral: "bg-hover text-muted",
  green: "bg-green-bg text-green-ink",
  blue: "bg-blue-bg text-blue-ink",
  yellow: "bg-yellow-bg text-yellow-ink",
};

export function Tag({
  tone = "neutral",
  title,
  mono = false,
  children,
}: {
  tone?: Tone;
  title?: string;
  mono?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-[5px] px-1.5 py-0.5 text-xs leading-4 ${mono ? "font-mono tabular-nums" : ""} ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * Where a remote role can be done from, coloured by how open it is: green for
 * anywhere, blue for a region, yellow for a single country.
 */
export function remoteLabel(job: Pick<Job, "remote" | "open_to" | "region" | "country">): {
  text: string;
  tone: Tone;
  title: string;
} | null {
  if (!job.remote) return null;
  switch (job.open_to) {
    case "anywhere":
      return { text: "Remote · anywhere", tone: "green", title: "No location restriction on the posting" };
    case "region":
      return {
        text: `Remote · ${job.region ?? "region"}`,
        tone: "blue",
        title: "Remote within a region: check you're inside it",
      };
    case "country":
      return {
        text: `Remote · ${countryName(job.country)} only`,
        tone: "yellow",
        title: "Remote, but only from one country",
      };
    default:
      return { text: "Remote", tone: "neutral", title: "Remote; where from isn't stated clearly" };
  }
}

const PER: Record<string, string> = { year: "", month: "/mo", hour: "/hr" };

function money(value: number, currency: string, compact: boolean): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      ...(compact
        ? { notation: "compact", maximumFractionDigits: 1 }
        : { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 }),
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-US")}`; // not a currency code Intl knows
  }
}

/** "$150K–$190K", "£50K", "$25–$31.50/hr"; null when no base pay is known. */
export function payLabel(job: Pick<Job, "comp_min" | "comp_max" | "comp_currency" | "comp_period">): string | null {
  if (!job.comp_period || job.comp_min == null) return null;
  const currency = job.comp_currency || "USD";
  const compact = job.comp_period !== "hour";
  const lo = money(Number(job.comp_min), currency, compact);
  const hi = job.comp_max != null && Number(job.comp_max) > Number(job.comp_min)
    ? money(Number(job.comp_max), currency, compact)
    : null;
  return `${hi ? `${lo}–${hi}` : lo}${PER[job.comp_period] ?? ""}`;
}
