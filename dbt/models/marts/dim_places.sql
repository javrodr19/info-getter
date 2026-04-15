SELECT
    place_id,
    business_name,
    full_address,
    phone_number,
    emails,
    search_location,
    scraped_at
FROM {{ ref('stg_places') }}
WHERE has_website IS FALSE AND is_active IS TRUE
