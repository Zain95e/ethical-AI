import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Tooltip,
  IconButton,
} from "@mui/material";
import {
  Download as DownloadIcon,
  Close as CloseIcon,
  Verified as VerifiedIcon,
  EmojiEvents as TrophyIcon,
} from "@mui/icons-material";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CertificateModalProps {
  open: boolean;
  onClose: () => void;
  recipientName: string;
  projectName?: string;
  suiteId: string;
  validationsPassed: string[];
  overallPassed: boolean;
  issuedAt?: string; // ISO date string; defaults to now
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function labelForValidator(key: string) {
  const map: Record<string, string> = {
    fairness: "AI Fairness",
    transparency: "Model Transparency",
    privacy: "Data Privacy",
    accountability: "Audit Accountability",
  };
  return map[key] ?? key;
}

// Decorative SVG border pattern as inline component
function DecorativeBorder() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="borderOuter" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="50%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="borderInner" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d4af37" />
          <stop offset="50%" stopColor="#f3e5ab" />
          <stop offset="100%" stopColor="#d4af37" />
        </linearGradient>
      </defs>

      {/* Outer Navy Border */}
      <rect
        x="16"
        y="16"
        width="calc(100% - 32px)"
        height="calc(100% - 32px)"
        fill="none"
        stroke="url(#borderOuter)"
        strokeWidth="12"
        vectorEffect="non-scaling-stroke"
      />
      {/* Inner Gold Border */}
      <rect
        x="24"
        y="24"
        width="calc(100% - 48px)"
        height="calc(100% - 48px)"
        fill="none"
        stroke="url(#borderInner)"
        strokeWidth="3"
        vectorEffect="non-scaling-stroke"
      />
      {/* Thin Inner Navy Border */}
      <rect
        x="30"
        y="30"
        width="calc(100% - 60px)"
        height="calc(100% - 60px)"
        fill="none"
        stroke="url(#borderOuter)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />

      {/* Corner Ornaments */}
      {[
        { cx: 30, cy: 30 },
        { cx: "calc(100% - 30px)", cy: 30 },
        { cx: 30, cy: "calc(100% - 30px)" },
        { cx: "calc(100% - 30px)", cy: "calc(100% - 30px)" },
      ].map((pos, i) => (
        <g key={i}>
          <circle cx={pos.cx} cy={pos.cy} r="14" fill="#ffffff" stroke="url(#borderInner)" strokeWidth="2" />
          <circle cx={pos.cx} cy={pos.cy} r="6" fill="url(#borderOuter)" />
        </g>
      ))}
    </svg>
  );
}

// ─── Certificate Canvas (the actual printable certificate) ───────────────────
function CertificateCanvas({
  recipientName,
  projectName,
  suiteId,
  validationsPassed,
  overallPassed,
  issuedAt,
}: Omit<CertificateModalProps, "open" | "onClose">) {
  const passed = validationsPassed.filter(Boolean);
  const date = formatDate(issuedAt);
  const certId = `ETHAI-${suiteId.substring(0, 8).toUpperCase()}`;

  return (
    <Box
      sx={{
        width: 900,
        minHeight: 640,
        position: "relative",
        backgroundColor: "#faf9f6", // Off-white parchment
        backgroundImage: "radial-gradient(circle at 50% 50%, #ffffff 0%, #f4f0e6 100%)",
        borderRadius: "4px",
        overflow: "hidden",
        fontFamily: "'Inter', sans-serif",
        color: "#0f172a",
        p: 0,
        flexShrink: 0,
        boxShadow: "inset 0 0 100px rgba(0,0,0,0.02)",
      }}
    >
      {/* Subtle watermark logo in background */}
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          opacity: 0.03,
          pointerEvents: "none",
        }}
      >
        <VerifiedIcon sx={{ fontSize: 400, color: "#0f172a" }} />
      </Box>

      {/* Borders */}
      <DecorativeBorder />

      {/* ─── Content ─────────────────────────────────────────────────────── */}
      <Box sx={{ position: "relative", px: 10, py: 7, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        
        {/* Header Ribbon */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
          <Box sx={{ width: 60, height: 2, background: "linear-gradient(90deg, transparent, #d4af37)" }} />
          <Typography
            sx={{
              fontFamily: "'Georgia', serif",
              fontSize: "1.2rem",
              fontWeight: 600,
              letterSpacing: "0.2em",
              color: "#d4af37",
              textTransform: "uppercase",
            }}
          >
            Ethical AI Certification
          </Typography>
          <Box sx={{ width: 60, height: 2, background: "linear-gradient(-90deg, transparent, #d4af37)" }} />
        </Box>

        {/* Main Title */}
        <Typography
          sx={{
            fontFamily: "'Georgia', serif",
            fontSize: "3.2rem",
            fontWeight: 800,
            color: "#0f172a",
            mb: 1,
            textShadow: "1px 1px 0px #fff, 2px 2px 4px rgba(0,0,0,0.05)",
          }}
        >
          {overallPassed ? "Certificate of Compliance" : "Validation Record"}
        </Typography>

        <Typography
          sx={{
            fontSize: "1.1rem",
            fontWeight: 400,
            color: "#64748b",
            fontStyle: "italic",
            mb: 4,
          }}
        >
          This official document acknowledges that
        </Typography>

        {/* Recipient / Model Name */}
        <Box sx={{ mb: 4, position: "relative", width: "100%", maxWidth: 600 }}>
          <Typography
            sx={{
              fontFamily: "'Georgia', serif",
              fontSize: "2.8rem",
              fontWeight: 700,
              color: "#1e293b",
              lineHeight: 1.2,
              px: 4,
              pb: 1,
              borderBottom: "2px solid #d4af37",
            }}
          >
            {recipientName}
          </Typography>
        </Box>

        {/* Description Text */}
        <Typography
          sx={{
            fontSize: "1.05rem",
            color: "#334155",
            maxWidth: 680,
            lineHeight: 1.8,
            mb: 4,
          }}
        >
          {overallPassed
            ? `Has successfully undergone rigorous automated auditing and satisfied all critical thresholds for Fairness, Privacy, Transparency, and Accountability. The AI system named `
            : `Has completed a standardized algorithmic audit. The results of the evaluated ethical constraints for the AI system named `}
          <strong style={{ color: "#0f172a" }}>{projectName || "the specified project"}</strong>
          {overallPassed ? ` are officially certified by this platform.` : ` have been securely recorded.`}
        </Typography>

        {/* Validation Badges */}
        {passed.length > 0 && (
          <Box sx={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 2, mb: 6 }}>
            {passed.map((v) => (
              <Box
                key={v}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 2.5,
                  py: 1,
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "30px",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
                }}
              >
                <VerifiedIcon sx={{ color: overallPassed ? "#10b981" : "#f59e0b", fontSize: 18 }} />
                <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {labelForValidator(v)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {/* Footer Grid */}
        <Box sx={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-end", mt: "auto", px: 4 }}>
          
          {/* Left: Date & ID */}
          <Box sx={{ textAlign: "left" }}>
            <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", mb: 0.5 }}>
              Date of Issuance
            </Typography>
            <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: "#0f172a", mb: 2 }}>
              {date}
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", mb: 0.5 }}>
              Certificate ID
            </Typography>
            <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, color: "#0f172a", fontFamily: "monospace" }}>
              {certId}
            </Typography>
          </Box>

          {/* Center: Gold Seal */}
          <Box
            sx={{
              position: "relative",
              width: 110,
              height: 110,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #bf953f, #fcf6ba, #b38728, #fbf5b7, #aa771c)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 15px rgba(0,0,0,0.1), inset 0 2px 4px rgba(255,255,255,0.5)",
              border: "2px dashed rgba(255,255,255,0.6)",
              "&::before": {
                content: '""',
                position: "absolute",
                inset: 6,
                borderRadius: "50%",
                border: "1px solid rgba(0,0,0,0.1)",
              }
            }}
          >
            <Box sx={{ textAlign: "center", zIndex: 1 }}>
              <TrophyIcon sx={{ fontSize: 36, color: "#8a611c", mb: 0.5 }} />
              <Typography sx={{ fontSize: "0.55rem", fontWeight: 800, color: "#8a611c", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                {overallPassed ? "Certified" : "Audited"}
              </Typography>
            </Box>
          </Box>

          {/* Right: Signature */}
          <Box sx={{ textAlign: "center" }}>
            <Typography
              sx={{
                fontFamily: "'Allura', 'Great Vibes', cursive, 'Georgia', serif",
                fontSize: "2.4rem",
                color: "#1e293b",
                lineHeight: 0.8,
                mb: 1,
              }}
            >
              Ethical AI
            </Typography>
            <Box sx={{ width: 180, height: 1, backgroundColor: "#cbd5e1", mb: 1 }} />
            <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Authorized Authority
            </Typography>
          </Box>

        </Box>
      </Box>
    </Box>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function CertificateModal({
  open,
  onClose,
  recipientName,
  projectName,
  suiteId,
  validationsPassed,
  overallPassed,
  issuedAt,
}: CertificateModalProps) {
  const certRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const handleDownloadPdf = async () => {
    if (!certRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(certRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [canvas.width / 2, canvas.height / 2],
      });

      pdf.addImage(imgData, "PNG", 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`ethical_ai_certificate_${suiteId.substring(0, 8)}.pdf`);
    } catch (err) {
      console.error("PDF export failed", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          background: "#060c18",
          border: "1px solid rgba(201,168,76,0.2)",
          borderRadius: "16px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.8), 0 0 60px rgba(201,168,76,0.08)",
          maxWidth: "960px",
          width: "100%",
          overflow: "hidden",
        },
      }}
    >
      {/* Dialog Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 3,
          py: 2,
          borderBottom: "1px solid rgba(201,168,76,0.15)",
          background: "rgba(201,168,76,0.03)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <TrophyIcon sx={{ color: "#c9a84c", fontSize: 22 }} />
          <Typography sx={{ fontWeight: 700, fontSize: "1rem", color: "#f8fafc" }}>
            Certificate Preview
          </Typography>
          {overallPassed && (
            <Box
              sx={{
                px: 1.5,
                py: 0.3,
                borderRadius: "12px",
                background: "rgba(34,197,94,0.12)",
                border: "1px solid rgba(34,197,94,0.3)",
              }}
            >
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#22c55e", letterSpacing: "0.06em" }}>
                PASSED
              </Typography>
            </Box>
          )}
        </Box>
        <Tooltip title="Close">
          <IconButton onClick={onClose} size="small" sx={{ color: "#64748b" }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Certificate Preview */}
      <DialogContent
        sx={{
          p: 3,
          display: "flex",
          justifyContent: "center",
          background: "rgba(0,0,0,0.2)",
          overflowX: "auto",
        }}
      >
        <Box
          ref={certRef}
          sx={{
            display: "inline-block",
            boxShadow: "0 8px 48px rgba(0,0,0,0.6), 0 0 24px rgba(201,168,76,0.12)",
            borderRadius: "8px",
          }}
        >
          <CertificateCanvas
            recipientName={recipientName}
            projectName={projectName}
            suiteId={suiteId}
            validationsPassed={validationsPassed}
            overallPassed={overallPassed}
            issuedAt={issuedAt}
          />
        </Box>
      </DialogContent>

      {/* Actions */}
      <DialogActions
        sx={{
          px: 3,
          py: 2,
          gap: 1.5,
          borderTop: "1px solid rgba(201,168,76,0.12)",
          justifyContent: "flex-end",
        }}
      >
        <Button variant="outlined" onClick={onClose} sx={{ borderColor: "rgba(148,163,184,0.3)", color: "#94a3b8" }}>
          Close
        </Button>
        <Button
          variant="contained"
          startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
          onClick={handleDownloadPdf}
          disabled={exporting}
          sx={{
            background: overallPassed
              ? "linear-gradient(135deg, #b8860b 0%, #d4a017 50%, #b8860b 100%)"
              : "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)",
            color: overallPassed ? "#0a0f1e" : "#fff",
            fontWeight: 700,
            letterSpacing: "0.04em",
            "&:hover": {
              background: overallPassed
                ? "linear-gradient(135deg, #d4a017 0%, #f0c030 50%, #d4a017 100%)"
                : "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
            },
          }}
        >
          {exporting ? "Generating PDF…" : "Download PDF"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
