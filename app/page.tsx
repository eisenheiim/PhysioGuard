"use client";

import { RehabApp } from "../src/components/RehabApp";
import { DocumentIntake } from "../src/components/DocumentIntake";
import type { ExtractedRehabDocument } from "../src/lib/documentExtraction";
import { useState } from "react";
import type { AIExercisePlan } from "../src/lib/aiPlan";

export default function HomePage() {
  const [document, setDocument] = useState<ExtractedRehabDocument | null>(null);
  const [plan, setPlan] = useState<AIExercisePlan | null>(null);
  return document ? <RehabApp sourceDocument={document} aiPlan={plan || undefined} onRestartToPaper={() => { setDocument(null); setPlan(null); }} /> : <DocumentIntake onContinue={(nextDocument, nextPlan) => { setDocument(nextDocument); setPlan(nextPlan); }} />;
}
