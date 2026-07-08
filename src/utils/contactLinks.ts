export function formatPhoneNumber(rawNumber: string): string {
  const digits = rawNumber.replace(/\D/g, '');
  if (digits.length <= 4) return digits;

  const groups = [digits.slice(0, 4)];
  for (let i = 4; i < digits.length; i += 4) {
    groups.push(digits.slice(i, i + 4));
  }
  return groups.join('-');
}

export function toWhatsappUrl(rawNumber: string): string {
  const digits = rawNumber.replace(/\D/g, '');
  const normalized = digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
  return `https://wa.me/${normalized}`;
}

export function toInstagramDmUrl(username: string): string {
  const handle = username.trim().replace(/^@/, '');
  return `https://ig.me/m/${handle}`;
}
