# Google Maps Bot

A high-performance bot to find Google Maps establishments that don't have websites, extracting their contact information (phone numbers, emails) and saving to JSON.

## ⚠️ Disclaimer

This tool is for **educational purposes only**. Web scraping Google Maps may violate their Terms of Service. Use responsibly and at your own risk.

## Features

- 🚀 **Fast** - Concurrent page processing with configurable parallelism
- 🎯 **Targeted** - Only extracts establishments without websites
- 📞 **Contact Info** - Extracts phone numbers and emails
- 💾 **Persistent** - Saves results to JSON with deduplication
- 🖥️ **CLI** - Easy-to-use command-line interface

## Installation

```bash
# Install dependencies
npm install

# Install Playwright browser
npx playwright install chromium
```

## Usage

```bash
# Search ALL establishments in an area (no -q flag)
node src/cli.js -l "Madrid, Spain"

# Search specific type
node src/cli.js -q "restaurants" -l "Madrid, Spain"

# With custom output file
node src/cli.js -q "dentists" -l "Barcelona, Spain" -o dentists.json

# Higher concurrency (faster but more resource-intensive)
node src/cli.js -l "New York, USA" -c 5

# Debug mode (show browser)
node src/cli.js -l "Paris, France" --no-headless
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-q, --query <type>` | Type of establishment (omit for ALL) | All types |
| `-l, --location <area>` | Geographic area to search | Required |
| `-o, --output <file>` | Output JSON filename | `results.json` |
| `-c, --concurrency <n>` | Parallel page loads | `3` |
| `--no-headless` | Show browser window | `false` |

## Output Format

```json
{
  "scrapedAt": "2026-01-04T22:50:00Z",
  "query": "",
  "location": "Madrid, Spain",
  "totalFound": 15,
  "results": [
    {
      "name": "Bar El Rincón",
      "address": "Calle Mayor 15, Madrid",
      "phone": "+34 912 345 678",
      "emails": [],
      "hasWebsite": false,
      "placeId": "ChIJ..."
    }
  ]
}
```

## Tips

- Default concurrency is 3 for lighter resource usage
- Omit `-q` to search ALL establishment types in an area
- Use specific queries for more targeted results (e.g., "italian restaurants")
- Results are automatically deduplicated when running multiple times with the same output file
