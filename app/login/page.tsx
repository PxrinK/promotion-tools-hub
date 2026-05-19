"use client";

import React, { useState } from 'react';
import { User, Lock, LogIn, ShieldAlert } from 'lucide-react';
import Swal from 'sweetalert2';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const CORRECT_USERNAME = 'billoneteam';
    const CORRECT_PASSWORD = 'billone12341';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (username === CORRECT_USERNAME && password === CORRECT_PASSWORD) {
            await Swal.fire({
                title: 'ACCESS GRANTED',
                text: 'ยินดีต้อนรับกลับ BilloneTeam',
                icon: 'success',
                background: '#0b0f19',
                color: '#fff',
                confirmButtonColor: '#10b981',
                showConfirmButton: false,
                timer: 1500,
                timerProgressBar: true,
                customClass: {
                    popup: 'border border-emerald-500/30 rounded-2xl font-mono'
                }
            });

            window.location.href = '/mainocs';
        } else {
            Swal.fire({
                title: 'ACCESS DENIED',
                text: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง',
                icon: 'error',
                background: '#0b0f19',
                color: '#fff',
                confirmButtonText: 'RETRY',
                confirmButtonColor: '#ef4444',
                customClass: {
                    popup: 'border border-red-500/30 rounded-2xl font-mono'
                }
            });
        }
    };

    return (
        <div className="min-h-screen bg-[#090d16] flex flex-col items-center justify-center p-6 relative overflow-hidden font-mono selection:bg-emerald-500 selection:text-black">

            {/* พื้นหลังใส่ลูกเล่นดอทเท็กซ์เจอร์และแสงนีออนมินต์ */}
            <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-20" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />

            <div className="w-full max-w-md z-10 flex flex-col items-center">

                {/* Header Section ถอดแบบมาจากป้ายด้านบนของภาพ */}
                <header className="text-center mb-10 w-full">
                    <div className="flex items-center justify-center gap-3 mb-6">
                        <div className="h-[1px] w-12 bg-slate-800" />
                        <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold">
                            Billone • Internal Tools
                        </span>
                        <div className="h-[1px] w-12 bg-slate-800" />
                    </div>

                    <div className="inline-flex items-center gap-2 px-4 py-1 bg-emerald-950/30 rounded-full border border-emerald-500/20 mb-4">
                        <span className="text-[11px] font-bold text-emerald-400 tracking-widest uppercase">
                            PROMOTION TOOLS HUB
                        </span>
                    </div>

                    <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight mb-2">
                        Tools for <span className="text-emerald-400 block sm:inline">OCS Config</span>
                    </h1>

                    <p className="text-slate-500 text-xs tracking-wide">
                        ศูนย์รวมเครื่องมือจัดการข้อมูลโปรโมชันและระบบ config OCS_
                    </p>
                </header>

                {/* Login Form Card ทรงเหลี่ยมมนล้ำ ๆ แบบกระจกมืด */}
                <div className="w-full bg-[#0d1527]/80 backdrop-blur-xl p-8 rounded-2xl border border-slate-800/80 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] transition-all duration-300 hover:border-emerald-500/20">
                    <form onSubmit={handleSubmit} className="space-y-6">

                        {/* Username Field */}
                        <div className="space-y-2">
                            <label htmlFor="username" className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <User className="w-3.5 h-3.5 text-emerald-400" />
                                Username
                            </label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-600 transition-colors group-focus-within:text-emerald-400" />
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-[#070b12] border border-slate-800 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all duration-200 text-sm text-white placeholder-slate-700 outline-none uppercase tracking-wide"
                                    placeholder="ENTER USERNAME"
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div className="space-y-2">
                            <label htmlFor="password" className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                                Password
                            </label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-600 transition-colors group-focus-within:text-emerald-400" />
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-[#070b12] border border-slate-800 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all duration-200 text-sm text-white placeholder-slate-700 outline-none tracking-wide"
                                    placeholder="••••••••••••"
                                />
                            </div>
                        </div>

                        {/* Login Button ปุ่มมินต์สะท้อนแสงสไตล์ Sci-Fi */}
                        <button
                            type="submit"
                            className="w-full flex justify-center items-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-black rounded-xl shadow-lg shadow-emerald-500/10 hover:shadow-emerald-400/20 transition-all duration-200 active:scale-[0.99] outline-none uppercase tracking-widest"
                        >
                            <LogIn className="w-4 h-4 stroke-[3]" />
                            Sign In _
                        </button>
                    </form>

                    {/* Footer Info ใน Card */}
                    <div className="mt-6 pt-5 border-t border-slate-900 text-center">
                        <p className="text-[10px] text-slate-600 uppercase tracking-wider">
                            <ShieldAlert className="inline w-3 h-3 mr-1 text-slate-600 align-text-top" />
                            Authorized OCS personnel only
                        </p>
                    </div>
                </div>

                {/* Footer Branding ด้านล่างสุด */}
                <footer className="mt-8 flex flex-col items-center gap-1">
                    <p className="text-[10px] text-slate-700 font-bold uppercase tracking-widest">
                        © 2026 PROMOTION TOOLS HUB • V2.0
                    </p>
                </footer>
            </div>
        </div>
    );
}