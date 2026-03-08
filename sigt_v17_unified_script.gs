/**
 * SIGT v17.0 Unified Backend
 * Manages: 
 * - Incidencias (from App 1)
 * - Pedido de Repuestos (from App 2)
 * - Dashboard (Multi-role RBAC)
 * - Users & Auth (Email + 6-digit PIN)
 */

const CONFIG = {
  MASTER_SHEET_ID: '1igyBcw9UJwMGf20kWxFfblc_1Db8cqdcgQKh-gkG51A', // Usamos la proporcionada anteriormente o una nueva si el usuario lo indica
  SHEETS: {
    INCIDENCIAS: 'INCIDENCIAS',
    REPUESTOS: 'REPUESTOS',
    USUARIOS: 'USUARIOS',
    MASTER_LOG: 'MASTER_LOG'
  }
};

/**
 * INIT: Crea las hojas si no existen
 */
function initSystem() {
  const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
  
  // Hojas Requeridas
  const sheets = [
    { name: CONFIG.SHEETS.INCIDENCIAS, headers: ['ID', 'Timestamp', 'Priority', 'Category', 'CodigoCat', 'Salon', 'Modelo', 'Serie', 'Sintoma', 'SintomasRapidos', 'Errores', 'Recaudacion', 'TiempoInicio', 'PasosProbados', 'Empleado', 'TelPersonal', 'TelSala', 'FotoURL'] },
    { name: CONFIG.SHEETS.REPUESTOS, headers: ['ID', 'Timestamp', 'Tracking', 'TicketSIGT', 'Tipo', 'Urgencia', 'Solicitante', 'Destino', 'Estado', 'LineasJSON'] },
    { name: CONFIG.SHEETS.USUARIOS, headers: ['Email', 'Nombre', 'Rol', 'PIN', 'Activo'] },
    { name: CONFIG.SHEETS.MASTER_LOG, headers: ['Timestamp', 'Action', 'User', 'Details'] }
  ];

  sheets.forEach(s => {
    let sheet = ss.getSheetByName(s.name);
    if (!sheet) {
      sheet = ss.insertSheet(s.name);
      sheet.appendRow(s.headers);
      sheet.getRange(1, 1, 1, s.headers.length).setFontWeight('bold').setBackground('#f3f3f3');
    }
  });

  // Usuario Admin inicial si está vacío
  const userSheet = ss.getSheetByName(CONFIG.SHEETS.USUARIOS);
  if (userSheet.getLastRow() === 1) {
    userSheet.appendRow(['admin@sigt.com', 'Administrador Root', 'encargado_sigt', '', 'SI']);
  }
}

/**
 * GET requests: Auth and Data fetching
 */
function doGet(e) {
  try {
    const op = e.parameter.op;
    const email = e.parameter.email;
    const pin = e.parameter.pin;

    if (op === 'login') return login(email, pin);
    if (op === 'getData') return getDashboardData(email, pin);
    if (op === 'getUserList') return getUserList(email, pin);
    if (op === 'setPin') return setPin(email, e.parameter.newPin);

    return jsonRes({ success: false, error: 'Operación no válida' });
  } catch (err) {
    return jsonRes({ success: false, error: err.message });
  }
}

/**
 * POST requests: Form submissions
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const op = data.op;

    if (op === 'registerIncident') return registerIncident(data);
    if (op === 'registerPartRequest') return registerPartRequest(data);
    if (op === 'updateStatus') return updateStatus(data);

    return jsonRes({ success: false, error: 'Operación no válida' });
  } catch (err) {
    return jsonRes({ success: false, error: err.message });
  }
}

// --- AUTH LOGIC ---

function login(email, pin) {
  const user = findUser(email);
  if (!user) return jsonRes({ success: false, error: 'Usuario no encontrado' });
  
  const storedPin = String(user.pin || '').trim();

  // Caso 1: Usuario no tiene PIN definido todavía (Primer Login)
  if (!storedPin || storedPin === 'null' || storedPin === 'undefined') {
    return jsonRes({ success: true, firstLogin: true, nombre: user.nombre });
  }

  // Caso 2: El frontend solo está comprobando el email (primera fase)
  if (pin === undefined) {
    return jsonRes({ success: true, needsPin: true });
  }

  // Caso 3: Verificación de PIN
  if (storedPin === String(pin).trim()) {
    return jsonRes({ success: true, user: { email: user.email, nombre: user.nombre, rol: user.rol } });
  } else {
    return jsonRes({ success: false, error: 'PIN incorrecto' });
  }
}

/**
 * Función de Emergencia: Ejecuta esto para resetear el admin si nada funciona
 */
function resetAdminLogin() {
  const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.USUARIOS);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === 'admin@sigt.com') {
      sheet.getRange(i + 1, 4).setValue(''); // Borra el PIN
      console.log('Admin reseteado con éxito. Ahora puedes entrar y definir uno nuevo.');
      return;
    }
  }
  // Si no existe, lo crea
  sheet.appendRow(['admin@sigt.com', 'Administrador Root', 'encargado_sigt', '', 'SI']);
  console.log('Admin creado desde cero.');
}

function setPin(email, newPin) {
  if (!newPin || String(newPin).length !== 6) return jsonRes({ success: false, error: 'El PIN debe tener 6 dígitos' });
  const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.USUARIOS);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      sheet.getRange(i + 1, 4).setValue(String(newPin)); // Columna PIN
      return jsonRes({ success: true });
    }
  }
  return jsonRes({ success: false, error: 'Usuario no encontrado' });
}

// --- DATA LOGIC ---

function registerIncident(data) {
  const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.INCIDENCIAS);
  const id = data.id || 'TK-' + Date.now();
  
  sheet.appendRow([
    id, 
    new Date(), 
    data.priority, 
    data.category, 
    data.codigoCat || '',
    data.salon, 
    data.modelo, 
    data.serie, 
    data.sintoma, 
    data.sintomasRapidos || '',
    data.errores || '', 
    data.recaudacion, 
    data.tiempoInicio || '',
    data.pasosProbados || '',
    data.empleado, 
    data.telPersonal || '', 
    data.telSala || '', 
    data.fotoUrl || ''
  ]);
  
  return jsonRes({ success: true, id: id });
}

function registerPartRequest(data) {
  const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.REPUESTOS);
  const tracking = data.tracking || 'SOL-' + Date.now();
  
  sheet.appendRow([
    'RP-' + Date.now(), new Date(), tracking, data.ticket_sigt_id,
    data.tipo_solicitud, data.urgencia, data.solicitante_email,
    data.destino_solicitud, 'pendiente', JSON.stringify(data.lineas)
  ]);
  
  return jsonRes({ success: true, tracking: tracking });
}

function getDashboardData(email, pin) {
  const user = validateAdminOrStaff(email, pin);
  if (!user) return jsonRes({ success: false, error: 'No autorizado' });

  const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
  const incidents = ss.getSheetByName(CONFIG.SHEETS.INCIDENCIAS).getDataRange().getValues();
  const parts = ss.getSheetByName(CONFIG.SHEETS.REPUESTOS).getDataRange().getValues();
  
  return jsonRes({
    success: true,
    incidents: tableToJson(incidents),
    parts: tableToJson(parts),
    role: user.rol
  });
}

function getUserList(email, pin) {
  const user = findUser(email);
  if (!user || user.pin !== pin || user.rol !== 'encargado_sigt') {
    return jsonRes({ success: false, error: 'Acceso denegado: Se requiere ROOT' });
  }

  const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
  const users = ss.getSheetByName(CONFIG.SHEETS.USUARIOS).getDataRange().getValues();
  return jsonRes({ success: true, users: tableToJson(users) });
}

// --- HELPERS ---

function findUser(email) {
  const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.USUARIOS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      return { email: data[i][0], nombre: data[i][1], rol: data[i][2], pin: String(data[i][3]), activo: data[i][4] };
    }
  }
  return null;
}

function validateAdminOrStaff(email, pin) {
  const user = findUser(email);
  if (user && user.pin === pin) return user;
  return null;
}

function tableToJson(values) {
  const headers = values[0];
  const result = [];
  for (let i = 1; i < values.length; i++) {
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[i][j];
    }
    result.push(obj);
  }
  return result;
}

function jsonRes(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
