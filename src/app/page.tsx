import { redirect } from "next/navigation";

export default function HomePage() {
  // Default redirect to /overview for client preview, or /login
  redirect("/overview");
}
