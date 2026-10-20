import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req) {
    try {
        const apiKey = process.env.NVIDIA_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: 'NVIDIA_API_KEY is not configured in environment variables.' },
                { status: 500 }
            );
        }

        const body = await req.json();
        const {
            messages,
            prompt,
            model = 'deepseek-ai/deepseek-v4.1-flash',
            temperature = 0.6,
            max_tokens = 1024,
            top_p = 0.9,
            stream = false,
        } = body;

        let formattedMessages = messages;
        if (!formattedMessages && prompt) {
            formattedMessages = [{ role: 'user', content: prompt }];
        }

        if (!formattedMessages || !Array.isArray(formattedMessages) || formattedMessages.length === 0) {
            return NextResponse.json(
                { error: 'Invalid payload: provide either "messages" array or a "prompt" string.' },
                { status: 400 }
            );
        }

        const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: formattedMessages,
                temperature,
                max_tokens,
                top_p,
                stream,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[api/ai/chat] NVIDIA API Error:', response.status, errorText);
            return NextResponse.json(
                { error: 'NVIDIA API request failed', details: errorText },
                { status: response.status }
            );
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || '';

        return NextResponse.json({
            success: true,
            reply,
            raw: data,
        });
    } catch (error) {
        console.error('[api/ai/chat] Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', message: error.message },
            { status: 500 }
        );
    }
}
