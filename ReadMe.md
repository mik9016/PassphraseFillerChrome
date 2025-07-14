# Passphrase Filler

Passphrase Filler is a Chromium/Firefox extension for securely storing, sharing, and auto-filling test credentials for multiple environments.  
It supports both **personal** (local) and **team-managed (cloud)** credentials, making it ideal for dev/test teams.

> **Warning:**  
> Data is **not encrypted**. This extension is for **test accounts only**. Never store real production credentials.

---

## Features

- **Cloud Team Credentials**  
  Team-managed credentials are loaded automatically from a shared JSON file in the cloud. Passphrase changes in the cloud appear instantly in every team member’s extension.

- **Secure Filtering**  
  Only credentials with the environment set to `Staging`, `Integration`, or `Pre Prod` are shared via the cloud.  
  `Prod` (production) accounts are **never** synced to the cloud, even if accidentally added.

- **Personal Storage**  
  Add, edit, and delete your own credentials, which are stored locally in your browser.  
  Local data is persistent and visible only to you.

- **Autofill**  
  The extension automatically fills the passphrase when it detects your username and environment on supported pages.

- **Automatic Team Sync**  
  If you reset a test user’s passphrase, the extension syncs the update to the cloud (unless it’s a `Prod` user).  
  The most recent update always wins.

- **Deduplication**  
  Any local entry that matches a cloud credential (by username + environment, case-insensitive) is removed automatically to avoid duplicates.

- **Modern UI**  
  - Clean, responsive, white background.
  - Cloud entries are read-only, visually distinct, and marked as such.
  - Manual entries use dropdowns for environment (no misspelling).
  - Compact font and layout for maximum visibility.
  - “Fill” button is modern, green, and rounded.
  - “Remove” button is always at the top right of every card.

- **Case-Insensitive Matching**  
  Username comparisons are case-insensitive to avoid mismatches.

---

## Quick Start

1. **Install the Extension**  
   Add Passphrase Filler to your Chromium or Firefox browser.

2. **Team Credentials**  
   Team-managed credentials appear automatically as read-only cards.

3. **Add Your Own**  
   Click the "+" button to add a new credential. Select the environment from the dropdown, enter your username and passphrase.

4. **Autofill**  
   When logging in on supported pages, the extension will auto-fill the passphrase if your username and environment match.

5. **Reset Passphrase**  
   When you reset a test user’s passphrase, the extension syncs it to the team cloud file (except for `Prod` users).

---

## Cloud Credential Format

Team credentials are managed in a shared JSON file, for example:

```json
{
  "_meta": {
    "env_accepted_values": [
      "Staging",
      "Integration",
      "Pre Prod"
    ],
    "note": "Only these env values are accepted. Others, including 'Prod', are ignored."
  },
  "team_accounts": [
    {
      "env": "Staging",
      "user": "alice",
      "pass": "correct horse battery staple"
    },
    {
      "env": "Integration",
      "user": "bob",
      "pass": "yellow banana apple blue"
    }
  ]
}
