import { redirect } from "next/navigation";
import { AppHeader } from "@/app/(app)/app-header";
import { getSession } from "@/core/auth/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <>
      <AppHeader email={session.user.email} />
      {children}
    </>
  );
}
