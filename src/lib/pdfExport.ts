import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type MeasurementQuality = "Good" | "Limited" | "Incomplete";

export interface ReportRepDetail {
    setNumber: number;
    repNumber: number;
    peakAngle: number;
    startingAngle?: number;
    startingToleranceDegrees?: number;
    compensated: boolean;
    compensationType: string;
    safeThresholdHeld: boolean;
    timestamp?: string;
    holdSeconds?: number;
    holdMet?: boolean;
    velocityDegreesPerSecond?: number;
    confidence?: number;
    quality?: MeasurementQuality;
}

export interface SessionData {
    patientName: string;
    patientId?: string;
    protocolName: string;
    category?: string;
    laterality?: "Left" | "Right" | "Bilateral" | "Not specified";
    cameraSetup?: "sagittal" | "frontal" | "not specified";
    clinicalSource?: string;
    sourceDocumentName?: string;
    sourceDocumentExtractedAt?: string;
    aiExtractionReviewed?: boolean;
    aiReviewNotes?: string[];
    date: string;
    prescribedTargetRom: number;
    prescribedHoldSeconds?: number;
    safetyHardStopAngle: number;
    achievedPeakRom: number;
    startingAngle?: number;
    startingToleranceDegrees?: number;
    totalReps: number;
    cleanReps: number;
    compensatedReps: number;
    safetyViolations: number;
    measurementQuality: MeasurementQuality;
    incompleteFrames?: number;
    durationSeconds?: number;
    compensationSummary?: Array<{ type: string; count: number }>;
    safetyEvents?: Array<{ timestamp: string; angle: number; velocityDegreesPerSecond: number; reason: string }>;
    // Session quality/kinematics
    averageConfidence?: number;
    avgVelocityDegPerSecond?: number;
    peakVelocityDegPerSecond?: number;
    repsDetail: ReportRepDetail[];
}

export interface ClinicalReportJson extends SessionData {
    reportType: "PhysioGuard Rehabilitation Progress Report";
    generatedAt: string;
    disclaimer: string;
    fhirMapping: {
        documentReference: "DocumentReference";
        measurements: "Observation[]";
    };
}

const disclaimer = "Computer-vision measurements are intended for clinician review and do not replace medical diagnosis, treatment, or the prescribing clinician's instructions.";

function safeFilePart(value: string) {
    return value.replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "") || "Patient";
}

function percent(value: number, total: number) {
    return total ? `${((value / total) * 100).toFixed(1)}%` : "Not available";
}

function formatOptional(value: number | undefined, suffix = "") {
    return value === undefined || Number.isNaN(value) ? "Not recorded" : `${Number(value).toFixed(1)}${suffix}`;
}

function addFooter(doc: jsPDF) {
    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage(page);
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`PhysioGuard | Clinical review copy | Page ${page} of ${pageCount}`, 14, 288);
    }
}

export function buildClinicalReportJson(data: SessionData): ClinicalReportJson {
    return {
        ...data,
        reportType: "PhysioGuard Rehabilitation Progress Report",
        generatedAt: new Date().toISOString(),
        disclaimer,
        fhirMapping: { documentReference: "DocumentReference", measurements: "Observation[]" },
    };
}

export function downloadClinicalReportJson(data: SessionData) {
    const blob = new Blob([JSON.stringify(buildClinicalReportJson(data), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `PhysioGuard_Report_${safeFilePart(data.patientName)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
}

export function generateClinicalReport(data: SessionData) {
    const doc = new jsPDF();
    const cleanRate = percent(data.cleanReps, data.totalReps);
    const compensationRate = percent(data.compensatedReps, data.totalReps);
    const cameraView = data.cameraSetup === "sagittal" ? "Sagittal (side)" : data.cameraSetup === "frontal" ? "Frontal" : "Not specified";

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text("PHYSIOGUARD - REHABILITATION PROGRESS REPORT", 14, 18);
    doc.setFontSize(8);
    doc.text("CLINICIAN REVIEW COPY", 14, 25);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.text(`Patient: ${data.patientName}`, 14, 40);
    doc.text(`Patient ID: ${data.patientId || "Not specified"}`, 14, 46);
    doc.text(`Exercise: ${data.protocolName}`, 14, 52);
    doc.text(`Date & time: ${data.date}`, 125, 40);
    doc.text(`Laterality: ${data.laterality || "Not specified"}`, 125, 46);
    doc.text(`Camera view: ${cameraView}`, 125, 52);

    doc.setFillColor(240, 253, 250);
    doc.setDrawColor(153, 246, 228);
    doc.roundedRect(14, 60, 182, 38, 2, 2, "FD");
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.text("Clinical summary", 18, 68);
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    const holdLine = data.prescribedHoldSeconds === undefined ? "" : ` | Hold target: ${data.prescribedHoldSeconds}s`;
    doc.text(`Starting ROM: ${formatOptional(data.startingAngle, "°")} ± ${formatOptional(data.startingToleranceDegrees, "°")} | Peak ROM: ${formatOptional(data.achievedPeakRom, "°")} / target ${formatOptional(data.prescribedTargetRom, "°")}${holdLine}`, 18, 76);
    doc.text(`Repetitions: ${data.totalReps} total | ${data.cleanReps} clean (${cleanRate}) | ${data.compensatedReps} compensated (${compensationRate})`, 18, 82);
    const qualityLine = `Safety guardrail events: ${data.safetyViolations} | Measurement quality: ${data.measurementQuality}`;
    const metricsLine = `Avg confidence: ${data.averageConfidence === undefined ? "-" : `${Math.round(data.averageConfidence * 100)}%`} | Avg velocity: ${data.avgVelocityDegPerSecond?.toFixed(0) ?? "-"}°/s | Peak velocity: ${data.peakVelocityDegPerSecond?.toFixed(0) ?? "-"}°/s`;
    doc.text(qualityLine, 18, 88);
    doc.text(metricsLine, 18, 94);
    doc.text(`Duration: ${data.durationSeconds === undefined ? "Not recorded" : `${Math.round(data.durationSeconds)} seconds`} | Incomplete frames: ${data.incompleteFrames ?? 0}`, 18, 100);

    // Keep the clinician summary and the detailed audit on predictable pages.
    // Short sessions should still have the same report structure as long ones.
    doc.addPage();
    let cursorY = 20;
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text("Rep-by-rep audit", 14, cursorY);
    cursorY += 5;
    autoTable(doc, {
        startY: cursorY,
        head: [["Rep", "Start ROM", "Peak ROM", "Hold", "Form", "Compensation", "Safety", "Confidence"]],
        body: data.repsDetail.map((rep) => [
            `S${rep.setNumber} / R${rep.repNumber}`,
            formatOptional(rep.startingAngle, "°"),
            formatOptional(rep.peakAngle, "°"),
            rep.holdSeconds === undefined ? "Not recorded" : `${rep.holdSeconds.toFixed(1)}s${rep.holdMet === undefined ? "" : rep.holdMet ? " ✓" : " · short"}`,
            rep.compensated ? "Compensated" : "Clean",
            rep.compensated ? rep.compensationType || "Form issue" : "-",
            rep.safeThresholdHeld ? "Within limit" : "Halt/limit",
            rep.confidence === undefined ? "Not recorded" : `${Math.round(rep.confidence * 100)}%${rep.quality ? ` · ${rep.quality}` : ""}`,
        ]),
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 8, cellPadding: 2.5 },
        margin: { left: 14, right: 14 },
        theme: "striped",
    });

    cursorY = ((doc as any).lastAutoTable?.finalY || 120) + 12;
    if (cursorY > 260) { doc.addPage(); cursorY = 20; }
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text("Compensation and safety review", 14, cursorY);
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    const compensationText = data.compensationSummary?.length
        ? data.compensationSummary.map((item) => `${item.type}: ${item.count}`).join(" | ")
        : "No compensation categories recorded.";
    doc.text(`Detected compensation: ${compensationText}`, 14, cursorY + 8, { maxWidth: 182 });
    doc.text(`Clinical source: ${data.clinicalSource || "Not specified"}`, 14, cursorY + 17, { maxWidth: 182 });
    doc.text(`Source document: ${data.sourceDocumentName || "Not supplied"}`, 14, cursorY + 26, { maxWidth: 182 });
    doc.text(`AI extraction review: ${data.aiExtractionReviewed === undefined ? "Not specified" : data.aiExtractionReviewed ? "Reviewed/confirmed" : "Clinician review required"}`, 14, cursorY + 35);
    if (data.safetyEvents?.length) {
        doc.text(`Safety event log: ${data.safetyEvents.slice(0, 3).map((event) => `${event.timestamp} ${event.angle.toFixed(1)}°`).join(" | ")}`, 14, cursorY + 44, { maxWidth: 182 });
    }

    const reviewY = cursorY + (data.safetyEvents?.length ? 58 : 49);
    doc.setDrawColor(203, 213, 225);
    doc.line(14, reviewY, 196, reviewY);
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text("Clinician comments / next step:", 14, reviewY + 9);
    doc.line(14, reviewY + 23, 196, reviewY + 23);
    doc.line(14, reviewY + 37, 196, reviewY + 37);
    doc.text("Clinician name / signature:", 14, reviewY + 50);
    doc.line(75, reviewY + 50, 196, reviewY + 50);

    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(disclaimer, 14, 275, { maxWidth: 182 });
    addFooter(doc);
    doc.save(`PhysioGuard_Report_${safeFilePart(data.patientName)}.pdf`);
}
