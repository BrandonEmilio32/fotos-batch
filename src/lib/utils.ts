export function sanitizeFileName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "foto";
  return trimmed
    .replace(/\s+/g, "_")
    .replace(/[^\w\-]+/g, "")
    .replace(/_+/g, "_")
    .slice(0, 80);
}

export function removeExtension(name: string) {
  const idx = name.lastIndexOf(".");
  return idx > 0 ? name.slice(0, idx) : name;
}

export function bytesToMegabytes(bytes: number) {
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}
