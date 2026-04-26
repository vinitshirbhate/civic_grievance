import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import { Link } from "react-router-dom";

const DashboardLinkButton = ({
  name,
  icon,
  link,
  onClick,
  className,
  subtitle,
}) => {
  return (
    <Link
      className="block"
      to={link}
      onClick={() => {
        onClick ? onClick() : null;
      }}
    >
      <div
        className={
          `DashboardLinkButton w-100 flex flex-col justify-center items-center px-8 py-10 mx-10 my-5 gap-2 text-center
      lg:h-80 lg:text-lg
      ` + className
        }
      >
        <div className="w-14 h-14 rounded-full bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-800">
          <FontAwesomeIcon size={"lg"} icon={icon} />
        </div>
        <p className="mt-3 text-center font-bold">{name}</p>
        <p
          className={`text-center text-xs lg:text-sm text-slate-500 ${
            !subtitle ? "hidden" : "block"
          }`}
        >
          {subtitle}
        </p>
      </div>
    </Link>
  );
};

export default DashboardLinkButton;
