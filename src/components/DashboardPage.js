import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./DashboardPage.css";

function DashboardPage() {
  const navigate = useNavigate();
  const [organized, setOrganized] = useState([]);
  const [invited, setInvited] = useState([]);
  const [accepted, setAccepted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    date: "",
    time: "",
    location: "",
    description: "",
  });
  const [creatingEvent, setCreatingEvent] = useState(false);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteEventId, setInviteEventId] = useState(null);
  const [inviting, setInviting] = useState(false);

  const [showInviteSuccess, setShowInviteSuccess] = useState(false);
  const successTimeoutRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchDate, setSearchDate] = useState(""); // <--- new
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [processingResponseId, setProcessingResponseId] = useState(null);
  const [processingDeleteId, setProcessingDeleteId] = useState(null);

  // Confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, title }

  useEffect(() => {
    const email = localStorage.getItem("userEmail") || "User";
    setUserEmail(email);
  }, []);

  const fetchLists = useCallback(async () => {
    setLoading(true);
    try {
      const [organizedRes, invitedRes, acceptedRes] = await Promise.all([
        fetch("http://localhost:8080/events/organized", { credentials: "include" }),
        fetch("http://localhost:8080/events/invited", { credentials: "include" }),
        fetch("http://localhost:8080/events/accepted", { credentials: "include" }),
      ]);

      if (organizedRes.status === 401 || invitedRes.status === 401 || acceptedRes.status === 401) {
        navigate("/login");
        return;
      }

      const organizedData = await organizedRes.json();
      const invitedData = await invitedRes.json();
      const acceptedData = await acceptedRes.json();

      setOrganized(Array.isArray(organizedData) ? organizedData : []);

      const meEmail = localStorage.getItem("userEmail") || userEmail;

      const acceptedIds = new Set(
        Array.isArray(acceptedData) ? acceptedData.map((ev) => String(ev.id)) : []
      );

      const mappedAccepted = Array.isArray(acceptedData)
        ? acceptedData.map((ev) => ({ ...ev, responseStatus: "accepted" }))
        : [];

      const mappedInvited = Array.isArray(invitedData)
        ? invitedData
            .map((ev) => {
              const me = (ev.attendees || []).find((a) => a.email === meEmail);
              const status = me ? me.status : undefined;
              return {
                ...ev,
                responseStatus: status,
              };
            })
            .filter((ev) => {
              const idStr = String(ev.id);
              const isAcceptedByServer = acceptedIds.has(idStr);
              const isPending = ev.responseStatus === "pending" || ev.responseStatus === undefined;
              return isPending && !isAcceptedByServer;
            })
        : [];

      setAccepted(mappedAccepted);
      setInvited(mappedInvited);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [navigate, userEmail]);

  useEffect(() => {
    const email = localStorage.getItem("userEmail") || "User";
    setUserEmail(email);

    fetchLists();
  }, [fetchLists]);

  useEffect(() => {
    if (!searchQuery && !searchDate) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const t = setTimeout(async () => {
      try {
        // build query params (q and date)
        const params = new URLSearchParams();
        if (searchQuery && searchQuery.trim()) params.set("q", searchQuery.trim());
        if (searchDate) params.set("date", searchDate);

        const res = await fetch(
          `http://localhost:8080/events/search?${params.toString()}`,
          { credentials: "include" }
        );
        if (!res.ok) {
          setSearchResults([]);
          return;
        }
        const data = await res.json();
        const meEmail = localStorage.getItem("userEmail") || userEmail;
        const mapped = Array.isArray(data)
          ? data.map((ev) => {
              const me = (ev.attendees || []).find((a) => a.email === meEmail);
              return { ...ev, responseStatus: me ? me.status : undefined };
            })
          : [];
        setSearchResults(mapped);
      } catch (err) {
        console.error(err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(t);
  }, [searchQuery, searchDate, userEmail]); // <--- added searchDate

  const logout = async () => {
    await fetch("http://localhost:8080/logout", { credentials: "include" });
    localStorage.removeItem("userEmail");
    navigate("/login");
  };

  const handleEventInput = (e) => {
    setNewEvent({ ...newEvent, [e.target.name]: e.target.value });
  };

  const createEvent = async (e) => {
    e.preventDefault();
    setCreatingEvent(true);
    try {
      const res = await fetch("http://localhost:8080/events/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...newEvent, organizer: userEmail }),
      });

      if (!res.ok) {
        throw new Error("Failed to create event");
      }

      const created = await res.json();
      setOrganized((prev) => [...prev, { ...newEvent, id: created.eventId }]);
      setShowModal(false);
      setNewEvent({ title: "", date: "", time: "", location: "", description: "" });
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setCreatingEvent(false);
    }
  };

  const openInviteModal = (eventId) => {
    setInviteEventId(eventId);
    setInviteEmail("");
    setShowInviteModal(true);
  };

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    if (!inviteEmail || !inviteEventId) return;
    setInviting(true);
    try {
      const res = await fetch("http://localhost:8080/events/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ eventId: inviteEventId, email: inviteEmail }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to invite user");
      }

      setShowInviteModal(false);
      setShowInviteSuccess(true);

      await fetchLists();
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setInviting(false);
    }
  };

  const respondToEvent = async (eventId, status) => {
    if (!eventId) return;
    setProcessingResponseId(eventId);
    try {
      const sendStatus = status === "accepted" ? "accepted" : "declined";

      const res = await fetch("http://localhost:8080/events/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ eventId, status: sendStatus }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send response");
      }

      if (sendStatus === "accepted") {
        const moved = invited.find((e) => String(e.id) === String(eventId));
        if (moved) {
          setInvited((prev) => prev.filter((e) => String(e.id) !== String(eventId)));
          setAccepted((prev) => [{ ...moved, responseStatus: "accepted" }, ...prev]);
        }
      } else if (sendStatus === "declined") {
        setInvited((prev) => prev.filter((e) => String(e.id) !== String(eventId)));
        setSearchResults((prev) => prev.filter((e) => String(e.id) !== String(eventId)));
      }

      await fetchLists();

      setShowInviteSuccess(true);
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setProcessingResponseId(null);
    }
  };

  // Auto-hide success modal after a short delay but allow manual OK to dismiss.
  useEffect(() => {
    if (showInviteSuccess) {
      // clear any existing timer
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      // auto-hide after 2500ms
      successTimeoutRef.current = setTimeout(() => {
        setShowInviteSuccess(false);
        successTimeoutRef.current = null;
      }, 2500);
    } else {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = null;
      }
    }
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = null;
      }
    };
  }, [showInviteSuccess]);

  // Delete event (called from confirmation modal)
  const deleteEvent = async (eventId) => {
    if (!eventId) return;
    setProcessingDeleteId(eventId);
    try {
      const res = await fetch(`http://localhost:8080/events/${eventId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.status === 401) {
        alert("Not logged in");
        navigate("/login");
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete event");
      }

      setOrganized((prev) => prev.filter((e) => String(e.id) !== String(eventId)));
      setShowDeleteModal(false);
      setDeleteTarget(null);
      await fetchLists();
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setProcessingDeleteId(null);
    }
  };

  if (loading) return <div className="dashboard-loading">Loading...</div>;

  return (
    <div className="dashboard-container">
      <div className="search-wrapper">
        <div className="search-inner">
          <input
            className="search-input"
            type="search"
            placeholder="Search events by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery ? (
            <button className="search-clear" onClick={() => setSearchQuery("")} aria-label="Clear search">×</button>
          ) : null}
        </div>

        <div className="date-row">
          <div className="date-input">
            <input
              type="date"
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              className="date-field"
            />
            {searchDate ? (
              <button className="search-clear" onClick={() => setSearchDate("")} aria-label="Clear date">×</button>
            ) : null}
          </div>
          <div className="search-subtext">
            {searching ? "Searching..." : (searchQuery || searchDate) ? `${searchResults.length} results` : "Filter by date"}
          </div>
        </div>
      </div>

      <div className="dashboard-card">
        <div className="dashboard-header">
          <h1 className="dashboard-title">Welcome, {userEmail}</h1>
          <div className="dashboard-buttons">
            <button
              className="add-event-button"
              onClick={() => setShowModal(true)}
            >
              + Add Event
            </button>
            <button className="logout-button" onClick={logout}>
              Logout
            </button>
          </div>
        </div>

        {(searchQuery || searchDate) && (
          <div className="dashboard-section">
            <h2>Search Results</h2>
            {searchResults.length === 0 && !searching && <p className="empty-text">No events found.</p>}
            <div className="event-grid">
              {searchResults.map((event) => (
                <div className="event-card" key={event.id}>
                  <h3>{event.title}</h3>
                  <p><strong>Date:</strong> {event.date}</p>
                  <p><strong>Time:</strong> {event.time}</p>
                  <p><strong>Location:</strong> {event.location}</p>
                  <div className="event-actions">
                    <Link className="view-link" to={`/ViewEvent/${event.id}`}>View</Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="dashboard-section">
          <h2>Your Organized Events</h2>
          {organized.length === 0 && <p className="empty-text">You have no events yet.</p>}
          <div className="event-grid">
            {organized.map((event) => (
              <div className="event-card" key={event.id}>
                <h3>{event.title}</h3>
                <p><strong>Date:</strong> {event.date}</p>
                <p><strong>Time:</strong> {event.time}</p>
                <p><strong>Location:</strong> {event.location}</p>
                <div className="event-actions">
                  <Link className="view-link" to={`/ViewEvent/${event.id}`}>View</Link>
                  <button
                    className="invite-button"
                    onClick={() => openInviteModal(event.id)}
                  >
                    Invite
                  </button>
                  <button
                    className="cancel-button"
                    disabled={processingDeleteId === event.id}
                    onClick={() => { setDeleteTarget({ id: event.id, title: event.title }); setShowDeleteModal(true); }}
                  >
                    {processingDeleteId === event.id ? "Deleting..." : "Cancel"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-section">
          <h2>Accepted Events</h2>
          {accepted.length === 0 && <p className="empty-text">No accepted events.</p>}
          <div className="event-grid">
            {accepted.map((event) => (
              <div className="event-card" key={event.id}>
                <h3>{event.title}</h3>
                <p><strong>Date:</strong> {event.date}</p>
                <p><strong>Time:</strong> {event.time}</p>
                <p><strong>Location:</strong> {event.location}</p>
                <div className="event-actions">
                  <Link className="view-link" to={`/ViewEvent/${event.id}`}>View</Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-section">
          <h2>Events You're Invited To</h2>
          {invited.length === 0 && <p className="empty-text">No invitations.</p>}
          <div className="event-grid">
            {invited.map((event) => (
              <div className="event-card" key={event.id}>
                <h3>{event.title}</h3>
                <p><strong>Date:</strong> {event.date}</p>
                <p><strong>Time:</strong> {event.time}</p>
                <p><strong>Location:</strong> {event.location}</p>
                <div className="event-actions">
                  <button
                    className="accept-button"
                    disabled={processingResponseId === event.id}
                    onClick={() => respondToEvent(event.id, "accepted")}
                  >
                    {processingResponseId === event.id ? "..." : "Going"}
                  </button>
                  <button
                    className="cancel-button"
                    disabled={processingResponseId === event.id}
                    onClick={() => respondToEvent(event.id, "declined")}
                  >
                    {processingResponseId === event.id ? "..." : "Not Going"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h2>Create Event</h2>
            <form onSubmit={createEvent}>
              <input
                name="title"
                placeholder="Title"
                value={newEvent.title}
                onChange={handleEventInput}
                required
              />
              <input
                name="date"
                type="date"
                value={newEvent.date}
                onChange={handleEventInput}
                required
              />
              <input
                name="time"
                type="time"
                value={newEvent.time}
                onChange={handleEventInput}
                required
              />
              <input
                name="location"
                placeholder="Location"
                value={newEvent.location}
                onChange={handleEventInput}
                required
              />
              <textarea
                name="description"
                placeholder="Description"
                value={newEvent.description}
                onChange={handleEventInput}
                required
              />
              <div className="modal-actions">
                <button type="submit" disabled={creatingEvent}>
                  {creatingEvent ? "Creating..." : "Create"}
                </button>
                <button type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInviteModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h2>Invite to Event</h2>
            <form onSubmit={handleInviteSubmit}>
              <input
                name="inviteEmail"
                placeholder="Recipient email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                type="email"
              />
              <div className="modal-actions">
                <button type="submit" disabled={inviting}>
                  {inviting ? "Inviting..." : "Send Invite"}
                </button>
                <button type="button" onClick={() => setShowInviteModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && deleteTarget && (
        <div className="modal-backdrop">
          <div className="confirm-modal-card">
            <h3>Delete Event</h3>
            <p className="confirm-text">Are you sure you want to delete "<strong>{deleteTarget.title}</strong>"? This action cannot be undone.</p>
            <div className="confirm-actions">
              <button
                className="confirm-button"
                onClick={() => deleteEvent(deleteTarget.id)}
                disabled={processingDeleteId === deleteTarget.id}
              >
                {processingDeleteId === deleteTarget.id ? "Deleting..." : "Yes, delete"}
              </button>
              <button
                className="confirm-cancel"
                onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }}
                disabled={processingDeleteId === deleteTarget.id}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showInviteSuccess && (
        <div className="modal-backdrop">
          <div className="modal-card success-modal-card" role="dialog" aria-modal="true">
            <h2 className="success-text">Success</h2>
            <button
              className="success-ok-button"
              onClick={() => setShowInviteSuccess(false)}
              aria-label="Dismiss success"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
