// api/ai.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    if (!prompt) {
        return res.status(400).json({ error: '질문 내용을 입력해주세요.' });
    }
    if (prompt.length > 4000) {
        return res.status(400).json({ error: '질문은 4,000자 이하로 입력해주세요.' });
    }

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
        return res.status(500).json({ error: 'Vercel 환경변수(GEMINI_API_KEY)가 설정되지 않았습니다.' });
    }

    // 무료 한도 초과 시 다음 활성 모델로 전환합니다.
    const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    let sawRateLimit = false;
    let lastTemporaryError = null;

    for (const model of models) {
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: `너는 유용한 단발성 질의응답 도우미야. 다음 질문에 핵심만 간단히 답변해줘:\n\n${prompt}` }]
                        }]
                    })
                }
            );

            const data = await response.json().catch(() => ({}));

            if (response.status === 429) {
                sawRateLimit = true;
                console.warn(`[${model}] 무료 한도 초과. 다음 모델로 전환합니다.`);
                continue;
            }

            if (response.status >= 500) {
                lastTemporaryError = `Google AI 서버 오류 (HTTP ${response.status})`;
                console.warn(`[${model}] 일시적 서버 오류. 다음 모델로 전환합니다.`);
                continue;
            }

            if (!response.ok) {
                const upstreamMessage = data?.error?.message;
                console.error(`[${model}] API 오류 ${response.status}:`, upstreamMessage || data);
                if (response.status === 400) {
                    return res.status(502).json({ error: 'AI 요청 형식 또는 모델 설정에 문제가 있습니다.' });
                }
                if (response.status === 401 || response.status === 403) {
                    return res.status(502).json({ error: 'Gemini API 키 또는 API 권한 설정을 확인해주세요.' });
                }
                if (response.status === 404) {
                    return res.status(502).json({ error: '설정된 Gemini 모델을 사용할 수 없습니다.' });
                }
                return res.status(502).json({ error: `Gemini API 호출에 실패했습니다. (HTTP ${response.status})` });
            }

            const answerText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (typeof answerText === 'string' && answerText.trim()) {
                return res.status(200).json({ answer: answerText });
            }

            return res.status(502).json({ error: 'AI가 사용할 수 있는 답변을 반환하지 않았습니다.' });
        } catch (err) {
            lastTemporaryError = 'Gemini API와 통신 중 오류가 발생했습니다.';
            console.error(`[${model}] 호출 오류:`, err);
        }
    }

    if (sawRateLimit && !lastTemporaryError) {
        return res.status(429).json({ error: '사용 가능한 AI 모델의 무료 한도가 소진되었습니다. 잠시 후 다시 시도해주세요.' });
    }

    return res.status(503).json({
        error: lastTemporaryError || '현재 AI 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해주세요.'
    });
}
