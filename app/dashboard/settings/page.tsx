import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Legacy path — profile + preferences now live at `/settings`. */
export default function DashboardSettingsRedirectPage() {
  redirect("/settings");
}
