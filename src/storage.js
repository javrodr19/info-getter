/**
 * Storage Module
 * Handles JSON file operations for saving and loading scraping results
 */

import { writeFile, readFile, access } from 'fs/promises';
import { constants } from 'fs';

/**
 * Check if a file exists
 * @param {string} filepath - Path to the file
 * @returns {Promise<boolean>}
 */
async function fileExists(filepath) {
    try {
        await access(filepath, constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

/**
 * Load existing results from a JSON file
 * @param {string} filename - Path to the JSON file
 * @returns {Promise<Object|null>} - Parsed JSON data or null if file doesn't exist
 */
export async function loadExisting(filename) {
    try {
        if (!(await fileExists(filename))) {
            return null;
        }
        const content = await readFile(filename, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        console.error(`Error loading existing file: ${error.message}`);
        return null;
    }
}

/**
 * Save results to a JSON file
 * @param {Object} data - Data to save
 * @param {string} filename - Path to the JSON file
 * @returns {Promise<boolean>} - True if successful
 */
export async function saveResults(data, filename) {
    try {
        const jsonContent = JSON.stringify(data, null, 2);
        await writeFile(filename, jsonContent, 'utf-8');
        return true;
    } catch (error) {
        console.error(`Error saving results: ${error.message}`);
        return false;
    }
}

/**
 * Merge new results with existing results, avoiding duplicates
 * @param {Object|null} existing - Existing results object
 * @param {Object[]} newResults - Array of new result items
 * @returns {Object[]} - Merged and deduplicated results
 */
export function mergeResults(existing, newResults) {
    if (!existing || !existing.results) {
        return newResults;
    }

    // Create a Set of existing place IDs for fast lookup
    const existingIds = new Set(
        existing.results
            .filter(r => r.placeId)
            .map(r => r.placeId)
    );

    // Create a Set of existing names as fallback for places without IDs
    const existingNames = new Set(
        existing.results
            .filter(r => !r.placeId && r.name)
            .map(r => r.name.toLowerCase())
    );

    // Filter out duplicates from new results
    const uniqueNew = newResults.filter(item => {
        if (item.placeId) {
            return !existingIds.has(item.placeId);
        }
        if (item.name) {
            return !existingNames.has(item.name.toLowerCase());
        }
        return true;
    });

    // Combine existing and new results
    return [...existing.results, ...uniqueNew];
}

/**
 * Create a results object with metadata
 * @param {string} query - Search query used
 * @param {string} location - Location searched
 * @param {Object[]} results - Array of result items
 * @returns {Object} - Complete results object with metadata
 */
export function createResultsObject(query, location, results) {
    return {
        scrapedAt: new Date().toISOString(),
        query,
        location,
        totalFound: results.length,
        results,
    };
}

/**
 * Append a single result to an existing file (for streaming saves)
 * @param {Object} result - Single result to append
 * @param {string} filename - Path to the JSON file
 * @param {string} query - Search query
 * @param {string} location - Search location
 * @returns {Promise<boolean>}
 */
export async function appendResult(result, filename, query, location) {
    try {
        const existing = await loadExisting(filename);

        if (existing) {
            // Append to existing results
            existing.results.push(result);
            existing.totalFound = existing.results.length;
            existing.lastUpdated = new Date().toISOString();
            return await saveResults(existing, filename);
        } else {
            // Create new file with single result
            const data = createResultsObject(query, location, [result]);
            return await saveResults(data, filename);
        }
    } catch (error) {
        console.error(`Error appending result: ${error.message}`);
        return false;
    }
}
