import { Button } from "@mui/material";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { TextField } from "../components/RegisterAccount";
import SpinnerModal from "../components/SpinnerModal";
import { auth } from "../utils/Firebase";
import { loginUser } from "../utils/apiAuth";

const CitizenLogin = () => {
  const [FormData, setFormData] = useState({
    loginId: "",
    password: "",
  });
  const [Spinner, setSpinner] = useState(false);
  const [Err, setErr] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        return navigate("/citizen-dashboard");
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen page-shell">
      <SpinnerModal visible={Spinner} />
      <Navbar />
      <div className="lg:px-96 px-3 py-10 flex flex-col justify-center">
        <h2 className="section-title text-center my-8">
          Citizen Login
        </h2>
        <div
          className="LoginBox flex flex-col gap-5 items-center 
      px-4 lg:px-12 py-10 mx-1 lg:mx-12 rounded-3xl justify-center
    "
        >
          <form
            action=""
            onSubmit={(e) => {
              e.preventDefault();
              setSpinner(true);
              loginUser(FormData)
                .then(async ({ user }) => {
                  const isOfficialUser = user?.role === "official" || user?.role === "admin";
                  if (!isOfficialUser) {
                    navigate("/citizen-dashboard");
                  } else {
                    await auth.signOut();
                    throw new Error("Invalid user");
                  }
                })
                .catch((err) => {
                  const message = err?.response?.data?.message || err.message;
                  setErr(message);
                })
                .finally(() => {
                  setSpinner(false);
                });
            }}
            className=" flex flex-col gap-5 w-full"
          >
            <TextField
              variant="outlined"
              label="Phone No. or E-mail"
              type="text"
              onChange={(e) =>
                setFormData({ ...FormData, loginId: e.target.value })
              }
              required
            />
            <TextField
              variant="outlined"
              label="Password"
              type="password"
              onChange={(e) =>
                setFormData({ ...FormData, password: e.target.value })
              }
              required
            />
            <p className="text-red-600 text-sm">{Err}</p>

            <Button variant="contained" type="submit" className="brand-button">
              Login
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CitizenLogin;
