// api/gist.js
const GIST_FILE_NAME = 'todo.json';
const GIST_DESCRIPTION = 'ToDoWeb2 Cloud Sync';

function send(res, status, payload) {
    res.status(status).json(payload);
}

function isValidState(state) {
    if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
    if (state.schemaVersion !== 1) return false;
    if (!Number.isSafeInteger(state.updatedAt) || state.updatedAt < 0) return false;

    const todos = state.todos;
    if (!todos || typeof todos !== 'object' || Array.isArray(todos)) return false;
    if (Object.keys(todos).some(key => !['1', '2', '3'].includes(key))) return false;
    for (const tab of ['1', '2', '3']) {
        if (!Array.isArray(todos[tab])) return false;
        for (const item of todos[tab]) {
            if (!item || typeof item.text !== 'string' || !item.text.trim() || typeof item.isDone !== 'boolean') {
                return false;
            }
        }
    }

    const notes = state.notes;
    if (!notes || typeof notes !== 'object' || Array.isArray(notes)) return false;
    if (Object.keys(notes).some(key => !['4', '5'].includes(key))) return false;
    for (const tab of ['4', '5']) {
        if (typeof notes[tab] !== 'string') return false;
    }

    return true;
}

async function githubFetch(path, token, options = {}) {
    const response = await fetch(`https://api.github.com${path}`, {
        ...options,
        headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = data?.message || `GitHub API 오류 (HTTP ${response.status})`;
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }
    return data;
}

async function findGist(token, configuredGistId) {
    if (configuredGistId) {
        const gist = await githubFetch(`/gists/${encodeURIComponent(configuredGistId)}`, token);
        return gist;
    }

    for (let page = 1; page <= 10; page++) {
        const gists = await githubFetch(`/gists?per_page=100&page=${page}`, token);
        const found = gists.find(gist =>
            gist.description === GIST_DESCRIPTION &&
            gist.files &&
            gist.files[GIST_FILE_NAME]
        );
        if (found) return found;
        if (gists.length < 100) break;
    }

    return null;
}

async function readGistState(gist, token) {
    if (!gist) return null;

    let file = gist.files?.[GIST_FILE_NAME];
    if (!file) return null;

    let content = file.content;
    if (file.truncated && file.raw_url) {
        const rawResponse = await fetch(file.raw_url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!rawResponse.ok) {
            const error = new Error(`Gist 파일 읽기 오류 (HTTP ${rawResponse.status})`);
            error.status = rawResponse.status;
            throw error;
        }
        content = await rawResponse.text();
    }

    try {
        const state = JSON.parse(content);
        if (!isValidState(state)) {
            const error = new Error('Gist의 todo.json 데이터 구조가 올바르지 않습니다.');
            error.status = 422;
            throw error;
        }
        return state;
    } catch (error) {
        if (error.status) throw error;
        const parseError = new Error('Gist의 todo.json을 JSON으로 읽을 수 없습니다.');
        parseError.status = 422;
        throw parseError;
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return send(res, 405, { error: 'Method Not Allowed' });
    }

    const token = process.env.GITHUB_GIST_TOKEN;
    const syncKey = process.env.TODO_GIST_SYNC_KEY;
    const configuredGistId = process.env.TODO_GIST_ID || '';

    if (!token) {
        return send(res, 500, { error: 'Vercel 환경변수 GITHUB_GIST_TOKEN이 설정되지 않았습니다.' });
    }
    if (!syncKey) {
        return send(res, 500, { error: 'Vercel 환경변수 TODO_GIST_SYNC_KEY가 설정되지 않았습니다.' });
    }

    const providedKey = req.headers['x-todo-sync-key'];
    if (typeof providedKey !== 'string' || providedKey !== syncKey) {
        return send(res, 401, { error: '동기화 키가 올바르지 않습니다.' });
    }

    const action = req.body?.action;
    if (action !== 'load' && action !== 'save') {
        return send(res, 400, { error: '지원하지 않는 동기화 작업입니다.' });
    }

    try {
        let gist = await findGist(token, configuredGistId);

        if (action === 'load') {
            if (!gist) {
                return send(res, 404, { error: '아직 생성된 ToDoWeb2 Gist 저장소가 없습니다. 먼저 구름저장을 실행해주세요.' });
            }
            const state = await readGistState(gist, token);
            if (!state) {
                return send(res, 404, { error: 'Gist에서 todo.json을 찾을 수 없습니다.' });
            }
            return send(res, 200, {
                state,
                gistId: gist.id,
                updatedAt: state.updatedAt
            });
        }

        const state = req.body?.state;
        const force = req.body?.force === true;
        if (!isValidState(state)) {
            return send(res, 400, { error: '저장할 데이터 구조가 올바르지 않습니다.' });
        }

        if (gist) {
            const remoteState = await readGistState(gist, token);
            if (!force && remoteState && remoteState.updatedAt > state.updatedAt) {
                return send(res, 409, {
                    error: 'Gist에 더 최신 데이터가 있습니다.',
                    remoteUpdatedAt: remoteState.updatedAt
                });
            }

            const updated = await githubFetch(`/gists/${encodeURIComponent(gist.id)}`, token, {
                method: 'PATCH',
                body: JSON.stringify({
                    description: GIST_DESCRIPTION,
                    files: {
                        [GIST_FILE_NAME]: {
                            content: JSON.stringify(state, null, 2)
                        }
                    }
                })
            });

            return send(res, 200, {
                saved: true,
                created: false,
                gistId: updated.id,
                updatedAt: state.updatedAt
            });
        }

        const created = await githubFetch('/gists', token, {
            method: 'POST',
            body: JSON.stringify({
                description: GIST_DESCRIPTION,
                public: false,
                files: {
                    [GIST_FILE_NAME]: {
                        content: JSON.stringify(state, null, 2)
                    }
                }
            })
        });

        return send(res, 200, {
            saved: true,
            created: true,
            gistId: created.id,
            updatedAt: state.updatedAt
        });
    } catch (error) {
        console.error('Gist sync error:', error);
        const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600
            ? error.status
            : 502;
        return send(res, status, {
            error: status === 401 || status === 403
                ? 'GitHub Gist Token의 권한 또는 유효기간을 확인해주세요.'
                : error.message || 'Gist 동기화 중 오류가 발생했습니다.'
        });
    }
}
