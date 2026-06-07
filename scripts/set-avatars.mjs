// Verifies profile pictures end-to-end: logs in each test user, uploads an
// image to the 'avatars' bucket (tests storage RLS), and sets profiles.avatar_url.
const URL = "https://mlmuetsclrclqlnaicmh.supabase.co";
const ANON = "sb_publishable_Wr9PWIRCOO06odm7a4LkLw_9VdtQYXn";

async function login(email) {
  return fetch(URL + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "ChatTest123!" }),
  }).then((r) => r.json());
}

async function setAvatar(email, imgUrl) {
  const s = await login(email);
  const token = s.access_token;
  const uid = s.user?.id;
  if (!token) return { email, error: "login failed", body: s };
  const bytes = Buffer.from(await fetch(imgUrl).then((r) => r.arrayBuffer()));
  const path = `${uid}/avatar.jpg`;
  const up = await fetch(`${URL}/storage/v1/object/avatars/${path}`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: "Bearer " + token, "Content-Type": "image/jpeg", "x-upsert": "true" },
    body: bytes,
  });
  const publicUrl = `${URL}/storage/v1/object/public/avatars/${path}`;
  const upd = await fetch(`${URL}/rest/v1/profiles?id=eq.${uid}`, {
    method: "PATCH",
    headers: { apikey: ANON, Authorization: "Bearer " + token, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ avatar_url: publicUrl }),
  });
  return { email, uploadStatus: up.status, updateStatus: upd.status, publicUrl };
}

const alex = await setAvatar("alex.chattest@example.com", "https://i.pravatar.cc/256?img=13");
const sam = await setAvatar("sam.chattest@example.com", "https://i.pravatar.cc/256?img=45");
console.log(JSON.stringify({ alex, sam }, null, 2));
