// --- Supabase & Global State ---
const SUPABASE_URL = 'https://rpwkwdkbwmunamgemvpl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwd2t3ZGtid211bmFtZ2VtdnBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNjcyNzYsImV4cCI6MjA4OTc0MzI3Nn0.YGtOkMigwXm0Q__3Ip4n_S8mVU1EijqRFGLIu0zSChw';
let supabase = null;
try {
    if (window.supabase && window.supabase.createClient) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
} catch(e) {
    console.error('Supabase init error:', e);
}

let appState = {
    settings: { users: [], pairings: [], questions: [] },
    sessions: [], history: [], currentUserId: null
};

window.loadData = async function() {
    try {
        if (!supabase) { console.error('Supabase not initialized'); return; }
        const [{data: users}, {data: pairings}, {data: sessions}, {data: history}, {data: questions}] = await Promise.all([
            supabase.from('users').select('*'),
            supabase.from('pairings').select('*'),
            supabase.from('sessions').select('*'),
            supabase.from('history').select('*').order('created_at', {ascending: false}),
            supabase.from('questions').select('*').order('order_index', {ascending: true})
        ]);
        appState.settings.users = (users || []).map(u => ({ id: u.id, name: u.name, isAdmin: u.is_admin, password: u.password }));
        appState.settings.pairings = (pairings || []).map(p => ({ id: p.id, managerId: p.manager_id, memberId: p.member_id, frequency: p.frequency }));
        appState.settings.questions = (questions || []).map(q => q.content);
        appState.sessions = (sessions || []).map(s => ({
            id: s.id, pairingId: s.pairing_id, date: s.date || '未定', time: s.time || '-', status: s.status, answers: s.answers || [], memberMemo: s.member_memo || '', managerMemo: s.manager_memo || ''
        }));
        appState.history = (history || []).map(h => ({
            id: h.id, pairingId: h.pairing_id, managerId: h.manager_id, memberId: h.member_id, date: h.date, time: h.time, qa: h.qa || [], memberMemo: h.member_memo || '', managerMemo: h.manager_memo || ''
        }));
    } catch(e) {
        console.error('Supabase Load Error:', e);
    }
};

function saveState() {
    showToast();
}

function getUser(id) {
    return appState.settings.users.find(u => u.id === id);
}
function getCurrentUser() {
    return getUser(appState.currentUserId);
}
function getPair(id) {
    return appState.settings.pairings.find(p => p.id === id);
}

// Convert full width to half width
function toHalfWidthMath(str) {
    return str.replace(/[０-９]/g, function(s) {
        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    });
}

// --- DOM Elements ---
const loginScreen = document.getElementById('loginScreen');
const appContainer = document.getElementById('appContainer');
const loginForm = document.getElementById('loginForm');
const loginUserSelect = document.getElementById('loginUserSelect');
const loginPassword = document.getElementById('loginPassword');
const logoutBtn = document.getElementById('logoutBtn');

const currentUserAvatar = document.getElementById('currentUserAvatar');
const currentUserName = document.getElementById('currentUserName');
const currentUserRoleText = document.getElementById('currentUserRole');

const navItems = document.querySelectorAll('.nav-item');
const dashboardView = document.getElementById('dashboardView');
const historyView = document.getElementById('historyView');
const adminView = document.getElementById('adminView');
const pageTitle = document.getElementById('pageTitle');
const navAdmin = document.getElementById('navAdmin');

const adminEmpList = document.getElementById('adminEmpList');
const newEmpName = document.getElementById('newEmpName');
const newEmpIsAdmin = document.getElementById('newEmpIsAdmin');
const addEmpBtn = document.getElementById('addEmpBtn');

const adminPairList = document.getElementById('adminPairList');
const newPairManager = document.getElementById('newPairManager');
const newPairMember = document.getElementById('newPairMember');
const addPairBtn = document.getElementById('addPairBtn');

const adminQuestionList = document.getElementById('adminQuestionList');
const newQuestionInput = document.getElementById('newQuestionInput');
const addQuestionBtn = document.getElementById('addQuestionBtn');

const passwordModal = document.getElementById('passwordModal');
const adminPasswordInput = document.getElementById('adminPasswordInput');
const cancelPwdBtn = document.getElementById('cancelPwdBtn');
const submitPwdBtn = document.getElementById('submitPwdBtn');

const editEmpModal = document.getElementById('editEmpModal');
const editEmpId = document.getElementById('editEmpId');
const editEmpNameInput = document.getElementById('editEmpNameInput');
const editEmpIsAdminCheck = document.getElementById('editEmpIsAdminCheck');
const cancelEditEmpBtn = document.getElementById('cancelEditEmpBtn');
const saveEditEmpBtn = document.getElementById('saveEditEmpBtn');

// --- Boot Logic ---
async function bootApp() {
    try {
        if (window.supabase) {
            await window.loadData();
        } else {
            console.error('Supabase not loaded');
        }
    } catch(e) {
        console.error('Boot error:', e);
    } finally {
        // 必ずローディング画面を消す
        const ls = document.getElementById('loadingScreen');
        if (ls) ls.style.display = 'none';
    }

    loginUserSelect.innerHTML = appState.settings.users.map(u => 
        `<option value="${u.id}">${u.name}</option>`
    ).join('');

    appState.currentUserId = localStorage.getItem('1on1_currentUserId');
    if (appState.currentUserId && getCurrentUser()) {
        showApp();
    } else {
        showLogin();
    }
}

function showLogin() {
    loginScreen.classList.remove('hidden');
    appContainer.classList.add('hidden');
}

function showApp() {
    loginScreen.classList.add('hidden');
    appContainer.classList.remove('hidden');
    
    updateUserProfile();
    document.getElementById('navDashboard').click(); 
    renderAdmin(); 
}

// --- Login & Logout Logic ---
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const rawPwd = loginPassword.value.trim();
    const pwd = toHalfWidthMath(rawPwd);
    const selectedId = loginUserSelect.value;
    const user = getUser(selectedId);
    
    const expectedPwd = (user && user.password) ? user.password : '1234';

    if(pwd !== expectedPwd) {
        alert('パスワードが違います。');
        return;
    }
    appState.currentUserId = selectedId;
    localStorage.setItem('1on1_currentUserId', selectedId);
    loginPassword.value = '';
    showApp();
});

logoutBtn.addEventListener('click', () => {
    appState.currentUserId = null;
    localStorage.removeItem('1on1_currentUserId');
    showLogin();
});

// --- User Profile ---
function updateUserProfile() {
    const u = getCurrentUser();
    if(!u) return;

    currentUserName.textContent = u.name;
    currentUserAvatar.textContent = u.name.charAt(0) || 'U';
    
    if (u.isAdmin) {
        navAdmin.classList.remove('hidden');
        currentUserRoleText.textContent = 'システム管理者権限あり';
    } else {
        navAdmin.classList.add('hidden');
        currentUserRoleText.textContent = '一般メンバー';
    }
}

// --- Navigation ---
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.getAttribute('data-view');
        
        if(view === 'admin') {
            passwordModal.classList.remove('hidden');
            adminPasswordInput.value = '';
            adminPasswordInput.focus();
            return;
        }

        activateView(item, view);
    });
});

function activateView(navItemElement, viewName) {
    navItems.forEach(nav => nav.classList.remove('active'));
    if(navItemElement) navItemElement.classList.add('active');
    if(navItemElement) pageTitle.textContent = navItemElement.textContent.trim();

    dashboardView.classList.remove('active');
    historyView.classList.remove('active');
    adminView.classList.remove('active');

    if (viewName === 'dashboard') {
        dashboardView.classList.add('active');
        renderDashboard();
    } else if (viewName === 'history') {
        historyView.classList.add('active');
        document.getElementById('historyListContainer').classList.remove('hidden');
        document.getElementById('historyDetail').classList.add('hidden');
        renderHistory();
    } else if (viewName === 'admin') {
        adminView.classList.add('active');
        renderAdmin();
    }
}

// --- Password Modal Logic ---
cancelPwdBtn.addEventListener('click', () => {
    passwordModal.classList.add('hidden');
});

submitPwdBtn.addEventListener('click', () => {
    const pwdRaw = adminPasswordInput.value.trim();
    const pwd = toHalfWidthMath(pwdRaw);

    if(pwd === appState.settings.adminPassword) {
        passwordModal.classList.add('hidden');
        activateView(navAdmin, 'admin');
    } else {
        alert('パスワードが間違っています。(※共通パスワードは「123」です)');
    }
});
adminPasswordInput.addEventListener('keyup', (e) => {
    if(e.key === 'Enter') submitPwdBtn.click();
});

// --- Dashboard Logic ---
function renderDashboard() {
    const currentU = getCurrentUser();
    
    const memberSect = document.getElementById('memberSessionSection');
    const managerSect = document.getElementById('managerSessionsSection');
    const managerList = document.getElementById('managerSessionsList');
    const noPairs = document.getElementById('noPairsMessage');

    const myMemberSessions = appState.sessions.filter(s => {
        const p = getPair(s.pairingId);
        return p && p.memberId === currentU.id;
    });

    const myManagerSessions = appState.sessions.filter(s => {
        const p = getPair(s.pairingId);
        return p && p.managerId === currentU.id;
    });

    if(myMemberSessions.length === 0 && myManagerSessions.length === 0) {
        if(currentU.id === 'u_admin') {
            noPairs.classList.add('hidden');
        } else {
            noPairs.classList.remove('hidden');
        }
        memberSect.classList.add('hidden');
        managerSect.classList.add('hidden');
    } else {
        noPairs.classList.add('hidden');

        if(myMemberSessions.length > 0) {
            memberSect.classList.remove('hidden');
            memberSect.innerHTML = `<h3 style="margin-bottom: 24px; font-weight: 700; color: var(--text-main);">あなたが受ける1on1（メンバーとして）</h3>` + 
                myMemberSessions.map(s => renderSessionCard(s, 'member')).join('');
        } else {
            memberSect.classList.add('hidden');
        }

        if(myManagerSessions.length > 0) {
            managerSect.classList.remove('hidden');
            managerList.innerHTML = myManagerSessions.map(s => renderSessionCard(s, 'manager')).join('');
        } else {
            managerSect.classList.add('hidden');
        }
    }

    const adminSect = document.getElementById('adminProgressSection');
    const adminList = document.getElementById('adminProgressList');
    if (adminSect && adminList) {
        if(currentU.id === 'u_admin') {
            adminSect.classList.remove('hidden');
            renderAdminProgress(adminList);
        } else {
            adminSect.classList.add('hidden');
        }
    }
}

function renderAdminProgress(container) {
    if(appState.settings.pairings.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);">設定されているペアがありません。</p>';
        return;
    }
    const htmls = appState.settings.pairings.map(p => {
        const m1 = getUser(p.managerId);
        const m2 = getUser(p.memberId);
        let freqText = '月1回';
        if(p.frequency) {
            const parts = p.frequency.split('_');
            if(parts.length === 2) {
                const t = parts[0] === 'weekly' ? '週' : '月';
                freqText = `${t}${parts[1]}回`;
            }
        }
        
        const activeSess = appState.sessions.find(s => s.pairingId === p.id);
        const activeStatus = activeSess ? (activeSess.status === 'ready' ? '実施待機中' : 'メンバー準備中') : '-';
        const plannedDate = (activeSess && activeSess.date && activeSess.date !== '未定') ? activeSess.date.replace(/-/g, '/') : '未定';
        
        const compStatus = getPairCompletionStatus(p.id, p.frequency);

        return `
            <div style="background:var(--bg-card); padding:16px; border-radius:8px; border:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; transition:all 0.2s;" onmouseover="this.style.borderColor='#D1D5DB'" onmouseout="this.style.borderColor='var(--border)'">
                <div style="flex:1; min-width:280px;">
                    <h4 style="margin:0 0 6px 0; font-size:1.05rem; color:var(--text-main);">${m1?.name} <span style="font-size:0.85rem; color:var(--text-muted); font-weight:normal;">(上長)</span> × ${m2?.name} <span style="font-size:0.85rem; color:var(--text-muted); font-weight:normal;">(メンバー)</span> <span class="tag" style="margin-left:8px; background-color:#F3E8FF; color:#7E22CE;">${freqText}</span></h4>
                    <div style="font-size:0.85rem; display:flex; gap:16px; color:var(--text-muted);">
                        <span>ステータス: ${activeStatus}</span>
                        <span>次回予定: ${plannedDate}</span>
                    </div>
                </div>
                <div style="text-align:right;">
                    <span style="font-size:0.95rem; font-weight:600;"><span class="status-dot ${compStatus.class}"></span> ${compStatus.text}</span>
                </div>
            </div>
        `;
    });
    container.innerHTML = htmls.join('');
}

function getPairCompletionStatus(pairId, frequency) {
    if(!frequency) frequency = 'monthly_1';
    const parts = frequency.split('_');
    const type = parts[0] || 'monthly';
    const requiredCount = parseInt(parts[1] || '1', 10);
    
    let completedCount = 0;
    const pairHistory = appState.history.filter(h => h.pairingId === pairId);
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    pairHistory.forEach(h => {
        const dParts = h.date.split('/');
        if(dParts.length === 3) {
            let hYear = parseInt(dParts[0], 10);
            let hMonth = parseInt(dParts[1], 10);
            let hDay = parseInt(dParts[2], 10);
            
            if(type === 'monthly') {
                if(hYear === currentYear && hMonth === currentMonth) {
                    completedCount++;
                }
            } else if(type === 'weekly') {
                const hDate = new Date(hYear, hMonth - 1, hDay);
                const d = new Date();
                const day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1);
                const monday = new Date(d.setDate(diff));
                monday.setHours(0,0,0,0);
                if(hDate >= monday) {
                    completedCount++;
                }
            }
        }
    });

    const periodText = type === 'monthly' ? '今月' : '今週';
    if(completedCount >= requiredCount) {
        return { isCompleted: true, text: `${periodText}達成 (${completedCount}/${requiredCount})`, class: 'completed' };
    } else {
        return { isCompleted: false, text: `${periodText}未完了 (${completedCount}/${requiredCount})`, class: 'pending' };
    }
}

window.toggleSessionDetail = function(id) {
    const el = document.getElementById(`session_item_${id}`);
    const detail = document.getElementById(`session_detail_${id}`);
    if(el && detail) {
        el.classList.toggle('expanded');
        detail.classList.toggle('hidden');
    }
};

window.updateSessionDate = async function(id, val) {
    await supabase.from('sessions').update({ date: val }).eq('id', id);
    await window.loadData();
    const span = document.getElementById(`scheduled_date_text_${id}`);
    if(span) span.innerText = `予定: ${val ? val.replace(/-/g, '/') : '未定'}`;
};

function renderSessionCard(session, roleViewing) {
    const pair = getPair(session.pairingId);
    if(!pair) return '';
    const mngr = getUser(pair.managerId);
    const mmbr = getUser(pair.memberId);
    if(!mngr || !mmbr) return '';

    const isPending = session.status === 'pending';
    const activeColor = isPending ? 'pending' : 'ready';
    const activeText = isPending ? 'トピック準備中' : '実施準備完了';
    
    const compStatus = getPairCompletionStatus(pair.id, pair.frequency);

    let contentHtml = '';

    if (isPending) {
        if (roleViewing === 'member') {
            const inputs = appState.settings.questions.map((q, i) => `
                <div class="question-block">
                    <label>${i + 1}. ${q}</label>
                    <textarea class="premium-input" id="qa_${session.id}_${i}" rows="2" placeholder="回答を入力...">${session.answers[i] || ''}</textarea>
                </div>
            `).join('');
            contentHtml = `
                <div class="topic-section" style="padding:0; border:none;">
                    <h4 style="margin-top:16px;">事前に準備する質問・トピック</h4>
                    <p class="help-text">面談を実りあるものにするため、事前に回答を記入してください。</p>
                    ${inputs}
                    <div class="form-actions"><button class="btn btn-primary premium-btn" onclick="submitTopics('${session.id}')">上長に申請する</button></div>
                </div>
            `;
        } else {
            contentHtml = `
                <div class="topic-section" style="padding:0; border:none;">
                    <h4 style="margin-top:16px;">事前提出トピック</h4>
                    <div class="topic-content" style="background:var(--bg-main);"><em style="color:#9ca3af">${mmbr.name}さんのトピック提出（回答）を待っています...</em></div>
                </div>
            `;
        }
    } else {
        const qaHtml = appState.settings.questions.map((q, i) => `
            <div class="question-block">
                <label>${i + 1}. ${q}</label>
                <div class="answer-display">${session.answers[i] || '<em style="color:#9ca3af">回答なし</em>'}</div>
            </div>
        `).join('');

        const memoVal = roleViewing === 'member' ? session.memberMemo : session.managerMemo;

        contentHtml = `
            <div class="topic-section" style="padding:0; border:none;">
                <h4 style="margin-top:16px;">事前提出トピック</h4>
                <div class="topic-content" style="background: transparent; border:none; padding:0;">${qaHtml}</div>
            </div>
            <div class="topic-section" style="padding:0; border:none; margin-top:24px;">
                <h4>あなたのプライベートメモ (${roleViewing === 'member' ? 'メンバー' : '上長'})</h4>
                <p class="help-text">※このメモはあなたしか見ることができません。相手には非公開です。</p>
                <textarea class="premium-input" id="memo_${session.id}" rows="3" placeholder="備忘録を入力...">${memoVal}</textarea>
                <div class="form-actions space-between" style="margin-top:16px;">
                    <button class="btn btn-secondary" onclick="saveMemo('${session.id}', '${roleViewing}')">メモを保存</button>
                    ${roleViewing === 'manager' ? `<button class="btn btn-success premium-btn" style="background:linear-gradient(135deg, #10B981, #059669);" onclick="finishSession('${session.id}')">1on1を完了する</button>` : ''}
                </div>
            </div>
        `;
    }

    const dateInputHtml = `
        <div style="margin-bottom: 24px;">
            <label style="font-weight:600; font-size:0.9rem; display:block; margin-bottom:8px;">1on1 実施予定日</label>
            <input type="date" class="schedule-date-input" value="${session.date === '未定' || !session.date ? '' : session.date.replace(/\//g, '-')}" onchange="updateSessionDate('${session.id}', this.value)">
        </div>
    `;

    return `
        <div class="session-list-item" id="session_item_${session.id}">
            <div class="session-list-header" onclick="toggleSessionDetail('${session.id}')">
                <div class="session-basic-info">
                    <h4>${roleViewing === 'member' ? mngr.name + ' <span style="font-size:0.8rem; font-weight:normal; color:var(--text-muted);">上長</span>' : mmbr.name + ' <span style="font-size:0.8rem; font-weight:normal; color:var(--text-muted);">メンバー</span>'}</h4>
                </div>
                <div class="session-status-info">
                    <span id="scheduled_date_text_${session.id}" style="color:var(--text-muted);">予定: ${session.date !== '未定' && session.date ? session.date.replace(/-/g, '/') : '未定'}</span>
                    <span style="font-size:0.85rem;"><span class="status-dot ${compStatus.class}"></span> ${compStatus.text}</span>
                    <span style="font-size:0.85rem;"><span class="status-dot ${activeColor}" style="margin-left:8px;"></span> ${activeText}</span>
                    <div class="expand-icon">▼</div>
                </div>
            </div>
            <div class="session-list-detail hidden" id="session_detail_${session.id}" onclick="event.stopPropagation()">
                ${dateInputHtml}
                ${contentHtml}
            </div>
        </div>
    `;
}

window.submitTopics = async function(sessionId) {
    const session = appState.sessions.find(s => String(s.id) === String(sessionId));
    if(!session) return;
    const newAnswers = [];
    appState.settings.questions.forEach((q, i) => {
        const el = document.getElementById(`qa_${sessionId}_${i}`);
        if(el) newAnswers.push(el.value.trim());
    });
    if(newAnswers.every(a => a === '')) {
        alert("少なくとも1つの質問に回答してください");
        return;
    }
    await supabase.from('sessions').update({ answers: newAnswers, status: 'ready' }).eq('id', sessionId);
    await window.loadData();
    renderDashboard();
};

window.saveMemo = async function(sessionId, role) {
    const session = appState.sessions.find(s => String(s.id) === String(sessionId));
    if(!session) return;
    const el = document.getElementById(`memo_${sessionId}`);
    if(el) {
        const updateObj = {};
        if (role === 'member') updateObj.member_memo = el.value;
        if (role === 'manager') updateObj.manager_memo = el.value;
        await supabase.from('sessions').update(updateObj).eq('id', sessionId);
    }
};

window.finishSession = async function(sessionId, role) {
    if(confirm('1on1を完了して記録しますか？')) {
        await window.saveMemo(sessionId, role);
        await window.loadData();
        const sessionIndex = appState.sessions.findIndex(s => String(s.id) === String(sessionId));
        const session = appState.sessions[sessionIndex];
        if(!session) return;
        
        const finalQA = appState.settings.questions.map((q, i) => ({
            question: q,
            answer: session.answers[i] || ""
        }));
        
        const pair = getPair(session.pairingId);

        const completedSession = {
            pairing_id: session.pairingId,
            manager_id: pair ? pair.managerId : null,
            member_id: pair ? pair.memberId : null,
            date: new Date().toLocaleDateString('ja-JP'),
            time: "完了",
            qa: finalQA,
            member_memo: session.memberMemo,
            manager_memo: session.managerMemo
        };

        await supabase.from('history').insert(completedSession);
        
        await supabase.from('sessions').update({
            status: 'pending',
            date: '未定',
            time: '-',
            answers: [],
            member_memo: '',
            manager_memo: ''
        }).eq('id', sessionId);

        await window.loadData();
        alert('アーカイブに保存しました！');
        renderDashboard();
    }
}

// --- History Logic ---
function renderHistory() {
    const currentU = getCurrentUser();
    const visibleHistory = appState.history.filter(h => {
        const p = getPair(h.pairingId);
        const pManager = h.managerId || (p ? p.managerId : null);
        const pMember = h.memberId || (p ? p.memberId : null);
        
        if(currentU.id === 'u_admin') return true; 
        return pManager === currentU.id || pMember === currentU.id;
    });

    const list = document.getElementById('historyListContainer');
    if (visibleHistory.length === 0) {
        list.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius); border: 1px dashed var(--border);">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 16px; display: block; opacity: 0.5;"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            閲覧可能な過去の記録がありません。
        </div>
        `;
        return;
    }

    list.innerHTML = visibleHistory.map(item => {
        const p = getPair(item.pairingId);
        const pManager = item.managerId || (p ? p.managerId : null);
        const pMember = item.memberId || (p ? p.memberId : null);
        
        const mngr = getUser(pManager);
        const mmbr = getUser(pMember);
        
        const mngrName = mngr ? mngr.name : '削除済ユーザー';
        const mmbrName = mmbr ? mmbr.name : '削除済ユーザー';
        const mainTopic = (item.qa && item.qa[0] && item.qa[0].answer) ? item.qa[0].answer : "トピックなし";
        
        return `
        <div class="history-item" onclick="viewHistoryDetail(${item.id})">
            <div class="history-info">
                <div class="history-date">${item.date}</div>
                <div class="history-tags">
                    <span class="tag" style="background-color:#E0F2FE; color:#0369A1;">${mngrName} × ${mmbrName}</span>
                </div>
                <div style="font-size: 0.875rem; color: var(--text-muted); max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${mainTopic}
                </div>
            </div>
            <div class="history-action">詳細を見る →</div>
        </div>
        `;
    }).join('');
}

window.viewHistoryDetail = function(id) {
    const session = appState.history.find(s => String(s.id) === String(id));
    if (!session) return;
    
    const p = getPair(session.pairingId);
    const pManager = session.managerId || (p ? p.managerId : null);
    const pMember = session.memberId || (p ? p.memberId : null);
    
    const mngr = getUser(pManager);
    const mmbr = getUser(pMember);
    const mngrName = mngr ? mngr.name : '削除済ユーザー';
    const mmbrName = mmbr ? mmbr.name : '削除済ユーザー';

    const isMember = pMember === appState.currentUserId;
    const isManager = pManager === appState.currentUserId;

    let qaHTML = (session.qa || []).map((item, idx) => `
        <div class="question-block">
            <label>${idx + 1}. ${item.question}</label>
            <div class="answer-display">${item.answer || '<em style="color:#9ca3af">回答なし</em>'}</div>
        </div>
    `).join('');

    let memoHtml = '';
    if(isMember) memoHtml = `<div class="topic-content" style="background-color: #FDF4FF; border-left-color: #D946EF;">${session.memberMemo || 'メモなし'}</div>`;
    else if(isManager) memoHtml = `<div class="topic-content" style="background-color: #FDF4FF; border-left-color: #D946EF;">${session.managerMemo || 'メモなし'}</div>`;
    else memoHtml = `<div class="topic-content" style="background-color: #F3F4F6;">権限により非表示です。</div>`;

    document.getElementById('historyDetailCard').innerHTML = `
        <div class="session-header">
                <h3>${session.date} (${mngrName} × ${mmbrName})</h3>
            </div>
            ${appState.currentUserId === 'u_admin' || isManager ? `<button class="delete-btn" onclick="deleteHistory('${session.id}')" style="padding: 6px 12px; font-size: 0.85rem;">削除</button>` : ''}
        </div>
        <div class="topic-section">
            <h4>QAログ</h4>
            <div class="topic-content" style="background: transparent; border:none; padding:0;">${qaHTML}</div>
        </div>
        <div class="topic-section">
            <h4>あなたのプライベートメモ</h4>
            ${memoHtml}
        </div>
    `;

    document.getElementById('historyListContainer').classList.add('hidden');
    document.getElementById('historyDetail').classList.remove('hidden');
};

window.deleteHistory = function(id) {
    if(confirm('この1on1記録を完全に削除しますか？')) {
        appState.history = appState.history.filter(h => String(h.id) !== String(id));
        saveState();
        document.getElementById('backToHistoryBtn').click();
        renderHistory();
    }
};

document.getElementById('backToHistoryBtn').addEventListener('click', () => {
    document.getElementById('historyListContainer').classList.remove('hidden');
    document.getElementById('historyDetail').classList.add('hidden');
});

// --- Admin ---
function renderAdmin() {
    adminEmpList.innerHTML = appState.settings.users.map(u => `
        <li class="admin-list-item">
            <span>${u.name} ${u.isAdmin ? '<span class="tag" style="background:#FEF3C7; color:#B45309; margin-left:8px;">管理者</span>' : ''}</span>
            <div style="display:flex; gap:8px;">
                <button class="btn btn-secondary" style="padding:4px 8px; font-size:0.8rem;" onclick="openEditEmpModal('${u.id}')">編集</button>
                <button class="btn btn-secondary" style="padding:4px 8px; font-size:0.8rem;" onclick="changeUserPassword('${u.id}')">パスワード設定</button>
                ${u.id !== 'u_admin' ? `<button class="delete-btn" onclick="deleteEmp('${u.id}')">削除</button>` : ''}
            </div>
        </li>
    `).join('');

    const opts = appState.settings.users.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    newPairManager.innerHTML = opts;
    newPairMember.innerHTML = opts;

    adminPairList.innerHTML = appState.settings.pairings.map(p => {
        const m1 = getUser(p.managerId);
        const m2 = getUser(p.memberId);
        let freqText = '月1回';
        if(p.frequency) {
            const parts = p.frequency.split('_');
            if(parts.length === 2) {
                const t = parts[0] === 'weekly' ? '週' : '月';
                freqText = `${t}${parts[1]}回`;
            }
        }
        return `
        <li class="admin-list-item">
            <span><strong>${m1?.name}</strong> (上長) × <strong>${m2?.name}</strong> (メンバー) <span class="tag" style="margin-left:8px; background-color:#F3E8FF; color:#7E22CE;">${freqText}</span></span>
            <button class="delete-btn" onclick="deletePair(${p.id})">削除</button>
        </li>
        `;
    }).join('');

    adminQuestionList.innerHTML = appState.settings.questions.map((q, index) => `
        <li class="admin-list-item">
            <span>${index + 1}. ${q}</span>
            <div style="display:flex; gap:8px;">
                <button class="btn btn-secondary" style="padding:4px 8px; font-size:0.8rem;" onclick="editQuestion(${index})">編集</button>
                <button class="delete-btn" onclick="deleteQuestion(${index})">削除</button>
            </div>
        </li>
    `).join('');
}

addEmpBtn.addEventListener('click', async () => {
    const val = newEmpName.value.trim();
    if(!val) return;
    const newU = { id: 'u_' + Date.now(), name: val, is_admin: newEmpIsAdmin.checked, password: '1234' };
    await supabase.from('users').insert(newU);
    newEmpName.value = '';
    newEmpIsAdmin.checked = false;
    await window.loadData();
    loginUserSelect.innerHTML = appState.settings.users.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    renderAdmin();
});

window.deleteEmp = async function(id) {
    if(confirm('社員を削除しますか？関連するペアも削除されますが、過去の1on1記録は残ります。')) {
        await supabase.from('users').delete().eq('id', id);
        if(appState.currentUserId === id) {
             appState.currentUserId = null;
             localStorage.removeItem('1on1_currentUserId');
             window.location.reload();
        }
        await window.loadData();
        renderAdmin();
    }
}

window.openEditEmpModal = function(id) {
    const u = getUser(id);
    if(!u) return;
    editEmpId.value = u.id;
    editEmpNameInput.value = u.name;
    if(u.id === 'u_admin') {
        editEmpIsAdminCheck.checked = true;
        editEmpIsAdminCheck.disabled = true;
    } else {
        editEmpIsAdminCheck.checked = u.isAdmin;
        editEmpIsAdminCheck.disabled = false;
    }
    editEmpModal.classList.remove('hidden');
    editEmpNameInput.focus();
};

if(cancelEditEmpBtn) {
    cancelEditEmpBtn.addEventListener('click', () => {
        editEmpModal.classList.add('hidden');
    });
}

if(saveEditEmpBtn) {
    saveEditEmpBtn.addEventListener('click', async () => {
        const id = editEmpId.value;
        const u = getUser(id);
        if(!u) return;
        const newName = editEmpNameInput.value.trim();
        if(!newName) return;
        
        let isAdminVal = u.isAdmin;
        if(u.id !== 'u_admin') {
            isAdminVal = editEmpIsAdminCheck.checked;
        }
        
        await supabase.from('users').update({ name: newName, is_admin: isAdminVal }).eq('id', id);
        
        if(appState.currentUserId === u.id) {
            updateUserProfile(); 
            if(!isAdminVal && appState.currentUserId !== 'u_admin') {
                window.location.reload();
            }
        }
        
        editEmpModal.classList.add('hidden');
        await window.loadData();
        
        loginUserSelect.innerHTML = appState.settings.users.map(user => 
            `<option value="${user.id}">${user.name}</option>`
        ).join('');
        
        renderAdmin();
    });
}

addPairBtn.addEventListener('click', async () => {
    const managerId = newPairManager.value;
    const memberId = newPairMember.value;
    const type = document.getElementById('newPairFreqType').value || 'monthly';
    const count = document.getElementById('newPairFreqCount').value || '1';
    const frequency = `${type}_${count}`;
    if(managerId === memberId) {
        alert('同じユーザーでペアは組めません。'); return;
    }
    const { data: newPair, error } = await supabase.from('pairings').insert({
        manager_id: managerId, member_id: memberId, frequency: frequency
    }).select().single();
    if (newPair) {
        await supabase.from('sessions').insert({
            pairing_id: newPair.id, status: 'pending', date: '未定', time: '-', answers: [], member_memo: '', manager_memo: ''
        });
    }
    await window.loadData();
    renderAdmin();
});

window.deletePair = async function(id) {
    if(confirm("ペアを削除しますか？")) {
        await supabase.from('pairings').delete().eq('id', id);
        await window.loadData();
        renderAdmin();
    }
}

async function syncQuestions() {
    await supabase.from('questions').delete().neq('id', -1);
    const inserts = appState.settings.questions.map((q, i) => ({ content: q, order_index: i }));
    if(inserts.length > 0) {
        await supabase.from('questions').insert(inserts);
    }
    await window.loadData();
    renderAdmin();
}

addQuestionBtn.addEventListener('click', async () => {
    const val = newQuestionInput.value.trim();
    if(!val) return;
    appState.settings.questions.push(val);
    newQuestionInput.value = '';
    await syncQuestions();
});

window.deleteQuestion = async function(index) {
    if(confirm("質問を削除しますか？")) {
        appState.settings.questions.splice(index, 1);
        await syncQuestions();
    }
}

window.editQuestion = async function(index) {
    const currentQ = appState.settings.questions[index];
    const newQ = prompt("質問内容を編集してください:", currentQ);
    if(newQ !== null && newQ.trim() !== "") {
        appState.settings.questions[index] = newQ.trim();
        await syncQuestions();
    }
}

window.changeUserPassword = async function(id) {
    const u = getUser(id);
    if(!u) return;
    const newPwd = prompt(`${u.name}さんの新しいパスワードを入力してください:`, u.password || '1234');
    if(newPwd !== null && newPwd.trim() !== '') {
        await supabase.from('users').update({ password: newPwd.trim() }).eq('id', id);
        await window.loadData();
        alert('パスワードを変更しました。');
    }
}

function showToast() {
    const toast = document.getElementById('toast');
    if(!toast) return;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

// Boot application
bootApp();
