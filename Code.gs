
/**
 * Google Apps Script 백엔드 (스프레드시트 연동, 순번 자동, 재투표 방지)
 * - 모든 설정값은 CONFIG 객체를 통해 중앙 관리
 * - 민감한 값들은 Script Properties에 저장
 */

// ========== 상수 정의 ==========
const CONFIG = {
  // 시트 설정
  SHEET_NAME: 'votes',

  // Script Properties 키
  PROP_KEYS: {
    ADMIN_PW: 'ADMIN_PW',
    SHEET_ID: 'SHEET_ID',
    VOTE_START_DATE: 'VOTE_START_DATE',
    VOTE_END_DATE: 'VOTE_END_DATE',
    VOTE_START_TIME: 'VOTE_START_TIME',
    VOTE_END_TIME: 'VOTE_END_TIME',
    VOTING_DESCRIPTION: 'VOTING_DESCRIPTION',
    VOTING_TITLE: 'VOTING_TITLE',
    TIME_OPTIONS: 'TIME_OPTIONS',
    ALLOW_ALL_AVAILABLE: 'ALLOW_ALL_AVAILABLE',
    UNIVERSITY_LIST: 'UNIVERSITY_LIST',
    UNAVAILABLE_9: 'UNAVAILABLE_9',
    UNAVAILABLE_10: 'UNAVAILABLE_10',
    UNAVAILABLE_11: 'UNAVAILABLE_11',
    UNAVAILABLE_12: 'UNAVAILABLE_12'
  },

  // 기본값들
  DEFAULTS: {
    VOTING_DESCRIPTION: '토요일에 불가능한 시간만 체크해주세요.',
    VOTING_TITLE: '시험 시간 투표',
    TIME_OPTIONS: [
      { id: '9', emoji: '🕘', label: '9시', description: '불가능' },
      { id: '10', emoji: '🕙', label: '10시', description: '불가능' },
      { id: '11', emoji: '🕚', label: '11시', description: '불가능' },
      { id: '12', emoji: '🕛', label: '12시', description: '불가능' }
    ],
    UNIVERSITY_LIST: [
      "가톨릭대학교",
      "가톨릭관동대학교",
      "가톨릭꽃동네대학교",
      "가톨릭상지대학교",
      "대구가톨릭대학교",
      "목포가톨릭대학교",
      "부산가톨릭대학교",
      "서강대학교",
      "인천가톨릭대학교",
      "기타(직접입력)"
    ]
  }
};

/** ---------- Utilities ---------- */
function getProp_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}
function isAdmin_(key) {
  const adminKey = getProp_(CONFIG.PROP_KEYS.ADMIN_PW);
  return adminKey && key && key === adminKey;
}
function maskId_(sid) {
  sid = (sid || '').toString();
  return sid.length > 3 ? '*'.repeat(sid.length - 3) + sid.slice(-3) : sid;
}

function maskName_(name) {
  name = (name || '').toString();
  if (name.length <= 1) return name;
  if (name.length === 2) return name[0] + '*';
  const first = name[0];
  const last = name[name.length - 1];
  const middle = '*'.repeat(name.length - 2);
  return first + middle + last;
}

/** ---------- Sheet Bootstrap ---------- */
function _getSpreadsheet_() {
  // 1) 컨테이너 바운드(스프레드시트에서 Apps Script 연 경우)
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  // 2) 스탠드얼론(별도 프로젝트)인 경우, Script Properties의 SHEET_ID 사용
  const sid = getProp_(CONFIG.PROP_KEYS.SHEET_ID);
  if (!sid) throw new Error('SHEET_ID 속성이 설정되지 않았습니다. 프로젝트를 스프레드시트에 바운드하거나 SHEET_ID를 설정하세요.');
  return SpreadsheetApp.openById(sid);
}
function _getSheet_() {
  const ss = _getSpreadsheet_();
  let sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) sh = ss.insertSheet(CONFIG.SHEET_NAME);
  const header = ['timestamp','number','school','name','studentId','unavailable9','unavailable10','unavailable11','unavailable12'];
  const firstRow = sh.getRange(1,1,1,header.length).getValues()[0];
  if (firstRow.join('') === '') {
    sh.getRange(1,1,1,header.length).setValues([header]);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** ---------- HTTP helpers ---------- */
function doOptions(e) {
  // Apps Script는 임의 헤더 세팅이 제한적이지만, OPTIONS에 200 응답만으로도 대부분 동작합니다.
  return ContentService.createTextOutput('');
}
function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
}

/** ---------- Handlers ---------- */
function doGet(e) {
  // CORS 헤더 추가
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };

  // OPTIONS 요청 처리 (CORS preflight)
  if (e && e.parameter && e.parameter.method === 'OPTIONS') {
    return ContentService
      .createTextOutput('')
      .setMimeType(ContentService.MimeType.TEXT)
      .setHeaders(corsHeaders);
  }

  const sh = _getSheet_();
  const last = sh.getLastRow();
  const values = last > 1 ? sh.getRange(2,1,last-1,9).getValues() : [];
  const admin = isAdmin_(e && e.parameter && e.parameter.apiKey);
  const rows = values.map(r => ({
    timestamp: r[0],
    number: r[1],
    school: r[2],
    name: admin ? (r[3] || '') : maskName_(r[3]),
    studentId: admin ? (r[4] || '') : maskId_(r[4]),
    unavailable9: r[5] === true || r[5] === 'true' || r[5] === 'X',
    unavailable10: r[6] === true || r[6] === 'true' || r[6] === 'X',
    unavailable11: r[7] === true || r[7] === 'true' || r[7] === 'X',
    unavailable12: r[8] === true || r[8] === 'true' || r[8] === 'X',
  }));

  // 투표 설정 정보 추가
  const voteStartDate = getProp_(CONFIG.PROP_KEYS.VOTE_START_DATE) || '';
  const voteEndDate = getProp_(CONFIG.PROP_KEYS.VOTE_END_DATE) || '';
  const voteStartTime = getProp_(CONFIG.PROP_KEYS.VOTE_START_TIME) || '';
  const voteEndTime = getProp_(CONFIG.PROP_KEYS.VOTE_END_TIME) || '';
  // 동적 unavailableTimes 생성
  const unavailableTimes = {};
  const timeOptions = JSON.parse(getProp_(CONFIG.PROP_KEYS.TIME_OPTIONS) || 'null') || CONFIG.DEFAULTS.TIME_OPTIONS;
  timeOptions.forEach(option => {
    const propKey = `UNAVAILABLE_${option.id}`;
    if (CONFIG.PROP_KEYS[propKey]) {
      unavailableTimes[`unavailable${option.id}`] = getProp_(CONFIG.PROP_KEYS[propKey]) === 'true';
    } else {
      // 새로운 시간 옵션에 대한 프로퍼티 키가 없는 경우 기본값 false
      unavailableTimes[`unavailable${option.id}`] = false;
    }
  });

  // 동적 설정 불러오기
  const votingDescription = getProp_(CONFIG.PROP_KEYS.VOTING_DESCRIPTION) || CONFIG.DEFAULTS.VOTING_DESCRIPTION;
  const votingTitle = getProp_(CONFIG.PROP_KEYS.VOTING_TITLE) || CONFIG.DEFAULTS.VOTING_TITLE;
  const allowAllAvailable = getProp_(CONFIG.PROP_KEYS.ALLOW_ALL_AVAILABLE) === 'true';
  const universityList = JSON.parse(getProp_(CONFIG.PROP_KEYS.UNIVERSITY_LIST) || 'null') || CONFIG.DEFAULTS.UNIVERSITY_LIST;

  if (e && e.parameter && e.parameter.format === 'csv') {
    const header = ['순번','소속학교','성명','학번','9시 불가','10시 불가','11시 불가','12시 불가','제출시각'];
    const makeRow = v => [
      v.number,
      `"${v.school}"`,
      `"${admin ? v.name : maskName_(v.name)}"`,
      admin ? v.studentId : maskId_(v.studentId),
      v.unavailable9 ? 'X' : '',
      v.unavailable10 ? 'X' : '',
      v.unavailable11 ? 'X' : '',
      v.unavailable12 ? 'X' : '',
      v.timestamp
    ].join(',');
    const csv = [header.join(',')].concat(rows.map(makeRow)).join('\n');
    return ContentService.createTextOutput('\uFEFF'+csv).setMimeType(ContentService.MimeType.CSV);
  }

  return _json({
    ok: true,
    data: rows,
    settings: {
      voteStartDate,
      voteEndDate,
      voteStartTime,
      voteEndTime,
      unavailableTimes,
      votingDescription,
      votingTitle,
      timeOptions,
      allowAllAvailable,
      universityList
    }
  });
}

function doPost(e) {
  // CORS 헤더 추가
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };

  // OPTIONS 요청 처리 (CORS preflight)
  if (e && e.parameter && e.parameter.method === 'OPTIONS') {
    return ContentService
      .createTextOutput('')
      .setMimeType(ContentService.MimeType.TEXT)
      .setHeaders(corsHeaders);
  }

  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const sh = _getSheet_();

    if (body.action === 'clear') {
      if (!isAdmin_(e && (e.parameter.apiKey || body.apiKey))) {
        return _json({ ok:false, message:'unauthorized' });
      }
      if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow()-1);
      return _json({ ok: true, message: 'cleared' });
    }

    if (body.action === 'update_settings') {
      if (!isAdmin_(e && (e.parameter.apiKey || body.apiKey))) {
        return _json({ ok:false, message:'unauthorized' });
      }
      const props = PropertiesService.getScriptProperties();
      if (body.settings) {
        if (body.settings.voteStartDate !== undefined) props.setProperty(CONFIG.PROP_KEYS.VOTE_START_DATE, body.settings.voteStartDate || '');
        if (body.settings.voteEndDate !== undefined) props.setProperty(CONFIG.PROP_KEYS.VOTE_END_DATE, body.settings.voteEndDate || '');
        if (body.settings.voteStartTime !== undefined) props.setProperty(CONFIG.PROP_KEYS.VOTE_START_TIME, body.settings.voteStartTime || '');
        if (body.settings.voteEndTime !== undefined) props.setProperty(CONFIG.PROP_KEYS.VOTE_END_TIME, body.settings.voteEndTime || '');
        if (body.settings.unavailableTimes) {
          // 동적으로 시간 옵션에 맞는 프로퍼티 키 생성
          Object.entries(body.settings.unavailableTimes).forEach(([key, value]) => {
            const propKey = `UNAVAILABLE_${key.replace('unavailable', '')}`;
            if (CONFIG.PROP_KEYS[propKey]) {
              props.setProperty(CONFIG.PROP_KEYS[propKey], value ? 'true' : 'false');
            } else {
              // 새로운 시간 옵션에 대한 프로퍼티 키 생성
              CONFIG.PROP_KEYS[propKey] = propKey;
              props.setProperty(propKey, value ? 'true' : 'false');
            }
          });
        }
        if (body.settings.votingDescription !== undefined) props.setProperty(CONFIG.PROP_KEYS.VOTING_DESCRIPTION, body.settings.votingDescription);
        if (body.settings.votingTitle !== undefined) props.setProperty(CONFIG.PROP_KEYS.VOTING_TITLE, body.settings.votingTitle);
        if (body.settings.timeOptions !== undefined) props.setProperty(CONFIG.PROP_KEYS.TIME_OPTIONS, JSON.stringify(body.settings.timeOptions));
        if (body.settings.allowAllAvailable !== undefined) props.setProperty(CONFIG.PROP_KEYS.ALLOW_ALL_AVAILABLE, body.settings.allowAllAvailable ? 'true' : 'false');
        if (body.settings.universityList !== undefined) props.setProperty(CONFIG.PROP_KEYS.UNIVERSITY_LIST, JSON.stringify(body.settings.universityList));
      }
      return _json({ ok: true, message: 'settings updated' });
    }

    if (body.action === 'create') {
      // Validation
      if (!body.studentId || !/^[A-Za-z0-9-_]{5,20}$/.test(body.studentId)) throw new Error('학번 형식 오류');
      if (!body.name || !/^[가-힣a-zA-Z\s]{2,30}$/.test(body.name)) throw new Error('성명 형식 오류');
      if (!body.school || typeof body.school !== 'string' || !body.school.trim()) throw new Error('소속학교 누락');

      // 동적 시간 옵션 검증
      const allowAllAvailable = getProp_(CONFIG.PROP_KEYS.ALLOW_ALL_AVAILABLE) === 'true';
      const timeOptions = JSON.parse(getProp_(CONFIG.PROP_KEYS.TIME_OPTIONS) || 'null') || CONFIG.DEFAULTS.TIME_OPTIONS;

      // 선택된 시간들 검증
      const selectedTimes = body.selectedTimes || [];
      const hasUnavailable = Object.keys(body).some(key => key.startsWith('unavailable') && body[key]);

      if (!allowAllAvailable && !hasUnavailable && selectedTimes.length === 0) {
        throw new Error('불가능 시간 1개 이상 선택하거나 모든 시간 가능을 선택하세요.');
      }

      // Duplicate prevention
      const last = sh.getLastRow();
      const ids = last > 1 ? sh.getRange(2,5,last-1,1).getValues().flat() : [];
      for (let i=0;i<ids.length;i++) {
        if ((ids[i]||'').toString() === body.studentId.toString()) {
          return _json({ ok:false, message:'이미 제출된 학번입니다. 수정은 관리자에게 문의하세요.' });
        }
      }

      // Sequence
      let seq = 1;
      if (last > 1) {
        const seqs = sh.getRange(2,2,last-1,1).getValues().flat().map(v => parseInt(v,10) || 0);
        seq = Math.max(...seqs, 0) + 1;
      }

      // 동적 시간 데이터 생성
      const timeData = timeOptions.map(option => {
        const key = `unavailable${option.id}`;
        return !!body[key];
      });

      const row = [
        body.timestamp || new Date().toISOString(),
        seq,
        body.school.trim(),
        body.name.trim(),
        body.studentId.trim(),
        ...timeData
      ];
      sh.appendRow(row);
      return _json({ ok: true, number: seq });
    }

    return _json({ ok:false, message:'unknown action' });
  } catch (err) {
    return _json({ ok:false, message: err.message || 'error' });
  }
}
