# run-notifier

Sign up using SMS and have notifications of your runs posted to a Slack channel. Good for group runners who use different running applications (MapMyRun, Strava etc.) and want to be able to track each others progess.

## Pre-requisites

To set up your own run-notifier you will need:

* A [webtask.io](https://www.webtask.io) account
* A [Twilio](https://www.twilio.com) account with an SMS capable number configured to make requests to your webtask.
* Configure a [Slack](https://slack.com/apps) incoming webhook 
* Configure applications for each of the supported running platforms:
 * [MapMyRun](https://developer.underarmour.com)
 * [Strava](https://labs.strava.com/developers) (Does not allow all applications to use webhooks at this time)

## Configuration

The run-notifier expects configuration values to be passed via the `--secret` parameter of the `wt` utlity.  Below are a list of the configuration parameters:

* UA\_CLIENT_ID - The Under Armour (MapMyRun) client id
* UA\_CLIENT_SECRET - The Under Armour (MapMyRun) client secret
* STRAVA\_CLIENT_ID - The Strava client id
* STRAVA\_CLIENT_SECRET - The Strava client secret
* PHONE_NUMBER - The phone number that is configured in Twilio to receive SMS messages.
* SLACK\_WEBHOOK_URL - The URL of the Slack webhook to send normalized run messages to. (Currently sends to #running channel)


## Deployment

Use webtask.io `wt` command line utility to create a new application.

```
wt create --name run-notifier --secret UA_CLIENT_ID=XXX --secret UA_CLIENT_SECRET=XXX --secret STRAVA_CLIENT_ID=XXX --secret STRAVA_CLIENT_SECRET=XXX --secret PHONE_NUMBER="+1 (XXX) XXX-XXXX" --secret SLACK_WEBHOOK_URL="https://hooks.slack.com/services/XXXXXXXXX/XXXXXXXXX/XXXXXXXXXXXXXXXXXXXXXXXX" run-notifier.js
```

