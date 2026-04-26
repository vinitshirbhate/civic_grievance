import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import RegisterAccount from "../components/RegisterAccount";
import CivicCover from "../assets/civic-cover.svg";
import CivicCoverCharacters from "../assets/civic-cover-characters.svg";
import CivicCoverGrid from "../assets/civic-cover-grid.svg";
import CivicCoverOperations from "../assets/civic-cover-operations.svg";
import CivicCoverUnity from "../assets/civic-cover-unity.svg";
import { auth } from "../utils/Firebase";
import { isOfficial } from "../utils/roleApi";
import Navbar from "/src/components/Navbar";

const coverVariants = {
  civicClassic: CivicCover,
  civicCharacters: CivicCoverCharacters,
  civicGrid: CivicCoverGrid,
  civicOperations: CivicCoverOperations,
  civicUnity: CivicCoverUnity,
};

const ACTIVE_COVER_VARIANT = "civicUnity";

const HomePage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        isOfficial()
          .then((official) => {
            navigate(official ? "/official-dashboard" : "/citizen-dashboard");
          })
          .catch(() => {
            navigate("/citizen-dashboard");
          });
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  return (
    <div className="HomePage page-shell">
      <Navbar />
      <div className="HomeContainer grid grid-cols-1 lg:grid-cols-2 items-stretch px-2 lg:px-16 mt-8 gap-8">
        <div className="civic-cover animate-in">
          <div className="civic-cover-overlay" />
          <img className="civic-cover-art" src={coverVariants[ACTIVE_COVER_VARIANT] || CivicCover} alt="Civic issues visual" />
          <div className="civic-cover-content">
            <p className="civic-cover-badge">Civic Issue Intelligence</p>
            <h3 className="civic-cover-title">Better Civic Life, Built Together</h3>
            <p className="civic-cover-subtitle">
              Report. Track. Resolve.
            </p>
          </div>
        </div>

        <div className="hero-card p-5 lg:p-8 animate-in-delay-1">
          <h3 className="section-title text-center lg:text-left">Create Your Citizen Account</h3>
          <p className="section-subtitle mt-3 text-center lg:text-left mb-3">
            Join Nagar Nigraani to submit road-safety complaints and follow resolution progress live.
          </p>
          <RegisterAccount />
        </div>
      </div>
    </div>
  );
};

export default HomePage;
