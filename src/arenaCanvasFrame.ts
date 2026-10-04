/** Publish only a complete frame; a failed contact must not erase the live stadium. */
export function presentArenaCanvasFrame<T>(canvas: HTMLCanvasElement, buffer: HTMLCanvasElement, width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => T): { ok: true; value: T } | { ok: false; error: unknown } {
  if (buffer.width !== width || buffer.height !== height) { buffer.width = width; buffer.height = height; }
  const ctx = buffer.getContext('2d');
  if (!ctx) return { ok: false, error: new Error('Arena frame context is unavailable') };
  try {
    ctx.save();
    const value = paint(ctx);
    ctx.restore();
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const target = canvas.getContext('2d');
    if (!target) throw new Error('Arena display context is unavailable');
    target.save(); target.setTransform(1, 0, 0, 1, 0, 0); target.globalAlpha = 1;
    target.globalCompositeOperation = 'copy'; target.drawImage(buffer, 0, 0); target.restore();
    return { ok: true, value };
  } catch (error) {
    // Reset leaked transforms/clips from an interrupted rig before retrying.
    buffer.width = width;
    return { ok: false, error };
  }
}
