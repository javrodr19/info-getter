from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta
import os
import sys

# Add scripts folder to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'scripts'))
from loader import load_json_to_postgres

default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'start_date': datetime(2024, 1, 1),
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
}

with DAG(
    'google_maps_leads_pipeline',
    default_args=default_args,
    description='Scrape, Load, and Transform Google Maps leads',
    schedule_interval=timedelta(days=1),
    catchup=False,
) as dag:

    # 1. Scrape data
    # We use dynamic location/query. In production, these might be read from a table.
    scrape_task = BashOperator(
        task_id='scrape_google_maps',
        bash_command='''
            cd /opt/airflow/scraper && \
            node src/cli.js -q "restaurants" -l "Madrid, Spain" -o "/opt/airflow/data/results_{{ ds }}.json"
        ''',
        # Set headless to true for server environment
        env={'HEADLESS': 'true'}
    )

    # 2. Load to Postgres
    def load_task_callable(ds, **kwargs):
        db_url = "postgresql+psycopg2://airflow:airflow@postgres:5432/airflow"
        file_path = f"/opt/airflow/data/results_{ds}.json"
        load_json_to_postgres(file_path, db_url)

    load_task = PythonOperator(
        task_id='load_to_postgres',
        python_callable=load_task_callable,
    )

    # 3. Transform with dbt
    dbt_run = BashOperator(
        task_id='dbt_run',
        bash_command='''
            cd /opt/airflow/dbt && \
            dbt run --profiles-dir .
        '''
    )

    # 4. Test with dbt
    dbt_test = BashOperator(
        task_id='dbt_test',
        bash_command='''
            cd /opt/airflow/dbt && \
            dbt test --profiles-dir .
        '''
    )

    scrape_task >> load_task >> dbt_run >> dbt_test
