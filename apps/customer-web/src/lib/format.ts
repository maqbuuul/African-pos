export function formatMoney(amount: number, currency = 'KES'): string {
  return `${currency} ${amount.toLocaleString()}`
}
