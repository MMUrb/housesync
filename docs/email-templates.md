# HouseSync — branded email templates

Your **own** transactional emails (welcome, email verification, bill reminders, admin
test) are branded in code (`src/lib/email.ts` → `emailLayout`) and sent via the Brevo API.
They all carry the "message us on socials" footer (LinkedIn / Instagram / TikTok).

The templates below are the **Supabase Auth** emails — they live in the Supabase
dashboard. Paste each in **Supabase → Authentication → Email Templates** (set the Subject
+ replace the Message body), then Save.

> **Deliverability:** these send through Supabase's SMTP (your Brevo SMTP). The sender in
> **Supabase → Project Settings → Authentication → SMTP Settings** must be
> `hello@housesync.co.uk` (your authenticated domain) — not a Gmail/Outlook address — or
> they hit the `FREEMAIL_FORGED_REPLYTO` spam penalty.

Leave the `{{ .ConfirmationURL }}` / `{{ .NewEmail }}` variables exactly as written —
Supabase fills them in.

---

## 1. Reset Password  *(ACTIVE — used by the new "Forgot password?" link)*

**Subject:** `Reset your HouseSync password`

```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f7fb">
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:16px;color:#15151c;font-size:15px;line-height:1.5">
  <div style="font-weight:bold;font-size:18px;margin-bottom:16px">House<span style="color:#5f3fe0">Sync</span></div>
  <h1 style="font-size:20px;margin:0 0 10px">Reset your password</h1>
  <p>We got a request to reset the password on your HouseSync account. Tap below to choose a new one.</p>
  <p style="margin:22px 0"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#6f53f5;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">Reset my password</a></p>
  <p style="color:#64748b;font-size:13px">Or paste this link into your browser:<br><a href="{{ .ConfirmationURL }}" style="color:#6f53f5;word-break:break-all">{{ .ConfirmationURL }}</a></p>
  <p style="color:#94a3b8;font-size:12px;margin-top:14px">If you didn't request this, you can safely ignore this email — your password won't change.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
  <p style="margin:0 0 10px;color:#475569;font-size:13px">Got a question? Send us a message on any of our socials:</p>
  <p style="margin:0 0 16px">
    <a href="https://www.linkedin.com/company/housesyncuk/" style="display:inline-block;margin:0 6px 6px 0;padding:7px 14px;background:#f1f5f9;color:#5f3fe0;text-decoration:none;border-radius:8px;font-size:12px;font-weight:bold">LinkedIn</a>
    <a href="https://www.instagram.com/housesync.uk/" style="display:inline-block;margin:0 6px 6px 0;padding:7px 14px;background:#f1f5f9;color:#5f3fe0;text-decoration:none;border-radius:8px;font-size:12px;font-weight:bold">Instagram</a>
    <a href="https://www.tiktok.com/@housesync.uk" style="display:inline-block;margin:0 0 6px 0;padding:7px 14px;background:#f1f5f9;color:#5f3fe0;text-decoration:none;border-radius:8px;font-size:12px;font-weight:bold">TikTok</a>
  </p>
  <p style="color:#94a3b8;font-size:12px">HouseSync — the housemate app for bills, chores and rent.</p>
</div>
</body>
</html>
```

---

## 2. Change Email Address  *(ACTIVE — Settings → Change email)*

**Subject:** `Confirm your new email address`

```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f7fb">
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:16px;color:#15151c;font-size:15px;line-height:1.5">
  <div style="font-weight:bold;font-size:18px;margin-bottom:16px">House<span style="color:#5f3fe0">Sync</span></div>
  <h1 style="font-size:20px;margin:0 0 10px">Confirm your new email</h1>
  <p>We got a request to change the email on your HouseSync account to <strong>{{ .NewEmail }}</strong>.</p>
  <p>Tap the button to confirm. If this wasn't you, just ignore this email — nothing will change.</p>
  <p style="margin:22px 0"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#6f53f5;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">Confirm new email</a></p>
  <p style="color:#64748b;font-size:13px">Or paste this link into your browser:<br><a href="{{ .ConfirmationURL }}" style="color:#6f53f5;word-break:break-all">{{ .ConfirmationURL }}</a></p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
  <p style="margin:0 0 10px;color:#475569;font-size:13px">Got a question? Send us a message on any of our socials:</p>
  <p style="margin:0 0 16px">
    <a href="https://www.linkedin.com/company/housesyncuk/" style="display:inline-block;margin:0 6px 6px 0;padding:7px 14px;background:#f1f5f9;color:#5f3fe0;text-decoration:none;border-radius:8px;font-size:12px;font-weight:bold">LinkedIn</a>
    <a href="https://www.instagram.com/housesync.uk/" style="display:inline-block;margin:0 6px 6px 0;padding:7px 14px;background:#f1f5f9;color:#5f3fe0;text-decoration:none;border-radius:8px;font-size:12px;font-weight:bold">Instagram</a>
    <a href="https://www.tiktok.com/@housesync.uk" style="display:inline-block;margin:0 0 6px 0;padding:7px 14px;background:#f1f5f9;color:#5f3fe0;text-decoration:none;border-radius:8px;font-size:12px;font-weight:bold">TikTok</a>
  </p>
  <p style="color:#94a3b8;font-size:12px">HouseSync — the housemate app for bills, chores and rent.</p>
</div>
</body>
</html>
```

---

## 3. Confirm Signup  *(only if you turn email-confirmation ON — currently off)*

**Subject:** `Confirm your HouseSync account`

Same layout — body content:
```html
  <h1 style="font-size:20px;margin:0 0 10px">Confirm your email</h1>
  <p>Welcome to HouseSync! Tap below to confirm your email address and finish setting up your account.</p>
  <p style="margin:22px 0"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#6f53f5;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">Confirm my email</a></p>
  <p style="color:#64748b;font-size:13px">Or paste this link into your browser:<br><a href="{{ .ConfirmationURL }}" style="color:#6f53f5;word-break:break-all">{{ .ConfirmationURL }}</a></p>
  <p style="color:#94a3b8;font-size:12px;margin-top:14px">If you didn't create a HouseSync account, you can ignore this email.</p>
```
(wrap with the same `<!DOCTYPE>`…header…social-footer as above)

---

## 4. Magic Link  *(only if you enable magic-link sign-in)*

**Subject:** `Your HouseSync sign-in link`

Body content:
```html
  <h1 style="font-size:20px;margin:0 0 10px">Sign in to HouseSync</h1>
  <p>Tap below to sign in to your account. This link works once and expires shortly.</p>
  <p style="margin:22px 0"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#6f53f5;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">Sign in to HouseSync</a></p>
  <p style="color:#64748b;font-size:13px">Or paste this link into your browser:<br><a href="{{ .ConfirmationURL }}" style="color:#6f53f5;word-break:break-all">{{ .ConfirmationURL }}</a></p>
```
(wrap with the same `<!DOCTYPE>`…header…social-footer)

---

## 5. Invite User  *(optional — the app has its own invite-link flow)*

**Subject:** `You've been invited to HouseSync`

Body content:
```html
  <h1 style="font-size:20px;margin:0 0 10px">You're invited to HouseSync</h1>
  <p>You've been invited to join a house on HouseSync — the easy way for housemates to split bills, track chores and manage rent. Tap below to accept and set up your account.</p>
  <p style="margin:22px 0"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#6f53f5;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">Accept invite</a></p>
  <p style="color:#64748b;font-size:13px">Or paste this link into your browser:<br><a href="{{ .ConfirmationURL }}" style="color:#6f53f5;word-break:break-all">{{ .ConfirmationURL }}</a></p>
```
(wrap with the same `<!DOCTYPE>`…header…social-footer)
