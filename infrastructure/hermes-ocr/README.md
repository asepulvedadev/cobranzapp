# Hermes OCR profile

This directory is the reproducible, secret-free definition of the dedicated CobranzApp identity OCR agent.

- Profile: `cobranzapp-ocr`
- Model: `gpt-5.6-luna`
- Private API: port `8650`, authenticated with `API_SERVER_KEY`
- Network: only the CobranzApp API/worker Docker subnets are allowed by the VPS firewall
- Tools: disabled; the agent only receives the request text and document images
- Human gate: extracted values are suggestions until an authorized operator confirms them

Production secrets live only in `/root/.hermes-cobranzapp/profiles/cobranzapp-ocr/.env`. Never commit `OPENAI_API_KEY` or `API_SERVER_KEY`.

The service health check is:

```bash
curl --fail http://127.0.0.1:8650/health
```
