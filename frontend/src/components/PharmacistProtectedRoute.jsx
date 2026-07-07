import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const PharmacistProtectedRoute = ({ children }) => {
  const navigate = useNavigate();

  useEffect(() => {

    const userData = localStorage.getItem('user');

    if (!userData) {

      alert('Please log in as a pharmacist to access this page.');
      navigate('/auth?type=pharmacist&view=login');
      return;
    }

    try {
      const user = JSON.parse(userData);

      if (user.user_type !== 'pharmacist') {

        alert('Access Denied: This page is only accessible to pharmacists.');


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