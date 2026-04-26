import styled from "@emotion/styled";
import { Button } from "@mui/material";
import MuiTextField from "@mui/material/TextField";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerCitizen } from "../utils/apiAuth";

export const TextField = styled(MuiTextField)((props) => ({
  width: "100%",
  [`& fieldset`]: {
    borderRadius: "14px",
  },
}));
const RegisterAccount = () => {
  const [FormData, setFormData] = useState({
    name: "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",
  });
  const [Err, setErr] = useState(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (FormData.password != FormData.confirmPassword) {
      setErr("The password and confirmation password do not match.");
    } else {
      setErr(null);
    }
  }, [FormData]);
  return (
    <div
      className="RegisterAccount flex flex-col gap-5 items-center 
      px-4 lg:px-6 py-6 mx-2 lg:mx-6 rounded-3xl
    "
    >
      <p className="Slogan text-sm lg:text-lg text-center text-slate-700">
        Join your city network and start creating civic impact.
      </p>
      <form
        action=""
        className=" flex flex-col gap-5 w-full"
        onSubmit={(e) => {
          e.preventDefault();

          if (Err) {
            return;
          }

          registerCitizen(FormData)
            .then(() => {
              navigate("/citizen-dashboard?newUser=true");
            })
            .catch((err) => {
              const message = err?.response?.data?.message || err.message;
              setErr(message);
            });
        }}
      >
        <TextField
          variant="outlined"
          label="Full Name"
          required
          value={FormData.name}
          onChange={(e) => setFormData({ ...FormData, name: e.target.value })}
        />
        <TextField
          variant="outlined"
          label="E-mail"
          type="email"
          required
          value={FormData.email}
          onChange={(e) => setFormData({ ...FormData, email: e.target.value })}
        />
        <TextField
          variant="outlined"
          label="Phone No."
          type="tel"
          required
          value={FormData.mobile}
          onChange={(e) => setFormData({ ...FormData, mobile: e.target.value })}
        />
        <TextField
          variant="outlined"
          label="Password"
          type="password"
          required
          value={FormData.password}
          onChange={(e) =>
            setFormData({ ...FormData, password: e.target.value })
          }
        />
        <TextField
          variant="outlined"
          label="Confirm Password"
          type="password"
          required
          value={FormData.confirmPassword}
          onChange={(e) =>
            setFormData({ ...FormData, confirmPassword: e.target.value })
          }
        />
        <p className="text-red-600 text-sm">{Err}</p>
        <Button variant="contained" type="submit" className="brand-button">
          Create Account
        </Button>
      </form>
    </div>
  );
};

export default RegisterAccount;
