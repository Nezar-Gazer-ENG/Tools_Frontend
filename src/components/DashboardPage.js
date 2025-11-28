import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./DashboardPage.css";

function DashboardPage() {
  const navigate = useNavigate();
  const [organized, setOrganized] = useState([]);
  const [invited, setInvited] = useState([]);
  const [accepted, setAccepted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");

  // Modal state
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

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [processingResponseId, setProcessingResponseId] = useState(null);

  useEffect(() => {
    const email = localStorage.getItem("userEmail") || "User";
    setUserEmail(email);
  }, []);

  // fetch lists from server and derive responseStatus from attendees array
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

      // Build accepted id set from server's accepted endpoint (authoritative)
      const acceptedIds = new Set(
        Array.isArray(acceptedData) ? acceptedData.map((ev) => String(ev.id)) : []
      );

      // Map accepted list (server returns only accepted)
      const mappedAccepted = Array.isArray(acceptedData)
        ? acceptedData.map((ev) => ({ ...ev, responseStatus: "accepted" }))
        : [];

      // Map invited list and ensure it's strictly pending AND not already present in accepted
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
            // keep only pending invites and exclude any that are in acceptedIds
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
    if (!searchQuery || !searchQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `http://localhost:8080/events/search?q=${encodeURIComponent(searchQuery)}`,
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
  }, [searchQuery, userEmail]);

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
      setTimeout(() => setShowInviteSuccess(false), 1800);

      // refresh lists to show the pending invite
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
      // send canonical statuses: "accepted" or "declined"
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

      // Optimistic UI update:
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

      // authoritative refresh
      await fetchLists();

      setShowInviteSuccess(true);
      setTimeout(() => setShowInviteSuccess(false), 1400);
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setProcessingResponseId(null);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
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
            <button className="search-clear" onClick={clearSearch} aria-label="Clear search">×</button>
          ) : null}
        </div>
        <div className="search-subtext">
          {searching ? "Searching..." : searchQuery ? `${searchResults.length} results` : "Search events by title"}
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

        {searchQuery && (
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
                  <button className="cancel-button">Cancel</button>
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
                    {processingResponseId === event.id ? "..." : "Accept"}
                  </button>
                  <button
                    className="cancel-button"
                    disabled={processingResponseId === event.id}
                    onClick={() => respondToEvent(event.id, "declined")}
                  >
                    {processingResponseId === event.id ? "..." : "Decline"}
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

      {showInviteSuccess && (
        <div className="modal-backdrop">
          <div className="modal-card success-modal-card">
            <h2 className="success-text">Success</h2>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
