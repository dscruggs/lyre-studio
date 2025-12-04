# API Proxy service - handles /api/* requests from Firebase Hosting
FROM python:3.12-slim

WORKDIR /app

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy the FastAPI proxy server and config
COPY main.py ./
COPY allowed_users.txt ./

# Cloud Run uses PORT env var
EXPOSE 8080
CMD ["python", "main.py"]
