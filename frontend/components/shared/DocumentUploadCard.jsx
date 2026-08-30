"use client";

/**
 * components/shared/DocumentUploadCard.jsx
 * Drag-and-drop / click-to-upload card with an in-browser camera capture
 * option (corner guides, flash feedback, front/back camera flip),
 * client-side image compression before upload, and a progress + preview
 * state once a file is attached.
 *
 * Ported from the gigs-app version of this component. Two adaptations for
 * this project:
 *   1. Icons swapped from `lucide-react` (not a dependency here — see
 *      package.json) to `@mui/icons-material`, which already is.
 *   2. `mediaUrl()` now uses this project's `getMediaUrl()` helper
 *      (Functions.js) instead of importing a `STRAPI_URL` constant that
 *      doesn't exist in this codebase — same effect, since both just
 *      prefix a relative Strapi media path with the API root.
 *
 * Usage (mirrors the gigs-app's `uploadAndApply` pattern used in /sell):
 *   <DocumentUploadCard
 *     title="Item photo"
 *     description="A clear photo of the item you're listing"
 *     uploadedFile={draftItem?.actImages?.[0]}
 *     onUpload={(file) => uploadAndApply(file)}
 *     onRemove={() => removeImage()}
 *     disabled={!draftItem}
 *   />
 *
 * `onUpload` should perform the actual network call and throw on
 * failure — this component only handles the surrounding UI (drop zone,
 * camera, compression, fake-progress, preview, remove).
 */
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
    Box,
    Typography,
    Button,
    IconButton,
    LinearProgress,
    Alert,
    Dialog,
    DialogContent,
    Fab,
    Tooltip,
    Fade,
} from "@mui/material";
import UploadIcon from "@mui/icons-material/CloudUploadOutlined";
import CheckIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorIcon from "@mui/icons-material/ErrorOutline";
import CloseIcon from "@mui/icons-material/Close";
import FileIcon from "@mui/icons-material/InsertDriveFileOutlined";
import CameraIcon from "@mui/icons-material/CameraAltOutlined";
import CaptureIcon from "@mui/icons-material/FiberManualRecord";
import FlipIcon from "@mui/icons-material/Cached";
import { motion, AnimatePresence } from "framer-motion";
import { getMediaUrl } from "@/Functions";

// ─── Helpers ────────────────────────────────────────────────────────────────

function mediaUrl(fileOrMedia) {
    if (!fileOrMedia) return null;
    if (fileOrMedia instanceof File) return null; // handled separately via object URL
    if (!fileOrMedia.url) return null;
    return getMediaUrl(fileOrMedia.url);
}

/**
 * Compress an image File/Blob to stay under `maxSizeMB`. Pure browser —
 * no external library needed.
 */
async function compressImage(file, maxSizeMB = 2, maxDimension = 1920) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            URL.revokeObjectURL(url);

            let { width, height } = img;
            if (width > maxDimension || height > maxDimension) {
                const ratio = Math.min(maxDimension / width, maxDimension / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);

            let quality = 0.85;
            const step = () => {
                canvas.toBlob(
                    (blob) => {
                        if (!blob) return reject(new Error("Canvas toBlob failed"));
                        if (blob.size <= maxSizeMB * 1024 * 1024 || quality <= 0.2) {
                            const compressed = new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() });
                            resolve(compressed);
                        } else {
                            quality -= 0.1;
                            step();
                        }
                    },
                    "image/jpeg",
                    quality
                );
            };
            step();
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Image load failed"));
        };
        img.src = url;
    });
}

// ─── In-Browser Camera Modal ─────────────────────────────────────────────────

function CameraModal({ open, onClose, onCapture }) {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [facingMode, setFacingMode] = useState("environment"); // 'user' | 'environment'
    const [ready, setReady] = useState(false);
    const [flash, setFlash] = useState(false);
    const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
    const [camError, setCamError] = useState(null);

    const startStream = useCallback(async (facing) => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
        setReady(false);
        setCamError(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
                audio: false,
            });

            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => setReady(true);
            }

            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = devices.filter((d) => d.kind === "videoinput");
            setHasMultipleCameras(videoInputs.length > 1);
        } catch (err) {
            setCamError(
                err.name === "NotAllowedError"
                    ? "Camera permission denied. Please allow camera access in your browser settings."
                    : `Camera error: ${err.message}`
            );
        }
    }, []);

    useEffect(() => {
        if (open) startStream(facingMode);
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
                streamRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps — intentional: only on open/close
    }, [open]);

    function handleFlipCamera() {
        const next = facingMode === "environment" ? "user" : "environment";
        setFacingMode(next);
        startStream(next);
    }

    const handleCapture = useCallback(async () => {
        if (!videoRef.current || !ready) return;

        setFlash(true);
        setTimeout(() => setFlash(false), 200);

        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0);

        canvas.toBlob(
            async (blob) => {
                if (!blob) return;
                const raw = new File([blob], `capture_${Date.now()}.jpg`, { type: "image/jpeg" });
                const compressed = await compressImage(raw, 2, 1920);
                onCapture(compressed);
                onClose();
            },
            "image/jpeg",
            0.92
        );
    }, [ready, onCapture, onClose]);

    return (
        <Dialog open={open} onClose={onClose} fullScreen TransitionComponent={Fade} PaperProps={{ sx: { bgcolor: "#000", m: 0 } }}>
            <DialogContent sx={{ p: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <IconButton
                    onClick={onClose}
                    sx={{
                        position: "absolute", top: 16, right: 16, zIndex: 10,
                        color: "white", bgcolor: "rgba(0,0,0,0.45)",
                        "&:hover": { bgcolor: "rgba(0,0,0,0.65)" },
                    }}
                >
                    <CloseIcon fontSize="small" />
                </IconButton>

                {camError ? (
                    <Box sx={{ p: 3, textAlign: "center" }}>
                        <CameraIcon sx={{ fontSize: 56, color: "grey.600", mb: 2 }} />
                        <Typography color="grey.400" variant="body2">
                            {camError}
                        </Typography>
                    </Box>
                ) : (
                    <>
                        <Box
                            component="video"
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            sx={{
                                width: "100%", height: "100%",
                                objectFit: "cover",
                                transform: facingMode === "user" ? "scaleX(-1)" : "none",
                                transition: "opacity 0.3s",
                                opacity: ready ? 1 : 0,
                            }}
                        />

                        <AnimatePresence>
                            {flash && (
                                <motion.div
                                    key="flash"
                                    initial={{ opacity: 0.8 }}
                                    animate={{ opacity: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    style={{ position: "absolute", inset: 0, background: "white", pointerEvents: "none", zIndex: 5 }}
                                />
                            )}
                        </AnimatePresence>

                        {ready && (
                            <Box sx={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}>
                                {[
                                    { top: "12%", left: "8%", borderTop: "3px solid", borderLeft: "3px solid" },
                                    { top: "12%", right: "8%", borderTop: "3px solid", borderRight: "3px solid" },
                                    { bottom: "22%", left: "8%", borderBottom: "3px solid", borderLeft: "3px solid" },
                                    { bottom: "22%", right: "8%", borderBottom: "3px solid", borderRight: "3px solid" },
                                ].map((style, i) => (
                                    <Box key={i} sx={{ position: "absolute", width: 28, height: 28, borderColor: "rgba(255,255,255,0.7)", ...style }} />
                                ))}
                            </Box>
                        )}

                        <Box
                            sx={{
                                position: "absolute", bottom: 0, left: 0, right: 0,
                                pb: 5, pt: 3,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                gap: 4,
                                background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)",
                                zIndex: 3,
                            }}
                        >
                            {hasMultipleCameras && (
                                <Tooltip title="Flip camera">
                                    <IconButton
                                        onClick={handleFlipCamera}
                                        sx={{ color: "white", bgcolor: "rgba(255,255,255,0.12)", "&:hover": { bgcolor: "rgba(255,255,255,0.22)" } }}
                                    >
                                        <FlipIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            )}

                            <Fab
                                onClick={handleCapture}
                                disabled={!ready}
                                sx={{
                                    width: 72, height: 72,
                                    bgcolor: "white",
                                    border: "4px solid rgba(255,255,255,0.5)",
                                    boxShadow: "0 0 0 6px rgba(255,255,255,0.2)",
                                    "&:hover": { bgcolor: "grey.100", transform: "scale(1.05)" },
                                    "&:active": { transform: "scale(0.96)" },
                                    transition: "all 0.15s ease",
                                    "&.Mui-disabled": { bgcolor: "grey.700" },
                                }}
                            >
                                <CaptureIcon sx={{ fontSize: 30, color: ready ? "#FF8C00" : "#9e9e9e" }} />
                            </Fab>

                            {hasMultipleCameras && <Box sx={{ width: 40, height: 40 }} />}
                        </Box>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DocumentUploadCard({
    title,
    description,
    acceptedFormats = "image/*,application/pdf",
    maxSize = 10, // MB
    onUpload,
    uploadedFile,
    onRemove,
    // When true, the whole card is grayed out and non-interactive — used
    // here while the draft auction-item hasn't been created yet (no refId
    // to attach the upload to).
    disabled = false,
    disabledMessage = "Save first to enable uploads here.",
}) {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState(null);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [cameraSupported, setCameraSupported] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        setCameraSupported(typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia);
    }, []);

    const previewUrl = useMemo(() => {
        if (!uploadedFile) return null;
        if (uploadedFile instanceof File) return URL.createObjectURL(uploadedFile);
        return mediaUrl(uploadedFile);
    }, [uploadedFile]);

    useEffect(() => {
        if (uploadedFile) setFile(uploadedFile);
    }, [uploadedFile]);

    useEffect(() => {
        return () => {
            if (uploadedFile instanceof File && previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [uploadedFile, previewUrl]);

    const processFile = useCallback(
        async (selectedFile) => {
            if (selectedFile.size > maxSize * 1024 * 1024) {
                setError(`File size must be less than ${maxSize} MB`);
                return;
            }

            setError(null);
            setFile(selectedFile);
            setUploading(true);
            setUploadProgress(0);

            const interval = setInterval(() => {
                setUploadProgress((p) => (p >= 90 ? p : p + 10));
            }, 200);

            try {
                const toUpload = selectedFile.type.startsWith("image/")
                    ? await compressImage(selectedFile, Math.min(maxSize, 2))
                    : selectedFile;

                await onUpload(toUpload);
                clearInterval(interval);
                setUploadProgress(100);
                setTimeout(() => setUploading(false), 500);
            } catch (err) {
                clearInterval(interval);
                setError(err.message || "Upload failed");
                setUploading(false);
                setFile(null);
                setUploadProgress(0);
            }
        },
        [maxSize, onUpload]
    );

    function handleFileSelect(e) {
        const f = e.target.files[0];
        if (f) processFile(f);
    }

    const handleCameraCapture = useCallback((capturedFile) => processFile(capturedFile), [processFile]);

    function handleRemove() {
        setFile(null);
        setUploadProgress(0);
        setError(null);
        onRemove?.();
        if (fileInputRef.current) fileInputRef.current.value = "";
    }

    function getFileName() {
        if (!file) return "";
        if (file instanceof File) return file.name;
        return file.name || file.originalFilename || "Uploaded file";
    }

    function getFileSize() {
        if (!file) return 0;
        return file instanceof File ? file.size : file.size ?? 0;
    }

    function isImage() {
        if (!file) return false;
        if (file instanceof File) return file.type.startsWith("image/");
        if (file.mime) return file.mime.startsWith("image/");
        if (file.url) return /\.(jpg|jpeg|png|gif|webp)$/i.test(file.url);
        return false;
    }

    return (
        <>
            <CameraModal open={cameraOpen && !disabled} onClose={() => setCameraOpen(false)} onCapture={handleCameraCapture} />

            <Box
                sx={{
                    borderRadius: 3.5,
                    overflow: "hidden",
                    border: "1px solid",
                    borderColor: error ? "error.main" : "divider",
                    transition: "box-shadow 0.22s ease, border-color 0.22s ease, opacity 0.2s ease",
                    opacity: disabled ? 0.5 : 1,
                    pointerEvents: disabled ? "none" : "auto",
                    filter: disabled ? "grayscale(0.6)" : "none",
                    "&:hover": disabled
                        ? undefined
                        : {
                            boxShadow: error ? "0 4px 20px rgba(211,47,47,0.12)" : "0 4px 20px rgba(255,140,0,0.1)",
                        },
                }}
            >
                <Box
                    sx={{
                        px: 2.5, py: 2,
                        background: error
                            ? "linear-gradient(135deg, rgba(211,47,47,0.08) 0%, rgba(211,47,47,0.04) 100%)"
                            : "linear-gradient(135deg, rgba(255,140,0,0.1) 0%, rgba(255,193,7,0.06) 100%)",
                        borderBottom: "1px solid",
                        borderColor: "divider",
                        display: "flex", alignItems: "flex-start", gap: 1.5,
                    }}
                >
                    <Box
                        sx={{
                            width: 36, height: 36, borderRadius: "50%", flexShrink: 0, mt: 0.25,
                            background: error ? "rgba(211,47,47,0.12)" : "linear-gradient(135deg, rgba(255,140,0,0.2) 0%, rgba(255,193,7,0.14) 100%)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                    >
                        <FileIcon sx={{ fontSize: 18, color: error ? "#d32f2f" : "#FF8C00" }} />
                    </Box>
                    <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.25, mb: 0.3 }}>
                            {title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1.4, display: "block" }}>
                            {disabled ? disabledMessage : description}
                        </Typography>
                    </Box>
                </Box>

                <Box sx={{ p: 2.5, bgcolor: "background.paper" }}>
                    <AnimatePresence mode="wait">
                        {!file ? (
                            <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <Box
                                    onClick={() => fileInputRef.current?.click()}
                                    sx={{
                                        border: "2px dashed",
                                        borderColor: error ? "error.main" : "rgba(255,140,0,0.3)",
                                        borderRadius: 3, p: 3.5, textAlign: "center", cursor: "pointer",
                                        transition: "all 0.2s ease",
                                        "&:hover": {
                                            borderColor: error ? "error.dark" : "#FF8C00",
                                            bgcolor: error ? "rgba(211,47,47,0.03)" : "rgba(255,140,0,0.04)",
                                            transform: "translateY(-1px)",
                                        },
                                        "&:active": { transform: "translateY(0)" },
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 52, height: 52, borderRadius: "50%", mx: "auto", mb: 1.5,
                                            background: error
                                                ? "rgba(211,47,47,0.1)"
                                                : "linear-gradient(135deg, rgba(255,140,0,0.15) 0%, rgba(255,193,7,0.1) 100%)",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                        }}
                                    >
                                        <UploadIcon sx={{ fontSize: 26, color: error ? "#d32f2f" : "#FF8C00" }} />
                                    </Box>
                                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.4 }}>
                                        Click to upload
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: "text.disabled" }}>
                                        PDF · JPG · PNG &nbsp;·&nbsp; Max {maxSize} MB
                                    </Typography>
                                </Box>

                                <Box sx={{ mt: 2, display: "flex", gap: 1.5 }}>
                                    <Button
                                        fullWidth
                                        variant="outlined"
                                        startIcon={<UploadIcon sx={{ fontSize: 18 }} />}
                                        onClick={() => fileInputRef.current?.click()}
                                        sx={{
                                            height: 46, borderRadius: 2.5, fontWeight: 700,
                                            borderColor: "rgba(255,140,0,0.4)", color: "#FF8C00",
                                            "&:hover": { borderColor: "#FF8C00", bgcolor: "rgba(255,140,0,0.05)" },
                                            transition: "all 0.18s ease",
                                        }}
                                    >
                                        Choose File
                                    </Button>

                                    {cameraSupported && (
                                        <Tooltip title="Take photo with camera">
                                            <Button
                                                variant="outlined"
                                                onClick={() => setCameraOpen(true)}
                                                sx={{
                                                    height: 46, minWidth: 52, px: 1.5, borderRadius: 2.5,
                                                    borderColor: "rgba(255,140,0,0.4)", color: "#FF8C00",
                                                    "&:hover": { borderColor: "#FF8C00", bgcolor: "rgba(255,140,0,0.05)" },
                                                    transition: "all 0.18s ease",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <CameraIcon sx={{ fontSize: 20 }} />
                                            </Button>
                                        </Tooltip>
                                    )}
                                </Box>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="uploaded"
                                initial={{ opacity: 0, scale: 0.97 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.97 }}
                                transition={{ duration: 0.18 }}
                            >
                                <Box
                                    sx={{
                                        border: "1.5px solid",
                                        borderColor: uploading ? "rgba(255,140,0,0.4)" : "rgba(46,125,50,0.35)",
                                        borderRadius: 3, p: 2,
                                        background: uploading
                                            ? "linear-gradient(135deg, rgba(255,140,0,0.07) 0%, rgba(255,193,7,0.04) 100%)"
                                            : "linear-gradient(135deg, rgba(46,125,50,0.07) 0%, rgba(76,175,80,0.04) 100%)",
                                        transition: "all 0.25s ease",
                                    }}
                                >
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                        <Box
                                            sx={{
                                                width: 48, height: 48, borderRadius: 2, flexShrink: 0,
                                                overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
                                                background: uploading
                                                    ? "linear-gradient(135deg, #FF8C00 0%, #FFC107 100%)"
                                                    : "linear-gradient(135deg, #388E3C 0%, #4CAF50 100%)",
                                                boxShadow: uploading ? "0 3px 10px rgba(255,140,0,0.3)" : "0 3px 10px rgba(46,125,50,0.25)",
                                            }}
                                        >
                                            {!uploading && isImage() && previewUrl ? (
                                                <img src={previewUrl} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                            ) : uploading ? (
                                                <FileIcon sx={{ fontSize: 22, color: "white" }} />
                                            ) : (
                                                <CheckIcon sx={{ fontSize: 22, color: "white" }} />
                                            )}
                                        </Box>

                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
                                                {getFileName()}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: "text.disabled" }}>
                                                {uploading
                                                    ? `Uploading… ${uploadProgress}%`
                                                    : getFileSize() > 0
                                                        ? `${(getFileSize() / 1024 / 1024).toFixed(2)} MB · Uploaded`
                                                        : "Uploaded"}
                                            </Typography>
                                        </Box>

                                        {!uploading && (
                                            <IconButton
                                                size="small"
                                                onClick={handleRemove}
                                                sx={{
                                                    color: "text.disabled", flexShrink: 0,
                                                    "&:hover": { color: "error.main", bgcolor: "rgba(211,47,47,0.08)" },
                                                    transition: "all 0.15s ease",
                                                }}
                                            >
                                                <CloseIcon sx={{ fontSize: 16 }} />
                                            </IconButton>
                                        )}
                                    </Box>

                                    {uploading && (
                                        <LinearProgress
                                            variant="determinate"
                                            value={uploadProgress}
                                            sx={{
                                                mt: 1.5, height: 5, borderRadius: 3,
                                                bgcolor: "rgba(255,140,0,0.12)",
                                                "& .MuiLinearProgress-bar": {
                                                    background: "linear-gradient(90deg, #FF8C00, #FFC107)",
                                                    borderRadius: 3,
                                                },
                                            }}
                                        />
                                    )}

                                    {!uploading && isImage() && previewUrl && (
                                        <Box sx={{ mt: 2, borderRadius: 2, overflow: "hidden", border: "1px solid", borderColor: "divider", textAlign: "center" }}>
                                            <img
                                                src={previewUrl}
                                                alt="Document preview"
                                                style={{ maxWidth: "100%", maxHeight: 200, display: "block", margin: "0 auto" }}
                                            />
                                        </Box>
                                    )}
                                </Box>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {error && (
                        <Alert severity="error" icon={<ErrorIcon sx={{ fontSize: 18 }} />} sx={{ mt: 2, borderRadius: 2.5 }} onClose={() => setError(null)}>
                            {error}
                        </Alert>
                    )}

                    <input ref={fileInputRef} type="file" accept={acceptedFormats} style={{ display: "none" }} onChange={handleFileSelect} />
                </Box>
            </Box>
        </>
    );
}

export default DocumentUploadCard;
