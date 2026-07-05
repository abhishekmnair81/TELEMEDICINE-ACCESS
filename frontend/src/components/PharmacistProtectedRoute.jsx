import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const PharmacistProtectedRoute = ({ children }) => {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Check if user is logged in and is a pharmacist
    const userData = localStorage.getItem('user');
    
    if (!userData) {
      // No user logged in
      alert('Please log in as a pharmacist to access this page.');
      navigate('/auth?type=pharmacist&view=login');
      return;
    }
    
    try {
      const user = JSON.parse(userData);
      
      if (user.user_type !== 'pharmacist') {
        // User is logged in but not a pharmacist
        alert('Access Denied: This page is only accessible to pharmacists.');
        
        // Redirect based on user type
        if (user.user_type === 'patient') {
          navigate('/');
        } else if (user.user_type === 'doctor') {
          navigate('/doctor-dashboard');
        } else {
          navigate('/');
        }
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
      navigate('/auth?type=pharmacist&view=login');
    }
  }, [navigate]);
  
  return children;
};

export default PharmacistProtectedRoute;