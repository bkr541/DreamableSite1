// Safe to import from client code (no image libraries): which uploads can carry a watermark.
const WATERMARK_EXT = ['png', 'jpg', 'jpeg', 'pdf'];

export function canWatermarkName(fileName: string) {
  return WATERMARK_EXT.includes(fileName.split('.').pop()?.toLowerCase() ?? '');
}
