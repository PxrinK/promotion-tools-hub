"use client";

import { Calculator, FileText, GitCompare, ArrowUpRight, Shuffle, Hash } from 'lucide-react';
import React, { useEffect, useRef } from 'react';

type ToolCardProps = {
  title: string;
  titleThai: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  index: number;
  tag: string;
};

const tools: ToolCardProps[] = [
  {
    title: 'Promotion Extractor',
    titleThai: 'สกัดข้อมูลโปรโมชัน',
    description: 'ประมวลผลข้อมูลโปรโมชันดิบจากทีมการตลาด จัดรูปแบบพร้อม config OCS ทันที',
    href: '/extractor',
    icon: FileText,
    index: 1,
    tag: 'EXTRACT'
  },
  {
    title: 'Phone & SQL Formatter',
    titleThai: 'จัดรูปแบบเบอร์และ SQL',
    description: 'ปรับรูปแบบเบอร์โทรศัพท์และแปลงเป็น SQL IN Clause สำหรับ query ข้อมูล',
    href: '/phonenumberreformatter',
    icon: Hash,
    index: 2,
    tag: 'FORMAT'
  },
  {
    title: 'Prorate Calculator',
    titleThai: 'คำนวณ Prorate',
    description: 'คำนวณค่าบริการและ Free Unit ตามจำนวนวันที่เหลือในรอบบิล พร้อมแสดงทุกขั้นตอน',
    href: '/prorate',
    icon: Calculator,
    index: 3,
    tag: 'CALCULATE'
  },
  {
    title: 'File Comparator',
    titleThai: 'เปรียบเทียบไฟล์',
    description: 'เปรียบเทียบข้อมูลสองชุดทีละบรรทัด หาจุดที่เปลี่ยนแปลงได้รวดเร็ว',
    href: '/comparator',
    icon: GitCompare,
    index: 4,
    tag: 'COMPARE'
  },
  {
    title: 'Data Mapper',
    titleThai: 'จับคู่ข้อมูล',
    description: 'VLOOKUP อัตโนมัติ ดึงข้อมูลจากไฟล์หนึ่งไปเติมอีกไฟล์ผ่าน Key ที่กำหนด',
    href: '/mappingdata',
    icon: Shuffle,
    index: 5,
    tag: 'MAP'
  },
  {
    title: 'Relationship Manager',
    titleThai: 'จัดการความสัมพันธ์',
    description: 'Smart Mapping เชื่อมข้อมูลระหว่างไฟล์ ตรวจสอบสถานะและจัดการ 3-Sheets',
    href: '/relationship',
    icon: Shuffle,
    index: 6,
    tag: 'RELATE'
  },
    {
    title: 'summaryspecialnumber',
    titleThai: 'สรุปหมายเลขพิเศษ',
    description: 'ระบบสรุปหมายเลขพิเศษจากไฟล์ข้อมูลต่างๆ',
    href: '/summaryspecialnumber',
    icon: Shuffle,
    index: 7,
    tag: 'RELATE'
  },
];

const ToolCard = ({ title, titleThai, description, href, icon: Icon, index, tag }: ToolCardProps) => {
  return (
    <a
      href={href}
      className="tool-card group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-7 backdrop-blur-sm transition-all duration-500 hover:bg-white/10 hover:border-white/25 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Index number — large faded background */}
      <span className="absolute right-5 top-3 font-mono text-7xl font-black text-white/[0.04] select-none leading-none">
        {String(index).padStart(2, '0')}
      </span>

      {/* Tag */}
      <div className="mb-5 flex items-center justify-between">
        <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.2em] text-emerald-400">
          {tag}
        </span>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/50 transition-all duration-300 group-hover:border-emerald-500/40 group-hover:bg-emerald-500/10 group-hover:text-emerald-400">
          <Icon size={16} strokeWidth={1.5} />
        </div>
      </div>

      {/* Title */}
      <h3 className="mb-1 text-lg font-bold tracking-tight text-white">{title}</h3>
      <p className="mb-3 font-mono text-[11px] text-white/30">{titleThai}</p>
      <p className="flex-1 text-sm leading-relaxed text-white/50">{description}</p>

      {/* CTA */}
      <div className="mt-6 flex items-center gap-2 font-mono text-xs font-bold tracking-widest text-white/25 transition-all duration-300 group-hover:text-emerald-400">
        <span>ENTER</span>
        <ArrowUpRight size={13} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 group-hover:w-full" />
    </a>
  );
};

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Subtle animated grid dots background
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
          ctx.fillStyle = `rgba(52,211,153,${0.04 + pulse * 0.06})`;
          ctx.fill();
        }
      }
      frame++;
      requestAnimationFrame(draw);
    };
    draw();
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0c0f]">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap');

        .font-display { font-family: 'Syne', sans-serif; }
        .font-mono-custom { font-family: 'Space Mono', monospace; }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .tool-card {
          opacity: 0;
          animation: fade-up 0.5s cubic-bezier(0.16,1,0.3,1) forwards;
        }
        .hero-line {
          opacity: 0;
          animation: fade-up 0.7s cubic-bezier(0.16,1,0.3,1) forwards;
        }
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

        /* ── FIXED LOOPING RUNNING PETS ANIMATION ── */
        @keyframes walk-across {
          0% { left: 100%; transform: translateX(0); }
          100% { left: 0%; transform: translateX(-150px); } /* ป้องกันตัวละครหายไปแบบดื้อๆ */
        }
        @keyframes bobbing-fast {
          0%, 100% { bottom: 4px; }
          50% { bottom: 18px; }
        }
        @keyframes bobbing-slow {
          0%, 100% { bottom: 4px; }
          50% { bottom: 12px; }
        }

        /* ใช้ absolute จับแยกพิกัดเริ่มต้น ไม่ให้เกิดอาการกองกัน */
        .pet-container {
          position: absolute;
          will-change: left;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .pet-1 {
          animation: walk-across 15s linear infinite, bobbing-fast 0.35s ease-in-out infinite;
          animation-delay: 0s;
        }
        .pet-2 {
          animation: walk-across 20s linear infinite, bobbing-slow 0.45s ease-in-out infinite;
          animation-delay: -3s;
        }
        .pet-3 {
          animation: walk-across 12s linear infinite, bobbing-fast 0.3s ease-in-out infinite;
          animation-delay: -6s;
        }
        .pet-4 {
          animation: walk-across 25s linear infinite, bobbing-slow 0.5s ease-in-out infinite;
          animation-delay: -10s;
        }
        .pet-5 {
          animation: walk-across 17s linear infinite, bobbing-fast 0.4s ease-in-out infinite;
          animation-delay: -13s;
        }
      `}</style>

      {/* Animated dot grid */}
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 opacity-100" />

      {/* Scan line effect */}
      <div className="scan-line pointer-events-none fixed left-0 top-0 z-10 h-[2px] w-full bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />

      {/* Gradient vignette */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(16,185,129,0.06),transparent)]" />

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-16">

        {/* ── HEADER ── */}
        <header className="mb-20">
          {/* Top bar */}
          <div className="hero-line mb-10 flex items-center gap-3" style={{ animationDelay: '0ms' }}>
            <div className="h-px flex-1 bg-white/10" />
            <span className="font-mono-custom text-[10px] font-bold tracking-[0.3em] text-white/30">
              BILLONE · INTERNAL TOOLS · OCS TEAM
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* Main title */}
          <div className="hero-line text-center" style={{ animationDelay: '100ms' }}>
            <div className="mb-3 inline-block rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5">
              <span className="font-mono-custom text-[11px] font-bold tracking-[0.25em] text-emerald-400">
                PROMOTION TOOLS HUB
              </span>
            </div>

            <h1 className="font-display mt-4 text-[clamp(2.8rem,7vw,5.5rem)] font-extrabold leading-[0.95] tracking-tight text-white">
              Tools for
              <br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
                OCS Config
              </span>
            </h1>

            <p className="mt-6 text-base text-white/40" style={{ fontFamily: "'Space Mono', monospace" }}>
              ศูนย์รวมเครื่องมือจัดการข้อมูลโปรโมชันและระบบ config OCS
              <span className="blink ml-1 text-emerald-400">_</span>
            </p>
          </div>

          {/* Stats row */}
          <div className="hero-line mt-12 flex justify-center gap-12" style={{ animationDelay: '200ms' }}>
            {[
              { val: '6', label: 'Tools' },
              { val: '100%', label: 'Internal' },
              { val: 'Arm_MosRTC', label: 'Version' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="font-display text-2xl font-extrabold text-white">{s.val}</div>
                <div className="mt-0.5 font-mono text-[10px] tracking-widest text-white/25">{s.label}</div>
              </div>
            ))}
          </div>
        </header>

        {/* ── GRID ── */}
        <section>
          <div className="mb-8 flex items-center gap-4">
            <span className="font-mono-custom text-[10px] tracking-[0.3em] text-white/25">AVAILABLE TOOLS</span>
            <div className="h-px flex-1 bg-white/[0.06]" />
            <span className="font-mono-custom text-[10px] text-white/20">{tools.length} modules</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map(tool => <ToolCard key={tool.href} {...tool} />)}
          </div>
        </section>

        {/* ── CUTENESS ZONE (THE MULTIPLE LOOPS RUNNING MULTIPARTY - FIXED) ── */}
        <div className="pointer-events-none relative mt-24 h-32 w-full overflow-hidden border-b-2 border-dashed border-white/5">
          
          {/* ตัวที่ 1: น้องแมวดำ */}
          <div className="pet-container pet-1 text-6xl filter drop-shadow-[0_0_12px_rgba(52,211,153,0.5)]">
            🐈‍⬛
          </div>

          {/* ตัวที่ 2: น้องไดโนเสาร์ */}
          <div className="pet-container pet-2 text-5xl filter drop-shadow-[0_0_12px_rgba(45,212,191,0.5)]">
            🦖
          </div>

          {/* ตัวที่ 3: น้องหมาหน้ามึน */}
          <div className="pet-container pet-3 text-5xl filter drop-shadow-[0_0_12px_rgba(251,191,36,0.4)]">
            🐕
          </div>

          {/* ตัวที่ 4: น้องกระต่าย */}
          <div className="pet-container pet-4 text-5xl filter drop-shadow-[0_0_12px_rgba(244,63,94,0.4)]">
            🐇
          </div>

          {/* ตัวที่ 5: เจ้าจิ้งจอก */}
          <div className="pet-container pet-5 text-5xl filter drop-shadow-[0_0_12px_rgba(99,102,241,0.4)]">
            🦊
          </div>

        </div>

        {/* ── FOOTER ── */}
        <footer className="mt-6 border-t border-white/[0.06] pt-10">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex items-center gap-3">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="font-mono-custom text-[10px] tracking-[0.3em] text-white/25">SYSTEM ONLINE</span>
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </div>
            <p className="font-mono-custom text-[11px] text-white/15">
              ARM@MOS · BILLONE INTERNAL ANALYTICS SYSTEMS · © {new Date().getFullYear()}
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}