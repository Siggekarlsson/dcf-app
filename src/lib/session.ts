"use client";

const KEY = "dcf_session_id";

/** Anonymt sessions-id i localStorage, används som nyckel för sparade scenarier och chatt. */
export function getSessionId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
