import { redirect } from "next/navigation";

// Root redirects to the app — marketing site lives at talentpilot.io (talentpilot-site repo)
export default function RootPage() {
  redirect("/login");
}
