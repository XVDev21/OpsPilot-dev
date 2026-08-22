# OpsPilot Local Connector

The connector lets OpsPilot run an OpenAI-compatible model on a user's own computer or private
network without exposing that model server to the public internet. It makes outbound HTTPS requests
to OpsPilot, claims user-owned jobs, calls Ollama, LM Studio, or vLLM locally, and returns only the
validated workflow result.

## Pair

Create a pairing in **Settings → Local model connector**, then run:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe opspilot_connector.py pair `
  --server https://opspilot-api-dhk7.onrender.com `
  --connector-id <connector-id> `
  --pairing-code <one-time-code> `
  --base-url http://127.0.0.1:11434/v1
```

The pairing token is displayed only once by the API and saved under the current user's local app
data directory. The connector accepts loopback and literal private-network model endpoints only.
It rejects embedded credentials, URL query/fragment secrets, public or metadata-network model
destinations, and any non-local OpsPilot server that is not HTTPS. HTTP redirects are disabled.

## Run

```powershell
.\.venv\Scripts\python.exe opspilot_connector.py run
```

Keep the process running while Local connector is selected in OpsPilot. Pairing codes expire after
10 minutes. Disconnecting the connector in Settings deletes queued jobs and invalidates its token.
