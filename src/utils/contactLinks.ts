export function toWhatsappUrl(rawNumber: string): string {
  const digits = rawNumber.replace(/\D/g, '');
  const normalized = digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
  return `https://wa.me/${normalized}`;
}

export function toInstagramDmUrl(username: string): string {
  const handle = username.trim().replace(/^@/, '');
  return `https://ig.me/m/${handle}`;
}
