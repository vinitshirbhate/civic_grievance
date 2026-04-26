import { asyncHandler } from "../utils/apiError.js";
import { getReasonLabelByCategory } from "../config/complaintTaxonomy.js";

function classifyCategory(text) {
  if (/pothole|road crack|broken road|pavement|crater/i.test(text)) return "Road";
  if (/water|logging|drain|leak|sewage|flood/i.test(text)) return "Water";
  if (/street ?light|dark area|no light|lamp post/i.test(text)) return "Streetlight";
  if (/garbage|waste|trash|dump|dirty/i.test(text)) return "Waste";
  if (/traffic|racing|speed|overtake|jam/i.test(text)) return "Traffic";
  if (/helmet|seat ?belt|unsafe|hazard|dangerous crossing/i.test(text)) return "Safety";
  return "Other";
}

function classifySeverity(text, category) {
  if (/accident|injury|collapsed|electrocute|fire|critical|life threat/i.test(text)) {
    return "Critical";
  }

  if (/urgent|immediate|major|severe|danger|huge|deep|overflow/i.test(text)) {
    return "High";
  }

  if (["Water", "Streetlight", "Waste", "Traffic"].includes(category)) {
    return "Medium";
  }

  return "Low";
}

function confidenceFor(category, text) {
  if (category === "Other") return 0.58;
  const strongSignals = /pothole|water|street ?light|garbage|traffic|helmet|seat ?belt/i.test(text);
  return strongSignals ? 0.88 : 0.72;
}

const allowedCategories = ["Road", "Water", "Streetlight", "Waste", "Traffic", "Safety", "Other"];

function clamp(value, min = 0, max = 100) {
  const num = Number(value);
  if (Number.isNaN(num)) return min;
  return Math.min(max, Math.max(min, num));
}

function scoreToSeverity(score) {
  if (score >= 85) return "Critical";
  if (score >= 65) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

function severityToScore(severity) {
  const normalized = String(severity || "Low");
  if (normalized === "Critical") return 92;
  if (normalized === "High") return 74;
  if (normalized === "Medium") return 52;
  return 22;
}

function reliabilityClassFromScore(score) {
  if (score < 35) return "likely_mismatch";
  if (score < 62) return "needs_review";
  return "verified_likely";
}

function isInvalidEvidence({ imageAssessment, predictedCategoryFromImage, claimedCategory }) {
  const consistency = Number(imageAssessment?.textImageConsistency || 0);
  const evidenceQuality = Number(imageAssessment?.evidenceQuality || 0);
  const manipulationRisk = Number(imageAssessment?.manipulationRisk || 0);

  // Primary hard-fail: model says no issue detected at all.
  if (imageAssessment?.issueDetected === false) {
    return true;
  }

  // Strong mismatch signals between claim and image.
  if (consistency <= 35 && evidenceQuality <= 55) {
    return true;
  }

  // Image categorized as Other while user claim is specific civic category + weak consistency.
  if (
    claimedCategory &&
    claimedCategory !== "Other" &&
    predictedCategoryFromImage === "Other" &&
    consistency < 45
  ) {
    return true;
  }

  // Manipulation suspicion with weak consistency.
  if (manipulationRisk >= 70 && consistency < 55) {
    return true;
  }

  return false;
}

function isStreetlightSafetyContext(category, text = "") {
  if (category !== "Streetlight") return false;
  return /girl|woman|women|night|dark|unsafe|alone|fear|harass/i.test(String(text));
}

function tryParseGeminiJson(text = "") {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;

  const sanitized = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(sanitized);
  } catch (_error) {
    const start = sanitized.indexOf("{");
    const end = sanitized.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(sanitized.slice(start, end + 1));
      } catch (_error2) {
        return null;
      }
    }
    return null;
  }
}

async function imageUrlToInlineData(url) {
  if (!url) return null;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Unable to download image for AI analysis");
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  if (!contentType.startsWith("image/")) {
    throw new Error("Only image media is supported for AI analysis");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const base64 = Buffer.from(bytes).toString("base64");
  return {
    mimeType: contentType,
    data: base64,
  };
}

async function runGeminiImageAssessment({ title, description, imageData, imageMimeType, imageUrl }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  let inlineImage = null;
  if (imageData) {
    inlineImage = {
      mimeType: imageMimeType || "image/jpeg",
      data: imageData,
    };
  } else if (imageUrl) {
    inlineImage = await imageUrlToInlineData(imageUrl);
  }

  if (!inlineImage?.data) {
    throw new Error("No image data provided for Gemini analysis");
  }

  const prompt = [
    "You are an expert civic issue triage system.",
    "The image is the primary evidence. Text claim has lower priority.",
    "If image shows non-working streetlights in a dark area, treat it as elevated safety risk.",
    "Presence of people in the image does NOT invalidate the complaint.",
    "Assess if the image supports the reported issue and estimate severity.",
    "Return ONLY strict JSON with keys:",
    "issueDetected (boolean)",
    "categoryFromImage (Road|Water|Streetlight|Waste|Traffic|Safety|Other)",
    "severityFromImage (0-100)",
    "textImageConsistency (0-100)",
    "manipulationRisk (0-100)",
    "evidenceQuality (0-100)",
    "rationaleShort (string, max 180 chars)",
    "No markdown, no extra text.",
    `Title: ${title || ""}`,
    `Description: ${description || ""}`,
  ].join("\n");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: inlineImage.mimeType,
                data: inlineImage.data,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Gemini request failed: ${details}`);
  }

  const payload = await response.json();
  const responseText = payload?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const parsed = tryParseGeminiJson(responseText);
  if (!parsed) {
    throw new Error("Gemini returned invalid JSON output");
  }

  const category = allowedCategories.includes(parsed.categoryFromImage) ? parsed.categoryFromImage : "Other";
  return {
    issueDetected: Boolean(parsed.issueDetected),
    categoryFromImage: category,
    severityFromImage: clamp(parsed.severityFromImage),
    textImageConsistency: clamp(parsed.textImageConsistency),
    manipulationRisk: clamp(parsed.manipulationRisk),
    evidenceQuality: clamp(parsed.evidenceQuality),
    rationaleShort: String(parsed.rationaleShort || "").slice(0, 220),
  };
}

async function runGeminiTextAssessment({ title, description }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const prompt = [
    "You are an expert civic issue triage system.",
    "Analyze ONLY the text complaint and return strict JSON.",
    "Return ONLY JSON keys:",
    "category (Road|Water|Streetlight|Waste|Traffic|Safety|Other)",
    "severity (Low|Medium|High|Critical)",
    "confidence (0-1)",
    "rationaleShort (string, max 180 chars)",
    `Title: ${title || ""}`,
    `Description: ${description || ""}`,
  ].join("\n");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Gemini text request failed: ${details}`);
  }

  const payload = await response.json();
  const responseText = payload?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const parsed = tryParseGeminiJson(responseText);
  if (!parsed) {
    throw new Error("Gemini returned invalid text JSON output");
  }

  const category = allowedCategories.includes(parsed.category) ? parsed.category : "Other";
  const severity = ["Low", "Medium", "High", "Critical"].includes(parsed.severity)
    ? parsed.severity
    : "Low";

  return {
    category,
    severity,
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence || 0.62))),
    rationaleShort: String(parsed.rationaleShort || "").slice(0, 220),
  };
}

function buildHeuristicSuggestion(title, description) {
  const combined = `${title || ""} ${description || ""}`.trim();
  const category = classifyCategory(combined);
  const severity = classifySeverity(combined, category);
  const confidence = confidenceFor(category, combined);
  return {
    category,
    reasonLabel: getReasonLabelByCategory(category),
    severity,
    confidence,
    finalSeverityScore: severityToScore(severity),
    textImageConsistency: null,
    manipulationRisk: null,
    evidenceQuality: null,
    reliabilityClass: "needs_review",
    imagePrimary: false,
    aiSource: "heuristic-fallback",
    rationale: "Image-first AI unavailable. Used keyword fallback.",
  };
}

function buildImageFailureSuggestion(title, description) {
  const combined = `${title || ""} ${description || ""}`.trim();
  const hintedCategory = classifyCategory(combined);
  return {
    category: "Other",
    reasonLabel: getReasonLabelByCategory("Other"),
    severity: "Low",
    confidence: 0.32,
    finalSeverityScore: 20,
    textImageConsistency: null,
    manipulationRisk: null,
    evidenceQuality: null,
    reliabilityClass: "needs_review",
    invalidEvidence: true,
    imagePrimary: true,
    aiSource: "vision-unavailable",
    rationale: `Image analysis unavailable. Claim requires manual review. Text hint category: ${hintedCategory}.`,
  };
}

export const classifyComplaint = asyncHandler(async (req, res) => {
  const {
    title = "",
    description = "",
    category = "",
    imageData = "",
    imageMimeType = "image/jpeg",
    imageUrl = "",
  } = req.body || {};

  const hasImage = Boolean(imageData || imageUrl);
  const combinedText = `${title || ""} ${description || ""}`.trim();
  const heuristic = buildHeuristicSuggestion(title, description);

  if (!hasImage) {
    try {
      const textAssessment = await runGeminiTextAssessment({ title, description });
      const textScore = severityToScore(textAssessment.severity);
      return res.status(200).json({
        suggestion: {
          category: textAssessment.category,
          reasonLabel: getReasonLabelByCategory(textAssessment.category),
          severity: textAssessment.severity,
          confidence: Number((textAssessment.confidence || 0.62).toFixed(2)),
          finalSeverityScore: textScore,
          textImageConsistency: null,
          manipulationRisk: null,
          evidenceQuality: null,
          reliabilityClass: "needs_review",
          imagePrimary: false,
          aiSource: "gemini-text",
          rationale: textAssessment.rationaleShort || "Gemini text assessment completed.",
        },
      });
    } catch (_error) {
      return res.status(200).json({ suggestion: heuristic });
    }
  }

  try {
    const imageAssessment = await runGeminiImageAssessment({
      title,
      description,
      imageData,
      imageMimeType,
      imageUrl,
    });

    const textScore = severityToScore(heuristic.severity);
    const contextScore = 50;

    // Image-first fusion: text assists but cannot dominate severity.
    let finalSeverityScore = Math.round(
      0.85 * imageAssessment.severityFromImage +
      0.1 * textScore +
      0.05 * contextScore
    );

    const reliabilityScore = Math.round(
      0.45 * imageAssessment.textImageConsistency +
      0.35 * imageAssessment.evidenceQuality +
      0.2 * (100 - imageAssessment.manipulationRisk)
    );

    let reliabilityClass = reliabilityClassFromScore(reliabilityScore);
    // Auto-upgrade to verified when image quality is strong and tamper risk is low.
    if (
      reliabilityClass === "needs_review" &&
      imageAssessment.evidenceQuality >= 70 &&
      imageAssessment.manipulationRisk <= 25 &&
      imageAssessment.textImageConsistency >= 55
    ) {
      reliabilityClass = "verified_likely";
    }
    const finalCategory = imageAssessment.categoryFromImage || heuristic.category;

    const invalidEvidence = isInvalidEvidence({
      imageAssessment,
      predictedCategoryFromImage: finalCategory,
      claimedCategory: category || heuristic.category,
    });

    if (invalidEvidence) {
      finalSeverityScore = Math.min(finalSeverityScore, 20);
      reliabilityClass = "likely_mismatch";
    }
    // Safety floor for streetlight complaints involving vulnerable/night context.
    if (isStreetlightSafetyContext(finalCategory, combinedText)) {
      finalSeverityScore = Math.max(finalSeverityScore, 65);
    }

    // If streetlight evidence is reasonably clear, avoid over-flagging needs_review.
    if (
      reliabilityClass === "needs_review" &&
      finalCategory === "Streetlight" &&
      imageAssessment.evidenceQuality >= 60 &&
      imageAssessment.manipulationRisk <= 30 &&
      imageAssessment.textImageConsistency >= 45
    ) {
      reliabilityClass = "verified_likely";
    }

    const finalSeverity = scoreToSeverity(finalSeverityScore);

    const adjustedConfidence = invalidEvidence
      ? Number(Math.min(Number((reliabilityScore / 100).toFixed(2)), 0.35).toFixed(2))
      : Number((reliabilityScore / 100).toFixed(2));

    return res.status(200).json({
      suggestion: {
        category: invalidEvidence ? "Other" : finalCategory,
        reasonLabel: getReasonLabelByCategory(invalidEvidence ? "Other" : finalCategory),
        severity: finalSeverity,
        confidence: adjustedConfidence,
        finalSeverityScore,
        textImageConsistency: imageAssessment.textImageConsistency,
        manipulationRisk: imageAssessment.manipulationRisk,
        evidenceQuality: imageAssessment.evidenceQuality,
        reliabilityClass,
        invalidEvidence,
        imagePrimary: true,
        aiSource: "gemini-vision",
        rationale: invalidEvidence
          ? "Image does not sufficiently support the reported civic issue."
          : imageAssessment.rationaleShort || "Image-first assessment completed.",
      },
    });
  } catch (_error) {
    return res.status(200).json({ suggestion: buildImageFailureSuggestion(title, description) });
  }
});
