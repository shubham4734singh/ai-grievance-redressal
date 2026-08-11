import React from 'react';
import { Navigate } from 'react-router-dom';

const OFFICER_EMAIL = 'shubham.cybersky@gmail.com';

const ProtectedRoute = ({ children, officerOnly = false }) => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if ((officerOnly || window.location.pathname === '/admin' || window.location.pathname === '/analytics') && user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

export default ProtectedRoute;
