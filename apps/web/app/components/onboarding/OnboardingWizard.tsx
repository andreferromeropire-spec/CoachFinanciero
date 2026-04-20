"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { Step1Welcome } from "./steps/Step1Welcome";
import { Step2Gmail } from "./steps/Step2Gmail";
import { Step3Forwarding } from "./steps/Step3Forwarding";
import { Step4CSV } from "./steps/Step4CSV";
import { Step5Platforms } from "./steps/Step5Platforms";
import { Step6Done } from "./steps/Step6Done";

interface WizardState {
  step: number;
  gmailConnected: boolean;
  webhookMp: boolean;
  webhookPaypal: boolean;
  webhookWise: boolean;
}

const STORAGE_KEY = "coach_onboarding_state";
const TOTAL_STEPS = 5; // steps 1–5 (step 6 is done screen)

function loadState(): WizardState {
  if (typeof window === "undefined") return { step: 1, gmailConnected: false, webhookMp: false, webhookPaypal: false, webhookWise: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as WizardState;
  } catch { /* ignore */ }
  return { step: 1, gmailConnected: false, webhookMp: false, webhookPaypal: false, webhookWise: false };
}

function saveState(state: WizardState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

const STEP_LABELS = [
  "Bienvenida",
  "Gmail",
  "Reenvío",
  "CSV bancario",
  "Plataformas de pago",
];

interface Props {
  onClose: () => void;
}

export function OnboardingWizard({ onClose }: Props) {
  const [state, setState] = useState<WizardState>(loadState);
  const [animDir, setAnimDir] = useState<"forward" | "back">("forward");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const updateState = useCallback((patch: Partial<WizardState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      saveState(next);
      return next;
    });
  }, []);

  function goNext(patch?: Partial<WizardState>) {
    setAnimDir("forward");
    updateState({ step: state.step + 1, ...patch });
  }

  function goBack() {
    if (state.step <= 1) return;
    setAnimDir("back");
    updateState({ step: state.step - 1 });
  }

  async function handleFinish() {
    try {
      await apiFetch("/api/settings/onboarding-complete", {
        method: "PATCH",
        body: JSON.stringify({
          gmailConnected: state.gmailConnected,
          webhookMpConfigured: state.webhookMp,
          webhookPaypalConfigured: state.webhookPaypal,
          webhookWiseConfigured: state.webhookWise,
        }),
      });
    } catch { /* ignore — user can still continue */ }
    clearState();
    onClose();
  }

  const showProgressBar = state.step >= 2 && state.step <= TOTAL_STEPS;
  const progressPct = ((state.step - 1) / TOTAL_STEPS) * 100;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        visible ? "bg-black/50 backdrop-blur-sm" : "bg-transparent"
      }`}
    >
      <div
        className={`bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto transition-all duration-300 ${
          visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"
        }`}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {state.step > 1 && state.step <= TOTAL_STEPS && (
                <button
                  onClick={goBack}
                  className="w-8 h-8 rounded-xl border border-border flex items-center justify-center text-mid hover:text-hi hover:border-hi transition-colors mr-1"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
              )}
              {showProgressBar ? (
                <span className="text-xs font-semibold text-mid">
                  Paso {state.step - 1} de {TOTAL_STEPS}
                </span>
              ) : (
                <span className="text-xs font-semibold text-mid">
                  {state.step <= TOTAL_STEPS ? STEP_LABELS[state.step - 1] ?? "" : "¡Listo!"}
                </span>
              )}
            </div>
            {state.step <= TOTAL_STEPS && (
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl border border-border flex items-center justify-center text-lo hover:text-hi hover:border-hi transition-colors"
                title="Cerrar (podés retomarlo desde Configuración)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Progress bar */}
          {showProgressBar && (
            <div className="h-1.5 bg-border rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-teal to-teal-hover rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}

          {/* Step dots */}
          {showProgressBar && (
            <div className="flex gap-1.5 justify-center mt-3 mb-1">
              {STEP_LABELS.map((label, i) => (
                <div
                  key={i}
                  title={label}
                  className={`rounded-full transition-all duration-300 ${
                    i + 1 < state.step - 1
                      ? "w-2 h-2 bg-teal"
                      : i + 1 === state.step - 1
                      ? "w-4 h-2 bg-teal"
                      : "w-2 h-2 bg-border"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Step content */}
        <div
          key={`step-${state.step}-${animDir}`}
          className="px-6 pb-6 pt-4"
          style={{
            animation: `slideIn-${animDir} 0.25s ease-out`,
          }}
        >
          {state.step === 1 && (
            <Step1Welcome onNext={() => goNext()} />
          )}
          {state.step === 2 && (
            <Step2Gmail
              onNext={(gmailConnected) => goNext({ gmailConnected })}
              onSkip={() => goNext()}
            />
          )}
          {state.step === 3 && (
            <Step3Forwarding
              onNext={() => goNext()}
              onSkip={() => goNext()}
            />
          )}
          {state.step === 4 && (
            <Step4CSV
              onNext={() => goNext()}
              onSkip={() => goNext()}
            />
          )}
          {state.step === 5 && (
            <Step5Platforms
              onNext={(platforms) => goNext({ webhookMp: platforms.mp, webhookPaypal: platforms.paypal, webhookWise: platforms.wise })}
              onSkip={() => goNext()}
            />
          )}
          {state.step >= 6 && (
            <Step6Done
              gmailConnected={state.gmailConnected}
              webhookMp={state.webhookMp}
              webhookPaypal={state.webhookPaypal}
              webhookWise={state.webhookWise}
              onFinish={handleFinish}
            />
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideIn-forward {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideIn-back {
          from { opacity: 0; transform: translateX(-24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
