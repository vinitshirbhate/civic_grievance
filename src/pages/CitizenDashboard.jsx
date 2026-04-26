import {
  faEdit,
  faMobileScreen,
  faSignOut,
  faTrafficLight,
} from "@fortawesome/free-solid-svg-icons";
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import DashboardLinkButton from "../components/DashboardLinkButton";
import GamificationProfile from "../components/GamificationProfile";
import Navbar from "../components/Navbar";
import PuneLocationPreviewMap from "../components/PuneLocationPreviewMap";
import ReportedComplaints from "../components/ReportedComplaints";
import SpinnerModal from "../components/SpinnerModal";
import { auth } from "../utils/Firebase";
import { identifyLocation } from "../utils/MiscFunctions";
import { isOfficial } from "../utils/roleApi";
import {
  fetchMyGamificationSummary,
  fetchMyPointsLedger,
  getUserProfile,
} from "../utils/userApi";

const CitizenDashboard = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [spinnerVisible, setSpinnerVisible] = useState(true); // Start with spinner
  const [userProfile, setUserProfile] = useState(null);
  const [gamificationSummary, setGamificationSummary] = useState(null);
  const [pointsLedger, setPointsLedger] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        navigate("/citizen-login");
        return;
      }

      // Check if user is official
      isOfficial().then((res) => {
        if (res) {
          navigate("/official-dashboard");
        } else {
          setSpinnerVisible(false);
        }
      });

      getUserProfile(user.uid, (profileData) => {
        setUserProfile(profileData);
      });

      if (params.get("newUser")) {
        toast.success("Registration Successful, Welcome!", { icon: "👋" });
      }
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      unsubscribeAuth();
    };
  }, [navigate, params]);

  useEffect(() => {
    const loadEngagementData = async () => {
      try {
        const [ledger, summary] = await Promise.all([
          fetchMyPointsLedger(6),
          fetchMyGamificationSummary(),
        ]);
        setPointsLedger(ledger);
        setGamificationSummary(summary);
      } catch (_error) {
        setPointsLedger([]);
        setGamificationSummary(null);
      }
    };

    loadEngagementData();
  }, []);

  const detectCurrentLocation = async () => {
    try {
      const detected = await identifyLocation();
      setCurrentLocation(detected);
      toast.success("Current Pune location detected.");
    } catch (error) {
      toast.error(error?.message || "Unable to detect location.");
    }
  };


  const handleInstall = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        setDeferredPrompt(null);
      });
    }
  };

  const handleLogout = () => {
    auth.signOut();
    navigate("/");
  };

  return (
    <>
      <SpinnerModal visible={spinnerVisible} />

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
        Citizen Dashboard
      </h2>

      <div className="mx-4 lg:mx-10 animate-in-delay-1">
        <GamificationProfile userProfile={userProfile} summary={gamificationSummary} />
      </div>

      <div className="mx-4 lg:mx-10 grid grid-cols-1 gap-4 mb-8 animate-in-delay-2">
        <div className="surface-card">
          <h3 className="text-lg font-bold mb-3">Recent Point Activity</h3>
          {pointsLedger.length === 0 ? (
            <p className="text-sm text-gray-600">No recent activity yet.</p>
          ) : (
            pointsLedger.map((entry) => (
              <div key={entry._id} className="py-1 border-b last:border-b-0">
                <p className="font-medium">+{entry.points} points</p>
                <p className="text-sm text-gray-700">{entry.note || entry.action}</p>
                <p className="text-xs text-gray-500">{new Date(entry.createdAt).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>

        <div className="surface-card">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
            <h3 className="text-lg font-bold">Your Current Pune Location</h3>
            <button
              type="button"
              onClick={detectCurrentLocation}
              className="brand-button border border-cyan-300 bg-cyan-50 text-cyan-900"
            >
              Detect Location
            </button>
          </div>
          <p className="text-sm text-slate-600">Use this to verify the exact geolocation that will be attached to your complaint reports.</p>
          {currentLocation ? (
            <div className="mt-2 text-sm text-slate-700">
              <p><b>Address:</b> {currentLocation.name}</p>
              <p>
                <b>Coordinates:</b> {Number(currentLocation.lat).toFixed(5)}, {Number(currentLocation.lng).toFixed(5)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500 mt-2">Tap Detect Location to show your actual Pune coordinates.</p>
          )}
          <PuneLocationPreviewMap location={currentLocation || {}} />
        </div>
      </div>

      <div className="grid lg:grid-cols-[0.8fr_0.6fr] mx-4 lg:mx-10 gap-4 animate-in-delay-2">
        <div>
          <DashboardLinkButton
            icon={faEdit}
            name={"New Complaint"}
            link={"/report"}
          />
          <DashboardLinkButton
            icon={faTrafficLight}
            name={"Track Reported complaints"}
            link={"/track-complaints"}
            className={"lg:hidden"}
          />
          <DashboardLinkButton
            icon={faMobileScreen}
            name={"Install as an app (Mobile)"}
            onClick={handleInstall}
            className={"lg:hidden"}
          />
          <DashboardLinkButton
            icon={faSignOut}
            name={"Logout"}
            onClick={handleLogout}
            className={"lg:hidden"}
          />
        </div>
        <div className="hidden lg:flex">
          <ReportedComplaints />
        </div>
      </div>
    </>
  );
};

export default CitizenDashboard;

