import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/shared/GlassCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/lib/api";
import { ArrowLeft, Building2, CheckCircle2, Download, ExternalLink, Eye, FileCheck, Loader2, Package, ShieldCheck, Users, XCircle } from "lucide-react";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  joinDate: string;
};

type VerificationDoc = { status: string; notes?: string };
type EntityRecord = Record<string, unknown> & {
  slug?: string;
  company_name?: string;
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

export default function ApprovalsPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [mainTab, setMainTab] = useState("accounts");

  // Account approval state
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Doc verification state
  const [companies, setCompanies] = useState<EntityRecord[]>([]);
  const [suppliers, setSuppliers] = useState<EntityRecord[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    api.admin.getUsers().then(setUsers).catch(() => {}).finally(() => setLoadingUsers(false));
    Promise.all([
      api.admin.getCompanies().then((d) => setCompanies(d as EntityRecord[])),
      api.admin.getSuppliers().then((d) => setSuppliers(d as EntityRecord[])),
    ]).catch(() => {}).finally(() => setLoadingDocs(false));
  }, []);

  if (!user || user.role !== "admin") {
    return (
      <GlassCard interactive={false} className="p-6">
        <h1 className="text-lg font-semibold text-foreground">Approvals</h1>
        <p className="mt-1 text-sm text-muted-foreground">Admin only.</p>
      </GlassCard>
    );
  }

  const pendingUsers = users.filter((u) => u.status === "pending");
  const pendingCompanies = pendingUsers.filter((u) => u.role === "company");
  const pendingSuppliers = pendingUsers.filter((u) => u.role === "supplier");
  const pendingOther = pendingUsers.filter((u) => u.role !== "company" && u.role !== "supplier");

  const handleApprove = async (userId: string) => {
    try {
      await api.admin.updateUserStatus(userId, "active");
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: "active" } : u)));
    } catch {}
  };

  const handleReject = async (userId: string) => {
    try {
      await api.admin.updateUserStatus(userId, "banned");
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: "banned" } : u)));
    } catch {}
  };

  // Doc verification helpers
  const entitiesWithDocs = useMemo(() => {
    const result: { entity: EntityRecord; entityType: string; docs: { docType: string; url: string; status: string; notes: string }[] }[] = [];
    for (const c of companies) {
      const vDocs = (c.verification_documents ?? {}) as Record<string, string>;
      const vStatus = (c.verification ?? {}) as Record<string, VerificationDoc>;
      const docs: { docType: string; url: string; status: string; notes: string }[] = [];
      for (const [key, url] of Object.entries(vDocs)) {
        if (!url) continue;
        const docType = key.replace(/_url$/, "");
        const docInfo = vStatus[docType];
        docs.push({ docType, url, status: docInfo?.status ?? "pending", notes: docInfo?.notes ?? "" });
      }
      if (docs.length > 0) result.push({ entity: c, entityType: "company", docs });
    }
    for (const s of suppliers) {
      const vDocs = (s.verification_documents ?? {}) as Record<string, string>;
      const vStatus = (s.verification ?? {}) as Record<string, VerificationDoc>;
      const docs: { docType: string; url: string; status: string; notes: string }[] = [];
      for (const [key, url] of Object.entries(vDocs)) {
        if (!url) continue;
        const docType = key.replace(/_url$/, "");
        const docInfo = vStatus[docType];
        docs.push({ docType, url, status: docInfo?.status ?? "pending", notes: docInfo?.notes ?? "" });
      }
      if (docs.length > 0) result.push({ entity: s, entityType: "supplier", docs });
    }
    return result;
  }, [companies, suppliers]);

  const [docFilter, setDocFilter] = useState<"pending" | "all">("pending");

  const pendingVerifications = entitiesWithDocs.filter((e) => e.entity.verification_status !== "verified");
  const displayedVerifications = docFilter === "pending" ? pendingVerifications : entitiesWithDocs;

  const handleDownload = (url: string, docType: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${docType}.pdf`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDocAction = async (slug: string, entityType: string, docType: string, status: "approved" | "rejected", notes: string) => {
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
    } catch {}
    setActionLoading(null);
  };

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35 }}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-2 gap-1.5 rounded-xl text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Approvals</h1>
        <p className="text-sm text-muted-foreground">Review accounts and verify company/supplier documents.</p>
      </motion.div>

      {/* Main tabs: Accounts vs Document Verification */}
      <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="accounts" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Accounts ({pendingUsers.length})
          </TabsTrigger>
          <TabsTrigger value="verification" className="gap-1.5">
            <FileCheck className="h-3.5 w-3.5" />
            Verification ({pendingVerifications.length})
          </TabsTrigger>
        </TabsList>

        {/* ────── Account Approvals ────── */}
        <TabsContent value="accounts" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <GlassCard interactive={false} className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{pendingUsers.length}</p>
                <p className="text-xs text-muted-foreground">Total Pending</p>
              </div>
            </GlassCard>
            <GlassCard interactive={false} className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{pendingCompanies.length}</p>
                <p className="text-xs text-muted-foreground">Companies</p>
              </div>
            </GlassCard>
            <GlassCard interactive={false} className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{pendingSuppliers.length}</p>
                <p className="text-xs text-muted-foreground">Materials &amp; Suppliers</p>
              </div>
            </GlassCard>
          </div>

          {loadingUsers ? (
            <GlassCard interactive={false} className="p-6">
              <p className="text-muted-foreground">Loading...</p>
            </GlassCard>
          ) : pendingUsers.length === 0 ? (
            <GlassCard interactive={false} className="p-8 text-center">
              <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-success" />
              <h3 className="text-lg font-semibold text-foreground">All caught up!</h3>
              <p className="mt-1 text-sm text-muted-foreground">No pending account approvals.</p>
            </GlassCard>
          ) : (
            <Tabs defaultValue="all" className="space-y-4">
              <TabsList>
                <TabsTrigger value="all">All ({pendingUsers.length})</TabsTrigger>
                <TabsTrigger value="companies">Companies ({pendingCompanies.length})</TabsTrigger>
                <TabsTrigger value="suppliers">Materials &amp; Suppliers ({pendingSuppliers.length})</TabsTrigger>
                {pendingOther.length > 0 && <TabsTrigger value="other">Other ({pendingOther.length})</TabsTrigger>}
              </TabsList>
              {[
                { key: "all", list: pendingUsers },
                { key: "companies", list: pendingCompanies },
                { key: "suppliers", list: pendingSuppliers },
                { key: "other", list: pendingOther },
              ].map(({ key, list }) => (
                <TabsContent key={key} value={key}>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((u, idx) => (
                      <motion.div
                        key={u.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.08, 0.5), duration: 0.35 }}
                      >
                        <GlassCard className="p-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                              {u.role === "company" ? <Building2 className="h-5 w-5" /> : <Package className="h-5 w-5" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-foreground">{u.name}</p>
                              <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-[10px] capitalize">{u.role}</Badge>
                              <StatusBadge status={u.status as "pending"} />
                            </div>
                            <span className="text-xs text-muted-foreground">{u.joinDate}</span>
                          </div>
                          <div className="mt-4 flex gap-2">
                            <Button variant="default" size="sm" className="flex-1" onClick={() => handleApprove(u.id)}>
                              Approve
                            </Button>
                            <Button variant="destructive" size="sm" className="flex-1" onClick={() => handleReject(u.id)}>
                              Reject
                            </Button>
                          </div>
                        </GlassCard>
                      </motion.div>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </TabsContent>

        {/* ────── Document Verification ────── */}
        <TabsContent value="verification" className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant={docFilter === "pending" ? "default" : "outline"} size="sm" onClick={() => setDocFilter("pending")}>
              Pending ({pendingVerifications.length})
            </Button>
            <Button variant={docFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setDocFilter("all")}>
              All ({entitiesWithDocs.length})
            </Button>
          </div>
          {loadingDocs ? (
            <GlassCard interactive={false} className="p-6 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Loading entities…</p>
            </GlassCard>
          ) : displayedVerifications.length === 0 ? (
            <GlassCard interactive={false} className="p-8 text-center">
              <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-success" />
              <h3 className="text-lg font-semibold text-foreground">{docFilter === "pending" ? "All verified!" : "No documents found"}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{docFilter === "pending" ? "No pending document verifications." : "No entities have uploaded verification documents yet."}</p>
            </GlassCard>
          ) : (
            <div className="grid gap-4">
              {displayedVerifications.map(({ entity, entityType, docs }, idx) => {
                const entityName = (entity.company_name ?? entity.name ?? entity.slug ?? "Unknown") as string;
                const slug = entity.slug as string;
                return (
                  <motion.div
                    key={slug}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.08, 0.5), duration: 0.35 }}
                  >
                    <GlassCard interactive={false} className="p-5">
                      <div className="flex items-center gap-3">
                        {entity.logo_url ? (
                          <img
                            src={entity.logo_url as string}
                            alt=""
                            className="h-10 w-10 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            {entityType === "company" ? <Building2 className="h-5 w-5" /> : <Package className="h-5 w-5" />}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{entityName}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px] capitalize">{entityType}</Badge>
                            {entity.city && <span className="text-xs text-muted-foreground">{entity.city as string}</span>}
                            <StatusBadge status={(entity.verification_status ?? "not_submitted") as "pending"} />
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {docs.map((doc) => {
                          const loading = actionLoading === `${slug}-${doc.docType}`;
                          return (
                            <div
                              key={doc.docType}
                              className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background/30 p-3"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-foreground">
                                  {DOC_LABELS[doc.docType] ?? doc.docType}
                                </p>
                                <div className="mt-1 flex items-center gap-2">
                                  <a
                                    href={doc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                                  >
                                    <Eye className="h-3 w-3" /> View
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => handleDownload(doc.url, doc.docType)}
                                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                                  >
                                    <Download className="h-3 w-3" /> Download
                                  </button>
                                </div>
                              </div>
                              <StatusBadge status={doc.status as "pending"} />
                              {doc.status !== "approved" && (
                                <div className="flex gap-1.5">
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="h-7 gap-1 text-xs"
                                    disabled={loading}
                                    onClick={() => handleDocAction(slug, entityType, doc.docType, "approved", "")}
                                  >
                                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                    Approve
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    className="h-7 gap-1 text-xs"
                                    disabled={loading}
                                    onClick={() => handleDocAction(slug, entityType, doc.docType, "rejected", "")}
                                  >
                                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                                    Reject
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </GlassCard>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
