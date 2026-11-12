"use client";

import React, { useState, useEffect } from 'react';

// กำหนดประเภทข้อมูลของ Query
interface QueryItem {
  id: string;
  title: string;
  category: string;
  queryText: string;
  description: string;
}

export default function QueryStorageApp() {
  const [queries, setQueries] = useState<QueryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<QueryItem | null>(null);
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // โหลดข้อมูลจาก localStorage เมื่อเปิดแอปครั้งแรก
  useEffect(() => {
    const saved = localStorage.getItem('my_queries');
    if (saved) {
      const parsed: QueryItem[] = JSON.parse(saved);
      setQueries(parsed);
      if (parsed.length > 0) {
        setSelectedItem(parsed[0]);
      }
    } else {
      const initial: QueryItem[] = [
        {
          id: '1',
          title: 'ดึงข้อมูลสมาชิก Active',
          category: 'Users',
          queryText: 'SELECT * FROM users WHERE status = "active" ORDER BY created_at DESC;',
          description: 'ใช้สำหรับดูรายชื่อลูกค้าที่ยังแอคทีฟอยู่',
        },
      ];
      setQueries(initial);
      setSelectedItem(initial[0]);
      localStorage.setItem('my_queries', JSON.stringify(initial));
    }
  }, []);

  // ฟังก์ชันบันทึกข้อมูลลง localStorage
  const saveToLocalStorage = (updatedQueries: QueryItem[]) => {
    setQueries(updatedQueries);
    localStorage.setItem('my_queries', JSON.stringify(updatedQueries));
  };

  // กรองรายการตามคำค้นหา
  const filteredQueries = queries.filter(
    (q) =>
      q.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      q.category.toLowerCase().includes(searchKeyword.toLowerCase())
  );

  // เลือกรายการเพื่อแก้ไข
  const handleSelectQuery = (item: QueryItem) => {
    setSelectedItem({ ...item });
  };

  // เพิ่ม Query ใหม่
  const handleNewQuery = () => {
    const newItem: QueryItem = {
      id: Date.now().toString(),
      title: 'Query ใหม่ของฉัน',
      category: 'General',
      queryText: 'SELECT * FROM table_name;',
      description: '',
    };
    const updated = [newItem, ...queries];
    saveToLocalStorage(updated);
    setSelectedItem(newItem);
  };

  // บันทึกการเปลี่ยนแปลงของรายการที่เลือก
  const handleSaveChange = () => {
    if (!selectedItem) return;
    const updated = queries.map((q) => (q.id === selectedItem.id ? selectedItem : q));
    saveToLocalStorage(updated);
    alert('บันทึกข้อมูลเรียบร้อย!');
  };

  // ลบ Query
  const handleDelete = (id: string) => {
    if (confirm('คุณต้องการลบ Query นี้ใช่หรือไม่?')) {
      const updated = queries.filter((q) => q.id !== id);
      saveToLocalStorage(updated);
      setSelectedItem(updated.length > 0 ? updated[0] : null);
    }
  };

  // คัดลอกข้อความ
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('คัดลอกคำสั่ง Query ไปยังคลิปบอร์ดแล้ว!');
  };

  return (
    <div className="bg-slate-50 text-slate-800 h-screen flex flex-col font-sans">
      {/* Header */}
      <header className="bg-indigo-600 text-white shadow-md px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          🗂️ My Query Storage
        </h1>
        <button
          onClick={handleNewQuery}
          className="bg-indigo-500 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1 shadow"
        >
          ➕ เพิ่ม Query ใหม่
        </button>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-1/3 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-100">
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="🔍 ค้นหาชื่อ หรือ หมวดหมู่..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
            {filteredQueries.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelectQuery(item)}
                className={`p-4 hover:bg-slate-50 cursor-pointer transition ${
                  selectedItem?.id === item.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-medium text-slate-900 truncate">{item.title}</h3>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                    {item.category}
                  </span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-1 font-mono">{item.queryText}</p>
              </div>
            ))}

            {filteredQueries.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-sm">
                ไม่พบรายการ Query ที่บันทึกไว้
              </div>
            )}
          </div>
        </aside>

        {/* Workspace */}
        <main className="flex-1 bg-slate-50 p-6 overflow-y-auto flex flex-col">
          {selectedItem ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-800">รายละเอียด Query</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(selectedItem.queryText)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm transition"
                  >
                    📋 คัดลอกโค้ด
                  </button>
                  <button
                    onClick={() => handleDelete(selectedItem.id)}
                    className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-sm transition"
                  >
                    🗑️ ลบ
                  </button>
                </div>
              </div>

              <div className="space-y-4 flex-1 flex flex-col">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">ชื่อ Query</label>
                    <input
                      type="text"
                      value={selectedItem.title}
                      onChange={(e) => setSelectedItem({ ...selectedItem, title: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">หมวดหมู่ (Category)</label>
                    <input
                      type="text"
                      value={selectedItem.category}
                      onChange={(e) => setSelectedItem({ ...selectedItem, category: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex-1 flex flex-col">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">คำสั่ง Query (SQL / โค้ด)</label>
                  <textarea
                    value={selectedItem.queryText}
                    onChange={(e) => setSelectedItem({ ...selectedItem, queryText: e.target.value })}
                    rows={10}
                    className="w-full flex-1 p-3 border border-slate-300 rounded-lg text-sm font-mono bg-slate-900 text-emerald-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">หมายเหตุ / คำอธิบายเพิ่มเติม</label>
                  <input
                    type="text"
                    value={selectedItem.description}
                    onChange={(e) => setSelectedItem({ ...selectedItem, description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveChange}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm font-medium shadow transition"
                  >
                    💾 บันทึกการเปลี่ยนแปลง
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <p className="text-4xl mb-2">👈</p>
              <p className="text-sm">เลือกรายการทางซ้าย หรือกดปุ่ม "เพิ่ม Query ใหม่" ด้านบน</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}