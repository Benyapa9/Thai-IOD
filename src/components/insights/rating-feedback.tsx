"use client";

import { Send, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/form";
import { Spinner } from "@/components/ui/misc";
import { RATING_REASONS } from "@/lib/rating-reasons";
import { cn } from "@/lib/utils";

/**
 * Popup after 👍 / 👎 on an insight: an optional quick reason and comment,
 * sent with the rating so tomorrow's picks can learn from it. The rating
 * itself is already saved when the popup opens; this only adds detail.
 */
export function RatingFeedbackDialog({
  rating,
  insightTitle,
  busy,
  onSubmit,
  onClose,
}: {
  /** null = closed */
  rating: 1 | -1 | null;
  insightTitle: string;
  busy: boolean;
  onSubmit: (reason: string | null, comment: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const up = rating === 1;
  const reasons = up ? RATING_REASONS.up : RATING_REASONS.down;

  return (
    <Dialog open={rating !== null} onClose={onClose} title={up ? "ขอบคุณที่บอกว่าตอบโจทย์" : "ขอบคุณสำหรับความเห็น"} className="max-w-md">
      <div className="flex items-start gap-3">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-white", up ? "bg-success" : "bg-danger")} aria-hidden>
          {up ? <ThumbsUp className="size-4" /> : <ThumbsDown className="size-4" />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-navy-900">{insightTitle}</p>
          <p className="text-xs text-muted-foreground">
            {up ? "บอกเพิ่มได้ว่าส่วนไหนช่วยได้ ระบบจะเลือกเรื่องแบบนี้ให้บ่อยขึ้น" : "บอกเพิ่มได้ว่าเพราะอะไร ระบบจะเลือกเรื่องอื่นที่ตรงกับคุณมากขึ้น"}
          </p>
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className="text-xs font-semibold text-navy-800">เหตุผล (เลือกได้ 1 ข้อ ไม่บังคับ)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {reasons.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={reason === r.key}
              onClick={() => setReason(reason === r.key ? null : r.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                reason === r.key ? "border-navy-800 bg-navy-800 text-white" : "border-border bg-white text-navy-800 hover:bg-navy-50",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="mt-4 block text-xs font-semibold text-navy-800" htmlFor="rating-comment">
        ความเห็นเพิ่มเติม (ไม่บังคับ)
      </label>
      <Textarea
        id="rating-comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder={up ? "เช่น อยากเห็นข้อมูลแบบนี้ของหน่วยงานอื่นด้วย" : "เช่น เรื่องนี้ไม่ใช่ความรับผิดชอบของแผนกฉัน"}
        className="mt-1 text-sm"
      />

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          ข้าม
        </Button>
        <Button onClick={() => onSubmit(reason, comment.trim())} disabled={busy || (!reason && !comment.trim())}>
          {busy ? <Spinner className="text-white" /> : <Send />} ส่งความเห็น
        </Button>
      </div>
    </Dialog>
  );
}
