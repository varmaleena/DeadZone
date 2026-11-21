async function load(base64: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = `data:image/jpeg;base64,${base64}`;
  await image.decode();
  return image;
}

/** Downscales a screenshot to a thumbnail that fits the Firestore size budget. */
export async function compress(base64: string, maxBytes = 120 * 1024, width = 480): Promise<string> {
  const image = await load(base64);
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(width, image.width);
  canvas.height = Math.round((image.height * canvas.width) / image.width);
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
  // Base64 is ~4/3 the byte size; lower quality until it fits.
  for (const quality of [0.6, 0.45, 0.3]) {
    const output = canvas.toDataURL('image/jpeg', quality).split(',')[1];
    if ((output.length * 3) / 4 <= maxBytes) return output;
  }
  throw new Error('Screenshot thumbnail is over the size limit even at low quality.');
}

/** Places the online (left) and offline (right) screenshots side by side for one model call. */
export async function pairImage(left: string, right: string): Promise<string> {
  const parts = await Promise.all([load(left), load(right)]);
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = Math.max(...parts.map((p) => Math.round((p.height * 480) / p.width)));
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  parts.forEach((p, i) => context.drawImage(p, i * 480, 0, 480, (p.height * 480) / p.width));
  return canvas.toDataURL('image/jpeg', 0.65).split(',')[1];
}
