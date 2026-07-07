

import './generatePrescriptionPDF.css';


export const generatePrescriptionPDF = async (prescription) => {

  const { default: jsPDF } = await import('jspdf');
  const { default: html2canvas } = await import('html2canvas');
  const { default: QRCode } = await import('qrcode');
  const { default: JsBarcode } = await import('jsbarcode');

  const medications = Array.isArray(prescription.medications) ? prescription.medications : [];
  const vitalSigns = prescription.vital_signs && typeof prescription.vital_signs === 'object' ? prescription.vital_signs : {};

  const issueDate = prescription.date
    ? new Date(prescription.date).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'long', year: 'numeric',
      })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  const followUpDate = prescription.follow_up_date
    ? new Date(prescription.follow_up_date).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'long', year: 'numeric',
      })
    : null;


  const rxNumber = prescription.id
    ? `RX-${prescription.id.toString().slice(-8).toUpperCase()}`
    : `RX-${Date.now().toString().slice(-8)}`;


  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(rxNumber, {
      margin: 1,
      width: 120,
      color: {
        dark: '#16a34a',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('Error generating QR Code', err);
  }


  let barcodeSvgString = '';
  try {
    const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(tempSvg, rxNumber, {
      format: "CODE128",
      width: 1.5,
      height: 38,
      displayValue: true,
      fontSize: 10,
      font: 'Inter, sans-serif',
      lineColor: '#111827',
      textColor: '#4b5563',
      margin: 0
    });
    barcodeSvgString = tempSvg.outerHTML;
  } catch (err) {
    console.error('Error generating Barcode', err);
  }

  const vitalsRows = Object.entries(vitalSigns)
    .filter(([, v]) => v)
    .map(([k, v]) => {
      let icon = '📊';
      if (k.includes('pressure')) icon = '🩸';
      else if (k.includes('heart') || k.includes('pulse')) icon = '❤️';
      else if (k.includes('temp')) icon = '🌡️';
      else if (k.includes('spo2') || k.includes('oxygen')) icon = '🫁';
      else if (k.includes('weight') || k.includes('height')) icon = '⚖️';

      return `
        <div class="pdf-vital-card">
          <div class="pdf-vital-header">
            <span class="pdf-vital-icon">${icon}</span>
            <span class="pdf-vital-label">${formatVitalKey(k)}</span>
          </div>
          <span class="pdf-vital-value">${v}</span>
        </div>
      `;
    })
    .join('');

  const medicationRows = medications.map((med, i) => `
    <tr class="${i % 2 === 0 ? 'pdf-med-row-even' : 'pdf-med-row-odd'}">
      <td class="pdf-med-num">${i + 1}</td>
      <td>
        <div class="pdf-med-title">${escapeHtml(med.name || '—')}</div>
        ${med.dosage ? `<div class="pdf-med-dosage">${escapeHtml(med.dosage)}</div>` : ''}
      </td>
      <td class="pdf-med-center">${escapeHtml(med.frequency || '—')}</td>
      <td class="pdf-med-center">${escapeHtml(med.duration || '—')}</td>
      <td class="pdf-med-instructions">${escapeHtml(med.instructions || 'As directed by physician')}</td>
    </tr>
  `).join('');

  const patientAge = prescription.patient_age ? `${prescription.patient_age} Years` : '';
  const patientGender = prescription.patient_gender ? prescription.patient_gender : '';
  const patientAgeGender = [patientAge, patientGender].filter(Boolean).join(' / ');


  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: 794px;
    background: white;
    z-index: -9999;
  `;
  document.body.appendChild(container);


  container.innerHTML = buildPrescriptionHTML(
    prescription,
    rxNumber,
    issueDate,
    followUpDate,
    patientAgeGender,
    vitalsRows,
    medicationRows,
    qrCodeDataUrl,
    barcodeSvgString
  );

  try {

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: 794,
    });

    const imgData = canvas.toDataURL('image/png', 1.0);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    const pageHeight = pdf.internal.pageSize.getHeight();


    let heightLeft = pdfHeight;
    let position = 0;
    const threshold = 5;

    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
    heightLeft -= pageHeight;

    while (heightLeft > threshold) {
      position = heightLeft - pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
    }


    const dateStr = new Date(prescription.date || Date.now())
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '');
    const patientSlug = (prescription.patient_name || 'Patient')
      .replace(/\s+/g, '_')
      .toUpperCase();
    const shortId = (prescription.id || 'RX000').toString().slice(-6).toUpperCase();
    const filename = `Rx_${patientSlug}_${dateStr}_${shortId}.pdf`;

    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
};


const buildPrescriptionHTML = (
  rx,
  rxNumber,
  issueDate,
  followUpDate,
  patientAgeGender,
  vitalsRows,
  medicationRows,
  qrCodeDataUrl,
  barcodeSvgString
) => {
  const medications = Array.isArray(rx.medications) ? rx.medications : [];

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8"/>
    </head>
    <body>
      <div class="pdf-page-wrapper">
        <div class="pdf-watermark">RURAL HEALTHCARE</div>

        <div class="pdf-header">
          <div class="pdf-header-grid">
            <div class="pdf-clinic-brand">
              <div class="pdf-brand-logo-box">
                <svg class="pdf-brand-logo-svg" viewBox="0 0 24 24">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <div class="pdf-clinic-details">
                <div class="pdf-clinic-name">${escapeHtml(rx.hospital_name || 'Rural HealthCare Clinic')}</div>
                <div class="pdf-clinic-sub">Telemedicine &amp; Digital Health Platform</div>
              </div>
            </div>

            <div class="pdf-doctor-info">
              <div class="pdf-doctor-name">Dr. ${escapeHtml(rx.doctor_name || 'Physician')}</div>
              ${rx.doctor_registration ? `<div class="pdf-doctor-reg">Reg. No: ${escapeHtml(rx.doctor_registration)}</div>` : ''}
              ${rx.doctor_specialization ? `<div class="pdf-doctor-spec">${escapeHtml(rx.doctor_specialization)}</div>` : ''}
            </div>
          </div>

          <div class="pdf-header-bottom">
            <div class="pdf-rx-badge">
              <div class="pdf-rx-symbol">Rx</div>
              <div class="pdf-rx-meta">
                <span class="pdf-rx-label">Prescription ID</span>
                <span class="pdf-rx-num">${rxNumber}</span>
              </div>
            </div>
            <div class="pdf-header-meta">
              <div>Date: <strong>${issueDate}</strong></div>
              <div>Consultation Mode: Video Consultation</div>
            </div>
          </div>
        </div>

        <!-- PATIENT INFO CARD -->
        <div class="pdf-patient-card">
          <div class="pdf-patient-left">
            <span class="pdf-patient-label">Patient Details</span>
            <div class="pdf-patient-name">${escapeHtml(rx.patient_name || 'Patient')}</div>
            <div class="pdf-patient-meta">
              <span><strong>Age / Gender:</strong> ${escapeHtml(patientAgeGender || '—')}</span>
              ${rx.patient_phone ? `<span>•</span> <span><strong>Phone:</strong> ${escapeHtml(rx.patient_phone)}</span>` : ''}
            </div>
          </div>
          <div class="pdf-patient-right">
            <span class="pdf-patient-pill">✓ Verified Teleconsult</span>
            <div class="pdf-patient-type">Type: Active Digital Prescription</div>
          </div>
        </div>

        <!-- CLINICAL DIAGNOSIS -->
        ${rx.diagnosis ? `
        <div class="pdf-diagnosis-box">
          <div class="pdf-diagnosis-title">🩺 Clinical Diagnosis / Symptoms</div>
          <div class="pdf-diagnosis-text">${escapeHtml(rx.diagnosis)}</div>
        </div>` : ''}

        <!-- VITAL SIGNS -->
        ${vitalsRows ? `
        <div class="pdf-section">
          <div class="pdf-section-header">Patient Vital Signs</div>
          <div class="pdf-vitals-grid">${vitalsRows}</div>
        </div>` : ''}

        <!-- MEDICATIONS TABLE -->
        ${medications.length > 0 ? `
        <div class="pdf-section">
          <div class="pdf-section-header">Prescribed Medications</div>
          <table class="pdf-med-table">
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th>Medicine Name &amp; Strength</th>
                <th style="width: 140px; text-align: center;">Frequency</th>
                <th style="width: 110px; text-align: center;">Duration</th>
                <th>Directions / Instructions</th>
              </tr>
            </thead>
            <tbody>
              ${medicationRows}
            </tbody>
          </table>
        </div>` : ''}

        <!-- NOTES & LAB TESTS -->
        ${(rx.notes || rx.lab_tests) ? `
        <div class="pdf-section pdf-info-grid">
          ${rx.notes ? `
          <div class="pdf-info-box">
            <div class="pdf-info-box-title">📋 Doctor's Consultation Notes</div>
            <div class="pdf-info-box-text">${escapeHtml(rx.notes)}</div>
          </div>` : ''}

          ${rx.lab_tests ? `
          <div class="pdf-info-box">
            <div class="pdf-info-box-title">🔬 Lab Investigations Advised</div>
            <div class="pdf-info-box-text">${escapeHtml(rx.lab_tests)}</div>
          </div>` : ''}
        </div>` : ''}

        <!-- FOLLOW UP DATE -->
        ${followUpDate ? `
        <div class="pdf-section">
          <div class="pdf-followup-card">
            <div class="pdf-followup-icon">📅</div>
            <div class="pdf-followup-details">
              <span class="pdf-followup-label">Advised Follow-up Date</span>
              <span class="pdf-followup-date">${followUpDate}</span>
            </div>
          </div>
        </div>` : ''}

        <!-- FOOTER -->
        <div class="pdf-footer">
          <div class="pdf-footer-top">
            <div class="pdf-signature-area">
              <div class="pdf-signature-line"></div>
              <span class="pdf-signature-title">Dr. ${escapeHtml(rx.doctor_name || 'Physician')}</span>
              ${rx.doctor_specialization ? `<span class="pdf-signature-meta">${escapeHtml(rx.doctor_specialization)}</span>` : ''}
              ${rx.doctor_registration ? `<span class="pdf-signature-meta">Reg No: ${escapeHtml(rx.doctor_registration)}</span>` : ''}
            </div>

            <div class="pdf-seal-stamp">
              Doctor's<br/>Stamp<br/>&amp; Seal
            </div>

            <div class="pdf-barcode-area">
              ${qrCodeDataUrl ? `<img src="${qrCodeDataUrl}" alt="Prescription QR Code" style="width: 64px; height: 64px; border: 1.5px solid #e5e7eb; border-radius: 8px; padding: 4px; background: #ffffff;" />` : ''}
              ${barcodeSvgString}
            </div>
          </div>

          <div class="pdf-disclaimer">
            <strong>Digital Telemedicine Prescription Validity:</strong> This document is electronically generated and digitally signed under the Telemedicine Practice Guidelines, Ministry of Health and Family Welfare, Govt. of India.
            It is legally valid for dispensing prescribed medicines. Please follow all dosage guidelines carefully.
            In case of any side effects, discontinue use and consult your doctor immediately. Keep out of reach of children.
            <br/>
            <strong>Prescription ID:</strong> ${rxNumber} | Issued via Rural HealthCare Safe &amp; Encrypted Platform
          </div>
        </div>

      </div>
    </body>
    </html>
  `;
};

const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const formatVitalKey = (key) => {
  const map = {
    blood_pressure: 'Blood Pressure',
    heart_rate: 'Heart Rate',
    temperature: 'Temperature',
    spo2: 'SpO₂',
    oxygen_saturation: 'SpO₂',
    respiratory_rate: 'Resp. Rate',
    weight: 'Weight',
    height: 'Height',
    bmi: 'BMI',
    blood_sugar: 'Blood Sugar',
    pulse: 'Pulse',
  };
  return map[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export default generatePrescriptionPDF;