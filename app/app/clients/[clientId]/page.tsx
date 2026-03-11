"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { bytesToMegabytes } from "@/lib/utils";

type ClientRow = {
  id: string;
  name: string;
  notes: string | null;
};

type FrameRow = {
  id: string;
  name: string;
  file_path: string;
  created_at: string;
  is_active: boolean;
};

type JobRow = {
  id: string;
  job_name: string;
  status: string;
  created_at: string;
  processed_items: number;
  total_items: number;
};

export default function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const supabase = getSupabaseClient();
  const [client, setClient] = useState<ClientRow | null>(null);
  const [frames, setFrames] = useState<FrameRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [frameFile, setFrameFile] = useState<File | null>(null);
  const [frameName, setFrameName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const frameInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [
      { data: clientData, error: clientError },
      { data: framesData, error: framesError },
      { data: jobsData, error: jobsError },
    ] = await Promise.all([
      supabase.from("clients").select("*").eq("id", clientId).single(),
      supabase
        .from("frames")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("jobs")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
    ]);

    if (clientError || framesError || jobsError) {
      setError(clientError?.message || framesError?.message || jobsError?.message || "Error al cargar.");
    } else {
      setClient(clientData as ClientRow);
      setFrames((framesData ?? []) as FrameRow[]);
      setJobs((jobsData ?? []) as JobRow[]);
    }
    setLoading(false);
  }, [clientId, supabase]);

  useEffect(() => {
    const handle = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(handle);
  }, [loadData]);

  const handleFrameUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!frameFile) return;
    setUploading(true);
    setError(null);
    const frameId = crypto.randomUUID();
    const filePath = `${clientId}/${frameId}.png`;

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
      client_id: clientId,
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
      loadData();
    }
    setUploading(false);
  };

  const openFrame = async (frame: FrameRow) => {
    const { data, error } = await supabase.storage
      .from("frames")
      .createSignedUrl(frame.file_path, 60 * 60);
    if (error) {
      setError(error.message);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Escuela
          </p>
          <h2 className="text-2xl font-semibold text-white">
            {client?.name ?? "Cargando..."}
          </h2>
        </div>
        <Link
          href={`/app/clients/${clientId}/jobs/new`}
          className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black hover:brightness-110"
        >
          Nuevo grupo
        </Link>
      </div>

      {loading && (
        <p className="text-sm text-[var(--muted)]">Cargando...</p>
      )}
      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-lg shadow-black/30">
        <h3 className="text-lg font-semibold text-white">Marcos</h3>
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
            <p className="text-sm text-white">
              Arrastra tu marco PNG aqui
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              o usa el boton para abrir el explorador
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

        <div className="mt-6 grid gap-3">
          {frames.length === 0 && (
            <p className="text-sm text-[var(--muted)]">No hay marcos aun.</p>
          )}
          {frames.map((frame) => (
            <div
              key={frame.id}
              className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium text-white">{frame.name}</p>
                <p className="text-xs text-[var(--muted)]">
                  {frame.file_path}
                </p>
              </div>
              <button
                onClick={() => openFrame(frame)}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--panel)]"
              >
                Ver PNG
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-lg shadow-black/30">
        <h3 className="text-lg font-semibold text-white">Grupos</h3>
        <div className="mt-4 grid gap-3">
          {jobs.length === 0 && (
            <p className="text-sm text-[var(--muted)]">No hay grupos.</p>
          )}
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/app/jobs/${job.id}`}
              className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 text-sm hover:bg-[var(--panel)]"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">{job.job_name}</span>
                <span className="text-xs text-[var(--muted)]">
                  {job.status}
                </span>
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">
                {job.processed_items}/{job.total_items} procesadas
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
