import { redirect } from "next/navigation";
import { getSession } from "@/core/auth/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  return children;
}
