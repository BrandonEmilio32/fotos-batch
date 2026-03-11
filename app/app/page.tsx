"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

type ClientRow = {
  id: string;
  name: string;
  notes: string | null;
  created_at: string;
};

type ExportRow = {
  id: string;
  job_id: string;
  file_path: string;
  created_at: string;
};

type FrameRow = {
  id: string;
  name: string;
  file_path: string;
  created_at: string;
};

function resolveExportPath(row: Record<string, unknown>) {
  const candidates = [
    row.file_path,
    row.zip_path,
    row.export_path,
    row.path,
    row.output_path,
  ];
  const found = candidates.find((value) => typeof value === "string");
  return (found as string | undefined) ?? "";
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [exports, setExports] = useState<ExportRow[]>([]);
  const [frames, setFrames] = useState<FrameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showExports, setShowExports] = useState(true);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [
      { data, error },
      { data: exportsData, error: exportsError },
      { data: framesData, error: framesError },
    ] = await Promise.all([
      supabase.from("clients").select("*").order("created_at", {
        ascending: false,
      }),
      supabase
        .from("job_exports")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("frames")
        .select("id, name, file_path, created_at")
        .order("created_at", { ascending: false }),
    ]);

    if (error || exportsError || framesError) {
      setError(error?.message || exportsError?.message || framesError?.message || "No se pudo cargar el dashboard.");
    } else {
      setClients((data ?? []) as ClientRow[]);
      const normalizedExports = ((exportsData ?? []) as Record<string, unknown>[]).map(
        (row) =>
          ({
            ...row,
            file_path: resolveExportPath(row),
          }) as ExportRow,
      );
      setExports(normalizedExports.filter((row) => row.file_path));
      setFrames((framesData ?? []) as FrameRow[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setError(null);
    const { data, error } = await supabase
      .from("clients")
      .insert({
        name,
        notes: notes || null,
      })
      .select("id")
      .single();
    if (error) {
      setError(error.message);
      setCreating(false);
      return;
    }

    setName("");
    setNotes("");
    loadClients();
    setCreating(false);

    // Navegar directamente a la escuela recien creada
    if (data?.id) {
      router.push(`/app/clients/${data.id}`);
    }
  };

  const downloadExport = async (item: ExportRow) => {
    setDownloading(item.id);
    setError(null);
    try {
      const { data, error } = await supabase.storage
        .from("zips")
        .createSignedUrl(item.file_path, 60 * 5);
      if (error) throw error;
      window.open(data.signedUrl, "_blank", "noopener");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo descargar.");
    } finally {
      setDownloading(null);
    }
  };

  const deleteExport = async (item: ExportRow) => {
    setDeleting(item.id);
    setError(null);
    try {
      const { error: storageError } = await supabase.storage
        .from("zips")
        .remove([item.file_path]);
      if (storageError) throw storageError;
      const { error: deleteError } = await supabase
        .from("job_exports")
        .delete()
        .eq("id", item.id);
      if (deleteError) throw deleteError;
      setExports((prev) => prev.filter((row) => row.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Stats de dashboard */}
      <section className="grid gap-4 lg:grid-cols-4">
        {[
          { label: "Escuelas activas", value: clients.length, delta: "+3.5%" },
          { label: "Grupos recientes", value: 12, delta: "+11%" },
          { label: "Procesos hoy", value: 34, delta: "-2.4%" },
          { label: "Descargas", value: exports.length, delta: "+5.5%" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-lg shadow-black/30"
          >
            <div className="flex items-center justify-between">
              <p className="text-2xl font-semibold text-white">
                {stat.value}
              </p>
              <div className="rounded-xl bg-[var(--panel-strong)] px-3 py-2 text-xs text-[var(--accent)]">
                {stat.delta}
              </div>
            </div>
            <p className="mt-3 text-sm text-[var(--muted)]">{stat.label}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Columna izquierda: escuelas y formulario */}
        <div className="space-y-6">
          {/* Cards de escuelas recientes */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-lg shadow-black/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                  Inicio
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  Escuelas recientes
                </h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Atajos directos a las escuelas que más usas.
                </p>
              </div>
              <Link
                href="/app/escuelas"
                className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--accent)] hover:bg-[var(--panel-strong)]"
              >
                Ver todas
              </Link>
            </div>

            {loading && (
              <p className="mt-4 text-sm text-[var(--muted)]">Cargando escuelas...</p>
            )}
            {!loading && !error && clients.length === 0 && (
              <p className="mt-4 text-sm text-[var(--muted)]">
                No hay escuelas todavía.
              </p>
            )}

            <div className="mt-4 grid gap-4 md:grid-cols-4">
              {clients.slice(0, 4).map((client) => (
                <Link
                  key={client.id}
                  href={`/app/clients/${client.id}`}
                  className="group flex flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 text-sm shadow-lg shadow-black/30 transition hover:-translate-y-1 hover:bg-[var(--panel)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">
                        Escuela
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-white group-hover:text-[var(--accent)]">
                        {client.name}
                      </h3>
                      {client.notes && (
                        <p className="mt-2 line-clamp-2 text-xs text-[var(--muted)]">
                          {client.notes}
                        </p>
                      )}
                    </div>
                    <span className="rounded-full bg-[var(--panel)] px-3 py-1 text-xs text-[var(--muted)]">
                      Creada el {new Date(client.created_at).toLocaleDateString("es-ES")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Nueva escuela inline en dashboard */}
          <section className="rounded-2xl border border-[var(--accent)] bg-[var(--panel)] p-6 shadow-xl shadow-[var(--accent)]/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--accent)]">
                  Acción principal
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white">Añadir nueva escuela</h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Crea una escuela para empezar a cargar grupos y marcos.
                </p>
              </div>
              <span className="hidden rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)] sm:inline-flex">
                Alta rápida
              </span>
            </div>
            <form onSubmit={handleCreate} className="mt-4 grid gap-4">
              <div>
                <label className="text-sm font-medium text-white">Nombre</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-white">Notas</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-white"
                  rows={3}
                />
              </div>
              <button
                type="submit"
                disabled={creating}
                className="w-full rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-60"
              >
                {creating ? "Guardando..." : "Crear escuela"}
              </button>
            </form>
          </section>
        </div>

        {/* Columna derecha: zips listos + marcos */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-lg shadow-black/30">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Zips listos</h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Últimas tandas exportadas listas para descargar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowExports((prev) => !prev)}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--panel-strong)]"
              >
                {showExports ? "Ocultar" : "Mostrar"}
              </button>
            </div>

            {exports.length === 0 && !loading && (
              <p className="mt-4 text-sm text-[var(--muted)]">
                Todavía no hay zips guardados.
              </p>
            )}

            {showExports && exports.length > 0 && (
              <div className="mt-4 grid gap-3">
                {exports.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-white">Job {item.job_id}</p>
                      <p className="text-xs text-[var(--muted)]">{item.file_path}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => downloadExport(item)}
                        disabled={downloading === item.id}
                        className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-black disabled:opacity-60"
                      >
                        {downloading === item.id ? "Descargando..." : "Descargar"}
                      </button>
                      <button
                        onClick={() => deleteExport(item)}
                        disabled={deleting === item.id}
                        className="rounded-full border border-red-500/30 px-3 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/10 disabled:opacity-60"
                      >
                        {deleting === item.id ? "Eliminando..." : "Eliminar"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Marcos globales */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-lg shadow-black/30">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Marcos</h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Catálogo global de marcos disponibles para todas las escuelas.
                </p>
              </div>
              <Link
                href="/app/marcos"
                className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--accent)] hover:bg-[var(--panel-strong)]"
              >
                Ver y subir marcos
              </Link>
            </div>

            {frames.length === 0 && !loading && (
              <p className="mt-4 text-sm text-[var(--muted)]">
                Todavía no hay marcos cargados.
              </p>
            )}

            {frames.length > 0 && (
              <div className="mt-4 grid gap-3">
                {frames.slice(0, 6).map((frame) => (
                  <div
                    key={frame.id}
                    className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-white">{frame.name}</p>
                      <p className="text-xs text-[var(--muted)]">{frame.file_path}</p>
                    </div>
                    <span className="text-[10px] text-[var(--muted)]">
                      {new Date(frame.created_at).toLocaleDateString("es-ES")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
