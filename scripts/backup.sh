#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec irrigation-system_postgres_1 pg_dump -U irrigation_user irrigation > backup_${DATE}.sql
