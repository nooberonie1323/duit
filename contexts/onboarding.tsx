import React, { createContext, useContext, useState } from 'react';

export interface Reservation {
  id: string;
  name: string;
  amount: string;
}

export interface OnboardingData {
  name: string;
  cycleStartDate: Date | null;
  cycleEndDate: Date | null;
  income: string;
  budgetAlert: string;
  positionMode: 'spent' | 'have' | null;
  alreadySpent: string;
  stillHave: string;
  startFromToday: boolean;
  savings: string;
  reservations: Reservation[];
}

interface OnboardingContextType {
  data: OnboardingData;
  update: (updates: Partial<OnboardingData>) => void;
  reset: () => void;
}

const initial: OnboardingData = {
  name: '',
  cycleStartDate: null,
  cycleEndDate: null,
  income: '',
  budgetAlert: '',
  positionMode: null,
  alreadySpent: '',
  stillHave: '',
  startFromToday: true,
  savings: '',
  reservations: [],
};

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<OnboardingData>(initial);
  const update = (updates: Partial<OnboardingData>) =>
    setData(prev => ({ ...prev, ...updates }));
  const reset = () => setData(initial);
  return (
    <OnboardingContext.Provider value={{ data, update, reset }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
