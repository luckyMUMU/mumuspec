/**
 * Onboard flow state machine.
 * - 按 role 分区 localStorage 持久化进度（Q3-001 落地）。
 * - 分支决策：answer(stepId, option) 跳转到 option.next 步骤。
 * ponytail: 用 useState + 手写查找步骤；不加 xstate 等状态机库。
 */

import { useState, useCallback, useMemo } from 'react';
import { mockOnboardSteps } from '@/data/mock-onboard-steps';
import { writePersisted, onboardProgressKey } from '@/store/persist';
import type { OnboardStep, OnboardOption } from '@/types/onboard';
import type { Role } from '@/types/chat';

function findStep(id: string): OnboardStep | undefined {
  return mockOnboardSteps.find((s) => s.id === id);
}

export interface UseOnboardFlowResult {
  currentStep: OnboardStep;
  stepIndex: number;
  progress: number;
  role: Role;
  isTerminal: boolean;
  advance: (nextStep: number) => void;
  answer: (stepId: string, option: OnboardOption) => void;
}

export function useOnboardFlow(initialRole: Role): UseOnboardFlowResult {
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [role, setRole] = useState<Role>(initialRole);

  const currentStep = useMemo<OnboardStep>(() => {
    const list = mockOnboardSteps.filter((s) => s.role === role);
    return list[Math.min(stepIndex, list.length - 1)] ?? mockOnboardSteps[0];
  }, [role, stepIndex]);

  const advance = useCallback(
    (nextStep: number) => {
      setStepIndex(nextStep);
      if (role != null) {
        writePersisted(onboardProgressKey(role), nextStep);
      }
    },
    [role],
  );

  const answer = useCallback((stepId: string, option: OnboardOption) => {
    // 设置 role（当用户在 welcome 步骤选择角色时）
    const step = findStep(stepId);
    if (step && step.role != null) {
      setRole(step.role);
    } else if (option.next.startsWith('new-member')) {
      setRole('new-member');
    } else if (option.next.startsWith('lead')) {
      setRole('lead');
    } else if (option.next.startsWith('solo')) {
      setRole('solo');
    }

    const nextStep = findStep(option.next);
    if (!nextStep) return;
    // 在新 role 的列表里找到索引
    const list = mockOnboardSteps.filter((s) => s.role === (nextStep.role ?? role));
    const nextIdx = list.findIndex((s) => s.id === option.next);
    if (nextIdx >= 0) {
      setStepIndex(nextIdx);
      const persistRole = nextStep.role ?? role;
      if (persistRole != null) {
        writePersisted(onboardProgressKey(persistRole), nextIdx);
      }
    }
  }, [role]);

  return {
    currentStep,
    stepIndex,
    progress: stepIndex,
    role,
    isTerminal: currentStep.terminal ?? false,
    advance,
    answer,
  };
}
