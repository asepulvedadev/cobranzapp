import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found">
      <div>
        <span>404</span>
        <h1>Esta ruta no forma parte de la jornada.</h1>
        <p>La página que buscas no existe o cambió de ubicación.</p>
        <Link className="button" href="/">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
