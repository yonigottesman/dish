docker build -f DockerFile -t dish_server .

docker run -p 8000:8080 \
-v /Users/yonigo/.config/gcloud/application_default_credentials.json:/root/credentials.json \
-e GOOGLE_APPLICATION_CREDENTIALS=/root/credentials.json \
-e GCLOUD_PROJECT_ID=personal-ai-264306 \
dish_server


#deploy 
```
gcloud run deploy dish-server \                       
--source . \
--update-env-vars GCLOUD_PROJECT_ID=personal-ai-264306,SECRET_KEY=123,IS_PRODUCTION=true \
--min-instances 0 \
--region europe-west1 \
--allow-unauthenticated \
--memory 4Gi \
--cpu 4000m
```