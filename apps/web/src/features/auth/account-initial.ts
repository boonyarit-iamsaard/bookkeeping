/** The letter the account disc shows: the email's first, uppercased. */
export function accountInitial(email: string): string {
  return email.trim().charAt(0).toUpperCase() || "?";
}
