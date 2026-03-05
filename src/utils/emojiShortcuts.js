/**
 * Emoji lühikäsklused :kood: → emoji. Kasutatakse noodimärgistuste kiire sisestamiseks.
 */

export const EMOJI_SHORTCUTS = {
  joy: '😊',
  star: '⭐',
  heart: '❤️',
  music: '🎵',
  note: '🎶',
  check: '✅',
  question: '❓',
  box: '⬜',
  clap: '👏',
  fire: '🔥',
  sun: '☀️',
  moon: '🌙',
  thumbsup: '👍',
  thumbsdown: '👎',
  smile: '😄',
  thinking: '🤔',
  target: '🎯',
  trophy: '🏆',
  pencil: '✏️',
  book: '📖',
};

/**
 * Asendab teksti sees olevad :kood: vastavate emojidega.
 * @param {string} text - Sisend (nt "Tere :joy: ja :heart:")
 * @returns {string} - Asendatud tekst (nt "Tere 😊 ja ❤️")
 */
export function expandEmojiShortcuts(text) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(/:([a-z0-9_]+):/gi, (_, code) => {
    const emoji = EMOJI_SHORTCUTS[code.toLowerCase()];
    return emoji != null ? emoji : `:${code}:`;
  });
}

/**
 * Kas string on täielik lühikäsklus (algab ja lõpeb kooloniga, sisaldab ainult tähti/numbreid).
 */
export function isEmojiShortcut(text) {
  return /^:[a-z0-9_]+:$/i.test(String(text).trim());
}

/**
 * Tagastab lühikäskluse emoji või null.
 */
export function getEmojiFromShortcut(code) {
  const key = String(code).replace(/^:|:$/g, '').toLowerCase();
  return EMOJI_SHORTCUTS[key] ?? null;
}

export default expandEmojiShortcuts;
