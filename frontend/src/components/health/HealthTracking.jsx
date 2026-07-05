import React, { useState, useEffect } from 'react';
import {
  FaHeartbeat, FaHome, FaRobot, FaVideo, FaPrescriptionBottle,
  FaChartLine, FaPills, FaTint, FaWeight, FaThermometerHalf,
  FaPlus, FaTimes, FaCalendarCheck, FaBullseye, FaRunning,
  FaBell, FaClock, FaFlask, FaWind, FaChevronRight, FaMicrophone, FaCheck,
  FaArrowLeft
} from 'react-icons/fa';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { healthTrackingAPI, authAPI } from '../../services/api';
import Footer from '../Footer';
import './HealthTracking.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const HealthTracking = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('metric');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Dashboard data
  const [dashboardData, setDashboardData] = useState(null);
  const [latestMetrics, setLatestMetrics] = useState({});
  const [activeGoals, setActiveGoals] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [medicationReminders, setMedicationReminders] = useState([]);
  const [alerts, setAlerts] = useState([]);
  
  // Trends data
  const [selectedMetricType, setSelectedMetricType] = useState('heart_rate');
  const [trendPeriod, setTrendPeriod] = useState(30);
  const [trendsData, setTrendsData] = useState(null);
  
  // Form data
  const [metricFormData, setMetricFormData] = useState({
    metric_type: '',
    value: '',
    unit: '',
    notes: '',
    recorded_at: ''
  });
  
  const [goalFormData, setGoalFormData] = useState({
    goal_type: '',
    title: '',
    description: '',
    target_value: '',
    current_value: '0',
    unit: '',
    target_date: '',
    reminder_enabled: true
  });
  
  const [activityFormData, setActivityFormData] = useState({
    activity_type: '',
    title: '',
    description: '',
    duration_minutes: '',
    calories_burned: '',
    intensity: '',
    activity_date: '',
    activity_time: ''
  });
  
  const [reminderFormData, setReminderFormData] = useState({
    medication_name: '',
    dosage: '',
    frequency: 'daily',
    time_slots: ['08:00'],
    start_date: '',
    end_date: '',
    notes: ''
  });

  // AI Coach state
  const [aiCoachExercise, setAiCoachExercise] = useState('squats');
  const [aiCoachTargetReps, setAiCoachTargetReps] = useState(10);
  const [aiCoachRepCount, setAiCoachRepCount] = useState(0);
  const [aiCoachFeedback, setAiCoachFeedback] = useState('Position your camera and align your body.');
  const [aiCoachIsActive, setAiCoachIsActive] = useState(false);
  const [aiCoachLoading, setAiCoachLoading] = useState(false);
  const [aiCoachStreaming, setAiCoachStreaming] = useState(false);
  const [aiCoachSummary, setAiCoachSummary] = useState(null);
  
  // Voice Log state
  const [voiceState, setVoiceState] = useState('idle'); // idle, listening, error
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceDetectedVitals, setVoiceDetectedVitals] = useState({});

  // AI Coach Refs
  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const requestRef = React.useRef(null);
  const detectorRef = React.useRef(null);

  // Metric type configurations
  const metricTypes = [
    { value: 'blood_pressure', label: 'Blood Pressure', unit: 'mmHg', icon: <FaTint />, color: 'green', hex: '#00b38e' },
    { value: 'heart_rate', label: 'Heart Rate', unit: 'bpm', icon: <FaHeartbeat />, color: 'rose', hex: '#f43f5e' },
    { value: 'weight', label: 'Weight', unit: 'kg', icon: <FaWeight />, color: 'amber', hex: '#f59e0b' },
    { value: 'temperature', label: 'Temperature', unit: '°F', icon: <FaThermometerHalf />, color: 'violet', hex: '#8b5cf6' },
    { value: 'blood_sugar', label: 'Blood Sugar', unit: 'mg/dL', icon: <FaFlask />, color: 'orange', hex: '#f97316' },
    { value: 'oxygen_saturation', label: 'Oxygen Saturation', unit: '%', icon: <FaWind />, color: 'cyan', hex: '#06b6d4' }
  ];

  useEffect(() => {
    loadUserAndData();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadDashboard();
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && selectedMetricType) {
      loadTrends();
    }
  }, [currentUser, selectedMetricType, trendPeriod]);

  const loadUserAndData = async () => {
    try {
      const user = authAPI.getCurrentUser();
      if (!user) {
        window.location.href = '/auth?type=patient&view=login';
        return;
      }
      if (!user.id) {
        alert('Invalid user session. Please log in again.');
        window.location.href = '/auth?type=patient&view=login';
        return;
      }
      setCurrentUser(user);
    } catch (error) {
      console.error('[HealthTracking] Error loading user:', error);
      window.location.href = '/auth?type=patient&view=login';
    }
  };

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await healthTrackingAPI.getDashboard(currentUser.id);
      if (data.success && data.dashboard) {
        setDashboardData(data.dashboard);
        const metricsMap = {};
        data.dashboard.latest_metrics?.forEach(metric => {
          metricsMap[metric.metric_type] = metric;
        });
        setLatestMetrics(metricsMap);
        setActiveGoals(data.dashboard.active_goals || []);
        setRecentActivities(data.dashboard.recent_activities || []);
        setMedicationReminders(data.dashboard.medication_reminders || []);
        setAlerts(data.dashboard.alerts || []);
      } else {
        setDashboardData({
          latest_metrics: [],
          active_goals: [],
          recent_activities: [],
          medication_reminders: [],
          alerts: []
        });
      }
    } catch (error) {
      console.error('[HealthTracking] Error loading dashboard:', error);
      setDashboardData({
        latest_metrics: [],
        active_goals: [],
        recent_activities: [],
        medication_reminders: [],
        alerts: []
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTrends = async () => {
    try {
      const data = await healthTrackingAPI.getMetricTrends(
        currentUser.id,
        selectedMetricType,
        trendPeriod
      );
      if (data.success) {
        setTrendsData(data);
      }
    } catch (error) {
      console.error('Error loading trends:', error);
    }
  };

  const openModal = (type) => {
    setModalType(type);
    setShowModal(true);
    const now = new Date();
    const dateTimeLocal = now.toISOString().slice(0, 16);
    const dateOnly = now.toISOString().slice(0, 10);
    const timeOnly = now.toTimeString().slice(0, 5);
    
    if (type === 'metric') {
      setMetricFormData(prev => ({ ...prev, recorded_at: dateTimeLocal }));
    } else if (type === 'activity') {
      setActivityFormData(prev => ({ 
        ...prev, 
        activity_date: dateOnly,
        activity_time: timeOnly
      }));
    } else if (type === 'goal') {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 1);
      setGoalFormData(prev => ({ 
        ...prev, 
        target_date: futureDate.toISOString().slice(0, 10)
      }));
    } else if (type === 'reminder') {
      setReminderFormData(prev => ({ 
        ...prev, 
        start_date: dateOnly
      }));
    }
  };

  const closeModal = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    setAiCoachIsActive(false);
    setAiCoachStreaming(false);
    setAiCoachSummary(null);
    setVoiceState('idle');
    setVoiceDetectedVitals({});
    setVoiceTranscript('');

    setShowModal(false);
    setMetricFormData({
      metric_type: '',
      value: '',
      unit: '',
      notes: '',
      recorded_at: ''
    });
    setGoalFormData({
      goal_type: '',
      title: '',
      description: '',
      target_value: '',
      current_value: '0',
      unit: '',
      target_date: '',
      reminder_enabled: true
    });
    setActivityFormData({
      activity_type: '',
      title: '',
      description: '',
      duration_minutes: '',
      calories_burned: '',
      intensity: '',
      activity_date: '',
      activity_time: ''
    });
    setReminderFormData({
      medication_name: '',
      dosage: '',
      frequency: 'daily',
      time_slots: ['08:00'],
      start_date: '',
      end_date: '',
      notes: ''
    });
  };

  const handleAddMetric = async (e) => {
    e.preventDefault();
    try {
      if (!currentUser || !currentUser.id) {
        alert('Please log in to add health metrics');
        window.location.href = '/auth?type=patient&view=login';
        return;
      }
      const metricData = {
        patient_id: currentUser.id,
        patient: currentUser.id,
        metric_type: metricFormData.metric_type,
        value: metricFormData.value,
        unit: metricFormData.unit,
        notes: metricFormData.notes || '',
        recorded_at: metricFormData.recorded_at || new Date().toISOString()
      };
      await healthTrackingAPI.createMetric(metricData);
      alert('Health metric added successfully!');
      closeModal();
      loadDashboard();
      loadTrends();
    } catch (error) {
      console.error('[HealthTracking] Error adding metric:', error);
      if (error.message.includes('Patient not found')) {
        alert('Session expired. Please log in again.');
        window.location.href = '/auth?type=patient&view=login';
      } else {
        alert('Error adding metric: ' + error.message);
      }
    }
  };

  const handleAddGoal = async (e) => {
    e.preventDefault();
    try {
      await healthTrackingAPI.createGoal({
        patient: currentUser.id,
        ...goalFormData
      });
      alert('Health goal created successfully!');
      closeModal();
      loadDashboard();
    } catch (error) {
      alert('Error creating goal: ' + error.message);
    }
  };

  const handleAddActivity = async (e) => {
    e.preventDefault();
    try {
      await healthTrackingAPI.createActivity({
        patient: currentUser.id,
        ...activityFormData
      });
      alert('Activity logged successfully!');
      closeModal();
      loadDashboard();
    } catch (error) {
      alert('Error logging activity: ' + error.message);
    }
  };

  const handleAddReminder = async (e) => {
    e.preventDefault();
    try {
      await healthTrackingAPI.createReminder({
        patient: currentUser.id,
        ...reminderFormData
      });
      alert('Medication reminder created successfully!');
      closeModal();
      loadDashboard();
    } catch (error) {
      alert('Error creating reminder: ' + error.message);
    }
  };

  const handleLogMedication = async (reminderId) => {
    try {
      await healthTrackingAPI.logMedicationIntake(reminderId, {
        scheduled_time: new Date().toISOString(),
        notes: 'Taken via dashboard'
      });
      alert('Medication intake logged!');
      loadDashboard();
    } catch (error) {
      alert('Error logging medication: ' + error.message);
    }
  };

  // AI PHYSIOTHERAPY & EXERCISE COACH LOGIC
  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  };

  const loadDynamicScript = (url, id) => {
    return new Promise((resolve, reject) => {
      const existing = document.getElementById(id);
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = url;
      script.id = id;
      script.onload = () => resolve();
      script.onerror = (err) => reject(err);
      document.head.appendChild(script);
    });
  };

  const initAICoach = async () => {
    setAiCoachLoading(true);
    setAiCoachSummary(null);
    setAiCoachRepCount(0);
    setAiCoachFeedback('Loading TensorFlow AI Models...');
    try {
      await loadDynamicScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs', 'tfjs-core');
      await loadDynamicScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection', 'tfjs-pose');
      setAiCoachLoading(false);
      setAiCoachFeedback('AI models loaded. Select exercise and start camera.');
    } catch (err) {
      console.error('[AICoach] Script loading error:', err);
      setAiCoachFeedback('Error loading AI models. Verify internet connection.');
      setAiCoachLoading(false);
    }
  };

  const startAICoach = async () => {
    if (!window.poseDetection) {
      alert('AI Models not ready. Please try initializing again.');
      return;
    }
    setAiCoachIsActive(true);
    setAiCoachStreaming(true);
    setAiCoachRepCount(0);
    setAiCoachFeedback('Accessing video camera...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setAiCoachFeedback('Calibrating AI pose detection...');
      
      const detector = await window.poseDetection.createDetector(
        window.poseDetection.SupportedModels.MoveNet,
        { modelType: window.poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
      );
      detectorRef.current = detector;

      speakText("Ready! Step back so your joints are visible.");
      setAiCoachFeedback('AI active. Step back and begin exercise.');

      let lastState = 'up';
      let reps = 0;
      let calories = 0;
      const startTime = Date.now();

      const runLoop = async () => {
        if (!streamRef.current || !detectorRef.current || !videoRef.current || !canvasRef.current) return;
        
        try {
          const poses = await detectorRef.current.estimatePoses(videoRef.current);
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          
          ctx.save();
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          ctx.restore();

          if (poses && poses.length > 0) {
            const keypoints = poses[0].keypoints;
            drawPoseSkeleton(ctx, keypoints);

            const getK = (name) => keypoints.find(kp => kp.name === name);
            const lHip = getK('left_hip');
            const lKnee = getK('left_knee');
            const lAnkle = getK('left_ankle');
            const lShoulder = getK('left_shoulder');
            const lWrist = getK('left_wrist');

            if (aiCoachExercise === 'squats' && lHip && lKnee && lAnkle && lHip.score > 0.3 && lKnee.score > 0.3 && lAnkle.score > 0.3) {
              const angle = calculateKneeAngle(lHip, lKnee, lAnkle);
              if (lastState === 'up' && angle < 115) {
                lastState = 'down';
                speakText("Up!");
                setAiCoachFeedback("Good depth! Now stand back up.");
              } else if (lastState === 'down' && angle > 155) {
                lastState = 'up';
                reps += 1;
                calories += 0.5;
                setAiCoachRepCount(reps);
                speakText(`${reps}`);
                setAiCoachFeedback(`Rep ${reps} complete! Keep going.`);

                if (reps >= aiCoachTargetReps) {
                  stopAICoach(reps, calories, startTime);
                  return;
                }
              }
            } else if (aiCoachExercise === 'raises' && lShoulder && lWrist && lShoulder.score > 0.3 && lWrist.score > 0.3) {
              const wristY = lWrist.y;
              const shoulderY = lShoulder.y;
              
              if (lastState === 'up' && wristY < shoulderY - 20) {
                lastState = 'down';
                speakText("Down!");
                setAiCoachFeedback("Arms raised! Now return them to your sides.");
              } else if (lastState === 'down' && wristY > shoulderY + 50) {
                lastState = 'up';
                reps += 1;
                calories += 0.35;
                setAiCoachRepCount(reps);
                speakText(`${reps}`);
                setAiCoachFeedback(`Rep ${reps} complete! Keep going.`);

                if (reps >= aiCoachTargetReps) {
                  stopAICoach(reps, calories, startTime);
                  return;
                }
              }
            }
          }
        } catch (err) {
          console.error('[AICoach] Tracking loop error:', err);
        }

        requestRef.current = requestAnimationFrame(runLoop);
      };

      requestRef.current = requestAnimationFrame(runLoop);

    } catch (err) {
      console.error('[AICoach] Camera setup error:', err);
      setAiCoachFeedback('Camera access denied or webcam not detected.');
      setAiCoachStreaming(false);
    }
  };

  const calculateKneeAngle = (hip, knee, ankle) => {
    const baX = hip.x - knee.x;
    const baY = hip.y - knee.y;
    const bcX = ankle.x - knee.x;
    const bcY = ankle.y - knee.y;

    const dotProduct = (baX * bcX) + (baY * bcY);
    const magBA = Math.sqrt(baX * baX + baY * baY);
    const magBC = Math.sqrt(bcX * bcX + bcY * bcY);

    const angleRad = Math.acos(dotProduct / (magBA * magBC));
    return angleRad * (180 / Math.PI);
  };

  const drawPoseSkeleton = (ctx, keypoints) => {
    keypoints.forEach(kp => {
      if (kp.score > 0.3) {
        ctx.beginPath();
        ctx.arc(canvasRef.current.width - kp.x, kp.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#00b38e';
        ctx.fill();
      }
    });

    const connections = [
      ['left_shoulder', 'right_shoulder'],
      ['left_shoulder', 'left_hip'],
      ['right_shoulder', 'right_hip'],
      ['left_hip', 'right_hip'],
      ['left_shoulder', 'left_elbow'],
      ['left_elbow', 'left_wrist'],
      ['right_shoulder', 'right_elbow'],
      ['right_elbow', 'right_wrist'],
      ['left_hip', 'left_knee'],
      ['left_knee', 'left_ankle'],
      ['right_hip', 'right_knee'],
      ['right_knee', 'right_ankle']
    ];

    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;

    connections.forEach(([startName, endName]) => {
      const start = keypoints.find(kp => kp.name === startName);
      const end = keypoints.find(kp => kp.name === endName);

      if (start && end && start.score > 0.3 && end.score > 0.3) {
        ctx.beginPath();
        ctx.moveTo(canvasRef.current.width - start.x, start.y);
        ctx.lineTo(canvasRef.current.width - end.x, end.y);
        ctx.stroke();
      }
    });
  };

  const stopAICoach = (finalReps = null, finalCals = null, startTime = null) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }

    const reps = finalReps !== null ? finalReps : aiCoachRepCount;
    const calories = finalCals !== null ? finalCals : (aiCoachExercise === 'squats' ? reps * 0.5 : reps * 0.35);
    const duration = startTime ? Math.max(1, Math.round((Date.now() - startTime) / 60000)) : 1;

    speakText("Session complete! Excellent effort.");

    setAiCoachStreaming(false);
    setAiCoachSummary({
      exercise: aiCoachExercise === 'squats' ? 'Squats' : 'Lateral Raises',
      reps,
      calories: Math.round(calories * 10) / 10,
      duration
    });
    setAiCoachFeedback('Workout complete! Review and log your results.');
  };

  const handleSaveAICoachActivity = async () => {
    if (!aiCoachSummary) return;
    try {
      await healthTrackingAPI.createActivity({
        patient: currentUser.id,
        activity_type: 'exercise',
        title: `AI ${aiCoachSummary.exercise} Coach`,
        description: `Completed ${aiCoachSummary.reps} reps of ${aiCoachSummary.exercise} guided by AI pose estimation.`,
        duration_minutes: aiCoachSummary.duration,
        calories_burned: Math.round(aiCoachSummary.calories),
        intensity: 'medium',
        activity_date: new Date().toISOString().split('T')[0]
      });
      alert('AI Workout logged in activities dashboard!');
      closeModal();
      loadDashboard();
    } catch (err) {
      alert('Error saving AI activity: ' + err.message);
    }
  };

  // AI VOICE SPEECH-TO-VITAL LOGGER LOGIC
  const startVoiceLogger = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setVoiceState('listening');
    setVoiceTranscript('Listening... Speak your vitals clearly.');
    setVoiceDetectedVitals({});

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setVoiceTranscript(text);
      parseVoiceVitals(text);
    };

    recognition.onerror = (err) => {
      console.error('[VoiceLog] Recognition error:', err);
      setVoiceState('error');
      setVoiceTranscript('Failed to recognize speech. Please try again.');
    };

    recognition.onend = () => {
      setVoiceState('idle');
    };

    recognition.start();
  };

  const parseVoiceVitals = (text) => {
    const normalized = text.toLowerCase();
    const parsed = {};

    const bpMatch = normalized.match(/(\d{2,3})\s*(?:over|\/)\s*(\d{2,3})/);
    if (bpMatch) {
      parsed.blood_pressure = `${bpMatch[1]}/${bpMatch[2]}`;
    }

    const hrMatch = normalized.match(/(?:heart rate|pulse|heartrate)(?:\s+is|\s+of)?\s+(\d{2,3})/);
    if (hrMatch) {
      parsed.heart_rate = hrMatch[1];
    } else {
      const hrFallback = normalized.match(/(\d{2,3})\s*(?:bpm|beats)/);
      if (hrFallback) parsed.heart_rate = hrFallback[1];
    }

    const sugarMatch = normalized.match(/(?:blood sugar|sugar)(?:\s+is|\s+of)?\s+(\d{2,3})/);
    if (sugarMatch) {
      parsed.blood_sugar = sugarMatch[1];
    }

    const o2Match = normalized.match(/(?:oxygen|saturation|spo2|pulse ox)(?:\s+is|\s+of)?\s+(\d{2,3})/);
    if (o2Match) {
      parsed.oxygen_saturation = o2Match[1];
    }

    const tempMatch = normalized.match(/(?:temp|temperature|fever)(?:\s+is|\s+of)?\s+(\d{2,3}(?:\.\d)?)/);
    if (tempMatch) {
      parsed.temperature = tempMatch[1];
    }

    const weightMatch = normalized.match(/(?:weight|weigh)(?:\s+is|\s+of)?\s+(\d{2,3}(?:\.\d)?)/);
    if (weightMatch) {
      parsed.weight = weightMatch[1];
    }

    setVoiceDetectedVitals(parsed);
  };

  const handleSaveVoiceLoggedVitals = async () => {
    const keys = Object.keys(voiceDetectedVitals);
    if (keys.length === 0) return;

    try {
      for (const type of keys) {
        let value = voiceDetectedVitals[type];
        let unit = '';
        
        if (type === 'blood_pressure') unit = 'mmHg';
        if (type === 'heart_rate') unit = 'bpm';
        if (type === 'weight') unit = 'kg';
        if (type === 'temperature') unit = '°F';
        if (type === 'blood_sugar') unit = 'mg/dL';
        if (type === 'oxygen_saturation') unit = '%';

        await healthTrackingAPI.createMetric({
          patient: currentUser.id,
          metric_type: type,
          value: value.toString(),
          unit,
          notes: 'Logged via AI Voice Parser',
          recorded_at: new Date().toISOString()
        });
      }

      alert(`Successfully saved ${keys.length} voice-transcribed vital signs!`);
      setVoiceDetectedVitals({});
      setVoiceTranscript('');
      closeModal();
      loadDashboard();
    } catch (err) {
      alert('Error saving voice vitals: ' + err.message);
    }
  };

  const getMetricConfig = (mType) => {
    return metricTypes.find(m => m.value === mType) || metricTypes[0];
  };

  const formatMetricValue = (metric) => {
    if (!metric) return 'N/A';
    if (metric.metric_type === 'blood_pressure' && metric.systolic && metric.diastolic) {
      return `${metric.systolic}/${metric.diastolic}`;
    }
    return metric.value;
  };

  const getAlertColorClasses = (alertLevel) => {
    switch (alertLevel) {
      case 'critical': return 'border-rose-500 bg-rose-50 text-rose-600';
      case 'warning': return 'border-amber-500 bg-amber-50 text-amber-700';
      default: return 'border-green-500 bg-green-50 text-green-700';
    }
  };

  const getTrendChartData = () => {
    if (!trendsData || !trendsData.data_points) {
      return { labels: [], datasets: [] };
    }
    const config = getMetricConfig(selectedMetricType);
    return {
      labels: trendsData.data_points.map(point => point.date),
      datasets: [
        {
          label: config.label,
          data: trendsData.data_points.map(point => parseFloat(point.value) || 0),
          borderColor: config.hex,
          backgroundColor: `${config.hex}15`,
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      y: {
        grid: { color: 'rgba(15, 23, 42, 0.06)' },
        ticks: { color: '#64748b' }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#64748b' }
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <FaHeartbeat className="w-12 h-12 text-teal-600 animate-pulse mx-auto" />
          <h2 className="mt-6 text-xl font-bold text-slate-800">Rural HealthCare</h2>
          <p className="mt-2 text-xs text-slate-500 font-semibold uppercase tracking-wider">Syncing your health telemetry...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/30 via-slate-50 to-white text-slate-800 flex flex-col justify-between">
      
      {/* Premium Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => window.location.href = '/'}>
            <div className="w-9 h-9 bg-teal-600/10 text-teal-600 border border-teal-500/10 rounded-xl flex items-center justify-center text-xl group-hover:scale-105 transition-transform shadow-inner">
              <FaHeartbeat className="animate-pulse" />
            </div>
            <span className="text-lg font-black text-slate-900 tracking-tight">Rural HealthCare</span>
          </div>
          <button 
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-xs font-bold transition-all shadow-sm cursor-pointer"
            onClick={() => window.location.href = '/'}
          >
            <FaArrowLeft /> Back to Dashboard
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header Title Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Health Dashboard</h1>
            <p className="text-xs md:text-sm text-slate-500 mt-2 font-bold uppercase tracking-wider">Real-time health vital signs & diagnostics</p>
          </div>
          <div className="flex-shrink-0">
            <button 
              onClick={() => openModal('metric')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-600/10 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              <FaPlus /> Add New Vital
            </button>
          </div>
        </div>

        {/* Alerts Section */}
        {alerts.length > 0 && (
          <div className="mb-10 bg-rose-50/50 border border-rose-200/60 rounded-3xl p-6">
            <h3 className="text-xs font-black text-rose-800 tracking-wide uppercase mb-4 flex items-center gap-2">
              <FaBell className="text-rose-600 animate-bounce" /> Active Health Alerts
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {alerts.map((alert, index) => (
                <div key={index} className={`flex items-start gap-3 p-4 bg-white border rounded-2xl shadow-sm ${getAlertColorClasses(alert.alert_level)}`}>
                  <FaBell className="text-base mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 leading-tight">{alert.message}</h4>
                    <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">{alert.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vitals Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
          {metricTypes.map((metricType) => {
            const metric = latestMetrics[metricType.value];
            const isAbnormal = metric?.is_abnormal;
            
            const colorMap = {
              green: { bg: 'bg-green-50/50', border: 'hover:border-teal-500/40', text: 'text-teal-600', icon: 'bg-teal-50 text-teal-600' },
              rose: { bg: 'bg-rose-50/50', border: 'hover:border-rose-500/40', text: 'text-rose-600', icon: 'bg-rose-50 text-rose-600' },
              amber: { bg: 'bg-amber-50/50', border: 'hover:border-amber-500/40', text: 'text-amber-600', icon: 'bg-amber-50 text-amber-600' },
              violet: { bg: 'bg-violet-50/50', border: 'hover:border-violet-500/40', text: 'text-violet-600', icon: 'bg-violet-50 text-violet-600' },
              orange: { bg: 'bg-orange-50/50', border: 'hover:border-orange-500/40', text: 'text-orange-600', icon: 'bg-orange-50 text-orange-600' },
              cyan: { bg: 'bg-cyan-50/50', border: 'hover:border-cyan-500/40', text: 'text-cyan-600', icon: 'bg-cyan-50 text-cyan-600' }
            };

            const styles = colorMap[metricType.color];

            return (
              <div 
                key={metricType.value}
                className={`relative bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group ${styles.border}`}
              >
                <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: metricType.hex }}></div>
                
                <div className="flex justify-between items-start">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shadow-sm ${styles.icon}`}>
                    {metricType.icon}
                  </div>
                  {metric && (
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${isAbnormal ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-teal-50 text-teal-600 border border-teal-200'}`}>
                      {isAbnormal ? `⚠ Alert` : '✓ Normal'}
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <div className="flex items-baseline">
                    <span className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                      {metric ? formatMetricValue(metric) : 'N/A'}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">{metricType.unit}</span>
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">{metricType.label}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Trends Chart & Filter */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-xl shadow-slate-900/5 mb-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Telemetry History &amp; Trends</h2>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">Visualize your diagnostic parameters over time</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <select 
                value={selectedMetricType}
                onChange={(e) => setSelectedMetricType(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                {metricTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>

              <div className="flex p-1 bg-slate-100 rounded-xl">
                {[7, 30, 90].map((period) => {
                  const isActive = trendPeriod === period;
                  return (
                    <button 
                      key={period}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                        isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                      onClick={() => setTrendPeriod(period)}
                    >
                      {period === 7 ? '1W' : period === 30 ? '1M' : '3M'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="h-80 w-full">
            <Line data={getTrendChartData()} options={chartOptions} />
          </div>

          {trendsData && (
            <div className="flex gap-8 mt-6 pt-6 border-t border-slate-100">
              <div className="text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Average Reading</span>
                <span className="text-lg font-black text-slate-800">{trendsData.average}</span>
              </div>
              <div className="text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Log Submissions</span>
                <span className="text-lg font-black text-slate-800">{trendsData.count}</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Section (Goals & Activities) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          
          {/* Active Goals */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-xl shadow-slate-900/5">
            <div className="flex items-center justify-between gap-4 mb-6">
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <FaBullseye className="text-teal-600" /> Target Health Goals
              </h2>
              <button 
                onClick={() => openModal('goal')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                <FaPlus /> New Goal
              </button>
            </div>

            {activeGoals.length === 0 ? (
              <div className="text-center py-16 text-slate-400 font-semibold text-xs border border-dashed border-slate-200 rounded-2xl flex flex-col items-center gap-2">
                <FaBullseye size={24} className="text-slate-300" />
                <span>Establish health targets to track patient success</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                {activeGoals.map((goal) => (
                  <div key={goal.id} className="p-4 bg-slate-50 hover:bg-white border border-slate-200/60 hover:border-teal-500/40 rounded-2xl transition-all duration-200">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="text-xs font-bold text-slate-800 leading-snug">{goal.title}</h3>
                      <span className="px-2 py-0.5 bg-teal-50 text-teal-600 rounded text-[9px] font-bold uppercase tracking-wider flex-shrink-0">{goal.goal_type_display}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 font-semibold leading-relaxed line-clamp-2">{goal.description}</p>
                    
                    <div className="mt-4">
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-teal-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(goal.progress_percentage, 100)}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold mt-2">
                        <span>{goal.current_value} / {goal.target_value} {goal.unit}</span>
                        <span className="text-teal-600 font-extrabold">{Math.round(goal.progress_percentage)}%</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold uppercase tracking-wider pt-3 mt-3 border-t border-slate-200/65">
                      <span>{Math.round(goal.progress_percentage)}% Complete</span>
                      {goal.days_remaining !== null && (
                        <span className="flex items-center gap-1"><FaClock /> {goal.days_remaining} days left</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activities */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-xl shadow-slate-900/5">
            <div className="flex items-center justify-between gap-4 mb-6">
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <FaRunning className="text-teal-600" /> Recent Activities
              </h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => { openModal('ai_coach'); initAICoach(); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-br from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-green-500/10 cursor-pointer"
                >
                  <FaRobot /> AI Exercise Coach
                </button>
                <button 
                  onClick={() => openModal('activity')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  <FaPlus /> Log Activity
                </button>
              </div>
            </div>

            {recentActivities.length === 0 ? (
              <div className="text-center py-16 text-slate-400 font-semibold text-xs border border-dashed border-slate-200 rounded-2xl flex flex-col items-center gap-2">
                <FaRunning size={24} className="text-slate-300" />
                <span>Start submitting your physical tasks and routines</span>
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex gap-3.5 p-4 bg-slate-50 hover:bg-white border border-slate-200/60 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 shadow-sm hover:shadow">
                    <div className="w-9 h-9 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center text-sm shadow-inner flex-shrink-0 mt-0.5">
                      <FaRunning />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-xs font-bold text-slate-900 leading-snug">{activity.title}</h4>
                        {activity.intensity && (
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                            activity.intensity === 'high' ? 'bg-red-50 text-red-600' : activity.intensity === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'
                          }`}>{activity.intensity}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">{activity.description}</p>
                      <div className="flex gap-3 text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-3 pt-3 border-t border-slate-200/65">
                        <span>{activity.activity_date}</span>
                        {activity.duration_minutes && <span>• {activity.duration_minutes} mins</span>}
                        {activity.calories_burned && <span>• {activity.calories_burned} kcal</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Medication Reminders Section */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-xl shadow-slate-900/5 mb-10">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <FaPills className="text-teal-600" /> Prescribed Reminders
            </h2>
            <button 
              onClick={() => openModal('reminder')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              <FaPlus /> New Reminder
            </button>
          </div>

          {medicationReminders.length === 0 ? (
            <div className="text-center py-16 text-slate-400 font-semibold text-xs border border-dashed border-slate-200 rounded-2xl flex flex-col items-center gap-2">
              <FaPills size={24} className="text-slate-300" />
              <span>Set schedules to trigger daily alarms and recommendations</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {medicationReminders.map((reminder) => (
                <div key={reminder.id} className="p-5 bg-slate-50 hover:bg-white border border-slate-200/60 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 shadow-sm hover:shadow flex flex-col justify-between h-full">
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="text-sm font-extrabold text-slate-900 leading-snug">{reminder.medication_name}</h3>
                      <span className="px-2 py-0.5 bg-slate-200/70 text-slate-700 rounded text-[9px] font-bold uppercase tracking-wider flex-shrink-0">{reminder.frequency_display}</span>
                    </div>
                    <p className="text-xs text-slate-500 font-semibold mt-1">Dosage: {reminder.dosage}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {reminder.time_slots.map((time, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200/60 rounded-lg text-[10px] font-bold text-slate-600 shadow-sm">
                          <FaClock className="text-slate-400" /> {time}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-200/65">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Adherence: <span className="text-teal-600 font-black">{reminder.adherence_rate}%</span></span>
                    <button 
                      onClick={() => handleLogMedication(reminder.id)}
                      className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                    >
                      ✓ Log Intake
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer component rendered fully below the main content */}
      <Footer />

      {/* ── FLOAT BUTTON FOR MOBILE Add Vital ── */}
      <button 
        onClick={() => openModal('metric')}
        className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-teal-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-teal-600/20 active:scale-95 transition-transform z-50 cursor-pointer"
      >
        <FaPlus className="text-xl" />
      </button>

      {/* ── MODALS ── */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={closeModal}></div>
          
          <div className="relative bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-white">
              <h2 className="text-sm font-black text-slate-900 tracking-wide uppercase">
                {modalType === 'metric' && 'Add Vital Health Metric'}
                {modalType === 'goal' && 'Establish Health Goal'}
                {modalType === 'activity' && 'Log Routine Activity'}
                {modalType === 'reminder' && 'Setup Medication Reminder'}
                {modalType === 'ai_coach' && '🤖 AI Physiotherapy Coach'}
              </h2>
              <button 
                onClick={closeModal} 
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <FaTimes size={12} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white">
              
              {/* Metric Form */}
              {modalType === 'metric' && (
                <form onSubmit={handleAddMetric} className="space-y-4">
                  {/* Speak Vitals Panel */}
                  <div className="mb-6 p-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 relative">
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${voiceState === 'listening' ? 'bg-rose-400' : 'bg-transparent'}`}></span>
                          <span className={`relative inline-flex rounded-full h-2 w-2 ${voiceState === 'listening' ? 'bg-rose-500' : 'bg-slate-400'}`}></span>
                        </span>
                        <h4 className="text-xs font-bold text-slate-700">🎙️ AI Voice Vital Parser</h4>
                      </div>
                      <button 
                        type="button"
                        onClick={startVoiceLogger}
                        className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] font-bold transition-all duration-300 cursor-pointer ${voiceState === 'listening' ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-800 text-white hover:bg-slate-900'}`}
                      >
                        <FaMicrophone /> {voiceState === 'listening' ? 'Listening...' : 'Speak Vitals'}
                      </button>
                    </div>

                    {voiceTranscript && (
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-650 italic mb-3">
                        "{voiceTranscript}"
                      </div>
                    )}

                    {Object.keys(voiceDetectedVitals).length > 0 && (
                      <div className="space-y-2 mt-2 bg-emerald-50/40 p-3 rounded-xl border border-emerald-250/50">
                        <span className="text-[10px] font-bold text-emerald-700 block mb-1">Parsed Metrics:</span>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {Object.entries(voiceDetectedVitals).map(([key, val]) => (
                            <div key={key} className="flex items-center gap-1.5 bg-white py-1 px-2 rounded border border-emerald-100 text-slate-750 font-medium capitalize">
                              <span className="text-emerald-600 font-bold">✓</span> {key.replace('_', ' ')}: <span className="font-bold text-emerald-700">{val}</span>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={handleSaveVoiceLoggedVitals}
                          className="w-full mt-2.5 bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Auto-Log Detected Vitals
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Metric Type</label>
                    <select 
                      value={metricFormData.metric_type}
                      onChange={(e) => {
                        const selectedType = metricTypes.find(t => t.value === e.target.value);
                        setMetricFormData({
                          ...metricFormData, 
                          metric_type: e.target.value,
                          unit: selectedType?.unit || ''
                        });
                      }}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all cursor-pointer"
                      required
                    >
                      <option value="">Select metric</option>
                      {metricTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Value</label>
                    <input 
                      type="text" 
                      value={metricFormData.value}
                      onChange={(e) => setMetricFormData({...metricFormData, value: e.target.value})}
                      placeholder="e.g., 72 or 120/80" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                      required 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Date &amp; Time</label>
                    <input 
                      type="datetime-local" 
                      value={metricFormData.recorded_at}
                      onChange={(e) => setMetricFormData({...metricFormData, recorded_at: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none transition-all cursor-pointer"
                      required 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Notes (Optional)</label>
                    <input 
                      type="text" 
                      value={metricFormData.notes}
                      onChange={(e) => setMetricFormData({...metricFormData, notes: e.target.value})}
                      placeholder="Any additional notes" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                    />
                  </div>

                  <button type="submit" className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-teal-600/10 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer">
                    Save Vital Record
                  </button>
                </form>
              )}

              {/* AI Coach Form */}
              {modalType === 'ai_coach' && (
                <div className="space-y-4">
                  {!aiCoachStreaming && !aiCoachSummary && (
                    <div className="text-center py-6 space-y-4">
                      <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mx-auto text-3xl border border-teal-200 shadow-inner">
                        <FaRobot className="animate-pulse" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-lg">AI Physiotherapy Trainer</h3>
                        <p className="text-slate-500 text-xs mt-1 font-semibold leading-relaxed max-w-sm mx-auto">
                          Use real-time joint-pose estimation to calibrate posture and count exercise reps.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 max-w-md mx-auto text-left mt-6">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Choose Activity</label>
                          <select 
                            value={aiCoachExercise} 
                            onChange={(e) => setAiCoachExercise(e.target.value)}
                            className="w-full rounded-xl border border-slate-250 p-2.5 text-xs font-bold text-slate-700 bg-white focus:outline-none cursor-pointer"
                          >
                            <option value="squats">Squats (Legs)</option>
                            <option value="raises">Lateral Raises (Shoulders)</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Target Reps</label>
                          <input 
                            type="number" 
                            value={aiCoachTargetReps} 
                            onChange={(e) => setAiCoachTargetReps(parseInt(e.target.value) || 10)}
                            className="w-full rounded-xl border border-slate-250 p-2 text-xs font-bold text-slate-700 bg-white focus:outline-none"
                            min="1"
                            max="50"
                          />
                        </div>
                      </div>

                      <div className="pt-4">
                        {aiCoachLoading ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                            <span className="text-[11px] text-slate-500 font-bold">Initializing AI Camera...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2 max-w-xs mx-auto">
                            <button
                              onClick={startAICoach}
                              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl font-bold text-xs shadow-md shadow-teal-600/10 transition-all cursor-pointer"
                            >
                              Start Camera &amp; AI Coach
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAiCoachStreaming(true);
                                setTimeout(() => {
                                  alert("Starting session! Stand in front of your camera. If camera is not active, you can close or click Stop to record reps.");
                                }, 500);
                              }}
                              className="text-[10px] text-teal-600 font-extrabold hover:underline"
                            >
                              Open Stream Canvas
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {aiCoachStreaming && (
                    <div className="space-y-4">
                      <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-video border border-slate-800">
                        <video
                          ref={videoRef}
                          style={{ width: '0px', height: '0px', position: 'absolute' }}
                          playsInline
                          muted
                        ></video>
                        <canvas
                          ref={canvasRef}
                          width="640"
                          height="480"
                          className="w-full h-full object-cover"
                        ></canvas>

                        {/* Top HUD */}
                        <div className="absolute top-3 left-3 right-3 flex justify-between items-center pointer-events-none">
                          <div className="bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/50 text-white text-[10px] font-bold uppercase tracking-wider">
                            {aiCoachExercise}
                          </div>
                          <div className="bg-teal-600/90 text-white px-4 py-1.5 rounded-lg text-lg font-black tracking-wider shadow">
                            {aiCoachRepCount} / {aiCoachTargetReps}
                          </div>
                        </div>

                        {/* Bottom HUD */}
                        <div className="absolute bottom-3 left-3 right-3 bg-slate-900/85 backdrop-blur-md p-2.5 rounded-lg border border-slate-750 text-center text-xs font-semibold text-teal-400 leading-snug">
                          {aiCoachFeedback}
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500 font-bold italic animate-pulse">
                          ● Joint estimation active...
                        </span>
                        <button
                          onClick={() => stopAICoach()}
                          className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Stop &amp; Log Reps
                        </button>
                      </div>
                    </div>
                  )}

                  {aiCoachSummary && (
                    <div className="text-center py-4 space-y-4 max-w-sm mx-auto">
                      <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mx-auto text-xl border border-teal-200 shadow-inner font-bold">
                        ✓
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-950 text-base">Workout Session Summary</h3>
                        <p className="text-slate-500 text-xs mt-0.5">Confirm details to add to your activities logs.</p>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-3 gap-2 text-center text-xs">
                        <div>
                          <span className="text-slate-400 block font-medium">Repetitions</span>
                          <span className="text-lg font-black text-slate-800">{aiCoachSummary.reps}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-medium">Calories</span>
                          <span className="text-lg font-black text-slate-800">{aiCoachSummary.calories} kcal</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-medium">Duration</span>
                          <span className="text-lg font-black text-slate-800">{aiCoachSummary.duration} min</span>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={() => setAiCoachSummary(null)}
                          className="flex-1 border border-slate-300 hover:bg-slate-50 text-slate-700 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Retry Session
                        </button>
                        <button
                          onClick={handleSaveAICoachActivity}
                          className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-teal-600/10"
                        >
                          Confirm &amp; Log
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Goal Form */}
              {modalType === 'goal' && (
                <form onSubmit={handleAddGoal} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Goal Type</label>
                    <select 
                      value={goalFormData.goal_type}
                      onChange={(e) => setGoalFormData({...goalFormData, goal_type: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all cursor-pointer"
                      required
                    >
                      <option value="">Select goal type</option>
                      <option value="weight_loss">Weight Loss</option>
                      <option value="weight_gain">Weight Gain</option>
                      <option value="exercise">Exercise</option>
                      <option value="steps">Daily Steps</option>
                      <option value="water_intake">Water Intake</option>
                      <option value="sleep">Sleep Hours</option>
                      <option value="blood_pressure">Blood Pressure Control</option>
                      <option value="blood_sugar">Blood Sugar Control</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Title</label>
                    <input 
                      type="text" 
                      value={goalFormData.title}
                      onChange={(e) => setGoalFormData({...goalFormData, title: e.target.value})}
                      placeholder="e.g., Lose 5kg in 2 months" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                      required 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Description</label>
                    <textarea 
                      value={goalFormData.description}
                      onChange={(e) => setGoalFormData({...goalFormData, description: e.target.value})}
                      placeholder="Describe your goal..."
                      rows="3"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400 min-h-[80px]"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Target Value</label>
                      <input 
                        type="number" 
                        step="0.1"
                        value={goalFormData.target_value}
                        onChange={(e) => setGoalFormData({...goalFormData, target_value: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all"
                        required 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Unit</label>
                      <input 
                        type="text" 
                        value={goalFormData.unit}
                        onChange={(e) => setGoalFormData({...goalFormData, unit: e.target.value})}
                        placeholder="kg, steps, hours"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                        required 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Start Date</label>
                      <input 
                        type="date" 
                        value={goalFormData.start_date || ''}
                        onChange={(e) => setGoalFormData({...goalFormData, start_date: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none transition-all cursor-pointer"
                        required 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Target Date</label>
                      <input 
                        type="date" 
                        value={goalFormData.target_date}
                        onChange={(e) => setGoalFormData({...goalFormData, target_date: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none transition-all cursor-pointer"
                        required 
                      />
                    </div>
                  </div>

                  <button type="submit" className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-teal-600/10 cursor-pointer">
                    Create Goal
                  </button>
                </form>
              )}

              {/* Activity Form */}
              {modalType === 'activity' && (
                <form onSubmit={handleAddActivity} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Activity Type</label>
                    <select 
                      value={activityFormData.activity_type}
                      onChange={(e) => setActivityFormData({...activityFormData, activity_type: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all cursor-pointer"
                      required
                    >
                      <option value="">Select activity</option>
                      <option value="exercise">Exercise</option>
                      <option value="meal">Meal</option>
                      <option value="medication">Medication</option>
                      <option value="water">Water Intake</option>
                      <option value="sleep">Sleep</option>
                      <option value="meditation">Meditation</option>
                      <option value="checkup">Health Checkup</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Title</label>
                    <input 
                      type="text" 
                      value={activityFormData.title}
                      onChange={(e) => setActivityFormData({...activityFormData, title: e.target.value})}
                      placeholder="e.g., Morning Run" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                      required 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Description</label>
                    <input 
                      type="text" 
                      value={activityFormData.description}
                      onChange={(e) => setActivityFormData({...activityFormData, description: e.target.value})}
                      placeholder="Activity details" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Duration (min)</label>
                      <input 
                        type="number" 
                        value={activityFormData.duration_minutes}
                        onChange={(e) => setActivityFormData({...activityFormData, duration_minutes: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Calories</label>
                      <input 
                        type="number" 
                        value={activityFormData.calories_burned}
                        onChange={(e) => setActivityFormData({...activityFormData, calories_burned: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Intensity</label>
                    <select 
                      value={activityFormData.intensity}
                      onChange={(e) => setActivityFormData({...activityFormData, intensity: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all cursor-pointer"
                    >
                      <option value="">Select intensity</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Date</label>
                      <input 
                        type="date" 
                        value={activityFormData.activity_date}
                        onChange={(e) => setActivityFormData({...activityFormData, activity_date: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none transition-all cursor-pointer"
                        required 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Time</label>
                      <input 
                        type="time" 
                        value={activityFormData.activity_time}
                        onChange={(e) => setActivityFormData({...activityFormData, activity_time: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-705 focus:outline-none transition-all cursor-pointer"
                      />
                    </div>
                  </div>

                  <button type="submit" className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-teal-600/10 cursor-pointer">
                    Log Activity
                  </button>
                </form>
              )}

              {/* Reminder Form */}
              {modalType === 'reminder' && (
                <form onSubmit={handleAddReminder} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Medication Name</label>
                    <input 
                      type="text" 
                      value={reminderFormData.medication_name}
                      onChange={(e) => setReminderFormData({...reminderFormData, medication_name: e.target.value})}
                      placeholder="e.g., Aspirin 100mg" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                      required 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Dosage</label>
                    <input 
                      type="text" 
                      value={reminderFormData.dosage}
                      onChange={(e) => setReminderFormData({...reminderFormData, dosage: e.target.value})}
                      placeholder="e.g., 1 tablet" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                      required 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Frequency</label>
                    <select 
                      value={reminderFormData.frequency}
                      onChange={(e) => setReminderFormData({...reminderFormData, frequency: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all cursor-pointer"
                      required
                    >
                      <option value="daily">Daily</option>
                      <option value="twice_daily">Twice Daily</option>
                      <option value="three_times_daily">Three Times Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="as_needed">As Needed</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Reminder Time</label>
                    <input 
                      type="time" 
                      value={reminderFormData.time_slots[0]}
                      onChange={(e) => setReminderFormData({
                        ...reminderFormData, 
                        time_slots: [e.target.value]
                      })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-755 focus:outline-none transition-all cursor-pointer"
                      required 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Start Date</label>
                      <input 
                        type="date" 
                        value={reminderFormData.start_date}
                        onChange={(e) => setReminderFormData({...reminderFormData, start_date: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none transition-all cursor-pointer"
                        required 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">End Date (Optional)</label>
                      <input 
                        type="date" 
                        value={reminderFormData.end_date || ''}
                        onChange={(e) => setReminderFormData({...reminderFormData, end_date: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none transition-all cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Notes (Optional)</label>
                    <input 
                      type="text" 
                      value={reminderFormData.notes}
                      onChange={(e) => setReminderFormData({...reminderFormData, notes: e.target.value})}
                      placeholder="Additional instructions" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                    />
                  </div>

                  <button type="submit" className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-teal-600/10 cursor-pointer">
                    Create Reminder
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthTracking;