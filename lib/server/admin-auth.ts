import "server-only";

import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/auth";

export async function requireAdmin() {
  const store = await cookies();
  const session = verifyAdminSession(store.get(ADMIN_COOKIE)?.value);
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}
