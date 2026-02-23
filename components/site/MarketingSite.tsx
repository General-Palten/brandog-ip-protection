import React from 'react';
import { ArrowRight, BadgeCheck, Globe, Shield, Siren, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ShadButton } from '../ui/shadcn-button';
import { ShadCard, ShadCardContent, ShadCardDescription, ShadCardHeader, ShadCardTitle } from '../ui/shadcn-card';

const trustMetrics = [
  { label: 'Channels Monitored', value: '35+' },
  { label: 'Avg. First Detection', value: '< 4h' },
  { label: 'Case Resolution Lift', value: '2.8x' },
  { label: 'Revenue Preserved', value: '$3.2M+' },
];

const capabilityCards = [
  {
    title: 'Detection Queue',
    description: 'Ingest and score suspicious listings, ads, and social handles from one triage view.',
    icon: Siren,
  },
  {
    title: 'Evidence-First Cases',
    description: 'Track chain-of-evidence, owner notes, and legal updates in one unified case timeline.',
    icon: Shield,
  },
  {
    title: 'Enforcement Workflows',
    description: 'Run platform actions, batch decisions, and progress updates with SLA visibility.',
    icon: BadgeCheck,
  },
];

const MarketingSite: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-primary">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface">
              <Shield size={16} />
            </div>
            <span className="font-serif text-lg font-medium tracking-tight">Brandog</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/app">
              <ShadButton variant="ghost" size="sm">
                Open Console
              </ShadButton>
            </Link>
            <Link to="/app">
              <ShadButton size="sm">
                Book Demo
                <ArrowRight size={14} className="ml-1.5" />
              </ShadButton>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(24,24,27,0.06),transparent_55%),radial-gradient(circle_at_80%_0%,rgba(24,24,27,0.04),transparent_40%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-2 lg:py-24">
            <div>
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium uppercase tracking-wider text-secondary">
                <Globe size={12} />
                Brand Protection Operations
              </p>
              <h1 className="max-w-2xl font-serif text-4xl font-medium tracking-tight sm:text-5xl">
                Stop copycats faster with evidence-first enforcement workflows.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-secondary">
                Brandog combines real-time detection, case triage, and takedown execution in one white-label console
                for legal and brand teams.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/app">
                  <ShadButton>
                    Get Started
                    <ArrowRight size={14} className="ml-1.5" />
                  </ShadButton>
                </Link>
                <Link to="/app">
                  <ShadButton variant="outline">See Product Tour</ShadButton>
                </Link>
              </div>
            </div>

            <ShadCard className="bg-surface/60">
              <ShadCardHeader>
                <ShadCardTitle className="text-2xl">Executive Snapshot</ShadCardTitle>
                <ShadCardDescription>What leadership teams monitor every morning.</ShadCardDescription>
              </ShadCardHeader>
              <ShadCardContent className="grid grid-cols-2 gap-3">
                {trustMetrics.map(metric => (
                  <div key={metric.label} className="rounded-lg border border-border bg-background p-4">
                    <p className="text-2xl font-semibold tracking-tight">{metric.value}</p>
                    <p className="mt-1 text-xs uppercase tracking-wider text-secondary">{metric.label}</p>
                  </div>
                ))}
              </ShadCardContent>
            </ShadCard>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-16">
          <div className="mb-10 max-w-3xl">
            <h2 className="font-serif text-3xl font-medium tracking-tight">Built for the full enforcement lifecycle</h2>
            <p className="mt-3 text-secondary">
              Structured like high-performing brand protection teams: detect, prioritize, enforce, and report outcomes.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {capabilityCards.map(card => (
              <ShadCard key={card.title}>
                <ShadCardHeader>
                  <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface">
                    <card.icon size={16} />
                  </div>
                  <ShadCardTitle>{card.title}</ShadCardTitle>
                  <ShadCardDescription>{card.description}</ShadCardDescription>
                </ShadCardHeader>
              </ShadCard>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-surface/40">
          <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 lg:grid-cols-2">
            <div>
              <h3 className="font-serif text-2xl font-medium tracking-tight">Priority channels</h3>
              <ul className="mt-4 space-y-3 text-sm text-secondary">
                <li>Marketplaces and social commerce monitoring</li>
                <li>Domain and storefront impersonation detection</li>
                <li>Cross-channel actor clustering and escalation flags</li>
                <li>Evidence export for legal and platform submissions</li>
              </ul>
            </div>
            <div>
              <h3 className="font-serif text-2xl font-medium tracking-tight">Operational outcomes</h3>
              <ul className="mt-4 space-y-3 text-sm text-secondary">
                <li className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-primary" />
                  Faster first action times with a central queue
                </li>
                <li className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-primary" />
                  Better resolution rates through structured handoffs
                </li>
                <li className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-primary" />
                  Clear revenue-at-risk and protection reporting
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-16">
          <ShadCard className="bg-primary text-inverse">
            <ShadCardContent className="flex flex-col items-start justify-between gap-6 p-8 md:flex-row md:items-center">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-inverse/70">Next Step</p>
                <h3 className="mt-2 font-serif text-3xl font-medium tracking-tight">See Brandog on your workflows</h3>
                <p className="mt-2 text-sm text-inverse/80">
                  Bring your current channels, case volumes, and enforcement goals. We will map rollout in one session.
                </p>
              </div>
              <Link to="/app">
                <ShadButton variant="secondary" className="bg-inverse text-primary hover:bg-inverse/90">
                  Open Product Console
                  <ArrowRight size={14} className="ml-1.5" />
                </ShadButton>
              </Link>
            </ShadCardContent>
          </ShadCard>
        </section>
      </main>
    </div>
  );
};

export default MarketingSite;
