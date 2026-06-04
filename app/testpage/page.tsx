"use client";

import { useState } from "react";

interface RechargeTransferItem {
    DATETIME: string | number | Date;
    MSISDNA: string;
    MSISDNB: string;
    RECHARGE_AMOUNT: string | number;
}

export default function RechargeTransferPage() {
    const [msisdn, setMsisdn] = useState("");
    const [data, setData] = useState<RechargeTransferItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [limit, setLimit] = useState(10);
    const [searched, setSearched] = useState(false);

    const formatDate = (dateString: string | number | Date) => {
        const date = new Date(dateString);
        return (
            date.toLocaleString("th-TH", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
            }) + " น."
        );
    };

    const totalAmount = data.reduce((sum, item) => sum + Number(item.RECHARGE_AMOUNT), 0);
    const uniqueB = new Set(data.map((item) => item.MSISDNB)).size;

    const searchData = async () => {
        if (!msisdn) {
            alert("กรุณากรอกเบอร์ A");
            return;
        }
        setLoading(true);
        setSearched(true);
        try {
            const res = await fetch(`/api/recharge-transfer?msisdn=${msisdn}&limit=${limit}`);
            const result = await res.json();
            setData(result.data || []);
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") searchData();
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-10 text-slate-800 font-sans selection:bg-[#534AB7]/10 selection:text-[#534AB7]">
            {/* Header Section */}
            <div className="max-w-7xl mx-auto mb-8 animate-fade-in">
                <span className="inline-flex items-center gap-1.5 bg-violet-50 text-[#534AB7] text-xs font-semibold px-3 py-1.5 rounded-full mb-3 border border-violet-100 shadow-sm">
                    ✨ ระบบจัดการข้อมูล
                </span>
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-2">
                    Recharge Transfer
                </h1>
                <p className="text-slate-500 text-sm md:text-base">
                    ตรวจสอบและค้นหาประวัติการโอนเงินระหว่างหมายเลขโทรศัพท์อย่างละเอียด
                </p>
            </div>

            <div className="max-w-7xl mx-auto">
                {/* Search Form Card */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 md:p-6 mb-8 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-6">
                            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                                เบอร์ A (ผู้โอน)
                            </label>
                            <div className="relative group">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg transition-colors group-focus-within:text-[#534AB7]">
                                    📱
                                </span>
                                <input
                                    type="text"
                                    placeholder="ระบุหมายเลขโทรศัพท์ เช่น 0812345678"
                                    value={msisdn}
                                    onChange={(e) => setMsisdn(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 bg-slate-50 placeholder-slate-400 outline-none focus:border-[#534AB7] focus:bg-white focus:ring-4 focus:ring-[#534AB7]/5 transition-all"
                                />
                            </div>
                        </div>

                        <div className="md:col-span-3">
                            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                                จำนวนรายการที่แสดง
                            </label>
                            <select
                                value={limit}
                                onChange={(e) => setLimit(Number(e.target.value))}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 bg-slate-50 outline-none focus:border-[#534AB7] focus:bg-white focus:ring-4 focus:ring-[#534AB7]/5 cursor-pointer transition-all appearance-none"
                                style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1em' }}
                            >
                                <option value={10}>10 รายการ</option>
                                <option value={20}>20 รายการ</option>
                                <option value={50}>50 รายการ</option>
                                <option value={100}>100 รายการ</option>
                            </select>
                        </div>

                        <div className="md:col-span-3">
                            <button
                                onClick={searchData}
                                className="w-full flex items-center justify-center gap-2 bg-[#534AB7] hover:bg-[#433a9c] active:scale-[0.98] text-white px-6 py-3 rounded-xl text-sm font-semibold shadow-md shadow-violet-600/10 hover:shadow-lg hover:shadow-violet-600/20 transition-all duration-200"
                            >
                                🔍 ค้นหาข้อมูล
                            </button>
                        </div>
                    </div>
                </div>

                {/* Statistics Cards */}
                {!loading && data.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                        {[
                            { label: "รายการทั้งหมด", value: `${data.length} รายการ`, icon: "📊", bg: "from-blue-500/5 to-cyan-500/5", border: "border-blue-100" },
                            { label: "ยอดรวมเงินโอน", value: "฿" + totalAmount.toLocaleString(), icon: "💰", bg: "from-emerald-500/5 to-teal-500/5", border: "border-emerald-100" },
                            { label: "เบอร์ B ที่ไม่ซ้ำกัน", value: `${uniqueB} เบอร์`, icon: "👥", bg: "from-purple-500/5 to-pink-500/5", border: "border-purple-100" },
                        ].map((stat) => (
                            <div
                                key={stat.label}
                                className={`bg-white border ${stat.border} rounded-2xl p-5 shadow-sm bg-gradient-to-br ${stat.bg} hover:scale-[1.02] transition-transform duration-200`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase">{stat.label}</p>
                                    <span className="text-lg bg-white p-1.5 rounded-lg shadow-sm border border-slate-100">{stat.icon}</span>
                                </div>
                                <p className="text-2xl font-bold text-slate-900 tracking-tight">{stat.value}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Main Data Container */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm min-h-[350px] flex flex-col justify-between">

                    {/* Loading State */}
                    {loading && (
                        <div className="flex flex-col justify-center items-center gap-3 py-24 my-auto">
                            <div className="flex gap-1.5">
                                {[0, 150, 300].map((delay) => (
                                    <span
                                        key={delay}
                                        className="w-3 h-3 rounded-full bg-[#534AB7] animate-bounce"
                                        style={{ animationDelay: `${delay}ms` }}
                                    />
                                ))}
                            </div>
                            <p className="text-xs font-medium text-slate-400 mt-2 tracking-wider uppercase">กำลังดึงข้อมูล...</p>
                        </div>
                    )}

                    {/* Initial State */}
                    {!loading && !searched && (
                        <div className="text-center py-24 my-auto max-w-sm mx-auto p-4">
                            <div className="w-16 h-16 bg-violet-50 text-3xl flex items-center justify-center rounded-2xl mx-auto mb-4 border border-violet-100 shadow-sm animate-pulse">
                                🔎
                            </div>
                            <h3 className="text-base font-semibold text-slate-800 mb-1">พร้อมค้นหาข้อมูล</h3>
                            <p className="text-sm text-slate-400">กรอกหมายเลขเบอร์ A (ผู้โอน) ด้านบนเพื่อตรวจสอบประวัติและสถิติต่าง ๆ</p>
                        </div>
                    )}

                    {/* Not Found State */}
                    {!loading && searched && data.length === 0 && (
                        <div className="text-center py-24 my-auto max-w-sm mx-auto p-4">
                            <div className="w-16 h-16 bg-amber-50 text-3xl flex items-center justify-center rounded-2xl mx-auto mb-4 border border-amber-100 shadow-sm">
                                📭
                            </div>
                            <h3 className="text-base font-semibold text-slate-800 mb-1">ไม่พบข้อมูล</h3>
                            <p className="text-sm text-slate-400">ไม่พบประวัติการทำรายการโอนสำหรับหมายเลขนี้ในระบบ</p>
                        </div>
                    )}

                    {/* Data Table */}
                    {!loading && data.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse text-left">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                        {["🕐 วันที่ / เวลาทำรายการ", "📱 เบอร์ A (ผู้โอน)", "📲 เบอร์ B (ผู้รับ)", "💜 จำนวนเงิน"].map((h) => (
                                            <th
                                                key={h}
                                                className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {data.map((item, index) => (
                                        <tr key={index} className="hover:bg-slate-50/80 transition-colors duration-150">
                                            <td className="p-4 text-slate-500 font-medium text-xs whitespace-nowrap">
                                                {formatDate(item.DATETIME)}
                                            </td>
                                            <td className="p-4 font-semibold text-slate-700 tracking-wide">{item.MSISDNA}</td>
                                            <td className="p-4 font-medium text-slate-600 tracking-wide">{item.MSISDNB}</td>
                                            <td className="p-4">
                                                <span className="inline-flex items-center bg-violet-50 text-[#534AB7] text-xs font-bold px-2.5 py-1 rounded-lg border border-violet-100 shadow-sm">
                                                    ฿{Number(item.RECHARGE_AMOUNT).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}