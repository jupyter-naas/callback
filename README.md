# Naas Callback

Callback service to run side to side with naas.
Allow naas users to receive simple data from outside Naas network without creating a naas notebook webhook

## Env vars 

`SENTRY_DSN` to connect sentry

`HUB_HOST` => hostname of the deployed jupyter hub instance

`PROXY_DB` => 'sqlite::memory:' or postgressuri 'postgres://user:pass@example.com:5432/dbname'

