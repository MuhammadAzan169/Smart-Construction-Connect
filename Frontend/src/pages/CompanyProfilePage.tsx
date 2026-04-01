import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { GlassCard } from "@/components/shared/GlassCard";
import { MatchScoreRing } from "@/components/shared/MatchScoreRing";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mockCompanies } from "@/data/mockData";
import { ArrowLeft, Building2, MapPin, Star } from "lucide-react";

type Company = (typeof mockCompanies)[number];

export default function CompanyProfilePage() {
  const navigate = useNavigate();
  const params = useParams();

  const company: Company | undefined = useMemo(() => {
    const id = params.id;
    if (!id) return undefined;
    return mockCompanies.find((c) => c.id === id);
  }, [params.id]);

  if (!company) {
    return (
      <GlassCard interactive={false} className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Company not found</h1>
            <p className="mt-1 text-sm text-muted-foreground">This company ID doesn’t exist in the current dataset.</p>
          </div>
          <Button asChild variant="secondary">
            <Link to="/companies">Back to browse</Link>
          </Button>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            {company.verified ? <StatusBadge status="verified" /> : null}
          </div>

          <h1 className="mt-4 truncate text-2xl font-bold text-foreground">{company.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {company.location}
            </span>
            <span className="inline-flex items-center gap-1">
              <Star className="h-4 w-4 fill-warning text-warning" />
              <span className="font-semibold text-foreground">{company.rating}</span>
              <span>({company.reviews} reviews)</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              Established {company.yearEstablished}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <MatchScoreRing score={company.matchScore} size={64} />
          <Button type="button">Request quote</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <GlassCard className="overflow-hidden p-0">
          <div className="relative h-56 overflow-hidden">
            <img src={company.image} alt={company.name} className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/70 to-transparent" />
          </div>
          <div className="space-y-4 p-6">
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground">OVERVIEW</p>
              <p className="mt-2 text-sm text-foreground">
                This profile is generated from demo data. Add real company descriptions, services, and portfolio entries when you connect your backend.
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground">SPECIALTIES</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {company.specialization.map((s) => (
                  <Badge key={s} variant="secondary" className="rounded-lg">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background/30 p-4">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">PRICING RANGE</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{company.priceRange}</p>
                <p className="mt-1 text-xs text-muted-foreground">Rates may vary by area, package, and specs.</p>
              </div>
              <div className="rounded-2xl border border-border bg-background/30 p-4">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">COMPLETED PROJECTS</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{company.completedProjects.toLocaleString()}</p>
                <p className="mt-1 text-xs text-muted-foreground">Reported historical deliveries.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background/30 p-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground">SERVICES</p>
              <p className="mt-2 text-sm text-foreground">Not provided in current mock dataset.</p>
            </div>

            <div className="rounded-2xl border border-border bg-background/30 p-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground">PORTFOLIO / PROJECTS</p>
              <p className="mt-2 text-sm text-foreground">Not provided in current mock dataset.</p>
            </div>
          </div>
        </GlassCard>

        <div className="space-y-4">
          <GlassCard interactive={false} className="p-6">
            <p className="text-sm font-semibold text-foreground">Contact</p>
            <p className="mt-2 text-sm text-muted-foreground">Contact information is not available in the current mock dataset.</p>
          </GlassCard>

          <GlassCard interactive={false} className="p-6">
            <p className="text-sm font-semibold text-foreground">Availability / Status</p>
            <p className="mt-2 text-sm text-muted-foreground">Availability is not available in the current mock dataset.</p>
          </GlassCard>

          <GlassCard interactive={false} className="p-6">
            <p className="text-sm font-semibold text-foreground">Ratings & Reviews</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {company.rating} average rating across {company.reviews} reviews.
            </p>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
