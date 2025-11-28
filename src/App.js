import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import DashboardPage from './components/DashboardPage';
import ViewEventPage from './components/ViewEventPage';
import ProtectedRoute from './Utilities/ProtectedRoute';

import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>

          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path='/ViewEvent/:eventId' element={
            <ProtectedRoute>
              <ViewEventPage />
            </ProtectedRoute>
          } />  

        </Routes>
      </div>
    </Router>
  );
}

export default App;
