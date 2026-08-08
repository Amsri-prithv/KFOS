import React, { useState, useRef } from 'react';
import {
  Mic,
  Square,
  Send,
  Bot,
  User,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Volume2,
  RefreshCw,
  X,
  Droplet,
  Info,
} from 'lucide-react';
import { kfosStore } from '../services/kfosStore';
import { VoiceParseResult } from '../types/kfos';

interface TelegramBotSimulatorProps {
  onClose?: () => void;
}

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  parseResult?: VoiceParseResult;
  isConfirmed?: boolean;
}

const SAMPLE_TANGLISH_PROMPTS = [
  'Sri Murugan Traders Madurai 10 Cans standard room freshener thandhen 5000 cash vanginen',
  'Ramesh Super Market Trichy 5 Cans eco bathroom freshener 50 discount thandhen',
  'Annapoorna Hotel Chennai sample 200ml 2nos free thandhen',
  'Kashmeer Outlet RS Puram 8 Cans premium room freshener full paid',
];

export const TelegramBotSimulator: React.FC<TelegramBotSimulatorProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'வணக்கம்! 🤖 I am KFOS Telegram Field Assistant. Send me a voice note or Tamil/Tanglish text note to record 5L Can orders, returns, or sample requests.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputNote, setInputNote] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<VoiceParseResult | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Start Mic Audio Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudioNote(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      alert('Microphone access permission error. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Convert Audio Blob to Base64 & call Gemini NLU
  const processAudioNote = async (audioBlob: Blob) => {
    setIsProcessing(true);
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async () => {
      const base64Data = (reader.result as string).split(',')[1];
      await callNluApi({ audioBase64: base64Data, mimeType: audioBlob.type });
    };
  };

  // Call Gemini 3.6 Flash NLU Server Route
  const callNluApi = async (bodyPayload: { input?: string; audioBase64?: string; mimeType?: string }) => {
    setIsProcessing(true);
    try {
      const userText = bodyPayload.input || '🎤 [Voice Audio Note]';
      const userMsg: Message = {
        id: 'msg-' + Date.now(),
        sender: 'user',
        text: userText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, userMsg]);

      const response = await fetch('/api/nlu/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const resData = await response.json();

      if (resData.success && resData.data) {
        const result: VoiceParseResult = resData.data;

        if (result.needsClarification) {
          const botMsg: Message = {
            id: 'msg-bot-' + Date.now(),
            sender: 'bot',
            text: `⚠️ Clarification Needed:\n${result.clarificationQuestion || 'Please specify Customer Name, Location, or Quantity.'}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            parseResult: result,
          };
          setMessages((prev) => [...prev, botMsg]);
        } else {
          setPendingConfirmation(result);
          const botMsg: Message = {
            id: 'msg-bot-' + Date.now(),
            sender: 'bot',
            text: `✅ Extracted Order Details from Voice Note:\n• Store: ${result.customerName} (${result.place})\n• Product: ${result.quantity}x 5L Cans (${result.quality} ${result.productVariant})\n• Discount: ₹${result.discount}/unit\n• Paid: ₹${result.paymentAmount}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            parseResult: result,
          };
          setMessages((prev) => [...prev, botMsg]);
        }
      } else {
        const botMsg: Message = {
          id: 'msg-bot-err-' + Date.now(),
          sender: 'bot',
          text: '❌ Could not parse audio note clearly. Please try again or speak louder.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, botMsg]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
      setInputNote('');
    }
  };

  // Commit Order to Store
  const confirmAndCommitOrder = async () => {
    if (!pendingConfirmation) return;

    const res = await kfosStore.createOrder({
      customerName: pendingConfirmation.customerName,
      customerPlace: pendingConfirmation.place,
      productVariant: pendingConfirmation.productVariant,
      quality: pendingConfirmation.quality,
      quantity: pendingConfirmation.quantity,
      discountPerUnit: pendingConfirmation.discount,
      paidAmount: pendingConfirmation.paymentAmount,
      source: 'Telegram Voice',
      notes: `Voice Note Transcript: "${pendingConfirmation.rawTranscript}"`,
      samplesRequested: pendingConfirmation.samplesRequested,
    });

    if (res.success && res.order) {
      const botMsg: Message = {
        id: 'msg-bot-success-' + Date.now(),
        sender: 'bot',
        text: `🎉 ORDER COMMITTED TO KFOS!\nOrder #${res.order.orderNumber}\nTotal: ₹${res.order.totalAmount.toLocaleString('en-IN')}\nProfit Realized: +₹${res.order.totalProfit.toLocaleString('en-IN')}\nInventory Stock Pool updated automatically!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isConfirmed: true,
      };
      setMessages((prev) => [...prev, botMsg]);
      setPendingConfirmation(null);
    } else {
      alert(`Order Failed: ${res.error}`);
    }
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col h-[600px] max-w-2xl mx-auto overflow-hidden">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
              KFOS Telegram Assistant
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </h3>
            <p className="text-[11px] text-zinc-400">Tamil & Tanglish Voice NLU Engine</p>
          </div>
        </div>

        {onClose && (
          <button onClick={onClose} className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Quick Tanglish Prompt Pills */}
      <div className="bg-zinc-900/50 border-b border-zinc-800/80 p-2 overflow-x-auto flex items-center gap-2">
        <span className="text-[10px] uppercase font-bold text-zinc-400 px-1 whitespace-nowrap">Try Tanglish:</span>
        {SAMPLE_TANGLISH_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => setInputNote(prompt)}
            className="px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono whitespace-nowrap border border-zinc-700/50 transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages Feed */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-zinc-950/80">
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-md ${
                m.sender === 'user'
                  ? 'bg-emerald-600 text-white rounded-br-none'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-none'
              }`}
            >
              <div className="whitespace-pre-line font-sans">{m.text}</div>
              <span
                className={`text-[9px] mt-1.5 block text-right font-mono ${
                  m.sender === 'user' ? 'text-emerald-200' : 'text-zinc-400'
                }`}
              >
                {m.timestamp}
              </span>
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-zinc-900 border border-zinc-800 p-3 rounded-xl w-fit animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Gemini AI processing Tamil/Tanglish voice note...</span>
          </div>
        )}
      </div>

      {/* Pending Confirmation Modal / Card */}
      {pendingConfirmation && (
        <div className="p-4 bg-emerald-950/40 border-t border-emerald-500/30 space-y-3">
          <div className="flex items-center justify-between text-xs text-emerald-300 font-bold">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Confirm Field Order Transaction
            </span>
            <span className="font-mono text-[10px]">Confidence: {Math.round((pendingConfirmation.confidenceScore || 0.95) * 100)}%</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-zinc-900/90 p-3 rounded-xl border border-zinc-800">
            <div>
              <span className="text-zinc-400">Customer:</span>
              <p className="font-bold text-zinc-100">{pendingConfirmation.customerName}</p>
            </div>
            <div>
              <span className="text-zinc-400">Place:</span>
              <p className="font-bold text-zinc-100">{pendingConfirmation.place}</p>
            </div>
            <div>
              <span className="text-zinc-400">Item:</span>
              <p className="font-bold text-emerald-400">
                {pendingConfirmation.quantity}x {pendingConfirmation.quality} {pendingConfirmation.productVariant}
              </p>
            </div>
            <div>
              <span className="text-zinc-400">Discount:</span>
              <p className="font-bold text-zinc-100">₹{pendingConfirmation.discount}/unit</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={confirmAndCommitOrder}
              className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/40 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              Commit Order to Database
            </button>
            <button
              onClick={() => setPendingConfirmation(null)}
              className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-xl font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Input Bar */}
      <div className="p-3 bg-zinc-900 border-t border-zinc-800 flex items-center gap-2">
        {/* Record Voice Button */}
        {isRecording ? (
          <button
            onClick={stopRecording}
            className="p-3 rounded-xl bg-red-600 hover:bg-red-500 text-white animate-pulse flex items-center gap-1.5 text-xs font-bold shadow-lg shadow-red-950/50"
          >
            <Square className="w-4 h-4" />
            <span>Stop Recording</span>
          </button>
        ) : (
          <button
            onClick={startRecording}
            disabled={isProcessing}
            className="p-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition-all flex items-center gap-1 text-xs font-semibold"
            title="Record Voice Note"
          >
            <Mic className="w-4 h-4" />
            <span className="hidden sm:inline">Voice Note</span>
          </button>
        )}

        <input
          type="text"
          value={inputNote}
          onChange={(e) => setInputNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && inputNote.trim() && callNluApi({ input: inputNote })}
          placeholder="Type Tanglish or Tamil field sales note..."
          disabled={isProcessing || isRecording}
          className="flex-1 bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-emerald-500 font-sans"
        />

        <button
          onClick={() => inputNote.trim() && callNluApi({ input: inputNote })}
          disabled={!inputNote.trim() || isProcessing}
          className="p-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold transition-all"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
