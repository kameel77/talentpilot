import { redirect } from "next/navigation";

export default function RegisterCoachPage() {
    redirect("/register?role=coach");
}
