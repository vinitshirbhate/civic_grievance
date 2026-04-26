import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import React, { useState } from "react";
import { toast } from "react-toastify";
import { submitResolution } from "../utils/complaintApi";
import { uploadToCloudinary } from "../utils/cloudinaryUploader";

const ResolveComplaintModal = ({ complaint, open, onClose }) => {
    const [resolutionImage, setResolutionImage] = useState(null);
    const [imagePreview, setImagePreview] = useState("");
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setResolutionImage(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async () => {
        if (!resolutionImage) {
            toast.error("Please upload a resolution photo.");
            return;
        }

        setIsUploading(true);
        try {
            const imageUrl = await uploadToCloudinary(resolutionImage);
            await submitResolution(complaint.id, imageUrl);
            toast.success("Complaint resolved successfully!");
            handleClose();
        } catch (error) {
            toast.error("Failed to resolve complaint. Please try again.");
            console.error("Error resolving complaint:", error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleClose = () => {
        setResolutionImage(null);
        setImagePreview("");
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" PaperProps={{ className: "!rounded-2xl" }}>
            <DialogTitle className="!border-b !border-slate-200">
                <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">Resolution Upload</p>
                <h3 className="text-lg font-extrabold mt-1">Resolve: {complaint.reason}</h3>
            </DialogTitle>
            <DialogContent className="!pt-4">
                <p className="my-2 text-slate-600">
                    Upload a clear after-resolution photo as proof before closing this complaint.
                </p>
                <Button variant="contained" component="label" fullWidth className="!rounded-full !mt-2">
                    Upload After Photo
                    <input type="file" hidden accept="image/*" onChange={handleFileChange} />
                </Button>
                {imagePreview && (
                    <div className="mt-4 frost-panel p-3">
                        <p className="font-semibold text-center">Preview</p>
                        <img src={imagePreview} alt="Resolution preview" className="w-full h-auto rounded-xl object-contain max-h-64 mt-2 bg-slate-100" />
                    </div>
                )}
            </DialogContent>
            <DialogActions className="!px-6 !pb-5 !border-t !border-slate-200">
                <Button onClick={handleClose} color="secondary" variant="outlined">Cancel</Button>
                <Button onClick={handleSubmit} color="primary" variant="contained" disabled={isUploading || !resolutionImage}>
                    {isUploading ? "Submitting..." : "Submit Resolution"}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ResolveComplaintModal;

