import React, { useState } from 'react';
import { FaFileMedical, FaDownload, FaTimes, FaSpinner, FaCheckCircle, FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa';
import { healthReportAPI } from '../../services/api';
import './HealthReportModal.css';

const HealthReportModal = ({ conversationId, userId, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [reportText, setReportText] = useState('');
  const [patientName, setPatientName] = useState('');
  const [step, setStep] = useState('input'); // 'input', 'preview', 'error'
  const [error, setError] = useState('');

  const handleGenerateReport = async () => {
    // Validation
    if (!patientName.trim()) {
      setError('Please enter patient name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await healthReportAPI.generateReport(
        conversationId,
        userId,
        patientName.trim()
      );

      if (response.success) {
        setReportText(response.report_text);
        setStep('preview');
      } else {
        setError(response.error || 'Failed to generate report');
        setStep('error');
      }
    } catch (err) {
      console.error('Error generating report:', err);
      setError(err.message || 'Failed to generate report. Please try again.');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    setLoading(true);
    
    try {
      await healthReportAPI.downloadReportPDF(conversationId, patientName.trim());
      // Success - PDF download should start automatically
    } catch (err) {
      console.error('Error downloading PDF:', err);
      setError('Failed to download PDF. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) {
      handleGenerateReport();
    }
  };

  return (
    <div className="health-report-modal-overlay" onClick={onClose}>
      <div className="health-report-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="health-report-modal-header">
          <div className="header-left">
            <FaFileMedical className="header-icon" />
            <h2>Generate Health Report</h2>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <FaTimes />
          </button>
        </div>

        <div className="health-report-modal-body">
          {step === 'input' && (
            <div className="input-step">
              <p className="info-text">
                <FaInfoCircle style={{ marginRight: '6px' }} /> Generate a comprehensive health summary from your conversation with our AI assistant.
                This professionally formatted report can be shared with your doctor for consultation.
              </p>

              <div className="form-group">
                <label htmlFor="patientName">
                  Patient Name <span style={{ color: '#c00' }}>*</span>
                </label>
                <input
                  id="patientName"
                  type="text"
                  placeholder="Enter full name (e.g., John Doe)"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="input-field"
                  autoFocus
                  maxLength={100}
                />
              </div>

              {error && (
                <div className="error-message">
                  <FaExclamationTriangle style={{ marginRight: '6px' }} /> {error}
                </div>
              )}

              <div className="button-group">
                <button 
                  className="btn-secondary" 
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary" 
                  onClick={handleGenerateReport}
                  disabled={loading || !patientName.trim()}
                >
                  {loading ? (
                    <>
                      <FaSpinner className="spinner" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FaFileMedical />
                      Generate Report
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="preview-step">
              <div className="report-preview">
                <pre className="report-text">{reportText}</pre>
              </div>

              <div className="disclaimer">
                <strong><FaExclamationTriangle style={{ marginRight: '6px' }} /> Important Disclaimer</strong>
                This is an AI-generated summary for informational purposes only and is NOT a medical diagnosis.
                Always consult a qualified healthcare professional for accurate diagnosis and treatment.
              </div>

              <div className="button-group">
                <button 
                  className="btn-secondary" 
                  onClick={() => setStep('input')}
                  disabled={loading}
                >
                  ← Back
                </button>
                <button 
                  className="btn-primary" 
                  onClick={handleDownloadPDF}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <FaSpinner className="spinner" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <FaDownload />
                      Download PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 'error' && (
            <div className="input-step">
              <div className="error-message">
                <FaExclamationTriangle style={{ marginRight: '6px' }} /> {error}
              </div>

              <p className="info-text">
                Please try again. If the problem persists, ensure you have a valid conversation with messages.
              </p>

              <div className="button-group">
                <button 
                  className="btn-secondary" 
                  onClick={onClose}
                >
                  Close
                </button>
                <button 
                  className="btn-primary" 
                  onClick={() => {
                    setStep('input');
                    setError('');
                  }}
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HealthReportModal;