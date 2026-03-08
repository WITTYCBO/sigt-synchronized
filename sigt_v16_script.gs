/**
 * SIGT v16.0 Sync - Unified Apps Script
 * Dashboard & Synchronization Engine
 * 
 * Target Sheet: https://docs.google.com/spreadsheets/d/1igyBcw9UJwMGf20kWxFfblc_1Db8cqdcgQKh-gkG51A/edit
 */

const CONFIG = {
  SHEET_ID: '1igyBcw9UJwMGf20kWxFfblc_1Db8cqdcgQKh-gkG51A',
  SHEET_NAME: 'Incidencias',
  VERSION: 'v16.0 Sync'
};

function doGet(e) {
  const op = e.parameter.op;
  
  if (op === 'ping') {
    return ContentService.createTextOutput(CONFIG.VERSION + ' OK')
      .setMimeType(ContentService.MimeType.TEXT);
  }
  
  if (op === 'getData') {
    return getData();
  }
  
  return ContentService.createTextOutput('Invalid Operation')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    return appendData(data);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function appendData(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    // Modified headers to include all fields + Source
    sheet.appendRow([
      'Fecha', 
      'Ticket', 
      'Salón', 
      'Técnico', 
      'Categoría', 
      'Síntoma', 
      'Estado', 
      'Prioridad', 
      'Origen', // Web o Móvil
      'Detalles'
    ]);
    sheet.setFrozenRows(1);
    sheet.getRange("1:1").setFontWeight("bold").setBackground("#e0e0e0");
  }
  
  const timestamp = new Date();
  sheet.appendRow([
    timestamp,
      data.ticket || '',
      data.salon || '',
      data.tecnico || '',
      data.categoria || '',
      data.sintoma || '',
      data.estado || 'Pendiente',
      data.prioridad || 'Media',
      data.source || 'Desconocido',
      data.detalles || ''
  ]);
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'success', ticket: data.ticket }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getData() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  
  if (!sheet) return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
  
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const rows = values.slice(1);
  
  const data = rows.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      obj[header.toLowerCase().replace(/á/g, 'a').replace(/ó/g, 'o')] = row[i];
    });
    return obj;
  });
  
  return ContentService.createTextOutput(JSON.stringify(data.reverse())) // Newest first for dashboard
    .setMimeType(ContentService.MimeType.JSON);
}
