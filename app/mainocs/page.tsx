"use client";

import { Calculator, FileText, GitCompare, ArrowUpRight, Shuffle, Hash, Sparkles, CheckSquare, X, Plus, Trash2, Bot, Copy, Check, ExternalLink, Search, Cpu, Radar, Wifi } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

type ToolCardProps = {
  title: string;
  titleThai: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  index: number;
  tag: string;
};

type Task = {
  id: string;
  text: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  toolHref?: string;
  createdAt: string;
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
    title: 'Special Number Summary',
    titleThai: 'สรุปหมายเลขพิเศษ',
    description: 'ระบบสรุปหมายเลขพิเศษจากไฟล์ข้อมูลต่างๆ',
    href: '/summaryspecialnumber',
    icon: Sparkles,
    index: 7,
    tag: 'SUMMARY'
  },
  {
    title: 'Mapper Pro',
    titleThai: 'สรุปหมายเลขพิเศษ',
    description: 'เชื่อมข้อมูลระหว่างไฟล์',
    href: '/mapper',
    icon: Sparkles,
    index: 8,
    tag: 'SUMMARY'
  },
];

const QUICK_TEMPLATES = [
  { text: 'Config Promotion OCS ชุดใหม่', priority: 'high', toolHref: '/extractor' },
  { text: 'Formatting เบอร์โทรศัพท์ & SQL', priority: 'medium', toolHref: '/phonenumberreformatter' },
  { text: 'คำนวณ Prorate รอบบิลปัจจุบัน', priority: 'medium', toolHref: '/prorate' },
  { text: 'Compare ไฟล์ข้อมูลรายวัน', priority: 'low', toolHref: '/comparator' },
];

const ToolCard = ({ title, titleThai, description, href, icon: Icon, index, tag }: ToolCardProps) => {
  return (
    <a
      href={href}
      className="tool-card unit-card group relative flex flex-col justify-between overflow-hidden border border-emerald-500/[0.12] bg-white/[0.02] p-8 backdrop-blur-xl transition-all duration-500 hover:-translate-y-1.5 hover:bg-white/[0.05] hover:shadow-[0_8px_32px_rgba(52,211,153,0.18)]"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* corner brackets — HUD targeting frame, appears on hover */}
      <span className="corner-bracket corner-tl" />
      <span className="corner-bracket corner-tr" />
      <span className="corner-bracket corner-bl" />
      <span className="corner-bracket corner-br" />

      <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-emerald-500/20 blur-[80px] transition-all duration-700 group-hover:bg-emerald-400/40" />

      {/* faint circuit trace running through the card */}
      <svg className="pointer-events-none absolute bottom-0 right-0 h-24 w-24 opacity-[0.06] transition-opacity duration-500 group-hover:opacity-20" viewBox="0 0 100 100">
        <path d="M100 20 H60 V50 H30 V100" stroke="#34d399" strokeWidth="2" fill="none" />
        <circle cx="60" cy="50" r="3" fill="#34d399" />
        <circle cx="30" cy="100" r="3" fill="#34d399" />
      </svg>

      <div className="relative z-10">
        <div className="mb-6 flex items-start justify-between">
          <div className="hex-frame flex h-14 w-14 items-center justify-center text-emerald-400 shadow-inner transition-transform duration-500 group-hover:scale-110">
            <Icon size={22} strokeWidth={1.5} />
          </div>
          <span className="rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.2em] text-emerald-300 backdrop-blur-md">
            {tag}
          </span>
        </div>

        <div className="mb-2 flex items-center gap-2 font-mono text-[10px] font-bold tracking-[0.25em] text-emerald-500/40">
          <span>UNIT.{String(index).padStart(2, '0')}</span>
          <span className="h-px flex-1 bg-emerald-500/20" />
          <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />READY</span>
        </div>

        <h3 className="mb-2 text-2xl font-bold tracking-tight text-white/90 transition-colors group-hover:text-white">
          {title}
        </h3>
        <p className="mb-4 font-mono text-xs font-medium text-emerald-400/70">{titleThai}</p>
        <p className="line-clamp-3 text-sm leading-relaxed text-white/50 transition-colors group-hover:text-white/70">
          {description}
        </p>
      </div>

      <div className="relative z-10 mt-8 flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-xs font-bold tracking-widest text-emerald-500/50 transition-colors duration-300 group-hover:text-emerald-400">
          <span className="relative">
            EXECUTE
            <span className="absolute -bottom-1 left-0 h-px w-0 bg-emerald-400 transition-all duration-500 group-hover:w-full" />
          </span>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-white/10 bg-white/5 text-white/40 transition-all duration-300 group-hover:border-emerald-400 group-hover:bg-emerald-500 group-hover:text-black">
          <ArrowUpRight size={16} strokeWidth={2} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </div>
    </a>
  );
};

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isTaskOpen, setIsTaskOpen] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [selectedToolHref, setSelectedToolHref] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('all');
  const [copied, setCopied] = useState(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const DEFAULT_TASKS: Task[] = [
    { id: '1', text: 'Config Promotion OCS ชุดใหม่', completed: false, priority: 'high', toolHref: '/extractor', createdAt: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) },
    { id: '2', text: 'Mapping เบอร์โทรศัพท์ลูกค้า VIP', completed: false, priority: 'medium', toolHref: '/phonenumberreformatter', createdAt: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) },
    { id: '3', text: 'ตรวจเช็กไฟล์ Prorate รอบบิลนี้', completed: true, priority: 'low', toolHref: '/prorate', createdAt: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) },
  ];

  // Everyone reads/writes the same key on the server, so tasks are
  // shared across the whole team instead of being stuck per-browser.
  const fetchTasks = async (seedIfEmpty = false) => {
    try {
      const res = await fetch('/api/tasks', { cache: 'no-store' });
      if (!res.ok) return;
      const data: Task[] = await res.json();
      if (seedIfEmpty && data.length === 0) {
        setTasks(DEFAULT_TASKS);
        await fetch('/api/tasks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(DEFAULT_TASKS),
        });
      } else {
        setTasks(data);
      }
    } catch (e) {
      console.error('โหลดงานจากทีมไม่สำเร็จ', e);
    }
  };

  // Push the full task list to the server so teammates see the change.
  const persistTasks = async (updated: Task[]) => {
    setTasks(updated);
    setIsSyncing(true);
    try {
      await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch (e) {
      console.error('บันทึกงานไปยังทีมไม่สำเร็จ', e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    fetchTasks(true);
    // poll so changes made by teammates show up without a manual refresh
    const interval = setInterval(() => fetchTasks(false), 6000);
    return () => clearInterval(interval);
  }, []);

  // grab the latest list the moment the drawer is opened
  useEffect(() => {
    if (isTaskOpen) fetchTasks(false);
  }, [isTaskOpen]);

  const activeTasksCount = tasks.filter(t => !t.completed).length;
  const completedTasksCount = tasks.filter(t => t.completed).length;
  const progressPercent = tasks.length > 0 ? Math.round((completedTasksCount / tasks.length) * 100) : 0;

  const handleAddTask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTaskText.trim()) return;
    const newTask: Task = {
      id: Date.now().toString(),
      text: newTaskText.trim(),
      completed: false,
      priority: newTaskPriority,
      toolHref: selectedToolHref || undefined,
      createdAt: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
    };
    persistTasks([newTask, ...tasks]);
    setNewTaskText('');
    setSelectedToolHref('');
  };

  const addFromTemplate = (tmpl: typeof QUICK_TEMPLATES[0]) => {
    const newTask: Task = {
      id: Date.now().toString(),
      text: tmpl.text,
      completed: false,
      priority: tmpl.priority as 'high' | 'medium' | 'low',
      toolHref: tmpl.toolHref,
      createdAt: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
    };
    persistTasks([newTask, ...tasks]);
  };

  const toggleTask = (id: string) => {
    persistTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTask = (id: string) => {
    persistTasks(tasks.filter(t => t.id !== id));
  };

  const copySummaryToClipboard = () => {
    const pendingTasks = tasks.filter(t => !t.completed);
    if (pendingTasks.length === 0) {
      navigator.clipboard.writeText('🎉 ไม่มีงานค้างในระบบ (BILLONE Internal Analytics)');
    } else {
      let text = `📋 รายงานงานค้างประจำวัน (${new Date().toLocaleDateString('th-TH')})\n`;
      text += `-----------------------------------\n`;
      pendingTasks.forEach((t, i) => {
        const pIcon = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢';
        text += `${i + 1}. ${pIcon} [${t.priority.toUpperCase()}] ${t.text}\n`;
      });
      text += `-----------------------------------\n`;
      text += `รวมคงค้างทั้งหมด: ${pendingTasks.length} รายการ`;
      navigator.clipboard.writeText(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.text.toLowerCase().includes(searchQuery.toLowerCase());
    if (filterStatus === 'pending') return matchesSearch && !task.completed;
    if (filterStatus === 'completed') return matchesSearch && task.completed;
    return matchesSearch;
  });

  // Animated Background Canvas — now draws a "sensor grid" node/link field instead of soft particles
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

    let particles: { x: number, y: number, vx: number, vy: number, size: number, alpha: number }[] = [];
    const particleCount = Math.floor((window.innerWidth * window.innerHeight) / 15000);

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 1.6 + 0.5,
        alpha: Math.random() * 0.5 + 0.1
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        // square "sensor node" instead of a round dot
        ctx.fillStyle = `rgba(52, 211, 153, ${p.alpha})`;
        ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.sqrt(Math.pow(p.x - p2.x, 2) + Math.pow(p.y - p2.y, 2));

          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(52, 211, 153, ${0.1 * (1 - dist / 120)})`;
            ctx.stroke();
          }
        }
      });

      requestAnimationFrame(draw);
    };
    draw();
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <div className="relative min-h-screen selection:bg-emerald-500/30 selection:text-emerald-100 bg-[#050914] font-sans">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;700;800&family=Outfit:wght@700;800;900&display=swap');

        .font-display { font-family: 'Outfit', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .font-sans { font-family: 'Inter', sans-serif; }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(30px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .tool-card {
          opacity: 0;
          animation: fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .hero-element {
          opacity: 0;
          animation: fade-up 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .text-gradient {
          background: linear-gradient(135deg, #34d399 0%, #0d9488 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* ── HUD scanline overlay across the whole page ── */
        .scanlines {
          background: repeating-linear-gradient(
            to bottom,
            rgba(52, 211, 153, 0.025) 0px,
            rgba(52, 211, 153, 0.025) 1px,
            transparent 1px,
            transparent 3px
          );
        }

        /* ── hex-grid backdrop ── */
        .hex-grid {
          background-image:
            linear-gradient(30deg, rgba(52,211,153,0.05) 1px, transparent 1px),
            linear-gradient(150deg, rgba(52,211,153,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(52,211,153,0.05) 1px, transparent 1px);
          background-size: 56px 98px;
        }

        /* ── hexagonal icon frame ── */
        .hex-frame {
          position: relative;
          background: rgba(52, 211, 153, 0.08);
          clip-path: polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0% 50%);
          border: 1px solid rgba(52, 211, 153, 0.35);
        }

        /* ── HUD corner brackets on card hover ── */
        .unit-card { position: relative; }
        .corner-bracket {
          position: absolute;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(52, 211, 153, 0);
          transition: all 0.4s ease;
          z-index: 20;
        }
        .unit-card:hover .corner-bracket { border-color: rgba(52, 211, 153, 0.8); }
        .corner-tl { top: 10px; left: 10px; border-right: none; border-bottom: none; }
        .corner-tr { top: 10px; right: 10px; border-left: none; border-bottom: none; }
        .corner-bl { bottom: 10px; left: 10px; border-right: none; border-top: none; }
        .corner-br { bottom: 10px; right: 10px; border-left: none; border-top: none; }

        /* ── boot-up flicker for the hero title ── */
        @keyframes boot-flicker {
          0% { opacity: 0; filter: brightness(2.5); }
          3% { opacity: 1; }
          6% { opacity: 0.3; }
          9% { opacity: 1; filter: brightness(1); }
          100% { opacity: 1; filter: brightness(1); }
        }
        .boot-flicker { animation: boot-flicker 1.4s steps(1, end) forwards; }

        /* ── blinking terminal cursor ── */
        @keyframes blink-cursor {
          0%, 45% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        .term-cursor::after {
          content: '_';
          animation: blink-cursor 1s step-end infinite;
          color: #34d399;
        }

        @keyframes led-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        .led { animation: led-pulse 1.6s ease-in-out infinite; }

        /* ── sweeping laser beams across the backdrop ── */
        @keyframes laser-sweep-a {
          0%   { transform: translate(-30vw, -20vh) rotate(35deg); opacity: 0; }
          8%   { opacity: 0.55; }
          20%  { opacity: 0; }
          100% { transform: translate(60vw, 70vh) rotate(35deg); opacity: 0; }
        }
        @keyframes laser-sweep-b {
          0%   { transform: translate(40vw, -30vh) rotate(-25deg); opacity: 0; }
          8%   { opacity: 0.4; }
          18%  { opacity: 0; }
          100% { transform: translate(-40vw, 80vh) rotate(-25deg); opacity: 0; }
        }
        .laser-beam {
          position: fixed;
          top: 0; left: 0;
          width: 2px;
          height: 55vh;
          pointer-events: none;
          z-index: 1;
        }
        .laser-beam-1 {
          background: linear-gradient(to bottom, rgba(52,211,153,0) 0%, rgba(52,211,153,0.9) 45%, rgba(52,211,153,0) 100%);
          box-shadow: 0 0 12px 1px rgba(52,211,153,0.7);
          animation: laser-sweep-a 9s ease-in infinite;
          animation-delay: 1s;
        }
        .laser-beam-2 {
          background: linear-gradient(to bottom, rgba(45,212,191,0) 0%, rgba(45,212,191,0.8) 45%, rgba(45,212,191,0) 100%);
          box-shadow: 0 0 12px 1px rgba(45,212,191,0.6);
          animation: laser-sweep-b 13s ease-in infinite;
          animation-delay: 5s;
        }
        .laser-beam-3 {
          background: linear-gradient(to bottom, rgba(52,211,153,0) 0%, rgba(52,211,153,0.6) 45%, rgba(52,211,153,0) 100%);
          box-shadow: 0 0 10px 1px rgba(52,211,153,0.5);
          animation: laser-sweep-a 16s ease-in infinite;
          animation-delay: 9.5s;
        }

        /* ── rotating radar sweep, tucked in a corner ── */
        @keyframes radar-rotate {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .radar-sweep {
          position: fixed;
          top: -180px;
          right: -180px;
          width: 480px;
          height: 480px;
          border-radius: 50%;
          border: 1px solid rgba(52,211,153,0.08);
          pointer-events: none;
          z-index: 1;
        }
        .radar-sweep::before {
          content: '';
          position: absolute;
          inset: 60px;
          border-radius: 50%;
          border: 1px solid rgba(52,211,153,0.06);
        }
        .radar-sweep::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: conic-gradient(from 0deg, rgba(52,211,153,0.22), transparent 25%);
          animation: radar-rotate 6s linear infinite;
        }

        /* ── a small craft drifting slowly behind everything ── */
        @keyframes ship-drift {
          0%   { transform: translate(-10vw, 15vh) rotate(4deg); }
          50%  { transform: translate(55vw, 6vh) rotate(-2deg); }
          100% { transform: translate(120vw, 20vh) rotate(4deg); }
        }
        .bg-ship {
          position: fixed;
          top: 0;
          left: 0;
          font-size: 2rem;
          z-index: 1;
          pointer-events: none;
          filter: drop-shadow(0 0 10px rgba(52,211,153,0.7)) drop-shadow(0 0 22px rgba(45,212,191,0.4));
          opacity: 0.85;
          animation: ship-drift 38s linear infinite;
        }
        .bg-ship::after {
          content: '';
          position: absolute;
          top: 50%;
          right: 100%;
          width: 90px;
          height: 1px;
          background: linear-gradient(to left, rgba(52,211,153,0.6), transparent);
        }

        @keyframes twinkle {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.9; }
        }
        .star { position: fixed; border-radius: 50%; background: #34d399; pointer-events: none; z-index: 1; animation: twinkle 3s ease-in-out infinite; }

        /* ── data-flow strip: glowing packets travelling along circuit lanes ── */
        .data-flow { position: relative; height: 8rem; overflow: hidden; }
        .data-lane { position: absolute; left: 0; width: 100%; height: 1px; background: rgba(52,211,153,0.12); }
        .packet {
          position: absolute;
          top: 50%;
          width: 46px;
          height: 2px;
          transform: translateY(-50%);
          background: linear-gradient(to right, transparent, #34d399, transparent);
          box-shadow: 0 0 8px 1px rgba(52,211,153,0.8);
        }
        @keyframes packet-move-r {
          from { left: -10%; }
          to   { left: 110%; }
        }
        @keyframes packet-move-l {
          from { left: 110%; }
          to   { left: -10%; }
        }
        .node-pulse {
          position: absolute;
          top: 50%;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #34d399;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 10px 2px rgba(52,211,153,0.7);
          animation: led-pulse 2.2s ease-in-out infinite;
        }

      `}</style>

      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 opacity-40 mix-blend-screen" />
      <div className="pointer-events-none fixed inset-0 scanlines" />
      <div className="pointer-events-none fixed inset-0 hex-grid opacity-60" />

      <div className="pointer-events-none fixed -left-[20%] -top-[10%] h-[50vw] w-[50vw] rounded-full bg-emerald-900/20 blur-[120px]" />
      <div className="pointer-events-none fixed -right-[10%] top-[20%] h-[40vw] w-[40vw] rounded-full bg-teal-900/10 blur-[100px]" />
      <div className="pointer-events-none fixed bottom-0 left-[20%] h-[30vw] w-[60vw] rounded-full bg-emerald-800/10 blur-[150px]" />

      {/* ── laser sweeps, radar, drifting craft & starfield ── */}
      <div className="laser-beam laser-beam-1" />
      <div className="laser-beam laser-beam-2" />
      <div className="laser-beam laser-beam-3" />
      <div className="radar-sweep" />
      <div className="bg-ship">🛸</div>
      {isMounted && [...Array(24)].map((_, i) => {
        const seed = (i * 37) % 100;
        return (
          <span
            key={i}
            className="star"
            style={{
              top: `${(i * 53) % 100}%`,
              left: `${(i * 29 + seed) % 100}%`,
              width: `${1 + (i % 3)}px`,
              height: `${1 + (i % 3)}px`,
              animationDelay: `${(i % 7) * 0.4}s`,
            }}
          />
        );
      })}

      {/* ── FLOATING BUTTON: TASK CONTROL ── */}
      <button
        onClick={() => setIsTaskOpen(true)}
        className="fixed bottom-8 right-8 z-40 flex items-center gap-3 rounded-sm border border-emerald-500/30 bg-[#0b1329]/90 px-5 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all hover:scale-105 hover:border-emerald-400 hover:bg-[#0f1b3a]"
      >
        <div className="relative flex items-center justify-center">
          <Bot size={20} className="text-emerald-400" />
          {isMounted && activeTasksCount > 0 && (
            <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 font-mono text-[10px] font-bold text-white shadow-lg led">
              {activeTasksCount}
            </span>
          )}
        </div>
        <div className="text-left">
          <div className="font-mono text-xs font-bold tracking-widest text-emerald-400">TASK.CTRL</div>
          <div className="text-[10px] text-white/50 font-mono">
            {isMounted ? `PENDING ${activeTasksCount} · ${progressPercent}%` : 'BOOTING...'}
          </div>
        </div>
      </button>

      {/* ── TASKS SLIDE-OVER DRAWER ── */}
      {isTaskOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="relative flex h-full w-full max-w-lg flex-col border-l border-emerald-500/20 bg-[#090e1d] p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <div className="hex-frame flex h-9 w-9 items-center justify-center text-emerald-400">
                  <Bot size={18} />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold text-white leading-tight">TASK.CTRL</h2>
                  <p className="font-mono text-[10px] text-emerald-500/60 tracking-widest flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${isSyncing ? 'bg-amber-400 led' : 'bg-emerald-400'}`} />
                    {isSyncing ? 'SYNCING...' : 'TEAM SHARED · LIVE'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copySummaryToClipboard}
                  title="ก๊อปปี้สรุปงานค้างไปแปะใน LINE / Teams"
                  className="flex items-center gap-1.5 rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs text-emerald-300 hover:bg-emerald-500/20 transition-all"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copied ? 'คัดลอกแล้ว!' : 'Copy รายงาน'}</span>
                </button>
                <button
                  onClick={() => setIsTaskOpen(false)}
                  className="rounded-sm p-2 text-white/50 hover:bg-white/5 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4 rounded-sm border border-white/5 bg-white/[0.02] p-3">
              <div className="flex justify-between font-mono text-xs mb-1.5">
                <span className="text-white/60 tracking-widest">CLEAR-RATE</span>
                <span className="text-emerald-400 font-bold">{progressPercent}%</span>
              </div>
              <div className="h-2 w-full rounded-none bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Quick Templates */}
            <div className="mt-4">
              <div className="font-mono text-[11px] text-white/40 uppercase mb-2 tracking-widest">// สร้างงานด่วน (Quick Add)</div>
              <div className="flex flex-wrap gap-2">
                {QUICK_TEMPLATES.map((tmpl, i) => (
                  <button
                    key={i}
                    onClick={() => addFromTemplate(tmpl)}
                    className="flex items-center gap-1 rounded-sm border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300 transition-all"
                  >
                    <Plus size={12} />
                    <span>{tmpl.text}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Input Form */}
            <form onSubmit={handleAddTask} className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4">
              <input
                type="text"
                placeholder="> เพิ่มงานค้างใหม่..."
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                className="w-full rounded-sm border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-emerald-500 focus:outline-none font-mono"
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1.5">
                  {(['high', 'medium', 'low'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewTaskPriority(p)}
                      className={`rounded-sm px-2.5 py-1 text-[11px] font-mono capitalize transition-colors ${
                        newTaskPriority === p
                          ? p === 'high'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : p === 'medium'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-white/5 text-white/40 border border-transparent'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <select
                  value={selectedToolHref}
                  onChange={(e) => setSelectedToolHref(e.target.value)}
                  className="rounded-sm border border-white/10 bg-[#0d152a] px-2.5 py-1 text-[11px] text-white/70 focus:border-emerald-500 focus:outline-none font-mono"
                >
                  <option value="">-- ไม่ผูกโมดูล --</option>
                  {tools.map((t) => (
                    <option key={t.href} value={t.href}>{t.title}</option>
                  ))}
                </select>

                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-sm bg-emerald-500 px-4 py-2 text-xs font-bold text-black transition-hover hover:bg-emerald-400"
                >
                  <Plus size={16} /> เพิ่ม
                </button>
              </div>
            </form>

            {/* Filter & Search Bar */}
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-4">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-2.5 text-white/30" />
                <input
                  type="text"
                  placeholder="ค้นหางาน..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-sm border border-white/10 bg-white/5 pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none font-mono"
                />
              </div>

              <div className="flex gap-1">
                {(['all', 'pending', 'completed'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(st)}
                    className={`rounded-sm px-2.5 py-1 text-[11px] font-mono capitalize transition-all ${
                      filterStatus === st
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'text-white/40 hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Task List */}
            <div className="mt-4 flex-1 overflow-y-auto space-y-2.5 pr-1">
              {filteredTasks.length === 0 ? (
                <div className="flex h-36 flex-col items-center justify-center text-center text-white/30">
                  <CheckSquare size={32} className="mb-2" />
                  <p className="text-xs font-mono">NO TASKS FOUND</p>
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`group flex items-center justify-between rounded-sm border p-3.5 transition-all ${
                      task.completed
                        ? 'border-white/5 bg-white/[0.01] opacity-40'
                        : 'border-white/10 bg-white/[0.03] hover:border-emerald-500/30'
                    }`}
                  >
                    <div className="flex items-start gap-3 overflow-hidden pr-2">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => toggleTask(task.id)}
                        className="mt-0.5 h-4 w-4 rounded-sm border-white/20 bg-transparent text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                      <div className="flex flex-col overflow-hidden">
                        <span className={`text-xs font-medium ${task.completed ? 'line-through text-white/40' : 'text-white/90'}`}>
                          {task.text}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-white/30 font-mono">{task.createdAt}</span>
                          {task.toolHref && (
                            <a
                              href={task.toolHref}
                              className="inline-flex items-center gap-1 text-[10px] text-emerald-400/80 hover:text-emerald-300 hover:underline"
                            >
                              <span>ไปที่โมดูล</span>
                              <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-mono font-bold uppercase ${
                          task.priority === 'high'
                            ? 'bg-rose-500/20 text-rose-400'
                            : task.priority === 'medium'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full led ${task.completed ? '' : ''} ${
                          task.priority === 'high' ? 'bg-rose-400' : task.priority === 'medium' ? 'bg-amber-400' : 'bg-emerald-400'
                        }`} />
                        {task.priority}
                      </span>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="text-white/20 hover:text-rose-400 transition-colors p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Summary */}
            <div className="mt-auto border-t border-white/10 pt-3 flex items-center justify-between font-mono text-xs text-white/40">
              <span>คงเหลือ: {activeTasksCount} งาน</span>
              <span>เสร็จแล้ว: {completedTasksCount} งาน</span>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 lg:px-8">
        {/* ── HEADER ── */}
        <header className="mb-24 flex flex-col items-center text-center">
          <div className="hero-element mb-8 inline-flex items-center gap-2 rounded-sm border border-emerald-500/20 bg-emerald-500/5 px-4 py-2 backdrop-blur-sm font-mono" style={{ animationDelay: '0ms' }}>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold tracking-widest text-emerald-400">[ SYSTEM.ONLINE ] BILLONE INTERNAL</span>
          </div>

          <div className="hero-element mb-3 flex items-center gap-2 font-mono text-[11px] tracking-[0.3em] text-emerald-500/50 term-cursor" style={{ animationDelay: '60ms' }}>
            <Cpu size={12} />
            <span>INITIALIZING ARM-01</span>
          </div>

          <h1 className="hero-element boot-flicker font-display mb-6 text-5xl font-black leading-tight tracking-tight text-white md:text-7xl lg:text-[5.5rem]" style={{ animationDelay: '150ms' }}>
            Next-Gen <br className="md:hidden" />
            <span className="text-gradient">OCS Config</span>
          </h1>

          <p className="hero-element max-w-2xl text-lg font-medium text-white/50 sm:text-xl" style={{ animationDelay: '250ms' }}>
            A unified intelligence hub for promotion data management, configuration, and analysis. Designed for speed, precision, and efficiency.
          </p>

          <div className="hero-element mt-16 flex flex-wrap justify-center gap-8 md:gap-16" style={{ animationDelay: '350ms' }}>
            {[
              { val: tools.length, label: 'Active Modules' },
              { val: isMounted ? `${activeTasksCount} งาน` : '...', label: 'งานค้าง (Pending)' },
              { val: 'Arm_MosRTC', label: 'Maintainer' },
            ].map(s => (
              <div key={s.label} className="flex flex-col items-center gap-2">
                <span className="font-display text-4xl font-black text-white">{s.val}</span>
                <span className="font-mono text-[11px] font-semibold tracking-widest text-emerald-500/60 uppercase">{s.label}</span>
              </div>
            ))}
          </div>
        </header>

        {/* ── MODULES GRID ── */}
        <section className="relative">
          <div className="hero-element mb-12 flex items-center justify-between" style={{ animationDelay: '450ms' }}>
            <div className="flex items-center gap-4">
              <div className="h-8 w-1 bg-emerald-500"></div>
              <h2 className="font-display text-2xl font-bold text-white">System Modules</h2>
              <span className="font-mono text-[10px] tracking-widest text-emerald-500/50 border border-emerald-500/20 rounded-sm px-2 py-1">{tools.length} ONLINE</span>
            </div>
            <div className="h-px flex-1 mx-6 bg-gradient-to-r from-emerald-500/20 to-transparent"></div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tools.map((tool, idx) => (
              <div key={tool.href} className={idx === 0 || idx === 3 ? "sm:col-span-2 lg:col-span-2" : "col-span-1"}>
                <ToolCard {...tool} />
              </div>
            ))}
          </div>
        </section>

        {/* ── DATA FLOW STRIP: live packets travelling across the system bus ── */}
        <div className="hero-element data-flow mt-32 w-full [mask-image:linear-gradient(to_bottom,white,transparent)]" style={{ animationDelay: '800ms' }}>
          {[18, 40, 62, 84].map((topPct, laneIdx) => (
            <div key={laneIdx} className="data-lane" style={{ top: `${topPct}%` }}>
              <span className="node-pulse" style={{ left: '8%', animationDelay: `${laneIdx * 0.3}s` }} />
              <span className="node-pulse" style={{ left: '50%', animationDelay: `${laneIdx * 0.5 + 0.6}s` }} />
              <span className="node-pulse" style={{ left: '92%', animationDelay: `${laneIdx * 0.4 + 1.1}s` }} />
              <span
                className="packet"
                style={{
                  animation: `${laneIdx % 2 === 0 ? 'packet-move-r' : 'packet-move-l'} ${4.5 + laneIdx * 1.4}s linear infinite`,
                  animationDelay: `${laneIdx * 0.8}s`,
                }}
              />
              <span
                className="packet"
                style={{
                  animation: `${laneIdx % 2 === 0 ? 'packet-move-r' : 'packet-move-l'} ${5.5 + laneIdx * 1.1}s linear infinite`,
                  animationDelay: `${laneIdx * 0.8 + 2.5}s`,
                }}
              />
            </div>
          ))}
        </div>

        {/* ── FOOTER ── */}
        <footer className="hero-element mt-12 flex flex-col items-center justify-between gap-6 border-t border-emerald-500/10 pt-12 md:flex-row" style={{ animationDelay: '900ms' }}>
          <div className="flex items-center gap-3 rounded-sm border border-white/5 bg-white/[0.02] px-4 py-2 backdrop-blur-md">
            <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] led" />
            <span className="font-mono text-xs font-semibold tracking-wider text-white/60">ALL SYSTEMS NOMINAL</span>
          </div>

          <p className="font-sans text-sm font-medium text-white/40">
            © {new Date().getFullYear()} ARM@MOS · BILLONE INTERNAL ANALYTICS
          </p>

          <div className="flex gap-4">
            <div className="h-8 w-8 rounded-sm border border-white/10 bg-white/5 flex items-center justify-center text-white/30 hover:bg-emerald-500/20 hover:text-emerald-400 transition-colors">
              <Radar size={14} />
            </div>
            <div className="h-8 w-8 rounded-sm border border-white/10 bg-white/5 flex items-center justify-center text-white/30 hover:bg-emerald-500/20 hover:text-emerald-400 transition-colors">
              <Wifi size={14} />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}