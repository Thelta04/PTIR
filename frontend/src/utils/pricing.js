/**
 * Calculates the estimated price of a trip based on minutes and comfort level.
 * Mirrors the backend's calculate_price logic.
 */
export function calculateEstimatedPrice(minutes, comfortLevel, pricingConfig) {
  if (!pricingConfig) return 0;

  const perMin = comfortLevel === 'luxury' 
    ? pricingConfig.price_per_min_luxury 
    : pricingConfig.price_per_min_basic;

  let price = minutes * perMin;

  // Quick estimate: apply the configured night surcharge when the trip starts at night.
  // The backend splits exact day/night minutes when it has start and end times.
  const hour = new Date().getHours();
  if (hour >= 21 || hour < 6) {
    price *= 1 + ((Number(pricingConfig.night_surcharge_percent) || 0) / 100);
  }
  
  return Number(price.toFixed(2));
}
