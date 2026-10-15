/**
 * Quick reasons offered after 👍 / 👎 on an insight. Stored with the rating
 * (InsightRating.reason) so the picker can learn more than "liked / disliked".
 */
export const RATING_REASONS = {
  up: [
    { key: "helps_decision", label: "ช่วยตัดสินใจได้" },
    { key: "relevant", label: "ตรงกับงานของฉัน" },
    { key: "more_like_this", label: "อยากเห็นแบบนี้อีก" },
  ],
  down: [
    { key: "not_relevant", label: "ไม่เกี่ยวกับงานของฉัน" },
    { key: "already_known", label: "รู้อยู่แล้ว" },
    { key: "data_wrong", label: "ข้อมูลไม่ถูกต้อง" },
    { key: "need_detail", label: "อยากได้รายละเอียดมากกว่านี้" },
  ],
} as const;

export const RATING_REASON_KEYS = [...RATING_REASONS.up, ...RATING_REASONS.down].map((r) => r.key) as [string, ...string[]];

/** How strongly one rating moves its kind of insight up / down: a clear "more like this" or "not my job" counts double. */
export function ratingWeight(r: { rating: number; reason?: string | null }) {
  return r.rating * (r.reason === "more_like_this" || r.reason === "not_relevant" ? 2 : 1);
}
