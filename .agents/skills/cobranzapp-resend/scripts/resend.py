#!/usr/bin/env python3
"""Small, secret-safe cobranzapp Resend operator tool (standard library only)."""
import argparse
import json
from pathlib import Path
import sys
import urllib.error
import urllib.request
import uuid


def load_environment(path):
    path = Path(path)
    if path.stat().st_mode & 0o077:
        raise ValueError("Credential file must have mode 0600")
    values = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key] = value.strip().strip('\"\'')
    if not values.get("RESEND_API_KEY"):
        raise ValueError("RESEND_API_KEY is missing")
    if values.get("CONTACT_TO_EMAIL") != "info@cobranzaap.tech":
        raise ValueError("Recipient must be the cobranzapp institutional mailbox")
    if values.get("RESEND_FROM") != "cobranzapp <contacto@cobranzaap.tech>":
        raise ValueError("Sender must be the cobranzapp verified-domain address")
    return values


def request(environment, endpoint, payload=None, idempotency=None):
    headers = {"Authorization": "Bearer " + environment["RESEND_API_KEY"], "User-Agent": "cobranzapp-operator/1.0"}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    if idempotency:
        headers["Idempotency-Key"] = idempotency
    req = urllib.request.Request("https://api.resend.com" + endpoint,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers=headers, method="POST" if payload is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise ValueError("Resend request failed: HTTP " + str(error.code)) from None
    except (urllib.error.URLError, TimeoutError):
        raise ValueError("Resend unavailable; no automatic mutation retry") from None


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", default=".env.resend.local")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("status", help="Read verified project-domain status")
    status = commands.add_parser("email-status", help="Inspect a known outbound email ID")
    status.add_argument("id", type=str)
    test = commands.add_parser("test-email", help="Send one technical test to the fixed mailbox")
    test.add_argument("--confirm", action="store_true")
    test.add_argument("--request-id", default=None, help="Reuse this UUID after uncertain sends")
    args = parser.parse_args(argv)
    if args.command == "test-email" and not args.confirm:
        parser.error("test-email requires --confirm; it sends a real email")
    environment = load_environment(args.env_file)
    if args.command == "status":
        result = request(environment, "/domains")
        domains = [{key: domain.get(key) for key in ("id", "name", "status", "region", "capabilities")}
                   for domain in result.get("data", []) if domain.get("name") == "cobranzaap.tech"]
        print(json.dumps({"configured": True, "domains": domains}, ensure_ascii=False))
        return 0 if any(domain.get("status") == "verified" for domain in domains) else 1
    if args.command == "email-status":
        identifier = str(uuid.UUID(args.id))
        result = request(environment, "/emails/" + identifier)
        if result.get("from") != environment["RESEND_FROM"]:
            raise ValueError("Email is not from the configured cobranzapp sender")
        print(json.dumps({key: result.get(key) for key in ("id", "created_at", "last_event")}))
        return 0
    identifier = str(uuid.UUID(args.request_id)) if args.request_id else str(uuid.uuid4())
    # Print the non-secret ID first so an uncertain response can be retried safely.
    print(json.dumps({"request_id": identifier}), flush=True)
    result = request(environment, "/emails", {
        "from": environment["RESEND_FROM"], "to": [environment["CONTACT_TO_EMAIL"]],
        "subject": "Prueba técnica de contacto · cobranzapp",
        "text": "Prueba autorizada de la conexión de Resend para cobranzapp. No es una solicitud comercial.",
        "tags": [{"name": "category", "value": "contact-test"}],
    }, "cobranzapp-test/" + identifier)
    print(json.dumps({"accepted": True, "id": result.get("id")}))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, OSError, json.JSONDecodeError) as error:
        # Only errors generated here are shown; provider bodies are never printed.
        message = str(error) if isinstance(error, ValueError) and not isinstance(error, json.JSONDecodeError) else "Unable to read protected configuration or provider response"
        print(message, file=sys.stderr)
        sys.exit(1)
