// api/ai.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: '질문 내용을 입력해주세요.' });
    }

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
        return res.status(500).json({ error: 'Vercel 환경변수(GEMINI_API_KEY)가 설정되지 않았습니다.' });
    }

    // 한도 초과 시 우회할 Gemini 모델 순서
    const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];

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

            // 429(Too Many Requests)일 경우 다음 모델로 시도
            if (response.status === 429) {
                console.warn(`[${model}] 무료 한도 초과. 다음 모델로 전환합니다.`);
                continue;
            }

            const data = await response.json();
            if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
                const answerText = data.candidates[0].content.parts[0].text;
                return res.status(200).json({ answer: answerText });
            }
        } catch (err) {
            console.error(`[${model}] 호출 오류:`, err);
        }
    }

    return res.status(429).json({ error: '모든 AI 모델의 무료 한도가 소진되었습니다. 잠시 후 다시 시도해주세요.' });
}