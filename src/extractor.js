/**
 * Place Details Extractor
 * Extracts contact information and business details from Google Maps place pages
 */

// CSS Selectors for Google Maps elements (may need updates if Google changes their UI)
export const SELECTORS = {
    // Search results - multiple fallback selectors
    searchResultsContainer: [
        'div[role="feed"]',
        'div[aria-label*="Results"]',
        'div.section-layout',
        '#pane div[role="region"]',
    ],
    searchResultItem: 'div[role="feed"] > div > div[jsaction]',
    searchResultLink: 'a[href*="/maps/place/"]',

    // Place details panel
    placeName: 'h1',
    placeAddress: 'button[data-item-id="address"]',
    placePhone: 'button[data-item-id^="phone:"]',
    placeWebsite: 'a[data-item-id="authority"]',

    // Alternative selectors
    phoneAlt: '[data-tooltip="Copy phone number"]',
    websiteAlt: '[data-tooltip="Open website"]',
    addressAlt: '[data-tooltip="Copy address"]',
};

// Phone number regex patterns for various formats
const PHONE_PATTERNS = [
    /\+?\d{1,4}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
    /\(\d{3}\)\s*\d{3}[-.\s]?\d{4}/g,
    /\d{3}[-.\s]\d{3}[-.\s]\d{4}/g,
];

// Email regex pattern
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Extract phone number from text
 * @param {string} text - Text to search for phone numbers
 * @returns {string|null} - First valid phone number found or null
 */
export function extractPhone(text) {
    if (!text) return null;

    for (const pattern of PHONE_PATTERNS) {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
            // Clean up the phone number
            const phone = matches[0].trim();
            // Validate it has enough digits (at least 7)
            const digits = phone.replace(/\D/g, '');
            if (digits.length >= 7) {
                return phone;
            }
        }
    }
    return null;
}

/**
 * Extract email addresses from text
 * @param {string} text - Text to search for emails
 * @returns {string[]} - Array of email addresses found
 */
export function extractEmails(text) {
    if (!text) return [];

    const matches = text.match(EMAIL_PATTERN);
    if (!matches) return [];

    // Filter out common false positives
    const filtered = matches.filter(email => {
        const lower = email.toLowerCase();
        // Exclude common non-business emails
        if (lower.includes('example.com')) return false;
        if (lower.includes('google.com')) return false;
        if (lower.includes('gstatic.com')) return false;
        if (lower.includes('googleapis.com')) return false;
        return true;
    });

    // Return unique emails
    return [...new Set(filtered)];
}

/**
 * Extract place details from a Google Maps page
 * @param {import('playwright').Page} page - Playwright page object
 * @returns {Promise<Object>} - Extracted place details
 */
export async function extractPlaceDetails(page) {
    const details = {
        name: null,
        address: null,
        phone: null,
        emails: [],
        hasWebsite: false,
        placeId: null,
        isActive: true, // Assume active unless we find evidence otherwise
    };

    try {
        // Extract place ID from URL
        const url = page.url();
        const placeIdMatch = url.match(/place\/([^/]+)/);
        if (placeIdMatch) {
            details.placeId = decodeURIComponent(placeIdMatch[1]).split('/')[0];
        }

        // Wait for the place panel to load
        await page.waitForSelector('h1', { timeout: 5000 }).catch(() => { });

        // Extract name
        const nameEl = await page.$('h1');
        if (nameEl) {
            details.name = await nameEl.textContent();
            details.name = details.name?.trim() || null;
        }

        // Check if business is closed/inactive
        const pageText = await page.evaluate(() => document.body.textContent);
        const closedIndicators = [
            'permanently closed',
            'cerrado permanentemente',
            'temporarily closed',
            'cerrado temporalmente',
            'business has closed',
            'no longer in business',
            'this place is closed',
        ];
        const lowerPageText = pageText.toLowerCase();
        for (const indicator of closedIndicators) {
            if (lowerPageText.includes(indicator)) {
                details.isActive = false;
                break;
            }
        }

        // Extract phone - try multiple selectors
        const phoneEl = await page.$(SELECTORS.placePhone) || await page.$(SELECTORS.phoneAlt);
        if (phoneEl) {
            const phoneText = await phoneEl.textContent();
            details.phone = extractPhone(phoneText);
        }

        // If no phone found via button, try looking in the entire panel
        if (!details.phone) {
            const panelText = await page.evaluate(() => {
                const panel = document.querySelector('[role="main"]');
                return panel ? panel.textContent : '';
            });
            details.phone = extractPhone(panelText);
        }

        // Extract address
        const addressEl = await page.$(SELECTORS.placeAddress) || await page.$(SELECTORS.addressAlt);
        if (addressEl) {
            const addressText = await addressEl.textContent();
            details.address = addressText?.trim() || null;
        }

        // Check for website
        const websiteEl = await page.$(SELECTORS.placeWebsite) || await page.$(SELECTORS.websiteAlt);
        details.hasWebsite = websiteEl !== null;

        // Try to extract emails from the page content
        details.emails = extractEmails(pageText);

    } catch (error) {
        console.error('Error extracting place details:', error.message);
    }

    return details;
}

/**
 * Extract all place links from search results
 * @param {import('playwright').Page} page - Playwright page object
 * @returns {Promise<string[]>} - Array of place URLs
 */
export async function extractPlaceLinks(page) {
    const links = await page.evaluate((selector) => {
        const elements = document.querySelectorAll(selector);
        const urls = [];
        elements.forEach(el => {
            const href = el.getAttribute('href');
            if (href && href.includes('/maps/place/')) {
                urls.push(href);
            }
        });
        return [...new Set(urls)]; // Deduplicate
    }, SELECTORS.searchResultLink);

    return links;
}
