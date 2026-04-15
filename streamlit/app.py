import streamlit as st
import pandas as pd
from sqlalchemy import create_engine, inspect
import os
import time

# Page config
st.set_page_config(page_title="Google Maps Leads Dashboard", layout="wide")

st.title("🗺️ Google Maps Leads Dashboard")
st.markdown("Businesses found without websites on Google Maps.")

# Connection
@st.cache_resource
def get_engine():
    db_path = os.getenv("DB_PATH", "/home/jvv/info-getter/sqlite/marts.db")
    return create_engine(f"sqlite:///{db_path}")

engine = get_engine()

def table_exists(table_name):
    inspector = inspect(engine)
    return table_name in inspector.get_table_names()

def load_data(query):
    return pd.read_sql(query, engine)

# Add a manual refresh button in the sidebar
if st.sidebar.button('🔄 Refresh Data'):
    st.rerun()

# Auto-refresh check (Streamlit will rerun the whole script)
# We can use a placeholder to show last update time
st.sidebar.write(f"Last updated: {time.strftime('%H:%M:%S')}")

try:
    if not table_exists("fct_daily_scrapes") or not table_exists("dim_places"):
        st.warning("⏳ Waiting for the first pipeline batch to complete...")
        st.info("The scraper is currently running. Please wait about 60 seconds and click 'Refresh'.")
        # Auto-rerun after 10 seconds if data is missing
        time.sleep(10)
        st.rerun()
    else:
        # Load Data
        df_fct = load_data("SELECT * FROM fct_daily_scrapes")
        df_leads = load_data("SELECT business_name, full_address, phone_number, emails, search_location, scraped_at FROM dim_places")

        # Summary Metrics
        col1, col2, col3 = st.columns(3)
        total_leads = df_fct['leads_without_website'].sum()
        total_with_email = df_fct['leads_with_email'].sum()
        latest_leads = df_fct['leads_without_website'].iloc[0] if not df_fct.empty else 0

        col1.metric("Total Leads", int(total_leads))
        col2.metric("Total with Email", int(total_with_email))
        col3.metric("Latest Batch Leads", int(latest_leads))

        # Daily Trend Chart
        st.subheader("Daily Trends")
        if not df_fct.empty:
            df_trend = df_fct.groupby('scrape_date')['leads_without_website'].sum().reset_index()
            st.line_chart(df_trend.set_index('scrape_date'))

        # Lead Explorer
        st.subheader("Lead Explorer")
        if not df_leads.empty:
            # Filter by location
            locations = ["All"] + sorted(list(df_leads['search_location'].unique()))
            selected_loc = st.selectbox("Filter by Location", locations)
            
            display_df = df_leads.copy()
            if selected_loc != "All":
                display_df = display_df[display_df['search_location'] == selected_loc]
                
            st.dataframe(display_df, use_container_width=True)
        else:
            st.info("No leads found yet. Searching...")

except Exception as e:
    st.error(f"Error loading dashboard: {str(e)}")
    if st.button("Try Again"):
        st.rerun()
