import { query } from "./db";
import { currentProfile, type Profile } from "./profile";
import { getJob } from "./queries";

/**
 * The application tracker, for people with an account: roles marked as
 * applied to, where each stands, and notes. See migration 0017.
 */
export const STATUSES = ["applied", "interviewing", "offer", "rejected"] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<Status, string> = {
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Not selected",
};

const MAX_APPLICATIONS = 500;
export const MAX_NOTES = 2000;

export type Application = {
  job_id: string;
  title: string;
  company: string;
  location: string | null;
  apply_url: string;
  status: Status;
  notes: string;
  applied_at: string;
  /** Still on Unlisted (jobs leave three days after they're posted). */
  listed: boolean;
};

/** The signed-in profile: the tracker is for accounts, not for a profile on one device. */
export async function trackerProfile(): Promise<(Profile & { email: string }) | null> {
  const profile = await currentProfile();
  return profile?.email ? (profile as Profile & { email: string }) : null;
}

const ID = /^\d{1,18}$/;

export async function listApplications(profileId: string): Promise<Application[]> {
  return query<Application>(
    `SELECT a.job_id::text, a.title, a.company, a.location, a.apply_url, a.status, a.notes,
            to_char(a.applied_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS applied_at,
            EXISTS (SELECT 1 FROM jobs j WHERE j.id = a.job_id AND j.closed_at IS NULL) AS listed
       FROM applications a WHERE a.profile_id = $1
      ORDER BY a.applied_at DESC`,
    [profileId],
  );
}

export async function countApplications(profileId: string): Promise<number> {
  const [row] = await query<{ n: number }>(`SELECT count(*)::int AS n FROM applications WHERE profile_id = $1`, [profileId]);
  return row.n;
}

export async function applicationStatus(profileId: string, jobId: string): Promise<Status | null> {
  if (!ID.test(jobId)) return null;
  const [row] = await query<{ status: Status }>(
    `SELECT status FROM applications WHERE profile_id = $1 AND job_id = $2`,
    [profileId, jobId],
  );
  return row?.status ?? null;
}

/** Mark a role as applied to, keeping what it looks like now. False if there's no such role. */
export async function markApplied(profileId: string, jobId: string): Promise<boolean> {
  const job = await getJob(jobId);
  if (!job) return false;
  if ((await countApplications(profileId)) >= MAX_APPLICATIONS) return false;
  await query(
    `INSERT INTO applications (profile_id, job_id, title, company, location, apply_url)
     VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (profile_id, job_id) DO NOTHING`,
    [profileId, jobId, job.title, job.company_name, job.location_raw, job.apply_url],
  );
  return true;
}

export async function updateApplication(
  profileId: string,
  jobId: string,
  change: { status?: Status; notes?: string },
): Promise<boolean> {
  if (!ID.test(jobId)) return false;
  const rows = await query(
    `UPDATE applications SET status = COALESCE($3, status), notes = COALESCE($4, notes), updated_at = now()
      WHERE profile_id = $1 AND job_id = $2 RETURNING 1`,
    [profileId, jobId, change.status ?? null, change.notes?.slice(0, MAX_NOTES) ?? null],
  );
  return rows.length > 0;
}

export async function removeApplication(profileId: string, jobId: string): Promise<void> {
  if (!ID.test(jobId)) return;
  await query(`DELETE FROM applications WHERE profile_id = $1 AND job_id = $2`, [profileId, jobId]);
}
