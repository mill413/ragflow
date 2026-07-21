import { Button } from '@/components/ui/button';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

const TOUR_VERSION = 'v1';
const STORAGE_KEY_PREFIX = 'ragflow:header-onboarding:';
const SPOTLIGHT_PADDING = 6;
const TOOLTIP_WIDTH = 320;
const VIEWPORT_GUTTER = 16;

type TargetRect = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

const getStorageKey = (userId: string) =>
  `${STORAGE_KEY_PREFIX}${TOUR_VERSION}:${userId}`;

const hasCompletedTour = (userId: string) => {
  try {
    return window.localStorage.getItem(getStorageKey(userId)) === 'completed';
  } catch {
    return false;
  }
};

const markTourCompleted = (userId: string) => {
  try {
    window.localStorage.setItem(getStorageKey(userId), 'completed');
  } catch {
    // The tour still closes when storage is unavailable.
  }
};

export function HeaderOnboardingTour({
  enabled,
  userId,
}: {
  enabled: boolean;
  userId?: string;
}) {
  const { t } = useTranslation();
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);

  const steps = useMemo(
    () => [
      {
        target: 'workspace',
        title: t('header.onboarding.workspaceTitle'),
        description: t('header.onboarding.workspaceDescription'),
      },
      {
        target: 'help',
        title: t('header.onboarding.helpTitle'),
        description: t('header.onboarding.helpDescription'),
      },
      {
        target: 'profile',
        title: t('header.onboarding.profileTitle'),
        description: t('header.onboarding.profileDescription'),
      },
    ],
    [t],
  );

  const closeTour = useCallback(() => {
    if (userId) {
      markTourCompleted(userId);
    }
    setStepIndex(null);
    setTargetRect(null);
  }, [userId]);

  useEffect(() => {
    if (!enabled || !userId || hasCompletedTour(userId)) {
      setStepIndex(null);
      return;
    }

    const frame = window.requestAnimationFrame(() => setStepIndex(0));
    return () => window.cancelAnimationFrame(frame);
  }, [enabled, userId]);

  useEffect(() => {
    if (stepIndex === null) return;

    const selector = `[data-onboarding-target="${steps[stepIndex].target}"]`;
    const target = document.querySelector<HTMLElement>(selector);
    if (!target) {
      closeTour();
      return;
    }

    const updateTargetRect = () => {
      const rect = target.getBoundingClientRect();
      setTargetRect({
        bottom: rect.bottom + SPOTLIGHT_PADDING,
        height: rect.height + SPOTLIGHT_PADDING * 2,
        left: rect.left - SPOTLIGHT_PADDING,
        right: rect.right + SPOTLIGHT_PADDING,
        top: rect.top - SPOTLIGHT_PADDING,
        width: rect.width + SPOTLIGHT_PADDING * 2,
      });
    };

    updateTargetRect();
    const resizeObserver = new ResizeObserver(updateTargetRect);
    resizeObserver.observe(target);
    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect, true);
    };
  }, [closeTour, stepIndex, steps]);

  useEffect(() => {
    if (stepIndex === null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeTour();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeTour, stepIndex]);

  if (stepIndex === null || !targetRect) return null;

  const tooltipLeft = Math.min(
    Math.max(targetRect.right - TOOLTIP_WIDTH, VIEWPORT_GUTTER),
    window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_GUTTER,
  );
  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  return createPortal(
    <div
      aria-label={t('header.onboarding.ariaLabel')}
      aria-modal="true"
      className="fixed inset-0 z-[1000]"
      data-testid="header-onboarding-tour"
      role="dialog"
    >
      <div
        className="fixed bg-black/60"
        style={{ inset: `0 0 auto 0`, height: targetRect.top }}
      />
      <div
        className="fixed bg-black/60"
        style={{
          left: 0,
          top: targetRect.top,
          width: targetRect.left,
          height: targetRect.height,
        }}
      />
      <div
        className="fixed bg-black/60"
        style={{
          left: targetRect.right,
          right: 0,
          top: targetRect.top,
          height: targetRect.height,
        }}
      />
      <div
        className="fixed bg-black/60"
        style={{ inset: `${targetRect.bottom}px 0 0 0` }}
      />

      <div
        className="pointer-events-none fixed rounded-lg border-2 border-accent-primary shadow-[0_0_0_4px_rgba(59,130,246,0.2)]"
        style={{
          left: targetRect.left,
          top: targetRect.top,
          width: targetRect.width,
          height: targetRect.height,
        }}
      />

      <section
        className="fixed rounded-xl border border-border-default bg-bg-base p-5 text-text-primary shadow-xl"
        style={{
          left: tooltipLeft,
          top: targetRect.bottom + 12,
          width: TOOLTIP_WIDTH,
        }}
      >
        <div className="mb-2 text-xs font-medium text-text-secondary">
          {t('header.onboarding.progress', {
            current: stepIndex + 1,
            total: steps.length,
          })}
        </div>
        <h2 className="text-base font-semibold">{currentStep.title}</h2>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          {currentStep.description}
        </p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={closeTour}>
            {t('header.onboarding.skip')}
          </Button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <Button
                variant="outline"
                onClick={() => setStepIndex((index) => (index ?? 1) - 1)}
              >
                {t('header.onboarding.previous')}
              </Button>
            )}
            <Button
              variant="accent"
              onClick={() =>
                isLastStep
                  ? closeTour()
                  : setStepIndex((index) => (index ?? 0) + 1)
              }
            >
              {t(
                isLastStep
                  ? 'header.onboarding.finish'
                  : 'header.onboarding.next',
              )}
            </Button>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
