#!/bin/bash
# Pipeline Runner Script

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

setup() {
    echo "⚙️  Setting up environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install pandas sqlalchemy streamlit dbt-sqlite --quiet
    npm install --quiet
    npx playwright install chromium
    mkdir -p data sqlite
}

live() {
    echo "🧹 Resetting data for fresh start..."
    rm -f sqlite/*.db data/*.json
    mkdir -p data sqlite
    
    echo "🚀 Starting Live Lead Pipeline..."
    source venv/bin/activate
    
    # Start Dashboard
    fuser -k 8501/tcp 2>/dev/null || true
    nohup streamlit run streamlit/app.py --server.port 8501 --server.address 0.0.0.0 > streamlit.log 2>&1 &
    echo "📊 Dashboard will be ready at http://localhost:8501 (waiting 5s...)"
    sleep 5
    
    # Loop Configuration
    QUERIES=("restaurants" "cafes" "bakeries" "gyms" "dentists")
    LOCATIONS=("Madrid, Spain" "Barcelona, Spain" "Valencia, Spain" "Sevilla, Spain")

    while true; do
        QUERY=${QUERIES[$RANDOM % ${#QUERIES[@]}]}
        LOCATION=${LOCATIONS[$RANDOM % ${#LOCATIONS[@]}]}
        RAW_JSON="data/results_$(date +%H%M%S).json"

        echo "🔍 [$(date +%T)] Searching for '$QUERY' in '$LOCATION'..."
        if node src/cli.js -q "$QUERY" -l "$LOCATION" -o "$RAW_JSON" -c 5; then
            DATA_FILE="$PROJECT_DIR/$RAW_JSON" DB_PATH="$PROJECT_DIR/sqlite/raw.db" python3 airflow/dags/scripts/loader.py
            python3 transform.py
            echo "✅ Batch complete."
        fi
        sleep 10
    done
}

showcase() {
    echo "🎭 Setting up Showcase Mode (Fake Data)..."
    source venv/bin/activate
    python3 generate_fake_data.py
    fuser -k 8501/tcp 2>/dev/null || true
    streamlit run streamlit/app.py
}

case "$1" in
    --setup) setup ;;
    --live) live ;;
    --showcase) showcase ;;
    *) echo "Usage: ./run.sh {--setup|--live|--showcase}" ;;
esac
