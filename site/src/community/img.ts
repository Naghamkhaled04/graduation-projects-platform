/** يضغط صورة بالمتصفح قبل الرفع: أطول ضلع ≤ max، JPEG */
export async function compress(file: File, max = 1280, quality = 0.82): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('الصورة لازم تكون JPG أو PNG أو WebP');
  if (file.size > 12 * 1024 * 1024) throw new Error('الصورة كبيرة جداً');
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}
export const dataUrlToBlob = async (u: string) => (await fetch(u)).blob();
