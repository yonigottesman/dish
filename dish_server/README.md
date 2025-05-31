docker build -f DockerFile -t dish_server .

docker run -p 8000:8080 \
-v /Users/yonigo/.config/gcloud/application_default_credentials.json:/root/credentials.json \
-e GOOGLE_APPLICATION_CREDENTIALS=/root/credentials.json \
-e GCLOUD_PROJECT_ID=personal-ai-264306 \
dish_server