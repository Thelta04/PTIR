/**
 * Calculates the estimated price of a trip based on minutes and comfort level.
 * Mirrors the backend's calculate_price logic.
 */
export function calculateEstimatedPrice(minutes, comfortLevel, pricingConfig) {
  if (!pricingConfig) return 0;

  const perMin = comfortLevel === 'luxury' 
    ? pricingConfig.price_per_min_luxury 
    : pricingConfig.price_per_min_basic;
  
  let price = pricingConfig.base_fare + (minutes * perMin);
  
  // Apply night multiplier if between 22:00 and 07:00 (matching backend is_night_period)
  const hour = new Date().getHours();
  if (hour >= 22 || hour < 7) {
    price *= 1.25; // NIGHT_MULTIPLIER from backend
  }
  
  return Number(price.toFixed(2));
}
