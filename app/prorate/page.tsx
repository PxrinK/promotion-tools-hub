"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  RotateCcw, DollarSign, TrendingUp, ArrowLeft, 
  Calculator, Info, Calendar, Percent
} from 'lucide-react';

export default function ProrateCalculatorPage() {
    // States for Unit Prorate
    const [totalUnit, setTotalUnit] = useState<string>('');
    const [totalDays, setTotalDays] = useState<string>('31');
    const [currentDay, setCurrentDay] = useState<string>('1');
    const [prorateOutput, setProrateOutput] = useState<string>('0.00');
    const [finalCalculationDisplay, setFinalCalculationDisplay] = useState<string>('N/A');
    const [hasCalculated, setHasCalculated] = useState<boolean>(false);

    // States for Price Prorate
    const [priceBase, setPriceBase] = useState<string>('');
    const [priceTotalDays, setPriceTotalDays] = useState<string>('31');
    const [priceStartDay, setPriceStartDay] = useState<string>('1'); 
    const [priceOutput, setPriceOutput] = useState<string>('0.00');
    const [priceStepDisplay, setPriceStepDisplay] = useState<string>('N/A');
    const [hasCalculatedPrice, setHasCalculatedPrice] = useState<boolean>(false);

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
        let animationId: number;
        
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
            animationId = requestAnimationFrame(draw);
        };
        draw();
        
        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationId);
        };
    }, []);

    interface ProrateResult {
        daysRemaining: number;
        result: number;
    }

    const calculateProrate = (value: number, total: number, start: number): ProrateResult => {
        const daysRemaining = total - start + 1;
        const result = (value / total) * daysRemaining;
        return { daysRemaining, result };
    };

    const handleCalculateUnit = () => {
        const unit = parseFloat(totalUnit) || 0;
        const days = parseInt(totalDays) || 0;
        const current = parseInt(currentDay) || 0;
        if (unit <= 0 || days <= 0 || current <= 0 || current > days) {
            return;
        }
        const { daysRemaining, result } = calculateProrate(unit, days, current);
        setFinalCalculationDisplay(`${unit.toLocaleString()} × (${daysRemaining}/${days})`);
        setProrateOutput(result.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 6 }));
        setHasCalculated(true);
    };

    const handleCalculatePrice = () => {
        const price = parseFloat(priceBase) || 0;
        const total = parseInt(priceTotalDays) || 0;
        const start = parseInt(priceStartDay) || 0;
        if (price <= 0 || total <= 0 || start <= 0 || start > total) {
            return;
        }
        const { daysRemaining, result } = calculateProrate(price, total, start);
        setPriceStepDisplay(`${price.toLocaleString()} × (${daysRemaining}/${total})`);
        setPriceOutput(result.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        setHasCalculatedPrice(true);
    };

    const handleResetAll = () => {
        setTotalUnit(''); setTotalDays('31'); setCurrentDay('1'); setHasCalculated(false);
        setPriceBase(''); setPriceTotalDays('31'); setPriceStartDay('1'); setHasCalculatedPrice(false);
    };

    return (
        <div className="relative min-h-screen bg-[#0a0c0f] text-white font-sans antialiased overflow-hidden">
            {/* Safe style embedding prevents compilation mismatch or unterminated string literals */}
            <style dangerouslySetInnerHTML={{ __html: `
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
            `}} />

            {/* Dynamic Dot Grid Background */}
            <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 opacity-100 z-0" />

            {/* Glowing Scan Line */}
            <div className="scan-line pointer-events-none fixed left-0 top-0 z-10 h-[2px] w-full bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />

            {/* Ambient vignette gradient */}
            <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(16,185,129,0.05),transparent)] z-0" />

            <div className="relative z-10">
                
                {/* ── HEADER ── */}
                <header className="bg-white/[0.02] border-b border-white/[0.06] py-10 px-8 backdrop-blur-sm">
                    <div className="max-w-[1400px] mx-auto relative flex flex-col items-center">
                        
                        {/* Back Button */}
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
                                <Calculator size={28} />
                            </div>
                            <h1 className="font-display text-2xl md:text-4xl font-extrabold tracking-tight text-white uppercase">
                                Billing Prorate <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent font-light">Calculator</span>
                            </h1>
                            <p className="font-mono-custom text-xs tracking-wide text-white/40 mt-3 max-w-xl mx-auto leading-relaxed">
                                คำนวณสัดส่วนเฉลี่ย (Prorate) ของ Unit และ Price ตามมาตรฐานระบบ Billing <span className="blink ml-0.5 text-emerald-400">_</span>
                            </p>
                        </div>
                    </div>
                </header>

                {/* ── MAIN CONTENT ── */}
                <main className="max-w-[1400px] mx-auto px-8 py-12">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        
                        {/* ── UNIT PRORATE CARD ── */}
                        <section className="bg-white/[0.03] backdrop-blur-sm rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col transition-all duration-300 hover:border-emerald-500/20 hover:shadow-emerald-500/5">
                            <div className="p-8 border-b border-white/[0.04] bg-white/[0.01] flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                                        <TrendingUp size={20} />
                                    </div>
                                    <h2 className="font-mono-custom text-xs font-bold text-white/80 uppercase tracking-widest">Unit Prorate</h2>
                                </div>
                                <span className="font-mono-custom text-[10px] font-black text-emerald-400/80 px-3 py-1 bg-emerald-500/5 border border-emerald-500/20 rounded-lg uppercase tracking-wider">Capacity Based</span>
                            </div>

                            {}
                            <div className="p-8 space-y-8 flex-grow">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="font-mono-custom text-[10px] font-bold text-white/30 uppercase tracking-wider">Free Unit ทั้งหมด</label>
                                        <input 
                                            type="number" 
                                            value={totalUnit} 
                                            onChange={(e)=>setTotalUnit(e.target.value)} 
                                            className="w-full p-5 bg-black/40 rounded-2xl border border-white/10 text-emerald-400 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/40 outline-none transition-all font-mono-custom font-bold text-xl placeholder-white/5" 
                                            placeholder="0" 
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="font-mono-custom text-[10px] font-bold text-white/30 uppercase tracking-wider">วันในรอบบิล</label>
                                        <input 
                                            type="number" 
                                            value={totalDays} 
                                            onChange={(e)=>setTotalDays(e.target.value)} 
                                            className="w-full p-5 bg-black/40 rounded-2xl border border-white/10 text-emerald-400 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/40 outline-none transition-all font-mono-custom font-bold text-xl" 
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="font-mono-custom text-[10px] font-bold text-white/30 uppercase tracking-wider">วันที่เริ่มใช้งาน (ลำดับวันที่ในรอบ)</label>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            value={currentDay} 
                                            onChange={(e)=>setCurrentDay(e.target.value)} 
                                            className="w-full p-5 bg-black/40 rounded-2xl border border-white/10 text-emerald-400 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/40 outline-none transition-all font-mono-custom font-bold text-xl" 
                                            placeholder="1" 
                                        />
                                        <Calendar className="absolute right-5 top-5 text-white/20" size={20} />
                                    </div>
                                </div>

                                <button 
                                    onClick={handleCalculateUnit} 
                                    className="w-full py-5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:brightness-110 active:brightness-95 text-[#0a0c0f] font-mono-custom font-bold text-xs tracking-widest uppercase rounded-2xl shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 cursor-pointer transition-all"
                                >
                                    <Percent size={14} /> คำนวณ Unit
                                </button>

                                {hasCalculated && (
                                    <div className="p-6 bg-black/40 rounded-[2rem] text-center border border-emerald-500/20 shadow-inner animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <p className="font-mono-custom text-[9px] font-black text-emerald-400/50 mb-2 uppercase tracking-[0.25em]">Prorated Output</p>
                                        <div className="font-mono-custom text-4xl font-bold mb-3 text-emerald-400">{prorateOutput}</div>
                                        <div className="font-mono-custom text-[10px] bg-emerald-500/5 border border-emerald-500/20 py-2 px-5 rounded-full inline-block text-emerald-300 uppercase tracking-wider">
                                            Logic: {finalCalculationDisplay}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* ── PRICE PRORATE CARD ── */}
                        <section className="bg-white/[0.03] backdrop-blur-sm rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col transition-all duration-300 hover:border-teal-500/20 hover:shadow-teal-500/5">
                            <div className="p-8 border-b border-white/[0.04] bg-white/[0.01] flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-xl">
                                        <DollarSign size={20} />
                                    </div>
                                    <h2 className="font-mono-custom text-xs font-bold text-white/80 uppercase tracking-widest">Price Prorate</h2>
                                </div>
                                <span className="font-mono-custom text-[10px] font-black text-teal-400/80 px-3 py-1 bg-teal-500/5 border border-teal-500/20 rounded-lg uppercase tracking-wider">Revenue Based</span>
                            </div>

                            {}
                            <div className="p-8 space-y-8 flex-grow">
                                <div className="space-y-3">
                                    <label className="font-mono-custom text-[10px] font-bold text-white/30 uppercase tracking-wider">ราคาเต็มรายเดือน (บาท)</label>
                                    <input 
                                        type="number" 
                                        value={priceBase} 
                                        onChange={(e)=>setPriceBase(e.target.value)} 
                                        className="w-full p-5 bg-black/40 rounded-2xl border border-white/10 text-teal-400 focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500/40 outline-none transition-all font-mono-custom font-bold text-xl placeholder-white/5" 
                                        placeholder="0.00" 
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="font-mono-custom text-[10px] font-bold text-white/30 uppercase tracking-wider">วันในรอบบิล</label>
                                        <input 
                                            type="number" 
                                            value={priceTotalDays} 
                                            onChange={(e)=>setPriceTotalDays(e.target.value)} 
                                            className="w-full p-5 bg-black/40 rounded-2xl border border-white/10 text-teal-400 focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500/40 outline-none transition-all font-mono-custom font-bold text-xl" 
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="font-mono-custom text-[10px] font-bold text-white/30 uppercase tracking-wider">วันที่เริ่มใช้งาน</label>
                                        <input 
                                            type="number" 
                                            value={priceStartDay} 
                                            onChange={(e)=>setPriceStartDay(e.target.value)} 
                                            className="w-full p-5 bg-black/40 rounded-2xl border border-white/10 text-teal-400 focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500/40 outline-none transition-all font-mono-custom font-bold text-xl" 
                                            placeholder="1" 
                                        />
                                    </div>
                                </div>

                                <button 
                                    onClick={handleCalculatePrice} 
                                    className="w-full py-5 bg-gradient-to-r from-teal-400 to-emerald-400 hover:brightness-110 active:brightness-95 text-[#0a0c0f] font-mono-custom font-bold text-xs tracking-widest uppercase rounded-2xl shadow-lg shadow-teal-500/10 flex items-center justify-center gap-2 cursor-pointer transition-all"
                                >
                                    <DollarSign size={14} /> คำนวณราคา
                                </button>

                                {hasCalculatedPrice && (
                                    <div className="p-6 bg-black/40 rounded-[2rem] text-center border border-teal-500/20 shadow-inner animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <p className="font-mono-custom text-[9px] font-black text-teal-400/50 mb-2 uppercase tracking-[0.25em]">Final Charge (Excl. VAT)</p>
                                        <div className="font-mono-custom text-4xl font-bold mb-3 text-teal-400">฿{priceOutput}</div>
                                        <div className="font-mono-custom text-[10px] bg-teal-500/5 border border-teal-500/20 py-2 px-5 rounded-full inline-block text-teal-300 uppercase tracking-wider">
                                            Logic: {priceStepDisplay}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* ── FOOTER CONTROLS & INFO ── */}
                    {}
                    <div className="flex flex-col items-center mt-16 space-y-8">
                        <button 
                            onClick={handleResetAll} 
                            className="flex items-center gap-2.5 text-white/40 hover:text-red-400 transition-all font-mono-custom font-bold text-[10px] uppercase tracking-[0.3em] bg-white/[0.02] hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 px-8 py-3.5 rounded-full shadow-lg"
                        >
                            <RotateCcw size={13} /> Reset All Data
                        </button>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl pt-4">
                            <div className="flex items-start gap-4 p-6 bg-white/[0.02] border border-white/10 rounded-2xl backdrop-blur-sm">
                                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                                    <Info size={16} />
                                </div>
                                <div className="font-mono-custom text-[10px] text-white/50 leading-relaxed">
                                    <span className="text-white font-bold block mb-1">สูตรการคำนวณสัดส่วนเฉลี่ย:</span>
                                    <span>(Value ÷ Total Days) × Days Remaining</span>
                                    <span className="block mt-1 text-emerald-400/70">โดยที่ Days Remaining = (Total Days - Start Day + 1)</span>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 p-6 bg-white/[0.02] border border-white/10 rounded-2xl backdrop-blur-sm">
                                <div className="p-2 bg-teal-500/10 border border-teal-500/20 rounded-xl text-teal-400">
                                    <Info size={16} />
                                </div>
                                <div className="font-mono-custom text-[10px] text-white/50 leading-relaxed">
                                    <span className="text-white font-bold block mb-1">หมายเหตุระบบบัญชี:</span>
                                    <span>การคำนวณนี้เป็นแบบเบื้องต้นตามมาตรฐานสัดส่วนวัน ผลลัพธ์จริงอาจต่างกันเล็กน้อยตามเงื่อนไขเฉพาะของแต่ละแพ็กเกจ</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>

                {/* Footer Brand Signoff */}
                <footer className="py-16 text-center border-t border-white/[0.04] bg-white/[0.01]">
                    <p className="font-mono-custom text-[10px] font-bold text-white/20 uppercase tracking-[0.4em]">Internal Engineering Unit • Billone Professional Suite</p>
                </footer>
            </div>
        </div>
    );
}