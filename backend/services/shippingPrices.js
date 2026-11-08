export const FREE_SHIPPING_LIMIT_IN_ORE = 500 * 100;

export const SHIPPING_METHODS = {
  service_point: { label: 'Hämta hos ombud', priceInOre: 59 * 100 },
  home: { label: 'Hemleverans', priceInOre: 99 * 100 },
};

export function shippingPriceInOre(method, subtotalInOre) {
  if (subtotalInOre >= FREE_SHIPPING_LIMIT_IN_ORE) {
    return 0;
  }
  return SHIPPING_METHODS[method].priceInOre;
}