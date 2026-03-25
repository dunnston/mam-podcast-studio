import { useEpisodeStore } from "../stores/episodeStore";
import type { WizardStep } from "../stores/episodeStore";
import { ImportStep } from "./steps/ImportStep";
import { EnhanceStep } from "./steps/EnhanceStep";
import { ExtractStep } from "./steps/ExtractStep";
import { ShowNotesStep } from "./steps/ShowNotesStep";
import { ReviewStep } from "./steps/ReviewStep";
import { PublishStep } from "./steps/PublishStep";
import { Check } from "lucide-react";

interface StepConfig {
  id: WizardStep;
  label: string;
  shortLabel: string;
}

const STEPS: StepConfig[] = [
  { id: "import", label: "Import Video", shortLabel: "Import" },
  { id: "enhance", label: "Enhance Audio", shortLabel: "Enhance" },
  { id: "extract", label: "Extract Audio", shortLabel: "Extract" },
  { id: "show-notes", label: "Show Notes", shortLabel: "Show Notes" },
  { id: "review", label: "Review", shortLabel: "Review" },
  { id: "publish", label: "Publish", shortLabel: "Publish" },
];

const STEP_ORDER: WizardStep[] = [
  "import",
  "enhance",
  "extract",
  "show-notes",
  "review",
  "publish",
];

function getStepIndex(step: WizardStep): number {
  return STEP_ORDER.indexOf(step);
}

interface StepperProps {
  currentStep: WizardStep;
  onStepClick: (step: WizardStep) => void;
}

function Stepper({ currentStep, onStepClick }: StepperProps) {
  const currentIndex = getStepIndex(currentStep);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0",
        padding: "0",
      }}
      role="list"
      aria-label="Wizard steps"
    >
      {STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isUpcoming = index > currentIndex;
        const isClickable = index <= currentIndex;

        return (
          <div
            key={step.id}
            role="listitem"
            style={{
              display: "flex",
              alignItems: "center",
              flex: index < STEPS.length - 1 ? "1" : undefined,
            }}
          >
            {/* Step */}
            <button
              onClick={() => isClickable && onStepClick(step.id)}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`${step.label}${isCompleted ? " (completed)" : isCurrent ? " (current)" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "none",
                border: "none",
                cursor: isClickable ? "pointer" : "default",
                padding: "4px 0",
                outline: "none",
              }}
            >
              {/* Circle */}
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  border: `2px solid ${
                    isCompleted
                      ? "var(--color-sage)"
                      : isCurrent
                      ? "var(--color-terracotta)"
                      : "var(--color-border)"
                  }`,
                  backgroundColor: isCompleted
                    ? "var(--color-sage)"
                    : isCurrent
                    ? "rgba(196, 116, 90, 0.12)"
                    : "transparent",
                  transition: "border-color 200ms ease, background-color 200ms ease",
                }}
              >
                {isCompleted ? (
                  <Check size={13} style={{ color: "var(--color-cream)" }} />
                ) : (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      fontWeight: "600",
                      color: isCurrent
                        ? "var(--color-terracotta)"
                        : "var(--color-border)",
                    }}
                  >
                    {index + 1}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "13px",
                  fontWeight: isCurrent ? "500" : "400",
                  color: isCompleted
                    ? "var(--color-sage)"
                    : isCurrent
                    ? "var(--color-cream)"
                    : isUpcoming
                    ? "var(--color-text-muted)"
                    : "var(--color-text-muted)",
                  whiteSpace: "nowrap",
                  transition: "color 200ms ease",
                }}
              >
                {step.shortLabel}
              </span>
            </button>

            {/* Connector line */}
            {index < STEPS.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: "2px",
                  margin: "0 8px",
                  backgroundColor:
                    index < currentIndex
                      ? "var(--color-sage)"
                      : "var(--color-border)",
                  transition: "background-color 200ms ease",
                  borderRadius: "1px",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function NewEpisode() {
  const { currentStep, setCurrentStep, currentEpisode } = useEpisodeStore();

  const currentIndex = getStepIndex(currentStep);

  // Page titles and descriptions per step
  const stepMeta: Record<WizardStep, { title: string; description: string }> =
    {
      import: {
        title: "Import Video",
        description: "Select your recorded video file and fill in episode details.",
      },
      enhance: {
        title: "Enhance Audio",
        description: "Apply noise reduction and audio processing to improve quality.",
      },
      extract: {
        title: "Extract Audio",
        description: "Export your audio in the formats you need for distribution.",
      },
      "show-notes": {
        title: "Show Notes",
        description: "Upload a transcript and generate AI-powered show notes.",
      },
      review: {
        title: "Review",
        description: "Review everything before publishing.",
      },
      publish: {
        title: "Publish",
        description: "Publish your episode to Podbean and YouTube.",
      },
    };

  const meta = stepMeta[currentStep];

  return (
    <div style={{ padding: "40px", maxWidth: "900px" }}>
      {/* Page header */}
      <div style={{ marginBottom: "32px" }}>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "12px",
            fontWeight: "600",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--color-text-muted)",
            marginBottom: "6px",
          }}
        >
          New Episode
          {currentEpisode?.title
            ? ` — ${currentEpisode.title}`
            : ""}
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "36px",
            fontWeight: "600",
            color: "var(--color-cream)",
            lineHeight: "1.2",
            marginBottom: "4px",
          }}
        >
          {meta.title}
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "14px",
            color: "var(--color-text-muted)",
          }}
        >
          {meta.description}
        </p>
      </div>

      {/* Stepper */}
      <div
        style={{
          padding: "20px 24px",
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "12px",
          marginBottom: "32px",
        }}
      >
        <Stepper currentStep={currentStep} onStepClick={setCurrentStep} />
      </div>

      {/* Step back navigation */}
      {currentIndex > 0 && currentStep !== "publish" && (
        <button
          onClick={() => setCurrentStep(STEP_ORDER[currentIndex - 1])}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            color: "var(--color-text-muted)",
            marginBottom: "20px",
            transition: "color 150ms ease",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color =
              "var(--color-cream)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color =
              "var(--color-text-muted)")
          }
        >
          ← Back to {STEPS[currentIndex - 1].shortLabel}
        </button>
      )}

      {/* Step content */}
      <div>
        {currentStep === "import" && <ImportStep />}
        {currentStep === "enhance" && <EnhanceStep />}
        {currentStep === "extract" && <ExtractStep />}
        {currentStep === "show-notes" && <ShowNotesStep />}
        {currentStep === "review" && <ReviewStep />}
        {currentStep === "publish" && <PublishStep />}
      </div>
    </div>
  );
}
