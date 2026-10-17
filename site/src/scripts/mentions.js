// منشن الليدرز بالمنشورات: @TFC لأدمن المنصة، و@السفير لليدر الجامعة.
// منفصل عن spaces.ts عشان ينفحص بـnode:test.

export const TAG = /@([\p{L}A-Za-z]{2,24})/gu;

/** نص منشور → مين من الليدرز انذكر فيه */
export function leaderMentions(text) {
  const tags = [...String(text).matchAll(TAG)].map((m) => m[1]);
  return { tfc: tags.some((t) => t.toLowerCase() === 'tfc'), amb: tags.includes('السفير') };
}
