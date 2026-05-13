"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ChooseAudienceStep } from "./_components/choose-audience-step";
import { SignUpFormStep, type Audience } from "./_components/sign-up-form-step";
import { ConfirmationStep } from "./_components/confirmation-step";

type Step = "audience" | "form" | "confirm";

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface ScheduleEntry {
  weekday: Weekday;
  time: string; // "HH:MM"
}

export type Plan = "light" | "standard" | "premium";

export interface SignUpData {
  audience: Audience;
  plan: Plan;
  recipientName: string;
  // Western year (e.g. 1948). Used to normalize cognitive observations and
  // research data; not used for tone-of-voice in the LP. Required at signup.
  recipientBirthYear: number;
  recipientPhone: string;
  schedule: ScheduleEntry[];
  introducerName?: string;
  introducerRelationship?: string;
  // Login phone for the buyer. For self path, equals recipientPhone. For
  // family path, asked separately so the buyer can be reached even when the
  // senior can't pick up SMS.
  buyerPhone: string;
  // Set after Twilio Verify confirms ownership of buyerPhone. Gates the
  // confirmation step / Stripe checkout.
  buyerPhoneVerified: boolean;
  // Optional custom AI-agent name. Empty = use the product default ("カヨ").
  agentName?: string;
  // Consents captured on the confirmation step before checkout. terms is
  // required (the button is gated on it); research is an opt-in checkbox
  // shown next to it.
  termsAccepted?: boolean;
  researchConsent?: boolean;
}

function isPlan(p: string | null): p is Plan {
  return p === "light" || p === "standard" || p === "premium";
}

function SignUpInner() {
  const searchParams = useSearchParams();
  const initialPlan = (() => {
    const p = searchParams.get("plan");
    return isPlan(p) ? p : "standard";
  })();

  const [step, setStep] = useState<Step>("audience");
  const [audience, setAudience] = useState<Audience | null>(null);
  const [plan, setPlan] = useState<Plan>(initialPlan);
  const [data, setData] = useState<SignUpData | null>(null);

  return (
    <main className="min-h-screen bg-cream py-16 md:py-24">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <header className="mb-10 text-center">
          <a
            href="/"
            className="font-serif text-2xl font-medium tracking-tight text-warm-brown hover:text-coral"
          >
            カヨ
          </a>
          <ProgressDots step={step} />
        </header>

        {step === "audience" && (
          <ChooseAudienceStep
            onChoose={(value) => {
              setAudience(value);
              setStep("form");
            }}
          />
        )}

        {step === "form" && audience && (
          <SignUpFormStep
            audience={audience}
            plan={plan}
            initialData={data}
            onBack={() => setStep("audience")}
            onSubmit={(payload) => {
              setData(payload);
              setStep("confirm");
            }}
          />
        )}

        {step === "confirm" && data && (
          <ConfirmationStep
            data={data}
            onChangePlan={(next) => setData({ ...data, plan: next })}
            onEdit={() => setStep("form")}
          />
        )}
      </div>
    </main>
  );
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpInner />
    </Suspense>
  );
}

function ProgressDots({ step }: { step: Step }) {
  const steps: Step[] = ["audience", "form", "confirm"];
  return (
    <div className="mt-6 flex items-center justify-center gap-2">
      {steps.map((s) => (
        <span
          key={s}
          className={`h-1.5 rounded-full transition-all ${
            s === step ? "w-8 bg-coral" : "w-1.5 bg-rose-300/60"
          }`}
        />
      ))}
    </div>
  );
}
