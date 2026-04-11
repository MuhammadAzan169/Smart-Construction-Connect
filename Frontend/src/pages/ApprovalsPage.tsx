import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { GlassCard } from "@/components/shared/GlassCard";
import { PdfViewerDialog } from "@/components/shared/PdfViewerDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import {
  AlertTriangle, ArrowLeft, Building2, CheckCircle2, Clock, Download, Eye, FileCheck,
  Loader2, Package, RefreshCw, ShieldCheck, XCircle,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type VerificationDoc = { status: string; notes?: string };
type EntityRecord = Record<string, unknown> & {
  slug?: string;
  company_name?: string;
  supplier_name?: string;
  name?: string;
  logo_url?: string;
  city?: string;
  verification_status?: string;
  verification?: Record<string, VerificationDoc>;
  verification_documents?: Record<string, string>;
};

const DOC_LABELS: Record<string, string> = {
  secp_certificate: "SECP Certificate",
  ntn_certificate: "NTN Certificate",
  registration_certificate: "Registration Certificate",
  business_license: "Business License",
};

/* ================================================================== */
/*  Main Component                                                     */
/* ================================================================== */

export default function ApprovalsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  /* Doc verification */
  const [companies, setCompanies] = useState<EntityRecord[]>([]);
  const [suppliers, setSuppliers] = useState<EntityRecord[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [docFilter, setDocFilter] = useState<"pending" | "all">("pending");
  const [pdfViewer, setPdfViewer] = useState<{ url: string; title: string } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [rejectDialog, setRejectDialog] = useState<{ slug: string; entityType: string; docType: string } | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const { toast } = useToast();

  const loadData = () => {
    setLoadingDocs(true);
    setLoadError(false);
    Promise.all([
      api.admin.getCompanies().then((d) => setCompanies(d as EntityRecord[])),
      api.admin.getSuppliers().then((d) => setSuppliers(d as EntityRecord[])),
    ]).catch(() => {
      setLoadError(true);
    }).finally(() => setLoadingDocs(false));
  };

  useEffect(() => { loadData(); }, []);

  /* ---------- Guard ---------- */
  if (!user || user.role !== "admin") {
    return (
      <GlassCard interactive={false} className="p-6">
        <h1 className="text-lg font-semibold text-foreground">Approvals</h1>
        <p className="mt-1 text-sm text-muted-foreground">Admin access required.</p>
      </GlassCard>
    );
  }

  /* ---------- Doc verification helpers ---------- */
  const entitiesWithDocs = useMemo(() => {
    const result: {
      entity: EntityRecord;
      entityType: string;
      docs: { docType: string; url: string; status: string; notes: string }[];
      isVerified: boolean;
    }[] = [];

    const process = (list: EntityRecord[], type: string) => {
      for (const e of list) {
        const vDocs = (e.verification_documents ?? {}) as Record<string, string>;
        const vStatus = (e.verification ?? {}) as Record<string, VerificationDoc>;
        const docs: { docType: string; url: string; status: string; notes: string }[] = [];
        for (const [key, url] of Object.entries(vDocs)) {
          if (!url) continue;
          const docType = key.replace(/_url$/, "");
          const docInfo = vStatus[docType];
          docs.push({ docType, url, status: docInfo?.status ?? "pending", notes: docInfo?.notes ?? "" });
        }
        if (docs.length > 0) {
          result.push({
            entity: e,
            entityType: type,
            docs,
            isVerified: e.verification_status === "verified",
          });
        }
      }
    };

    process(companies, "company");
    process(suppliers, "supplier");
    return result;
  }, [companies, suppliers]);

  /* "Pending" = has docs but NOT yet fully verified */
  const pendingVerifications = entitiesWithDocs.filter((e) => !e.isVerified);
  const displayedVerifications = docFilter === "pending" ? pendingVerifications : entitiesWithDocs;

  const handleDocAction = async (
    slug: string,
    entityType: string,
    docType: string,
    status: "approved" | "rejected",
    notes = "",
  ) => {
    const key = `${slug}-${docType}`;
    setActionLoading(key);
    try {
      const res = await api.admin.updateVerification(slug, entityType, docType, status, notes);
      const setter = entityType === "company" ? setCompanies : setSuppliers;
      setter((prev) =>
        prev.map((e) => {
          if (e.slug !== slug) return e;
          const verification = { ...(e.verification ?? {}) };
          verification[docType] = { status, notes };
          return { ...e, verification, verification_status: res.verification_status };
        }),
      );
      toast({
        title: status === "approved" ? "Document approved" : "Document rejected",
        description: status === "approved" ? "The document has been approved successfully." : "The document has been rejected.",
        variant: status === "rejected" ? "destructive" : "default",
      });
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : "Could not update document status. Please try again.",
        variant: "destructive",
      });
    }
    setActionLoading(null);
  };

  /* ================================================================ */
  return (
    <>
      <motion.div
        className="space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        {/* ===== PAGE HEADER ===== */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.35 }}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mb-3 gap-1.5"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-foreground">{t("approvals.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review and approve company / supplier verification documents.
          </p>
        </motion.div>

        {/* ===== DOCUMENT VERIFICATION ===== */}
        <div className="space-y-5">
            {/* Summary + filter */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid gap-3 sm:grid-cols-2 flex-1">
                <SummaryCard
                  icon={<Clock className="h-5 w-5" />}
                  label="Awaiting Review"
                  value={pendingVerifications.length}
                  color="amber"
                />
                <SummaryCard
                  icon={<ShieldCheck className="h-5 w-5" />}
                  label="Verified Entities"
                  value={entitiesWithDocs.filter((e) => e.isVerified).length}
                  color="emerald"
                />
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-1 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setDocFilter("pending")}
                  className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
                    docFilter === "pending"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Pending ({pendingVerifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDocFilter("all")}
                  className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
                    docFilter === "all"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All ({entitiesWithDocs.length})
                </button>
              </div>
            </div>

            {loadingDocs ? (
              <LoadingState />
            ) : loadError ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 py-14 text-center">
                <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-destructive/60" />
                <h3 className="text-base font-semibold text-foreground">Failed to load documents</h3>
                <p className="mt-1 text-sm text-muted-foreground">Could not connect to the server. Check your connection and try again.</p>
                <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={loadData}>
                  <RefreshCw className="h-3.5 w-3.5" /> Retry
                </Button>
              </div>
            ) : displayedVerifications.length === 0 ? (
              <EmptyState
                icon={<ShieldCheck className="mx-auto mb-4 h-12 w-12 text-green-500" />}
                title={docFilter === "pending" ? "All documents reviewed!" : "No documents found"}
                description={
                  docFilter === "pending"
                    ? "There are no pending document verifications."
                    : "No entities have uploaded verification documents yet."
                }
              />
            ) : (
              <div className="space-y-4">
                {displayedVerifications.map(({ entity, entityType, docs, isVerified }, idx) => {
                  const entityName = (
                    entity.company_name ?? entity.supplier_name ?? entity.name ?? entity.slug ?? "Unknown"
                  ) as string;
                  const slug = entity.slug as string;
                  const pendingDocCount = docs.filter((d) => d.status === "pending").length;
                  const approvedDocCount = docs.filter((d) => d.status === "approved").length;

                  return (
                    <motion.div
                      key={slug}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.07, 0.4), duration: 0.3 }}
                    >
                      <div className={`overflow-hidden rounded-2xl border bg-card shadow-sm ${
                        isVerified ? "border-green-500/30" : "border-border"
                      }`}>
                        {/* Entity header */}
                        <div className={`flex items-center gap-4 px-5 py-4 ${
                          isVerified ? "bg-green-500/5" : "bg-card"
                        }`}>
                          {entity.logo_url ? (
                            <img
                              src={entity.logo_url as string}
                              alt=""
                              className="h-11 w-11 rounded-xl object-cover"
                            />
                          ) : (
                            <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-white ${
                              entityType === "company" ? "bg-blue-500" : "bg-emerald-500"
                            }`}>
                              {entityType === "company"
                                ? <Building2 className="h-5 w-5" />
                                : <Package className="h-5 w-5" />
                              }
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold text-foreground">{entityName}</p>
                              {isVerified && <ShieldCheck className="h-4 w-4 shrink-0 text-green-500" />}
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <Badge variant="secondary" className="text-[10px] capitalize">{entityType}</Badge>
                              {entity.city && (
                                <span className="text-xs text-muted-foreground">{entity.city as string}</span>
                              )}
                            </div>
                          </div>

                          {/* Status pill */}
                          <div className={`shrink-0 rounded-lg px-3 py-1 text-xs font-semibold ${
                            isVerified
                              ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                              : pendingDocCount > 0
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                                : "bg-secondary text-muted-foreground"
                          }`}>
                            {isVerified
                              ? "Verified"
                              : pendingDocCount > 0
                                ? `${pendingDocCount} Pending`
                                : "Not Verified"}
                          </div>
                        </div>

                        <Separator />

                        {/* Documents list */}
                        <div className="space-y-0 p-4">
                          {/* Progress indicator */}
                          {!isVerified && (
                            <div className="mb-3">
                              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                <span>{approvedDocCount}/{docs.length} documents approved</span>
                                <span>{Math.round((approvedDocCount / docs.length) * 100)}%</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-secondary">
                                <div
                                  className="h-1.5 rounded-full bg-green-500 transition-all duration-500"
                                  style={{ width: `${(approvedDocCount / docs.length) * 100}%` }}
                                />
                              </div>
                            </div>
                          )}

                          <div className="space-y-2">
                            {docs.map((doc) => {
                              const loading = actionLoading === `${slug}-${doc.docType}`;
                              const isApproved = doc.status === "approved";
                              const isRejected = doc.status === "rejected";

                              return (
                                <div
                                  key={doc.docType}
                                  className={`flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
                                    isApproved
                                      ? "bg-green-500/5 border border-green-500/20"
                                      : isRejected
                                        ? "bg-destructive/5 border border-destructive/20"
                                        : "bg-secondary/30 border border-border"
                                  }`}
                                >
                                  {/* Doc status icon */}
                                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                    isApproved
                                      ? "bg-green-100 text-green-600 dark:bg-green-950/50 dark:text-green-400"
                                      : isRejected
                                        ? "bg-destructive/10 text-destructive"
                                        : "bg-secondary text-muted-foreground"
                                  }`}>
                                    {isApproved
                                      ? <CheckCircle2 className="h-4 w-4" />
                                      : isRejected
                                        ? <XCircle className="h-4 w-4" />
                                        : <FileCheck className="h-4 w-4" />
                                    }
                                  </div>

                                  {/* Doc name */}
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-foreground">
                                      {DOC_LABELS[doc.docType] ?? doc.docType}
                                    </p>
                                    <p className={`text-xs font-medium ${
                                      isApproved
                                        ? "text-green-600 dark:text-green-400"
                                        : isRejected
                                          ? "text-destructive"
                                          : "text-amber-600 dark:text-amber-400"
                                    }`}>
                                      {isApproved ? "Approved" : isRejected ? "Rejected" : "Pending review"}
                                    </p>
                                  </div>

                                  {/* View / Download */}
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setPdfViewer({ url: doc.url, title: DOC_LABELS[doc.docType] ?? doc.docType })}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10 transition-colors"
                                      title="View document"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </button>
                                    <a
                                      href={doc.url}
                                      download={`${doc.docType}.${doc.url.split("?")[0].split(".").pop() ?? "file"}`}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10 transition-colors"
                                      title="Download document"
                                    >
                                      <Download className="h-4 w-4" />
                                    </a>
                                  </div>

                                  {/* Action buttons — only if entity is NOT verified AND doc is not already approved */}
                                  {!isVerified && !isApproved && (
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="default"
                                        size="sm"
                                        className="h-8 gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs"
                                        disabled={loading}
                                        onClick={() => handleDocAction(slug, entityType, doc.docType, "approved")}
                                      >
                                        {loading
                                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          : <CheckCircle2 className="h-3.5 w-3.5" />
                                        }
                                        Approve
                                      </Button>
                                      {!isRejected && (
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          className="h-8 gap-1.5 text-xs"
                                          disabled={loading}
                                          onClick={() => { setRejectNote(""); setRejectDialog({ slug, entityType, docType: doc.docType }); }}
                                        >
                                          {loading
                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            : <XCircle className="h-3.5 w-3.5" />
                                          }
                                          Reject
                                        </Button>
                                      )}
                                      {isRejected && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-8 gap-1.5 text-xs"
                                          disabled={loading}
                                          onClick={() => handleDocAction(slug, entityType, doc.docType, "approved")}
                                        >
                                          Re-approve
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
        </div>
      </motion.div>

      {pdfViewer && (
        <PdfViewerDialog
          open
          onClose={() => setPdfViewer(null)}
          url={pdfViewer.url}
          title={pdfViewer.title}
        />
      )}

      {/* Rejection notes dialog */}
      {rejectDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setRejectDialog(null)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Reject Document</h3>
                <p className="text-xs text-muted-foreground">{DOC_LABELS[rejectDialog.docType] ?? rejectDialog.docType}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-3">Optionally provide a reason for rejection. This will be visible to the entity owner.</p>
            <Textarea
              placeholder="Reason for rejection (optional)…"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              className="mb-4 min-h-[80px] resize-none text-sm"
              maxLength={500}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRejectDialog(null)} className="rounded-xl">
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="rounded-xl"
                onClick={() => {
                  handleDocAction(rejectDialog.slug, rejectDialog.entityType, rejectDialog.docType, "rejected", rejectNote.trim());
                  setRejectDialog(null);
                }}
              >
                Reject
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ================================================================== */
/*  Sub-components                                                     */
/* ================================================================== */

function SummaryCard({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "amber" | "blue" | "emerald";
}) {
  const colors = {
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
  };
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-card py-16 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">Loading…</span>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card py-16 text-center">
      {icon}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
