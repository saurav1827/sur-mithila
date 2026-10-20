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
            imageUrl, // Can be a remote URL or a data:image/jpeg;base64,... string
            prompt = 'Describe this image in detail.',
            model = 'meta/llama-3.2-11b-vision-instruct',
            temperature = 0.2,
            max_tokens = 512,
        } = body;

        if (!imageUrl) {
            return NextResponse.json(
                { error: 'Invalid payload: "imageUrl" (URL or base64 data URI) is required.' },
                { status: 400 }
            );
        }

        const messages = [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: prompt,
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: imageUrl,
                        },
                    },
                ],
            },
        ];

        const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages,
                temperature,
                max_tokens,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[api/ai/describe] NVIDIA API Error:', response.status, errorText);
            return NextResponse.json(
                { error: 'NVIDIA API request failed', details: errorText },
                { status: response.status }
            );
        }

        const data = await response.json();
        const description = data.choices?.[0]?.message?.content || '';

        return NextResponse.json({
            success: true,
            description,
            raw: data,
        });
    } catch (error) {
        console.error('[api/ai/describe] Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', message: error.message },
            { status: 500 }
        );
    }
}
