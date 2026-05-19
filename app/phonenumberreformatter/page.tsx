"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    Copy, Database, ArrowLeft,
    Settings2, Hash, AlignLeft, AlignCenter, Terminal, FileText, Check
} from 'lucide-react';

export default function SQLPhoneProPage() {
    const [inputData, setInputData] = useState<string>('');
    const [prefixMode, setPrefixMode] = useState<'66' | '0' | 'none'>('66');
    const [formatType, setFormatType] = useState<'normal' | 'sql'>('sql');
    const [quoteType, setQuoteType] = useState<"'" | '"'>("'");
    const [layout, setLayout] = useState<'horizontal' | 'vertical'>('horizontal');
    const [showToast, setShowToast] = useState<boolean>(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        let frame = 0;
        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const spacing = 40;
            const cols = Math.ceil(canvas.width / spacing);
            const rows = Math.ceil(canvas.height / spacing);
            for (let x = 0; x <= cols; x++) {
                for (let y = 0; y <= rows; y++) {
                    const pulse = Math.sin(frame * 0.008 + x * 0.3 + y * 0.2) * 0.5 + 0.5;
                    ctx.beginPath();
                    ctx.arc(x * spacing, y * spacing, 0.8, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(52,211,153,${0.03 + pulse * 0.05})`;
                    ctx.fill();
                }
            }
            frame++;
            requestAnimationFrame(draw);
        };
        draw();
        return () => window.removeEventListener('resize', resize);
    }, []);

    const processedList = useMemo(() => {
        if (!inputData.trim()) return [];
        const rawList = inputData.split(/[\s,"]+/).filter(item => item.trim() !== '');

        return rawList.map(num => {
            let cleaned = num.replace(/\D/g, '');
            if (cleaned.startsWith('66')) cleaned = cleaned.substring(2);
            else if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);

            let prefix = '';
            if (prefixMode === '66') prefix = '66';
            else if (prefixMode === '0') prefix = '0';

            const result = prefix + cleaned;
            return formatType === 'sql' ? `${quoteType}${result}${quoteType}` : result;
        });
    }, [inputData, prefixMode, formatType, quoteType]);

    const finalResult = useMemo(() => {
        if (processedList.length === 0) return '';

        if (layout === 'horizontal') {
            return processedList.join(formatType === 'sql' ? ', ' : ' ');
        } else {
            return processedList.map((item, index) => {
                if (formatType === 'sql') {
                    return index === processedList.length - 1 ? item : `${item},`;
                }
                return item;
            }).join('\n');
        }
    }, [processedList, layout, formatType]);

    const handleCopy = () => {
        if (!finalResult) return;

        const tempTextarea = document.createElement('textarea');
        tempTextarea.value = finalResult;
        document.body.appendChild(tempTextarea);
        tempTextarea.select();
        try {
            document.execCommand('copy');
            setShowToast(true);
            setTimeout(() => {
                setShowToast(false);
            }, 3000);
        } catch (err) {
            console.error('Could not copy text: ', err);
        }
        document.body.removeChild(tempTextarea);
    };

    return (
        <div className="relative min-h-screen bg-[#0a0c0f] text-white font-sans antialiased overflow-hidden">
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap');
                
                .font-display { font-family: 'Syne', sans-serif; }
                .font-mono-custom { font-family: 'Space Mono', monospace; }

                @keyframes scan {
                    0%   { transform: translateY(-100%); opacity: 0; }
                    10%  { opacity: 1; }
                    90%  { opacity: 1; }
                    100% { transform: translateY(100vh); opacity: 0; }
                }
                .scan-line {
                    animation: scan 8s ease-in-out infinite;
                }
                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0; }
                }
                .blink { animation: blink 1s step-end infinite; }
            `}</style>

            {/* Dynamic Dot Grid Background */}
            <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 opacity-100 z-0" />

            {/* Glowing Scan Line */}
            <div className="scan-line pointer-events-none fixed left-0 top-0 z-10 h-[2px] w-full bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />

            {/* Ambient vignette gradient */}
            <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(16,185,129,0.05),transparent)] z-0" />

            {/* Built-in Custom Animated Notification System */}
            <div className={`fixed top-6 right-6 z-50 transform transition-all duration-500 ease-out flex items-center gap-3 bg-[#0c1015]/95 backdrop-blur-md border border-emerald-500/30 px-6 py-4 rounded-2xl shadow-[0_0_25px_rgba(16,185,129,0.15)] text-white ${showToast ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-95 pointer-events-none'}`}>
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400">
                    <Check size={18} />
                </div>
                <div>
                    <h5 className="font-display text-sm font-bold tracking-wide uppercase text-white">Copied successfully</h5>
                    <p className="font-mono-custom text-[10px] text-emerald-400/70 tracking-wider">คัดลอกข้อมูลลงคลิปบอร์ดแล้ว!</p>
                </div>
            </div>

            <div className="relative z-10">

                {/* ── HEADER ── */}
                <header className="bg-white/[0.02] border-b border-white/[0.06] py-10 px-8 backdrop-blur-sm">
                    <div className="max-w-[1400px] mx-auto relative flex flex-col items-center">
                        {/* Back Button (Next Link replaced with standard secure standard HTML anchor for seamless portability) */}
                        <div className="absolute top-0 left-0">
                            <a
                                href="/mainocs"
                                className="inline-flex items-center gap-3 text-white/40 hover:text-emerald-400 transition-all duration-300 group"
                            >
                                <div className="p-2.5 rounded-xl border border-white/10 bg-white/5 group-hover:border-emerald-500/40 group-hover:bg-emerald-500/10 transition-all text-white/50 group-hover:text-emerald-400">
                                    <ArrowLeft size={16} />
                                </div>
                                <span className="font-mono-custom text-xs font-bold tracking-widest uppercase">Back to Hub</span>
                            </a>
                        </div>

                        {/* Title & Brand logo */}
                        <div className="text-center pt-10 md:pt-0">
                            <div className="inline-flex items-center justify-center p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl shadow-lg mb-4 text-emerald-400">
                                <Terminal size={28} />
                            </div>
                            <h1 className="font-display text-2xl md:text-4xl font-extrabold tracking-tight text-white uppercase">
                                Data Integrity <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent font-light">Suite</span>
                            </h1>
                            <p className="font-mono-custom text-xs tracking-wide text-white/40 mt-3 max-w-xl mx-auto leading-relaxed">
                                SQL Phone Pro: เครื่องมือจัดการรูปแบบเบอร์โทรศัพท์สำหรับ SQL Query และ Data List <span className="blink ml-0.5 text-emerald-400">_</span>
                            </p>
                        </div>
                    </div>
                </header>

                {/* ── MAIN WORKSPACE ── */}
                <main className="max-w-[1400px] mx-auto px-8 py-12">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                        {/* Left Panel: Raw Input Stream */}
                        <div className="lg:col-span-5 space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="font-mono-custom text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Hash className="w-4 h-4 text-emerald-400" /> Source Data Stream
                                </h3>
                                <button
                                    onClick={() => setInputData('')}
                                    className="font-mono-custom text-[10px] font-bold text-white/30 hover:text-red-400 transition-colors uppercase tracking-widest"
                                >
                                    Clear Input
                                </button>
                            </div>
                            <textarea
                                value={inputData}
                                onChange={(e) => setInputData(e.target.value)}
                                placeholder="วางรายการเบอร์โทรศัพท์ที่นี่ (คั่นด้วยเว้นวรรค, ขึ้นบรรทัดใหม่ หรือ เครื่องหมาย Comma)..."
                                className="w-full h-[650px] p-8 rounded-[2rem] border border-white/10 bg-white/[0.03] backdrop-blur-sm text-emerald-400 shadow-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/40 outline-none transition-all duration-300 font-mono-custom text-sm leading-relaxed placeholder-white/10"
                            />
                        </div>

                        {/* Right Panel: Configurations & Compiled Buffer */}
                        <div className="lg:col-span-7 space-y-6">
                            <div className="bg-white/[0.03] backdrop-blur-sm rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden">
                                <div className="p-8 border-b border-white/[0.04] bg-white/[0.01] space-y-8">

                                    {/* 1. Format Output Mode selection */}
                                    <div>
                                        <h4 className="font-mono-custom text-[10px] font-bold text-white/30 uppercase tracking-[0.25em] mb-3">Output Mode</h4>
                                        <div className="flex bg-black/20 border border-white/5 p-1.5 rounded-2xl">
                                            <button
                                                onClick={() => setFormatType('normal')}
                                                className={`flex-1 py-3 flex items-center justify-center gap-2 text-xs font-mono-custom font-bold rounded-xl transition-all duration-300 ${formatType === 'normal' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-md' : 'text-white/40 border border-transparent hover:text-white/70'}`}
                                            >
                                                <FileText className="w-4 h-4" /> Normal List
                                            </button>
                                            <button
                                                onClick={() => setFormatType('sql')}
                                                className={`flex-1 py-3 flex items-center justify-center gap-2 text-xs font-mono-custom font-bold rounded-xl transition-all duration-300 ${formatType === 'sql' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-md' : 'text-white/40 border border-transparent hover:text-white/70'}`}
                                            >
                                                <Database className="w-4 h-4" /> SQL Format
                                            </button>
                                        </div>
                                    </div>

                                    {/* Grid Options */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                                        {/* 2. Numerical Prefix Selection */}
                                        <div className="space-y-3">
                                            <label className="font-mono-custom text-[10px] font-bold text-white/30 uppercase tracking-[0.25em]">Numerical Prefix</label>
                                            <div className="flex bg-black/20 border border-white/5 p-1.5 rounded-xl">
                                                {['66', '0', 'none'].map((m) => (
                                                    <button
                                                        key={m}
                                                        onClick={() => setPrefixMode(m as any)}
                                                        className={`flex-1 py-2.5 text-xs font-mono-custom font-bold rounded-lg transition-all duration-300 ${prefixMode === m ? 'bg-emerald-400 text-[#0a0c0f]' : 'text-white/40 hover:text-white/70'}`}
                                                    >
                                                        {m === 'none' ? 'None' : m}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* 3. Layout Direction Selection */}
                                        <div className="space-y-3">
                                            <label className="font-mono-custom text-[10px] font-bold text-white/30 uppercase tracking-[0.25em]">Layout Direction</label>
                                            <div className="flex bg-black/20 border border-white/5 p-1.5 rounded-xl">
                                                <button
                                                    onClick={() => setLayout('horizontal')}
                                                    className={`flex-1 py-2.5 flex items-center justify-center gap-2 text-xs font-mono-custom font-bold rounded-lg transition-all duration-300 ${layout === 'horizontal' ? 'bg-emerald-400 text-[#0a0c0f]' : 'text-white/40 hover:text-white/70'}`}
                                                >
                                                    <AlignCenter className="w-3.5 h-3.5" /> Horizontal
                                                </button>
                                                <button
                                                    onClick={() => setLayout('vertical')}
                                                    className={`flex-1 py-2.5 flex items-center justify-center gap-2 text-xs font-mono-custom font-bold rounded-lg transition-all duration-300 ${layout === 'vertical' ? 'bg-emerald-400 text-[#0a0c0f]' : 'text-white/40 hover:text-white/70'}`}
                                                >
                                                    <AlignLeft className="w-3.5 h-3.5" /> Vertical
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 4. SQL Quotes encapsulation (renders only in SQL mode) */}
                                    {formatType === 'sql' && (
                                        <div className="pt-2">
                                            <label className="font-mono-custom text-[10px] font-bold text-white/30 uppercase block mb-3 tracking-[0.25em]">SQL Encapsulation</label>
                                            <div className="flex gap-4">
                                                <button
                                                    onClick={() => setQuoteType("'")}
                                                    className={`flex-1 py-3 rounded-xl border-2 text-xs font-mono-custom font-bold transition-all duration-300 ${quoteType === "'" ? 'border-emerald-400 bg-emerald-500/5 text-emerald-400 shadow-sm' : 'border-white/5 text-white/30 hover:border-white/10 hover:text-white/50'}`}
                                                >
                                                    'Single Quotes'
                                                </button>
                                                <button
                                                    onClick={() => setQuoteType('"')}
                                                    className={`flex-1 py-3 rounded-xl border-2 text-xs font-mono-custom font-bold transition-all duration-300 ${quoteType === '"' ? 'border-emerald-400 bg-emerald-500/5 text-emerald-400 shadow-sm' : 'border-white/5 text-white/30 hover:border-white/10 hover:text-white/50'}`}
                                                >
                                                    "Double Quotes"
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Compiled Output Monitor */}
                                <div className="p-8 bg-black/10">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="flex items-center gap-2">
                                            <Settings2 className="w-4 h-4 text-white/30" />
                                            <h4 className="font-mono-custom text-[11px] font-bold text-white/40 uppercase tracking-[0.2em]">Output Buffer ({processedList.length})</h4>
                                        </div>
                                        <span className={`font-mono-custom text-[10px] font-black px-3 py-1 rounded-md border ${formatType === 'sql' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' : 'bg-teal-500/10 text-teal-400 border-teal-500/25'}`}>
                                            {formatType.toUpperCase()} MODE
                                        </span>
                                    </div>

                                    {/* Green-tinted glowing terminal screen */}
                                    <div className="w-full h-[250px] overflow-y-auto p-8 bg-black/40 rounded-[1.5rem] font-mono-custom text-sm text-emerald-300 border border-white/10 shadow-inner">
                                        {processedList.length > 0 ? (
                                            <pre className="whitespace-pre-wrap break-all leading-relaxed">
                                                {finalResult}
                                            </pre>
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-white/10 italic text-xs tracking-wider">Awaiting input stream...</div>
                                        )}
                                    </div>

                                    {/* Action CTA: Gradient Button */}
                                    <button
                                        onClick={handleCopy}
                                        disabled={processedList.length === 0}
                                        className="w-full mt-6 flex items-center justify-center gap-3 px-6 py-5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:brightness-110 active:brightness-95 text-[#0a0c0f] rounded-2xl font-mono-custom font-bold text-sm tracking-widest uppercase shadow-lg shadow-emerald-500/10 transition-all duration-300 disabled:opacity-20 disabled:grayscale cursor-pointer disabled:cursor-not-allowed"
                                    >
                                        <Copy className="w-5 h-5" /> Copy Prepared Data
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>

                {/* Footer Brand Signoff */}
                <footer className="py-16 text-center border-t border-white/[0.04] bg-white/[0.01]">
                    <p className="font-mono-custom text-[10px] font-bold text-white/20 uppercase tracking-[0.4em]">Internal Data Management System • Billone Analytics</p>
                </footer>
            </div>
        </div>
    );
}