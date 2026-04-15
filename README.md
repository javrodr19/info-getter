# 🗺️ Google Maps Leads Pipeline

A production-style data pipeline that scrapes Google Maps for businesses without websites, cleans and transforms the data, and serves a live analytics dashboard.

## 🚀 The Pipeline
1.  **Extract**: Node.js + Playwright scraper crawls Google Maps for targeted leads.
2.  **Load**: Python/Pandas ingests raw JSON into a relational database (PostgreSQL/SQLite).
3.  **Transform**: dbt Core (or Python fallback) models data using a Medallion Architecture (Raw → Staging → Marts).
4.  **Visualize**: Streamlit dashboard provides daily trends, email lead counts, and location filters.

## 🛠️ Technology Stack
- **Orchestration**: Apache Airflow (scheduled & retry-ready).
- **Data Modeling**: dbt Core (Data Build Tool).
- **Database**: PostgreSQL (Production) / SQLite (Local dev).
- **Infrastructure**: Docker & Docker Compose.
- **Frontend**: Streamlit.

## 📖 Quick Start

### Option A: Local Run (No Docker)
1.  **Initialize**:
    ```bash
    chmod +x run.sh
    ./run.sh --setup
    ```
2.  **Start Live Pipeline**:
    ```bash
    ./run.sh --live
    ```
3.  **Showcase (Fake Data)**:
    ```bash
    ./run.sh --showcase
    ```
    *Access Dashboard at http://localhost:8501*

### Option B: Production (Docker)
```bash
docker-compose up -d
```
*Airflow: http://localhost:8080 | Dashboard: http://localhost:8501*

## 📁 Project Structure
- `src/`: Core Node.js scraper.
- `airflow/`: DAGs and loading logic.
- `dbt/`: Data models and quality tests.
- `streamlit/`: Dashboard frontend.
- `sqlite/`: Local database storage.

---
*Disclaimer: This project is for study purposes only. Scraped data usage should comply with Google Maps Terms of Service.*
