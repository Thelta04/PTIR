/**
 * Fetches a human-readable address from coordinates using Nominatim Reverse Geocoding.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<string>} - The formatted address or a fallback string.
 */
export async function getAddressFromCoords(lat, lon) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
      {
        headers: {
          'Accept-Language': 'en', // Prefer English addresses
        },
      }
    );
    if (!response.ok) throw new Error('Geocoding request failed');
    
    const data = await response.json();
    
    // Nominatim returns a 'display_name' which is usually the full address.
    // We can also construct a shorter version if preferred.
    return data.display_name || `Lat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}`;
  } catch (error) {
    console.error('Error in reverse geocoding:', error);
    return `Lat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}`;
  }
}

/**
 * Fetches coordinates from a human-readable address using Nominatim Geocoding.
 * @param {string} address - The address to search for.
 * @returns {Promise<{lat: number, lon: number} | null>} - The coordinates or null.
 */
export async function getCoordsFromAddress(address) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(address)}`,
      {
        headers: {
          'Accept-Language': 'en',
        },
      }
    );
    if (!response.ok) throw new Error('Geocoding request failed');
    
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        display_name: data[0].display_name
      };
    }
    return null;
  } catch (error) {
    console.error('Error in forward geocoding:', error);
    return null;
  }
}
