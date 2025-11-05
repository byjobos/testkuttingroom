import { GoogleGenAI, LiveServerMessage, Modality, type LiveSession, type Blob } from '@google/genai';
import { BOOKING_URL } from '../constants';
import { Role, type TranscriptEntry } from '../types';

// Gemini API requires these helper functions for audio processing.
function encode(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

function createBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}

// --- Live Session Service ---

interface Callbacks {
    onMessage: (message: TranscriptEntry) => void;
    onTurnComplete: () => void;
    onError: (error: Error) => void;
    onClose: () => void;
}

export async function startLiveSession(callbacks: Callbacks, stream: MediaStream): Promise<LiveSession> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

    const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const outputNode = outputAudioContext.createGain();
    outputNode.connect(outputAudioContext.destination);

    let nextStartTime = 0;
    const sources = new Set<AudioBufferSourceNode>();

    let turnIdCounter = 0;
    let currentInputTranscription = '';
    let currentOutputTranscription = '';
    let currentInputId: number | null = null;
    let currentOutputId: number | null = null;
    
    const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
            onopen: () => {
                const source = inputAudioContext.createMediaStreamSource(stream);
                const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                
                scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                    const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                    const pcmBlob = createBlob(inputData);
                    sessionPromise.then((session) => {
                        session.sendRealtimeInput({ media: pcmBlob });
                    }).catch(callbacks.onError);
                };
                
                source.connect(scriptProcessor);
                scriptProcessor.connect(inputAudioContext.destination);
            },
            onmessage: async (message: LiveServerMessage) => {
                // Handle transcriptions
                if (message.serverContent?.inputTranscription) {
                    const text = message.serverContent.inputTranscription.text;
                    currentInputTranscription += text;
                    if (currentInputId === null) {
                        currentInputId = ++turnIdCounter;
                    }
                    callbacks.onMessage({ id: currentInputId, role: Role.User, text: currentInputTranscription });
                }
                if (message.serverContent?.outputTranscription) {
                    const text = message.serverContent.outputTranscription.text;
                    currentOutputTranscription += text;
                    if (currentOutputId === null) {
                        currentOutputId = ++turnIdCounter;
                    }
                    callbacks.onMessage({ id: currentOutputId, role: Role.AI, text: currentOutputTranscription });
                }

                // Handle audio output
                const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                if (audioData) {
                    nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
                    const audioBuffer = await decodeAudioData(decode(audioData), outputAudioContext, 24000, 1);
                    const source = outputAudioContext.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(outputNode);
                    source.addEventListener('ended', () => sources.delete(source));
                    source.start(nextStartTime);
                    nextStartTime += audioBuffer.duration;
                    sources.add(source);
                }

                if (message.serverContent?.interrupted) {
                    for (const source of sources.values()) {
                        source.stop();
                        sources.delete(source);
                    }
                    nextStartTime = 0;
                }

                if (message.serverContent?.turnComplete) {
                    callbacks.onTurnComplete();
                    currentInputTranscription = '';
                    currentOutputTranscription = '';
                    currentInputId = null;
                    currentOutputId = null;
                }
            },
            onerror: (e: ErrorEvent) => callbacks.onError(e.error instanceof Error ? e.error : new Error(String(e.error || 'An unknown session error occurred.'))),
            onclose: (e: CloseEvent) => callbacks.onClose(),
        },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
            systemInstruction: `You are an AI receptionist for a barbershop called "The Kutting Room". Your goal is to be friendly, helpful, and efficient.

Your primary responsibilities are:
1. Answering questions about services and pricing using the detailed list provided below.
2. Guiding users to the online booking system.

**Appointment Booking and Availability Inquiries:**
Your most important rule: You CANNOT book appointments or check for available times because you do not have access to the live booking system.
If a user asks about booking an appointment, checking availability, or asks for open slots (e.g., "When is your next opening?", "Can I book for tomorrow?", "Are you free on Tuesday at 2?"), you MUST immediately and clearly state this limitation.
Your response MUST guide them to use the booking button on the screen. For example, say: "I can't check the schedule or book appointments for you, but you can see all our availability and book online instantly. Just click the 'Book Now' button below." Do not mention a website URL. Do not make up times or say you will check.

**Service Information:**
Use the official list of services and prices below as your primary source of truth. If a user asks about something not on this list, you can use your search tool to check the official website for more information. Be concise and professional.

SERVICE LIST:

Men's Services:
- Men Classic Cut: Clean, sharp cut with clippers, shears, and detailing. Price: $25.00, Duration: 30 mins.
- Men Deluxe Cut + Wash + Hot Towel: Classic Cut plus a shampoo, scalp massage, and hot towel finish. Price: $35.00, Duration: 45 mins.
- Nose or Ear Wax (add-on): Quick cleanup. Price: $8.00, Duration: 10 mins.
- Nose or Ear Wax: Standalone waxing service. Price: $10.00, Duration: 10 mins.

Women's Services:
- Shampoo + Cut + Blow-dry: Full service including wash, cut, and style. (+$10 for long/thick hair). Price: $55.00, Duration: 1 hr.
- Haircut Only: Precision cut on damp hair. No wash or blow-dry. Price: $35.00, Duration: 30 mins.
- Shampoo & Blowout (No Cut): A wash and blowout style. (+$10 for long/thick hair). Price: $40.00, Duration: 40 mins.
- Deep Conditioning Treatment: Nourishing treatment for moisture and shine. Price: $30.00, Duration: 30 mins.
- Add-On: Deep Conditioning: Quick add-on to another service. Price: $20.00, Duration: 30 mins.

Color Services (Consultation required for first-time clients):
- Color Consultation: 15-minute chat about your hair goals. Required for new color clients. Price: Varies, Duration: 15 mins.
- Gloss/Toner: Refreshes tone and adds shine. Includes blow-dry. Add haircut for $35. Price: $55.00+, Duration: 30 mins+.
- Root Touch up: Covers regrowth (up to 1.5 inches). Includes blow-dry. Add haircut for $35. Price: $75.00, Duration: 1 hr 30 mins.
- Partial Highlight: Brightens top and face-framing sections. Includes toner & blow-dry. Add haircut for $35. Price varies. Price: $100.00+, Duration: 1 hr 30 mins+.
- Highlights: All-over lighter shades. Includes toner & blow-dry. Add haircut for $35. Price varies. Price: $145.00+, Duration: 2 hrs 30 mins+.
- Global Color: Single all-over color. Includes blow-dry. Add haircut for $35. Price varies. Price: $95.00+, Duration: 1 hr 30 mins+.
- Dimensional Color: Multi-toned color with highlights/balayage. Includes toner & blow-dry. Add haircut for $35. Price varies. Price: $145.00+, Duration: 2 hrs 30 mins+.`,
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            tools: [{googleSearch: {}}],
        },
    });

    return sessionPromise;
}
