/**
 * The public deployment sets JOBSITE_READ_ONLY=1. The admin page and its API
 * run the Python CLI on the server and have no auth, so they exist only locally.
 */
export const READ_ONLY = process.env.JOBSITE_READ_ONLY === "1";
