// services/api.js - COMPLETE FIXED VERSION WITH MULTIPLE IMAGES SUPPORT

export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Helper function to get auth token
const getAuthToken = () => {
  return localStorage.getItem('accessToken');
};

// Helper function to get refresh token
const getRefreshToken = () => {
  return localStorage.getItem('refreshToken');
};

// Helper function to get current user type
const getCurrentUserType = () => {
  const userStr = localStorage.getItem('user');
  if (!userStr) return 'patient';
  try {
    const user = JSON.parse(userStr);
    return user.user_type || 'patient';
  } catch {
    return 'patient';
  }
};

// Helper function to refresh access token
const refreshAccessToken = async () => {
  const refreshToken = getRefreshToken();
  
  if (!refreshToken) {
    console.log('No refresh token available');
    throw new Error('No refresh token available');
  }

  try {
    console.log('Attempting to refresh token...');
    const response = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    
    if (data.access) {
      console.log('Token refreshed successfully');
      localStorage.setItem('accessToken', data.access);
      return data.access;
    }
    
    throw new Error('No access token in refresh response');
  } catch (error) {
    console.error('Token refresh error:', error);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    throw error;
  }
};

// Helper function to make API requests with automatic token refresh
const apiRequest = async (endpoint, options = {}, retryCount = 0) => {
  const token = getAuthToken();
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const responseText = await response.text();
    
    if (response.status === 401 && retryCount === 0) {
      console.log('Received 401, checking if token refresh is possible...');
      
      let isTokenExpired = false;
      try {
        const errorData = JSON.parse(responseText);
        isTokenExpired = errorData.code === 'token_not_valid' || 
                        errorData.detail?.includes('token') ||
                        errorData.detail?.includes('expired');
      } catch (e) {
        isTokenExpired = true;
      }
      
      if (isTokenExpired && getRefreshToken()) {
        try {
          const newToken = await refreshAccessToken();
          console.log('Retrying request with refreshed token...');
          return await apiRequest(endpoint, options, retryCount + 1);
        } catch (refreshError) {
          console.error('Token refresh failed, redirecting to login');
          const userType = getCurrentUserType();
          setTimeout(() => {
            window.location.href = `/auth?type=${userType}&view=login&expired=true`;
          }, 100);
          throw new Error('Session expired. Please login again.');
        }
      } else {
        console.log('No refresh token available, redirecting to login');
        const userType = getCurrentUserType();
        setTimeout(() => {
          window.location.href = `/auth?type=${userType}&view=login&expired=true`;
        }, 100);
        throw new Error('Session expired. Please login again.');
      }
    }
    
    if (!response.ok) {
      console.error(`API Error (${response.status}):`, responseText);
      
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.error || errorData.message || errorData.detail || JSON.stringify(errorData);
      } catch (e) {
        if (responseText.includes('<!DOCTYPE')) {
          errorMessage = `Server error (${response.status}). Check Django console for details.`;
        } else {
          errorMessage = responseText || errorMessage;
        }
      }
      
      throw new Error(errorMessage);
    }
    
    try {
      return JSON.parse(responseText);
    } catch (e) {
      if (!responseText.startsWith('data:')) {
        console.error('Response is not valid JSON:', responseText);
      }
      return responseText;
    }
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Auth API
export const authAPI = {
  register: async (userData) => {
    return apiRequest('/auth/register/', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  login: async (credentials) => {
    const response = await apiRequest('/auth/login/', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    
    if (response.access || response.accessToken) {
      const accessToken = response.access || response.accessToken;
      const refreshToken = response.refresh || response.refreshToken;
      
      localStorage.setItem('accessToken', accessToken);
      
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }
      
      if (response.user) {
        localStorage.setItem('user', JSON.stringify(response.user));
      }
    }
    
    return response;
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  verifyToken: async () => {
    return apiRequest('/auth/verify/');
  },

  refreshToken: async () => {
    return refreshAccessToken();
  },
};

// Video Consultation API
export const videoConsultationAPI = {
  createRoom: async (roomData) => {
    return apiRequest('/video-consultations/create-room/', {
      method: 'POST',
      body: JSON.stringify(roomData),
    });
  },

  getRoomDetails: async (roomId) => {
    return apiRequest(`/video-consultations/room-details/?room_id=${roomId}`);
  },

  getAllRooms: async (doctorId) => {
    console.log('[videoConsultationAPI] Fetching rooms for doctor:', doctorId);
    try {
      const response = await apiRequest(`/video-consultations/doctor/${doctorId}/rooms/`);
      console.log('[videoConsultationAPI] Raw response:', response);
      
      if (Array.isArray(response)) {
        return response;
      } else if (response && Array.isArray(response.rooms)) {
        return response.rooms;
      } else if (response && response.success && Array.isArray(response.rooms)) {
        return response.rooms;
      } else if (response && Array.isArray(response.results)) {
        return response.results;
      } else {
        console.warn('[videoConsultationAPI] Unexpected response format:', typeof response);
        return [];
      }
    } catch (error) {
      console.error('[videoConsultationAPI] Error fetching rooms:', error);
      return [];
    }
  },

  getPatientRooms: async (patientId) => {
    console.log('[videoConsultationAPI] Fetching rooms for patient:', patientId);
    try {
      const response = await apiRequest(`/video-consultations/patient/${patientId}/rooms/`);
      
      if (Array.isArray(response)) {
        return response;
      } else if (response && Array.isArray(response.rooms)) {
        return response.rooms;
      } else if (response && response.success && Array.isArray(response.rooms)) {
        return response.rooms;
      } else if (response && Array.isArray(response.results)) {
        return response.results;
      } else {
        return [];
      }
    } catch (error) {
      console.error('[videoConsultationAPI] Error fetching rooms:', error);
      return [];
    }
  },

  joinRoom: async (roomData) => {
    return apiRequest(`/video-consultations/join-room/`, {
      method: 'POST',
      body: JSON.stringify(roomData),
    });
  },

  leaveRoom: async (roomData) => {
    return apiRequest(`/video-consultations/leave-room/`, {
      method: 'POST',
      body: JSON.stringify(roomData),
    });
  },

  endConsultation: async (endData) => {
    return apiRequest(`/video-consultations/end-call/`, {
      method: 'POST',
      body: JSON.stringify(endData),
    });
  },
};

// Appointments API
export const appointmentsAPI = {
  createAppointment: async (appointmentData) => {
    console.log('API: Creating appointment with data:', appointmentData);
    return apiRequest('/appointments/', {
      method: 'POST',
      body: JSON.stringify(appointmentData),
    });
  },

  getAll: async () => {
    return apiRequest('/appointments/');
  },

  getPatientAppointments: async (patientId) => {
    return apiRequest(`/appointments/?patient=${patientId}`);
  },

  getDoctorAppointments: async (doctorId) => {
    console.log('[appointmentsAPI] Fetching appointments for doctor ID:', doctorId);
    
    try {
      const response = await apiRequest(`/appointments/?doctor__user=${doctorId}`);
      return response;
    } catch (error1) {
      try {
        const response = await apiRequest(`/appointments/?doctor=${doctorId}`);
        return response;
      } catch (error2) {
        try {
          const allAppointments = await apiRequest('/appointments/');
          const filtered = Array.isArray(allAppointments) 
            ? allAppointments.filter(apt => 
                apt.doctor === doctorId || 
                apt.doctor === parseInt(doctorId) ||
                (apt.doctor_details && apt.doctor_details.id === doctorId)
              )
            : [];
          return filtered;
        } catch (error3) {
          console.error('[appointmentsAPI] All methods failed:', error3.message);
          return [];
        }
      }
    }
  },

  updateAppointmentStatus: async (appointmentId, status) => {
    return apiRequest(`/appointments/${appointmentId}/update_status/`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  cancelAppointment: async (appointmentId) => {
    return apiRequest(`/appointments/${appointmentId}/update_status/`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'cancelled' }),
    });
  },
};

// Prescriptions API
export const prescriptionsAPI = {
  createPrescription: async (prescriptionData) => {
    console.log('[prescriptionsAPI] Creating prescription:', prescriptionData);
    return apiRequest('/prescriptions/', {
      method: 'POST',
      body: JSON.stringify(prescriptionData),
    });
  },

  getPatientPrescriptions: async (patientId) => {
    return apiRequest(`/prescriptions/?patient=${patientId}`);
  },

  getDoctorPrescriptions: async (doctorId) => {
    return apiRequest(`/prescriptions/?doctor=${doctorId}`);
  },

  getPrescriptionDetails: async (prescriptionId) => {
    return apiRequest(`/prescriptions/${prescriptionId}/`);
  },

  updatePrescription: async (prescriptionId, prescriptionData) => {
    return apiRequest(`/prescriptions/${prescriptionId}/`, {
      method: 'PUT',
      body: JSON.stringify(prescriptionData),
    });
  },
};

// Patients API
export const patientsAPI = {
  getPatientDetails: async (patientId) => {
    return apiRequest(`/patients/${patientId}/`);
  },

  getAllPatients: async () => {
    return apiRequest('/patients/');
  },

  updatePatientProfile: async (patientId, profileData) => {
    return apiRequest(`/patients/${patientId}/`, {
      method: 'PATCH',
      body: JSON.stringify(profileData),
    });
  },

  uploadProfilePicture: async (patientId, file) => {
    const formData = new FormData();
    formData.append('profile_picture', file);
    
    const token = getAuthToken();
    
    const response = await fetch(`${API_BASE_URL}/patients/${patientId}/upload_profile_picture/`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload profile picture');
    }
    
    return response.json();
  },

  getPatientHistory: async (patientId) => {
    return apiRequest(`/patients/${patientId}/health-summary/`);
  },
};

// Doctors API
export const doctorsAPI = {
  getAllDoctors: () => apiRequest('/doctors/'),
  getDoctorById: (doctorId) => apiRequest(`/doctors/${doctorId}/`),
  getDoctorRatings: (doctorId) => apiRequest(`/doctors/${doctorId}/rating-summary/`),
  getDoctorAppointments: (doctorId) => apiRequest(`/appointments/doctor/${doctorId}/`),
  getAvailableDoctors: async (specialty) => {
    const endpoint = specialty 
      ? `/doctors/?specialization=${specialty}&available=true`
      : '/doctors/?available=true';
    return apiRequest(endpoint);
  },

  updateDoctorProfile: async (doctorId, profileData) => {
    return apiRequest(`/doctors/${doctorId}/`, {
      method: 'PATCH',
      body: JSON.stringify(profileData),
    });
  },

  uploadProfilePicture: async (doctorId, file) => {
    const formData = new FormData();
    formData.append('profile_picture', file);
    
    const token = getAuthToken();
    
    const response = await fetch(`${API_BASE_URL}/doctors/${doctorId}/upload_profile_picture/`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload profile picture');
    }
    
    return response.json();
  },

  setAvailability: async (doctorId, availabilityData) => {
    return apiRequest(`/doctors/${doctorId}/`, {
      method: 'PATCH',
      body: JSON.stringify(availabilityData),
    });
  },
};

// Health Records API
export const healthRecordsAPI = {
  createRecord: async (recordData) => {
    return apiRequest('/health-records/', {
      method: 'POST',
      body: JSON.stringify(recordData),
    });
  },

  getPatientRecords: async (patientId) => {
    return apiRequest(`/health-records/?patient=${patientId}`);
  },

  getRecordById: async (recordId) => {
    return apiRequest(`/health-records/${recordId}/`);
  },

  updateRecord: async (recordId, recordData) => {
    return apiRequest(`/health-records/${recordId}/`, {
      method: 'PUT',
      body: JSON.stringify(recordData),
    });
  },

  deleteRecord: async (recordId) => {
    return apiRequest(`/health-records/${recordId}/`, {
      method: 'DELETE',
    });
  },

  getHealthMetrics: async (patientId, metricType, startDate, endDate) => {
    const params = new URLSearchParams();
    if (metricType) params.append('metric_type', metricType);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    return apiRequest(`/health-records/?patient=${patientId}&${params.toString()}`);
  },

  addVitalSigns: async (patientId, vitalData) => {
    return apiRequest(`/health-records/`, {
      method: 'POST',
      body: JSON.stringify(vitalData),
    });
  },

  getLatestVitals: async (patientId) => {
    return apiRequest(`/health-records/?patient=${patientId}&limit=1`);
  },
};

// Health Tracking API
export const healthTrackingAPI = {
  createMetric: async (metricData) => {
    return apiRequest('/health-metrics/', {
      method: 'POST',
      body: JSON.stringify(metricData),
    });
  },

  getMetrics: async (patientId, filters = {}) => {
    const params = new URLSearchParams({ patient: patientId, ...filters });
    return apiRequest(`/health-metrics/?${params.toString()}`);
  },

  getLatestMetrics: async (patientId) => {
    return apiRequest(`/health-metrics/latest/?patient=${patientId}`);
  },

  getMetricTrends: async (patientId, metricType, period = 30) => {
    return apiRequest(
      `/health-metrics/trends/?patient=${patientId}&metric_type=${metricType}&period=${period}`
    );
  },

  deleteMetric: async (metricId) => {
    return apiRequest(`/health-metrics/${metricId}/`, { method: 'DELETE' });
  },

  createGoal: async (goalData) => {
    return apiRequest('/health-goals/', {
      method: 'POST',
      body: JSON.stringify(goalData),
    });
  },

  getGoals: async (patientId, status = null) => {
    const params = status
      ? `patient=${patientId}&status=${status}`
      : `patient=${patientId}`;
    return apiRequest(`/health-goals/?${params}`);
  },

  updateGoalProgress: async (goalId, currentValue) => {
    return apiRequest(`/health-goals/${goalId}/update_progress/`, {
      method: 'POST',
      body: JSON.stringify({ current_value: currentValue }),
    });
  },

  deleteGoal: async (goalId) => {
    return apiRequest(`/health-goals/${goalId}/`, { method: 'DELETE' });
  },

  createActivity: async (activityData) => {
    return apiRequest('/health-activities/', {
      method: 'POST',
      body: JSON.stringify(activityData),
    });
  },

  getActivities: async (patientId, filters = {}) => {
    const params = new URLSearchParams({ patient: patientId, ...filters });
    return apiRequest(`/health-activities/?${params.toString()}`);
  },

  deleteActivity: async (activityId) => {
    return apiRequest(`/health-activities/${activityId}/`, { method: 'DELETE' });
  },

  createReminder: async (reminderData) => {
    return apiRequest('/medication-reminders/', {
      method: 'POST',
      body: JSON.stringify(reminderData),
    });
  },

  getReminders: async (patientId, activeOnly = false) => {
    if (!patientId) {
      console.warn('[healthTrackingAPI] getReminders called without patientId');
      return [];
    }
    const params = activeOnly
      ? `patient=${patientId}&is_active=true`
      : `patient=${patientId}`;
    return apiRequest(`/medication-reminders/?${params}`);
  },

  // ✅ FIXED: correct endpoint for log_intake
  logMedicationIntake: async (reminderId, data = {}) => {
    if (!reminderId) {
      throw new Error('reminderId is required for logMedicationIntake');
    }
    return apiRequest(`/medication-reminders/${reminderId}/log_intake/`, { 
      method: 'POST',
      body: JSON.stringify({
        status: data.status || 'taken',
        taken_at: data.taken_at || new Date().toISOString(),
        scheduled_time: data.scheduled_time || new Date().toISOString(),
        notes: data.notes || '',
      }),
    });
  },

  deleteReminder: async (reminderId) => {
    return apiRequest(`/medication-reminders/${reminderId}/`, { method: 'DELETE' });
  },

  // ── Sync endpoints (PWA offline support) ─────────────────────────────────

  syncMedicationLogs: async (logData) => {
    return apiRequest('/medication-reminders/sync-logs/', {
      method: 'POST',
      body: JSON.stringify(logData),
    });
  },

  syncMissedReminders: async (missedList) => {
    return apiRequest('/medication-reminders/sync-missed/', {
      method: 'POST',
      body: JSON.stringify({ missed: missedList }),
    });
  },

  getAdherencePrediction: async (patientId, reminders) => {
    return apiRequest('/medication-reminders/adherence-prediction/', {
      method: 'POST',
      body: JSON.stringify({ patient_id: patientId, reminders }),
    });
  },

  getReminderStats: async () => {
    return apiRequest('/medication-reminders/stats/');
  },

  generateReport: async (reportData) => {
    return apiRequest('/health-reports/generate/', {
      method: 'POST',
      body: JSON.stringify(reportData),
    });
  },

  getReports: async (patientId) => {
    return apiRequest(`/health-reports/?patient=${patientId}`);
  },

  getDashboard: async (patientId) => {
    return apiRequest(`/health/dashboard/?patient=${patientId}`);
  },

  getSummary: async (patientId, periodDays = 30) => {
    return apiRequest(`/health/summary/?patient=${patientId}&period=${periodDays}`);
  },
};


// Medicine/Medication API
export const medicineAPI = {
  getAllMedicines: async () => {
    return apiRequest('/medicines/');
  },

  searchMedicines: async (searchTerm) => {
    return apiRequest(`/medicines/?search=${encodeURIComponent(searchTerm)}`);
  },

  getMedicinesByCategory: async (category) => {
    return apiRequest(`/medicines/?category=${category}`);
  },

  getPatientMedications: async (patientId) => {
    return apiRequest(`/prescriptions/?patient=${patientId}`);
  },

  addMedication: async (medicationData) => {
    return apiRequest('/medicines/', {
      method: 'POST',
      body: JSON.stringify(medicationData),
    });
  },

  updateMedication: async (medicationId, medicationData) => {
    return apiRequest(`/medicines/${medicationId}/`, {
      method: 'PUT',
      body: JSON.stringify(medicationData),
    });
  },

  deleteMedication: async (medicationId) => {
    return apiRequest(`/medicines/${medicationId}/`, {
      method: 'DELETE',
    });
  },
};

// Chat/AI Assistant API
export const chatAPI = {
  sendMessage: async (message, userId = 'anonymous', language = 'English', options = {}) => {
    console.log('[chatAPI] Sending text message:', { message, userId, language });
    
    try {
      const response = await fetch(`${API_BASE_URL}/chat/stream/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          msg: message,
          user_id: userId,
          language: language,
        }),
        signal: options.signal,
      });

      if (!response.ok) {
        throw new Error(`Chat request failed with status ${response.status}`);
      }

      console.log('[chatAPI] ✅ Received streaming response');
      return response;
      
    } catch (error) {
      console.error('[chatAPI] Error:', error);
      throw error;
    }
  },

  sendMessageWithImage: async (
  message, 
  imageFile, 
  userId = 'anonymous', 
  language = 'English', 
  options = {},
  onProgress = null
) => {
  console.log('[chatAPI] Sending message with image:', { 
    message, 
    imageFile: imageFile.name, 
    userId, 
    language 
  });
  
  try {
    const formData = new FormData();
    formData.append('msg', message);
    formData.append('user_id', userId);
    formData.append('language', language);
    formData.append('image', imageFile);
    formData.append('elaborate', 'false');

    if (onProgress) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        // Upload progress
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            onProgress(percentComplete);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            console.log('[chatAPI] ✅ Image uploaded successfully');
            onProgress(100);
            
            // Return response as a readable stream-like object
            const response = {
              ok: true,
              body: {
                getReader: () => ({
                  read: async () => {
                    return { done: true, value: null };
                  }
                })
              },
              text: async () => xhr.responseText
            };
            
            resolve(response);
          } else {
            console.error('[chatAPI] Upload failed:', xhr.status, xhr.responseText);
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          console.error('[chatAPI] Network error');
          reject(new Error('Network error during upload'));
        });

        if (options.signal) {
          options.signal.addEventListener('abort', () => {
            xhr.abort();
            reject(new Error('Upload aborted'));
          });
        }

        xhr.open('POST', `${API_BASE_URL}/chat/image/`);
        xhr.send(formData);
      });
    } else {
      // Simple fetch without progress
      const response = await fetch(`${API_BASE_URL}/chat/image/`, {
        method: 'POST',
        body: formData,
        signal: options.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[chatAPI] Error response:', errorText);
        throw new Error(`Chat with image failed: ${response.status}`);
      }

      console.log('[chatAPI] ✅ Received streaming response');
      return response;
    }
    
  } catch (error) {
    console.error('[chatAPI] Error sending image:', error);
    throw error;
  }
},

  getConversationHistory: async (userId) => {
    return apiRequest(`/chat-history/?user_id=${userId}`);
  },
};

// ============================================================================
// PHARMACY API - COMPLETE WITH MULTIPLE IMAGES SUPPORT
// ============================================================================
export const pharmacyAPI = {
  getAllMedicines: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    console.log('[pharmacyAPI] Fetching medicines...');
    const response = await apiRequest(`/medicines/?${params.toString()}`);
    console.log('[pharmacyAPI] Response:', response);
    console.log('[pharmacyAPI] First product:', response[0]);
    return response;
  },

  getMedicinesOnly: async () => {
  const medicineCategories = [
    'medicines', 'prescription_drugs', 'otc_medicines',
    'antibiotics', 'painkillers', 'vitamins', 'ayurvedic', 'homeopathy'
  ];
  const response = await apiRequest('/medicines/');
  return response.filter(p => medicineCategories.includes(p.category?.toLowerCase()));
},

getOtherProductsOnly: async () => {
  const medicineCategories = [
    'medicines', 'prescription_drugs', 'otc_medicines',
    'antibiotics', 'painkillers', 'vitamins', 'ayurvedic', 'homeopathy'
  ];
  const response = await apiRequest('/medicines/');
  return response.filter(p => !medicineCategories.includes(p.category?.toLowerCase()));
},

  scanPrescription: async (formData, onProgress = null) => {
    try {
      const token = getAuthToken();
      
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        if (onProgress) {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const percentComplete = Math.round((e.loaded / e.total) * 100);
              onProgress(percentComplete);
            }
          });
        }
        
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (e) {
              reject(new Error('Invalid JSON response'));
            }
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              reject(new Error(error.error || `Request failed with status ${xhr.status}`));
            } catch (e) {
              reject(new Error(`Request failed: ${xhr.status} ${xhr.responseText}`));
            }
          }
        });
        
        xhr.addEventListener('error', () => {
          reject(new Error('Network error'));
        });
        
        xhr.open('POST', `${API_BASE_URL}/prescriptions/scan/`);
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        xhr.send(formData);
      });
    } catch (error) {
      console.error('[pharmacyAPI] scanPrescription error:', error);
      throw error;
    }
  },

  
  getMedicineById: async (id) => {
    console.log('[pharmacyAPI] Fetching medicine by ID:', id);
    return apiRequest(`/medicines/${id}/`);
  },

  searchMedicines: async (query) => {
    console.log('[pharmacyAPI] Searching medicines:', query);
    return apiRequest(`/medicines/?search=${encodeURIComponent(query)}`);
  },

  getMedicineDetails: async (medicineId) => {
    return apiRequest(`/medicines/${medicineId}/`);
  },

  createMedicine: async (medicineData) => {
    console.log('[pharmacyAPI] Creating medicine:', medicineData);
    return apiRequest('/medicines/', {
      method: 'POST',
      body: JSON.stringify(medicineData),
    });
  },

  updateMedicine: async (medicineId, medicineData) => {
    return apiRequest(`/medicines/${medicineId}/`, {
      method: 'PATCH',
      body: JSON.stringify(medicineData),
    });
  },

  deleteMedicine: async (medicineId) => {
    return apiRequest(`/medicines/${medicineId}/`, {
      method: 'DELETE',
    });
  },

  updateStock: async (medicineId, stockData) => {
    return apiRequest(`/medicines/${medicineId}/update_stock/`, {
      method: 'PATCH',
      body: JSON.stringify(stockData),
    });
  },

  getCategories: async () => {
    return apiRequest('/medicines/categories/');
  },

  getLowStockMedicines: async (threshold = 10) => {
    return apiRequest(`/medicines/low_stock/?threshold=${threshold}`);
  },

  getMedicinesByCategory: async (category) => {
    return apiRequest(`/medicines/?category=${category}`);
  },


  createOrderFromCart: async (orderData) => {
    console.log('[pharmacyAPI] Creating order from cart:', orderData);
    return apiRequest('/orders/create-from-cart/', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  },

  getMyOrders: async (sessionId = null, phone = null) => {
    const params = new URLSearchParams();
    if (sessionId) params.append('session_id', sessionId);
    if (phone) params.append('phone', phone);
    
    return apiRequest(`/orders/my-orders/?${params.toString()}`);
  },

  getOrderDetails: async (orderId) => {
    return apiRequest(`/medicine-orders/${orderId}/`);
},

  cancelOrder: async (orderId) => {
  return apiRequest(`/medicine-orders/${orderId}/update_status/`, {
    method: 'PATCH',
    body: JSON.stringify({ order_status: 'cancelled' }),
  });
},


  uploadMedicineImages: async (medicineId, imageFiles, onProgress = null) => {
    try {
      const formData = new FormData();
      
      // Append multiple images
      Array.from(imageFiles).forEach((file) => {
        formData.append('images', file);
      });
      
      const token = getAuthToken(); // ✅ FIXED: Use getAuthToken()
      
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        if (onProgress) {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const percentComplete = Math.round((e.loaded / e.total) * 100);
              onProgress(percentComplete);
            }
          });
        }
        
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (e) {
              reject(new Error('Invalid JSON response'));
            }
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              reject(new Error(error.error || `Request failed with status ${xhr.status}`));
            } catch (e) {
              reject(new Error(`Request failed with status ${xhr.status}`));
            }
          }
        });
        
        xhr.addEventListener('error', () => {
          reject(new Error('Network error occurred'));
        });
        
        xhr.open('POST', `${API_BASE_URL}/medicines/${medicineId}/add_images/`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`); // ✅ FIXED
        xhr.send(formData);
      });
    } catch (error) {
      console.error('[pharmacyAPI] uploadMedicineImages error:', error);
      throw error;
    }
  },


  createMedicineWithImages: async (medicineData, imageFiles, onProgress = null) => {
    try {
      const formData = new FormData();
      
      console.log('[DEBUG] Original medicineData:', medicineData);
      
      // ✅ Map frontend categories to backend categories
      const categoryMapping = {
        // Medical Devices → map to 'other'
        'thermometers': 'thermometers',
        'bp_monitors': 'bp_monitors',
        'glucometers': 'glucometers',
        'pulse_oximeters': 'pulse_oximeters',
        'nebulizers': 'nebulizers',
        
        // First Aid & Surgical
        'bandages': 'bandages',
        'antiseptics': 'antiseptics',
        'first_aid_kits': 'first_aid_kits',
        'syringes': 'syringes',
        'gloves': 'gloves',
        
        // Baby Care
        'diapers': 'diapers',
        'baby_food': 'baby_food',
        'baby_wipes': 'baby_wipes',
        
        // Personal Care
        'sanitizers': 'sanitizers',
        'masks': 'masks',
        'cotton': 'cotton',
        
        // Diabetic - ✅ FIXED
        'diabetic_supplies': 'diabetic_supplies',
        'insulin': 'diabetic_supplies',  // ✅ Map insulin to diabetic_supplies
      };
      
      // ✅ Get backend category
      let backendCategory = medicineData.category || 'other';
      
      // Map category if needed
      if (categoryMapping[backendCategory]) {
        console.log(`[DEBUG] Mapping category ${backendCategory} → ${categoryMapping[backendCategory]}`);
        backendCategory = categoryMapping[backendCategory];
      }
      
      // Parse price and MRP
      let price = parseFloat(medicineData.price || 0);
      let mrp = parseFloat(medicineData.mrp || medicineData.price || 0);
      
      if (isNaN(price)) price = 0;
      if (isNaN(mrp)) mrp = price;
      if (mrp < price) mrp = price;
      
      // Parse stock
      let stock = parseInt(medicineData.stock_quantity || 0);
      if (isNaN(stock)) stock = 0;
      
      // ✅ CRITICAL FIX: Make form optional for non-medicines
      const medicineCategories = [
        'medicines', 'prescription_drugs', 'otc_medicines',
        'antibiotics', 'painkillers', 'vitamins', 'ayurvedic', 'homeopathy'
      ];
      const isMedicine = medicineCategories.includes(backendCategory.toLowerCase());
      
      const cleanedData = {
        name: medicineData.name || 'Unnamed Product',
        category: backendCategory, 
        form: isMedicine ? (medicineData.form || 'tablet') : (medicineData.form || ''),  // ✅ Empty for non-medicines
        price: price.toFixed(2),
        mrp: mrp.toFixed(2),
        stock_quantity: stock.toString(),
        generic_name: medicineData.generic_name || '',
        manufacturer: medicineData.manufacturer || '',
        brand: medicineData.brand || '',
        strength: medicineData.strength || '',
        description: medicineData.description || '',
        pack_size: medicineData.pack_size || '',
        storage_instructions: medicineData.storage_instructions || 'room_temp',
        batch_number: medicineData.batch_number || '',
        expiry_date: medicineData.expiry_date || '',
        requires_prescription: medicineData.requires_prescription ? 'true' : 'false',
      };
      
      console.log('[DEBUG] Cleaned data:', cleanedData);
      
      // Append all fields to FormData
      Object.keys(cleanedData).forEach(key => {
        formData.append(key, cleanedData[key]);
      });
      
      // Append image_urls if provided
      if (medicineData.image_urls) {
        formData.append('image_urls', JSON.stringify(medicineData.image_urls));
      }
      
      // Append images
      if (imageFiles && imageFiles.length > 0) {
        Array.from(imageFiles).forEach((file, index) => {
          formData.append('images', file);
          console.log(`[DEBUG] Appended image ${index + 1}:`, file.name);
        });
      }
      
      const token = getAuthToken();
      
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        if (onProgress) {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const percentComplete = Math.round((e.loaded / e.total) * 100);
              onProgress(percentComplete);
            }
          });
        }
        
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              console.log('[DEBUG] Success response:', response);
              resolve(response);
            } catch (e) {
              console.error('[DEBUG] JSON parse error:', e);
              reject(new Error('Invalid JSON response'));
            }
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              console.error('[DEBUG] Error response:', error);
              reject(new Error(JSON.stringify(error)));
            } catch (e) {
              reject(new Error(`Request failed: ${xhr.status} ${xhr.responseText}`));
            }
          }
        });
        
        xhr.addEventListener('error', () => {
          reject(new Error('Network error'));
        });
        
        xhr.open('POST', `${API_BASE_URL}/medicines/upload_images/`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });
    } catch (error) {
      console.error('[pharmacyAPI] createMedicineWithImages error:', error);
      throw error;
    }
  },


  updateMedicineWithImages: async (medicineId, medicineData, imageFiles, onProgress = null) => {
    try {
      const formData = new FormData();
      
      // Append medicine data
      Object.keys(medicineData).forEach(key => {
        if (medicineData[key] !== null && medicineData[key] !== undefined && medicineData[key] !== '') {
          if (key === 'image_urls') {
            formData.append('image_urls', JSON.stringify(medicineData.image_urls));
          } else {
            formData.append(key, medicineData[key]);
          }
        }
      });
      
      // Append multiple images if provided
      if (imageFiles && imageFiles.length > 0) {
        Array.from(imageFiles).forEach((file) => {
          formData.append('images', file);
        });
      }
      
      const token = getAuthToken(); // ✅ FIXED: Use getAuthToken()
      
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        if (onProgress) {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const percentComplete = Math.round((e.loaded / e.total) * 100);
              onProgress(percentComplete);
            }
          });
        }
        
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (e) {
              reject(new Error('Invalid JSON response'));
            }
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              reject(new Error(error.error || `Request failed with status ${xhr.status}`));
            } catch (e) {
              reject(new Error(`Request failed with status ${xhr.status}`));
            }
          }
        });
        
        xhr.addEventListener('error', () => {
          reject(new Error('Network error occurred'));
        });
        
        xhr.open('PUT', `${API_BASE_URL}/medicines/${medicineId}/update_images/`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`); // ✅ FIXED
        xhr.send(formData);
      });
    } catch (error) {
      console.error('[pharmacyAPI] updateMedicineWithImages error:', error);
      throw error;
    }
  },

  /**
   * ✅ Delete specific image
   */
  deleteMedicineImage: async (medicineId, imageId) => {
    try {
      const token = getAuthToken(); // ✅ FIXED: Use getAuthToken()
      const response = await fetch(
        `${API_BASE_URL}/medicines/${medicineId}/delete_image/${imageId}/`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete image');
      }
      
      return await response.json();
    } catch (error) {
      console.error('[pharmacyAPI] deleteMedicineImage error:', error);
      throw error;
    }
  },

  /**
   * ✅ Set primary image
   */
  setPrimaryImage: async (medicineId, imageId) => {
    try {
      const token = getAuthToken(); // ✅ FIXED: Use getAuthToken()
      const response = await fetch(
        `${API_BASE_URL}/medicines/${medicineId}/set_primary_image/`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image_id: imageId }),
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to set primary image');
      }
      
      return await response.json();
    } catch (error) {
      console.error('[pharmacyAPI] setPrimaryImage error:', error);
      throw error;
    }
  },

  // ============================================================================
  // ORDER MANAGEMENT
  // ============================================================================
  
  getAllOrders: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    return apiRequest(`/medicine-orders/?${params.toString()}`);
  },

  getOrderDetails: async (orderId) => {
    return apiRequest(`/medicine-orders/${orderId}/`);
  },

  placeOrder: async (orderData) => {
    return apiRequest('/medicine-orders/', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  },

  updateOrderStatus: async (orderId, status) => {
  return apiRequest(`/medicine-orders/${orderId}/update_status/`, {
    method: 'PATCH',
    body: JSON.stringify({ order_status: status }),
  });
},

  updatePaymentStatus: async (orderId, paymentStatus, paymentId = '') => {
    return apiRequest(`/medicine-orders/${orderId}/update_payment_status/`, {
      method: 'PATCH',
      body: JSON.stringify({ 
        payment_status: paymentStatus,
        payment_id: paymentId 
      }),
    });
  },

  getOrderStatistics: async (days = 30) => {
    return apiRequest(`/medicine-orders/statistics/?days=${days}`);
  },

  getOrderHistory: async (userId) => {
    return apiRequest(`/medicine-orders/?patient=${userId}`);
  },

  // ============================================================================
  // DASHBOARD & ANALYTICS
  // ============================================================================
  
  getDashboard: async (pharmacistId) => {
    return apiRequest(`/pharmacy/dashboard/?pharmacist_id=${pharmacistId}`);
  },

  getAnalytics: async (days = 30) => {
    return apiRequest(`/pharmacy/analytics/?days=${days}`);
  },

  // ============================================================================
  // PRESCRIPTIONS
  // ============================================================================
  
  getPharmacistPrescriptions: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    return apiRequest(`/pharmacy/prescriptions/?${params.toString()}`);
  },

  fulfillPrescription: async (fulfillmentData) => {
    return apiRequest('/pharmacy/fulfill-prescription/', {
      method: 'POST',
      body: JSON.stringify(fulfillmentData),
    });
  },

  // ============================================================================
  // UTILITIES
  // ============================================================================
  
  bulkUpdateStock: async (updates) => {
    const promises = updates.map(update => 
      apiRequest(`/medicines/${update.medicine_id}/update_stock/`, {
        method: 'PATCH',
        body: JSON.stringify({
          action: update.action,
          quantity: update.quantity
        }),
      })
    );
    return Promise.all(promises);
  },

  getInventoryReport: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    return apiRequest(`/pharmacy/inventory-report/?${params.toString()}`);
  },
};


export const cartAPI = {

  getSessionId: () => {
    let sessionId = localStorage.getItem('cart_session_id');
    if (!sessionId) {
      sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('cart_session_id', sessionId);
    }
    return sessionId;
  },


  getCurrentUser: () => {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  },


  addToCart: async (medicineId, quantity = 1) => {
    try {
      const user = cartAPI.getCurrentUser();
      
      const requestBody = {
        medicine_id: medicineId,
        quantity: quantity
      };

      if (!user) {
        requestBody.session_id = cartAPI.getSessionId();
      }

      console.log('[cartAPI] Adding to cart:', requestBody);

      return await apiRequest('/cart/add_item/', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
    } catch (error) {
      console.error('[cartAPI] Add to cart error:', error);
      throw error;
    }
  },


  getCart: async () => {
    try {
      const user = cartAPI.getCurrentUser();
      
      const params = new URLSearchParams();
      if (!user) {
        params.append('session_id', cartAPI.getSessionId());
      }

      return await apiRequest(`/cart/?${params.toString()}`);
    } catch (error) {
      console.error('[cartAPI] Get cart error:', error);
      throw error;
    }
  },


  updateQuantity: async (cartItemId, quantity) => {
    try {
      const user = cartAPI.getCurrentUser();
      
      const requestBody = { quantity };
      if (!user) {
        requestBody.session_id = cartAPI.getSessionId();
      }

      return await apiRequest(`/cart/${cartItemId}/update_quantity/`, {
        method: 'PATCH',
        body: JSON.stringify(requestBody)
      });
    } catch (error) {
      console.error('[cartAPI] Update quantity error:', error);
      throw error;
    }
  },


  removeItem: async (cartItemId) => {
    try {
      const user = cartAPI.getCurrentUser();
      
      const requestBody = {};
      if (!user) {
        requestBody.session_id = cartAPI.getSessionId();
      }

      return await apiRequest(`/cart/${cartItemId}/remove_item/`, {
        method: 'DELETE',
        body: JSON.stringify(requestBody)
      });
    } catch (error) {
      console.error('[cartAPI] Remove item error:', error);
      throw error;
    }
  },


  clearCart: async () => {
    try {
      const user = cartAPI.getCurrentUser();
      
      const params = new URLSearchParams();
      if (!user) {
        params.append('session_id', cartAPI.getSessionId());
      }

      return await apiRequest(`/cart/clear/?${params.toString()}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('[cartAPI] Clear cart error:', error);
      throw error;
    }
  },


  applyCoupon: async (couponCode) => {
    try {
      const user = cartAPI.getCurrentUser();
      
      const requestBody = {
        coupon_code: couponCode.toUpperCase()
      };

      if (!user) {
        requestBody.session_id = cartAPI.getSessionId();
      }

      return await apiRequest('/cart/apply_coupon/', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
    } catch (error) {
      console.error('[cartAPI] Apply coupon error:', error);
      throw error;
    }
  },


  getCartCount: async () => {
    try {
      const user = cartAPI.getCurrentUser();
      
      const params = new URLSearchParams();
      if (!user) {
        params.append('session_id', cartAPI.getSessionId());
      }

      const response = await apiRequest(`/cart/count/?${params.toString()}`);
      return response.count || 0;
    } catch (error) {
      console.error('[cartAPI] Get cart count error:', error);
      return 0;
    }
  }
};

// Notifications API
export const notificationsAPI = {
  getUserNotifications: async (userId) => {
    return apiRequest(`/notifications/?user=${userId}`);
  },

  markAsRead: async (notificationId) => {
    return apiRequest(`/notifications/${notificationId}/`, {
      method: 'PATCH',
      body: JSON.stringify({ is_read: true }),
    });
  },

  markAllAsRead: async (userId) => {
    return apiRequest(`/notifications/mark-all-read/`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  },

  deleteNotification: async (notificationId) => {
    return apiRequest(`/notifications/${notificationId}/`, {
      method: 'DELETE',
    });
  },

  getUnreadCount: async (userId) => {
    return apiRequest(`/notifications/?user=${userId}&is_read=false&count=true`);
  },
};

// Voice API
export const voiceAPI = {
  textToSpeech: async (text, language = 'English') => {
    return apiRequest('/voice/text-to-speech/', {
      method: 'POST',
      body: JSON.stringify({ text, language }),
    });
  },

  speechToText: async (audioData) => {
    const formData = new FormData();
    formData.append('audio', audioData);
    
    return apiRequest('/voice/transcribe/', {
      method: 'POST',
      body: formData,
      headers: {}, 
    });
  },

  getAvailableVoices: async () => {
    return apiRequest('/voice/available-voices/');
  },

  voiceChatMessage: async (audioData, conversationId = null) => {
    const formData = new FormData();
    formData.append('audio', audioData);
    if (conversationId) formData.append('conversationId', conversationId);
    
    return apiRequest('/voice/chat/', {
      method: 'POST',
      body: formData,
      headers: {},
    });
  },
};

// Doctor Ratings API
export const doctorRatingsAPI = {
  getPatientDoctors: async (patientId) => {
    return apiRequest(`/patients/my-doctors/?patient=${patientId}`);
  },

  createRating: async (ratingData) => {
    return apiRequest('/doctor-ratings/', {
      method: 'POST',
      body: JSON.stringify(ratingData),
    });
  },

  getPatientRatings: async (patientId) => {
    return apiRequest(`/doctor-ratings/?patient=${patientId}`);
  },

  getDoctorRatingSummary: async (doctorId) => {
    return apiRequest(`/doctors/${doctorId}/rating-summary/`);
  },

  getDoctorRatings: async (doctorId) => {
    return apiRequest(`/doctor-ratings/?doctor=${doctorId}`);
  },
};

// Conversations API
export const conversationsAPI = {
  getConversations: async (userId, showArchived = false) => {
    const params = showArchived ? `?user_id=${userId}&is_archived=true` : `?user_id=${userId}`;
    return apiRequest(`/conversations/${params}`);
  },

  deleteConversation: async (conversationId) => {
    return apiRequest(`/conversations/${conversationId}/`, {
      method: 'DELETE',
    });
  },

  archiveConversation: async (conversationId, isArchived) => {
    return apiRequest(`/conversations/${conversationId}/archive/`, {
      method: 'PATCH',
      body: JSON.stringify({ is_archived: isArchived }),
    });
  },

  pinConversation: async (conversationId, isPinned) => {
    return apiRequest(`/conversations/${conversationId}/pin/`, {
      method: 'PATCH',
      body: JSON.stringify({ is_pinned: isPinned }),
    });
  },

  updateTitle: async (conversationId, title) => {
    return apiRequest(`/conversations/${conversationId}/update_title/`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    });
  },
};

// Health Report API
export const healthReportAPI = {
  generateReport: async (conversationId, userId, patientName = '') => {
    return apiRequest('/conversations/generate-report/', {
      method: 'POST',
      body: JSON.stringify({
        conversation_id: conversationId,
        user_id: userId,
        patient_name: patientName
      }),
    });
  },

  downloadReportPDF: async (conversationId, patientName = '') => {
    const response = await fetch(`${API_BASE_URL}/conversations/download-report-pdf/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        patient_name: patientName
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to download PDF');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `health_report_${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};
export const autocorrectAPI = {
  async correctQuery(query) {
    try {
      const response = await fetch('http://localhost:8000/api/autocorrect/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      })
      
      if (!response.ok) {
        throw new Error('Autocorrect failed')
      }
      
      const data = await response.json()
      return data.result
    } catch (error) {
      console.error('[AutoCorrect] Error:', error)
      return null
    }
  }
}

export const patientPrescriptionsAPI = {
  /**
   * GET /api/patient/prescriptions/
   * List all prescriptions for the logged-in patient
   * @param {string} status  - optional filter: 'active' | 'completed' | 'cancelled'
   * @param {string} search  - optional search string
   */
  getMyPrescriptions: async (status = "", search = "") => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (search)  params.set("search", search);
    return apiRequest(`/patient/prescriptions/?${params}`);
  },

  /**
   * GET /api/patient/prescriptions/<id>/
   * Get a single prescription — returns 404 if it doesn't belong to this patient
   */
  getPrescriptionById: async (id) => {
    return apiRequest(`/patient/prescriptions/${id}/`);
  },

  /**
   * GET /api/patient/prescriptions/active/
   * Active prescriptions only (shortcut)
   */
  getActivePrescriptions: async () => {
    return apiRequest(`/patient/prescriptions/active/`);
  },

  /**
   * GET /api/patient/prescriptions/stats/
   * Prescription statistics (totals, follow-ups, etc.)
   */
  getPrescriptionStats: async () => {
    return apiRequest(`/patient/prescriptions/stats/`);
  },

  /**
   * GET /api/patient/prescriptions/<id>/medications/
   * Just the medications list for a prescription
   */
  getPrescriptionMedications: async (id) => {
    return apiRequest(`/patient/prescriptions/${id}/medications/`);
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// ADD THIS BLOCK TO api.js  (alongside your other API objects)
// ──────────────────────────────────────────────────────────────────────────────

export const pharmacistsAPI = {
  getProfile: (userId) =>
    apiRequest(`/pharmacists/${userId}/`),

  updateProfile: (userId, data) =>
    apiRequest(`/pharmacists/${userId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  uploadProfilePicture: async (userId, file) => {
    const formData = new FormData();
    formData.append('profile_picture', file);

    const token = getAuthToken(); 

    const response = await fetch(`${API_BASE_URL}/pharmacists/${userId}/upload_profile_picture/`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to upload profile picture');
    }

    return response.json();
  },
};




export default {
  authAPI,
  autocorrectAPI,
  conversationsAPI,
  videoConsultationAPI,
  appointmentsAPI,
  prescriptionsAPI,
  patientPrescriptionsAPI,
  patientsAPI,
  doctorsAPI,
  healthRecordsAPI,
  healthTrackingAPI,
  medicineAPI,
  chatAPI,
  pharmacyAPI,
  pharmacistsAPI,
  notificationsAPI,
  voiceAPI,
  doctorRatingsAPI,
  cartAPI,
  notificationsAPI,
  voiceAPI,
  doctorRatingsAPI,
  healthReportAPI,
};