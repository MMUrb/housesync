"use client";

import { useState } from "react";

// A lightweight, dependency-free emoji picker (categorised, scrollable grid).
const CATEGORIES: { id: string; icon: string; emojis: string[] }[] = [
  {
    id: "Smileys",
    icon: "😀",
    emojis: "😀 😃 😄 😁 😆 😅 😂 🤣 🥲 ☺️ 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😮 😲 🥱 😴 🤤 😪 🥴 🤢 🤮 🤧 😷 🤒 🤕".split(" "),
  },
  {
    id: "Gestures",
    icon: "👍",
    emojis: "👍 👎 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤝 🙏 ✍️ 💅 🤳 💪 👏 🙌 👐 🤲 🤜 🤛 ✊ 👊 🫶 🫰 🫵 🫱 🫲 🦾".split(" "),
  },
  {
    id: "Hearts",
    icon: "❤️",
    emojis: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ♥️ 💋 💯 💢 💥 💫 💦 💨 🔥 ✨ ⭐ 🌟 💧".split(" "),
  },
  {
    id: "Animals",
    icon: "🐶",
    emojis: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🐤 🦄 🐝 🦋 🐌 🐞 🐢 🐍 🐙 🦀 🐠 🐟 🐬 🐳 🐋 🦈 🐊 🐅 🐆 🦓 🦍 🐘 🐪 🦒 🐎 🐖 🐑 🐐 🦌 🐕 🐈 🐓 🦃 🐇 🌸 🌺 🌻 🌷 🌹 🌳 🌲".split(" "),
  },
  {
    id: "Food",
    icon: "🍔",
    emojis: "🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🍆 🥔 🥕 🌽 🌶️ 🥒 🥬 🥦 🧄 🧅 🍄 🥜 🍞 🥐 🥖 🥨 🧀 🥚 🍳 🥞 🧇 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🥗 🍝 🍜 🍲 🍣 🍱 🍛 🍚 🥟 🍦 🍰 🎂 🍫 🍬 🍭 🍩 🍪 ☕ 🍵 🥤 🍺 🍷 🥂 🍸 🍹".split(" "),
  },
  {
    id: "Activities",
    icon: "⚽",
    emojis: "⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🏓 🏸 🥅 🏒 🏑 🏏 ⛳ 🏹 🎣 🥊 🥋 ⛸️ 🥌 🎿 ⛷️ 🏂 🏋️ 🤸 ⛹️ 🏌️ 🏇 🧘 🏄 🏊 🚣 🧗 🚴 🚵 🎯 🪁 🎮 🎲 🎸 🎹 🎺 🎻 🥁 🎤 🎧 🎬 🎨".split(" "),
  },
  {
    id: "Travel",
    icon: "✈️",
    emojis: "🚗 🚕 🚙 🚌 🏎️ 🚓 🚑 🚒 🚐 🚚 🚛 🛵 🏍️ 🚲 🛴 ✈️ 🛫 🛬 🚀 🛸 🚁 ⛵ 🚤 🛳️ ⚓ 🏖️ 🏝️ 🏔️ ⛰️ 🌋 🏕️ 🏠 🏡 🏢 🏥 🏦 🏨 🏫 🗼 🗽 ⛲ 🌉 🎡 🎢 🎠".split(" "),
  },
  {
    id: "Objects",
    icon: "💡",
    emojis: "⌚ 📱 💻 ⌨️ 🖥️ 🖨️ 🖱️ 📷 📸 📹 🎥 📞 ☎️ 📺 📻 ⏰ ⏲️ ⌛ 💡 🔦 🕯️ 🔋 🔌 💰 💵 💳 💎 🔧 🔨 🛠️ 🧰 🔑 🚪 🛋️ 🛏️ 🚽 🚿 🛁 🧴 🧻 🧼 🧹 🧺 🛒 🎁 🎈 🎉 🎊 📦 📫 ✏️ 📝 📚 📖 🔒 🔓".split(" "),
  },
  {
    id: "Symbols",
    icon: "✅",
    emojis: "✅ ❌ ⭕ ❓ ❗ ‼️ ⁉️ 💤 🔔 🔕 🎵 🎶 ➕ ➖ ✖️ ➗ ♾️ 💲 ™️ ©️ ®️ ➰ ✔️ ☑️ 🔘 ⚪ ⚫ 🔴 🟠 🟡 🟢 🔵 🟣 🟤 🔶 🔷 🔺 🔻 💠 🏁 🚩 🏴 🏳️ 🌈".split(" "),
  },
];

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [cat, setCat] = useState(0);

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#15152b]">
      {/* Category tabs */}
      <div className="flex items-center gap-1 border-b border-slate-100 px-2 py-1.5">
        {CATEGORIES.map((c, i) => (
          <button
            key={c.id}
            type="button"
            aria-label={c.id}
            onClick={() => setCat(i)}
            className={`grid h-8 w-8 place-items-center rounded-lg text-lg transition ${
              i === cat ? "bg-brand-100" : "hover:bg-slate-100 dark:hover:bg-white/[0.06]"
            }`}
          >
            {c.icon}
          </button>
        ))}
      </div>
      {/* Emoji grid */}
      <div className="grid max-h-44 grid-cols-8 gap-0.5 overflow-y-auto p-2">
        {CATEGORIES[cat].emojis.map((e, i) => (
          <button
            key={`${e}-${i}`}
            type="button"
            onClick={() => onPick(e)}
            className="grid h-9 w-9 place-items-center rounded-lg text-xl hover:bg-slate-100 dark:hover:bg-white/[0.06]"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
