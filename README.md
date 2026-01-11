# Info Getter - Google Maps Lead Finder

A high-performance bot to find restaurants, bars, pubs, and related establishments on Google Maps that **don't have websites**, extracting their contact information (phone numbers, emails) and saving to JSON in real-time.

## ⚠️ Disclaimer

This tool is for **educational purposes only**. Web scraping Google Maps may violate their Terms of Service. Use responsibly and at your own risk.

## Features

- 🚀 **Fast** - Processes 10 places at a time by default
- �️ **Food & Drink Focused** - Searches restaurants, bars, pubs, cafes, and 20+ related categories
- 📍 **Auto-Subdivision** - Automatically splits wide areas into sub-regions for more results
- 📞 **Contact Info** - Extracts phone numbers and searches for emails via DuckDuckGo
- 💾 **Real-time Saves** - Results saved to JSON instantly as they're found
- 🔄 **Deduplication** - Skips already-checked businesses and filters inactive/closed places
- 🖥️ **CLI** - Easy-to-use command-line interface

## Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd info-getter

# Install dependencies
npm install

# Install Playwright browser
npx playwright install chromium
```

## Usage

```bash
# Basic search (food & drink establishments without websites)
node src/cli.js -l "Madrid, Spain"

# MASSIVE search with auto-subdivision (~340 searches across categories & areas)
node src/cli.js -l "Madrid, Spain" -s

# Custom output file
node src/cli.js -l "Barcelona, Spain" -s -o barcelona_leads.json

# Adjust concurrency (default: 10)
node src/cli.js -l "London, UK" -s -c 5

# Debug mode (show browser window)
node src/cli.js -l "Paris, France" --no-headless
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-l, --location <area>` | Geographic area to search | **Required** |
| `-s, --subdivide` | Auto-split into sub-regions for more results | `false` |
| `-o, --output <file>` | Output JSON filename | `results.json` |
| `-c, --concurrency <n>` | Parallel page loads | `10` |
| `-q, --query <type>` | Custom search type (overrides food/drink) | Food & drink |
| `--no-headless` | Show browser window | `false` |

## What It Searches

When using `-s` (subdivide), the bot searches these categories across multiple sub-regions:

**Categories (21):** restaurants, bars, pubs, cafes, coffee shops, bistros, taverns, diners, eateries, tapas bars, wine bars, cocktail bars, breweries, food trucks, pizzerias, fast food, takeaway, bakeries, ice cream shops, juice bars

**Sub-regions:** North/South/East/West/Central + downtown, old town, city center, business district, suburbs, and more

## Output Format

```json
{
  "scrapedAt": "2026-01-11T19:50:00Z",
  "query": "food & drink",
  "location": "Madrid, Spain",
  "totalFound": 150,
  "results": [
    {
      "name": "Bar El Rincón",
      "address": "Calle Mayor 15, Madrid",
      "phone": "+34 912 345 678",
      "emails": ["elrincon@gmail.com"],
      "hasWebsite": false,
      "isActive": true,
      "placeId": "ChIJ..."
    }
  ]
}
```

## Tips

- Use `-s` for comprehensive searches — finds 10-30x more results
- Results save instantly — if the bot crashes, you keep what you found
- Duplicate names are automatically skipped
- Closed/inactive businesses are filtered out
- Emails are searched via DuckDuckGo when not found on Maps
