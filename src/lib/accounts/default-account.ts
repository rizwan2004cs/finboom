// Default money source per profile, UPI-style.
//
// Two layers: an explicit PRIMARY account (starred on the Cash & Bank page)
// always wins; otherwise the LAST-USED account (written by the transaction
// modals and the assistant on every save) fills in. Both live in
// localStorage — same convention the modals already used for last-used.

export function primaryAccountKey(profileId: string): string {
  return `finboom_primary_account_${profileId}`
}

export function lastAccountKey(profileId: string): string {
  return `finboom_last_account_${profileId}`
}

export function getPrimaryAccountId(profileId: string): string {
  try {
    return localStorage.getItem(primaryAccountKey(profileId)) || ""
  } catch {
    return ""
  }
}

export function setPrimaryAccountId(profileId: string, accountId: string | null): void {
  try {
    if (accountId) localStorage.setItem(primaryAccountKey(profileId), accountId)
    else localStorage.removeItem(primaryAccountKey(profileId))
  } catch {
    /* storage unavailable */
  }
}

/** The account a new transaction should default to: primary, else last-used. */
export function getPreferredAccountId(profileId: string): string {
  try {
    return (
      localStorage.getItem(primaryAccountKey(profileId)) ||
      localStorage.getItem(lastAccountKey(profileId)) ||
      ""
    )
  } catch {
    return ""
  }
}
