import sqlite3
import pandas as pd
import datetime
import random
import os

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
MARTS_DB = os.path.join(PROJECT_DIR, "sqlite/marts.db")
STAGING_DB = os.path.join(PROJECT_DIR, "sqlite/staging.db")
RAW_DB = os.path.join(PROJECT_DIR, "sqlite/raw.db")

CITIES = ["Madrid, Spain", "Barcelona, Spain", "Valencia, Spain", "Sevilla, Spain", "Bilbao, Spain"]
CATEGORIES = ["Bakery", "Gym", "Dentist", "Cafe", "Bistro"]
STREETS = ["Calle Mayor", "Gran Via", "Avenida de la Constitucion", "Paseo de Gracia", "Calle de Alcala"]

def generate_showcase_data():
    os.makedirs(os.path.join(PROJECT_DIR, "sqlite"), exist_ok=True)
    leads = []
    for i in range(14):
        date = datetime.date.today() - datetime.timedelta(days=i)
        for city in CITIES:
            num_leads = random.randint(2, 8)
            for _ in range(num_leads):
                category = random.choice(CATEGORIES)
                name = f"{category} {random.randint(100, 999)}"
                leads.append({
                    'place_id': f"ChIJ{random.getrandbits(64)}",
                    'business_name': name,
                    'full_address': f"{random.choice(STREETS)}, {random.randint(1, 100)}, {city}",
                    'phone_number': f"+34 {random.randint(600, 999)} {random.randint(100, 999)} {random.randint(100, 999)}",
                    'has_website': False,
                    'is_active': True,
                    'emails': f'["contact@{name.lower().replace(" ", "")}.com"]' if random.random() > 0.5 else '[]',
                    'search_query': category.lower(),
                    'search_location': city,
                    'scraped_at': date.isoformat() + "T10:00:00.000Z",
                    'scrape_date': date,
                    'batch_id': date.strftime('%Y%m%d')
                })

    df = pd.DataFrame(leads)
    
    conn_raw = sqlite3.connect(RAW_DB)
    df.to_sql("google_maps_places", conn_raw, if_exists='replace', index=False)
    conn_raw.close()
    
    df_dim = df[['place_id', 'business_name', 'full_address', 'phone_number', 'emails', 'search_location', 'scraped_at']]
    df_fct = df.groupby(['scrape_date', 'search_location', 'search_query']).agg(
        total_places_found=('place_id', 'count'),
        leads_without_website=('has_website', lambda x: (x == False).sum()),
        leads_with_email=('emails', lambda x: x.apply(lambda e: e != '[]').sum())
    ).reset_index()
    
    conn_marts = sqlite3.connect(MARTS_DB)
    df_dim.to_sql("dim_places", conn_marts, if_exists='replace', index=False)
    df_fct.to_sql("fct_daily_scrapes", conn_marts, if_exists='replace', index=False)
    conn_marts.close()
    print(f"✅ Generated {len(df)} leads.")

if __name__ == "__main__":
    generate_showcase_data()
