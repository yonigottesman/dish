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
--min-instances 1 \
--no-cpu-throttling \
--region europe-west1 \
--allow-unauthenticated \
--memory 4Gi \
--cpu 4000m
```

Recipe processing uses a pull Pub/Sub subscriber inside the API service. Keep
at least one instance running with CPU throttling disabled so jobs continue
without HTTP traffic. This increases baseline Cloud Run usage.

Provision the subscription with no inactivity expiration:
```sh
gcloud pubsub subscriptions create dish-jobs-sub --topic=dish-jobs --expiration-period=never --ack-deadline=600 --project=personal-ai-264306
# For an existing subscription:
gcloud pubsub subscriptions update dish-jobs-sub --expiration-period=never --project=personal-ai-264306
```
The API rejects new imports while its subscriber is unavailable. Subscriber
failures are logged and retried; processing has a four-minute deadline and
infrastructure failures are redelivered. Keep QA workers on a separate topic and
subscription if running them alongside production.

Run regression tests from the repository root:
```sh
PYTHONPATH=dish_server dish_server/.venv/bin/python -m unittest discover -s dish_server/tests -v
```
