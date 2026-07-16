import { redirect } from "next/navigation";

// La home del módulo admin es Reservas (antes era el Dashboard, que se movió a /admin/dashboard).
export default function AdminHomePage() {
  redirect("/admin/reservas");
}
