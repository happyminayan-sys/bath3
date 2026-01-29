
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Printer, ChevronLeft, ChevronRight, Save, RotateCcw, 
  Plus, Trash2, Users, CheckCircle, Info, Edit3, 
  Bold, X, Calendar, Settings, UserPlus, Copy, Globe, ListChecks, Check,
  Undo2, Redo2, Download, Upload, FileJson
} from 'lucide-react';
import { 
  ColorType, DaySchedule, MasterSchedule, 
  MonthlyOverrides, WeeklySchedule, ScheduleSlot 
} from './types';
import { 
  BG_COLOR_MAP, INITIAL_MASTER, INITIAL_RESIDENTS 
} from './constants';

interface HistoryState {
  overrides: MonthlyOverrides;
  weeklyData: WeeklySchedule;
  masterSchedule: MasterSchedule;
}

export default function BathingScheduleApp() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 1, 1));
  const [masterSchedule, setMasterSchedule] = useState<MasterSchedule>(INITIAL_MASTER);
  const [overrides, setOverrides] = useState<MonthlyOverrides>({});
  const [weeklyData, setWeeklyData] = useState<WeeklySchedule>({});
  const [residentList, setResidentList] = useState<string[]>(INITIAL_RESIDENTS);
  const [manualUpdateDate, setManualUpdateDate] = useState<string>('');
  const [isEditingUpdateDate, setIsEditingUpdateDate] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<any[] | null>(null);

  // マスタ設定用履歴ステート
  const [configHistory, setConfigHistory] = useState<MasterSchedule[]>([]);
  const [configHistoryIndex, setConfigHistoryIndex] = useState(0);

  // モーダル編集用履歴ステート（Undo/Redo用）
  const [modalState, setModalState] = useState<{history: string[], index: number}>({ history: [], index: 0 });
  const modalHistoryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 施設名編集用State
  const [facilityName, setFacilityName] = useState('2 階 南 棟');
  const [isEditingFacilityName, setIsEditingFacilityName] = useState(false);
  const facilityNameInputRef = useRef<HTMLInputElement>(null);

  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [editingTarget, setEditingTarget] = useState<{
      type: 'day' | 'week',
      key: string,
      weekIdx?: number,
      slot?: keyof DaySchedule,
      initialHtml: string,
      currentColor: ColorType,
  } | null>(null);

  const [propagateToFuture, setPropagateToFuture] = useState(false);
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const updateDateInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedMaster = localStorage.getItem('bathing_master_v2');
    const savedOverrides = localStorage.getItem('bathing_overrides_v2');
    const savedWeekly = localStorage.getItem('bathing_weekly_v2');
    const savedResidents = localStorage.getItem('bathing_residents_v2');
    const savedUpdateDate = localStorage.getItem('bathing_update_date_v2');
    const savedFacilityName = localStorage.getItem('bathing_facility_name_v2');
    
    const initialMaster = savedMaster ? JSON.parse(savedMaster) : INITIAL_MASTER;
    const initialOverrides = savedOverrides ? JSON.parse(savedOverrides) : {};
    const initialWeekly = savedWeekly ? JSON.parse(savedWeekly) : {};
    const initialResidents = savedResidents ? JSON.parse(savedResidents) : INITIAL_RESIDENTS;
    
    setMasterSchedule(initialMaster);
    setOverrides(initialOverrides);
    setWeeklyData(initialWeekly);
    setResidentList(initialResidents);
    
    if (savedUpdateDate) {
      setManualUpdateDate(savedUpdateDate);
    } else {
      const today = new Date();
      setManualUpdateDate(`${today.getMonth() + 1}/${today.getDate()}`);
    }

    if (savedFacilityName) {
      setFacilityName(savedFacilityName);
    }

    const initialState: HistoryState = {
      overrides: initialOverrides,
      weeklyData: initialWeekly,
      masterSchedule: initialMaster
    };
    setHistory([initialState]);
    setHistoryIndex(0);
  }, []);

  useEffect(() => {
    if (isEditingFacilityName) {
      facilityNameInputRef.current?.focus();
    }
  }, [isEditingFacilityName]);

  // モーダルが開いたとき、またはターゲットが変わったときに履歴とDOMを初期化
  useEffect(() => {
    if (editingTarget) {
        setModalState({ history: [editingTarget.initialHtml], index: 0 });
        if (contentEditableRef.current) {
            contentEditableRef.current.innerHTML = editingTarget.initialHtml;
        }
    } else {
        // モーダルが閉じたときにタイマーをクリア
        if (modalHistoryTimer.current) {
            clearTimeout(modalHistoryTimer.current);
        }
    }
  }, [editingTarget]);

  const pushToHistory = (newOverrides: MonthlyOverrides, newWeekly: WeeklySchedule, newMaster: MasterSchedule) => {
    const newState: HistoryState = {
      overrides: JSON.parse(JSON.stringify(newOverrides)),
      weeklyData: JSON.parse(JSON.stringify(newWeekly)),
      masterSchedule: JSON.parse(JSON.stringify(newMaster))
    };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const state = history[prevIndex];
      setOverrides(state.overrides);
      setWeeklyData(state.weeklyData);
      setMasterSchedule(state.masterSchedule);
      setHistoryIndex(prevIndex);
      showNotification('1つ前の状態に戻しました');
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const state = history[nextIndex];
      setOverrides(state.overrides);
      setWeeklyData(state.weeklyData);
      setMasterSchedule(state.masterSchedule);
      setHistoryIndex(nextIndex);
      showNotification('操作をやり直しました');
    }
  };

  // --- Config Panel History Logic ---
  const openConfig = () => {
      const current = JSON.parse(JSON.stringify(masterSchedule));
      setConfigHistory([current]);
      setConfigHistoryIndex(0);
      setIsConfigOpen(true);
  };

  const pushConfigHistory = (newState: MasterSchedule) => {
      const newHistory = configHistory.slice(0, configHistoryIndex + 1);
      const lastState = newHistory[newHistory.length - 1];
      if (JSON.stringify(lastState) === JSON.stringify(newState)) return;

      newHistory.push(JSON.parse(JSON.stringify(newState)));
      if (newHistory.length > 50) newHistory.shift();
      setConfigHistory(newHistory);
      setConfigHistoryIndex(newHistory.length - 1);
  };

  const undoConfig = () => {
      if (JSON.stringify(masterSchedule) !== JSON.stringify(configHistory[configHistoryIndex])) {
          pushConfigHistory(masterSchedule);
      }
      if (configHistoryIndex > 0) {
          const prevIndex = configHistoryIndex - 1;
          setMasterSchedule(configHistory[prevIndex]);
          setConfigHistoryIndex(prevIndex);
      }
  };

  const redoConfig = () => {
      if (configHistoryIndex < configHistory.length - 1) {
          const nextIndex = configHistoryIndex + 1;
          setMasterSchedule(configHistory[nextIndex]);
          setConfigHistoryIndex(nextIndex);
      }
  };
  // ----------------------------------

  // --- Modal Edit History Logic ---
  const pushModalHistory = (html: string) => {
      setModalState(prev => {
          const currentHistory = prev.history.slice(0, prev.index + 1);
          if (currentHistory.length > 0 && currentHistory[currentHistory.length - 1] === html) {
              return prev;
          }
          const newHistory = [...currentHistory, html];
          if (newHistory.length > 50) newHistory.shift();
          return {
              history: newHistory,
              index: newHistory.length - 1
          };
      });
  };

  const undoModal = () => {
      setModalState(prev => {
          if (prev.index <= 0) return prev;
          const nextIndex = prev.index - 1;
          if (contentEditableRef.current) {
              contentEditableRef.current.innerHTML = prev.history[nextIndex];
          }
          return { ...prev, index: nextIndex };
      });
  };

  const redoModal = () => {
      setModalState(prev => {
          if (prev.index >= prev.history.length - 1) return prev;
          const nextIndex = prev.index + 1;
          if (contentEditableRef.current) {
              contentEditableRef.current.innerHTML = prev.history[nextIndex];
          }
          return { ...prev, index: nextIndex };
      });
  };

  const handleModalInput = (e: React.FormEvent<HTMLDivElement>) => {
      const html = e.currentTarget.innerHTML;
      if (modalHistoryTimer.current) clearTimeout(modalHistoryTimer.current);
      modalHistoryTimer.current = setTimeout(() => {
          pushModalHistory(html);
      }, 500); // デバウンス
  };
  // ----------------------------------

  const handlePrint = () => {
    showNotification('印刷画面を準備中... (開かない場合は Ctrl+P)');
    setTimeout(() => {
      try {
        window.print();
      } catch (e) {
        console.error("Print failed:", e);
      }
    }, 50);
  };

  useEffect(() => {
    if (isEditingUpdateDate) {
      updateDateInputRef.current?.focus();
    }
  }, [isEditingUpdateDate]);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const getReiwaYear = (year: number) => year - 2018;

  const cleanHtml = (html: string) => {
    if (!html) return '';
    let cleaned = html;
    cleaned = cleaned.replace(/<div[^>]*>/gi, '');
    cleaned = cleaned.replace(/<p[^>]*>/gi, '');
    cleaned = cleaned.replace(/<\/div>/gi, '<br>');
    cleaned = cleaned.replace(/<\/p>/gi, '<br>');
    cleaned = cleaned.replace(/(<br\s*\/?>\s*){2,}/gi, '<br>');
    cleaned = cleaned.replace(/^(<br\s*\/?>)+|(<br\s*\/?>)+$/gi, '');
    return cleaned;
  };

  const saveMaster = () => {
    localStorage.setItem('bathing_master_v2', JSON.stringify(masterSchedule));
    localStorage.setItem('bathing_residents_v2', JSON.stringify(residentList));
    pushToHistory(overrides, weeklyData, masterSchedule);
    showNotification('設定と名簿を保存しました');
    setIsConfigOpen(false);
  };

  const saveUpdateDate = (val: string) => {
    setManualUpdateDate(val);
    localStorage.setItem('bathing_update_date_v2', val);
    setIsEditingUpdateDate(false);
  };

  const saveFacilityName = (val: string) => {
    setFacilityName(val);
    localStorage.setItem('bathing_facility_name_v2', val);
    setIsEditingFacilityName(false);
  };

  const saveEdit = () => {
    if (!editingTarget || !contentEditableRef.current) return;
    const rawHtml = contentEditableRef.current.innerHTML;
    const cleanContent = cleanHtml(rawHtml);
    const color = editingTarget.currentColor;

    let finalOverrides = { ...overrides };
    let finalWeekly = { ...weeklyData };
    let finalMaster = { ...masterSchedule };

    if (editingTarget.type === 'day') {
        const { key, slot } = editingTarget;
        if (!slot) return;
        if (!finalOverrides[key]) finalOverrides[key] = {};
        finalOverrides[key] = { ...finalOverrides[key], [slot]: { text: cleanContent, color } };
        setOverrides(finalOverrides);
        localStorage.setItem('bathing_overrides_v2', JSON.stringify(finalOverrides));
    } else {
        const { key, weekIdx } = editingTarget;
        if (propagateToFuture && weekIdx !== undefined) {
            if (!finalMaster.weeklyFooters) finalMaster.weeklyFooters = {};
            finalMaster.weeklyFooters[weekIdx] = { text: cleanContent, color };
            setMasterSchedule(finalMaster);
            localStorage.setItem('bathing_master_v2', JSON.stringify(finalMaster));
            finalWeekly[key] = { text: cleanContent, color };
            showNotification(`第${weekIdx + 1}週の標準設定を保存しました。`);
        } else {
            finalWeekly[key] = { text: cleanContent, color };
            showNotification('変更を保存しました。');
        }
        setWeeklyData(finalWeekly);
        localStorage.setItem('bathing_weekly_v2', JSON.stringify(finalWeekly));
    }
    pushToHistory(finalOverrides, finalWeekly, finalMaster);
    setEditingTarget(null);
    setPropagateToFuture(false);
  };

  const handleExportData = () => {
    const data = {
      version: 2,
      exportedAt: new Date().toISOString(),
      masterSchedule,
      overrides,
      weeklyData,
      residentList,
      manualUpdateDate,
      facilityName
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bathing_schedule_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('データを書き出しました');
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.masterSchedule) setMasterSchedule(json.masterSchedule);
        if (json.overrides) setOverrides(json.overrides);
        if (json.weeklyData) setWeeklyData(json.weeklyData);
        if (json.residentList) setResidentList(json.residentList);
        if (json.manualUpdateDate) setManualUpdateDate(json.manualUpdateDate);
        if (json.facilityName) setFacilityName(json.facilityName);

        localStorage.setItem('bathing_master_v2', JSON.stringify(json.masterSchedule || masterSchedule));
        localStorage.setItem('bathing_overrides_v2', JSON.stringify(json.overrides || overrides));
        localStorage.setItem('bathing_weekly_v2', JSON.stringify(json.weeklyData || weeklyData));
        localStorage.setItem('bathing_residents_v2', JSON.stringify(json.residentList || residentList));
        if (json.manualUpdateDate) localStorage.setItem('bathing_update_date_v2', json.manualUpdateDate);
        if (json.facilityName) localStorage.setItem('bathing_facility_name_v2', json.facilityName);
        
        pushToHistory(json.overrides || overrides, json.weeklyData || weeklyData, json.masterSchedule || masterSchedule);

        showNotification('データを読み込みました');
        setIsConfigOpen(false);
      } catch (err) {
        console.error(err);
        showNotification('ファイルの読み込みに失敗しました');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const changeMonth = (diff: number) => {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + diff, 1));
      setCheckResult(null);
  };

  const getDayContent = (date: Date, slotKey: keyof DaySchedule): ScheduleSlot => {
    const dateKey = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();
    if (overrides[dateKey] && overrides[dateKey][slotKey]) {
        return overrides[dateKey][slotKey] as ScheduleSlot;
    }
    return masterSchedule[dayOfWeek][slotKey];
  };

  const getWeeklyContent = (sundayDate: Date, calendarWeekIdx: number): { text: string, color: ColorType } => {
      const key = sundayDate.toISOString().split('T')[0];
      if (weeklyData[key]) return weeklyData[key];
      if (masterSchedule.weeklyFooters && masterSchedule.weeklyFooters[calendarWeekIdx]) {
          return masterSchedule.weeklyFooters[calendarWeekIdx];
      }
      return masterSchedule.weeklyFooter || { text: `衛生チェック(　)`, color: 'yellow' };
  };

  const generateWeeks = useCallback(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const weeks = [];
    let currentWeek = [];
    for (let i = 0; i < firstDay.getDay(); i++) currentWeek.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) {
        currentWeek.push(new Date(year, month, i));
        if (currentWeek.length === 7) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
    }
    if (currentWeek.length > 0) {
        while (currentWeek.length < 7) currentWeek.push(null);
        weeks.push(currentWeek);
    }
    return weeks;
  }, [currentDate]);

  const runWeeklyCheck = () => {
     const year = currentDate.getFullYear();
     const month = currentDate.getMonth();
     const lastDate = new Date(year, month + 1, 0).getDate();
     const result = [];
     let currentWeekStart = 1;
     let weekIndex = 1;
     while (currentWeekStart <= lastDate) {
        const startDateObj = new Date(year, month, currentWeekStart);
        let currentWeekEnd = currentWeekStart + (6 - startDateObj.getDay());
        if (currentWeekEnd > lastDate) currentWeekEnd = lastDate;
        const counts: {[name: string]: number} = {};
        residentList.forEach(name => counts[name] = 0);
        for (let d = currentWeekStart; d <= currentWeekEnd; d++) {
            const date = new Date(year, month, d);
            const t1 = getDayContent(date, 'slot1').text;
            const t2 = getDayContent(date, 'slot2').text;
            const fullText = (t1 + " " + t2).replace(/<[^>]+>/g, '');
            residentList.forEach(name => {
                if (fullText.includes(name)) counts[name]++;
            });
        }
        const missing = residentList.filter(name => counts[name] < 2).map(name => ({ name, count: counts[name] }));
        if (missing.length > 0) result.push({ week: weekIndex, start: currentWeekStart, end: currentWeekEnd, missing });
        currentWeekStart = currentWeekEnd + 1;
        weekIndex++;
     }
     setCheckResult(result);
  };

  const execCmd = (command: string, value?: string) => {
    if (command === 'undo') {
        undoModal();
        return;
    }
    if (command === 'redo') {
        redoModal();
        return;
    }

    document.execCommand(command, false, value);
    contentEditableRef.current?.focus();
    // コマンド実行後に即座に履歴保存
    if (contentEditableRef.current) {
        pushModalHistory(contentEditableRef.current.innerHTML);
    }
  };

  const insertResidentName = (name: string) => {
    if (!name) return;
    contentEditableRef.current?.focus();
    const currentHtml = contentEditableRef.current?.innerHTML || '';
    const needsBr = currentHtml.length > 0 && !currentHtml.endsWith('<br>');
    const htmlToInsert = (needsBr ? '<br>' : '') + name + '<br>';
    document.execCommand('insertHTML', false, htmlToInsert);
    // 挿入後に履歴保存
    if (contentEditableRef.current) {
        pushModalHistory(contentEditableRef.current.innerHTML);
    }
  };

  const weeks = generateWeeks();

  return (
    <div className="app-root min-h-screen bg-gray-50 text-gray-900 font-sans print:bg-white pb-20 print:pb-0">
      {notification && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-8 py-4 rounded-xl shadow-2xl z-[100] flex items-center gap-3 animate-in fade-in zoom-in slide-in-from-top-4 duration-300 no-print print:hidden border border-gray-700">
          <Info size={20} className="text-blue-400" /> <span className="font-bold">{notification}</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-900 text-white p-4 shadow-lg sticky top-0 z-40 no-print print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
                <Calendar className="text-white" size={24} />
            </div>
            <div>
                <h1 className="text-lg font-bold leading-none">特養入浴予定表管理</h1>
                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Facility Bathing Schedule System</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {/* Global History Buttons with Enhanced UI */}
            <div className="flex items-center bg-slate-800 rounded-xl p-1.5 mr-2 border border-slate-700 shadow-inner">
              <button 
                onClick={undo} 
                disabled={historyIndex <= 0} 
                className={`p-2 rounded-lg transition-all flex items-center gap-2 text-[11px] font-black ${historyIndex <= 0 ? 'text-slate-600 opacity-30 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600 text-white active:scale-90 shadow-md ring-1 ring-slate-500'}`} 
                title="1つ前の操作を取り消す (Undo)"
              >
                <Undo2 size={16} /> 戻る
              </button>
              <div className="w-px h-6 bg-slate-700 mx-2"></div>
              <button 
                onClick={redo} 
                disabled={historyIndex >= history.length - 1} 
                className={`p-2 rounded-lg transition-all flex items-center gap-2 text-[11px] font-black ${historyIndex >= history.length - 1 ? 'text-slate-600 opacity-30 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600 text-white active:scale-90 shadow-md ring-1 ring-slate-500'}`} 
                title="取り消した操作をやり直す (Redo)"
              >
                進む <Redo2 size={16} />
              </button>
            </div>

            <div className="flex items-center bg-slate-800 rounded-xl p-1.5 mr-2 border border-slate-700">
              <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-700 rounded-lg transition-colors"><ChevronLeft size={18} /></button>
              <span className="px-4 font-mono text-base font-bold min-w-[120px] text-center">{currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月</span>
              <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-700 rounded-lg transition-colors"><ChevronRight size={18} /></button>
            </div>
            <button onClick={runWeeklyCheck} className="flex items-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95"><CheckCircle size={14} /> 回数チェック</button>
            <button onClick={openConfig} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95"><Settings size={14} /> マスタ設定</button>
            <button onClick={handlePrint} title="ブラウザの印刷画面を開きます" className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95 ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900"><Printer size={16} /> Ctrl + P で印刷</button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-[210mm] mx-auto p-6 md:p-10 print:p-0 print:w-full print:h-full">
        <div className="text-center mb-6 relative print:mb-2 print:flex print:justify-center print:items-end print:gap-4">
            <h2 className="text-2xl font-bold border-b-2 border-slate-800 inline-block px-12 pb-2 mb-1 print-border-black print:text-xl print:px-6">
                {isEditingFacilityName ? (
                    <input
                        ref={facilityNameInputRef}
                        type="text"
                        className="font-bold text-center outline-none border-b-2 border-blue-500 bg-blue-50 text-slate-900 min-w-[200px]"
                        style={{ fontSize: 'inherit' }}
                        value={facilityName}
                        onChange={(e) => setFacilityName(e.target.value)}
                        onBlur={() => saveFacilityName(facilityName)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') saveFacilityName(facilityName);
                        }}
                    />
                ) : (
                    <span 
                        onClick={() => setIsEditingFacilityName(true)} 
                        className="cursor-pointer hover:text-blue-600 hover:bg-blue-50/50 rounded px-1 transition-all print:hover:text-inherit print:hover:bg-transparent print:cursor-auto"
                        title="クリックして施設名を編集"
                    >
                        {facilityName}
                    </span>
                )}
                <span>　月間予定表（令和 {getReiwaYear(currentDate.getFullYear())} 年 {currentDate.getMonth() + 1} 月）</span>
            </h2>
            <div className="absolute right-0 top-0 no-print print:hidden">
              {isEditingUpdateDate ? (
                <div className="flex items-center gap-1 bg-white border border-red-200 rounded p-1 shadow-sm">
                  <input ref={updateDateInputRef} type="text" className="text-red-600 font-bold text-xs w-20 outline-none border-b border-red-400 focus:border-red-600 px-1" value={manualUpdateDate} onChange={(e) => setManualUpdateDate(e.target.value)} onBlur={(e) => saveUpdateDate(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveUpdateDate(e.currentTarget.value); if (e.key === 'Escape') setIsEditingUpdateDate(false); }} />
                  <button onClick={() => saveUpdateDate(manualUpdateDate)} className="text-emerald-600 hover:bg-emerald-50 rounded p-0.5"><Check size={12} /></button>
                </div>
              ) : (
                <div className="text-red-600 font-bold text-xs flex items-center gap-1 cursor-pointer hover:bg-red-50 p-1 rounded-lg transition-colors border border-transparent hover:border-red-200" onClick={() => setIsEditingUpdateDate(true)} title="クリックして更新日を編集">
                  {manualUpdateDate} 更新 <Edit3 size={12} className="text-gray-400" />
                </div>
              )}
            </div>
            <div className="hidden print:block absolute right-0 bottom-2 text-red-600 font-bold text-[10px]">
                {manualUpdateDate} 更新
            </div>
        </div>

        <div className="schedule-container border-2 border-slate-900 bg-white overflow-hidden shadow-sm print:shadow-none print-border-black print:grow">
          <div className="grid grid-cols-7 border-b-[1.5px] border-slate-900 print-border-black shrink-0">
             {['日', '月', '火', '水', '木', '金', '土'].map((day, idx) => (
                <div key={day} className={`text-center py-1.5 text-sm font-bold border-r border-slate-900 last:border-r-0 bg-slate-50 print-border-black ${idx === 0 ? 'text-red-600' : idx === 6 ? 'text-blue-600' : ''}`}>
                  {day}曜日
                </div>
              ))}
          </div>

          {weeks.map((week, weekIdx) => {
              const sun = week.find(d => d !== null) || new Date();
              const sundayRef = new Date(sun);
              sundayRef.setDate(sun.getDate() - sun.getDay());
              const weeklyContent = getWeeklyContent(sundayRef, weekIdx);

              return (
                <div key={weekIdx} className="week-row border-b border-slate-900 last:border-b-0 print-border-black flex flex-col">
                    <div className="days-grid grid grid-cols-7 flex-grow">
                        {week.map((date, dayIdx) => {
                            if (!date) return <div key={dayIdx} className="border-r border-slate-200 bg-slate-50/50 last:border-r-0 no-print" />;
                            const slot1 = getDayContent(date, 'slot1');
                            const slot2 = getDayContent(date, 'slot2');
                            const slot3 = getDayContent(date, 'slot3');

                            return (
                                <div key={date.toISOString()} className="border-r border-slate-900 last:border-r-0 flex flex-col h-full print-border-black overflow-hidden">
                                    <div className={`text-center text-[11px] font-bold border-b border-slate-500 py-0.5 bg-white shrink-0 ${dayIdx === 0 ? 'text-red-600' : dayIdx === 6 ? 'text-blue-600' : ''}`}>
                                        {date.getDate()}
                                    </div>
                                    <div onClick={() => setEditingTarget({ type: 'day', key: date.toISOString().split('T')[0], slot: 'slot1', initialHtml: slot1.text, currentColor: slot1.color })} className={`tight-cell flex-1 flex flex-col items-center justify-center text-center p-0.5 cursor-pointer hover:bg-black/5 transition-colors border-b border-dashed border-slate-400 ${BG_COLOR_MAP[slot1.color].bg}`} dangerouslySetInnerHTML={{ __html: slot1.text }} />
                                    <div onClick={() => setEditingTarget({ type: 'day', key: date.toISOString().split('T')[0], slot: 'slot2', initialHtml: slot2.text, currentColor: slot2.color })} className={`tight-cell flex-1 flex flex-col items-center justify-center text-center p-0.5 cursor-pointer hover:bg-black/5 transition-colors border-b border-dashed border-slate-400 ${BG_COLOR_MAP[slot2.color].bg}`} dangerouslySetInnerHTML={{ __html: slot2.text }} />
                                    <div onClick={() => setEditingTarget({ type: 'day', key: date.toISOString().split('T')[0], slot: 'slot3', initialHtml: slot3.text, currentColor: slot3.color })} className={`tight-cell min-h-[1.5rem] flex flex-col items-center justify-center text-center p-0.5 font-bold cursor-pointer hover:bg-black/5 transition-colors text-red-700 ${BG_COLOR_MAP[slot3.color].bg}`} dangerouslySetInnerHTML={{ __html: slot3.text }} />
                                </div>
                            );
                        })}
                    </div>
                    <div onClick={() => { setPropagateToFuture(false); setEditingTarget({ type: 'week', key: sundayRef.toISOString().split('T')[0], weekIdx: weekIdx, initialHtml: weeklyContent.text, currentColor: weeklyContent.color }); }} className={`footer-row tight-cell w-full border-t border-slate-900 text-center text-[10px] font-medium py-1 cursor-pointer hover:bg-black/5 transition-colors print-border-black shrink-0 ${BG_COLOR_MAP[weeklyContent.color].bg}`} dangerouslySetInnerHTML={{ __html: weeklyContent.text }} />
                </div>
              );
          })}
        </div>
      </main>

      {/* Editor Modal */}
      {editingTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 no-print print:hidden">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2"><Edit3 size={18} /> {editingTarget.type === 'day' ? '予定の編集' : '週次項目の編集'}</h3>
                <button onClick={() => setEditingTarget(null)} className="p-1 hover:bg-slate-700 rounded transition-colors"><X size={20}/></button>
            </div>
            <div className="p-6">
                {editingTarget.type === 'day' && (
                    <div className="mb-4">
                      <label className="text-xs font-bold text-slate-500 block mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                        <UserPlus size={14} className="text-blue-500" /> 名簿から追加
                      </label>
                      <select className="w-full border-2 border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:border-blue-400 focus:outline-none transition-colors" onChange={(e) => { insertResidentName(e.target.value); e.target.value = ""; }} defaultValue="">
                        <option value="" disabled>入所者を選択してください...</option>
                        {residentList.map(name => ( <option key={name} value={name}>{name}</option> ))}
                      </select>
                    </div>
                )}
                {/* Editor Specific History Buttons */}
                <div className="flex items-center gap-2 mb-3 p-2 bg-slate-100 rounded-lg border border-slate-200 shadow-inner overflow-x-auto">
                    <div className="flex items-center gap-1 mr-1">
                      <button onMouseDown={(e) => { e.preventDefault(); execCmd('undo'); }} className={`p-2 rounded-lg transition-all flex items-center gap-1 ${modalState.index > 0 ? 'hover:bg-white hover:shadow-sm text-slate-600 active:scale-90' : 'text-slate-400 cursor-not-allowed opacity-50'}`} title="入力内容を戻す (Ctrl+Z)"><Undo2 size={16}/></button>
                      <button onMouseDown={(e) => { e.preventDefault(); execCmd('redo'); }} className={`p-2 rounded-lg transition-all flex items-center gap-1 ${modalState.index < modalState.history.length - 1 ? 'hover:bg-white hover:shadow-sm text-slate-600 active:scale-90' : 'text-slate-400 cursor-not-allowed opacity-50'}`} title="入力内容をやり直す (Ctrl+Y)"><Redo2 size={16}/></button>
                    </div>
                    <div className="w-px h-6 bg-slate-300 mx-1 shrink-0"></div>
                    <button onMouseDown={(e) => { e.preventDefault(); execCmd('bold'); }} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all shrink-0 font-black" title="太字">B</button>
                    <div className="w-px h-6 bg-slate-300 mx-1 shrink-0"></div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onMouseDown={(e) => { e.preventDefault(); execCmd('foreColor', '#000000'); }} className="w-6 h-6 rounded-full bg-black ring-1 ring-slate-400 hover:scale-110 transition-transform"></button>
                      <button onMouseDown={(e) => { e.preventDefault(); execCmd('foreColor', '#dc2626'); }} className="w-6 h-6 rounded-full bg-red-600 ring-1 ring-slate-400 hover:scale-110 transition-transform"></button>
                      <button onMouseDown={(e) => { e.preventDefault(); execCmd('foreColor', '#1d4ed8'); }} className="w-6 h-6 rounded-full bg-blue-700 ring-1 ring-slate-400 hover:scale-110 transition-transform"></button>
                      <button onMouseDown={(e) => { e.preventDefault(); execCmd('foreColor', '#16a34a'); }} className="w-6 h-6 rounded-full bg-green-600 ring-1 ring-slate-400 hover:scale-110 transition-transform"></button>
                    </div>
                </div>
                <div 
                    key={editingTarget.key + (editingTarget.slot || editingTarget.weekIdx)}
                    ref={contentEditableRef} 
                    contentEditable 
                    onInput={handleModalInput}
                    suppressContentEditableWarning={true}
                    className="tight-cell w-full border-2 border-slate-200 p-4 rounded-lg min-h-[140px] text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-center flex flex-col justify-center" 
                />
                {editingTarget.type === 'week' && (
                    <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-3">
                        <input type="checkbox" id="propagateCheck" className="w-5 h-5 accent-amber-600 cursor-pointer mt-0.5" checked={propagateToFuture} onChange={(e) => setPropagateToFuture(e.target.checked)} />
                        <label htmlFor="propagateCheck" className="text-sm font-bold text-amber-900 cursor-pointer leading-tight">
                            <span className="flex items-center gap-1.5 mb-1"><Globe size={14} className="text-amber-600" /> 今後の「第 {editingTarget.weekIdx !== undefined ? editingTarget.weekIdx + 1 : '?'} 週」の標準にする</span>
                            <span className="text-[10px] text-amber-700 font-normal block">チェックを入れると、翌月以降の同じ週番号の初期値がこの内容に更新されます。</span>
                        </label>
                    </div>
                )}
                <div className="mt-4">
                    <label className="text-xs font-bold text-slate-500 block mb-2 uppercase tracking-wide">背景色選択</label>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(BG_COLOR_MAP).map(([key, val]) => (
                            <button key={key} onClick={() => setEditingTarget({ ...editingTarget, currentColor: key as ColorType })} className={`w-8 h-8 rounded-full border-2 transition-all ${val.bg} ${editingTarget.currentColor === key ? 'border-slate-800 scale-110 shadow-md ring-2 ring-slate-200' : 'border-slate-200 opacity-60 hover:opacity-100'}`} title={val.label} />
                        ))}
                    </div>
                </div>
                <div className="mt-6 flex gap-3">
                    <button onClick={() => setEditingTarget(null)} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-bold transition-colors">閉じる</button>
                    <button onClick={saveEdit} className="flex-2 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-lg shadow-blue-200 flex items-center justify-center gap-2 active:scale-95 transition-all"><Save size={18}/> 保存</button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Config Panel */}
      {isConfigOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center z-[100] no-print print:hidden overflow-y-auto p-4 md:p-10">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-4 flex flex-col max-h-full overflow-hidden">
            <div className="bg-slate-800 p-6 text-white flex justify-between items-center shrink-0">
                <div>
                    <h3 className="text-xl font-bold flex items-center gap-2"><Users size={24} /> マスタ設定・名簿管理</h3>
                    <p className="text-xs text-slate-400 mt-1">基本パターンの登録と入所者名簿の編集を行います</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-slate-700/50 p-1 rounded-lg border border-slate-600">
                        <button 
                            onMouseDown={(e) => { e.preventDefault(); undoConfig(); }} 
                            className={`p-2 rounded-md transition-colors ${configHistoryIndex > 0 ? 'text-slate-300 hover:text-white hover:bg-slate-600' : 'text-slate-600 cursor-not-allowed'}`}
                            title="入力を元に戻す"
                        >
                            <Undo2 size={18} />
                        </button>
                        <div className="w-px h-5 bg-slate-600"></div>
                        <button 
                            onMouseDown={(e) => { e.preventDefault(); redoConfig(); }} 
                            className={`p-2 rounded-md transition-colors ${configHistoryIndex < configHistory.length - 1 ? 'text-slate-300 hover:text-white hover:bg-slate-600' : 'text-slate-600 cursor-not-allowed'}`}
                            title="入力をやり直す"
                        >
                            <Redo2 size={18} />
                        </button>
                    </div>
                    <div className="w-px h-8 bg-slate-700 mx-2 hidden sm:block"></div>
                    <button onClick={() => setIsConfigOpen(false)} className="p-2 hover:bg-slate-700 rounded-full transition-colors"><X size={24}/></button>
                </div>
            </div>
            <div className="p-8 overflow-y-auto grow">
                <section className="mb-10 bg-blue-50/50 p-6 rounded-2xl border border-blue-100 shadow-inner">
                    <h4 className="font-bold text-sm mb-4 text-blue-900 flex items-center gap-2"><ListChecks size={18} /> 週番号ごとのデフォルト設定 (マスタ)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {[0, 1, 2, 3, 4].map(idx => (
                            <div key={idx} className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                                <label className="text-[10px] font-black text-blue-600 mb-2 block uppercase tracking-tighter">第 {idx + 1} 週目</label>
                                <textarea 
                                    className="w-full border-2 border-slate-50 p-2 rounded-lg h-20 text-xs mb-3 focus:border-blue-300 focus:outline-none transition-all resize-none bg-slate-50/50 font-medium" 
                                    value={masterSchedule.weeklyFooters?.[idx]?.text.replace(/<br>/g, '\n') || ''} 
                                    placeholder="衛生チェック..." 
                                    onChange={(e) => { const next = { ...masterSchedule }; if (!next.weeklyFooters) next.weeklyFooters = {}; if (!next.weeklyFooters[idx]) next.weeklyFooters[idx] = { text: '', color: 'yellow' }; next.weeklyFooters[idx].text = e.target.value.replace(/\n/g, '<br>'); setMasterSchedule(next); }} 
                                    onBlur={() => pushConfigHistory(masterSchedule)}
                                />
                                <div className="flex gap-1 justify-center">
                                    {(['pink', 'blue', 'yellow', 'white', 'gray'] as ColorType[]).map(c => ( <button key={c} onClick={() => { const next = { ...masterSchedule }; if (!next.weeklyFooters) next.weeklyFooters = {}; if (!next.weeklyFooters[idx]) next.weeklyFooters[idx] = { text: '', color: 'yellow' }; next.weeklyFooters[idx].color = c; setMasterSchedule(next); pushConfigHistory(next); }} className={`w-4 h-4 rounded-full transition-all ${BG_COLOR_MAP[c].bg} ${masterSchedule.weeklyFooters?.[idx]?.color === c ? 'ring-2 ring-slate-800 scale-125' : 'ring-1 ring-slate-200'}`} /> ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
                <section className="mb-10 bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 shadow-inner">
                    <h4 className="font-bold text-sm mb-4 text-indigo-900 flex items-center gap-2"><Users size={18} /> 入所者名簿</h4>
                    <div className="flex flex-wrap gap-2 mb-6">
                        {residentList.map((name, idx) => (
                            <div key={idx} className="bg-white border border-indigo-200 px-4 py-2 rounded-xl text-sm font-medium shadow-sm flex items-center gap-2 group hover:border-indigo-400 transition-colors">
                                {name} <button onClick={() => setResidentList(residentList.filter(n => n !== name))} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2 max-w-sm">
                        <input type="text" id="newResInput" className="flex-1 border-2 border-indigo-100 px-4 py-2 rounded-xl text-sm focus:outline-none focus:border-indigo-400 transition-all" placeholder="新しい名前を入力..." onKeyDown={(e) => { if (e.key === 'Enter') { const val = e.currentTarget.value.trim(); if (val && !residentList.includes(val)) { setResidentList([...residentList, val]); e.currentTarget.value = ''; } } }} />
                        <button onClick={() => { const el = document.getElementById('newResInput') as HTMLInputElement; const val = el.value.trim(); if (val && !residentList.includes(val)) { setResidentList([...residentList, val]); el.value = ''; } }} className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 active:scale-95"><Plus size={20}/></button>
                    </div>
                </section>
                <h4 className="font-bold text-sm mb-6 border-l-4 border-slate-800 pl-4 uppercase tracking-widest text-slate-800">曜日固定パターン</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[0, 1, 2, 3, 4, 5, 6].map((dayCode) => (
                    <div key={dayCode} className="border-2 border-slate-100 p-5 rounded-2xl bg-white hover:shadow-md transition-shadow">
                      <div className={`text-center font-black mb-4 pb-2 border-b-2 ${dayCode === 0 ? 'text-red-600 border-red-100' : dayCode === 6 ? 'text-blue-600 border-blue-100' : 'text-slate-700 border-slate-100'}`}>{['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'][dayCode]}</div>
                      {['slot1', 'slot2', 'slot3'].map((slot, sIdx) => {
                          const sKey = slot as keyof DaySchedule;
                          return (
                            <div key={slot} className="mb-4 last:mb-0">
                                <div className="flex justify-between items-end mb-1">
                                    <label className="text-[10px] font-bold text-slate-400 block uppercase">{sIdx === 0 ? '上段' : sIdx === 1 ? '中段' : '下段'}</label>
                                    <select
                                        className="text-[10px] border border-slate-200 rounded px-1 py-0.5 bg-slate-50 text-slate-600 focus:outline-none focus:border-blue-400 max-w-[120px]"
                                        onChange={(e) => {
                                            const name = e.target.value;
                                            if (name) {
                                                const next = { ...masterSchedule };
                                                const current = next[dayCode][sKey].text;
                                                next[dayCode][sKey].text = current ? `${current}<br>${name}` : name;
                                                setMasterSchedule(next);
                                                pushConfigHistory(next);
                                                e.target.value = "";
                                            }
                                        }}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>+ 名簿から追加</option>
                                        {residentList.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                                <textarea 
                                    className="w-full border-2 border-slate-50 p-2 rounded-lg h-20 text-xs mb-2 focus:border-slate-300 focus:outline-none transition-all resize-none bg-slate-50/50" 
                                    value={masterSchedule[dayCode][sKey].text.replace(/<br>/g, '\n')} 
                                    onChange={(e) => { const next = { ...masterSchedule }; next[dayCode][sKey].text = e.target.value.replace(/\n/g, '<br>'); setMasterSchedule(next); }} 
                                    onBlur={() => pushConfigHistory(masterSchedule)}
                                />
                                <div className="flex gap-1.5 justify-end">
                                    {(['pink', 'blue', 'yellow', 'white', 'gray'] as ColorType[]).map(c => ( <button key={c} onClick={() => { const next = { ...masterSchedule }; next[dayCode][sKey].color = c; setMasterSchedule(next); pushConfigHistory(next); }} className={`w-5 h-5 rounded-full ring-offset-2 transition-all ${BG_COLOR_MAP[c].bg} ${masterSchedule[dayCode][sKey].color === c ? 'ring-2 ring-slate-800 scale-110 shadow-sm' : 'ring-1 ring-slate-200'}`} /> ))}
                                </div>
                            </div>
                          );
                      })}
                    </div>
                  ))}
                </div>

                <section className="mt-8 mb-6 bg-slate-100 p-6 rounded-2xl border border-slate-200">
                  <h4 className="font-bold text-sm mb-4 text-slate-700 flex items-center gap-2"><FileJson size={18} /> データ管理 (バックアップ・復元)</h4>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button onClick={handleExportData} className="flex-1 py-3 px-4 bg-white border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-bold flex items-center justify-center gap-2 transition-all shadow-sm">
                      <Download size={18} /> セーブデータを書き出し
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-3 px-4 bg-white border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-bold flex items-center justify-center gap-2 transition-all shadow-sm">
                      <Upload size={18} /> セーブデータを読み込み
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleImportData} accept=".json" className="hidden" />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2 ml-1">
                    ※「書き出し」を行うと現在のすべての設定・入力内容がファイルとして保存されます。「読み込み」を行うと現在の内容が上書きされますのでご注意ください。
                  </p>
                </section>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 shrink-0">
                <button onClick={() => setIsConfigOpen(false)} className="px-6 py-2.5 bg-white border-2 border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 font-bold transition-all">破棄して閉じる</button>
                <button onClick={saveMaster} className="px-10 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold shadow-lg shadow-blue-200 transition-all flex items-center gap-2 active:scale-95"><Save size={20}/> 設定を保存</button>
            </div>
          </div>
        </div>
      )}

      {/* Compliance Check Results */}
      {checkResult && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center z-[100] no-print print:hidden overflow-y-auto p-4 md:p-10">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-10">
            <div className="bg-amber-600 p-5 text-white flex justify-between items-center">
                <h3 className="font-bold text-lg flex items-center gap-2"><CheckCircle size={24} /> 入浴回数確認結果</h3>
                <button onClick={() => setCheckResult(null)} className="p-1 hover:bg-amber-700 rounded-full transition-colors"><X size={24}/></button>
            </div>
            <div className="p-8 max-h-[70vh] overflow-y-auto">
                {checkResult.length === 0 ? (
                    <div className="text-center py-10">
                        <div className="bg-emerald-100 text-emerald-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} /></div>
                        <h4 className="text-xl font-bold text-slate-800">問題ありません</h4>
                        <p className="text-slate-500 mt-2">全員が各週2回以上の入浴予定となっています。</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <p className="text-sm text-slate-600 bg-amber-50 p-4 rounded-xl border border-amber-200">以下の入所者は週の入浴回数が不足しています (2回未満):</p>
                        {checkResult.map((weekData, idx) => (
                            <div key={idx} className="bg-white border-2 border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                                <h4 className="font-bold text-xs text-white bg-slate-800 px-4 py-2 uppercase tracking-widest">第 {weekData.week} 週 <span className="text-slate-400 font-normal ml-2">({currentDate.getMonth()+1}/{weekData.start} 〜 {weekData.end})</span></h4>
                                <div className="p-4 grid grid-cols-2 gap-2">
                                    {weekData.missing.map((m: any, i: number) => (
                                        <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-red-50 border border-red-100">
                                            <span className="text-sm font-bold text-red-900">{m.name}</span>
                                            <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-black">{m.count} 回</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button onClick={() => setCheckResult(null)} className="px-10 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 font-bold shadow-lg transition-all active:scale-95">確認しました</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
