export function yearOf(dateString: string | null | undefined): number | null {
  if (!dateString) return null;
  const match = /^(\d{4})/.exec(dateString);
  return match ? Number(match[1]) : null;
}

export function formatRuntime(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) return '';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0
    ? `${hours}h ${mins.toString().padStart(2, '0')}m`
    : `${mins}m`;
}

export function formatDate(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(value: string): string {
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

export function fileName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] ?? path;
}

export function shortPath(path: string, max = 48): string {
  if (path.length <= max) return path;
  return `…${path.slice(-(max - 1))}`;
}
