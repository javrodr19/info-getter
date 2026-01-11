/**
 * Geographic Subdivision Module
 * Breaks down wide area searches into smaller regions to get more results
 */

// Food & drink establishment categories
export const FOOD_DRINK_CATEGORIES = [
    'restaurants',
    'bars',
    'pubs',
    'cafes',
    'coffee shops',
    'bistros',
    'taverns',
    'diners',
    'eateries',
    'tapas bars',
    'wine bars',
    'cocktail bars',
    'breweries',
    'food trucks',
    'pizzerias',
    'fast food',
    'takeaway',
    'bakeries',
    'ice cream shops',
    'juice bars',
];

/**
 * Generate grid-based sub-locations for a given location
 * Uses compass directions and district naming to create sub-searches
 * @param {string} location - Main location (e.g., "Madrid, Spain")
 * @returns {string[]} - Array of sub-location search terms
 */
export function subdivideLocation(location) {
    // Extract city/region name from location
    const parts = location.split(',').map(p => p.trim());
    const mainArea = parts[0];
    const country = parts.slice(1).join(', ');

    // Generate sub-regions using different strategies
    const subLocations = [];

    // 1. Cardinal directions
    const directions = ['North', 'South', 'East', 'West', 'Central'];
    directions.forEach(dir => {
        subLocations.push(`${dir} ${mainArea}${country ? ', ' + country : ''}`);
    });

    // 2. Common district/area suffixes
    const areaSuffixes = [
        'downtown', 'old town', 'city center', 'historic center',
        'business district', 'commercial area', 'industrial area',
        'residential area', 'suburbs', 'outskirts'
    ];
    areaSuffixes.forEach(suffix => {
        subLocations.push(`${mainArea} ${suffix}${country ? ', ' + country : ''}`);
    });

    // 3. Nearby + location for peripheral areas
    subLocations.push(`near ${mainArea}${country ? ', ' + country : ''}`);

    // Add the original location as well
    subLocations.unshift(location);

    return subLocations;
}

/**
 * Generate numbered zone searches for very large areas
 * @param {string} location - Main location
 * @param {number} zones - Number of zones to create
 * @returns {string[]} - Array of zone-based search terms
 */
export function generateZoneSearches(location, zones = 10) {
    const parts = location.split(',').map(p => p.trim());
    const mainArea = parts[0];
    const country = parts.slice(1).join(', ');

    const searches = [location]; // Start with main location

    // Add district numbers (many cities have numbered districts)
    for (let i = 1; i <= zones; i++) {
        searches.push(`${mainArea} district ${i}${country ? ', ' + country : ''}`);
        searches.push(`${mainArea} zone ${i}${country ? ', ' + country : ''}`);
    }

    // Add postal code style searches (generic)
    for (let i = 1; i <= Math.min(zones, 5); i++) {
        searches.push(`${mainArea} area ${i}${country ? ', ' + country : ''}`);
    }

    return searches;
}

/**
 * Smart subdivision that combines multiple strategies
 * Now focused on restaurants, bars, pubs, and related establishments
 * @param {string} location - Main location
 * @param {Object} options - Subdivision options
 * @returns {string[]} - Array of all sub-location search terms
 */
export function smartSubdivide(location, options = {}) {
    const {
        includeDirections = true,
        includeDistricts = true,
        includeZones = false,
        zoneCount = 5,
        categories = FOOD_DRINK_CATEGORIES
    } = options;

    const allSearches = new Set();

    // Get all location variations
    const locations = [location];

    if (includeDirections || includeDistricts) {
        subdivideLocation(location).forEach(s => locations.push(s));
    }

    if (includeZones) {
        generateZoneSearches(location, zoneCount).forEach(s => locations.push(s));
    }

    // Combine each category with each location
    for (const loc of locations) {
        for (const category of categories) {
            allSearches.add(`${category} in ${loc}`);
        }
    }

    return [...allSearches];
}

export default { subdivideLocation, generateZoneSearches, smartSubdivide, FOOD_DRINK_CATEGORIES };

