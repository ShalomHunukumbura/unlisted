import Link from "next/link";
import { notFound } from "next/navigation";

import AddCompany from "@/components/AddCompany";
import { READ_ONLY } from "@/lib/mode";
import { listCompanies } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  ats: string;
  board_token: string;
  enabled: boolean;
  last_synced_at: string | null;
  last_error: string | null;
  consecutive_failures: number;
  source: string;
  open_jobs: string;
};

export default async function CompaniesPage() {
  if (READ_ONLY) notFound();
  const companies = (await listCompanies()) as unknown as Row[];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← All jobs
      </Link>
      <h1 className="mt-4 mb-1 text-2xl font-semibold tracking-tight">Companies</h1>
      <p className="mb-6 text-sm text-neutral-500">
        {companies.length} tracked ·{" "}
        {companies.filter((c) => c.enabled).length} enabled
      </p>

      <AddCompany />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
            <tr>
              <th className="py-2 pr-3 font-medium">Company</th>
              <th className="py-2 pr-3 font-medium">ATS</th>
              <th className="py-2 pr-3 font-medium">Token</th>
              <th className="py-2 pr-3 text-right font-medium">Open</th>
              <th className="py-2 pr-3 font-medium">Last sync</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {companies.map((c) => (
              <tr key={c.id} className={c.enabled ? "" : "opacity-45"}>
                <td className="py-2 pr-3 font-medium">{c.name}</td>
                <td className="py-2 pr-3 text-neutral-500">{c.ats}</td>
                <td className="py-2 pr-3 font-mono text-xs text-neutral-500">
                  {c.board_token}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{c.open_jobs}</td>
                <td className="py-2 pr-3 text-neutral-500">
                  {c.last_synced_at
                    ? new Date(c.last_synced_at).toLocaleString()
                    : "never"}
                </td>
                <td className="py-2">
                  {c.last_error ? (
                    <span
                      title={c.last_error}
                      className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-300"
                    >
                      failing ×{c.consecutive_failures}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-400">ok</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
