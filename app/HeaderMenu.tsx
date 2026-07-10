import Link from "next/link";
import styles from "./HomeSearch.module.css";

// Menú del header: <details>/<summary> nativo (mismo patrón de disclosure ya usado en
// app/admin/reservas/page.tsx) en vez de un dropdown con useState — no hace falta JS ni un Client
// Component para esto.
export function HeaderMenu() {
  return (
    <details className={styles.menu}>
      <summary aria-label="Menú">
        <span></span>
        <span></span>
        <span></span>
      </summary>
      <nav className={styles.menuPanel}>
        <Link href="/mis-reservas" className={styles.menuItem}>
          📅 Mis reservas
        </Link>
        <Link href="/registrar-cancha" className={styles.menuItem}>
          🏟️ Registrar cancha
        </Link>
        <Link href="/quienes-somos" className={styles.menuItem}>
          ℹ️ Quienes somos
        </Link>
        <Link href="/terminos" className={styles.menuItem}>
          📄 Términos y privacidad
        </Link>
        <div className={styles.menuDivider} />
        <Link href="/login" className={styles.menuItem}>
          🔐 Ingresar (personal)
        </Link>
      </nav>
    </details>
  );
}
