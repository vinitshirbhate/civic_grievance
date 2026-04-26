import { faUser } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useEffect, useState } from "react";
import { fetchUserById } from "../utils/userApi";

const CommentsTile = ({ comment }) => {
  const [CommentAuthor, setCommentAuthor] = useState("");

  useEffect(() => {
    if (comment.authorName) {
      setCommentAuthor({ name: comment.authorName });
      return;
    }

    if (!comment.author) {
      setCommentAuthor({ name: "Unknown" });
      return;
    }

    fetchUserById(comment.author).then((u) => {
      setCommentAuthor(u);
    });
  }, [comment.author, comment.authorName]);

  let TimeStamp = new Date(comment.timestamp);
  let date = TimeStamp.toLocaleDateString();
  let time = TimeStamp.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });
  return (
    <React.Fragment key={comment.timestamp}>
      <div className="border border-slate-200 rounded-xl p-3 bg-white">
        <div className="flex justify-between w-full">
          <div className="h-10 w-10 flex justify-center items-center bg-cyan-700 rounded-full">
            <FontAwesomeIcon icon={faUser} color="#fff" size="1x" />
          </div>
          <div className="font-semibold flex px-4 items-center w-full justify-between gap-2">
            <p>{CommentAuthor.name}</p>
            <p className="text-xs text-slate-500">{date + " , " + time}</p>
          </div>
        </div>
        <p className="ml-14 mt-2 text-slate-700">{comment.comment}</p>
      </div>
    </React.Fragment>
  );
};

export default CommentsTile;
