/**
 * Client-side image size reducer. Before uploading, oversized photos are
 * downscaled to a sensible pixel size and re-encoded at high quality, which
 * cuts the file size (MB) dramatically with no visible quality loss.
 *
 * - JPEG sources    -> JPEG (quality 0.87)
 * - PNG/WebP with   -> WebP (keeps transparency; browsers that can't encode
 *   transparency       WebP fall back to PNG automatically via toBlob)
 * - Opaque PNG/WebP -> JPEG
 * - GIFs            -> untouched (re-encoding would kill animation)
 * - Small files     -> untouched (already light)
 * - Any failure     -> the original file is returned, so uploads never break.
 */
export async function compressImage(file, { maxDim = 2000, quality = 0.87, skipBelow = 300 * 1024 } = {}) {
  try {
    if (!file || !file.type?.startsWith('image/') || file.type === 'image/gif') return file
    if (file.size <= skipBelow) return file

    const url = URL.createObjectURL(file)
    try {
      const img = await new Promise((res, rej) => {
        const im = new Image()
        im.onload = () => res(im)
        im.onerror = () => rej(new Error('Could not read the image.'))
        im.src = url
      })

      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
      const w = Math.max(1, Math.round(img.naturalWidth * scale))
      const h = Math.max(1, Math.round(img.naturalHeight * scale))

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, w, h)

      // Transparent pixels? (JPEG would flatten them to black.) Sample a tiny
      // copy — cheap even for huge photos.
      let type = 'image/jpeg'
      if (file.type !== 'image/jpeg') {
        const s = document.createElement('canvas')
        s.width = s.height = 64
        const sc = s.getContext('2d')
        sc.drawImage(img, 0, 0, 64, 64)
        const d = sc.getImageData(0, 0, 64, 64).data
        for (let i = 3; i < d.length; i += 4) {
          if (d[i] < 250) {
            type = 'image/webp'
            break
          }
        }
      }

      const blob = await new Promise((res) => canvas.toBlob(res, type, quality))
      // Keep the original when compression didn't actually help.
      if (!blob || blob.size >= file.size) return file

      const ext = blob.type.includes('webp') ? 'webp' : blob.type.includes('png') ? 'png' : 'jpg'
      const base = (file.name || 'image').replace(/\.[^.]+$/, '')
      return new File([blob], `${base}.${ext}`, { type: blob.type })
    } finally {
      URL.revokeObjectURL(url)
    }
  } catch {
    return file
  }
}
