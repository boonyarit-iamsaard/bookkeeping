import type { Metadata } from "next";
import { getSession } from "@/core/auth/session";
import { SignOutButton } from "@/features/auth/components/sign-out-button";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function Page() {
  const session = await getSession();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center space-y-2 p-4">
        <h1 className="font-bold text-2xl">Welcome to Bookkeeping</h1>
        <p className="text-muted-foreground text-sm">
          Signed in as {session?.user.email}
        </p>
        <SignOutButton />
      </div>
    </div>
  );
}
