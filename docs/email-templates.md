# HouseSync — branded email templates

Your **own** transactional emails (welcome, email verification, bill reminders, admin
test) are already branded in code (`src/lib/email.ts` → `emailLayout`) and delivered via
the Brevo API.

The templates below are the **Supabase Auth** emails — they live in the Supabase
dashboard, not in code. Paste each one in:

**Supabase → Authentication → Email Templates** → pick the template → set the **Subject**
and replace the **Message body** with the HTML below → **Save.**

> **Deliverability:** these send through Supabase's SMTP (your Brevo SMTP). Make sure the
> sender in **Supabase → Project Settings → Authentication → SMTP Settings** is
> `hello@housesync.co.uk` (your authenticated domain) — not a Gmail/Outlook address —
> otherwise they'll hit the same `FREEMAIL_FORGED_REPLYTO` spam penalty we just fixed.

The Go-template variables (`{{ .ConfirmationURL }}`, `{{ .NewEmail }}`, etc.) are filled
in by Supabase — leave them exactly as written.

---

## 1. Reset Password  *(used by "forgot password")*

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
  <p style="color:#94a3b8;font-size:12px">HouseSync — the housemate app for bills, chores and rent.</p>
</div>
</body>
</html>
```

---

## 2. Change Email Address  *(used by Settings → Change email)*

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
  <p style="color:#94a3b8;font-size:12px">HouseSync — the housemate app for bills, chores and rent.</p>
</div>
</body>
</html>
```

---

## 3. Confirm Signup  *(only if you turn email confirmation ON — currently off)*

**Subject:** `Confirm your HouseSync account`

```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f7fb">
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:16px;color:#15151c;font-size:15px;line-height:1.5">
  <div style="font-weight:bold;font-size:18px;margin-bottom:16px">House<span style="color:#5f3fe0">Sync</span></div>
  <h1 style="font-size:20px;margin:0 0 10px">Confirm your email</h1>
  <p>Welcome to HouseSync! Tap below to confirm your email address and finish setting up your account.</p>
  <p style="margin:22px 0"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#6f53f5;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">Confirm my email</a></p>
  <p style="color:#64748b;font-size:13px">Or paste this link into your browser:<br><a href="{{ .ConfirmationURL }}" style="color:#6f53f5;word-break:break-all">{{ .ConfirmationURL }}</a></p>
  <p style="color:#94a3b8;font-size:12px;margin-top:14px">If you didn't create a HouseSync account, you can ignore this email.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
  <p style="color:#94a3b8;font-size:12px">HouseSync — the housemate app for bills, chores and rent.</p>
</div>
</body>
</html>
```

---

## 4. Magic Link  *(only if you enable magic-link / OTP sign-in)*

**Subject:** `Your HouseSync sign-in link`

```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f7fb">
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:16px;color:#15151c;font-size:15px;line-height:1.5">
  <div style="font-weight:bold;font-size:18px;margin-bottom:16px">House<span style="color:#5f3fe0">Sync</span></div>
  <h1 style="font-size:20px;margin:0 0 10px">Sign in to HouseSync</h1>
  <p>Tap below to sign in to your account. This link works once and expires shortly.</p>
  <p style="margin:22px 0"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#6f53f5;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">Sign in to HouseSync</a></p>
  <p style="color:#64748b;font-size:13px">Or paste this link into your browser:<br><a href="{{ .ConfirmationURL }}" style="color:#6f53f5;word-break:break-all">{{ .ConfirmationURL }}</a></p>
  <p style="color:#94a3b8;font-size:12px;margin-top:14px">If you didn't request this, you can ignore it.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
  <p style="color:#94a3b8;font-size:12px">HouseSync — the housemate app for bills, chores and rent.</p>
</div>
</body>
</html>
```

---

## 5. Invite User  *(optional — the app has its own invite-link flow, so this is rarely used)*

**Subject:** `You've been invited to HouseSync`

```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f7fb">
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:16px;color:#15151c;font-size:15px;line-height:1.5">
  <div style="font-weight:bold;font-size:18px;margin-bottom:16px">House<span style="color:#5f3fe0">Sync</span></div>
  <h1 style="font-size:20px;margin:0 0 10px">You're invited to HouseSync</h1>
  <p>You've been invited to join a house on HouseSync — the easy way for housemates to split bills, track chores and manage rent. Tap below to accept and set up your account.</p>
  <p style="margin:22px 0"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#6f53f5;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">Accept invite</a></p>
  <p style="color:#64748b;font-size:13px">Or paste this link into your browser:<br><a href="{{ .ConfirmationURL }}" style="color:#6f53f5;word-break:break-all">{{ .ConfirmationURL }}</a></p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
  <p style="color:#94a3b8;font-size:12px">HouseSync — the housemate app for bills, chores and rent.</p>
</div>
</body>
</html>
```
