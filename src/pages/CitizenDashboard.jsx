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
import ComplaintsHeatmap from "../components/ComplaintsHeatmap";
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
import { fetchComplaints } from "../utils/complaintApi";

const CitizenDashboard = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [spinnerVisible, setSpinnerVisible] = useState(true); // Start with spinner
  const [userProfile, setUserProfile] = useState(null);
  const [gamificationSummary, setGamificationSummary] = useState(null);
  const [pointsLedger, setPointsLedger] = useState([]);
  const [complaints, setComplaints] = useState([]);
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
    const unsubscribeComplaints = fetchComplaints((updatedComplaints) => {
      setComplaints(updatedComplaints);
    });

    return () => {
      unsubscribeComplaints();
    };
  }, []);

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

        <div className="surface-card p-0 overflow-hidden bg-transparent border-0 shadow-none">
           <ComplaintsHeatmap complaints={complaints} />
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

