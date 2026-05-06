import styled from "@emotion/styled";
import { Button } from "@mui/material";
import MuiTextField from "@mui/material/TextField";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerCitizen } from "../utils/apiAuth";
import { apiClient } from "../utils/apiClient";

export const TextField = styled(MuiTextField)((props) => ({
  width: "100%",
  [`& fieldset`]: {
    borderRadius: "14px",
  },
}));

const RegisterAccount = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    aadhaarZip: null,
    shareCode: "",
    phone: "",
    otp: "",
  });
  const [userData, setUserData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    setFormData({ ...formData, aadhaarZip: e.target.files[0] });
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const data = new FormData();
      data.append("aadhaarZip", formData.aadhaarZip);
      data.append("shareCode", formData.shareCode);
      data.append("phone", formData.phone);

      await apiClient.post("/auth/verify-aadhaar", data);
      setStep(2);
    } catch (error) {
      const message = error?.response?.data?.message || error.message;
      setErr(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const res = await apiClient.post("/auth/verify-otp", {
        phone: formData.phone,
        otp: formData.otp,
      });

      const user = res.data.user;
      setUserData(user);

      // Register the citizen using Aadhaar details and auto-generated email/password
      const generatedEmail = `${formData.phone}@aadhaar.local`;
      const generatedPassword = formData.phone;

      await registerCitizen({
        name: user.name,
        email: generatedEmail,
        mobile: formData.phone,
        password: generatedPassword,
      });

      navigate("/citizen-dashboard?newUser=true");
    } catch (error) {
      const message = error?.response?.data?.message || error.message;
      setErr(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="RegisterAccount flex flex-col gap-5 items-center 
      px-4 lg:px-6 py-6 mx-2 lg:mx-6 rounded-3xl
    "
    >
      <p className="Slogan text-sm lg:text-lg text-center text-slate-700">
        Join your city network and start creating civic impact.
      </p>

      {step === 1 && (
        <form
          className="flex flex-col gap-5 w-full"
          onSubmit={handleSendOtp}
        >
          <div className="flex flex-col gap-2">
            <label className="text-sm text-slate-600">Aadhaar Paperless Offline e-KYC (ZIP)</label>
            <input
              type="file"
              accept=".zip"
              required
              onChange={handleFileChange}
              className="p-3 border border-gray-300 rounded-xl"
            />
          </div>
          <TextField
            variant="outlined"
            label="Share Code"
            required
            value={formData.shareCode}
            onChange={(e) => setFormData({ ...formData, shareCode: e.target.value })}
          />
          <TextField
            variant="outlined"
            label="Phone No."
            type="tel"
            required
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <p className="text-red-600 text-sm">{err}</p>
          <Button variant="contained" type="submit" className="brand-button" disabled={loading}>
            {loading ? "Sending OTP..." : "Verify Aadhaar"}
          </Button>
        </form>
      )}

      {step === 2 && (
        <form
          className="flex flex-col gap-5 w-full"
          onSubmit={handleVerifyOtp}
        >
          <TextField
            variant="outlined"
            label="Enter OTP"
            type="text"
            required
            value={formData.otp}
            onChange={(e) => setFormData({ ...formData, otp: e.target.value })}
          />
          <p className="text-red-600 text-sm">{err}</p>
          <Button variant="contained" type="submit" className="brand-button" disabled={loading}>
            {loading ? "Verifying..." : "Complete Registration"}
          </Button>
        </form>
      )}
    </div>
  );
};

export default RegisterAccount;
