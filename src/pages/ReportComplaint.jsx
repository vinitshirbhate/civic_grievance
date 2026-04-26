import styled from "@emotion/styled";
import { faCamera } from "@fortawesome/free-solid-svg-icons";
import { LocationSearching } from "@mui/icons-material";
import {
  Box,
  Button,
  ButtonBase,
  Checkbox,
  Chip, // 1. IMPORT CHIP FOR SEVERITY DISPLAY
  FormControlLabel,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from "@mui/material";
import MuiTextField from "@mui/material/TextField";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import DashboardLinkButton from "../components/DashboardLinkButton";
import Navbar from "../components/Navbar";
import PuneLocationPreviewMap from "../components/PuneLocationPreviewMap";
import SpinnerModal from "../components/SpinnerModal";
import {
  classifyComplaintAI,
  createComplaint,
  fetchComplaintTaxonomy,
} from "../utils/complaintApi";
import { uploadToCloudinary } from "../utils/cloudinaryUploader";
import { auth } from "../utils/Firebase";
import { identifyLocation } from "../utils/MiscFunctions";
import { Statuses } from "../utils/enums";

const TextField = styled(MuiTextField)((props) => ({
  width: "80%",
  [`& fieldset`]: {
    borderRadius: "15px",
  },
}));

const FALLBACK_TAXONOMY = [
  { category: "Road", label: "Potholes in Roads", defaultSeverity: "High" },
  { category: "Water", label: "Water Logging", defaultSeverity: "High" },
  { category: "Streetlight", label: "Streetlight Malfunction", defaultSeverity: "Medium" },
  { category: "Waste", label: "Waste Management Issues", defaultSeverity: "Medium" },
  { category: "Traffic", label: "Speeding/Racing", defaultSeverity: "High" },
  { category: "Safety", label: "Driving without seat belt/Helmet", defaultSeverity: "Medium" },
  { category: "Other", label: "Others", defaultSeverity: "Low" },
];

const severityChipColor = {
  Low: "info",
  Medium: "warning",
  High: "error",
  Critical: "error",
};

function buildEmergencySuggestion(title = "", description = "") {
  const text = `${title} ${description}`.toLowerCase();
  let category = "Other";

  if (/pothole|road crack|broken road|pavement|crater/.test(text)) category = "Road";
  else if (/water|logging|drain|leak|sewage|flood/.test(text)) category = "Water";
  else if (/street ?light|dark area|no light|lamp post/.test(text)) category = "Streetlight";
  else if (/garbage|waste|trash|dump|dirty/.test(text)) category = "Waste";
  else if (/traffic|racing|speed|overtake|jam/.test(text)) category = "Traffic";
  else if (/helmet|seat ?belt|unsafe|hazard|dangerous crossing/.test(text)) category = "Safety";

  const severity = /accident|injury|fire|critical|life threat/.test(text)
    ? "Critical"
    : /urgent|immediate|major|severe|danger|huge|deep|overflow/.test(text)
    ? "High"
    : ["Water", "Streetlight", "Waste", "Traffic"].includes(category)
    ? "Medium"
    : "Low";

  return {
    category,
    severity,
    confidence: 0.5,
    reliabilityClass: "needs_review",
    aiSource: "emergency-fallback",
    rationale: "Applied emergency text fallback due temporary AI/image issue.",
  };
}

function fileToBase64Data(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const commaIndex = result.indexOf(",");
      if (commaIndex < 0) {
        reject(new Error("Invalid image payload"));
        return;
      }
      resolve(result.slice(commaIndex + 1));
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

function optimizeImageForAI(file, { maxWidth = 1280, maxHeight = 1280, quality = 0.78 } = {}) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const width = img.width || maxWidth;
        const height = img.height || maxHeight;
        const scale = Math.min(maxWidth / width, maxHeight / height, 1);
        const targetWidth = Math.max(1, Math.round(width * scale));
        const targetHeight = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error("Unable to optimize image for AI"));
          return;
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const commaIndex = dataUrl.indexOf(",");
        URL.revokeObjectURL(objectUrl);

        if (commaIndex < 0) {
          reject(new Error("Invalid optimized image payload"));
          return;
        }

        resolve({
          imageData: dataUrl.slice(commaIndex + 1),
          imageMimeType: "image/jpeg",
        });
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to read image for optimization"));
    };

    img.src = objectUrl;
  });
}

const ReportComplaint = () => {
  const [Media, setMedia] = useState();
  const [MediaPath, setMediaPath] = useState("");
  const [FormData, setFormData] = useState({
    location: {
      name: "",
      lat: "",
      lng: "",
    },
    mediaPath: "",
    reason: "",
    additionalInfo: "",
    category: "Other",
    reportedBy: "",
    timestamp: "",
    status: Statuses.inProgress,
    mediaType: "",
    severity: "Low",
  });
  const [reasonOptions, setReasonOptions] = useState(FALLBACK_TAXONOMY);
  const [LoaderVisibile, setLoaderVisibile] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const FileInput = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    auth.onAuthStateChanged((user) => {
      if (!user) {
        return navigate("/citizen-login");
      }
      // Use functional update to avoid stale state
      setFormData((prevData) => ({ ...prevData, reportedBy: user.uid }));
    });
  }, [navigate]);

  useEffect(() => {
    const loadTaxonomy = async () => {
      try {
        const taxonomy = await fetchComplaintTaxonomy();
        if (taxonomy.length > 0) {
          setReasonOptions(taxonomy);
        }
      } catch (_error) {
        setReasonOptions(FALLBACK_TAXONOMY);
      }
    };

    loadTaxonomy();
  }, []);

  const handleCategoryChange = (e) => {
    const category = e.target.value;
    const selected = reasonOptions.find((option) => option.category === category);
    setFormData((prev) => ({
      ...prev,
      category,
      severity: selected?.defaultSeverity || prev.severity || "Low",
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!FormData.reason?.trim()) {
        return toast.error("Please enter a short issue summary.");
    }
    if (!FormData.additionalInfo?.trim()) {
      return toast.error("Please provide more information about the incident.");
    }
    const hasValidCoords =
      Number.isFinite(Number(FormData?.location?.lat)) &&
      Number.isFinite(Number(FormData?.location?.lng));
    if (!hasValidCoords) {
      return toast.error("Please detect and confirm Pune location before submitting.");
    }
    if (!legalAccepted) {
      return toast.error("Please accept the legal declaration checkbox before submitting.");
    }
    setLoaderVisibile(true);
    try {
      let finalMediaPath = "";
      if (Media) {
        finalMediaPath = await uploadToCloudinary(Media);
      }
      const finalFormData = {
        ...FormData,
        mediaPath: finalMediaPath,
        timestamp: Date.now(),
        aiSuggestion: aiSuggestion
          ? {
              ...aiSuggestion,
              selectedCategory: FormData.category,
              selectedSeverity: FormData.severity,
              accepted:
                (aiSuggestion.category || "Other") === (FormData.category || "Other") &&
                (aiSuggestion.severity || "Low") === (FormData.severity || "Low"),
              overridden:
                (aiSuggestion.category || "Other") !== (FormData.category || "Other") ||
                (aiSuggestion.severity || "Low") !== (FormData.severity || "Low"),
            }
          : undefined,
      };
      await createComplaint(finalFormData);
      toast.success("Complaint Reported Successfully");
      setTimeout(() => {
        navigate("/citizen-dashboard");
      }, 3000);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Unable to submit complaint.");
    } finally {
      setLoaderVisibile(false);
    }
  };

  const runAISuggestion = async () => {
    const title = (FormData.reason || "").trim();
    const description = (FormData.additionalInfo || "").trim();

    if ((title + description).length < 10) {
      toast.info("Add a short issue summary or details first for AI suggestion.");
      return;
    }

    setAiSuggesting(true);
    try {
      let imageData;
      let imageMimeType;
      if (Media && String(Media.type || "").startsWith("image/")) {
        if (Media.size > 4 * 1024 * 1024) {
          toast.info("Optimizing image for AI analysis...");
          const optimized = await optimizeImageForAI(Media);
          imageData = optimized.imageData;
          imageMimeType = optimized.imageMimeType;
        } else {
          imageData = await fileToBase64Data(Media);
          imageMimeType = Media.type;
        }
      }

      const suggestion = await classifyComplaintAI({
        title,
        description,
        imageData,
        imageMimeType,
      });
      if (!suggestion) {
        toast.error("AI could not classify this complaint.");
        return;
      }

      setAiSuggestion(suggestion);

      if (suggestion?.imageFallbackReason) {
        toast.warn(`Image analysis fallback: ${suggestion.imageFallbackReason}. Used text-based Gemini.`);
      }

      if (suggestion.category === "Other" && (suggestion.confidence || 0) < 0.7) {
        toast.info("AI needs more details to classify accurately.");
        return;
      }

      if (suggestion.reliabilityClass === "likely_mismatch") {
        toast.warn("Image and claim look mismatched. Please upload clearer and relevant evidence.");
      } else if (suggestion.reliabilityClass === "needs_review") {
        toast.info("AI marked this evidence for review. You can still submit the complaint.");
      }

      if (suggestion.aiSource && suggestion.aiSource !== "gemini-vision") {
        toast.warn("Image AI was unavailable. Result is conservative and requires manual review.");
      }

      if (suggestion.reasonLabel) {
        setFormData((prev) => ({
          ...prev,
          reason: prev.reason || suggestion.reasonLabel,
          category: suggestion.category || prev.category,
          severity: suggestion.severity || prev.severity,
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          category: suggestion.category || prev.category,
          severity: suggestion.severity || prev.severity,
        }));
      }

      toast.success("AI suggestion applied.");
    } catch (error) {
      const fallbackSuggestion = buildEmergencySuggestion(title, description);
      setAiSuggestion(fallbackSuggestion);
      setFormData((prev) => ({
        ...prev,
        category: fallbackSuggestion.category || prev.category,
        severity: fallbackSuggestion.severity || prev.severity,
      }));
      toast.warn(
        error?.response?.data?.message ||
          "AI service unavailable in demo. Applied safe fallback suggestion."
      );
    } finally {
      setAiSuggesting(false);
    }
  };

  return (
    <div className="overflow-x-hidden page-shell">
      <SpinnerModal visible={LoaderVisibile} />
      <Navbar />
      <ToastContainer
        position="bottom-center"
        autoClose={5000}
        hideProgressBar
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <h2 className="section-title text-center lg:text-left my-8 lg:mx-20 animate-in">
        Report A Civic Issue
      </h2>

      <form onSubmit={handleFormSubmit} className="surface-card mx-2 lg:mx-20 py-6 animate-in-delay-1">
        <input
          type="file"
          ref={FileInput}
          className="opacity-0"
          accept="image/*" // Simplified to image only for clarity, can add video back
          onChange={(e) => {
            const file = e.target.files[0];
            if (file) {
              setMedia(file);
              setFormData({
                ...FormData,
                mediaType: file.type.split("/")[0],
              });
              setMediaPath(URL.createObjectURL(file));
            }
          }}
        />
        <DashboardLinkButton
          className={`${Media ? "hidden" : "block"} mx-[8vw]`}
          icon={faCamera}
          name={"Upload a picture of incident"}
          onClick={() => FileInput.current.click()}
          subtitle={"A clear picture helps resolve the issue faster."}
        />
        <div
          className={`flex flex-col justify-center items-center mx-8 lg:mx-20 py-6 ${
            Media ? "block" : "hidden"
          }`}
        >
          <img
            src={MediaPath}
            alt="Complaint preview"
            className="max-w-full w-auto my-6 h-96 object-scale-down"
          />
          <Button
            onClick={() => FileInput.current.click()}
            variant="outlined"
          >
            Change Image
          </Button>
        </div>
        <Box ml={{ xs: "4vw", md: "8vw" }} mr={{ xs: "4vw", md: "8vw" }}>
          <TextField
            variant="outlined"
            label="Location"
            value={FormData.location.name}
            required
            InputProps={{
              readOnly: true,
              endAdornment: (
                <ButtonBase
                  onClick={async () => {
                    try {
                      const locationRes = await identifyLocation();
                      setFormData({ ...FormData, location: locationRes });
                      toast.success("Pune location detected successfully.");
                    } catch (error) {
                      toast.error(error?.message || "Unable to fetch location.");
                    }
                  }}
                >
                  <LocationSearching />
                </ButtonBase>
              ),
            }}
          />
          <p className="text-xs text-slate-500 mt-2">Location capture is currently restricted to Pune city limits.</p>
          {FormData.location?.lat && FormData.location?.lng ? (
            <p className="text-xs text-slate-600 mt-1">
              Coordinates: {Number(FormData.location.lat).toFixed(5)}, {Number(FormData.location.lng).toFixed(5)}
            </p>
          ) : null}
          <PuneLocationPreviewMap location={FormData.location} />
          <p className="mt-6 font-semibold text-slate-700">Issue Context</p>
          <TextField
            required
            variant="outlined"
            label="Issue Summary"
            value={FormData.reason}
            onChange={(e) => {
              setFormData({ ...FormData, reason: e.target.value });
            }}
            placeholder="Example: Big pothole near ABC chowk"
          />
          <div className="my-2">
            <Button
              variant="outlined"
              size="small"
              onClick={runAISuggestion}
              disabled={aiSuggesting}
            >
              {aiSuggesting ? "Analyzing..." : "AI Suggest"}
            </Button>
            {aiSuggestion ? (
              <p className="text-sm text-gray-600 mt-1">
                AI confidence: {Math.round((aiSuggestion.confidence || 0) * 100)}%
                {aiSuggestion?.reliabilityClass ? ` • Evidence: ${aiSuggestion.reliabilityClass.replace("_", " ")}` : ""}
                {aiSuggestion?.aiSource ? ` • Source: ${aiSuggestion.aiSource}` : ""}
              </p>
            ) : null}
            {aiSuggestion?.rationale ? (
              <p className="text-xs text-slate-500 mt-1">{aiSuggestion.rationale}</p>
            ) : null}
          </div>
          <div className="my-3 w-[80%]">
            <FormControl fullWidth size="small">
              <InputLabel id="category-label">Category</InputLabel>
              <Select
                labelId="category-label"
                label="Category"
                value={FormData.category}
                onChange={handleCategoryChange}
              >
                {reasonOptions.map((option) => (
                  <MenuItem key={option.category} value={option.category}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
          <div className="flex items-center gap-4 my-2">
            <p className="text-sm text-gray-600">Identified Severity:</p>
            {(FormData.reason || FormData.severity) && (
              <Chip
                label={FormData.severity || "Low"}
                color={severityChipColor[FormData.severity] || "info"}
                size="small"
              />
            )}
          </div>
          <p className="my-2 font-semibold">More Information</p>
          <TextField
            required
            multiline
            value={FormData.additionalInfo}
            onChange={(e) => {
              setFormData({ ...FormData, additionalInfo: e.target.value });
            }}
            rows={5}
            placeholder="Provide more information about the incident"
          />
          <FormControlLabel
            control={<Checkbox checked={legalAccepted} onChange={(e) => setLegalAccepted(e.target.checked)} />}
            label="I understand that reporting fake complaints will lead to legal actions against me."
          />
        </Box>
        <div className="flex justify-center my-8 px-20 lg:px-96">
          <Button variant="contained" fullWidth type="submit" size="large">
            Submit Complaint
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ReportComplaint;

