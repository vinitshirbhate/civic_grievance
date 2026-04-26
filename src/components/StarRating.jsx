import { faStar } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useState } from "react";

const StarRating = ({ rating, onRatingChange, readOnly = false }) => {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex items-center justify-center">
      {[...Array(5)].map((_, index) => {
        const starValue = index + 1;
        return (
          <label key={starValue} className={`cursor-pointer ${readOnly ? 'cursor-default' : ''}`}>
            <input
              type="radio"
              name="rating"
              className="hidden"
              value={starValue}
              onClick={() => !readOnly && onRatingChange(starValue)}
              readOnly={readOnly}
            />
            <FontAwesomeIcon
              icon={faStar}
              className="text-2xl transition-colors"
              color={starValue <= (hover || rating) ? "#ffc107" : "#e4e5e9"}
              onMouseEnter={() => !readOnly && setHover(starValue)}
              onMouseLeave={() => !readOnly && setHover(0)}
            />
          </label>
        );
      })}
    </div>
  );
};

export default StarRating;

