import { faClockFour } from "@fortawesome/free-regular-svg-icons";
import { faClose, faMapMarkerAlt } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Send } from "@mui/icons-material";
import {
  Button,
  Chip,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import { auth } from "../utils/Firebase";
import {
  addComment,
  assignComplaintToMe,
  fetchComplaintEvents,
  markAsRejected,
  reassignComplaint,
  startComplaintWork,
} from "../utils/complaintApi";
import { isAdmin, isOfficial } from "../utils/roleApi";
import { listOfficials } from "../utils/userApi";
import { Statuses, statusColors } from "../utils/enums";
import CommentsTile from "./CommentsTile";

const ComplaintDetailModal = ({ setDialogOpen, complaint, onResolveClick }) => {
  const [official, setOfficial] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [officials, setOfficials] = useState([]);
  const [selectedOfficialId, setSelectedOfficialId] = useState("");
  const [reassignNote, setReassignNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [commentFValue, setCommentFValue] = useState("");
  const [commentBoxDisabled, setCommentBoxDisabled] = useState(true);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) return;

      isOfficial().then((value) => setOfficial(value));
      isAdmin().then(async (value) => {
        setAdmin(value);
        if (value) {
          const users = await listOfficials();
          setOfficials(users);
        }
      });
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadComplaintEvents = async () => {
      if (!complaint?.id) return;
      setEventsLoading(true);
      try {
        const timeline = await fetchComplaintEvents(complaint.id);
        setEvents(timeline);
      } catch (_error) {
        setEvents([]);
      } finally {
        setEventsLoading(false);
      }
    };

    loadComplaintEvents();
  }, [complaint?.id]);

  const timeStamp = new Date(complaint.timestamp);
  const date = timeStamp.toLocaleDateString();
  const time = timeStamp.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });

  const statusColorEnum = Object.keys(Statuses).find((key) => Statuses[key] === complaint.status);

  return (
    <div className="max-w-3xl">
      <DialogTitle className="flex justify-between items-center border-b border-slate-200">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">Complaint Detail</p>
          <h3 className="text-lg font-extrabold mt-1">{complaint.reason}</h3>
        </div>
        <DialogActions>
          <FontAwesomeIcon
            onClick={() => {
              setDialogOpen((prevState) => !prevState);
            }}
            className="cursor-pointer text-slate-500"
            icon={faClose}
          />
        </DialogActions>
      </DialogTitle>

      <DialogContent className="!pt-4">
        <div className="space-y-4">
          <div className="frost-panel p-4 flex flex-wrap gap-3 justify-between items-center">
            <div className="flex gap-3 items-center">
              <FontAwesomeIcon icon={faMapMarkerAlt} />
              <p className="font-semibold">{complaint.location.name}</p>
            </div>
            <span
              className="text-center rounded-full font-bold flex items-center text-white px-4 py-1.5 text-sm"
              style={{ backgroundColor: statusColors[statusColorEnum] }}
            >
              {complaint.status}
            </span>
          </div>

          <div className="frost-panel p-4">
            <div className="flex gap-3 items-center text-slate-600 mb-3">
              <FontAwesomeIcon icon={faClockFour} />
              <p>{date + " , " + time}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <p>
                <b>Department:</b> {complaint.department || "General"}
              </p>
              <p>
                <b>Zone:</b> {complaint.zone || "Central"}
              </p>
              <p>
                <b>SLA Due:</b> {complaint.dueAt ? new Date(complaint.dueAt).toLocaleString() : "N/A"}
              </p>
              <p>
                <b>Assigned To:</b> {complaint.assignedOfficerName || "Unassigned"}
              </p>
              <p>
                <b>Workflow Stage:</b> {complaint.workflowStatus || "Open"}
              </p>
              <p>
                <b>Severity:</b> {complaint.severity || "Low"}
              </p>
            </div>
            {complaint.escalated ? (
              <p className="text-red-600 font-semibold mt-2">Escalated: SLA breached</p>
            ) : null}
          </div>

          <div className="frost-panel p-4">
            <h2 className="text-base font-bold mb-2">Description</h2>
            <p className="text-slate-700">{complaint.additionalInfo}</p>
          </div>

          <div className="frost-panel p-4">
            <h2 className="text-base font-bold mb-2">Timeline</h2>
            {eventsLoading ? <p className="text-slate-600">Loading timeline...</p> : null}
            {!eventsLoading && events.length === 0 ? (
              <p className="text-slate-500">No timeline events found.</p>
            ) : null}
            {!eventsLoading && events.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {events.map((event) => (
                  <div key={event.id} className="border border-slate-200 rounded-xl p-3 bg-white">
                    <div className="flex justify-between items-start gap-2">
                      <p className="font-semibold text-sm">{event.eventType}</p>
                      <p className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</p>
                    </div>
                    <p className="text-sm text-gray-700 mt-1">
                      {event.actorName}
                      {event.actorRole ? ` (${event.actorRole})` : ""}
                    </p>
                    {event.fromStatus || event.toStatus ? (
                      <div className="mt-1">
                        <Chip size="small" label={`${event.fromStatus || "-"} -> ${event.toStatus || "-"}`} />
                      </div>
                    ) : null}
                    {event.note ? <p className="text-sm mt-1">{event.note}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {admin ? (
            <div className="frost-panel p-4">
              <p className="font-semibold mb-2">Admin Reassign</p>
              <select
                className="w-full border border-slate-300 rounded-xl px-3 py-2 mb-2 bg-white"
                value={selectedOfficialId}
                onChange={(e) => setSelectedOfficialId(e.target.value)}
              >
                <option value="">Select official</option>
                {officials.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
              <TextField
                fullWidth
                size="small"
                label="Reassign note"
                value={reassignNote}
                onChange={(e) => setReassignNote(e.target.value)}
              />
              <div className="mt-2">
                <Button
                  variant="outlined"
                  disabled={!selectedOfficialId}
                  onClick={async () => {
                    await reassignComplaint(complaint.id, selectedOfficialId, reassignNote);
                    setDialogOpen(false);
                  }}
                >
                  Reassign
                </Button>
              </div>
            </div>
          ) : null}

          <div className="frost-panel p-4">
            <h2 className="text-base font-bold mb-2">Evidence</h2>
            {complaint.mediaType === "image" ? (
              <img
                className="max-w-full w-auto h-80 object-scale-down rounded-xl bg-slate-100"
                src={complaint.mediaPath}
              />
            ) : (
              <video
                controls
                className="max-w-full w-auto h-80 object-scale-down rounded-xl bg-slate-100"
                src={complaint.mediaPath}
              />
            )}
          </div>

          <div className="frost-panel p-4">
            <h2 className="text-base font-bold mb-3">Comments</h2>
            <div className="space-y-3">
              {complaint.comments && complaint.comments.length === 0 ? (
                <p className="text-center text-slate-500">No comments yet.</p>
              ) : (
                complaint.comments.map((comment) => <CommentsTile key={comment.id} comment={comment} />)
              )}
            </div>

            <div className={`${complaint.status !== Statuses.inProgress ? "hidden" : "flex"} mt-4 gap-3 items-center`}>
              <TextField
                fullWidth
                value={commentFValue}
                onChange={(e) => {
                  setCommentFValue(e.target.value);
                  if (e.target.value == "") {
                    setCommentBoxDisabled(true);
                  } else {
                    setCommentBoxDisabled(false);
                  }
                }}
                variant="outlined"
                label="Add your comment"
              />
              <IconButton
                className="!h-10 !w-10 !border !border-slate-300 !rounded-full !text-cyan-700"
                onClick={() => {
                  addComment(complaint.id, commentFValue);
                  setCommentFValue("");
                }}
                disabled={commentBoxDisabled}
              >
                <Send />
              </IconButton>
            </div>
          </div>

          {official && complaint.status === Statuses.inProgress ? (
            <div className="frost-panel p-4">
              <p className="font-semibold mb-2">Rejection Note (optional)</p>
              <TextField
                fullWidth
                size="small"
                label="Reason for rejection"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
              />
            </div>
          ) : null}
        </div>
      </DialogContent>

      <DialogActions className="!px-6 !pb-5 border-t border-slate-200">
        {official && complaint.status === Statuses.inProgress ? (
          <>
            {!complaint.assignedOfficerName ? (
              <Button
                color="primary"
                variant="outlined"
                onClick={async () => {
                  await assignComplaintToMe(complaint.id);
                  setDialogOpen(false);
                }}
              >
                Assign To Me
              </Button>
            ) : null}
            {complaint.workflowStatus === "Assigned" ? (
              <Button
                color="info"
                variant="outlined"
                onClick={async () => {
                  await startComplaintWork(complaint.id);
                  setDialogOpen(false);
                }}
              >
                Start Work
              </Button>
            ) : null}
            <Button
              color="error"
              variant="outlined"
              onClick={async () => {
                await markAsRejected(
                  complaint.id,
                  rejectNote.trim() || "Marked as rejected by official"
                );
                setDialogOpen(false);
              }}
            >
              Mark as Rejected
            </Button>
            <Button onClick={onResolveClick} color="success" variant="contained">
              Mark as Solved
            </Button>
          </>
        ) : null}
      </DialogActions>
    </div>
  );
};

export default ComplaintDetailModal;
