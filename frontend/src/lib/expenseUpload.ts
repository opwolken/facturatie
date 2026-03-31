const MAX_IMAGE_DIMENSION = 2200;
const MAX_IMAGE_BYTES = 2_500_000;
const JPEG_QUALITIES = [0.88, 0.78, 0.68, 0.58];

export const ACCEPTED_EXPENSE_FILES = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/heic": [".heic"],
  "image/heif": [".heif"],
};

export interface PreparedExpenseUpload {
  file: File;
  previewUrl: string | null;
  displayName: string;
  originalName: string;
  originalSize: number;
  processedSize: number;
  mimeType: string;
  isImage: boolean;
  notes: string[];
}

function isPdfFile(file: File) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function isHeicFile(file: File) {
  return /image\/(heic|heif)/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

function isImageFile(file: File) {
  return file.type.startsWith("image/") || /\.(png|jpe?g|webp|heic|heif)$/i.test(file.name);
}

function renameFileExtension(name: string, extension: string) {
  return name.replace(/\.[^.]+$/, "") + extension;
}

function blobToFile(blob: Blob, name: string, mimeType: string) {
  return new File([blob], name, {
    type: mimeType,
    lastModified: Date.now(),
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("De foto kon niet worden geopend."));
    };

    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("De foto kon niet worden voorbereid voor upload."));
        return;
      }

      resolve(blob);
    }, mimeType, quality);
  });
}

async function convertHeicToJpeg(file: File) {
  const heic2any = (await import("heic2any")).default;
  const result = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.9,
  });

  const convertedBlob = Array.isArray(result) ? result[0] : result;
  return blobToFile(convertedBlob, renameFileExtension(file.name, ".jpg"), "image/jpeg");
}

async function optimizeImage(file: File): Promise<{ file: File; notes: string[] }> {
  const image = await loadImage(file);
  const notes: string[] = [];
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = longestSide > MAX_IMAGE_DIMENSION ? MAX_IMAGE_DIMENSION / longestSide : 1;
  const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale));
  const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale));

  if (scale < 1) {
    notes.push(`Foto verkleind naar ${targetWidth}x${targetHeight} voor snellere upload.`);
  }

  const outputMimeType = file.type === "image/png" ? "image/png" : "image/jpeg";

  if (scale === 1 && file.size <= MAX_IMAGE_BYTES && outputMimeType === file.type) {
    return { file, notes };
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("De foto kon niet worden voorbereid voor upload.");
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  let bestBlob: Blob;
  if (outputMimeType === "image/png") {
    bestBlob = await canvasToBlob(canvas, outputMimeType);
  } else {
    bestBlob = await canvasToBlob(canvas, outputMimeType, JPEG_QUALITIES[0]);
    for (const quality of JPEG_QUALITIES.slice(1)) {
      if (bestBlob.size <= MAX_IMAGE_BYTES) {
        break;
      }

      bestBlob = await canvasToBlob(canvas, outputMimeType, quality);
    }
  }

  const optimizedName = outputMimeType === "image/png"
    ? renameFileExtension(file.name, ".png")
    : renameFileExtension(file.name, ".jpg");
  const optimizedFile = blobToFile(bestBlob, optimizedName, outputMimeType);

  if (optimizedFile.size < file.size * 0.95) {
    notes.push("Foto gecomprimeerd voor snellere upload.");
  }

  if (optimizedFile.size >= file.size && scale === 1 && optimizedFile.type === file.type) {
    return { file, notes: notes.filter((note) => !note.includes("gecomprimeerd")) };
  }

  return { file: optimizedFile, notes };
}

export async function prepareExpenseUpload(file: File): Promise<PreparedExpenseUpload> {
  if (isPdfFile(file)) {
    return {
      file,
      previewUrl: null,
      displayName: file.name,
      originalName: file.name,
      originalSize: file.size,
      processedSize: file.size,
      mimeType: "application/pdf",
      isImage: false,
      notes: [],
    };
  }

  if (!isImageFile(file)) {
    throw new Error("Kies een PDF, JPG, PNG, WEBP of HEIC-bestand.");
  }

  let workingFile = file;
  const notes: string[] = [];

  if (isHeicFile(file)) {
    workingFile = await convertHeicToJpeg(file);
    notes.push("HEIC-foto omgezet naar JPG.");
  }

  const optimized = await optimizeImage(workingFile);
  workingFile = optimized.file;
  notes.push(...optimized.notes);

  return {
    file: workingFile,
    previewUrl: URL.createObjectURL(workingFile),
    displayName: workingFile.name,
    originalName: file.name,
    originalSize: file.size,
    processedSize: workingFile.size,
    mimeType: workingFile.type,
    isImage: true,
    notes,
  };
}

export function formatFileSize(sizeInBytes: number) {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  }

  const sizeInKb = sizeInBytes / 1024;
  if (sizeInKb < 1024) {
    return `${sizeInKb.toFixed(1)} KB`;
  }

  return `${(sizeInKb / 1024).toFixed(2)} MB`;
}