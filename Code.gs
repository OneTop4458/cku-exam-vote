
/**
 * Google Apps Script 백엔드 (스프레드시트 연동, 순번 자동, 재투표 방지)
 * - 관리자 키 등 비밀값은 코드에 하드코딩하지 말고 Script Properties에 저장
 * - Properties: ADMIN_API_KEY (optional)
 */

const SHEET_NAME = 'votes';

/** ---------- Utilities ---------- */
function getProp_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}
function isAdmin_(key) {
  const adminKey = getProp_('ADMIN_API_KEY');
  return adminKey && key && key === adminKey;
}
function maskId_(sid) {
  sid = (sid || '').toString();
  return sid.length > 3 ? '*'.repeat(sid.length - 3) + sid.slice(-3) : sid;
}

/** ---------- Sheet Bootstrap ---------- */
function _getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  const header = ['timestamp','number','school','name','studentId','unavailable9','unavailable10','unavailable11','unavailable12'];
  const firstRow = sh.getRange(1,1,1,header.length).getValues()[0];
  if (firstRow.join('') === '') {
    sh.getRange(1,1,1,header.length).setValues([header]);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** ---------- CORS ---------- */
function doOptions(e) {
  return _cors_(ContentService.createTextOutput(''), e);
}
function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function _cors_(output, e) {
  const resp = output;
  resp.setHeaders({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  return resp;
}

/** ---------- Handlers ---------- */
function doGet(e) {
  const sh = _getSheet_();
  const last = sh.getLastRow();
  const values = last > 1 ? sh.getRange(2,1,last-1,9).getValues() : [];
  const admin = isAdmin_(e && e.parameter && e.parameter.apiKey);
  const rows = values.map(r => ({
    timestamp: r[0],
    number: r[1],
    school: r[2],
    name: r[3],
    studentId: admin ? (r[4] || '') : maskId_(r[4]), // 일반은 마스킹, 관리자만 원본
    unavailable9: r[5] === true || r[5] === 'true' || r[5] === 'X',
    unavailable10: r[6] === true || r[6] === 'true' || r[6] === 'X',
    unavailable11: r[7] === true || r[7] === 'true' || r[7] === 'X',
    unavailable12: r[8] === true || r[8] === 'true' || r[8] === 'X',
  }));

  if (e && e.parameter && e.parameter.format === 'csv') {
    const header = ['순번','소속학교','성명','학번','9시 불가','10시 불가','11시 불가','12시 불가','제출시각'];
    const makeRow = v => [
      v.number,
      `"${v.school}"`,
      `"${v.name}"`,
      admin ? v.studentId : maskId_(v.studentId),
      v.unavailable9 ? 'X' : '',
      v.unavailable10 ? 'X' : '',
      v.unavailable11 ? 'X' : '',
      v.unavailable12 ? 'X' : '',
      v.timestamp
    ].join(',');
    const csv = [header.join(',')].concat(rows.map(makeRow)).join('\n');
    return _cors_(ContentService.createTextOutput('\uFEFF'+csv).setMimeType(ContentService.MimeType.CSV), e);
  }

  return _cors_(_json({ ok: true, data: rows }), e);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const sh = _getSheet_();

    // 관리자: 전체 삭제
    if (body.action === 'clear') {
      if (!isAdmin_(e && (e.parameter.apiKey || body.apiKey))) {
        return _cors_(_json({ ok:false, message:'unauthorized' }), e);
      }
      if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow()-1);
      return _cors_(_json({ ok: true, message: 'cleared' }), e);
    }

    if (body.action === 'create') {
      // --- Validation ---
      if (!body.studentId || !/^[A-Za-z0-9-_]{5,20}$/.test(body.studentId)) throw new Error('학번 형식 오류');
      if (!body.name || !/^[가-힣a-zA-Z\\s]{2,30}$/.test(body.name)) throw new Error('성명 형식 오류');
      if (!body.school || typeof body.school !== 'string' || !body.school.trim()) throw new Error('소속학교 누락');
      const picked = !!body.unavailable9 || !!body.unavailable10 || !!body.unavailable11 || !!body.unavailable12;
      if (!picked) throw new Error('불가능 시간 1개 이상 선택');

      // --- Duplicate prevention ---
      const last = sh.getLastRow();
      const ids = last > 1 ? sh.getRange(2,5,last-1,1).getValues().flat() : [];
      for (let i=0;i<ids.length;i++) {
        if ((ids[i]||'').toString() === body.studentId.toString()) {
          return _cors_(_json({ ok:false, message:'이미 제출된 학번입니다. 수정은 관리자에게 문의하세요.' }), e);
        }
      }

      // --- Sequence auto increment ---
      let seq = 1;
      if (last > 1) {
        const seqs = sh.getRange(2,2,last-1,1).getValues().flat().map(v => parseInt(v,10) || 0);
        seq = Math.max(...seqs, 0) + 1;
      }

      const row = [
        body.timestamp || new Date().toISOString(),
        seq,
        body.school.trim(),
        body.name.trim(),
        body.studentId.trim(),
        !!body.unavailable9, !!body.unavailable10, !!body.unavailable11, !!body.unavailable12
      ];
      sh.appendRow(row);
      return _cors_(_json({ ok: true, number: seq }), e);
    }

    return _cors_(_json({ ok:false, message:'unknown action' }), e);
  } catch (err) {
    return _cors_(_json({ ok:false, message: err.message || 'error' }), e);
  }
}
