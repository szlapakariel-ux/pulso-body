/**
 * Guard para npm run db:demo-reset.
 * Aborta si DATABASE_URL no apunta a una DB local segura.
 *
 * Hosts permitidos: localhost, 127.0.0.1, ::1.
 * Cualquier otro host (Railway, Neon, Supabase, etc.) aborta con exit 1.
 *
 * Ver docs/pb-13b-deploy-beta-privada.md (PB-13B).
 */

const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function fail(msg: string): never {
  // eslint-disable-next-line no-console
  console.error(`\n[guard-demo-reset] ${msg}\n`);
  process.exit(1);
}

const raw = process.env.DATABASE_URL;
if (!raw) {
  fail("DATABASE_URL no está definida. db:demo-reset no puede correr a ciegas.");
}

let host: string;
try {
  // new URL maneja postgres://, postgresql:// y variantes con o sin auth.
  const u = new URL(raw!);
  host = u.hostname;
} catch {
  fail(
    "DATABASE_URL no se pudo parsear como URL. Revisá el formato (postgresql://...).",
  );
}

// new URL deja host como "" para algunos formatos raros; normalizar.
const normalized = host!.replace(/^\[|\]$/g, ""); // elimina corchetes IPv6

if (!ALLOWED_HOSTS.has(normalized)) {
  fail(
    `DATABASE_URL host="${normalized}" no es local. ` +
      `db:demo-reset borra toda la base; está bloqueado fuera de localhost/127.0.0.1/::1. ` +
      `Si querés resetear una DB remota, hacelo manualmente con prisma migrate reset apuntando a esa URL en otra terminal.`,
  );
}

// eslint-disable-next-line no-console
console.log(`[guard-demo-reset] OK — host local (${normalized}). Continuando…`);
