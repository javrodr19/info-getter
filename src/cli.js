#!/usr/bin/env node

/**
 * Google Maps Bot CLI
 * Command-line interface for the Google Maps scraper
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { GoogleMapsScraper } from './scraper.js';
import { saveResults, loadExisting, mergeResults, createResultsObject, appendResult } from './storage.js';
import { smartSubdivide } from './subdivide.js';

const program = new Command();

program
    .name('google-maps-bot')
    .description('Find Google Maps establishments without websites')
    .version('1.0.0')
    .option('-q, --query <type>', 'Type of establishment (e.g., "restaurants"). Omit for ALL types', '')
    .requiredOption('-l, --location <area>', 'Geographic area to search (e.g., "Madrid, Spain")')
    .option('-o, --output <filename>', 'Output JSON filename', 'results.json')
    .option('-c, --concurrency <number>', 'Number of parallel page loads', '10')
    .option('-s, --subdivide', 'Split area into sub-regions for more results')
    .option('--no-headless', 'Show browser window (for debugging)')
    .parse(process.argv);

const options = program.opts();

async function main() {
    console.log(chalk.bold.blue('\n🗺️  Google Maps Bot\n'));
    console.log(chalk.gray('Finding establishments without websites...\n'));

    console.log(chalk.white('Search Query:'), chalk.cyan(options.query || 'All establishments'));
    console.log(chalk.white('Location:    '), chalk.cyan(options.location));
    console.log(chalk.white('Output File: '), chalk.cyan(options.output));
    console.log(chalk.white('Concurrency: '), chalk.cyan(options.concurrency));
    console.log(chalk.white('Subdivide:   '), chalk.cyan(options.subdivide ? 'Yes (multi-region)' : 'No'));
    console.log(chalk.white('Headless:    '), chalk.cyan(options.headless ? 'Yes' : 'No'));
    console.log();

    // Generate sub-locations if subdivide is enabled
    let subLocations = null;
    if (options.subdivide) {
        subLocations = smartSubdivide(options.location);
        console.log(chalk.yellow(`📍 Will search ${subLocations.length} sub-regions:\n`));
        subLocations.slice(0, 5).forEach((loc, i) => {
            console.log(chalk.gray(`   ${i + 1}. ${loc}`));
        });
        if (subLocations.length > 5) {
            console.log(chalk.gray(`   ... and ${subLocations.length - 5} more\n`));
        }
        console.log();
    }

    const spinner = ora('Initializing scraper...').start();
    const startTime = Date.now();

    // Track results found during scraping
    const foundResults = [];

    const scraper = new GoogleMapsScraper({
        concurrency: parseInt(options.concurrency, 10),
        headless: options.headless,
        onProgress: (message) => {
            spinner.text = message;
        },
        onResult: async (result) => {
            foundResults.push(result);

            // Save to JSON immediately (streaming save)
            await appendResult(result, options.output, options.query || 'food & drink', options.location);

            // Real-time feedback
            spinner.stop();
            console.log(
                chalk.green('✓'),
                chalk.white(result.name),
                result.phone ? chalk.gray(`| ${result.phone}`) : chalk.yellow('| No phone'),
                chalk.gray(`[saved: ${foundResults.length}]`)
            );
            spinner.start();
        },
    });

    try {
        // Run the scraper (with or without subdivision)
        let results;
        if (options.subdivide && subLocations) {
            results = await scraper.scrapeWithSubdivision(options.query, options.location, subLocations);
        } else {
            results = await scraper.scrape(options.query, options.location);
        }

        spinner.stop();

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        if (results.length === 0) {
            console.log(chalk.yellow('\n⚠️  No establishments without websites found.\n'));
            return;
        }

        // Load existing data and merge
        const existing = await loadExisting(options.output);
        const mergedResults = mergeResults(existing, results);

        // Create final data object
        const data = createResultsObject(options.query, options.location, mergedResults);

        // Save to file
        const saved = await saveResults(data, options.output);

        if (saved) {
            console.log(chalk.green(`\n✅ Found ${results.length} establishments without websites`));
            console.log(chalk.gray(`   Total in file: ${mergedResults.length}`));
            console.log(chalk.gray(`   Saved to: ${options.output}`));
            console.log(chalk.gray(`   Time elapsed: ${elapsed}s\n`));

            // Summary statistics
            const withPhone = results.filter(r => r.phone).length;
            const withEmail = results.filter(r => r.emails && r.emails.length > 0).length;

            console.log(chalk.white('Summary:'));
            console.log(chalk.gray(`  • With phone number: ${withPhone}/${results.length}`));
            console.log(chalk.gray(`  • With email: ${withEmail}/${results.length}\n`));
        } else {
            console.log(chalk.red('\n❌ Failed to save results\n'));
        }

    } catch (error) {
        spinner.stop();
        console.log(chalk.red(`\n❌ Error: ${error.message}\n`));

        if (error.message.includes('Executable')) {
            console.log(chalk.yellow('Tip: Run "npx playwright install chromium" to install the browser\n'));
        }

        process.exit(1);
    }
}

main();
