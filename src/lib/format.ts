export const rupiah = (value: number) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(value);

export const shortDate = (value: string) => new Intl.DateTimeFormat('id-ID', {
  day: '2-digit', month: 'short', year: 'numeric',
}).format(new Date(value));

export const orderChannelLabel = (channel?: string | null) => {
  switch (channel) {
    case 'qris': return 'QRIS';
    case 'whatsapp': return 'WhatsApp';
    case 'manual': return 'Manual';
    case 'midtrans': return 'Midtrans';
    default: return channel || '—';
  }
};

export const formatBytes = (bytes?: number | null) => {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1; }
  return `${size.toFixed(index ? 1 : 0)} ${units[index]}`;
};
