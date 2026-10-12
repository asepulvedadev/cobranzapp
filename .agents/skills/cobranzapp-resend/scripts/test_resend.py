"""Offline safety tests for the bundled operator tool."""
import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import resend


class ResendOperatorTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "credential"
        self.path.write_text('RESEND_API_KEY=test-secret\nRESEND_FROM="cobranzapp <contacto@cobranzaap.tech>"\nCONTACT_TO_EMAIL="info@cobranzaap.tech"\n')
        self.path.chmod(0o600)

    def test_rejects_readable_credentials(self):
        self.path.chmod(0o644)
        with self.assertRaisesRegex(ValueError, "0600"):
            resend.load_environment(self.path)

    def test_prevents_recipient_override(self):
        self.path.write_text(self.path.read_text().replace("info@cobranzaap.tech", "other@example.com"))
        with self.assertRaisesRegex(ValueError, "institutional mailbox"):
            resend.load_environment(self.path)

    def test_requires_explicit_confirmation_without_network(self):
        with patch.object(resend, "request") as request, contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                resend.main(["--env-file", str(self.path), "test-email"])
            request.assert_not_called()

    def test_sends_only_fixed_recipient_and_never_prints_key(self):
        output = io.StringIO()
        with patch.object(resend, "request", return_value={"id": "email-id"}) as request, contextlib.redirect_stdout(output):
            self.assertEqual(resend.main(["--env-file", str(self.path), "test-email", "--confirm"]), 0)
            payload = request.call_args.args[2]
            self.assertEqual(payload["to"], ["info@cobranzaap.tech"])
            self.assertNotIn("test-secret", output.getvalue())
            self.assertTrue(json.loads(output.getvalue().splitlines()[-1])["accepted"])


if __name__ == "__main__":
    unittest.main()
