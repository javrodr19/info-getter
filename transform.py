import sqlite3
import pandas as pd
import os

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_DB = os.path.join(PROJECT_DIR, "sqlite/raw.db")
STAGING_DB = os.path.join(PROJECT_DIR, "sqlite/staging.db")
MARTS_DB = os.path.join(PROJECT_DIR, "sqlite/marts.db")

def run_transformations():
    if not os.path.exists(RAW_DB): return
        
    conn_raw = sqlite3.connect(RAW_DB)
    df_raw = pd.read_sql("SELECT * FROM google_maps_places", conn_raw)
    conn_raw.close()
    
    # Deduplication
    df_raw['rn'] = df_raw.sort_values('scraped_at', ascending=False).groupby('place_id').cumcount() + 1
    df_stg = df_raw[df_raw['rn'] == 1].copy()
    
    # Type cleaning
    df_stg['has_website'] = df_stg['has_website'].apply(lambda x: str(x).lower() in ['true', '1', 't'])
    df_stg['is_active'] = df_stg['is_active'].apply(lambda x: str(x).lower() in ['true', '1', 't'])
    
    conn_stg = sqlite3.connect(STAGING_DB)
    df_stg.to_sql("stg_places", conn_stg, if_exists='replace', index=False)
    conn_stg.close()
    
    # Marts
    df_dim = df_stg[~df_stg['has_website'] & df_stg['is_active']][['place_id', 'business_name', 'full_address', 'phone_number', 'emails', 'search_location', 'scraped_at']]
    df_stg['scrape_date'] = pd.to_datetime(df_stg['scraped_at']).dt.date
    df_fct = df_stg.groupby(['scrape_date', 'search_location', 'search_query']).agg(
        total_places_found=('place_id', 'count'),
        leads_without_website=('has_website', lambda x: (~x).sum()),
        leads_with_email=('emails', lambda x: x.apply(lambda e: e is not None and e != '[]').sum())
    ).reset_index()
    
    conn_marts = sqlite3.connect(MARTS_DB)
    df_dim.to_sql("dim_places", conn_marts, if_exists='replace', index=False)
    df_fct.to_sql("fct_daily_scrapes", conn_marts, if_exists='replace', index=False)
    conn_marts.close()

if __name__ == "__main__":
    run_transformations()
