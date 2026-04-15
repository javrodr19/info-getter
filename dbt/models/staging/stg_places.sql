WITH raw_data AS (
    SELECT 
        *,
        ROW_NUMBER() OVER (PARTITION BY place_id ORDER BY scraped_at DESC) as rn
    FROM {{ source('raw', 'google_maps_places') }}
)

SELECT
    place_id,
    business_name,
    full_address,
    phone_number,
    -- Handle values loaded as strings from raw storage
    CASE 
        WHEN has_website = 'true' OR has_website = 'True' THEN TRUE 
        WHEN has_website = 'false' OR has_website = 'False' THEN FALSE 
        ELSE NULL 
    END AS has_website,
    CASE 
        WHEN is_active = 'true' OR is_active = 'True' THEN TRUE 
        WHEN is_active = 'false' OR is_active = 'False' THEN FALSE 
        ELSE NULL 
    END AS is_active,
    emails,
    search_query,
    search_location,
    CAST(scraped_at AS TIMESTAMP) AS scraped_at,
    batch_id
FROM raw_data
WHERE rn = 1
