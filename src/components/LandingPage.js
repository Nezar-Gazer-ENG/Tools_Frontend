import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

function LandingPage() {
  return (
    <div className="landing-container">
      <div className="hero-section">
        <h1 className="landing-title">Welcome to Our Platform</h1>
        <p className="landing-subtitle">
          Please Sign up if you haven't already or Log into to continue.
        </p>
        <div className="button-group">
          <Link to="/signup" className="btn btn-primary">
            Get Started
          </Link>
          <Link to="/login" className="btn btn-secondary">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;