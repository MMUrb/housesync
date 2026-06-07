// Deletes the test house (cascades chat/members/expenses) + test avatar files.
const URL = "https://mlmuetsclrclqlnaicmh.supabase.co";
const ANON = "sb_publishable_Wr9PWIRCOO06odm7a4LkLw_9VdtQYXn";
const login = (email) =>
  fetch(URL + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "ChatTest123!" }),
  }).then((r) => r.json());

const alex = await login("alex.chattest@example.com");
const aTok = alex.access_token;
const aId = alex.user?.id;
const houses = await fetch(URL + "/rest/v1/houses?select=id,name", {
  headers: { apikey: ANON, Authorization: "Bearer " + aTok },
}).then((r) => r.json());

const deleted = [];
for (const h of houses) {
  const r = await fetch(`${URL}/rest/v1/houses?id=eq.${h.id}`, {
    method: "DELETE",
    headers: { apikey: ANON, Authorization: "Bearer " + aTok, Prefer: "return=minimal" },
  });
  deleted.push({ house: h.name, status: r.status });
}

const sam = await login("sam.chattest@example.com");
const delAvatar = async (tok, uid) =>
  (await fetch(`${URL}/storage/v1/object/avatars/${uid}/avatar.jpg`, {
    method: "DELETE",
    headers: { apikey: ANON, Authorization: "Bearer " + tok },
  })).status;
const aAvatar = aTok ? await delAvatar(aTok, aId) : "no-token";
const sAvatar = sam.access_token ? await delAvatar(sam.access_token, sam.user.id) : "no-token";

console.log(JSON.stringify({ housesDeleted: deleted, alexAvatarDel: aAvatar, samAvatarDel: sAvatar }, null, 2));
