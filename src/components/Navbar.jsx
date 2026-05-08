import styled from "@emotion/styled";
import { faBars, faBell, faClose, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  Badge,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import MuiButton from "@mui/material/Button";
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../utils/Firebase";
import {
  deleteNotification,
  deleteReadNotifications,
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../utils/notificationApi";
import { isOfficial } from "../utils/roleApi";
import { getUserProfile } from "../utils/userApi";
// --- STEP 1: DELETE the broken import line for the logo ---
// import Logo from "/src/assets/logo.png"; 

export const Button = styled(MuiButton)((props) => ({
  borderRadius: "999px",
  color: "#0F5F76",
  borderColor: "rgba(15,95,118,0.35)",
  padding: "8px 20px",
  fontWeight: 700,
  ":hover": {
    borderColor: "#0F5F76",
    backgroundColor: "rgba(14,116,144,0.08)",
  },
}));

const Navbar = () => {
  const [Visible, setVisible] = useState(false);
  const [User, setUser] = useState(null);
  const [Official, setOfficial] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationAnchor, setNotificationAnchor] = useState(null);
  const navigate = useNavigate();

  const isNotificationMenuOpen = Boolean(notificationAnchor);

  const loadNotifications = async () => {
    try {
      const result = await fetchMyNotifications({ unreadOnly: false, limit: 10 });
      setNotifications(result.notifications || []);
      setUnreadNotifications(result.unreadCount || 0);
    } catch (_error) {
      setNotifications([]);
      setUnreadNotifications(0);
    }
  };

  const handleLogout = () => {
    auth.signOut();
    setUser(null);
    navigate("/");
  };

  useEffect(() => {
    let unsubscribeProfile = null;

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUser(user);
        unsubscribeProfile = getUserProfile(user.uid, (profileData) => {
          setUserProfile(profileData);
        });
        isOfficial().then((res) => {
          setOfficial(res);
        });
        loadNotifications();
      } else {
        setUser(null);
        setUserProfile(null);
        setOfficial(false);
        setNotifications([]);
        setUnreadNotifications(0);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!User) return undefined;

    const intervalId = setInterval(() => {
      loadNotifications();
    }, 30000);

    return () => clearInterval(intervalId);
  }, [User]);

  const openNotificationMenu = (event) => {
    setNotificationAnchor(event.currentTarget);
    loadNotifications();
  };

  const closeNotificationMenu = () => {
    setNotificationAnchor(null);
  };

  const onMarkNotificationRead = async (notificationId) => {
    try {
      await markNotificationRead(notificationId);
      await loadNotifications();
    } catch (_error) {
      // Ignore UI-only notification read errors.
    }
  };

  const onMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      await loadNotifications();
    } catch (_error) {
      // Ignore UI-only notification read errors.
    }
  };

  const onDeleteNotification = async (notificationId) => {
    try {
      await deleteNotification(notificationId);
      await loadNotifications();
    } catch (_error) {
      // Ignore UI-only notification delete errors.
    }
  };

  const onDeleteReadNotifications = async () => {
    try {
      await deleteReadNotifications();
      await loadNotifications();
    } catch (_error) {
      // Ignore UI-only notification delete errors.
    }
  };

  return (
    <>
      <div className="Navbar w-screen flex justify-between items-center px-4 py-3 lg:py-4 lg:px-10">
        <Link to="/" className="flex items-center gap-3">
          <img className="logo h-9 lg:h-11" src="/logo.png" alt="Nagar Nigraani Logo" />
          <div>
            <h2 className="font-extrabold text-sm lg:text-lg leading-tight">Nagar Nigraani</h2>
            <p className="text-[11px] lg:text-xs text-slate-500">Civic Intelligence Platform</p>
          </div>
        </Link>
        {User ? (
          <div className="ButtonGroup gap-3 hidden lg:flex items-center">
            <p className="px-3 py-1.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-900 font-bold text-sm">
              {userProfile?.points || 0} pts
            </p>

            <Tooltip title="Notifications">
              <IconButton onClick={openNotificationMenu}>
                <Badge badgeContent={unreadNotifications} color="error">
                  <FontAwesomeIcon icon={faBell} />
                </Badge>
              </IconButton>
            </Tooltip>

            <Menu
              anchorEl={notificationAnchor}
              open={isNotificationMenuOpen}
              onClose={closeNotificationMenu}
              PaperProps={{ style: { width: 360, maxHeight: 380 } }}
            >
              <div className="flex gap-2 px-3 py-2 border-b border-slate-100">
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  disabled={unreadNotifications === 0}
                  className="text-xs font-semibold px-2 py-1 rounded border border-slate-300 bg-white text-slate-700 disabled:opacity-50"
                >
                  Mark all as read
                </button>
                <button
                  type="button"
                  onClick={onDeleteReadNotifications}
                  className="text-xs font-semibold px-2 py-1 rounded border border-rose-300 bg-rose-50 text-rose-700"
                >
                  Delete read
                </button>
              </div>
              {notifications.length === 0 ? (
                <MenuItem dense disabled>
                  No notifications
                </MenuItem>
              ) : (
                notifications.map((item) => (
                  <MenuItem
                    key={item._id}
                    dense
                    onClick={() => onMarkNotificationRead(item._id)}
                    style={{
                      whiteSpace: "normal",
                      alignItems: "flex-start",
                      fontWeight: item.readAt ? 400 : 700,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 w-full">
                      <div>
                        <div>{item.message}</div>
                        <div style={{ fontSize: "0.75rem", color: "#6B7280", marginTop: 4 }}>
                          {new Date(item.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label="Delete notification"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteNotification(item._id);
                        }}
                        className="text-rose-600 hover:text-rose-700 p-1 rounded"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </MenuItem>
                ))
              )}
            </Menu>

            <Button
              component={Link}
              to={Official ? "/official-dashboard" : "/citizen-dashboard"}
              variant="outlined"
            >
              Dashboard
            </Button>
            <Button onClick={handleLogout} variant="outlined">
              Logout
            </Button>
          </div>
        ) : (
          <div className="ButtonGroup gap-3 hidden lg:flex">
            <Button component={Link} to={"/official-login"} variant="outlined">
              Official Login
            </Button>
            <Button component={Link} to={"/citizen-login"} variant="outlined">
              Citizen Login
            </Button>
          </div>
        )}

        <FontAwesomeIcon
          className="lg:hidden cursor-pointer text-xl"
          icon={Visible ? faClose : faBars}
          onClick={() => {
            setVisible(!Visible);
          }}
        />
      </div>

      {Visible ? (
        <div className="lg:hidden px-4 pb-4">
          <div className="frost-panel p-3 flex flex-col gap-2">
            {User ? (
              <>
                <Link to={Official ? "/official-dashboard" : "/citizen-dashboard"} onClick={() => setVisible(false)}>
                  <Button fullWidth variant="outlined">Dashboard</Button>
                </Link>
                <Button fullWidth variant="outlined" onClick={() => { setVisible(false); handleLogout(); }}>
                  Logout
                </Button>
                <p className="text-xs text-slate-500 mt-1">Unread notifications: {unreadNotifications}</p>
              </>
            ) : (
              <>
                <Link to="/official-login" onClick={() => setVisible(false)}>
                  <Button fullWidth variant="outlined">Official Login</Button>
                </Link>
                <Link to="/citizen-login" onClick={() => setVisible(false)}>
                  <Button fullWidth variant="outlined">Citizen Login</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
};

export default Navbar;
