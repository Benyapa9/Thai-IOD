"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, History, Trash2 } from "lucide-react";
import { useState } from "react";
import { useCan } from "@/components/layout/user-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorBlock, LoadingBlock } from "@/components/ui/misc";
import { SortTh, useSort } from "@/components/ui/sortable";
import { Td } from "@/components/ui/table";
import { type ClientUpload, keys, useUploads } from "@/hooks/queries";
import { api } from "@/lib/api";
import { SLOT_BY_KEY } from "@/lib/upload-slots";
import { cn, formatDate } from "@/lib/utils";

const uploaderOf = (u: ClientUpload) => (u.uploadedBy === "system" ? "นำเข้าจากโฟลเดอร์" : (u.uploaderName ?? "-"));

/** Upload history (MOM U4): collapsed by default, header shows count, last date and uploader. */
export function UploadHistory() {
  const { data: uploads = [], isLoading, error } = useUploads();
  const canDelete = useCan("upload.delete");
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: (id: string) => api.send(`/api/upload/${id}`, "DELETE"),
    onSuccess: () => {
      for (const k of [["summary"], ["records"], ["insights"], ["dashboard"], keys.uploads]) void qc.invalidateQueries({ queryKey: k });
    },
  });
  const { sorted, sort, toggle } = useSort(
    uploads,
    {
      file: (u: ClientUpload) => u.originalName,
      type: (u: ClientUpload) => (u.slot ? SLOT_BY_KEY[u.slot]?.name : "ข้อมูลการเงิน"),
      by: (u: ClientUpload) => uploaderOf(u),
      date: (u: ClientUpload) => +new Date(u.createdAt),
      rows: (u: ClientUpload) => u.recordCount,
    },
    { key: "date", dir: "desc" },
  );
  const latest = [...uploads].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  return (
    <Card className="mt-6">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-left cursor-pointer"
      >
        <History className="size-4 text-navy-600" />
        <span className="text-sm font-semibold text-navy-900">ประวัติการอัปโหลด</span>
        <span className="rounded-full bg-navy-100 px-2 py-0.5 text-xs font-medium text-navy-800">{uploads.length} ครั้ง</span>
        {latest && (
          <span className="text-xs text-muted-foreground">
            ล่าสุด {formatDate(latest.createdAt)} โดย {uploaderOf(latest)}
          </span>
        )}
        <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-border">
          {isLoading ? (
            <LoadingBlock />
          ) : error ? (
            <div className="p-4">
              <ErrorBlock error={error} />
            </div>
          ) : (
            <div className="max-h-[480px] overflow-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0">
                  <tr>
                    <SortTh label="ไฟล์" sortKey="file" sort={sort} onSort={toggle} />
                    <SortTh label="ประเภท" sortKey="type" sort={sort} onSort={toggle} />
                    <SortTh label="ผู้อัปโหลด" sortKey="by" sort={sort} onSort={toggle} />
                    <SortTh label="วันที่" sortKey="date" sort={sort} onSort={toggle} />
                    <SortTh label="รายการที่นำเข้า" sortKey="rows" sort={sort} onSort={toggle} align="right" />
                    {canDelete && <th className="border-b border-border bg-navy-50" />}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((u) => (
                    <tr key={u.id}>
                      <Td className="font-medium text-navy-900">{u.originalName}</Td>
                      <Td className="text-xs">{u.slot ? SLOT_BY_KEY[u.slot]?.name : "ข้อมูลการเงิน"}</Td>
                      <Td className="whitespace-nowrap">{uploaderOf(u)}</Td>
                      <Td className="whitespace-nowrap">{formatDate(u.createdAt)}</Td>
                      <Td className="text-right tabular-nums">{u.recordCount ? u.recordCount.toLocaleString() : "—"}</Td>
                      {canDelete && (
                        <Td className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="ลบ"
                            disabled={remove.isPending}
                            onClick={() => {
                              if (confirm(`ลบไฟล์ ${u.originalName} และข้อมูลที่นำเข้าจากไฟล์นี้?`)) remove.mutate(u.id);
                            }}
                          >
                            <Trash2 className="text-danger" />
                          </Button>
                        </Td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
