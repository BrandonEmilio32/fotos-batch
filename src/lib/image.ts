type JobPreset = {
  output_format: "jpg" | "png";
  output_quality: number;
  background_color: string;
  target_width: number;
  target_height: number;
  grid_cols: number;
  grid_rows: number;
  grid_cell_w: number;
  grid_cell_h: number;
  grid_gap: number;
};

function toBlobAsync(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo generar la imagen."));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

export function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo cargar la imagen."));
    };
    img.src = url;
  });
}

export function loadImageFromUrl(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen remota."));
    img.src = url;
  });
}

export function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;

  let drawW = w;
  let drawH = h;
  let offsetX = x;
  let offsetY = y;

  if (imgRatio > boxRatio) {
    drawH = h;
    drawW = h * imgRatio;
    offsetX = x - (drawW - w) / 2;
  } else {
    drawW = w;
    drawH = w / imgRatio;
    offsetY = y - (drawH - h) / 2;
  }

  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
}

export function drawImageContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.min(w / img.width, h / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const offsetX = x + (w - drawW) / 2;
  const offsetY = y + (h - drawH) / 2;
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
}

export async function makeFramedBlob(
  studentImg: HTMLImageElement,
  frameImg: HTMLImageElement | null,
  preset: JobPreset,
) {
  const canvas = document.createElement("canvas");
  canvas.width = preset.target_width;
  canvas.height = preset.target_height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible.");

  if (preset.output_format === "jpg") {
    ctx.fillStyle = preset.background_color || "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  drawImageCover(ctx, studentImg, 0, 0, canvas.width, canvas.height);

  if (frameImg) {
    ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
  }

  const type =
    preset.output_format === "jpg" ? "image/jpeg" : "image/png";
  return toBlobAsync(canvas, type, preset.output_quality);
}

export async function makeGrid3x3Blob(
  studentImg: HTMLImageElement,
  preset: JobPreset,
) {
  const gap = preset.grid_gap ?? 0;
  const width =
    preset.grid_cols * preset.grid_cell_w + gap * (preset.grid_cols - 1);
  const height =
    preset.grid_rows * preset.grid_cell_h + gap * (preset.grid_rows - 1);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible.");

  ctx.fillStyle = preset.background_color || "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < preset.grid_rows; row += 1) {
    for (let col = 0; col < preset.grid_cols; col += 1) {
      const x = col * preset.grid_cell_w + col * gap;
      const y = row * preset.grid_cell_h + row * gap;
      drawImageContain(
        ctx,
        studentImg,
        x,
        y,
        preset.grid_cell_w,
        preset.grid_cell_h,
      );
    }
  }

  const type =
    preset.output_format === "jpg" ? "image/jpeg" : "image/png";
  return toBlobAsync(canvas, type, preset.output_quality);
}

export async function makeContactSheetBlob(
  images: HTMLImageElement[],
  preset: JobPreset,
) {
  if (images.length < preset.grid_rows) {
    throw new Error("Se necesitan al menos tres imágenes para el collage.");
  }

  const gap = preset.grid_gap ?? 0;
  const width =
    preset.grid_cols * preset.grid_cell_w + gap * (preset.grid_cols - 1);
  const height =
    preset.grid_rows * preset.grid_cell_h + gap * (preset.grid_rows - 1);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible.");

  ctx.fillStyle = preset.background_color || "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < preset.grid_rows; row += 1) {
    const rowImg = images[row];
    for (let col = 0; col < preset.grid_cols; col += 1) {
      const x = col * preset.grid_cell_w + col * gap;
      const y = row * preset.grid_cell_h + row * gap;
      drawImageContain(ctx, rowImg, x, y, preset.grid_cell_w, preset.grid_cell_h);
    }
  }

  const type =
    preset.output_format === "jpg" ? "image/jpeg" : "image/png";
  return toBlobAsync(canvas, type, preset.output_quality);
}
