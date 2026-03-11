"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { bytesToMegabytes } from "@/lib/utils";

type FrameRow = {
  id: string;
  name: string;
  file_path: string;
  created_at: string;
};

export default function MarcosPage() {
  const supabase = getSupabaseClient();
  const [frames, setFrames] = useState<FrameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [frameFile, setFrameFile] = useState<File | null>(null);
  const [frameName, setFrameName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingFrame, setSavingFrame] = useState(false);
  const [deletingFrameId, setDeletingFrameId] = useState<string | null>(null);
  const frameInputRef = useRef<HTMLInputElement | null>(null);

  const loadFrames = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("frames")
      .select("id, name, file_path, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setFrames((data ?? []) as FrameRow[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadFrames();
  }, [loadFrames]);

  const handleFrameUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!frameFile) return;
    setUploading(true);
    setError(null);

    const frameId = crypto.randomUUID();
    const filePath = `global/${frameId}.png`;

    const { error: uploadError } = await supabase.storage
      .from("frames")
      .upload(filePath, frameFile, {
        upsert: false,
        contentType: "image/png",
      });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { error: insertError } = await supabase.from("frames").insert({
      client_id: null,
      name: frameName || frameFile.name,
      file_path: filePath,
      width: null,
      height: null,
      is_active: true,
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setFrameFile(null);
      setFrameName("");
      loadFrames();
    }
    setUploading(false);
  };

  const handleFrameDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const dropped = event.dataTransfer.files?.[0] ?? null;
    if (dropped && dropped.type === "image/png") {
      setFrameFile(dropped);
      if (!frameName) setFrameName(dropped.name);
      return;
    }
    setError("Solo se permite marco PNG.");
  };

  const handleFrameRename = async (frame: FrameRow) => {
    setEditingId(frame.id);
    setEditingName(frame.name);
  };

  const handleFrameSave = async (frame: FrameRow) => {
    setSavingFrame(true);
    setError(null);
    const { data, error } = await supabase
      .from("frames")
      .update({ name: editingName })
      .eq("id", frame.id)
      .select("id, name, file_path, created_at")
      .single();
    if (error) {
      setError(error.message);
    } else {
      setFrames((prev) =>
        prev.map((f) => (f.id === frame.id ? (data as FrameRow) : f)),
      );
      setEditingId(null);
      setEditingName("");
    }
    setSavingFrame(false);
  };

  const handleFrameDelete = async (frame: FrameRow) => {
    const confirmed = window.confirm(
      "Seguro? Esto eliminará el marco del catálogo global.",
    );
    if (!confirmed) return;
    setDeletingFrameId(frame.id);
    setError(null);
    try {
      // Borrar archivo de storage
      await supabase.storage.from("frames").remove([frame.file_path]);
      // Borrar registro
      const { error } = await supabase.from("frames").delete().eq("id", frame.id);
      if (error) throw error;
      setFrames((prev) => prev.filter((f) => f.id !== frame.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el marco.");
    } finally {
      setDeletingFrameId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Catálogo
          </p>
          <h2 className="text-2xl font-semibold text-white">Marcos</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Gestiona todos los marcos globales disponibles para cualquier escuela.
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-lg shadow-black/30">
        <h3 className="text-lg font-semibold text-white">Subir nuevo marco</h3>
        <form onSubmit={handleFrameUpload} className="mt-4 grid gap-3">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleFrameDrop}
            className={`rounded-2xl border border-dashed px-4 py-6 text-center ${
              dragActive
                ? "border-[var(--accent)] bg-[var(--panel)]"
                : "border-[var(--border)] bg-[var(--panel-strong)]"
            }`}
          >
            <p className="text-sm text-white">Arrastra tu marco PNG aquí</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              o usa el botón para abrir el explorador
            </p>
            <button
              type="button"
              onClick={() => frameInputRef.current?.click()}
              className="mt-3 rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--panel)] hover:text-white"
            >
              Seleccionar archivo
            </button>
            <input
              ref={frameInputRef}
              type="file"
              accept="image/png"
              onChange={(e) => {
                const selected = e.target.files?.[0] ?? null;
                setFrameFile(selected);
                if (selected && !frameName) setFrameName(selected.name);
              }}
              className="hidden"
            />
          </div>
          <input
            value={frameName}
            onChange={(e) => setFrameName(e.target.value)}
            placeholder="Nombre del marco (opcional)"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-white"
          />
          {frameFile && (
            <p className="text-xs text-[var(--muted)]">
              Archivo: {frameFile.name} · {bytesToMegabytes(frameFile.size)} MB
            </p>
          )}
          <button
            type="submit"
            disabled={!frameFile || uploading}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-60"
          >
            {uploading ? "Subiendo..." : "Subir PNG"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-lg shadow-black/30">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Marcos existentes</h3>
          {!loading && (
            <span className="text-xs text-[var(--muted)]">
              {frames.length} marco{frames.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {loading && (
          <p className="mt-4 text-sm text-[var(--muted)]">Cargando marcos...</p>
        )}
        {!loading && frames.length === 0 && (
          <p className="mt-4 text-sm text-[var(--muted)]">
            Todavía no hay marcos guardados.
          </p>
        )}

        <div className="mt-4 grid gap-3">
          {frames.map((frame) => (
            <div
              key={frame.id}
              className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 text-sm"
            >
              <div className="max-w-md">
                {editingId === frame.id ? (
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-white"
                  />
                ) : (
                  <p className="font-medium text-white">{frame.name}</p>
                )}
                <p className="mt-1 text-xs text-[var(--muted)]">{frame.file_path}</p>
              </div>
              <div className="flex flex-col items-end gap-2 text-[10px] text-[var(--muted)]">
                <span>{new Date(frame.created_at).toLocaleDateString("es-ES")}</span>
                <div className="flex flex-wrap justify-end gap-2 text-xs">
                  {editingId === frame.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleFrameSave(frame)}
                        disabled={savingFrame}
                        className="rounded-full bg-[var(--accent)] px-3 py-1 font-semibold text-black disabled:opacity-60"
                      >
                        {savingFrame ? "Guardando..." : "Guardar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditingName("");
                        }}
                        className="rounded-full border border-[var(--border)] px-3 py-1 text-[var(--muted)] hover:bg-[var(--panel)]"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleFrameRename(frame)}
                      className="rounded-full border border-[var(--border)] px-3 py-1 text-[var(--muted)] hover:bg-[var(--panel)]"
                    >
                      Renombrar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleFrameDelete(frame)}
                    disabled={deletingFrameId === frame.id}
                    className="rounded-full border border-red-500/30 px-3 py-1 font-semibold text-red-200 hover:bg-red-500/10 disabled:opacity-60"
                  >
                    {deletingFrameId === frame.id ? "Eliminando..." : "Eliminar"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
