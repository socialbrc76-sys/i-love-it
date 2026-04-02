require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

async function testModels() {
    const key = process.env.GEMINI_API_KEY;
    console.log('Key:', key);
    console.log('Key length:', key.length);

    const ai = new GoogleGenAI({ apiKey: key });

    const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash'];
    
    for (const model of models) {
        try {
            console.log('\nTrying model:', model);
            const response = await ai.models.generateContent({
                model,
                contents: '안녕하세요. 1+1=?',
            });
            console.log('SUCCESS:', model, '->', response.text.substring(0, 80));
            break;
        } catch (err) {
            console.log('FAIL:', model, '->', err.message.substring(0, 120));
        }
    }
}

testModels();
