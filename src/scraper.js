/**
 * Google Maps Scraper
 * Core scraping engine using Playwright for browser automation
 */

import { chromium } from 'playwright';
import { extractPlaceDetails, extractPlaceLinks, SELECTORS } from './extractor.js';

const GOOGLE_MAPS_URL = 'https://www.google.com/maps';

/**
 * Main scraper class for Google Maps
 */
export class GoogleMapsScraper {
    /**
     * @param {Object} options - Scraper configuration
     * @param {number} options.concurrency - Number of parallel page loads
     * @param {boolean} options.headless - Run browser in headless mode
     * @param {Function} options.onProgress - Progress callback
     * @param {Function} options.onResult - Called when a result is found
     */
    constructor(options = {}) {
        this.concurrency = options.concurrency || 5;
        this.headless = options.headless ?? true;
        this.onProgress = options.onProgress || (() => { });
        this.onResult = options.onResult || (() => { });
        this.browser = null;
        this.context = null;
        this.checkedNames = new Set(); // Track already checked place names
    }

    /**
     * Launch browser with optimized settings
     */
    async launch() {
        this.browser = await chromium.launch({
            headless: this.headless,
        });

        this.context = await this.browser.newContext({
            viewport: { width: 1280, height: 720 },
            locale: 'en-US',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });

        // Block unnecessary resources for speed
        await this.context.route('**/*', (route) => {
            const resourceType = route.request().resourceType();
            const blockedTypes = ['image', 'media', 'font', 'stylesheet'];

            if (blockedTypes.includes(resourceType)) {
                route.abort();
            } else {
                route.continue();
            }
        });
    }

    /**
     * Close browser
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.context = null;
        }
    }

    /**
     * Accept cookies/consent dialog if present
     */
    async acceptCookies(page) {
        try {
            // Wait a bit for consent dialog to appear
            await page.waitForTimeout(2000);

            // Try multiple consent button selectors (different languages)
            const consentSelectors = [
                'button:has-text("Accept all")',
                'button:has-text("Aceptar todo")',
                'button:has-text("Acepto")',
                'button:has-text("Agree")',
                'button:has-text("I agree")',
                'form[action*="consent"] button',
                '[aria-label*="Accept"]',
                '[aria-label*="Aceptar"]',
            ];

            for (const selector of consentSelectors) {
                const button = await page.$(selector);
                if (button) {
                    await button.click();
                    await page.waitForTimeout(2000);
                    break;
                }
            }
        } catch {
            // Cookies dialog not present or already accepted
        }
    }

    /**
     * Search for places on Google Maps
     * @param {string} query - Search query (e.g., "restaurants"), empty for all types
     * @param {string} location - Location to search in
     * @returns {Promise<string[]>} - Array of place URLs
     */
    async searchPlaces(query, location) {
        const page = await this.context.newPage();
        // Use "businesses" as a catch-all term when no specific query is provided
        const searchTerm = query && query.trim() ? query : 'businesses';
        const searchQuery = `${searchTerm} in ${location}`;

        try {
            this.onProgress(`Searching for "${query ? searchQuery : `all establishments in ${location}`}"...`);

            // Navigate to Google Maps
            await page.goto(GOOGLE_MAPS_URL, { waitUntil: 'networkidle', timeout: 30000 });
            await this.acceptCookies(page);

            // Wait for page to stabilize after consent
            await page.waitForTimeout(2000);

            // If we're still on a consent page, try navigating again
            if (page.url().includes('consent.google')) {
                await page.goto(GOOGLE_MAPS_URL, { waitUntil: 'networkidle', timeout: 30000 });
                await page.waitForTimeout(2000);
            }

            // Try multiple search box selectors
            const searchSelectors = [
                'input#searchboxinput',
                'input[name="q"]',
                'input[aria-label*="Search"]',
                'input[aria-label*="Buscar"]',
                '#searchbox input',
                'input.searchboxinput',
            ];

            let searchBox = null;
            for (const selector of searchSelectors) {
                searchBox = await page.$(selector);
                if (searchBox) break;
            }

            if (!searchBox) {
                throw new Error('Could not find search box. The page may have changed or consent was not accepted.');
            }

            await searchBox.fill(searchQuery);
            await searchBox.press('Enter');

            // Wait for results to load - try multiple selectors
            let foundResultsContainer = false;
            const containerSelectors = Array.isArray(SELECTORS.searchResultsContainer)
                ? SELECTORS.searchResultsContainer
                : [SELECTORS.searchResultsContainer];

            for (const selector of containerSelectors) {
                try {
                    await page.waitForSelector(selector, { timeout: 5000 });
                    foundResultsContainer = true;
                    this.activeResultsSelector = selector;
                    break;
                } catch {
                    continue;
                }
            }

            if (!foundResultsContainer) {
                // Wait a bit more and check for any place links directly
                await page.waitForTimeout(3000);
            }

            await page.waitForTimeout(2000); // Allow initial results to render

            // Scroll to load more results
            this.onProgress('Loading all results...');
            await this.scrollResults(page);

            // Extract place links
            const links = await extractPlaceLinks(page);
            this.onProgress(`Found ${links.length} places to check`);

            return links;
        } finally {
            await page.close();
        }
    }

    /**
     * Scroll through search results to load all items
     */
    async scrollResults(page, maxScrolls = 50000) {
        // Find the right selector
        const containerSelectors = Array.isArray(SELECTORS.searchResultsContainer)
            ? SELECTORS.searchResultsContainer
            : [SELECTORS.searchResultsContainer];

        let activeSelector = this.activeResultsSelector;
        if (!activeSelector) {
            for (const selector of containerSelectors) {
                const el = await page.$(selector);
                if (el) {
                    activeSelector = selector;
                    break;
                }
            }
        }

        if (!activeSelector) return;

        let previousHeight = 0;
        let scrollCount = 0;
        let noChangeCount = 0;

        while (scrollCount < maxScrolls && noChangeCount < 3) {
            // Scroll the results container
            const currentHeight = await page.evaluate((selector) => {
                const el = document.querySelector(selector);
                if (el) {
                    el.scrollTop = el.scrollHeight;
                    return el.scrollHeight;
                }
                return 0;
            }, activeSelector);

            await page.waitForTimeout(1500);

            if (currentHeight === previousHeight) {
                noChangeCount++;
            } else {
                noChangeCount = 0;
            }

            previousHeight = currentHeight;
            scrollCount++;
        }
    }

    /**
     * Get details for a single place
     * @param {string} placeUrl - URL of the place
     * @returns {Promise<Object|null>} - Place details or null if has website/inactive/duplicate
     */
    async getPlaceDetails(placeUrl) {
        const page = await this.context.newPage();

        try {
            // Navigate to place page
            const fullUrl = placeUrl.startsWith('http')
                ? placeUrl
                : `https://www.google.com${placeUrl}`;

            await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(1500); // Wait for dynamic content

            // Extract details
            const details = await extractPlaceDetails(page);

            // Skip if name already checked
            if (details.name) {
                const nameLower = details.name.toLowerCase();
                if (this.checkedNames.has(nameLower)) {
                    return null; // Already processed this name
                }
                this.checkedNames.add(nameLower);
            }

            // Only return if place has no website AND is active
            if (!details.hasWebsite && details.name && details.isActive) {
                // Search for business email if no email found on Maps page
                if (!details.emails || details.emails.length === 0) {
                    const foundEmail = await this.searchEmailForBusiness(details.name, details.address);
                    if (foundEmail) {
                        details.emails = [foundEmail];
                    }
                }
                return details;
            }

            return null;
        } catch (error) {
            console.error(`Error getting place details: ${error.message}`);
            return null;
        } finally {
            await page.close();
        }
    }

    /**
     * Search for a business email using DuckDuckGo (doesn't block bots)
     * @param {string} businessName - Name of the business
     * @param {string} address - Address for context
     * @returns {Promise<string|null>} - Email found or null
     */
    async searchEmailForBusiness(businessName, address) {
        const page = await this.context.newPage();

        try {
            // Build search query - simpler is better
            const city = address ? address.split(',').slice(-2, -1)[0]?.trim() : '';
            const searchQuery = `${businessName} ${city} email`;

            // Use DuckDuckGo HTML version (no JavaScript needed, no blocking)
            const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 15000
            });

            await page.waitForTimeout(1500);

            // Get all text content including from links
            const pageContent = await page.evaluate(() => {
                // Get visible text
                let text = document.body.innerText || '';

                // Also get href attributes which might contain mailto links
                const links = document.querySelectorAll('a[href]');
                links.forEach(link => {
                    const href = link.getAttribute('href') || '';
                    if (href.includes('mailto:') || href.includes('@')) {
                        text += ' ' + href;
                    }
                });

                return text;
            });

            // Find email patterns
            const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
            const matches = pageContent.match(emailPattern);

            if (matches && matches.length > 0) {
                // Filter out false positives
                const blacklist = [
                    'example.com', 'google.com', 'gstatic.com', 'googleapis.com',
                    'schema.org', 'w3.org', 'facebook.com', 'twitter.com',
                    'duckduckgo.com', 'bing.com', 'yahoo.com', 'microsoft.com',
                    'apple.com', 'amazon.com', 'instagram.com', 'linkedin.com',
                    'youtube.com', 'whatsapp.com', 'tripadvisor.com'
                ];

                const validEmails = matches.filter(email => {
                    const lower = email.toLowerCase();
                    return !blacklist.some(domain => lower.includes(domain));
                });

                // Prefer gmail addresses
                const gmail = validEmails.find(e => e.toLowerCase().includes('gmail.com'));
                if (gmail) return gmail;

                // Otherwise return first valid email
                if (validEmails.length > 0) {
                    return validEmails[0];
                }
            }

            return null;
        } catch (error) {
            // Silently fail - email search is optional
            return null;
        } finally {
            await page.close();
        }
    }

    /**
     * Process places in parallel with concurrency limit
     * @param {string[]} placeUrls - Array of place URLs to process
     * @returns {Promise<Object[]>} - Array of place details without websites
     */
    async processPlaces(placeUrls) {
        const results = [];
        const queue = [...placeUrls];
        let processed = 0;
        const total = placeUrls.length;

        // Worker function
        const worker = async () => {
            while (queue.length > 0) {
                const url = queue.shift();
                if (!url) break;

                const details = await this.getPlaceDetails(url);
                processed++;

                if (details) {
                    results.push(details);
                    this.onResult(details);
                }

                this.onProgress(`Processing: ${processed}/${total} (found ${results.length} without websites)`);
            }
        };

        // Create worker pool
        const workers = Array(Math.min(this.concurrency, queue.length))
            .fill(null)
            .map(() => worker());

        await Promise.all(workers);

        return results;
    }

    /**
     * Main scraping function
     * @param {string} query - Search query
     * @param {string} location - Location to search
     * @returns {Promise<Object[]>} - Array of places without websites
     */
    async scrape(query, location) {
        try {
            await this.launch();

            // Search and get all place links
            const placeUrls = await this.searchPlaces(query, location);

            if (placeUrls.length === 0) {
                this.onProgress('No places found for this search');
                return [];
            }

            // Process all places
            const results = await this.processPlaces(placeUrls);

            return results;
        } finally {
            await this.close();
        }
    }

    /**
     * Scrape with automatic area subdivision for more results
     * Now handles full search queries like "restaurants in North Madrid"
     * @param {string} query - Search query (ignored when using subdivided queries)
     * @param {string} location - Main location (for reference)
     * @param {string[]} subQueries - Array of full search queries to run
     * @returns {Promise<Object[]>} - Deduplicated array of places without websites
     */
    async scrapeWithSubdivision(query, location, subQueries) {
        const allResults = new Map(); // Use Map for deduplication by placeId/name

        try {
            await this.launch();

            for (let i = 0; i < subQueries.length; i++) {
                const searchQuery = subQueries[i];
                this.onProgress(`[${i + 1}/${subQueries.length}] ${searchQuery}`);

                try {
                    // Search using the full query directly
                    const placeUrls = await this.searchPlacesDirect(searchQuery);

                    if (placeUrls.length > 0) {
                        this.onProgress(`[${i + 1}/${subQueries.length}] Found ${placeUrls.length} places`);

                        // Process places from this search
                        const results = await this.processPlaces(placeUrls);

                        // Add to map, deduplicating by placeId or name
                        for (const result of results) {
                            const key = result.placeId || result.name?.toLowerCase();
                            if (key && !allResults.has(key)) {
                                allResults.set(key, result);
                            }
                        }

                        this.onProgress(`[${i + 1}/${subQueries.length}] Total unique: ${allResults.size}`);
                    }
                } catch (error) {
                    this.onProgress(`[${i + 1}/${subQueries.length}] Error: ${error.message}`);
                    // Continue with next query
                }

                // Small delay between searches to be gentle
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            return [...allResults.values()];
        } finally {
            await this.close();
        }
    }

    /**
     * Search places using a direct query string
     * @param {string} searchQuery - Full search query (e.g., "restaurants in Madrid")
     * @returns {Promise<string[]>} - Array of place URLs
     */
    async searchPlacesDirect(searchQuery) {
        const page = await this.context.newPage();

        try {
            // Navigate to Google Maps
            await page.goto(GOOGLE_MAPS_URL, { waitUntil: 'networkidle', timeout: 30000 });
            await this.acceptCookies(page);
            await page.waitForTimeout(2000);

            // Handle consent redirect
            if (page.url().includes('consent.google')) {
                await page.goto(GOOGLE_MAPS_URL, { waitUntil: 'networkidle', timeout: 30000 });
                await page.waitForTimeout(2000);
            }

            // Find search box
            const searchSelectors = [
                'input#searchboxinput',
                'input[name="q"]',
                'input[aria-label*="Search"]',
                'input[aria-label*="Buscar"]',
            ];

            let searchBox = null;
            for (const selector of searchSelectors) {
                searchBox = await page.$(selector);
                if (searchBox) break;
            }

            if (!searchBox) {
                throw new Error('Could not find search box');
            }

            await searchBox.fill(searchQuery);
            await searchBox.press('Enter');

            // Wait for results
            const containerSelectors = Array.isArray(SELECTORS.searchResultsContainer)
                ? SELECTORS.searchResultsContainer
                : [SELECTORS.searchResultsContainer];

            for (const selector of containerSelectors) {
                try {
                    await page.waitForSelector(selector, { timeout: 5000 });
                    this.activeResultsSelector = selector;
                    break;
                } catch { continue; }
            }

            await page.waitForTimeout(2000);
            await this.scrollResults(page);

            return await extractPlaceLinks(page);
        } finally {
            await page.close();
        }
    }
}

export default GoogleMapsScraper;
