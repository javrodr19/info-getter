SELECT
    DATE(scraped_at) AS scrape_date,
    search_location,
    search_query,
    COUNT(*) AS total_places_found,
    COUNT(CASE WHEN has_website IS FALSE THEN 1 END) AS leads_without_website,
    COUNT(CASE WHEN emails IS NOT NULL AND emails != '[]' THEN 1 END) AS leads_with_email
FROM {{ ref('stg_places') }}
GROUP BY 1, 2, 3
ORDER BY 1 DESC
