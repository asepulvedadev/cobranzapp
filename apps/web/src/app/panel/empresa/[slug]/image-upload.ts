const browserReadyImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

type DrawableImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

async function loadDrawableImage(file: File): Promise<DrawableImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // iOS can decode some camera formats through an HTML image even when
      // createImageBitmap cannot. Fall through to the native image decoder.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("IMAGE_PROCESSING_UNAVAILABLE"));
      image.src = objectUrl;
    });
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error("IMAGE_PROCESSING_UNAVAILABLE");
    }
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

export async function prepareImageUpload(file: File) {
  if (file.size <= 2_400_000 && browserReadyImageTypes.has(file.type)) return file;

  const image = await loadDrawableImage(file);
  try {
    const scale = Math.min(1, 1800 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("IMAGE_PROCESSING_UNAVAILABLE");
    context.drawImage(image.source, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.86),
    );
    if (!blob) throw new Error("IMAGE_PROCESSING_UNAVAILABLE");
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "imagen"}.jpg`, {
      type: "image/jpeg",
    });
  } finally {
    image.release();
  }
}

export function prepareImageOrPdfUpload(file: File) {
  return file.type === "application/pdf" ? Promise.resolve(file) : prepareImageUpload(file);
}
