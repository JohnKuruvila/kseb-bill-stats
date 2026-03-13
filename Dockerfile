FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_HOME=/app \
    KSEB_SYNC_CRON="0 6 1 * *" \
    TZ=Asia/Kolkata

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends cron tzdata \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY dashboard ./dashboard
COPY scripts ./scripts
COPY docker ./docker
COPY README.md ./
COPY .env.example ./

RUN mkdir -p /app/kseb-bills /app/exports /var/log/cron

EXPOSE 8000

CMD ["sh", "/app/docker/start.sh"]
