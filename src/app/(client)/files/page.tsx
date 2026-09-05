"use client";

import React from "react";
import { formatDate } from "@/lib/formatters";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useData } from "@/components/providers/DataProvider";
import { getDocumentUrl } from "@/lib/db";
import { useAuth } from "@/components/providers/AuthProvider";

export default function FilesPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { myClient, myProjects, documents: allDocuments, loading } = useData();
  const client = myClient;

  // `doc_client_read` only checks client_id, so a file attached to a project
  // that is still hidden would otherwise be listed here. Keep client-level
  // files (no project) and files belonging to a project they can actually see.
  const visibleProjectIds = new Set(myProjects.map((p) => p.id));

  const documents = client
    ? allDocuments.filter(
        (d) =>
          d.client_id === client.id &&
          d.visibility === "client" &&
          (!d.project_id || visibleProjectIds.has(d.project_id))
      )
    : [];

  const handleOpen = async (storagePath: string) => {
    try {
      const url = await getDocumentUrl(storagePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not open file");
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return "—";
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  };


  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-[32px] text-ink-950 font-normal">
          Files
        </h1>
        <p className="text-[14px] text-ink-600 font-sans mt-1">
          Contracts, deliverables, and project assets shared with you.
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="border border-dashed border-ink-200 rounded-md p-8 text-center text-ink-500 text-[14px]">
          Contracts, designs and reports appear here as they&apos;re shared. Nothing yet.
        </div>
      ) : (
        <div className="border-t border-ink-100 divide-y divide-ink-100">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <h3 className="text-[15px] font-medium text-ink-950 font-sans">
                  {doc.title}
                </h3>
                <p className="text-[13px] text-ink-500 font-sans mt-0.5">
                  <span className="capitalize">{doc.category}</span> ·{" "}
                  {formatDate(doc.created_at, "monthday")} · {formatFileSize(doc.size_bytes)}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleOpen(doc.storage_path)}
                className="self-start sm:self-center"
              >
                Download
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
