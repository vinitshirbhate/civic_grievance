import React from "react";
import { RotateLoader } from "react-spinners";
import spinnerBottomImage from "../assets/spinner-bottom.png";

const SpinnerModal = ({ visible }) => {
  return (
    <div
      className={`fixed inset-0 bg-slate-950/65 backdrop-blur-sm h-screen w-full flex justify-center items-center z-[1300] flex-col transition-opacity duration-200 ${
        visible ? "block" : "hidden"
      }`}
    >
      <div className="frost-panel px-8 py-7 flex flex-col items-center loading-pop">
        <RotateLoader color="#0E7490" />
        <p className="text-slate-800 font-extrabold mt-8 text-lg">Please wait...</p>
        <p className="text-slate-500 text-sm mt-1">Processing your request</p>
      </div>
      <img
        className="absolute bottom-0 w-auto lg:h-36 h-16 opacity-90"
        src={spinnerBottomImage}
        alt=""
      />
    </div>
  );
};

export default SpinnerModal;
