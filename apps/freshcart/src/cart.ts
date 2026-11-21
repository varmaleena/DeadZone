export interface CartItem {
  name: string;
  unitCents: number;
  quantity: number;
}
const key = 'freshcart-cart';
export function readCart(): CartItem[] {
  try {
    const cart = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(cart)
      ? cart.filter(
          (i) =>
            typeof i.name === 'string' &&
            Number.isInteger(i.quantity) &&
            i.quantity > 0 &&
            Number.isInteger(i.unitCents) &&
            i.unitCents >= 0,
        )
      : [];
  } catch {
    return [];
  }
}
export function setQuantity(name: string, unitCents: number, quantity: number) {
  const cart = readCart().filter((i) => i.name !== name);
  if (quantity > 0) cart.push({ name, unitCents, quantity: Math.min(99, quantity) });
  localStorage.setItem(key, JSON.stringify(cart));
}
export function addItem(name: string, unitCents: number) {
  setQuantity(name, unitCents, (readCart().find((i) => i.name === name)?.quantity || 0) + 1);
}
export const cartTotal = (cart = readCart()) => cart.reduce((sum, i) => sum + i.unitCents * i.quantity, 0);
export const money = (cents: number) => '$' + (cents / 100).toFixed(2);

/** Empties the basket after an order has been saved. */
export function clearCart() {
  localStorage.removeItem(key);
}
