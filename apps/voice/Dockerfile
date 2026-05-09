FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install runtime deps first for layer cache reuse.
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY src ./src

EXPOSE 8000

# Railway sets $PORT; default to 8000 locally. uvicorn handles WebSocket.
CMD ["sh", "-c", "uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips=*"]
