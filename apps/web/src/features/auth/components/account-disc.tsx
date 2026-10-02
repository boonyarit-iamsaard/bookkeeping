import { accountInitial } from "@/features/auth/account-initial";
import { cn } from "@/shared/helpers/cn";

interface AccountDiscProps {
  email: string;
  /** The disc's size; the header's is 36px, Home's title bar's 32px. */
  className: string;
}

/** The tonal Iris initial disc both account controls lead with; decorative, since each trigger names the email. */
export function AccountDisc({ email, className }: Readonly<AccountDiscProps>) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-secondary font-bold text-secondary-foreground text-sm",
        className,
      )}
    >
      {accountInitial(email)}
    </span>
  );
}

/** What both account controls announce: whose account they open. */
export function accountLabel(email: string): string {
  return `Account: ${email}`;
}
